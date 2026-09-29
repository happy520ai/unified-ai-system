// The evidence-page renderer must be regenerable, must refuse a source it cannot
// represent, and must not let a document inject markup.
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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
  // graft boundary, so the comparison below is only a fact where the history is deeper than one commit.
  // The depth is read with the same git command the renderer uses but computed independently of it: were
  // the renderer ever to trust a one-commit clone, this arm would disagree and fail.
  const depth = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).stdout.trim());
  const canCompare = Number.isSafeInteger(depth) && depth > 1;
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
  const boundaryLimited = [];
  const compared = [];
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
    const srcWhen = (srcLine || "").split(" ")[1];
    const srcSha = (srcLine || "").split(" ")[0];
    // Knowability is a property of the reading, not of the clone's overall depth. Under the CI checkout
    // (fetch-depth: 2) this command answers with the graft boundary commit and reports that commit's own date,
    // which is later than the file's real last change - so thirteen correct pages looked stale. `rev-list
    // --count HEAD > 1` cannot see that: two commits passes it while every path reading stays boundary-bound.
    // The question that actually matters is whether the commit this reading returned has a parent here.
    const srcKnowable = Boolean(srcSha) && spawnSync("git", ["cat-file", "-e", srcSha + "^"], { stdio: ["ignore", "ignore", "ignore"] }).status === 0;
    if (!srcKnowable) boundaryLimited.push(n + ".md@" + (srcSha || "no-commit").slice(0, 8));
    if (srcWhen && canCompare && srcKnowable) {
      compared.push(n);
      const srcDate = new Date(srcWhen).toISOString().replace(/\.\d{3}Z$/, "Z");
      assert.ok(object.dateModified >= srcDate, n + ": page claims dateModified " + object.dateModified + " but its source last changed " + srcDate);
    }
    assert.equal(object.mainEntityOfPage["@id"], "https://happy520ai.github.io/unified-ai-system/" + n + ".html");
    assert.ok(html.startsWith("<!doctype html>\n<!-- generated by tools/render-evidence-page.mjs"), n + ": no generator marker");
  }
  // If no shipped page carried a fenced "# " line, the fence-awareness above could be deleted without any
  // arm failing, and the next article with a shell comment would report phantom drift.
  assert.ok(fencedHashCommentPages >= 1, "no page exercises the code-fence rule, so that arm proves nothing");
  // A skip has to be a reported fact, not an absorbed one: this repository's own history is deep, so a
  // non-empty list here means the comparison silently did not run in an environment that claimed it could.
  // The rule has to hold in both environments, or CI's depth-2 checkout just moves the red instead of
  // explaining it. So: account for every page, and allow a skip only when the reading returned the oldest
  // commit this clone can see - which is what a graft boundary is. In a full-history clone nothing qualifies,
  // so the comparison is required to run, and a silently vacuous arm is not available as an escape route.
  const oldestVisible = spawnSync("git", ["rev-list", "--max-parents=0", "HEAD"], { encoding: "utf8" }).stdout.trim().split(String.fromCharCode(10)).pop();
  for (const entry of boundaryLimited) {
    const sha = entry.split("@")[1];
    assert.equal(oldestVisible.slice(0, 8), sha, entry + " was skipped, but the oldest commit this clone can see is " + oldestVisible.slice(0, 8) + " - this is not a shallow-clone reading");
  }
  assert.equal(compared.length + boundaryLimited.length, names.length, "every generated page must be either compared or accounted for as boundary-limited");
  if (boundaryLimited.length > 0) {
    console.log("SKIPPED source-date comparison for " + boundaryLimited.length + " readings bounded by commit " + oldestVisible.slice(0, 8) + " (shallow checkout); " + compared.length + " pages were compared for real");
  } else {
    console.log("compared source dates for all " + compared.length + " generated pages");
  }
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
// Every environment gets a real expectation, chosen by the repository's own commit count rather than by
// revision syntax: the CI quality job and the Windows job disagreed about the previous version of this arm
// precisely because `<sha>^` resolves differently across git builds and checkout depths, while
// `rev-list --count HEAD` measures the same fact everywhere.
test("a date is published only when the repository has history to date it from", async () => {
  const when = spawnSync("git", ["log", "--format=%cI", "-1", "--", "docs/multi-arch-node-modules.md"], { encoding: "utf8" }).stdout.trim();
  assert.ok(when, "no commit date found for the article source");
  const depth = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).stdout.trim());
  const trustworthy = Number.isSafeInteger(depth) && depth > 1;
  // Rendered under the shipped page's own name so the lookup resolves to a path that really is in this
  // repository's history; a made-up slug would omit its dates in any clone and prove nothing.
  const { r, outPath } = run(readFileSync("docs/multi-arch-node-modules.md", "utf8"), "multi-arch-node-modules");
  assert.equal(r.status, 0, r.stderr);
  const ld = readFileSync(outPath, "utf8").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, "no JSON-LD block");
  const object = JSON.parse(ld[1]);
  const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (trustworthy) {
    assert.match(object.dateModified, UTC, "this clone has history, so a date is knowable and must be published");
    // The rule is "the later of the two git dates", so both legs are read here independently. Asserting
    // equality with the source date alone would fail on every page whose rendered artifact moved later,
    // which is normal: the markdown is committed first, then the page that carries its date.
    const asUTC = (raw) => new Date(raw).toISOString().replace(/\.\d{3}Z$/, "Z");
    const htmlRaw = spawnSync("git", ["log", "--format=%cI", "-1", "--", "docs/multi-arch-node-modules.html"], { encoding: "utf8" }).stdout.trim();
    const expected = Date.parse(htmlRaw) > Date.parse(when) ? asUTC(htmlRaw) : asUTC(when);
    assert.equal(object.dateModified, expected, "dateModified must be the later of the source commit and the artifact commit");
  } else {
    assert.equal(object.dateModified, undefined, "a one-commit clone would report its own boundary date, not this file's");
    assert.equal(object.datePublished, undefined, "a one-commit clone cannot know when this was first published");
  }
  const { historyDepth } = await import("./render-evidence-page.mjs");
  assert.equal(historyDepth(), depth, "the renderer counts history differently than git does here");
});

