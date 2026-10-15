/**
 * Resolves Playwright for handbook tooling.
 *
 * The Event Admin App does not depend on Playwright (it ships to phones, not
 * browsers). Rather than add a heavyweight dev dependency to the app's
 * package.json just for documentation screenshots, we borrow the workspace's
 * shared Playwright install.
 *
 * Search order:
 *   1. $HANDBOOK_PLAYWRIGHT_DIR          explicit override
 *   2. <app>/node_modules/playwright     if someone installed it locally
 *   3. <workspace>/.tools/node_modules/playwright
 *
 * ESM cannot use NODE_PATH, so we resolve by absolute path and hand back the
 * CommonJS export surface.
 */
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const CANDIDATES = [
  process.env.HANDBOOK_PLAYWRIGHT_DIR,
  path.resolve(HERE, "../../../node_modules/playwright"),
  path.resolve(HERE, "../../../../.tools/node_modules/playwright"),
].filter(Boolean);

const resolved = CANDIDATES.find((p) =>
  fs.existsSync(path.join(p, "package.json")),
);

if (!resolved) {
  throw new Error(
    "Playwright not found. Checked:\n  " +
      CANDIDATES.join("\n  ") +
      "\nSet HANDBOOK_PLAYWRIGHT_DIR to the playwright package directory.",
  );
}

const pw = require(resolved);

/** Playwright version string, recorded in capture reports for provenance. */
export const playwrightVersion = require(
  path.join(resolved, "package.json"),
).version;

export const chromium = pw.chromium;
export const devices = pw.devices;
