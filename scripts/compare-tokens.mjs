#!/usr/bin/env node
/**
 * `D-10` / `D-14` guard: the two Expo apps share **29 identically-named files, zero byte-identical**.
 * The largest consequence is `constants/theme.ts`, where the same token name resolves to different
 * values in the two apps (`tabBarHeight`: 52 here, 56 in Promoter).
 *
 * A raw `diff` of the two files is 1,130 lines and useless, because the two repos use different
 * prettier configs (Promoter: single quotes / 4-space; Admin App: double quotes / 2-space). The
 * formatting noise hides the seven *semantic* differences. This script removes that noise by
 * formatting **both** sources with one fixed prettier config before comparing, so what remains is
 * only what a tool cannot explain away.
 *
 * Usage
 *   node scripts/compare-tokens.mjs              # fail on any difference not in the baseline
 *   node scripts/compare-tokens.mjs --verbose    # also print baselined differences
 *   node scripts/compare-tokens.mjs --list       # print the baseline fingerprints and exit
 *
 * Exit codes: 0 = only known differences · 1 = new divergence · 2 = setup problem
 *
 * The baseline is NOT a whitelist of acceptable divergence — it is a snapshot of known debt. Every
 * entry should eventually be resolved, at which point the entry is deleted and the guard tightens.
 *
 * ## Why this is not a CI gate (stated, not hidden)
 *
 * It needs the **sibling repo** checked out next to this one. `.github/workflows/ci.yml` checks out a
 * single repo, so in CI this script would always exit 2. Adding it there with `|| true` would be
 * theatre — a guard that always passes is worse than no guard, because it reads as coverage.
 *
 * So it is a **workspace-level check**, run from the multi-repo root where both apps exist:
 *   * before touching `src/constants/theme.ts`, `config.ts`, or `components/ui/*`
 *   * as part of the quarterly drift review (`06-tech-debt-prevention.md` Rule 8)
 *
 * The CI-enforceable half of this problem — this app's own token values not silently changing — is
 * covered by the committed baseline plus code review; the durable fix is taking the shared values out
 * of two copies and into one package (see DD-05).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SIBLING = resolve(REPO, "..", "LinkCard_Promoter_App_Expo");

/** The pair under comparison. Kept explicit so adding a second pair is a visible change. */
const PAIRS = [
  {
    id: "theme",
    canonical: resolve(SIBLING, "src/constants/theme.ts"),
    copy: resolve(REPO, "src/constants/theme.ts"),
    baseline: resolve(HERE, "token-divergence-baseline.json"),
  },
];

/**
 * A single fixed config for BOTH sides. Any value works as long as it is applied to both — the point
 * is to normalise away the two repos' differing configs.
 */
const CANONICAL_PRETTIER_OPTIONS = {
  parser: "typescript",
  singleQuote: true,
  tabWidth: 4,
  printWidth: 80,
  semi: true,
};

const argv = new Set(process.argv.slice(2));

/** Normalise a formatted line so whitespace/punctuation cannot register as a difference. */
function fingerprint(line) {
  return line.replace(/\s+/g, " ").replace(/;\s*$/, "").trim();
}

/**
 * Comment-only lines are dropped before comparing.
 *
 * This guard exists to catch **token values and export surfaces** diverging, not to keep two repos'
 * prose in sync. Leaving comments in produced 3 of the 27 initial findings — pure noise that would
 * have had to be baselined forever, which is how a baseline turns into a rubber stamp.
 *
 * Only whole-line comments are dropped; a trailing comment on a code line stays part of that line.
 */
function isCommentOnly(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  );
}

/**
 * Longest-common-subsequence line diff. Both files are ~700 lines, so the O(n·m) table is fine and
 * avoids depending on an external `diff` binary with platform-specific flags.
 */
