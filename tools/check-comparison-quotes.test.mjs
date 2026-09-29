import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePage, parseLicenceClaims, foldQuote, lineMatches, profileTarget } from "./check-comparison-quotes.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/check-comparison-quotes.mjs";
const PAGES = ["docs/self-hosted-ai-gateways-compared.html", "docs/self-hosted-ai-gateways-compared.zh-CN.html"];

// Offline by design: the live re-read belongs to the nightly step, and a test that needs the network is a test
// that gets skipped the first time a third-party host has a bad afternoon. What is checked here is whether the
// guard can see everything the page contains, which is a property of the page and the parser alone.
test("the in-tool selftest passes and is wired, so it cannot rot unwired", () => {
  const r = spawnSync(process.execPath, [GEN, "--selftest"], { cwd: ROOT, encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /QUOTES_SELFTEST_OK/u);
  const list = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).scripts["test:verification-tools"];
  assert.match(list, /check-comparison-quotes\.test\.mjs/u, "this file must be in the CI test list");
});

test("every quotation and licence claim on the shipped pages is visible to the guard", () => {
  for (const page of PAGES) {
    const html = readFileSync(resolve(ROOT, page), "utf8");
    const declared = (html.match(/<blockquote[^>]*class="[^"]*quote[^"]*"/gu) || []).length;
    const parsed = parsePage(html);
    assert.equal(parsed.length, declared, page + ": parser found " + parsed.length + " of " + declared + " quotations");
    assert.ok(declared >= 4, page + ": the comparison page is expected to carry at least four quotations, found " + declared);
    for (const block of parsed) {
      assert.ok(block.lines.length > 0, page + ": a blockquote parsed with no lines, so nothing would be checked");
      assert.ok(block.url || /description|描述/u.test(block.citation),
        page + ": a quotation with neither a file URL nor a stated source: " + block.citation.slice(0, 60));
    }
    const licences = parseLicenceClaims(html);
    assert.ok(licences.length >= 2, page + ": only " + licences.length + " licence claims were read out of the section");
    for (const claim of licences) {
      assert.ok(claim.url, page + ": a licence claim with no LICENSE link: " + claim.text.slice(0, 70));
      assert.ok(claim.expects.length > 0, page + ": a licence claim that names no terms: " + claim.text.slice(0, 70));
    }
  }
});

test("the matchers accept typography and refuse words, in both directions", () => {
  const file = "- [**Smart caching**](https://example.test/gh-48): Cache responses from LLMs to reduce costs";
  assert.equal(lineMatches(file, "Smart caching: Cache responses from LLMs to reduce costs").ok, true);
  assert.equal(lineMatches(file, "Smart caching: Cache responses from LLMs to reduce latency").ok, false);
  assert.equal(foldQuote("A — B").trim(), foldQuote("A - B").trim(), "an em dash is the source's typography, not a word");
  assert.equal(profileTarget("https://github.com/o/r")?.repo, "r");
  assert.equal(profileTarget("https://github.com/o/r/blob/main/LICENSE"), null, "a file citation must not be read as a profile");
});
