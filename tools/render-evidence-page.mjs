// Renders a docs/*.md evidence file into the site's HTML shell.
//
// The site ships docs/.nojekyll, so a *.md URL is served as raw text/markdown. Six
// evidence articles were declared in sitemap.xml and indexnow.json as *.md, which
// asked crawlers to index an unstyled text file with no title and no description.
// This turns each one into a real page while leaving the markdown as the source.
//
// Scope is exactly the markdown those six files use: ATX headings, fenced code,
// pipe tables, lists with one nesting level, paragraphs, links, bold, italic and
// code spans. Anything outside that set is refused rather than quietly dropped.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const IN = resolve(arg("--in", ""));
const OUT = resolve(arg("--out", ""));
const ROOT = "https://happy520ai.github.io/unified-ai-system/";
const SITE = "https://github.com/happy520ai/unified-ai-system";
if (!IN || !OUT) throw new Error("usage: --in docs/x.md --out docs/x.html");

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Code spans are protected first so their contents can never be read as markup.
function inline(md) {
  const codes = [];
  const text = md.replace(/`([^`\n]+)`/g, (_m, c) => {
    codes.push(c);
    return "@@CODE" + (codes.length - 1) + "@@";
  });
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    const rel = /^https?:/.test(href) || href.startsWith("/") || href.startsWith("#");
    return '<a href="' + (rel ? href : ROOT + href.replace(/^\.?\//, "")) + '">' + label + "</a>";
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  return out.replace(/@@CODE(\d+)@@/g, (_m, i) => "<code>" + escapeHtml(codes[Number(i)]) + "</code>");
}

// Block-level parse. Returns the body HTML plus the H1 text and the first plain
// paragraph, which the shell needs for title and description.
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const body = [];
  const paragraphs = [];
  let h1 = null;
  let i = 0;
  const bump = () => {
    i += 1;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      bump();
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        bump();
      }
      if (i >= lines.length) throw new Error("unterminated code fence");
      bump();
      body.push(
        "<pre" + (lang ? ' class="language-' + escapeHtml(lang) + '"' : "") + "><code>" +
          escapeHtml(buf.join("\n")) + "</code></pre>",
      );
      continue;
    }
    const head = line.match(/^(#{1,4}) (.*)$/);
    if (head) {
      const level = head[1].length;
      if (level > 4) throw new Error("heading deeper than h4: " + line);
      const text = inline(head[2]);
      if (level === 1) {
        if (h1 !== null) throw new Error("more than one h1 in " + basename(IN));
        h1 = head[2];
      }
      body.push("<h" + level + ">" + text + "</h" + level + ">");
      bump();
      continue;
    }
    if (/^\s*\|.+\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.+\|\s*$/.test(lines[i])) {
        rows.push(lines[i].trim());
        bump();
      }
      if (rows.length < 2) throw new Error("table without a separator row");
      const cells = (r) => r.slice(1, -1).split(/(?<!\\)\|/).map((c) => inline(c.trim()));
      const isSep = (r) => /^\|[\s:|-]+\|$/.test(r);
      let out = "<table>";
      const header = cells(rows[0]);
      out += "<thead><tr>" + header.map((c) => "<th>" + c + "</th>").join("") + "</tr></thead>";
      const rest = rows.slice(1).filter((r) => !isSep(r));
      out += "<tbody>" + rest.map((r) => "<tr>" + cells(r).map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody>";
      body.push(out + "</table>");
      continue;
    }
    const isItem = (l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l);
    if (isItem(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      // The entering line always matches, so this loop consumes at least one line.
      while (i < lines.length && isItem(lines[i])) {
        const indent = (/^\s*/.exec(lines[i]) || [""])[0].length;
        const text = lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, "");
        if (indent >= 2 && items.length) items[items.length - 1].subs.push(text);
        else items.push({ text, subs: [] });
        bump();
      }
      const li = (it) =>
        "<li>" +
        inline(it.text) +
        (it.subs.length ? "<ul>" + it.subs.map((s) => "<li>" + inline(s) + "</li>").join("") + "</ul>" : "") +
        "</li>";
      body.push((ordered ? "<ol>" : "<ul>") + items.map(li).join("") + (ordered ? "</ol>" : "</ul>"));
      continue;
    }
    if (/^\s*$/.test(line)) {
      bump();
      continue;
    }
    const para = [];
    const stops = (l) => /^\s*$/.test(l) || /^#{1,4} /.test(l) || /^```/.test(l) || isItem(l);
    while (i < lines.length && !stops(lines[i])) {
      para.push(lines[i]);
      bump();
    }
    // A line that no branch claimed (a stray pipe, an h5) still has to be consumed,
    // or the loop would re-read it forever.
    if (!para.length) {
      para.push(lines[i]);
      bump();
    }
    const html = inline(para.join(" "));
    body.push("<p>" + html + "</p>");
    paragraphs.push(para.join(" "));
  }
  if (h1 === null) throw new Error("no h1 in " + basename(IN));
  return { html: body.join("\n    "), h1, paragraphs };
}

