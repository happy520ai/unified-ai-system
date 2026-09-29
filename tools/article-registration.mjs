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
  // The reference must be the whole path segment, so it can arrive as href="page.html",
  // href="/unified-ai-system/page.html" or href="https://host/unified-ai-system/page.html".
  // Matching only '"name"' saw the first two and missed every absolute URL, which made several
  // pages look unreachable from the other language when their twin link was in fact present.
  const pattern = new RegExp("[\"'/]" + name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "[\"']" , "u");
  return Object.entries(pages)
    .filter(([other, text]) => other !== name && pattern.test(text))
    .map(([other]) => other);
}

// Head-declared language alternates keyed by hreflang value. Scoped to <link> tags deliberately: a page's
// body carries inline <a hreflang="zh-CN"> links to its twin, and counting those would make a correct head look
// like it declared the pair twice.
function hreflangLinks(html) {
  const out = {};
  for (const m of (html || "").matchAll(/<link\b[^>]*>/gu)) {
    const tag = m[0].replace(/\s+/gu, " ");
    if (!/rel="alternate"/u.test(tag) || !/hreflang="/u.test(tag)) continue;
    const href = /href="([^"]+)"/u.exec(tag);
    if (href) out[/hreflang="([^"]+)"/u.exec(tag)[1]] = href[1];
  }
  return out;
}

// Judged by file name, not URL, so the rule does not depend on the host or the site base path. The bare site
// root counts as index.html because that is the address sitemap.xml declares for it.
function namesFile(href, file) {
  if (!href) return false;
  const clean = href.replace(/\/+$/u, "");
  if (file === "index.html" && !clean.endsWith(".html")) return true;
  return clean.endsWith("/" + file);
}

function hreflangPairProblems(enFile, zhFile, enLinks, zhLinks) {
  const out = [];
  for (const [lang, want] of [["en", enFile], ["zh-CN", zhFile]]) {
    if (!enLinks[lang]) out.push(`english page declares no hreflang="${lang}"`);
    else if (!namesFile(enLinks[lang], want)) out.push(`english hreflang="${lang}" points at ${enLinks[lang]}`);
    if (!zhLinks[lang]) out.push(`chinese page declares no hreflang="${lang}"`);
    else if (!namesFile(zhLinks[lang], want)) out.push(`chinese hreflang="${lang}" points at ${zhLinks[lang]}`);
  }
  if (!enLinks["x-default"]) out.push("english page declares no x-default");
  if (enLinks["x-default"] !== zhLinks["x-default"]) out.push("the two pages disagree about x-default");
  return out;
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
        // Which keys are required depends on what the block claims to be. The list this replaced assumed
        // TechArticle for everything, so two HowTo pages were reported as "missing headline,author,
        // mainEntityOfPage" while carrying exactly the keys a HowTo needs - and an unnamed type still gets
        // the one key every schema.org page should have.
        const REQUIRED_BY_TYPE = {
          TechArticle: ["headline", "description", "datePublished", "dateModified", "author", "mainEntityOfPage"],
          HowTo: ["name", "description", "totalTime", "step"],
          Dataset: ["name", "description", "distribution"],
          CollectionPage: ["name", "description", "mainEntity"],
          SoftwareApplication: ["name", "description"],
        };
        const type = String(parsed["@type"] || "");
        const required = REQUIRED_BY_TYPE[type] || ["description"];
        const missing = required.filter((k) => !parsed[k]);
        if (missing.length) {
          problems.push({ code: "article_page_jsonld_incomplete", page: name, detail: type + " missing " + missing.join(",") });
        }
        // A date-only value is legal schema.org but worthless as a freshness signal, and it is exactly what
        // a hand-authored page drifts into: docs/prompt-enhancement.html advertised 2026-08-09 while the
        // committed page had last changed on 2026-09-28. The arm above asked whether the keys existed; none
        // of them asked what the value said. Generated pages always emit full UTC, so this is a statement
        // about our own pipeline, not about what schema.org tolerates.
        const UTC_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
        for (const key of ["datePublished", "dateModified"]) {
          if (parsed[key] && !UTC_DATE.test(String(parsed[key]))) {
            problems.push({
              code: "article_page_jsonld_date_not_utc",
              page: name,
              detail: key + " says " + parsed[key] + "; run: node tools/inject-jsonld-dates.mjs docs/" + name,
            });
          }
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
  // A language pair has to be annotated in both directions or a crawler may discard the whole set. Two real
  // shapes reached this repo: the English measurement hub declared no hreflang at all while its Chinese twin
  // pointed back at it (so the annotation the Chinese page paid for was wasted), and one Chinese page declared
  // hreflang="en" pointing at *itself*, which tells a crawler the Chinese page is the English one - worse than
  // saying nothing. Compared over whatever corpus the caller passes, so a page without a twin is never judged.
  for (const enFile of Object.keys(pages).sort()) {
    if (!enFile.endsWith(".html") || enFile.endsWith(".zh-CN.html")) continue;
    const zhFile = enFile.replace(/\.html$/u, ".zh-CN.html");
    if (!(zhFile in pages)) continue;
    const enLinks = hreflangLinks(pages[enFile]);
    const zhLinks = hreflangLinks(pages[zhFile]);
    // The obligation comes from a declaration, not from a twin file existing. A pair that annotates nothing is
    // not making a claim a crawler could act on; a pair where one side annotates is claiming a relationship and
    // the other side denying it, which is the shape that gets the whole set discarded.
    if (Object.keys(enLinks).length === 0 && Object.keys(zhLinks).length === 0) continue;
    for (const detail of hreflangPairProblems(enFile, zhFile, enLinks, zhLinks)) {
      problems.push({ code: "hreflang_pair_inconsistent", page: enFile, detail });
    }
  }
  return problems;
}
