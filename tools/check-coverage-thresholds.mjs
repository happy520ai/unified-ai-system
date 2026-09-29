// Enforces the coverage floor on the merged report produced by
// tools/run-tests-with-coverage.mjs. The thresholds live here rather than in
// vitest.config.js because the collecting runs must not evaluate them: each
// group run would otherwise fail mid-suite, before the merge has produced a
// number that means anything.
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const summaryPath = join(repoRoot, "coverage", "coverage-summary.json");

// Floors are the lower of the two platform baselines, each with about a point
// and a half of slack so a small refactor does not fail the build on noise:
//   ubuntu (CI): lines 44.78, functions 44.30, statements 42.92, branches 41.57
//   windows    : lines 47.01, functions 47.13, statements 45.09, branches 43.86
// The gap is real, not drift: the Windows-only suites run on Windows and skip
// on the Linux runner, so Linux is the floor that has to hold. The originally
// intended 50/50/50/40 target is recorded here rather than dropped: closing
// the remaining five-to-eight points is coverage work, not a threshold decision.
export const THRESHOLDS = Object.freeze({
  lines: 43,
  functions: 43,
  statements: 42,
  branches: 40,
});

const METRICS = Object.freeze(["lines", "functions", "statements", "branches"]);

export function evaluateSummary(summaryText) {
  const summary = JSON.parse(summaryText);
  const total = summary?.total;
  if (!total) {
    return { ok: false, reason: "coverage-summary.json has no total section", failures: [] };
  }
  const failures = [];
  const measured = {};
  for (const metric of METRICS) {
    const pct = total[metric]?.pct;
    if (typeof pct !== "number" || !Number.isFinite(pct)) {
      return { ok: false, reason: `coverage-summary.json total.${metric}.pct is not a number`, failures: [] };
    }
    measured[metric] = pct;
    if (pct < THRESHOLDS[metric]) {
      failures.push({ metric, measured: pct, floor: THRESHOLDS[metric] });
    }
  }
  return { ok: failures.length === 0, measured, failures };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  let text;
  try {
    text = readFileSync(summaryPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      process.stderr.write(`No coverage summary at ${summaryPath}. Run pnpm test:coverage first.\n`);
      process.exit(1);
    }
    throw error;
  }
  const verdict = evaluateSummary(text);
  for (const [metric, pct] of Object.entries(verdict.measured ?? {})) {
    process.stdout.write(`${metric.padEnd(11)} ${pct.toFixed(2).padStart(6)}%  (floor ${THRESHOLDS[metric]}%)\n`);
  }
  if (!verdict.ok) {
    for (const failure of verdict.failures) {
      process.stderr.write(
        `Coverage for ${failure.metric} (${failure.measured.toFixed(2)}%) is below the floor (${failure.floor}%).\n`,
      );
    }
    process.exit(1);
  }
  process.stdout.write("Coverage floors met.\n");
}