test("the trust decision is a threshold on the commit count, not on luck", async () => {
  const { datesTrustworthy } = await import("./render-evidence-page.mjs");
  assert.equal(datesTrustworthy(0), false, "no repository is not a history");
  assert.equal(datesTrustworthy(1), false, "a grafted boundary commit cannot date a file");
  assert.equal(datesTrustworthy(2), true, "two commits is the first depth where the tip has a parent");
  assert.equal(datesTrustworthy(4000), true);
  assert.equal(datesTrustworthy(Number("nope")), false, "an unreadable count is not evidence of history");
});

test("a depth-2 clone - what CI checks out - reports boundary dates, and the gate notices", async () => {
  // The calibration needs a deep parent: inside a shallow checkout every path already reads as the boundary,
  // so "the shallow clone disagrees with full history" cannot be shown and the arm would be vacuous.
  const here = (args) => spawnSync("git", args, { encoding: "utf8" });
  const depth = Number(here(["rev-list", "--count", "HEAD"]).stdout.trim());
  if (depth <= 3) {
    console.log("SKIPPED calibration: this clone has " + depth + " commits, so a nested depth-2 clone cannot be distinguished from full history");
    return;
  }
  const { pathToFileURL } = await import("node:url");
  const commonDir = here(["rev-parse", "--path-format=absolute", "--git-common-dir"]).stdout.trim();
  assert.ok(commonDir, "could not locate the repository's common git dir");
  // Cloning the default ref would grab a different branch: this work sits on a branch whose tip is not the
  // repository's master, and a fixture built from the wrong commit proves nothing about the pages under test.
  const branch = here(["branch", "--show-current"]).stdout.trim();
  assert.ok(branch, "detached HEAD, so the calibration cannot name a ref to clone");

  // Pick a file whose real last change is older than the two commits a depth-2 clone can see.
  const visible = new Set(here(["rev-list", "--max-count=2", "HEAD"]).stdout.trim().split(String.fromCharCode(10)));
  const candidates = readdirSync("docs").filter((f) => f.endsWith(".md"));
  const pick = candidates.find((f) => {
    const sha = here(["log", "--format=%H", "-1", "--", "docs/" + f]).stdout.trim();
    return sha && !visible.has(sha);
  });
  assert.ok(pick, "every docs source was changed within the last two commits, so no boundary is demonstrable");
  const trueLine = here(["log", "--format=%H %cI", "-1", "--", "docs/" + pick]).stdout.trim();

  const dir = mkdtempSync(join(tmpdir(), "uai-depth2-"));
  const target = join(dir, "clone");
  const clone = spawnSync("git", ["clone", "--depth", "2", "--branch", branch, "--no-checkout", pathToFileURL(commonDir).href, target], { encoding: "utf8" });
  assert.equal(clone.status, 0, clone.stderr.slice(0, 300));
  const inClone = (args) => spawnSync("git", args, { cwd: target, encoding: "utf8" });
  assert.equal(Number(inClone(["rev-list", "--count", "HEAD"]).stdout.trim()), 2, "the fixture must reproduce CI's fetch-depth: 2");

  const boundaryLine = inClone(["log", "--format=%H %cI", "-1", "--", "docs/" + pick]).stdout.trim();
  const [bSha, bWhen] = boundaryLine.split(" ");
  assert.ok(bSha && bWhen, "no reading for " + pick + " inside the shallow clone");
  // The misreading, pinned: the boundary commit's own date is returned for a file it never touched, and it is
  // later than the file's real change - which is the direction that makes a fresh page look stale.
  assert.notEqual(bSha, trueLine.split(" ")[0], "the shallow clone returned the same commit as full history, so the fixture proves nothing");
  assert.ok(Date.parse(bWhen) > Date.parse(trueLine.split(" ")[1]), `expected the boundary reading (${bWhen}) to be later than the real one (${trueLine.split(" ")[1]})`);
  assert.notEqual(inClone(["cat-file", "-e", bSha + "^"]).status, 0, "the predicate must report a graft boundary as unknowable");
  // And the same predicate on the real reading in this clone says the opposite, so it is not simply always
  // answering "unknowable".
  assert.equal(here(["cat-file", "-e", trueLine.split(" ")[0] + "^"]).status, 0, "a deep clone's source commit must read as knowable");
  rmSync(dir, { force: true, recursive: true });
});

