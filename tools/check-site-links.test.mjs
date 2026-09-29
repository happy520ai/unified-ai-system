import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ARBITRARY_DEPTH_PAGES,
  SITE_ROOT,
  brokenRefs,
  checkDocsLinks,
  internalHtmlRefs,
  ownSiteRefs,
  ownTarget,
  unrootedOwnRefs,
} from "./check-site-links.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const run = (args) => spawnSync(process.execPath, ["tools/check-site-links.mjs", ...args], { cwd: ROOT, encoding: "utf8" });

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

test("both address forms resolve, and a root that is not ours is a miss", () => {
  const docs = join(ROOT, "docs");
  assert.equal(ownTarget(docs, "index.html"), resolve(docs, "index.html"));
  assert.equal(ownTarget(docs, SITE_ROOT + "index.html"), resolve(docs, "index.html"));
  // A query and a fragment are not part of the file, so a cache-busted stylesheet must still resolve.
  assert.equal(ownTarget(docs, "site.css?v=prompt-lab-6"), resolve(docs, "site.css"));
  assert.equal(ownTarget(docs, SITE_ROOT + "index.html#main"), resolve(docs, "index.html"));
  // Reporting a foreign root as absent, rather than skipping it, is what keeps the checker from going
  // quiet on a link that renders as /unified-ai-system/../some-other-site.
  assert.equal(ownTarget(docs, "/some-other-site/index.html"), null);
  assert.deepEqual(brokenRefs(["/some-other-site/index.html"], (ref) => ownTarget(docs, ref)), ["/some-other-site/index.html"]);
  assert.deepEqual(brokenRefs([SITE_ROOT + "index.html"], (ref) => ownTarget(docs, ref)), []);
});

test("own-site collection is not limited to .html, and ignores what the site does not serve", () => {
  const refs = ownSiteRefs([
    '<link rel="stylesheet" href="' + SITE_ROOT + 'site.css" />',
    '<a href="index.html">page</a>',
    '<a href="' + SITE_ROOT + 'sitemap.xml">sitemap</a>',
    '<a href="' + SITE_ROOT + 'llms.txt">text</a>',
    '<img src="assets/pic.png">',
    '<a href="https://github.com/x/y">outbound</a>',
    '<a href="//example.com/x">protocol-relative</a>',
    '<a href="mailto:we@example.com">mail</a>',
    '<a href="#main">anchor</a>',
  ].join("\n"));
  assert.deepEqual(refs.map((r) => r.raw), [
    SITE_ROOT + "site.css", "index.html", SITE_ROOT + "sitemap.xml", SITE_ROOT + "llms.txt", "assets/pic.png",
  ]);
  assert.deepEqual(refs.map((r) => r.rooted), [true, false, true, true, false]);
});

test("the depth rule fires on a relative reference and stays quiet on a rooted one", () => {
  assert.deepEqual(unrootedOwnRefs('<link rel="stylesheet" href="site.css" /><a href="index.html">x</a>'),
    ["site.css", "index.html"]);
  assert.deepEqual(unrootedOwnRefs('<a href="' + SITE_ROOT + 'index.html">x</a><a href="#top">y</a>' +
    '<a href="https://github.com/happy520ai/unified-ai-system">z</a>'), []);
});

