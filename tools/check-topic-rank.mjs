#!/usr/bin/env node
// Measure where this repository actually stands on each GitHub topic page, and what star
// count would move it.
//
// Why: topic pages are ordered by stars and are browsed by people looking for a category, so
// unlike a launch post they keep working without being re-earned. The useful question is not
// "do we have topics" but "on which page could a stranger find us, and how many stars from
// that is page one".
//
// The distinction this exists to get right: "not in the first 100" means two different things
// depending on how big the topic is. If the topic holds 476 repos and we are absent from the
// first 100, we are tagged and ranked deeper. If the topic holds 30 repos and we are absent,
// we are not tagged at all. Collapsing those into one label would let a missing topic read as
// a ranking problem - the opposite action.
//
// Usage: node tools/check-topic-rank.mjs [--repo owner/name] [--output FILE] [--offline FILE]
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : null;
};
const REPO = flag("repo") || "happy520ai/unified-ai-system";
const OUT = flag("output");
const OFFLINE = flag("offline");
const PAGE = 100;

function ghJson(args) {
  const r = spawnSync("gh", ["api", ...args], { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
  if (r.error) throw new Error(`gh api could not run: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`gh api ${args.join(" ")} failed (exit ${r.status}): ${(r.stderr || r.stdout || "").trim().slice(0, 200)}`);
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Error(`gh api ${args[0]} returned non-JSON output: ${r.stdout.slice(0, 120)}`);
  }
}

function classify({ topic, ourTopics, total, items }) {
  const idx = items.findIndex((r) => r.full_name === REPO);
  if (idx >= 0) return "ranked";
  if (!ourTopics.has(topic)) return "not_tagged";
  if (total <= items.length) return "tagged_but_invisible";
  return "below_page";
}

function buildRows(repoTopics, searches) {
  const ourTopics = new Set(repoTopics);
  return searches.map(({ topic, total, items }) => {
    const stars = items.map((r) => r.stars);
    const idx = items.findIndex((r) => r.full_name === REPO);
    // The normalised row shape is { full_name, stars }. Reading stargazers_count here gives
    // undefined for every entry while stars.length stays 100, so the thresholds would be null
    // next to a rank that still printed correctly. Fail loudly instead.
    const nonNumeric = stars.filter((x) => !Number.isFinite(x)).length;
    if (items.length > 0 && nonNumeric === items.length) {
      throw new Error(`REFUSED: every fetched row for ${topic} has a non-numeric "stars" field - the item shape changed`);
    }
    return {
      topic,
      state: classify({ topic, ourTopics, total, items }),
      total_in_topic: total,
      fetched: items.length,
      rank: idx >= 0 ? idx + 1 : null,
      stars_for_rank_30: stars.length >= 30 ? stars[29] : null,
      stars_for_rank_50: stars.length >= 50 ? stars[49] : null,
    };
  });
}

let stars;
let repoTopics;
let searches;
let presetRows = null;
if (OFFLINE) {
  const snap = JSON.parse(readFileSync(OFFLINE, "utf8"));
  // Accept this tool's own artifact, so a measurement can be re-read and re-printed
  // without a network round-trip - and so the test suite can assert on a fixture.
  if (Array.isArray(snap.rows)) {
    stars = snap.our_stars;
    repoTopics = snap.rows.map((r) => r.topic);
    presetRows = snap.rows;
  } else {
    stars = snap.repo.stargazers_count;
    repoTopics = snap.repo.topics || [];
    searches = snap.searches;
  }
} else {
  const meta = ghJson(["repos/" + REPO]);
  stars = meta.stargazers_count;
  repoTopics = meta.topics || [];
  if (repoTopics.length === 0) {
    console.error("REFUSED: the repository reports zero topics, so there is nothing to rank. That is a metadata question, not a measurement.");
    process.exit(2);
  }
  searches = [];
  for (const t of repoTopics) {
    const res = ghJson(["-X", "GET", "search/repositories", "-f", `q=topic:${t}`, "-f", `per_page=${PAGE}`]);
    if (!Array.isArray(res.items)) {
      console.error(`REFUSED: search for topic:${t} returned no items array (keys: ${Object.keys(res).join(", ")}). Absence would be indistinguishable from a broken call.`);
      process.exit(3);
    }
    searches.push({ topic: t, total: res.total_count, items: res.items.map((r) => ({ full_name: r.full_name, stars: r.stargazers_count })) });
    await new Promise((r) => setTimeout(r, 1200));
  }
}

const rows = presetRows ?? buildRows(repoTopics, searches);
const problems = [];
for (const r of rows) {
  if (r.state === "tagged_but_invisible" && r.fetched >= PAGE) {
    problems.push(`${r.topic}: fetched ${r.fetched} of ${r.total_in_topic} and we are absent - the topic is at or over the page size, so re-check the ordering assumption rather than trusting the label`);
  }
}
if (!rows.length) problems.push("no topic rows produced");

const artifact = {
  producer: "tools/check-topic-rank.mjs",
  repo: REPO,
  measured_at: OFFLINE ? "from --offline snapshot" : new Date().toISOString(),
  our_stars: stars,
  topic_slots_used: new Set(repoTopics).size,
  topic_slots_max: 20,
  method: `search/repositories?q=topic:<t>&per_page=${PAGE}, in GitHub's own ordering`,
  states: "ranked | below_page (tagged, deeper than the page fetched) | not_tagged (absent from our metadata) | tagged_but_invisible (topic smaller than the fetch and we are not in it)",
  rows,
  problems,
};
if (OUT) writeFileSync(OUT, JSON.stringify(artifact, null, 2) + "\n");

console.log(`${artifact.repo} - ${artifact.our_stars} stars, ${artifact.topic_slots_used}/${artifact.topic_slots_max} topic slots used\n`);
console.log("topic                      state                  total  rank  stars@30  stars@50");
for (const r of [...rows].sort((a, b) => a.total_in_topic - b.total_in_topic)) {
  console.log(
    `${r.topic.padEnd(26)} ${r.state.padEnd(22)} ${String(r.total_in_topic).padStart(5)}  ${String(r.rank ?? "-").padStart(4)}  ${String(r.stars_for_rank_30 ?? "-").padStart(8)}  ${String(r.stars_for_rank_50 ?? "-").padStart(8)}`,
  );
}
// A topic we are tagged on but ranked deeper than the fetched page still has valid
// thresholds, so excluding it here would understate what is reachable.
const winnable = rows.filter((r) => r.state !== "not_tagged" && Number.isFinite(r.stars_for_rank_30) && r.stars_for_rank_30 <= 100).sort((x, y) => x.stars_for_rank_30 - y.stars_for_rank_30);
console.log(`\nPage one within reach (rank-30 needs <=100 stars): ${winnable.map((r) => `${r.topic}(${r.stars_for_rank_30})`).join(", ") || "none"}`);
const notTagged = rows.filter((r) => r.state === "not_tagged").map((r) => r.topic);
if (notTagged.length) console.log(`In the snapshot but not in our topic list: ${notTagged.join(", ")}`);
if (problems.length) {
  console.error("\nPROBLEMS:\n" + problems.map((p) => "  - " + p).join("\n"));
  process.exit(4);
}
if (OUT) console.log(`\nWROTE ${OUT}`);
