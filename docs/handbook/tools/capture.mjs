/**
 * Handbook capture — walk every manifest step and take a picture of it.
 *
 * Two things get saved per step:
 *   assets/raw/<stepId>.png     the screenshot, phone-sized at 2x
 *   assets/boxes/<stepId>.json  where each callout target actually was, in CSS px
 *
 * The boxes are measured from the live DOM rather than guessed, which is the
 * whole point: an annotation drawn from a stale coordinate is a handbook telling
 * someone to press the wrong thing.
 *
 * If a callout target cannot be found, this fails. Silently skipping it would
 * ship a picture with a number that points at nothing.
 *
 * Run (against a freshly seeded dataset — some steps change state):
 *   node docs/handbook/tools/capture.mjs
 *   node docs/handbook/tools/capture.mjs --only C3
 */
import {
  openApp,
  login,
  goToRoute,
  appText,
  freezeFrame,
} from "./app-session.mjs";
import { env, HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

const manifest = JSON.parse(
  fs.readFileSync(path.join(HANDBOOK_ROOT, "manifest.json"), "utf8"),
);
const RAW_DIR = path.join(HANDBOOK_ROOT, "assets", "raw");
const BOX_DIR = path.join(HANDBOOK_ROOT, "assets", "boxes");

const only = readFlag("--only");

function readFlag(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? "").toUpperCase();
}

/** Values referenced from .capture.env, so no credential is written into the manifest. */
function resolveValue(token) {
  if (!token.startsWith("env:")) return token;
  const key = token.slice(4);
  const map = {
    ORGANIZER_EMAIL: () => env("HANDBOOK_LOGIN_EMAIL"),
    ORGANIZER_PASSWORD: () => env("HANDBOOK_LOGIN_PASSWORD"),
    STAFF_EMAIL: () => env("HANDBOOK_STAFF_EMAIL"),
    STAFF_PASSWORD: () => env("HANDBOOK_STAFF_PASSWORD"),
    EVENT_ID: () => env("HANDBOOK_EVENT_ID"),
    CODE_CONFIRMED: () => env("HANDBOOK_CODE_CONFIRMED"),
    CODE_CONFIRMED_2: () => env("HANDBOOK_CODE_CONFIRMED_2"),
    CODE_CONFIRMED_3: () => env("HANDBOOK_CODE_CONFIRMED_3"),
    CODE_CHECKED_IN: () => env("HANDBOOK_CODE_CHECKED_IN"),
    CODE_PENDING: () => env("HANDBOOK_CODE_PENDING"),
    CODE_CANCELLED: () => env("HANDBOOK_CODE_CANCELLED"),
    VISITOR_EMAIL: () => "handbook.visitor@example.com",
  };
  if (!map[key]) throw new Error(`unknown env placeholder ${token}`);
  return map[key]();
}

function expandRoute(route) {
  return route.replace("{eventId}", env("HANDBOOK_EVENT_ID"));
}

/** A route that still has an unresolved placeholder is documentation, not a target. */
function routeIsRoutable(route) {
  return !expanded(route).includes("{");
}
function expanded(route) {
  return expandRoute(route);
}

async function measure(page, targets) {
  const boxes = [];
  for (const target of targets) {
    const locator = page.locator(target.target).first();
    const count = await page.locator(target.target).count();
    if (count === 0) {
      throw new Error(
        `callout ${target.label} target not found: ${target.target}\n` +
          `      on screen: ${(await appText(page)).replace(/\n+/g, " | ").slice(0, 160)}`,
      );
    }
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const box = await locator.boundingBox();
    if (!box || box.width < 1 || box.height < 1) {
      throw new Error(`callout ${target.label} has no box (${target.target})`);
    }
    boxes.push({
      label: target.label,
      whatZh: target.whatZh,
      whatEn: target.whatEn,
      target: target.target,
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    });
  }
  return boxes;
}

/**
 * A step's action may be a single action or a list of them, so one screenshot
 * can show the result of a short sequence (type a code, then submit).
 */
async function performAction(page, action) {
  const list = Array.isArray(action) ? action : [action];
  for (const one of list) await performOne(page, one);
}

