/**
 * Shared browser session for Event Admin App handbook captures.
 *
 * Two problems this solves:
 *
 * 1. The app compiles EXPO_PUBLIC_API_URL at bundle time, and Expo gives
 *    .env.local priority over the shell environment. So `EXPO_PUBLIC_API_URL=...`
 *    on the command line is ignored, and the app keeps talking to whatever
 *    .env.local says. We do NOT want handbook screenshots to hit a shared
 *    staging server, and we do not want to edit a developer's .env.local.
 *
 *    Instead we intercept API traffic in the browser and re-issue it against a
 *    local backend. The page only ever sees a fulfilled response, which also
 *    sidesteps CORS entirely.
 *
 * 2. Captures must be reproducible. We pin viewport, locale, timezone, and
 *    disable CSS animations/transitions so screenshots do not differ between
 *    runs for irrelevant reasons.
 */
import { chromium, playwrightVersion } from "./pw.mjs";
import { env, envOr, HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

/** iPhone 14 logical size — a realistic phone frame for a mobile handbook. */
export const VIEWPORT = { width: 390, height: 844 };
export const SCALE = 2;

/** Origin the app is built against (from .env.local). */
const API_FROM = envOr(
  "HANDBOOK_API_FROM",
  "https://staging-api.link-card.xyz",
);
/** Origin we actually want the data to come from. */
const API_TO = envOr("HANDBOOK_API_TO", "http://127.0.0.1:3020");

const CAPTURE_DIR = path.join(HANDBOOK_ROOT, ".capture");
export const AUTH_STATE_PATH = path.join(CAPTURE_DIR, "auth-state.json");

/**
 * Re-issue every request bound for the built-in API origin against the local
 * backend. Applied at context level so it covers all pages.
 */
async function installApiRewrite(context) {
  const calls = [];
  await context.route(`${API_FROM}/**`, async (route) => {
    const originalUrl = route.request().url();
    const targetUrl = originalUrl.replace(API_FROM, API_TO);
    try {
      const response = await route.fetch({ url: targetUrl });
      calls.push({
        method: route.request().method(),
        path: urlPath(originalUrl),
        status: response.status(),
      });
      await route.fulfill({ response });
    } catch (error) {
      calls.push({
        method: route.request().method(),
        path: urlPath(originalUrl),
        status: 0,
        error: String(error.message).slice(0, 120),
      });
      await route.abort();
    }
  });
  return calls;
}

function urlPath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Freeze animation so a screenshot taken twice in a row looks the same.
 * Idempotent — safe to call before every shot.
 */
export async function freezeFrame(page) {
  if (
    await page
      .evaluate(() => Boolean(window.__handbookFrozen))
      .catch(() => true)
  )
    return;
  await page.addStyleTag({
    content: `*, *::before, *::after {
            transition: none !important;
            animation: none !important;
        }`,
  });
  await page.evaluate(() => {
    window.__handbookFrozen = true;
  });
}

/**
 * Open a captured browser session against the app.
 *
 * @param {{locale?: string, reuseAuth?: boolean, headless?: boolean}} options
 */
export async function openApp({
  locale = "zh-TW",
  reuseAuth = false,
  headless = true,
} = {}) {
  const browser = await chromium.launch({ channel: "chrome", headless });
  const contextOptions = {
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale,
    timezoneId: "Asia/Macau",
    reducedMotion: "reduce",
  };
  if (reuseAuth && fs.existsSync(AUTH_STATE_PATH)) {
    contextOptions.storageState = AUTH_STATE_PATH;
  }

  const context = await browser.newContext(contextOptions);
  const apiCalls = await installApiRewrite(context);
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) =>
    consoleErrors.push(`pageerror: ${e.message.slice(0, 200)}`),
  );

  return {
    browser,
    context,
    page,
    apiCalls,
    consoleErrors,
    async close() {
      await browser.close();
    },
    /** Persist cookies + localStorage so later runs can skip the login step. */
    async saveAuth() {
      fs.mkdirSync(CAPTURE_DIR, { recursive: true });
      await context.storageState({ path: AUTH_STATE_PATH });
    },
    /** Drop the persisted session (e.g. to re-capture the login journey). */
    clearAuth() {
      if (fs.existsSync(AUTH_STATE_PATH)) fs.unlinkSync(AUTH_STATE_PATH);
    },
  };
}

