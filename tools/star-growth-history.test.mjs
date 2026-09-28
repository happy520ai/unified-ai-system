import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { parseRunLog, buildSeries } = await import("./star-growth-history.mjs");
const SCRATCH = mkdtempSync(path.join(tmpdir(), "star-history-"));

// The first version of the parser anchored on "^- Stars:" and matched nothing, because every
// line in a GitHub Actions log carries an ISO timestamp prefix. That produced a confident
// "no data" reading over thirteen runs that all had the number. This fixture is the shape the
// real logs have, so the anchor bug cannot come back quietly.
const REAL_LOG_SHAPE = [
  "2026-09-28T07:58:11.8845348Z ##[group]Run node tools/star-growth-check.mjs daily",
  "2026-09-28T07:58:52.5891074Z - Stars: 7 (0)",
  "2026-09-28T07:58:52.5891750Z - Forks: 2 (0)",
  "2026-09-28T08:00:23.3465567Z - Stars: 7 (0)",
  "2026-09-28T08:00:23.4Z some unrelated line mentioning Stars: 99 (5) inline",
].join("\n");

test("a timestamped Actions log line is parsed, not reported as missing data", () => {
  const r = parseRunLog(REAL_LOG_SHAPE);
  assert.equal(r.parsed, true, r.reason);
  assert.equal(r.stars, 7);
  assert.equal(r.forks, 2);
  assert.equal(r.printed_delta_stars, 0);
});

test("an empty or unrelated log is reported unreadable rather than as zero stars", () => {
  assert.equal(parseRunLog("nothing here").parsed, false);
  assert.match(parseRunLog("nothing here").reason, /no '- Stars:' line/);
});

test("the recomputed delta catches the printed one being wrong, which is the whole reason this exists", () => {
  const rows = buildSeries([
    { date: "2026-09-01", run_number: 1, parsed: true, stars: 5, forks: 2, printed_delta_stars: 0, repeated_values_within_run: 1 },
    { date: "2026-09-02", run_number: 2, parsed: true, stars: 5, forks: 2, printed_delta_stars: 0, repeated_values_within_run: 1 },
    { date: "2026-09-03", run_number: 3, parsed: true, stars: 7, forks: 2, printed_delta_stars: 0, repeated_values_within_run: 1 },
  ]);
  assert.equal(rows[0].recomputed_delta, null, "the first point has no predecessor and must not claim a delta");
  assert.equal(rows[1].recomputed_delta, 0);
  assert.equal(rows[2].recomputed_delta, 2);
  assert.equal(rows[2].delta_disagrees, true, "printed 0 while the series moved by 2 - the CI delta compares against the same day's own file");
  assert.equal(rows[1].delta_disagrees, false, "a genuine zero must not be flagged as disagreement");
});

test("an unreadable run leaves a visible gap instead of flattening the series", () => {
  const rows = buildSeries([
    { date: "2026-09-01", run_number: 1, parsed: true, stars: 5, forks: 2, printed_delta_stars: 0, repeated_values_within_run: 1 },
    { date: "2026-09-02", run_number: 2, parsed: false, reason: "log expired" },
    { date: "2026-09-03", run_number: 3, parsed: true, stars: 6, forks: 2, printed_delta_stars: 0, repeated_values_within_run: 1 },
  ]);
  assert.equal(rows[1].state, "unreadable");
  assert.equal(rows[1].note, "log expired");
  assert.equal(rows[2].recomputed_delta, 1, "the delta spans the gap, so it must be labelled as measured across a missing reading rather than hidden");
});

test("the tool refuses rather than printing a series with fewer than two readable points", () => {
  const file = path.join(SCRATCH, "one.json");
  writeFileSync(file, JSON.stringify({ readings: [{ date: "2026-09-01", run_number: 1, parsed: true, stars: 5, forks: 2, printed_delta_stars: 0, repeated_values_within_run: 1 }] }));
  const r = spawnSync(process.execPath, [path.join(HERE, "star-growth-history.mjs"), "--offline", file], { encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stderr, /only 1 readable points|readable points/);
});