async function performOne(page, action) {
  switch (action.type) {
    case "goto":
      await goToRoute(page, expandRoute(action.route));
      return;
    case "fill":
      await page
        .locator(action.target)
        .first()
        .fill(resolveValue(action.value));
      await page.waitForTimeout(300);
      return;
    case "click":
      await page.locator(action.target).first().click();
      await page.waitForTimeout(1500);
      return;
    case "offline":
      // Deliberately knock the backend out so the screen shows what a door
      // worker actually sees when the venue wifi drops.
      await page.route("**/api/**", (route) => route.abort());
      await page.waitForTimeout(200);
      return;
    case "online":
      await page.unroute("**/api/**");
      await page.waitForTimeout(200);
      return;
    case "none":
      return;
    default:
      throw new Error(`unknown action type ${action.type}`);
  }
}

async function captureSegment(segment, report) {
  const { persona, signedOut, journeys } = segment;
  console.log(
    `\n=== ${persona}${signedOut ? " (signed out)" : ""} — ${journeys.length} journeys ===`,
  );

  const app = await openApp();
  const { page } = app;

  try {
    // The sign-in journey has to observe the app before anyone is signed in, so
    // it runs in a fresh context with no login.
    if (!signedOut) {
      await goToRoute(page, "/");
      await login(page, {
        email: resolveValue(
          persona === "staff" ? "env:STAFF_EMAIL" : "env:ORGANIZER_EMAIL",
        ),
        password: resolveValue(
          persona === "staff" ? "env:STAFF_PASSWORD" : "env:ORGANIZER_PASSWORD",
        ),
      });
    }

    for (const journey of journeys) {
      console.log(`  ${journey.id} ${journey.titleEn}`);
      for (const step of journey.steps) {
        try {
          await performAction(page, step.action ?? { type: "none" });
          if (
            step.action?.type !== "goto" &&
            routeIsRoutable(step.route) &&
            step.action?.type === "none"
          ) {
            // Keep the session on the documented screen without a reload, so
            // in-page state (a filled form, an open result card) survives.
            const current = new URL(page.url()).pathname;
            const want = expanded(step.route);
            if (current !== want) await goToRoute(page, want);
          }
          await freezeFrame(page);

          const boxes = await measure(page, step.annotate ?? []);
          await page.screenshot({ path: path.join(RAW_DIR, `${step.id}.png`) });
          fs.writeFileSync(
            path.join(BOX_DIR, `${step.id}.json`),
            `${JSON.stringify({ stepId: step.id, screen: step.screen, boxes }, null, 2)}\n`,
          );
          report.steps.push({ id: step.id, ok: true, callouts: boxes.length });
          console.log(`    ok ${step.id} (${boxes.length} callouts)`);
        } catch (error) {
          report.steps.push({
            id: step.id,
            ok: false,
            error: String(error.message).slice(0, 300),
          });
          console.log(
            `    FAIL ${step.id}: ${String(error.message).split("\n")[0].slice(0, 140)}`,
          );
        }
      }
    }
  } finally {
    report.consoleErrors.push(...app.consoleErrors.slice(0, 5));
    await app.close();
  }
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(BOX_DIR, { recursive: true });

  const report = {
    capturedAt: new Date().toISOString(),
    steps: [],
    consoleErrors: [],
  };

  const segments = [];
  for (const journey of manifest.journeys) {
    if (only && !journey.id.startsWith(only)) continue;
    const key = `${journey.persona}|${journey.signedOut ? "out" : "in"}`;
    const last = segments[segments.length - 1];
    if (last && last.key === key) {
      last.journeys.push(journey);
    } else {
      segments.push({
        key,
        persona: journey.persona,
        signedOut: Boolean(journey.signedOut),
        journeys: [journey],
      });
    }
  }

  for (const segment of segments) {
    await captureSegment(segment, report);
  }

  const ok = report.steps.filter((s) => s.ok).length;
  const failed = report.steps.filter((s) => !s.ok);
  const totalBoxes = report.steps.reduce((n, s) => n + (s.callouts ?? 0), 0);

  fs.writeFileSync(
    path.join(HANDBOOK_ROOT, "assets", "capture-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log(
    `\ncaptured ${ok}/${report.steps.length} steps, ${totalBoxes} callouts`,
  );
  if (failed.length > 0) {
    console.log("\nfailed steps:");
    for (const f of failed) console.log(`  ${f.id}: ${f.error.split("\n")[0]}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("capture failed:", error.message);
  process.exit(1);
});
