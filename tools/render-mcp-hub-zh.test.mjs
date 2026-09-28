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
