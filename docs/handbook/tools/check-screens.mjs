/**
 * Handbook — screen health check.
 *
 * A cheap smoke test that answers "is the app still capturable?" before a
 * handbook rebuild. It signs in through the real form, walks every screen, and
 * reports what each one rendered plus what the backend returned.
 *
 * It deliberately does NOT take handbook screenshots — `capture.mjs` owns those.
 * This is the thing to run first when a rebuild fails, because it separates
 * "the app changed" from "the capture pipeline broke".
 *
 * Run: node docs/handbook/tools/check-screens.mjs
 */
import {
  openApp,
  login,
  goToRoute,
  appText,
  playwrightVersion,
} from "./app-session.mjs";
import { envOr, HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT = path.join(HANDBOOK_ROOT, ".probe");
const EVENT_ID = envOr("HANDBOOK_EVENT_ID");
const REGISTRATION_ID = envOr("HANDBOOK_REG_ID");

/**
 * Every screen the app ships, paired with the route that reaches it.
 *
 * Routes come from src/app/(auth)/[eventId]/ — the file names are the truth.
 */
const SCREENS = [
  { id: "home", route: "/home" },
  { id: "settings", route: "/settings" },
  { id: "overview", route: `/${EVENT_ID}/overview` },
  { id: "check-in", route: `/${EVENT_ID}/check-in` },
  { id: "walk-in", route: `/${EVENT_ID}/walk-in` },
  { id: "registrations", route: `/${EVENT_ID}/registrations` },
  {
    id: "registrant",
    route: REGISTRATION_ID
      ? `/${EVENT_ID}/registrant/${REGISTRATION_ID}`
      : null,
  },
  { id: "badges", route: `/${EVENT_ID}/badges` },
  { id: "nfc-bind", route: `/${EVENT_ID}/nfc-bind` },
  { id: "nfc-read", route: `/${EVENT_ID}/nfc-read` },
  { id: "nfc-exchange", route: `/${EVENT_ID}/nfc-exchange` },
  { id: "token", route: `/${EVENT_ID}/token` },
];

/** Collapse repeated calls so the summary stays readable. */
function summarize(calls) {
  const counts = new Map();
  for (const call of calls) {
    const key = `${call.method} ${call.path} ${call.status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, n]) =>
    n > 1 ? `${key} x${n}` : key,
  );
}

async function main() {
  if (!EVENT_ID) {
    throw new Error(
      "HANDBOOK_EVENT_ID is not set — run the seeder first, or fill in docs/handbook/.capture.env",
    );
  }

  fs.mkdirSync(OUT, { recursive: true });
  const results = [];

  const app = await openApp();
  const { page } = app;

  try {
    await goToRoute(page, "/");
    await login(page);
    await app.saveAuth();

    for (const screen of SCREENS) {
      if (!screen.route) continue;
      try {
        await goToRoute(page, screen.route);
        const text = await appText(page);
        await page.screenshot({ path: path.join(OUT, `${screen.id}.png`) });
        results.push({
          id: screen.id,
          ok: text.length > 10,
          url: page.url(),
          text: text.replace(/\n+/g, " | ").slice(0, 200),
        });
      } catch (error) {
        results.push({
          id: screen.id,
          ok: false,
          error: String(error.message).slice(0, 200),
        });
      }
    }
  } finally {
    const report = {
      playwrightVersion,
      apiOriginRewrittenTo: envOr("HANDBOOK_API_TO", "http://127.0.0.1:3020"),
      eventId: EVENT_ID,
      apiCallCount: app.apiCalls.length,
      apiCallSummary: summarize(app.apiCalls),
      consoleErrors: app.consoleErrors.slice(0, 8),
      results,
    };
    console.log(JSON.stringify(report, null, 2));
    await app.close();
  }
}

main().catch((error) => {
  console.error("check-screens failed:", error.message);
  process.exit(1);
});
