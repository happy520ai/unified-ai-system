// Each arm of the article-registration audit gets a fixture that makes it fire, and one
// fixture that must NOT fire. An unexercised arm is the failure mode this repository has
// been bitten by before: a guard that can only say "clean".
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { test } from "node:test";
import { auditArticlePages } from "./article-registration.mjs";

const sitemap = (...urls) =>
  "<urlset>" + urls.map((u) => `<url><loc>https://example.test/${u}</loc></url>`).join("") + "</urlset>";

const LD = (id) =>
  '<script type="application/ld+json">' +
  JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: "Does anyone's tools/list actually paginate?",
    description: "A measurement of cursor support across public MCP servers.",
    datePublished: "2026-01-01T00:00:00Z",
    dateModified: "2026-01-02T00:00:00Z",
    author: { "@type": "Organization", name: "Unified AI System" },
    mainEntityOfPage: { "@type": "WebPage", "@id": id },
  }) +
  "</script>";

const base = {
  sitemapText: sitemap("article-one.html", "index.html"),
  llmsText: "- [One](https://example.test/article-one.html)",
  mdStems: ["article-one"],
  pages: {
    "index.html": '<a href="article-one.html">one</a>',
    "index.zh-CN.html": '<a href="article-one.html">一</a>',
    "article-one.html": "<main>body</main>" + LD("https://example.test/article-one.html"),
  },
};

const codes = (problems) => problems.map((p) => p.code);

test("a correctly registered article produces nothing", () => {
  assert.deepEqual(auditArticlePages(base), []);
});

test("a declared article nobody links is unreachable", () => {
  const problems = auditArticlePages({
    ...base,
    pages: { "index.html": "<main>no links here</main>", "index.zh-CN.html": "<main></main>", "article-one.html": "<main>x</main>" },
  });
  assert.ok(codes(problems).includes("article_page_unreachable"), JSON.stringify(problems));
});

test("a page reachable only in one language is reported for the other language", () => {
  const englishOnly = auditArticlePages({ ...base, pages: { ...base.pages, "index.zh-CN.html": "<main></main>" } });
  assert.ok(codes(englishOnly).includes("article_page_missing_chinese_navigation"), JSON.stringify(englishOnly));
  assert.ok(!codes(englishOnly).includes("article_page_unreachable"), "it is reachable, just not in Chinese");

  const chineseOnly = auditArticlePages({ ...base, pages: { ...base.pages, "index.html": "<main></main>" } });
  assert.ok(codes(chineseOnly).includes("article_page_missing_english_navigation"), JSON.stringify(chineseOnly));
});

test("an article missing from llms.txt is reported", () => {
  const problems = auditArticlePages({ ...base, llmsText: "# summary\n\nno articles listed\n" });
  assert.deepEqual(codes(problems), ["article_page_absent_from_llms"]);
});

test("an llms.txt link to raw markdown on our own host is reported", () => {
  const problems = auditArticlePages({
    ...base,
    llmsText: "- [One](https://happy520ai.github.io/unified-ai-system/article-one.md)",
  });
  assert.ok(codes(problems).includes("llms_links_markdown_instead_of_page"), JSON.stringify(problems));
});

test("boundary: a markdown link to the source on github.com/blob is not a defect", () => {
  // GitHub renders blob URLs for a reader, so this is a legitimate style choice, not the
  // raw-markdown case. Without this fixture the arm fires on a real page (prompt-enhancement)
  // and the first honest response to a red guard - checking what it actually caught - is
  // replaced by weakening it.
  const problems = auditArticlePages({
    ...base,
    llmsText: "- [One](https://github.com/happy520ai/unified-ai-system/blob/master/docs/article-one.md)",
  });
  assert.deepEqual(problems, []);
});

test("a sitemap page with no markdown source is not held to the article rules", () => {
  // Landing pages are curated, not generated. Applying article arms to them would be a
  // false red, and a false red is how guards get weakened later.
  const problems = auditArticlePages({
    sitemapText: sitemap("terminal-first-ai-gateway.html"),
    llmsText: "nothing",
    mdStems: [],
    pages: { "terminal-first-ai-gateway.html": "<main>x</main>" },
  });
  assert.deepEqual(problems, []);
});