const { hreflangBlock, IMAGE_ALT } = await import("./render-evidence-page.mjs");
const NL = String.fromCharCode(10);
const ROOT_URL = "https://happy520ai.github.io/unified-ai-system/";

test("a language twin is annotated from both sides and x-default names the English page", () => {
  // The renderer wrote these lines, so this is where the pair has to be right. The shipped defect was that
  // the Chinese page emitted a single self-link labelled hreflang="en" and pointed its x-default at itself -
  // a page claiming to be English while its own canonical said otherwise.
  const en = hreflangBlock({ slug: "pair.html", lang: "en", twin: "pair.zh-CN.html" });
  const zh = hreflangBlock({ slug: "pair.zh-CN.html", lang: "zh-CN", twin: "pair.html" });
  assert.equal(en.split(NL).length, 3, "an EN twin page declares three alternates");
  assert.equal(zh.split(NL).length, 3, "the ZH twin declares the same three, not one");
  assert.match(zh, new RegExp('hreflang="zh-CN" href="' + ROOT_URL.replace(/[/.]/gu, (c) => "\\" + c) + 'pair\.zh-CN\.html"'), zh);
  assert.match(zh, new RegExp('hreflang="en" href="' + ROOT_URL.replace(/[/.]/gu, (c) => "\\" + c) + 'pair\.html"'), zh);
  assert.match(en, /hreflang="x-default" href="https:\/\/happy520ai\.github\.io\/unified-ai-system\/pair\.html"/u);
  assert.match(zh, /hreflang="x-default" href="https:\/\/happy520ai\.github\.io\/unified-ai-system\/pair\.html"/u,
    "both sides must agree that the English page is the default; the old code named the page's own URL");
  assert.doesNotMatch(zh, /hreflang="en" href="[^"]*zh-CN\.html"/u, "the English alternate may not point at the Chinese file");
  // Boundary: a page with no twin declares exactly one alternate, in its own language.
  assert.equal(hreflangBlock({ slug: "solo.html", lang: "en", twin: "" }),
    '<link rel="alternate" hreflang="en" href="' + ROOT_URL + 'solo.html" />');
});

test("the generated head carries a card description, in the language of the page", () => {
  // A hand-added og:image:alt is erased by the next render - which is how 14 pages lost it after they had
  // been fixed. So the attribute has to come out of the generator, and that is only provable by rendering.
  assert.notEqual(IMAGE_ALT.en, IMAGE_ALT["zh-CN"], "the two languages need different descriptions");
  for (const lang of ["en", "zh-CN"]) {
    assert.ok(IMAGE_ALT[lang].includes("Unified AI System"), lang + " card alt must name the project");
    assert.ok(IMAGE_ALT[lang].length > 20, lang + " card alt is too short to describe the image");
  }
  const dir = mkdtempSync(join(tmpdir(), "renderhead-"));
  const mk = (stem) => {
    const inPath = join(dir, stem + ".md");
    const outPath = join(dir, stem + ".html");
    writeFileSync(inPath, full, "utf8");
    const r = spawnSync(process.execPath, [RENDERER, "--in", inPath, "--out", outPath], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return readFileSync(outPath, "utf8");
  };
  const en = mk("probe");
  assert.ok(en.includes('<meta property="og:image:alt" content="' + IMAGE_ALT.en + '" />'), "EN render lost the card alt");
  // Same file rendered as a Chinese page without --lang: the name has to decide the language, because a
  // caller that forgot the flag used to emit an English-labelled Chinese page.
  const zhInferred = mk("probe2.zh-CN");
  assert.ok(zhInferred.includes('<html lang="zh-CN">'), "a .zh-CN source must render as Chinese with no --lang");
  assert.ok(zhInferred.includes('<meta property="og:image:alt" content="' + IMAGE_ALT["zh-CN"] + '" />'),
    "ZH render lost the Chinese card alt");
  // A page rendered with no twin declares only itself: no x-default, because there is no alternate to choose
  // a default between. Asserting one here would demand a declaration the pair rule forbids.
  assert.equal((zhInferred.match(/hreflang="x-default"/gu) || []).length, 0, "a lone page may not claim a default");
  assert.equal((zhInferred.match(/rel="alternate" hreflang=/gu) || []).length, 1, "one self declaration, in its own language");
  assert.match(zhInferred, /hreflang="zh-CN" href="https:\/\/happy520ai\.github\.io\/unified-ai-system\/probe2\.zh-CN\.html"/u);
  rmSync(dir, { recursive: true, force: true });
});
