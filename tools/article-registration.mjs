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

export function auditArticlePages({ sitemapText, llmsText, pages, mdStems, siteHost = "happy520ai.github.io" }) {
  const problems = [];
  const declared = [...sitemapText.matchAll(SITEMAP_LOC)]
    .map((m) => pageName(m[1]))
    .filter((name) => name.endsWith(".html"));

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
