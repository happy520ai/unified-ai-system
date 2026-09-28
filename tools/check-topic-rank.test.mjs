import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, "check-topic-rank.mjs");
const ROOT = path.join(HERE, "..");
const SCRATCH = mkdtempSync(path.join(tmpdir(), "topic-rank-"));

// Every test runs with --offline against a fixture, because a CI test that calls the
// GitHub search API would fail on rate limits rather than on logic.
function runOffline(artifact) {
  const file = path.join(SCRATCH, "snapshot.json");
  writeFileSync(file, JSON.stringify(artifact, null, 2));
  return spawnSync(process.execPath, [TOOL, "--offline", file], { encoding: "utf8", cwd: ROOT, timeout: 60000 });
}

function snapshot({ topics = ["alpha", "beta", "gamma", "delta"], items = {} }) {
  return {
    repo: { stargazers_count: 8, topics },
    searches: topics.map((t) => ({ topic: t, total: items[t]?.total ?? 0, items: items[t]?.rows ?? [] })),
  };
}

const ROW = (name, stars) => ({ full_name: name, stars });

test("the four states are distinguished, because two of them need opposite actions", () => {
  const snap = snapshot({
    topics: ["ranked_topic", "below_topic", "untagged_topic", "small_topic"],
    items: {
      ranked_topic: { total: 500, rows: [ROW("other/one", 900), ROW("happy520ai/unified-ai-system", 8)] },
      below_topic: { total: 500, rows: Array.from({ length: 100 }, (_, i) => ROW(`other/o${i}`, 900 - i)) },
      untagged_topic: { total: 40, rows: Array.from({ length: 40 }, (_, i) => ROW(`other/u${i}`, 500 - i)) },
      small_topic: { total: 12, rows: Array.from({ length: 12 }, (_, i) => ROW(`other/s${i}`, 300 - i)) },
    },
  });
  snap.repo.topics = ["ranked_topic", "below_topic", "small_topic"];
  const r = runOffline(snap);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ranked_topic\s+ranked\s+500\s+2/);
  assert.match(r.stdout, /below_topic\s+below_page\s+500/);
  assert.match(r.stdout, /small_topic\s+tagged_but_invisible\s+12/);
  assert.match(r.stdout, /In the snapshot but not in our topic list: untagged_topic/, "an absent topic must be reported as not tagged, not as a ranking problem");
});

test("thresholds come from the normalised row shape, not a field that no longer exists", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ROW(`other/o${i}`, 1000 - i * 10));
  const r = runOffline(snapshot({ topics: ["big"], items: { big: { total: 900, rows } } }));
  assert.equal(r.status, 0, r.stderr);
  // 1000 - 29*10 = 710 at rank 30 and 1000 - 49*10 = 510 at rank 50. The topic is in our
  // own list, so the state is below_page (tagged, deeper than the rows fetched), not not_tagged.
  assert.match(r.stdout, /big\s+below_page\s+900\s+-\s+710\s+510/);
});

test("a changed item shape fails loudly instead of printing nulls beside a real rank", () => {
  const broken = {
    repo: { stargazers_count: 8, topics: ["big"] },
    searches: [{ topic: "big", total: 900, items: Array.from({ length: 60 }, (_, i) => ({ full_name: `other/o${i}`, stargazers_count: 1000 - i })) }],
  };
  const r = runOffline(broken);
  assert.equal(r.status, 1, `expected a thrown guard, got ${r.status}: ${r.stdout}`);
  assert.match(r.stderr, /non-numeric "stars" field/);
});

test("the tool re-reads its own artifact, so a measurement can be reviewed without the network", () => {
  const out = path.join(SCRATCH, "artifact.json");
  const rows = Array.from({ length: 60 }, (_, i) => ROW(`other/o${i}`, 1000 - i * 10));
  const snap = snapshot({ topics: ["big"], items: { big: { total: 900, rows } } });
  const file = path.join(SCRATCH, "s1.json");
  writeFileSync(file, JSON.stringify(snap));
  const first = spawnSync(process.execPath, [TOOL, "--offline", file, "--output", out], { encoding: "utf8", cwd: ROOT, timeout: 60000 });
  assert.equal(first.status, 0, first.stderr);
  const again = spawnSync(process.execPath, [TOOL, "--offline", out], { encoding: "utf8", cwd: ROOT, timeout: 60000 });
  assert.equal(again.status, 0, again.stderr);
  const NL = String.fromCharCode(10);
  const strip = (s) => s.split(NL + "WROTE ")[0];
  assert.equal(strip(again.stdout), strip(first.stdout), "replaying the artifact must reproduce the table");
  const j = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(j.rows[0].topic, "big");
  assert.equal(j.rows[0].stars_for_rank_30, 710);
});

test("a zero-topic repository is refused rather than reported as an empty ranking", () => {
  const r = runOffline({ repo: { stargazers_count: 8, topics: [] }, searches: [] });
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stderr, /no topic rows produced|REFUSED/, "an empty measurement must not look like a clean run");
});
