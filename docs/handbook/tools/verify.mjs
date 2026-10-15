/**
 * Handbook — run the automated checks and report.
 *
 * Exits non-zero when anything fails, so this can be wired into CI or a
 * pre-commit run without a human reading the output.
 *
 * Run: node docs/handbook/tools/verify.mjs
 */
import { runChecks, summarise } from "./checks.mjs";
import { HANDBOOK_ROOT } from "./env.mjs";
import * as fs from "node:fs";
import * as path from "node:path";

const checks = runChecks();
const summary = summarise(checks);

const report = {
  checkedAt: new Date().toISOString(),
  journeys: checks.manifest.journeys.length,
  steps: checks.steps.length,
  ...summary,
  results: checks.results,
};

fs.mkdirSync(path.join(HANDBOOK_ROOT, "output"), { recursive: true });
fs.writeFileSync(
  path.join(HANDBOOK_ROOT, "output", "checks.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

for (const r of checks.results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.titleZh}`);
  for (const f of r.failures) console.log(`        - ${f}`);
}
console.log(
  `\n${summary.passed}/${summary.total} checks passed — ${report.journeys} journeys, ${report.steps} steps`,
);

if (!summary.allPass) process.exit(1);
