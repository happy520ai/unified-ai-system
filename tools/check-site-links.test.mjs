import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brokenRefs, checkDocsLinks, internalHtmlRefs } from "./check-site-links.mjs";

test("only relative page links are collected, and each once", () => {
  const refs = internalHtmlRefs([
    '<a href="one.html">a</a>',
    '<a href="two.html#section">b</a>',
    "<a href='three.html'>c</a>",
    '<a href="https://example.com/four.html">d</a>',
    '<a href="#five.html">not a file at all</a>',
    '<a href="one.html">duplicate</a>',
    '<a href="assets/notes.md">not html</a>',
  ].join("\n"));
  assert.deepEqual(refs, ["one.html", "two.html", "three.html"]);
});

test("a reference resolves against the page directory, and only misses are reported", () => {
  // Real filesystem, because the whole contract of this function is existsSync against a directory.
  const fileFor = (ref) => join(process.cwd(), "docs", ref);
  assert.deepEqual(brokenRefs(["index.html", "index.zh-CN.html"], fileFor), []);
  assert.deepEqual(brokenRefs(["index.html", "definitely-not-a-page-zzz.html"], fileFor), [
    "definitely-not-a-page-zzz.html",
  ]);
});

test("the checker fires on a planted dead link rather than only passing", () => {
  const dir = mkdtempSync(join(tmpdir(), "site-links-"));
  try {
    writeFileSync(join(dir, "index.html"), '<a href="present.html">ok</a><a href="absent.html">dead</a>');
    writeFileSync(join(dir, "present.html"), "<html></html>");
    const result = checkDocsLinks(dir);
    assert.deepEqual(result.pages, ["index.html", "present.html"]);
    assert.equal(result.rows[0].refCount, 2);
    assert.deepEqual(result.rows[0].broken, ["absent.html"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the shipped site has no dead internal page links, and the scan really looked", () => {
  const result = checkDocsLinks("docs");
  const dead = result.rows.flatMap((row) => row.broken);
  const refs = result.rows.reduce((sum, row) => sum + row.refCount, 0);
  // A passing run must not be reachable by scanning nothing: both a floor on pages and one on
  // references are asserted, because the interesting failure of a link checker is an empty input.
  assert.ok(result.pages.length >= 16, `expected the full bilingual page set, saw ${result.pages.length}`);
  assert.ok(refs > 40, `expected a substantial reference set, saw ${refs}`);
  assert.deepEqual(dead, [], "dead navigation on the project site");
});
