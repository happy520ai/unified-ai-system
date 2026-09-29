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

const BASE_URL = "https://happy520ai.github.io/unified-ai-system/";
const langLink = (lang, file) => `<link rel="alternate" hreflang="${lang}" href="${BASE_URL}${file}" />`;
const goodPair = {
  en: [langLink("en", "a.html"), langLink("zh-CN", "a.zh-CN.html"), langLink("x-default", "a.html")].join("\n"),
  zh: [langLink("en", "a.html"), langLink("zh-CN", "a.zh-CN.html"), langLink("x-default", "a.html")].join("\n"),
};
const pairAudit = (en, zh) => auditArticlePages({
  sitemapText: `<url><loc>${BASE_URL}a.html</loc></url><url><loc>${BASE_URL}a.zh-CN.html</loc></url>`,
  llmsText: "a.html a.zh-CN.html",
  mdStems: [],
  pages: { "a.html": en, "a.zh-CN.html": zh },
}).filter((p) => p.code === "hreflang_pair_inconsistent");

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

test("a link written as a full URL still counts, and a longer filename sharing the suffix does not", () => {
  // The shipped pages cross-link with absolute hrefs. The earlier matcher demanded the name immediately
  // after a quote, so it could not see those and reported several pages as unreachable from the other
  // language while the twin link was in the file all along - which is how I nearly "fixed" links that
  // already existed.
  const absolute = auditArticlePages({
    ...base,
    pages: {
      ...base.pages,
      "index.html": '<a href="https://example.test/unified-ai-system/article-one.html">one</a>',
      "index.zh-CN.html": '<a href="https://example.test/unified-ai-system/article-one.html">一</a>',
    },
  });
  assert.deepEqual(codes(absolute), [], JSON.stringify(absolute));

  const colliding = auditArticlePages({
    ...base,
    pages: {
      "index.html": '<a href="https://example.test/unified-ai-system/other-article-one.html">not ours</a>',
      "index.zh-CN.html": '<a href="x/other-article-one.html">not ours</a>',
      "article-one.html": base.pages["article-one.html"],
    },
  });
  assert.ok(codes(colliding).includes("article_page_unreachable"), JSON.stringify(colliding));
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

  // The shape a hand-authored page actually drifts into: the keys are all present but one date has gone
  // date-only. Both directions are pinned, because an arm that fires on everything is noise.
  const typed = LD("https://example.test/article-one.html").replace(/"dateModified":\s*"[^"]*"/u, '"dateModified": "2026-01-01"');
  const drift = auditArticlePages(withPage("<main></main>" + typed));
  assert.deepEqual(codes(drift), ["article_page_jsonld_date_not_utc"], JSON.stringify(drift));
  assert.match(drift[0].detail, /inject-jsonld-dates/, "the printed remedy must be the command that fixes it");

  const clean = auditArticlePages(withPage("<main></main>" + LD("https://example.test/article-one.html")));
  assert.deepEqual(codes(clean), [], "a well-formed UTC pair must produce nothing: " + JSON.stringify(clean));

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

test("required keys depend on what the block claims to be", () => {
  // Two HowTo pages were reported as incomplete because the arm asked every block for TechArticle's keys.
  const howTo = (extra) => '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Run an MCP server in Codex with Docker",
    description: "Connect Codex to a pinned MCP server and verify its tools.",
    totalTime: "PT1M",
    datePublished: "2026-01-01T00:00:00Z",
    dateModified: "2026-01-02T00:00:00Z",
    step: [{ "@type": "HowToStep", name: "run" }],
    ...extra,
  }) + "</script>";
  const good = { ...base, pages: { ...base.pages, "article-one.html": "<main>x</main>" + howTo({}) } };
  assert.deepEqual(auditArticlePages(good), [], JSON.stringify(auditArticlePages(good)));

  const missing = auditArticlePages({ ...base, pages: { ...base.pages, "article-one.html": "<main>x</main>" + howTo({ step: undefined }) } });
  assert.deepEqual(codes(missing), ["article_page_jsonld_incomplete"], JSON.stringify(missing));
  assert.equal(missing[0].detail, "HowTo missing step", missing[0].detail);
});