test("a declared page missing from the feed is reported, and so is an undeclared feed entry", () => {
  const feed = (urls) =>
    '<feed>' + urls.map((u) => `<entry><id>${u}</id><updated>2026-01-01T00:00:00Z</updated></entry>`).join("") + "</feed>";
  const articleUrl = "https://example.test/article-one.html";
  const indexUrl = "https://example.test/index.html";

  // The fixture declares two pages, so an empty feed legitimately reports both. Naming the
  // page is the point of the arm, so the assertion checks which page is called out rather
  // than only how many problems came back.
  const stale = auditArticlePages({ ...base, feedText: feed([]) });
  assert.deepEqual(codes(stale).sort(), ["sitemap_page_absent_from_feed", "sitemap_page_absent_from_feed"]);
  assert.deepEqual(stale.map((p) => p.page).sort(), ["article-one.html", "index.html"]);

  const extra = auditArticlePages({ ...base, feedText: feed([indexUrl, articleUrl, "https://example.test/ghost.html"]) });
  assert.deepEqual(codes(extra), ["feed_entry_not_declared"], JSON.stringify(extra));
  assert.equal(extra[0].page, "ghost.html");

  const matched = auditArticlePages({ ...base, feedText: feed([articleUrl, indexUrl]) });
  assert.deepEqual(matched, [], "a feed that agrees with the sitemap must produce nothing");
});

test("boundary: the feed does not have to list itself, and a caller may audit links only", () => {
  const withSelf = auditArticlePages({
    sitemapText: sitemap("article-one.html", "feed.xml"),
    llmsText: base.llmsText,
    mdStems: ["article-one"],
    pages: base.pages,
    feedText: '<feed><entry><id>https://example.test/article-one.html</id></entry></feed>',
  });
  assert.deepEqual(withSelf, [], "feed.xml must not be demanded as a feed entry: " + JSON.stringify(withSelf));
  // The arms are skipped rather than guessed at when the caller has no feed to compare.
  assert.deepEqual(auditArticlePages({ ...base, feedText: undefined }), []);
});

test("structured data is required per article page, by parsing rather than by grepping", () => {
  const withPage = (html) => ({
    ...base,
    pages: { ...base.pages, "article-one.html": html },
  });

  const absent = auditArticlePages(withPage("<main>body</main>"));
  assert.deepEqual(codes(absent), ["article_page_missing_jsonld"], JSON.stringify(absent));

  const broken = auditArticlePages(withPage('<main></main><script type="application/ld+json">{nope}</script>'));
  assert.deepEqual(codes(broken), ["article_page_jsonld_unparseable"], JSON.stringify(broken));

  const short = LD("https://example.test/article-one.html").replace(/"author":\s*\{[^}]*\},?/, "");
  const incomplete = auditArticlePages(withPage("<main></main>" + short));
  assert.deepEqual(codes(incomplete), ["article_page_jsonld_incomplete"], JSON.stringify(incomplete));

  // A block that describes a different URL is the interesting failure: the page looks
  // complete and points search engines somewhere else.
  const wrong = auditArticlePages(withPage("<main></main>" + LD("https://example.test/other.html")));
  assert.deepEqual(codes(wrong), ["article_page_jsonld_wrong_url"], JSON.stringify(wrong));

  assert.deepEqual(auditArticlePages(withPage("<main></main>" + LD("https://example.test/article-one.html"))), []);
});

test("boundary: a landing page with no markdown source is not required to carry structured data", () => {
  // Same exemption as the link arms: applying generated-page rules to a hand-authored page
  // is how a guard starts producing false reds that someone later weakens.
  const problems = auditArticlePages({
    sitemapText: sitemap("terminal-first-ai-gateway.html"),
    llmsText: "nothing",
    mdStems: [],
    pages: { "terminal-first-ai-gateway.html": "<main>x</main>" },
    feedText: '<feed><entry><id>https://example.test/terminal-first-ai-gateway.html</id></entry></feed>',
  });
  assert.deepEqual(problems, []);
});

test("the real repository passes the audit it is about to enforce", () => {
  const sitemapText = readFileSync("docs/sitemap.xml", "utf8");
  const llmsText = readFileSync("docs/llms.txt", "utf8");
  const feedText = readFileSync("docs/feed.xml", "utf8");
  const names = readdirSync("docs").filter((f) => f.endsWith(".html"));
  const pages = Object.fromEntries(names.map((f) => [f, readFileSync("docs/" + f, "utf8")]));
  const mdStems = names.filter((f) => existsSync("docs/" + f.replace(/\.html$/, ".md"))).map((f) => f.replace(/\.html$/, ""));
  const problems = auditArticlePages({ sitemapText, llmsText, feedText, pages, mdStems });
  assert.deepEqual(problems, [], "registered article pages drifted: " + JSON.stringify(problems));
  assert.ok(mdStems.length >= 6, "expected the six evidence articles plus any other sourced page, got " + mdStems.length);
  const entries = (feedText.match(/<entry>/g) || []).length;
  const declared = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => !u.endsWith("/feed.xml"));
  assert.equal(entries, declared.length, "feed entries must equal declared pages, saw " + entries + " vs " + declared.length);
});
