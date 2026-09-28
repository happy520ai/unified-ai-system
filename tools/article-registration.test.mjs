// Each arm of the article-registration audit gets a fixture that makes it fire, and one
// fixture that must NOT fire. An unexercised arm is the failure mode this repository has
// been bitten by before: a guard that can only say "clean".
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { test } from "node:test";
import { auditArticlePages } from "./article-registration.mjs";

const sitemap = (...urls) =>
  "<urlset>" + urls.map((u) => `<url><loc>https://example.test/${u}</loc></url>`).join("") + "</urlset>";

const base = {
  sitemapText: sitemap("article-one.html", "index.html"),
  llmsText: "- [One](https://example.test/article-one.html)",
  mdStems: ["article-one"],
  pages: {
    "index.html": '<a href="article-one.html">one</a>',
    "index.zh-CN.html": '<a href="article-one.html">一</a>',
    "article-one.html": "<main>body</main>",
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

test("the real repository passes the audit it is about to enforce", () => {
  const sitemapText = readFileSync("docs/sitemap.xml", "utf8");
  const llmsText = readFileSync("docs/llms.txt", "utf8");
  const names = readdirSync("docs").filter((f) => f.endsWith(".html"));
  const pages = Object.fromEntries(names.map((f) => [f, readFileSync("docs/" + f, "utf8")]));
  const mdStems = names.filter((f) => existsSync("docs/" + f.replace(/\.html$/, ".md"))).map((f) => f.replace(/\.html$/, ""));
  const problems = auditArticlePages({ sitemapText, llmsText, pages, mdStems });
  assert.deepEqual(problems, [], "registered article pages drifted: " + JSON.stringify(problems));
  assert.ok(mdStems.length >= 6, "expected the six evidence articles plus any other sourced page, got " + mdStems.length);
});