test("a language pair is required to be annotated in both directions", () => {
  // Boundary target first: the correct shape must produce nothing, or the arm would just be loud.
  assert.deepEqual(pairAudit(goodPair.en, goodPair.zh), []);

  // The English hub's actual defect: no hreflang at all while the Chinese twin points back at it.
  const oneSided = pairAudit("<main>x</main>", goodPair.zh);
  const details = oneSided.map((p) => p.detail);
  assert.ok(details.some((d) => d.includes('english page declares no hreflang="en"')), JSON.stringify(details));
  assert.ok(details.some((d) => d.includes('english page declares no hreflang="zh-CN"')), JSON.stringify(details));
  assert.ok(details.some((d) => d.includes("english page declares no x-default")), JSON.stringify(details));

  // The multi-arch page's defect: the Chinese page claims to be the English one.
  const selfPointing = [langLink("en", "a.zh-CN.html"), langLink("zh-CN", "a.zh-CN.html"), langLink("x-default", "a.html")].join("\n");
  const selfWays = pairAudit(goodPair.en, selfPointing);
  assert.equal(selfWays.length, 1, JSON.stringify(selfWays));
  assert.match(selfWays[0].detail, /chinese hreflang="en" points at .+a\.zh-CN\.html/u);

  // A pair that disagrees only about x-default is still caught, because a crawler takes the set as one unit.
  const skewed = [langLink("en", "a.html"), langLink("zh-CN", "a.zh-CN.html"), langLink("x-default", "a.zh-CN.html")].join("\n");
  const skew = pairAudit(goodPair.en, skewed);
  assert.equal(skew.length, 1, JSON.stringify(skew));
  assert.match(skew[0].detail, /disagree about x-default/u);
});

test("no page pair in the shipped docs is left one-sided", () => {
  const pages = {};
  for (const f of readdirSync("docs").filter((x) => x.endsWith(".html"))) pages[f] = readFileSync("docs/" + f, "utf8");
  const sitemapText = readFileSync("docs/sitemap.xml", "utf8");
  const found = auditArticlePages({
    sitemapText,
    llmsText: readFileSync("docs/llms.txt", "utf8"),
    mdStems: readdirSync("docs").filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/u, "")),
    pages,
  }).filter((p) => p.code === "hreflang_pair_inconsistent");
  assert.deepEqual(found, [], "twin pages must annotate each other both ways: " + JSON.stringify(found));
  // The floor keeps this from passing because the corpus stopped having pairs at all.
  const pairs = Object.keys(pages).filter((f) => !f.endsWith(".zh-CN.html") && (f.replace(/\.html$/u, ".zh-CN.html") in pages)).length;
  assert.ok(pairs >= 8, "expected at least 8 twin pairs in docs/, saw " + pairs);
});

test("every shipped language pair carries a full hreflang set, not just a reciprocal one", () => {
  // The arm above only owes reciprocity once one side declares, so a pair where nobody declares anything passes
  // it by silence. That is a real gap: a future twin page added without alternation would be invisible to it.
  // This test closes it against the shipped corpus, where annotating both ways is the site's own convention.
  const pages = {};
  for (const f of readdirSync("docs").filter((x) => x.endsWith(".html"))) pages[f] = readFileSync("docs/" + f, "utf8");
  const linksOf = (f) => {
    const out = {};
    for (const m of pages[f].matchAll(/<link\b[^>]*>/gu)) {
      const t = m[0].replace(/\s+/gu, " ");
      if (!/rel="alternate"/u.test(t) || !/hreflang="/u.test(t)) continue;
      const href = /href="([^"]+)"/u.exec(t);
      if (href) out[/hreflang="([^"]+)"/u.exec(t)[1]] = href[1];
    }
    return out;
  };
  const pairs = Object.keys(pages).filter((f) => !f.endsWith(".zh-CN.html") && f.replace(/\.html$/u, ".zh-CN.html") in pages);
  assert.ok(pairs.length >= 8, "expected at least 8 twin pairs, saw " + pairs.length);
  for (const en of pairs) {
    const zh = en.replace(/\.html$/u, ".zh-CN.html");
    for (const [file, want] of [[en, ["en", "zh-CN", "x-default"]], [zh, ["en", "zh-CN", "x-default"]]]) {
      const got = Object.keys(linksOf(file)).sort();
      assert.deepEqual(got, [...want].sort(), file + " must declare en, zh-CN and x-default; silence is not annotation");
    }
  }
});