/** Wait for the React tree to paint and data to settle. */
export async function settle(page, ms = 1200) {
  await page.waitForSelector("#root > *", { timeout: 30_000 });
  await page.waitForTimeout(ms);
}

/** Navigate to an in-app route by URL (fast path between journeys). */
export async function goToRoute(page, route) {
  const base = env("HANDBOOK_URL").replace(/\/$/, "");
  await page.goto(`${base}${route}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await settle(page);
  await freezeFrame(page);
}

/** Visible text of the app, newline-separated. Handy in error messages. */
export async function appText(page) {
  return (await page.locator("#root").innerText()).trim();
}

/**
 * Sign in through the real form (no API shortcut — the login journey needs it).
 * Throws with the on-screen text if the app does not reach /home.
 */
export async function login(page, { email, password } = {}) {
  const mail = email ?? env("HANDBOOK_LOGIN_EMAIL");
  const pass = password ?? env("HANDBOOK_LOGIN_PASSWORD");

  await settle(page);
  await freezeFrame(page);

  const inputs = page.locator("input");
  const count = await inputs.count();
  if (count < 2) {
    throw new Error(
      `login: expected 2 inputs, found ${count}. Screen: ${(await appText(page)).slice(0, 160)}`,
    );
  }
  await inputs.nth(0).fill(mail);
  await inputs.nth(1).fill(pass);
  await page.getByRole("button", { name: "登入" }).first().click();

  try {
    await page.waitForURL(/\/home/, { timeout: 25_000 });
  } catch {
    const onScreen = (await appText(page)).replace(/\n+/g, " | ").slice(0, 220);
    throw new Error(`login: never reached /home. On screen: ${onScreen}`);
  }
  await settle(page);
}

/**
 * Click the element carrying a piece of visible text.
 *
 * react-native-web renders Pressable as a div with role="button", but text is
 * nested a level or two down, so a plain getByText click often hits a non
 * interactive node. We try progressively looser strategies and report which
 * one worked, so a silent no-op cannot masquerade as a pass.
 *
 * @returns {Promise<{used: string, urlBefore: string, urlAfter: string}>}
 */
export async function clickText(page, text, { exact = false } = {}) {
  const urlBefore = page.url();
  const strategies = [
    {
      name: "role=button",
      run: () =>
        page
          .getByRole("button", { name: text, exact })
          .first()
          .click({ timeout: 4000 }),
    },
    {
      name: "role=button (contains)",
      run: () =>
        page
          .locator('[role="button"]')
          .filter({ hasText: text })
          .last()
          .click({ timeout: 4000 }),
    },
    {
      name: "text",
      run: () =>
        page.getByText(text, { exact }).first().click({ timeout: 4000 }),
    },
    {
      name: "text (last)",
      run: () =>
        page.getByText(text, { exact }).last().click({ timeout: 4000 }),
    },
  ];

  const failures = [];
  for (const strategy of strategies) {
    try {
      await strategy.run();
      await page.waitForTimeout(900);
      return { used: strategy.name, urlBefore, urlAfter: page.url(), failures };
    } catch (error) {
      failures.push(
        `${strategy.name}: ${String(error.message).split("\n")[0].slice(0, 90)}`,
      );
    }
  }
  throw new Error(
    `clickText("${text}") failed on every strategy:\n  ${failures.join("\n  ")}`,
  );
}

/** Assert the app navigated somewhere new after an interaction. */
export function assertNavigated(result, expected) {
  if (
    expected instanceof RegExp
      ? !expected.test(result.urlAfter)
      : !result.urlAfter.includes(expected)
  ) {
    throw new Error(
      `expected to land on ${expected} after clicking via "${result.used}", ` +
        `but URL is ${result.urlAfter} (was ${result.urlBefore})`,
    );
  }
}

export { playwrightVersion };
