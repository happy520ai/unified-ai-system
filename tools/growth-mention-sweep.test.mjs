import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { classifyFile, groupOfFiles, groupRows, monitoredRepos, needsNextPage, searchOnce, tally, walk, GROUPS } from "./growth-mention-sweep.mjs";

// Paths below are the literal shapes GitHub code search returned for us on 2026-09-29, not invented
// examples: the point of the classifier is that it sorts the real corpus, so the fixtures are the real
// corpus. Each expectation is a group a human agreed to by hand the same day.
const REAL = [
  ["README.md", "CANDIDATE_CATALOGUE"],
  ["docs/index.md", "CANDIDATE_CATALOGUE"],
  ["docs/VSCODE_GALLERY_R2.md", "CANDIDATE_CATALOGUE"],
  ["index.html", "CANDIDATE_CATALOGUE"],
  ["awesome-agents.json", "AGGREGATOR"],
  ["packages/aggregators/unified-ai-system.json", "AGGREGATOR"],
  ["_data/projects/unified-ai-system.yml", "AGGREGATOR"],
  ["data/projects/unified-ai-system.zh.md", "AGGREGATOR"],
  ["skills/unified-ai-gateway/SKILL.md", "REDISTRIBUTION"],
  [".agent/skills/unified-ai-gateway/SKILL.md", "REDISTRIBUTION"],
  ["mirrors/repos/sickn33@agentic-awesome-skills/skills/unified-ai-gateway/SKILL.md", "REDISTRIBUTION"],
  ["r/happy520ai/unified-ai-system/index.html", "MIRROR"],
  ["docs/repo/happy520ai/unified-ai-system/index.html", "MIRROR"],
  ["daily-digests/2026-08-10/unified-ai-system.md", "PERSONAL"],
  ["inbox/ai-radar/2026-09-26.md", "PERSONAL"],
  ["agency/personas/ai/ai-ai-gateway-operator.md", "PERSONAL"],
];

test("every real mentioning-file shape from the 2026-09-29 sweep lands in the group a human picked", () => {
  for (const [path, group] of REAL) {
    assert.equal(classifyFile(path), group, "misclassified " + path);
  }
});

test("an unknown path is not quietly counted as a listing", () => {
  assert.equal(classifyFile("notes/thoughts.txt"), "PERSONAL");
  assert.ok(GROUPS.includes(classifyFile("whatever/deep/nested/file.bin")));
});

test("a repository is grouped by its most informative file, not by whichever came back first", () => {
  assert.equal(groupOfFiles(["README.md", "skills/unified-ai-gateway/SKILL.md"]), "REDISTRIBUTION");
  assert.equal(groupOfFiles(["data/index/repos/61.json", "data/index/lists/x.json"]), "AGGREGATOR");
  assert.equal(groupOfFiles(["r/happy520ai/unified-ai-system/index.html", "data/x.json"]), "MIRROR");
});

test("monitored means the carrier table says so, so the two lists cannot drift apart", async () => {
  const { CARRIERS } = await import(pathToFileURL(resolve(import.meta.dirname, "check-carrier-presence.mjs")).href);
  const monitored = monitoredRepos(CARRIERS);
  for (const carrier of CARRIERS.slice(0, 4)) {
    assert.ok(monitored.has(carrier.repo), carrier.repo + " must read as monitored while it is in CARRIERS");
  }
  const rows = groupRows(CARRIERS.slice(0, 4).map((c) => ({ repository: { full_name: c.repo }, path: "README.md" })), { monitored });
  assert.deepEqual([...new Set(rows.map((r) => r.group))], ["MONITORED"], "a carrier that is also a catalogue must not be reported as a new candidate");
});

test("our own repository is excluded from the population it is meant to describe", () => {
  const rows = groupRows([{ repository: { full_name: "happy520ai/unified-ai-system" }, path: "README.md" }], { monitored: new Set() });
  assert.equal(rows[0].group, "SELF");
});

