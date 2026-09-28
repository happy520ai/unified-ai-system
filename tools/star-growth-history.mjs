#!/usr/bin/env node
// Reconstruct the star/fork time series from the Star Growth Snapshot workflow's own run logs.
//
// Why this reads history instead of writing it: the scheduled job runs with `contents: read` and
// writes its reports to .tmp/, which does not survive the runner. So it cannot maintain a series
// by itself, and giving it commit rights to do so is a permissions change that a reporting job
// does not deserve. But every run already prints the counts into its log, and run logs persist -
// so the series exists already and only needs a reader. That also means it reaches back to the
// first run rather than to today.
//
// The second thing this checks, because it is the kind of number that gets quoted: each log line
// reads `Stars: N (D)` where D is the delta the report computed. In CI there is no previous report
// to compare against, so D is expected to be 0 regardless of what happened. This recomputes the
// delta from consecutive parsed values and reports how often the two disagree, rather than
// repeating the printed one.
//
// Usage: node tools/star-growth-history.mjs [--output FILE] [--limit N] [--offline FILE]
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const WORKFLOW_PATH = ".github/workflows/star-growth-snapshot.yml";
const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf("--" + n);
  return i >= 0 ? argv[i + 1] : null;
};
const OUT = flag("output");
const LIMIT = Number(flag("limit") || 40);
const OFFLINE = flag("offline");

function gh(args) {
  const r = spawnSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`gh api ${args[0]} failed: ${(r.stderr || "").trim().slice(0, 160)}`);
  return r.stdout;
}

// Parse the counts out of one run log. Deliberately takes the LAST match: a run prints the
// report more than once (evidence, daily, check), and they should agree - disagreement is
// reported separately rather than averaged.
export function parseRunLog(text) {
  // No ^ anchor: every log line is prefixed with an ISO timestamp, so an anchored pattern
  // matches nothing and the whole series reads as "no data" rather than "wrong pattern".
  const stars = [...text.matchAll(/- Stars: (\d+) \((-?\d+)\)/g)];
  const forks = [...text.matchAll(/- Forks: (\d+) \((-?\d+)\)/g)];
  const distinctStars = [...new Set(stars.map((m) => Number(m[1])))];
  const distinctForks = [...new Set(forks.map((m) => Number(m[1])))];
  if (!stars.length) return { parsed: false, reason: "no '- Stars:' line in any job log" };
  return {
    parsed: true,
    stars: distinctStars[distinctStars.length - 1],
    forks: distinctForks.length ? distinctForks[distinctForks.length - 1] : null,
    printed_delta_stars: Number(stars[stars.length - 1][2]),
    repeated_values_within_run: distinctStars.length,
  };
}

export function buildSeries(readings) {
  const rows = [];
  let prev = null;
  for (const r of readings) {
    if (!r.parsed) {
      rows.push({ date: r.date, run_number: r.run_number, state: "unreadable", note: r.reason });
      continue;
    }
    const delta = prev === null ? null : r.stars - prev;
    rows.push({
      date: r.date,
      run_number: r.run_number,
      state: "ok",
      stars: r.stars,
      forks: r.forks,
      recomputed_delta: delta,
      printed_delta: r.printed_delta_stars,
      delta_disagrees: delta !== null && delta !== r.printed_delta_stars,
      repeated_values_within_run: r.repeated_values_within_run,
    });
    prev = r.stars;
  }
  return rows;
}

// Everything below runs only as a CLI: the pure parser and series builder are
// imported by the test suite, and importing must not trigger API calls.
function main() {
let readings;
if (OFFLINE) {
  readings = JSON.parse(readFileSync(OFFLINE, "utf8")).readings;
} else {
  const wfList = JSON.parse(gh(["-X", "GET", "repos/happy520ai/unified-ai-system/actions/workflows", "-f", "per_page=100"]));
  const wf = wfList.workflows.find((w) => w.path === WORKFLOW_PATH);
  if (!wf) {
    console.error(`REFUSED: no workflow with path ${WORKFLOW_PATH} found among ${wfList.workflows.length} - the series has no source, which is not the same as an empty series.`);
    process.exit(2);
  }
  const runs = JSON.parse(gh(["-X", "GET", `repos/happy520ai/unified-ai-system/actions/workflows/${wf.id}/runs`, "-f", `per_page=${Math.min(LIMIT, 50)}`]));
  const ordered = runs.workflow_runs.filter((r) => r.status === "completed").sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-LIMIT);
  if (ordered.length < 2) {
    console.error(`REFUSED: only ${ordered.length} completed run(s) readable; a series needs at least two points.`);
    process.exit(3);
  }
  readings = [];
  for (const run of ordered) {
    const jobs = JSON.parse(gh([`repos/happy520ai/unified-ai-system/actions/runs/${run.id}/jobs`]));
    let found = { parsed: false, reason: "no jobs" };
    for (const job of jobs.jobs || []) {
      const log = gh([`repos/happy520ai/unified-ai-system/actions/jobs/${job.id}/logs`]).toString("utf8");
      const p = parseRunLog(log);
      if (p.parsed) {
        found = p;
        break;
      }
      found = p;
    }
    readings.push({ date: run.created_at.slice(0, 10), run_number: run.run_number, ...found });
  }
}

const rows = buildSeries(readings);
const ok = rows.filter((r) => r.state === "ok");
const problems = [];
if (ok.length < 2) problems.push(`only ${ok.length} readable points; the rest are unreadable, which is a gap in the series and not a flat line`);
for (let i = 1; i < rows.length; i++) {
  if (rows[i].date < rows[i - 1].date) problems.push(`dates out of order at ${rows[i].date}`);
}
const disagree = ok.filter((r) => r.delta_disagrees);
const repeated = ok.filter((r) => r.repeated_values_within_run > 1);

const artifact = {
  producer: "tools/star-growth-history.mjs",
  source: `run logs of ${WORKFLOW_PATH}`,
  method: "the series is read back from CI run logs, so it reaches back to the first run and needs no new write permission",
  points: ok.length,
  unreadable: rows.length - ok.length,
  first: ok.length ? ok[0] : null,
  last: ok.length ? ok[ok.length - 1] : null,
  printed_delta_disagrees_with_recomputed: disagree.length,
  runs_where_the_report_printed_the_same_count_more_than_once_with_different_values: repeated.length,
  rows,
  problems,
};
if (OUT) writeFileSync(OUT, JSON.stringify(artifact, null, 2) + "\n");

console.log(`date        run  stars  forks  recomputed  printed  disagree`);
for (const r of rows) {
  if (r.state !== "ok") {
    console.log(`${r.date}  ${String(r.run_number).padEnd(4)} -      -       -           -        UNREADABLE: ${r.note}`);
    continue;
  }
  console.log(
    `${r.date}  ${String(r.run_number).padEnd(4)} ${String(r.stars).padEnd(6)} ${String(r.forks ?? "-").padEnd(6)} ${String(r.recomputed_delta ?? "-").padStart(6)}     ${String(r.printed_delta).padEnd(7)} ${r.delta_disagrees ? "YES" : ""}`,
  );
}
if (ok.length >= 2) {
  const a = ok[0];
  const b = ok[ok.length - 1];
  console.log(`\n${a.date} -> ${b.date}: stars ${a.stars} -> ${b.stars} over ${ok.length} readings (${b.stars - a.stars}).`);
}
console.log(`Printed deltas disagree with the recomputed ones in ${disagree.length} of ${Math.max(ok.length - 1, 0)} comparable readings.`);
if (problems.length) {
  console.error("\nPROBLEMS:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(4);
}
if (OUT) console.log(`WROTE ${OUT}`);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main();