// Social cards are what makes a shared link render as anything at all, and the two measurements hubs - the
// pages someone is most likely to paste into a chat - carried no og:image while 15 other pages carried an image
// with no alt text. Checked here rather than in auditArticlePages because the audit's fixtures deliberately
// omit cards, and an arm that reddened every fixture would be loosened instead of fixed.
const cardGaps = (pages, exists) => {
  const gaps = [];
  for (const [file, html] of Object.entries(pages)) {
    const meta = (attr) => {
      for (const m of html.matchAll(/<meta\b[^>]*>/gu)) {
        const tag = m[0].replace(/\s+/gu, " ");
        if (tag.includes(attr)) return (/content="([^"]*)"/u.exec(tag) || [, ""])[1];
      }
      return null;
    };
    const img = meta('property="og:image"');
    const alt = meta('property="og:image:alt"');
    const card = meta('name="twitter:card"');
    if (!img) gaps.push(file + ": no og:image, so the link previews as text only");
    else if (!alt) gaps.push(file + ": og:image without og:image:alt");
    else if (exists && !exists(img.split("/").pop())) gaps.push(file + ": og:image " + img + " is not published in docs/");
    if (img && !card) gaps.push(file + ": og:image but no twitter:card, so the card renders small");
  }
  return gaps;
};

test("every shipped page carries a social card with alt text and a resolvable image", () => {
  const pages = {};
  for (const f of readdirSync("docs").filter((x) => x.endsWith(".html"))) pages[f] = readFileSync("docs/" + f, "utf8");
  const exists = (name) => existsSync("docs/" + name) || existsSync("docs/assets/" + name);
  assert.ok(Object.keys(pages).length >= 31, "the corpus shrank to " + Object.keys(pages).length + " pages");
  assert.deepEqual(cardGaps(pages, exists), []);

  // Each failure mode has to be able to fire, or the clean result above means nothing.
  const good = '<meta property="og:image" content="https://x/a.png" /><meta property="og:image:alt" content="an alt" /><meta name="twitter:card" content="summary_large_image" />';
  assert.deepEqual(cardGaps({ "a.html": "<main>x</main>" }), ["a.html: no og:image, so the link previews as text only"]);
  // An image with neither alt nor a card is two separate gaps, and the fixture says so: collapsing them into
  // one message would hide which of the two a page still has to fix.
  assert.deepEqual(cardGaps({ "a.html": '<meta property="og:image" content="https://x/a.png" />' }), [
    "a.html: og:image without og:image:alt",
    "a.html: og:image but no twitter:card, so the card renders small",
  ]);
  assert.deepEqual(cardGaps({ "a.html": '<meta property="og:image" content="https://x/a.png" /><meta property="og:image:alt" content="an alt" />' }), ["a.html: og:image but no twitter:card, so the card renders small"]);
  assert.deepEqual(cardGaps({ "a.html": good }, () => false), ["a.html: og:image https://x/a.png is not published in docs/"]);
  assert.deepEqual(cardGaps({ "a.html": good }, () => true), [], "the complete fixture must not fire, or the arm only knows how to complain");
});