test("the shipped 404 page is rooted everywhere, and every rooted link names a real file", () => {
  // GitHub Pages answers docs/404.html in place of any missing path, at any depth, so relative hrefs
  // there resolve against the address the visitor got wrong. This is the defect the page shipped with:
  // verified live at /docs/nope.html, where the rescue page emitted nothing but further 404s.
  const html = readFileSync(join(ROOT, "docs", "404.html"), "utf8");
  assert.deepEqual(unrootedOwnRefs(html), [], "the arbitrary-depth page must not write relative links");
  const rooted = ownSiteRefs(html).filter((r) => r.rooted);
  // A floor, because "0 unrooted" is also what an emptied page or a blind matcher returns.
  assert.ok(rooted.length >= 6, `expected the shipped links, saw ${rooted.length}`);
  assert.equal(new Set(rooted.map((r) => r.raw)).size, rooted.length, "each reference counted once");
  for (const ref of rooted) {
    assert.ok(ref.raw.startsWith(SITE_ROOT), ref.raw + " is rooted under a different site");
    const target = ownTarget(join(ROOT, "docs"), ref.raw);
    assert.ok(target && existsSync(target), ref.raw + " does not resolve to a file in docs/");
  }
  // The JSON-LD and Open Graph addresses must stay absolute URLs: a root-relative og:url is not a
  // resolvable canonical for a crawler reading the page outside this host.
  for (const m of html.matchAll(/<meta property="og:(?:url|image)" content="([^"]*)"/gu)) {
    assert.match(m[1], /^https:\/\//u, m[1] + " must be an absolute URL");
  }
});

test("the root rule binds only the arbitrary-depth page, not the pages with one address", () => {
  // Boundary target: without it, a future hand widening the rule to every page would read as a
  // tightening rather than as a change of product decisions. The site's other 31 pages are each served
  // at exactly one path, where relative links resolve correctly and keep the copy portable.
  assert.deepEqual(ARBITRARY_DEPTH_PAGES, ["404.html"]);
  const html = readFileSync(join(ROOT, "docs", "index.html"), "utf8");
  assert.ok(unrootedOwnRefs(html).length > 20, "index.html is expected to keep relative links");
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

test("the CLI refuses each planted defect, and accepts the legitimate shapes", () => {
  // The success shape of these arms is a refusal, so they need a fixture that makes them refuse once.
  const dir = mkdtempSync(join(tmpdir(), "site-links-cli-"));
  try {
    writeFileSync(join(dir, "index.html"), '<a href="present.html">ok</a>');
    writeFileSync(join(dir, "present.html"), "<html></html>");
    const at = (html) => writeFileSync(join(dir, "404.html"), html, "utf8");
    const verdict = () => {
      const r = run(["--docs", dir]);
      return { exit: r.status, text: r.stdout + (r.stderr ?? "") };
    };

    at('<link rel="stylesheet" href="' + SITE_ROOT + 'present.html" />');
    const good = verdict();
    assert.equal(good.exit, 0, good.text);

    at('<a href="index.html">x</a>');
    const relative = verdict();
    assert.equal(relative.exit, 1, "a relative link on the arbitrary-depth page must go red: " + relative.text);
    assert.match(relative.text, /DEPTH-UNSAFE 404\.html -> index\.html/);

    at('<a href="' + SITE_ROOT + 'nope.html">x</a>');
    const missing = verdict();
    assert.equal(missing.exit, 1, missing.text);
    assert.match(missing.text, new RegExp("BROKEN 404\\.html -> " + SITE_ROOT + "nope\\.html"));

    at('<a href="/someone-elses-site/index.html">x</a>');
    const foreign = verdict();
    assert.equal(foreign.exit, 1, foreign.text);
    assert.match(foreign.text, /BROKEN 404\.html -> \/someone-elses-site/);

    at('<a href="' + SITE_ROOT + 'present.html">x</a><a href="#main">y</a>' +
      '<a href="https://example.com/z">z</a>');
    const legitimate = verdict();
    assert.equal(legitimate.exit, 0, legitimate.text);
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
  // The wider net - stylesheets, icons, the sitemap, llms.txt - must have found things too, or it is
  // only ever reported as green and never as a check.
  const assetRefs = result.rows.reduce((sum, row) => sum + ownSiteRefs(readFileSync(join(result.dir, row.page), "utf8")).length, 0);
  assert.ok(assetRefs > refs, `expected own-site refs to include the assets, saw ${assetRefs} vs ${refs} .html refs`);
  assert.deepEqual(result.rows.flatMap((row) => row.ownBroken), [], "dead own-site asset on the project site");
});