function diffLines(a, b) {
  const n = a.length;
  const m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const removed = [];
  const added = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      removed.push(a[i]);
      i += 1;
    } else {
      added.push(b[j]);
      j += 1;
    }
  }
  removed.push(...a.slice(i));
  added.push(...b.slice(j));

  return { removed, added };
}

async function formatBoth(pair, prettier) {
  const sources = {
    canonical: readFileSync(pair.canonical, "utf8"),
    copy: readFileSync(pair.copy, "utf8"),
  };

  const formatted = {};
  for (const [side, source] of Object.entries(sources)) {
    const out = await prettier.format(source, CANONICAL_PRETTIER_OPTIONS);
    formatted[side] = out
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.trim() !== "" && !isCommentOnly(line));
  }
  return formatted;
}

async function main() {
  if (!existsSync(SIBLING)) {
    console.error(`compare-tokens: sibling repo not found at ${SIBLING}`);
    process.exit(2);
  }

  let prettier;
  try {
    ({ default: prettier } = await import("prettier"));
  } catch {
    console.error(
      "compare-tokens: prettier is not resolvable. Run from the app repo after `npm install`.",
    );
    process.exit(2);
  }

  let failed = false;

  for (const pair of PAIRS) {
    const baseline = existsSync(pair.baseline)
      ? new Set(JSON.parse(readFileSync(pair.baseline, "utf8"))[pair.id] ?? [])
      : new Set();

    if (argv.has("--list")) {
      console.log(
        `compare-tokens: baseline for "${pair.id}" (${baseline.size} entries)`,
      );
      for (const entry of baseline) console.log(`  ${entry}`);
      continue;
    }

    const formatted = await formatBoth(pair, prettier);
    // `removed` = lines only the canonical (Promoter) side has; `added` = only this app has.
    const { removed, added } = diffLines(formatted.canonical, formatted.copy);

    const findings = [];
    for (const line of removed) {
      findings.push({
        kind: "canonical-only",
        fingerprint: fingerprint(line),
        line,
      });
    }
    for (const line of added) {
      findings.push({
        kind: "copy-only",
        fingerprint: fingerprint(line),
        line,
      });
    }

    const unknown = findings.filter((f) => !baseline.has(f.fingerprint));
    const known = findings.filter((f) => baseline.has(f.fingerprint));
    // Baseline entries that no longer appear = debt that got resolved. Not a failure, but it must be
    // pruned or the baseline silently drifts into a rubber stamp.
    const matched = new Set(known.map((f) => f.fingerprint));
    const stale = [...baseline].filter((entry) => !matched.has(entry));

    if (unknown.length > 0) {
      failed = true;
      console.error(
        `\ncompare-tokens: ${pair.id} — ${unknown.length} NEW semantic difference(s) between\n` +
          `  ${pair.canonical}\n  ${pair.copy}\n`,
      );
      for (const f of unknown) console.error(`  [${f.kind}] ${f.line}`);
      console.error(
        `\nResolve the divergence. If you are accepting it deliberately, add these fingerprints\n` +
          `to ${pair.baseline} under key "${pair.id}" — by hand, so that accepting debt is a\n` +
          `reviewable edit and not a side effect:\n`,
      );
      console.error(
        JSON.stringify(
          [
            ...new Set([...baseline, ...unknown.map((f) => f.fingerprint)]),
          ].sort(),
          null,
          4,
        ),
      );
    } else {
      console.log(
        `compare-tokens: ${pair.id} — OK (${known.length} known difference(s), 0 new)`,
      );
    }

    if (argv.has("--verbose") && known.length > 0) {
      console.log("  known:");
      for (const f of known) console.log(`    [${f.kind}] ${f.line}`);
    }

    if (stale.length > 0) {
      console.log(
        `  note: ${stale.length} baseline entr(ies) no longer match — prune them to keep the guard meaningful:`,
      );
      for (const entry of stale) console.log(`    ${entry}`);
    }
  }

  process.exit(failed ? 1 : 0);
}

await main();