// A search snippet built from the first paragraph turned out to be a provenance line on
// every one of the six articles ("Run: ... · Sample: 40 servers", "Measured 2026-09-27 by
// tools/..."), which tells a reader how we worked and nothing about what we found. The
// summary is therefore the first block that actually states something.
// Tested against plainText() output, so the markers appear without their markdown
// emphasis - matching the raw "**Run:**" form would let the provenance line through.
const PROVENANCE = /^(Run|Sample|Measured|Window|Reproduce)\b[: ]|^(Sample taken|Measured |Reproduce\b|This page is generated)/;

function plainText(md) {
  return md
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickSummary(paragraphs) {
  const candidates = paragraphs
    .map(plainText)
    .filter((t) => t.length >= 80 && !PROVENANCE.test(t));
  const chosen = candidates[0] || plainText(paragraphs[0] || "");
  if (chosen.length <= 160) return chosen;
  const cut = chosen.slice(0, 157);
  return cut.slice(0, cut.lastIndexOf(" ")) + "...";
}

export { inline, escapeHtml, renderMarkdown };

// The page shell. Canonical and og:url are derived from the output name so a page
// cannot describe a different URL than the one it is served at.
// Dates come from git, never from a typed value, and they are converted to UTC explicitly:
// on this machine `git log --date=short` prints the local offset, so a date-only reading is
// off by a day half the time. %cI is absolute; the offset is then normalised here.
// An unknown date is omitted rather than invented - a published date is a claim about when
// something was released, and a renderer has no business guessing it.
function gitDate(path, mode) {
  const args = ["log", "--format=%cI", "-1"];
  // Option order matters: `git --diff-filter=A log` is not a thing. It has to follow `log`.
  if (mode === "first") args.splice(1, 0, "--diff-filter=A");
  args.push("--", path);
  let raw = "";
  try {
    raw = execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
  if (!raw) return null;
  return new Date(raw).toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Pure so the selection rule is testable without a repository: both inputs are either an ISO string from
// git or null, and a date nobody can source stays absent rather than becoming "now".
export function pickModified({ mdDate, htmlDate }) {
  if (!mdDate) return htmlDate || null;
  if (!htmlDate) return mdDate;
  return mdDate > htmlDate ? mdDate : htmlDate;
}

function jsonLd({ title, description, slug, image, url }) {
  const object = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    // The H1 carries markdown (`tools/list` in a heading), which is not what a crawler wants
    // in headline, so both fields go through the same plain-text path the description uses.
    headline: plainText(title),
    description,
  };
  const sourcePath = "docs/" + slug.replace(/\.html$/, ".md");
  const published = gitDate(sourcePath, "first");
  // Whichever of the two moved later is when the served content last changed. Reading only the rendered
  // page's own history made dateModified lag by exactly one render cycle: at render time the artifact's
  // newest commit is still the previous render, so the date could never describe the change in hand.
  const modified = pickModified({ mdDate: gitDate(sourcePath, "last"), htmlDate: gitDate("docs/" + slug, "last") });
  if (published) object.datePublished = published;
  if (modified) object.dateModified = modified;
  Object.assign(object, {
    author: { "@type": "Organization", name: "Unified AI System", url: SITE },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image,
    isAccessibleForFree: true,
  });
  // Escaping < keeps a title containing "</script>" from ending the element early.
  const body = JSON.stringify(object, null, 2).replace(/</g, "\\u003c");
  return '<script type="application/ld+json">\n' + body + "\n    </script>";
}

function shell({ title, description, slug, lang, body, twin }) {
  const url = ROOT + slug;
  const alt = twin
    ? [
        '<link rel="alternate" hreflang="' + lang + '" href="' + url + '" />',
        '<link rel="alternate" hreflang="' + (lang === "en" ? "zh-CN" : "en") + '" href="' + ROOT + twin + '" />',
        '<link rel="alternate" hreflang="x-default" href="' + url + '" />',
      ].join("\n      ")
    : '<link rel="alternate" hreflang="' + lang + '" href="' + url + '" />';
  return `<!doctype html>
<!-- generated by tools/render-evidence-page.mjs from docs/${slug.replace(/\.html$/, ".md")}; regenerate with pnpm docs:articles -->
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Unified AI System</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#081011" />
    <link rel="canonical" href="${url}" />
      ${alt}
    <link rel="sitemap" type="application/xml" href="sitemap.xml" />
    <link rel="alternate" type="text/plain" href="llms.txt" title="LLM-readable project summary" />
    <link rel="icon" type="image/png" href="assets/mcp-icon.png" />
    <link rel="stylesheet" href="site.css" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${ROOT}assets/social-preview.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${ROOT}assets/social-preview.png" />
      ${jsonLd({ title, description, slug, image: ROOT + "assets/social-preview.png", url })}
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="index.html">Unified AI System</a>
      <nav aria-label="Primary">
        <a href="mcp-ecosystem-measurements.html">MCP measurements</a>
        <a href="${SITE}">Repository</a>
      </nav>
    </header>
    <main class="article">
      <nav class="article-source" aria-label="Source">
        Measured and written in the open: this page is generated from
        <a href="${SITE}/blob/master/docs/${slug.replace(/\.html$/, ".md")}">${slug.replace(/\.html$/, ".md")}</a>.
      </nav>
      ${body}
    </main>
    <footer class="site-footer">
      <p>
        Apache-2.0 · self-hosted · the numbers on this page are reproducible with one command
        from the <a href="${SITE}">repository</a>.
      </p>
    </footer>
  </body>
</html>
`;
}

function main() {
  const markdown = readFileSync(IN, "utf8");
  const { html, h1, paragraphs } = renderMarkdown(markdown);
  // The slug comes from the input name, never from the output path: a page must not
  // describe a different URL than the one it is served at, and a scratch render to a
  // temporary filename still has to carry its real canonical.
  const slug = basename(IN).replace(/\.md$/, "") + ".html";
  if (!basename(OUT).endsWith(slug)) {
    throw new Error("output name must end with " + slug + ", got " + basename(OUT));
  }
  const description = pickSummary(paragraphs) || h1;
  const twin = arg("--twin", "");
  writeFileSync(OUT, shell({ title: h1, description, slug, lang: arg("--lang", "en"), body: html, twin }));
  console.log(
    "rendered " + basename(IN) + " -> " + slug + " (" + h1.length + " char title, " + description.length + " char description)",
  );
}

// The test imports the pure functions; writing files only happens when this is run
// as a command, otherwise a syntax error in a doc would surface as a broken import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
