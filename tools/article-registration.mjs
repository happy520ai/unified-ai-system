// Pure audit: is every evidence article registered on all the surfaces it needs?
//
// An article page in this repository is a docs/*.html that is declared in sitemap.xml
// and has a same-stem docs/*.md source. That class is generated from measurement
// artifacts, so it is the part of the site a reader is sent to from posts and issues.
//
// The failure this exists to prevent already happened: six articles were declared to
// crawlers as raw markdown, three of them had no link inside our own domain at all, and
// llms.txt listed 3 of 6. Nothing caught any of that, because nothing compared the sets.
//
// Kept pure (no fs, no process) so a fixture can prove each arm fails.

const SITEMAP_LOC = /<loc>([^<]+)<\/loc>/g;

function pageName(url) {
  return url.split("/").pop();
}

function inboundLinks(pages, name) {
  const needle = '"' + name + '"';
  const singles = "'" + name + "'";
  return Object.entries(pages)
    .filter(([other, text]) => other !== name && (text.includes(needle) || text.includes(singles)))
    .map(([other]) => other);
}

export function auditArticlePages({ sitemapText, llmsText, pages, mdStems, feedText, siteHost = "happy520ai.github.io" }) {
  const problems = [];
  const declared = [...sitemapText.matchAll(SITEMAP_LOC)]
    .map((m) => pageName(m[1]))
    .filter((name) => name.endsWith(".html"));

  // The feed is generated from the sitemap by tools/render-site-feed.mjs, which nothing
  // runs: no script, no workflow. It was two days stale and held none of the measurement
  // articles, which is the same failure as an undeclared page - the fresh content is the
  // part a subscriber never sees. Compared as sets in both directions, so it cannot rot
  // quietly again. feedText is optional so a caller can audit links alone.
  if (feedText !== undefined) {
    const siteUrls = [...sitemapText.matchAll(SITEMAP_LOC)].map((m) => m[1]).filter((u) => !u.endsWith("/feed.xml"));
    const feedIds = [...feedText.matchAll(/<(?:id|url|href)>([^<]+)<\/(?:id|url|href)>/g)]
      .map((m) => m[1].trim())
      .filter((u) => u.startsWith("http"));
    for (const url of siteUrls) {
      const bare = url.replace(/\/$/, "");
      if (!feedIds.some((f) => f.replace(/\/$/, "") === bare)) {
        problems.push({ code: "sitemap_page_absent_from_feed", page: pageName(url) || "site root", detail: url + " is declared in sitemap.xml but has no feed entry - run: node tools/render-site-feed.mjs" });
      }
    }
    for (const feedUrl of feedIds) {
      const bare = feedUrl.replace(/\/$/, "");
      if (bare.endsWith(".xml") || bare.endsWith(".txt") || bare.endsWith(".json")) continue; // the feed's own and the hub's self links
      if (!siteUrls.some((u) => u.replace(/\/$/, "") === bare)) {
        problems.push({ code: "feed_entry_not_declared", page: pageName(feedUrl), detail: feedUrl + " appears in the feed but is not in sitemap.xml" });
      }
    }
  }

  for (const name of declared) {
    const stem = name.replace(/\.html$/, "");
    if (!mdStems.includes(stem)) continue; // not an article page; landing pages have no source

    const from = inboundLinks(pages, name);
    const fromEnglish = from.filter((p) => !p.includes(".zh-CN."));
    const fromChinese = from.filter((p) => p.includes(".zh-CN."));

    if (from.length === 0) {
      problems.push({ code: "article_page_unreachable", page: name, detail: "declared in sitemap.xml, linked from no page in docs/" });
    }
    if (from.length > 0 && fromEnglish.length === 0) {
      problems.push({ code: "article_page_missing_english_navigation", page: name, detail: "only reachable from " + from.join(", ") });
    }
    if (from.length > 0 && fromChinese.length === 0) {
      problems.push({ code: "article_page_missing_chinese_navigation", page: name, detail: "no link to it from any .zh-CN. page, so the Chinese index cannot send a reader here" });
    }

    // Structured data is what makes an article eligible for a rich result, and it is the one
    // thing a page can lose silently: hand-edit the head, regenerate from an older template,
    // and the page still looks perfect to a reader. Required per declared article page,
    // checked by parsing rather than by grepping for the tag.
    const ld = (pages[name] || "").match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!ld) {
      problems.push({ code: "article_page_missing_jsonld", page: name, detail: "no TechArticle block; run: pnpm docs:articles" });
    } else {
      let parsed = null;
      try {
        parsed = JSON.parse(ld[1]);
      } catch {
        problems.push({ code: "article_page_jsonld_unparseable", page: name, detail: "the ld+json block is not valid JSON" });
      }
      if (parsed) {
        const required = ["headline", "description", "datePublished", "dateModified", "author", "mainEntityOfPage"];
        const missing = required.filter((k) => !parsed[k]);
        if (missing.length) {
          problems.push({ code: "article_page_jsonld_incomplete", page: name, detail: "missing " + missing.join(",") });
        }
        const canonical = parsed.mainEntityOfPage && parsed.mainEntityOfPage["@id"];
        if (canonical && !canonical.endsWith("/" + name)) {
          problems.push({ code: "article_page_jsonld_wrong_url", page: name, detail: "mainEntityOfPage says " + canonical });
        }
      }
    }

    // Being reachable from llms.txt counts either as the page itself or as the markdown
    // source on github.com/blob, which GitHub renders for a reader. A raw *.md link on our
    // own host is the other case: Pages has no Jekyll (docs/.nojekyll), so that URL answers
    // text/markdown. Only that second one is the defect this arm is about.
    const blobSource = "github.com/" + "happy520ai/unified-ai-system/blob/master/docs/" + stem + ".md";
    if (!llmsText.includes(name) && !llmsText.includes(blobSource)) {
      problems.push({ code: "article_page_absent_from_llms", page: name, detail: "assistants reading llms.txt never see this article" });
    }
    const rawOnOurHost = new RegExp(
      "https?://[^/)\\s]*" + siteHost.replace(/[.]/g, "\\.") + "[^)\\s]*/" + stem.replace(/[.]/g, "\\.") + "\\.md",
    );
    if (rawOnOurHost.test(llmsText)) {
      problems.push({ code: "llms_links_markdown_instead_of_page", page: name, detail: "llms.txt points at " + stem + ".md on our own host, which GitHub Pages serves as raw text/markdown" });
    }
  }
  return problems;
}
