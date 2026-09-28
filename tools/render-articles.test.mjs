// The classification is the part that caused the damage, so it is the part with the fixture.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { MARKER, selectGenerated } from "./render-articles.mjs";

const marked = "<!doctype html>\n<!-- " + MARKER + " from docs/x.md -->\n<html></html>";
const handWritten = "<!doctype html>\n<html>\n  <head><title>Prompt enhancement</title></head>\n</html>\n";

test("a page carrying the generator marker is regenerated", () => {
  const { generated, handAuthored } = selectGenerated(["x.html"], () => marked);
  assert.deepEqual(generated, ["x.html"]);
  assert.deepEqual(handAuthored, []);
});

test("a page without the marker is never touched, whatever else is true about it", () => {
  // This is the rule that would have saved 319 lines of docs/prompt-enhancement.html:
  // it is declared in the sitemap and has a same-stem .md, so the old definition claimed it.
  const { generated, handAuthored } = selectGenerated(["prompt-enhancement.html"], () => handWritten);
  assert.deepEqual(generated, []);
  assert.deepEqual(handAuthored, ["prompt-enhancement.html"]);
});

test("boundary: a marker past the first 400 characters is not treated as a claim of ownership", () => {
  const buried = "<!doctype html>\n" + "x".repeat(500) + "\n<!-- " + MARKER + " -->";
  const { generated, handAuthored } = selectGenerated(["y.html"], () => buried);
  assert.deepEqual(generated, []);
  assert.equal(handAuthored.length, 1);
});

test("the real repository classifies as the incident said it must", () => {
  const sitemap = readFileSync("docs/sitemap.xml", "utf8");
  const names = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].split("/").pop())
    .filter((n) => n.endsWith(".html") && existsSync("docs/" + n.replace(/\.html$/, ".md")));
  const { generated, handAuthored } = selectGenerated(names, (n) => readFileSync("docs/" + n, "utf8"));
  assert.ok(names.length >= 7, "expected at least the six articles plus prompt-enhancement, got " + names.length);
  assert.ok(handAuthored.includes("prompt-enhancement.html"), "the hand-authored page must be classified as not ours to overwrite");
  assert.ok(!generated.includes("prompt-enhancement.html"), "it must never be in the regeneration set");
  assert.equal(generated.length + handAuthored.length, names.length, "classification must account for every page");
  assert.ok(generated.length >= 6, "expected the six measurement articles to be marked generated, got " + generated.length);
});
