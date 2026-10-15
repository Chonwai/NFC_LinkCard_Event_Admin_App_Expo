/**
 * Minimal .env loader for the handbook tooling.
 *
 * Avoids adding a dependency just to read four values. Reads
 * docs/handbook/.capture.env (gitignored) and lets real process env win so CI
 * or a one-off `VAR=... node ...` can override anything.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to docs/handbook/ */
export const HANDBOOK_ROOT = path.resolve(HERE, "..");

function parseEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const FILE_ENV = parseEnvFile(path.join(HANDBOOK_ROOT, ".capture.env"));

/**
 * The seeder rewrites the demo event on every run, so its id changes and any
 * copy pasted into .capture.env goes stale. Stale ids fail quietly — the event
 * screens just report that they could not load — so read the id from the
 * seeder's own output instead of trusting a hand-copied value.
 */
const SEED_FILE = path.join(HANDBOOK_ROOT, ".capture", "seed.json");

function readSeed() {
  if (!fs.existsSync(SEED_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  } catch {
    return {};
  }
}

/** The id of the event the seeder most recently created. */
export function seedEventId() {
  return readSeed()?.event?.id ?? "";
}

/** A registration code the seeder produced, e.g. "confirmed" or "cancelled". */
export function seedCode(name) {
  return readSeed()?.codes?.[name] ?? "";
}

/** Read a required value; throws with a helpful message if absent. */
export function env(key) {
  const value = process.env[key] || seedValue(key) || FILE_ENV[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Copy docs/handbook/.capture.env.example to ` +
        `docs/handbook/.capture.env and fill it in, or run the seeder first.`,
    );
  }
  return value;
}

/**
 * Values that the seeder owns rather than the env file.
 *
 * These take priority over .capture.env on purpose. The seeder rebuilds its
 * event every run, so an id copied into the env file is wrong the moment anyone
 * reseeds — and a wrong id does not error, it just makes every event screen
 * report that it could not load, which is a confusing way to spend an afternoon.
 */
function seedValue(key) {
  switch (key) {
    case "HANDBOOK_EVENT_ID":
      return seedEventId();
    case "HANDBOOK_EVENT_SLUG":
      return readSeed()?.event?.slug ?? "";
    case "HANDBOOK_CODE_CONFIRMED":
      return seedCode("confirmed");
    case "HANDBOOK_CODE_CONFIRMED_2":
      return seedCode("confirmed2");
    case "HANDBOOK_CODE_CONFIRMED_3":
      return seedCode("confirmed3");
    case "HANDBOOK_CODE_CHECKED_IN":
      return seedCode("checkedIn");
    case "HANDBOOK_CODE_PENDING":
      return seedCode("pendingPayment");
    case "HANDBOOK_CODE_CANCELLED":
      return seedCode("cancelled");
    default:
      return "";
  }
}

/** Read an optional value. */
export function envOr(key, fallback = "") {
  return process.env[key] || seedValue(key) || FILE_ENV[key] || fallback;
}

/** True when the key is present and non-empty. */
export function hasEnv(key) {
  return Boolean(process.env[key] || FILE_ENV[key]);
}
