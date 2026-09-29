// Guards the coverage floor tool against a summary it cannot read, a summary
// that is silently truncated, and the real arithmetic of a floor check.
import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSummary, THRESHOLDS } from "./check-coverage-thresholds.mjs";

function summary(pcts) {
  const total = {};
  for (const [metric, pct] of Object.entries(pcts)) {
    total[metric] = { total: 100, covered: Math.round(pct), pct, skipped: 0 };
  }
  return JSON.stringify({ total });
}

test("a summary at or above every floor passes and reports what it measured", () => {
  const verdict = evaluateSummary(summary({
    lines: THRESHOLDS.lines + 13,
    functions: THRESHOLDS.functions + 10,
    statements: THRESHOLDS.statements + 18,
    branches: THRESHOLDS.branches + 2,
  }));
  assert.equal(verdict.ok, true, JSON.stringify(verdict.failures));
  assert.equal(verdict.measured.lines, THRESHOLDS.lines + 13);
  assert.deepEqual(verdict.failures, []);
});

test("a summary below one floor fails and names the metric, the reading and the floor", () => {
  const belowFloor = THRESHOLDS.lines - 0.01;
  const verdict = evaluateSummary(summary({
    lines: belowFloor,
    functions: 80,
    statements: 90,
    branches: 90,
  }));
  assert.equal(verdict.ok, false);
  assert.equal(verdict.failures.length, 1);
  assert.equal(verdict.failures[0].metric, "lines");
  assert.equal(verdict.failures[0].measured, belowFloor);
  assert.equal(verdict.failures[0].floor, THRESHOLDS.lines);
});

test("the floor is inclusive: exactly at the floor passes", () => {
  const verdict = evaluateSummary(summary({
    lines: THRESHOLDS.lines,
    functions: THRESHOLDS.functions,
    statements: THRESHOLDS.statements,
    branches: THRESHOLDS.branches,
  }));
  assert.equal(verdict.ok, true);
});

test("a summary with a missing or non-numeric metric is refused, not read as zero", () => {
  const missing = evaluateSummary(JSON.stringify({ total: { lines: { pct: 90 } } }));
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /total\.functions\.pct/);

  const wrongType = evaluateSummary(JSON.stringify({
    total: { lines: { pct: "90" }, functions: { pct: 90 }, statements: { pct: 90 }, branches: { pct: 90 } },
  }));
  assert.equal(wrongType.ok, false);
  assert.match(wrongType.reason, /total\.lines\.pct/);
});

test("a summary with no total section is refused rather than passing", () => {
  const verdict = evaluateSummary(JSON.stringify({ apps: {} }));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /no total section/);
});