test("a row without a repository name is skipped rather than inventing a bucket", () => {
  const rows = groupRows([{ path: "README.md" }, { repository: {}, path: "README.md" },
    { repository: { full_name: "someone/list" }, path: "README.md" }], { monitored: new Set() });
  assert.equal(rows.length, 1, JSON.stringify(rows));
  assert.equal(rows[0].repo, "someone/list");
});

test("truncation is judged against total_count, not against a page coming back full", () => {
  // The real reading that made this a rule: page 1 returned 99 rows while the API said 303 exist. A
  // "stop when short" rule reports a third of the population as the whole of it.
  assert.equal(needsNextPage({ collected: 99, totalCount: 303, page: 1 }), true, "99 of 303 is not a finished walk");
  assert.equal(needsNextPage({ collected: 303, totalCount: 303, page: 3 }), false, "collected the whole population");
  assert.equal(needsNextPage({ collected: 100, totalCount: 100, page: 1 }), false);
  assert.equal(needsNextPage({ collected: 600, totalCount: 1200, page: 6, pagesMax: 6 }), false, "the ceiling stops the loop and the report says truncated");
  assert.equal(needsNextPage({ collected: 600, totalCount: 1200, page: 6, pagesMax: 10 }), true, "and the same reading continues while pages remain - the default ceiling is not a fact about the API");
  assert.equal(needsNextPage({ collected: 100, totalCount: null, page: 1 }), true, "with no total advertised, a full page is the only hint there is more");
  assert.equal(needsNextPage({ collected: 41, totalCount: null, page: 1 }), false);
});

test("no search identity is a different answer from no mentions", () => {
  const r = searchOnce({ gh: "gh-that-is-not-installed-here", page: 1 });
  assert.equal(r.ok, false, "a missing binary must be reported as a failed leg");
  assert.ok(String(r.why).length > 0, "and must say why");
});

test("the buckets are exhaustive and mutually exclusive", () => {
  const rows = REAL.map(([path], i) => ({ repo: "someone/list-" + i, group: classifyFile(path), files: 1, paths: [path] }));
  const t = tally(rows);
  assert.equal(Object.values(t).reduce((a, b) => a + b, 0), rows.length, "a sum that hides a row in no bucket is the bug this guard exists for");
  for (const g of GROUPS) assert.equal(typeof t[g], "number", "every declared group must be counted, including the empty ones");
});

// walk() takes its page source as an argument precisely so these three shapes can be shown rather than
// described: a population the API finished, a walk we cut short at the ceiling, and a leg that never got an
// answer. All three print differently and only the middle one is something the operator can fix.
const nItems = (n, prefix) => Array.from({ length: n }, (_, i) => ({ repo: prefix + "-" + i, path: "README.md" }));

test("the API running dry is reported as exhausted, not as our truncation", () => {
  const pages = [{ ok: true, total_count: 5, items: nItems(2, "someone/a") },
    { ok: true, total_count: 5, items: nItems(2, "someone/b") },
    { ok: true, total_count: 5, items: nItems(1, "someone/c") }];
  const r = walk({ fetchPage: ({ page }) => pages[page - 1], pagesMax: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.items.length, 5, "every advertised row was collected");
  assert.equal(r.exhausted, true);
  assert.equal(r.truncated, false);
});

test("hitting our own ceiling says so instead of reporting a subset as the population", () => {
  const r = walk({ fetchPage: () => ({ ok: true, total_count: 1000, items: nItems(100, "someone/x") }), pagesMax: 2 });
  assert.equal(r.items.length, 200);
  assert.equal(r.exhausted, false);
  assert.equal(r.truncated, true, "200 of 1000 must be labelled a subset");
});

test("a leg that never answered is not a reading of zero mentions", () => {
  const r = walk({ fetchPage: () => ({ ok: false, why: "gh api: Must have admin rights" }), pagesMax: 4 });
  assert.equal(r.ok, false);
  assert.match(r.why, /admin rights/);
  assert.equal(r.items.length, 0, "and nothing is claimed about the population");
});
