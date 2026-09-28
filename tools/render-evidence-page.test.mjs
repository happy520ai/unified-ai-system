// The evidence-page renderer must be regenerable, must refuse a source it cannot
// represent, and must not let a document inject markup.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const RENDERER = "tools/render-evidence-page.mjs";

const full = [
  "# Does anyone paginate the tool list?",
  "",
  "We asked `tools/list` twice and got one page back. See [the survey](https://example.com/s).",
  "",
  "## Method",
  "",
  "- first finding with `inline code`",
  "- second finding",
  "",
  "1. step one",
  "2. step two",
  "",
  "## Table",
  "",
  "| server | pages |",
  "| --- | ---: |",
  "| a | 1 |",
  "| b | 2 |",
  "",
  "```bash",
  "node tools/survey.mjs 40",
  "```",
  "",
  "### A deeper heading",
  "",
  "Ending **bold** and *italic* text.",
  "",
].join("\n");

const run = (md, slug = "page") => {
  const dir = mkdtempSync(join(tmpdir(), "uai-evidence-"));
  const inPath = join(dir, slug + ".md");
  const outPath = join(dir, slug + ".html");
  writeFileSync(inPath, md);
  const r = spawnSync(process.execPath, [RENDERER, "--in", inPath, "--out", outPath], { encoding: "utf8" });
  return { r, outPath, dir };
};

