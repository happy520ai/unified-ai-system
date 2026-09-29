// The Chinese hub index must be unable to carry its own numbers: every figure is read from the dataset,
// and the generator has to refuse rather than print a count that does not describe the sample.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const RENDERER = "tools/render-mcp-hub-zh.mjs";

const block = (over = {}) => ({
  id: "tools-list-pagination",
  asked_with: "2025-06-18",
  row_label_field: "verdict",
  attempted: 3,
  verdicts: { single_page: 2, auth_required: 1 },
  rows: [
    { name: "a", url: "https://a/mcp", verdict: "single_page" },
    { name: "b", url: "https://b/mcp", verdict: "single_page" },
    { name: "c", url: "https://c/mcp", verdict: "auth_required" },
  ],
  ...over,
});

const dataset = (questions) => ({
  generated_at_start_utc: "2026-09-28T00:00:00.000Z",
  questions,
});

function run(doc) {
  const dir = mkdtempSync(join(tmpdir(), "uai-zh-hub-"));
  const inPath = join(dir, "dataset.json");
  const outPath = join(dir, "out.html");
  writeFileSync(inPath, JSON.stringify(doc));
  const r = spawnSync(process.execPath, [RENDERER, "--dataset", inPath, "--out", outPath], { encoding: "utf8" });
  return { r, outPath };
}

test("the page is built from the artifact: its counts come from the dataset rows", () => {
  const { r, outPath } = run(dataset([
    block(),
    block({ id: "session-enforcement", verdicts: { enforced: 2, auth_required: 1 }, rows: [
      { name: "x", url: "https://x/mcp", verdict: "enforced" },
      { name: "y", url: "https://y/mcp", verdict: "enforced" },
      { name: "z", url: "https://z/mcp", verdict: "auth_required" },
    ] }),
  ]));
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const page = readFileSync(outPath, "utf8");
  assert.equal((page.match(/<tr>/g) || []).length, 3, "header + one row per question");
  assert.match(page, /enforced = 2，另有 auth_required = 1（共 3）/);
  assert.match(page, /<code>2025-06-18<\/code>/);
  assert.match(page, /运行窗口 2026-09-28/);
});

test("a question that cannot say which revision it asked with is refused, and no page is written", () => {
  const bad = block();
  delete bad.asked_with;
  const { r, outPath } = run(dataset([bad]));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /asked_with missing/);
  assert.equal(existsSync(outPath), false, "a refused render must not leave a page behind");
});

test("stored verdicts that disagree with the rows are refused, so a wrong tally cannot be printed as fact", () => {
  const bad = block({ verdicts: { single_page: 9, auth_required: 1 } });
  const { r, outPath } = run(dataset([bad]));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /disagree with rows on single_page/);
  assert.equal(existsSync(outPath), false);
});

test("an empty sample is refused instead of rendering a page that reports zero servers", () => {
  const { r, outPath } = run(dataset([block({ rows: [], verdicts: {}, attempted: 0 })]));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /no rows/);
  assert.equal(existsSync(outPath), false);
});

test("a question asked at two protocol revisions counts as one question and two legs", () => {
  // The dataset holds ten blocks for nine questions because the cache-hint question was asked
  // once per revision. Counting blocks as questions made the Chinese index say "10 个问题" while
  // the English page said nine measurements about the same artifact - both pages read as correct
  // to whoever wrote them, and the reader is the one left choosing.
  const { r, outPath } = run(
    dataset([
      block(),
      block({ id: "cache-hints-legacy-leg" }),
      block({ id: "cache-hints-modern-leg" }),
    ]),
  );
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const page = readFileSync(outPath, "utf8");
  assert.match(page, /2 个问题、3 次测量/, "the page must separate questions from measurement legs");
  assert.ok(!/3 个问题/.test(page), "three blocks are not three questions");
});

test("the generated page carries a CollectionPage whose members are the articles it links", () => {
  const { r, outPath } = run(dataset([
    block(),
    block({ id: "session-enforcement", verdicts: { enforced: 2, auth_required: 1 }, rows: [
      { name: "x", url: "https://x/mcp", verdict: "enforced" },
      { name: "y", url: "https://y/mcp", verdict: "enforced" },
      { name: "z", url: "https://z/mcp", verdict: "auth_required" },
    ] }),
  ]));
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const page = readFileSync(outPath, "utf8");
  const raw = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(raw, "no structured data block was emitted");
  const object = JSON.parse(raw[1]);
  assert.equal(object["@type"], "CollectionPage");
  assert.equal(object.inLanguage, "zh-CN");
  assert.equal(object.mainEntity["@type"], "ItemList");
  assert.equal(object.mainEntity.numberOfItems, 2, "both fixture questions resolve to real article pages");
  assert.deepEqual(object.mainEntity.itemListElement.map((e) => e.position), [1, 2]);
  assert.ok(object.mainEntity.itemListElement.every((e) => e.url.endsWith(".html")), JSON.stringify(object.mainEntity));
  // Boundary target, and the reason this arm is worth its lines: the render went to a scratch path with no
  // history, so git cannot date it. A generator that published today's date here would be inventing a
  // freshness signal for a page nobody committed.
  assert.equal(object.datePublished, undefined, "a page outside git history must not publish a publication date");
  assert.equal(object.dateModified, undefined, "a page outside git history must not publish a modification date");
  assert.equal(object.description, page.match(/<meta name="description" content="([^"]*)"/)[1], "head and structured data must not tell two stories");
});

test("the shipped Chinese hub publishes git dates in full UTC", () => {
  const html = readFileSync("docs/mcp-ecosystem-measurements.zh-CN.html", "utf8");
  const object = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  assert.match(object.datePublished, UTC, "datePublished must be full UTC, not a date or a midnight offset");
  assert.match(object.dateModified, UTC, "dateModified must be full UTC");
  assert.ok(Date.parse(object.datePublished) <= Date.parse(object.dateModified), "published cannot follow modified");
  // Membership, not equality with "the newest commit". An equality pin here would be a timer: the commit that
  // refreshes this page's dates is itself newer than the date it writes, so the next push would have gone red
  // for doing the right thing. What must be impossible is a typed instant that no commit produced.
  const instants = (p) => {
    const out = spawnSync("git", ["log", "--format=%cI", "--", p], { encoding: "utf8" }).stdout;
    return out.split(String.fromCharCode(10)).map((l) => Date.parse(l.trim())).filter(Number.isFinite);
  };
  const page = instants("docs/mcp-ecosystem-measurements.zh-CN.html");
  const dataset = instants("docs/data/mcp-ecosystem-measurements.2026-09-28.json");
  assert.ok(page.length > 0 && dataset.length > 0, "no commit history for the page or the dataset");
  const produced = new Set([...page, ...dataset]);
  assert.ok(produced.has(Date.parse(object.datePublished)), "datePublished " + object.datePublished + " is not an instant any commit produced");
  assert.ok(produced.has(Date.parse(object.dateModified)), "dateModified " + object.dateModified + " is not an instant any commit produced");
  assert.ok(page.includes(Date.parse(object.dateModified)) || dataset.includes(Date.parse(object.dateModified)), "dateModified must come from the page or its dataset, not elsewhere");
});
