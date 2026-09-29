// The evidence-page renderer must be regenerable, must refuse a source it cannot
// represent, and must not let a document inject markup.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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

test("every generated article page still matches its markdown source", async () => {
  // CI checks this repository out shallow. A shallow clone answers `git log -1 -- <path>` with its own
  // graft boundary, so the comparison below is only a fact where the reading is not sitting on one - and
  // parentResolves is the same criterion the renderer uses, not a second opinion invented here.
  const { parentResolves } = await import("./render-evidence-page.mjs");
  // Derived from the generator marker, not from a typed list. The list this replaced named six pages and
  // the repository had thirteen, so seven shipped pages - including the newest article - had no arm at all
  // asserting their dates or canonical URL. An empty derivation would pass vacuously, hence the floor.
  const MARKER = "<!doctype html>\n<!-- generated by tools/render-evidence-page.mjs";
  const names = readdirSync("docs")
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.replace(/\.html$/, ""))
    .filter((n) => readFileSync("docs/" + n + ".html", "utf8").replace(/\r\n/g, "\n").startsWith(MARKER));
  assert.ok(names.length >= 13, "the generator marker matched only " + names.length + " pages; the derivation is broken, not the corpus");
  assert.ok(!names.includes("prompt-enhancement"), "a hand-authored page must not be claimed as generated");
  // Lines inside a code fence are content, not structure. Two shipped articles carry shell comments that
  // begin with "# ", and counting those as headings is what made the first fence-aware run of this arm
  // report drift on a page whose html was in fact current.
  const proseLines = (md) => {
    const out = [];
    let inFence = false;
    for (const l of md.split(/\r?\n/)) {
      if (/^\s*```/.test(l)) { inFence = !inFence; continue; }
      if (!inFence) out.push(l);
    }
    return out;
  };
  let fencedHashCommentPages = 0;
  for (const n of names) {
    const md = readFileSync("docs/" + n + ".md", "utf8");
    const html = readFileSync("docs/" + n + ".html", "utf8");
    const mdLines = proseLines(md);
    const looksLikeHeading = (l) => /^#{1,4} /.test(l);
    // Counted, not pattern-guessed: a page exercises the fence rule exactly when stripping fenced lines
    // removes something that a naive heading count would have included.
    if (md.split(/\r?\n/).filter(looksLikeHeading).length > mdLines.filter(looksLikeHeading).length) fencedHashCommentPages += 1;
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
    // The property that was violated when this arm did not exist: a shipped page claimed a modification
    // date 77 minutes older than the last commit that changed its source, because the renderer read only
    // the artifact's own history. The source date comes from a separate git call, so this is an
    // independent reading rather than a restatement of the renderer's choice - but only where history
    // exists. Under fetch-depth: 1 it reported all thirteen correct pages as stale.
    const srcLine = spawnSync("git", ["log", "--format=%H %cI", "-1", "--", "docs/" + n + ".md"], { encoding: "utf8" }).stdout.trim();
    const [srcSha, srcWhen] = (srcLine || "").split(" ");
    if (srcWhen && parentResolves(srcSha)) {
      const srcDate = new Date(srcWhen).toISOString().replace(/\.\d{3}Z$/, "Z");
      assert.ok(object.dateModified >= srcDate, n + ": page claims dateModified " + object.dateModified + " but its source last changed " + srcDate);
    }
    assert.equal(object.mainEntityOfPage["@id"], "https://happy520ai.github.io/unified-ai-system/" + n + ".html");
    assert.ok(html.startsWith("<!doctype html>\n<!-- generated by tools/render-evidence-page.mjs"), n + ": no generator marker");
  }
  // If no shipped page carried a fenced "# " line, the fence-awareness above could be deleted without any
  // arm failing, and the next article with a shell comment would report phantom drift.
  assert.ok(fencedHashCommentPages >= 1, "no page exercises the code-fence rule, so that arm proves nothing");
});

test("dateModified follows whichever of source or artifact moved later", async () => {
  const { pickModified } = await import("./render-evidence-page.mjs");
  const newer = "2026-09-29T06:18:32Z";
  const older = "2026-09-29T05:01:42Z";
  // The shape that was broken: the markdown had just been committed and the rendered page had not, so
  // reading only the artifact's own history reported the older of the two dates for the newer content.
  assert.equal(pickModified({ mdDate: newer, htmlDate: older }), newer);
  // A re-render with no source change does move the served page, so the artifact's date still counts.
  assert.equal(pickModified({ mdDate: older, htmlDate: newer }), newer);
  assert.equal(pickModified({ mdDate: newer, htmlDate: newer }), newer);
  assert.equal(pickModified({ mdDate: null, htmlDate: older }), older);
  assert.equal(pickModified({ mdDate: newer, htmlDate: null }), newer);
  // Unknown stays absent. Falling back to "now" would be an invented claim about when content changed.
  assert.equal(pickModified({ mdDate: null, htmlDate: null }), null);
});

// Every environment gets a real expectation: the branch is chosen by whether this repository's history
// actually reaches past the commit that touched the source, which is the same test the renderer applies
// before publishing a date. A shallow checkout is not allowed to pass this by doing nothing.
test("a date is published only when the reading is not sitting on a graft boundary", async () => {
  const line = spawnSync("git", ["log", "--format=%H %cI", "-1", "--", "docs/multi-arch-node-modules.md"], { encoding: "utf8" }).stdout.trim();
  const [sha, when] = line.split(" ");
  assert.ok(sha && when, "no commit found for the article source: " + line);
  // Decided with a different git primitive than the renderer uses. Importing parentResolves here would
  // let a version that always answered "yes" pick the easy branch and make this arm vacuous.
  const bounded = spawnSync("git", ["cat-file", "-e", sha + "^"], { stdio: ["ignore", "ignore", "ignore"] }).status !== 0;
  // Rendered under the shipped page's own name so the lookup resolves to a path that really is in this
  // repository's history; a made-up slug would omit its dates in any clone and prove nothing.
  const { r, outPath } = run(readFileSync("docs/multi-arch-node-modules.md", "utf8"), "multi-arch-node-modules");
  assert.equal(r.status, 0, r.stderr);
  const ld = readFileSync(outPath, "utf8").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "no JSON-LD block");
  const object = JSON.parse(ld[1]);
  const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (!bounded) {
    assert.match(object.dateModified, UTC, "history reaches past this commit, so a date is knowable and must be published");
    assert.equal(object.dateModified, new Date(when).toISOString().replace(/\.\d{3}Z$/, "Z"), "dateModified must be the source commit's date");
  } else {
    assert.equal(object.dateModified, undefined, "the reading is the graft boundary's own date, not this file's");
    assert.equal(object.datePublished, undefined, "a boundary clone cannot know when this was first published");
  }
});