test("every construct the corpus uses comes out as an element", () => {
  const { r, outPath } = run(full);
  assert.equal(r.status, 0, r.stderr.slice(0, 400));
  const html = readFileSync(outPath, "utf8");
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<h1>Does anyone paginate the tool list\?<\/h1>/);
  assert.equal((html.match(/<h2>/g) || []).length, 2);
  assert.equal((html.match(/<h3>/g) || []).length, 1);
  assert.equal((html.match(/<pre/g) || []).length, 1);
  assert.match(html, /<pre class="language-bash"><code>node tools\/survey\.mjs 40/);
  assert.equal((html.match(/<li>/g) || []).length, 4, "two ul items and two ol items");
  assert.match(html, /<ul><li>first finding/);
  assert.match(html, /<ol><li>step one/);
  assert.equal((html.match(/<th>/g) || []).length, 2);
  assert.equal((html.match(/<td>/g) || []).length, 4);
  assert.ok(!/\|\s*server\s*\|/.test(html.split("<main")[1]), "no raw table row survives");
  assert.equal((html.match(/<code>/g) || []).length - (html.match(/<pre[^>]*><code>/g) || []).length, 2);
  assert.match(html, /<a href="https:\/\/example\.com\/s">the survey<\/a>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

test("the shell carries the identity a search result needs", () => {
  const { outPath } = run(full);
  const html = readFileSync(outPath, "utf8");
  assert.match(html, /<title>Does anyone paginate the tool list\? \| Unified AI System<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]{40,}"/);
  assert.match(html, /<meta property="og:title"/);
  assert.match(html, /<meta property="og:url" content="[^"]*page\.html"/);
  assert.match(html, /rel="canonical" href="https:\/\/happy520ai\.github\.io\/unified-ai-system\/page\.html"/);
});

test("the meta description carries the finding, not the provenance line", () => {
  // The provenance line is deliberately longer than the length filter, so this can only
  // pass by matching the provenance rule itself - a short line would have been dropped by
  // the size filter and proved nothing.
  const md = [
    "# Does anyone paginate the tool list?",
    "",
    "**Run:** 2026-09-27 15:11 UTC · **Sample:** 40 servers · **Servers that answered:** 16 · **Servers that paginated:** 0",
    "",
    "A gateway has to decide how long to keep a cached tool list, and this asks the servers themselves what they say about it.",
    "",
  ].join("\n");
  const { outPath } = run(md);
  const html = readFileSync(outPath, "utf8");
  const description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  const provenanceLength = md.split("\n")[2].replace(/\*/g, "").trim().length;
  assert.ok(provenanceLength >= 80, "fixture provenance line is too short to test the rule: " + provenanceLength);
  assert.ok(!/^(Run:|Sample|Servers that)/.test(description), "description is still provenance: " + description.slice(0, 48));
  assert.match(description, /cached tool list/);
  assert.ok(description.length >= 80 && description.length <= 160, "bad snippet length: " + description.length);
});

test("a document whose only text is provenance still gets a description", () => {
  const md = "# Short title\n\n**Run:** yesterday · **Sample:** 3 servers\n";
  const { outPath } = run(md);
  const html = readFileSync(outPath, "utf8");
  const description = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  assert.ok(description.length > 0, "empty description shipped");
});

test("a document cannot inject markup", () => {
  const { outPath } = run("# Title\n\n<script>alert(1)</script> and <img src=x onerror=boom>\n");
  const html = readFileSync(outPath, "utf8");
  assert.ok(!/<script>/i.test(html), "a literal script element must never reach the page");
  assert.ok(!/<img src=x/i.test(html), "a raw img tag must not be emitted");
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("it refuses a source it cannot represent rather than publishing a short page", () => {
  for (const [label, md] of [
    ["no h1", "## only a section\n\ntext\n"],
    ["two h1", "# one\n\n# two\n"],
    ["unterminated fence", "# t\n\n```js\nnever closed\n"],
  ]) {
    const { r } = run(md);
    assert.notEqual(r.status, 0, label + " must be refused");
  }
});

test("the output name has to agree with the input name, so the canonical cannot lie", () => {
  const dir = mkdtempSync(join(tmpdir(), "uai-evidence-"));
  const inPath = join(dir, "truthful.md");
  writeFileSync(inPath, full);
  const r = spawnSync(process.execPath, [RENDERER, "--in", inPath, "--out", join(dir, "renamed.html")], {
    encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /truthful\.html/);
});

test("rendering the same source twice is byte-identical", () => {
  const a = run(full);
  const b = run(full, "page");
  assert.equal(a.r.status, 0);
  assert.equal(b.r.status, 0);
  const first = readFileSync(a.outPath, "utf8");
  const second = readFileSync(b.outPath, "utf8");
  assert.equal(first, second, "the renderer is not idempotent");
});

test("the page declares itself generated and carries parseable structured data", () => {
  const { outPath } = run(full);
  const html = readFileSync(outPath, "utf8");
  // The marker is what keeps `pnpm docs:articles` from overwriting a hand-authored page.
  // This repository lost 319 lines of one to the first version of that script.
  assert.match(html, /^<!doctype html>\n<!-- generated by tools\/render-evidence-page\.mjs from docs\/page\.md/);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "no JSON-LD block");
  const object = JSON.parse(ld[1]);
  assert.equal(object["@type"], "TechArticle");
  assert.equal(object.headline, "Does anyone paginate the tool list?", "headline must be plain text, not markdown");
  assert.ok(!/[*`]/.test(object.headline));
  // A fixture rendered outside the repository has no git history, and the renderer omits the
  // dates rather than inventing them. The shipped-pages test below is where dates must exist.
  if (object.datePublished) assert.match(object.datePublished, /^\d{4}-\d{2}-\d{2}T.*Z$/, "datePublished must be UTC");
  if (object.dateModified) assert.match(object.dateModified, /^\d{4}-\d{2}-\d{2}T.*Z$/, "dateModified must be UTC");
  if (object.datePublished && object.dateModified) {
    assert.ok(object.datePublished <= object.dateModified, "published after modified");
  }
  assert.equal(object.mainEntityOfPage["@id"], "https://happy520ai.github.io/unified-ai-system/page.html");
  assert.ok(!object.description.includes("Run:"), "description carries a provenance line: " + object.description);
});

test("a heading containing a closing script tag cannot break out of the JSON-LD block", () => {
  const { outPath } = run("# Can a heading say </script> out loud, and survive a parser?\n\nBody text long enough to become a description for the search result snippet here.\n");
  const html = readFileSync(outPath, "utf8");
  const blocks = html.match(/<script[^>]*>/g) || [];
  const closes = html.match(/<\/script>/g) || [];
  assert.equal(blocks.length, closes.length, "unbalanced script tags: " + blocks.length + "/" + closes.length);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "no JSON-LD block");
  const object = JSON.parse(ld[1]);
  assert.match(object.headline, /<\/script>/, "the heading text should survive as data: " + object.headline);
});

test("the six shipped pages still match their markdown sources", () => {
  const names = [
    "mcp-tools-list-pagination-survey",
    "mcp-protocol-revision-tolerance",
    "mcp-session-enforcement",
    "mcp-protocol-version-header",
    "mcp-route-headers",
    "mcp-list-cache-hints",
  ];
  for (const n of names) {
    const md = readFileSync("docs/" + n + ".md", "utf8");
    const html = readFileSync("docs/" + n + ".html", "utf8");
    const mdLines = md.split(/\r?\n/);
    const srcHeadings = mdLines.filter((l) => /^#{1,4} /.test(l)).length;
    assert.equal(
      (html.match(/<h[1-4][ >]/g) || []).length,
      srcHeadings,
      n + ": heading count drifted between md and html",
    );
    const srcItems = mdLines.filter((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l)).length;
    assert.equal((html.match(/<li>/g) || []).length, srcItems, n + ": list items drifted");
    assert.match(html, new RegExp('rel="canonical" href="https://happy520ai\\.github\\.io/unified-ai-system/' + n + '\\.html"'));
    assert.ok(!/^```/m.test(html), n + ": a raw code fence survived");
    // Inside the repository git history exists, so a shipped page has no excuse for missing
    // dates: this is the arm that distinguishes "omitted because unknown" from "never added".
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(ld, n + ": no JSON-LD block");
    const object = JSON.parse(ld[1]);
    assert.match(object.datePublished, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, n + ": datePublished missing or not UTC");
    assert.match(object.dateModified, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, n + ": dateModified missing or not UTC");
    assert.ok(object.datePublished <= object.dateModified, n + ": published after modified");
    assert.equal(object.mainEntityOfPage["@id"], "https://happy520ai.github.io/unified-ai-system/" + n + ".html");
    assert.ok(html.startsWith("<!doctype html>\n<!-- generated by tools/render-evidence-page.mjs"), n + ": no generator marker");
  }
});

