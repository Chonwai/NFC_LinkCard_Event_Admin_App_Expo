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

/** Read a required value; throws with a helpful message if absent. */
export function env(key) {
  const value = process.env[key] || FILE_ENV[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Copy docs/handbook/.capture.env.example to ` +
        `docs/handbook/.capture.env and fill it in.`,
    );
  }
  return value;
}

/** Read an optional value. */
export function envOr(key, fallback = "") {
  return process.env[key] || FILE_ENV[key] || fallback;
}

/** True when the key is present and non-empty. */
export function hasEnv(key) {
  return Boolean(process.env[key] || FILE_ENV[key]);
}
