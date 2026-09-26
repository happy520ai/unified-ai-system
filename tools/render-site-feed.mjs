// Generate docs/feed.xml (Atom) from the pages that are actually published, and
// take each entry's date from git rather than from a hand-typed list.
//
// Sources of truth: sitemap.xml for which URLs exist, the HTML files themselves
// for <title>/<meta description>, and `git log -1 --format=%cI` for when a page
// last changed. Nothing here is a value someone remembered.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SITE = "https://happy520ai.github.io/unified-ai-system";
const TODAY = new Date().toISOString();

const sitemap = readFileSync("docs/sitemap.xml", "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.log("REFUSED: no URLs in sitemap");
  process.exit(1);
}
// The feed must not list itself.
const pages = urls.filter((u) => !u.endsWith("/feed.xml"));

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pick = (html, re, label) => {
  const m = html.match(re);
  if (!m) {
    console.log(`REFUSED: ${label} missing`);
    process.exit(1);
  }
  return m[1].trim();
};

const entries = [];
for (const url of pages) {
  const slug = url.slice(`${SITE}/`.length) || "index.html";
  const file = `docs/${slug}`;
  if (!existsSync(file)) {
    console.log(`REFUSED: sitemap lists ${file} but it is not in the tree`);
    process.exit(1);
  }
  const html = readFileSync(file, "utf8");
  const title = pick(html, /<title>([^<]+)<\/title>/, `${slug} <title>`);
  const desc = pick(
    html.replace(/\s+/g, " "),
    /<meta\s+name="description"\s+content="([^"]+)"/,
    `${slug} description`,
  );
  let updated;
  try {
    updated = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], { encoding: "utf8" }).trim();
  } catch {
    updated = "";
  }
  if (!updated) {
    console.log(`REFUSED: no git date for ${file}`);
    process.exit(1);
  }
  entries.push({ url, slug, title: title.split(" | ")[0], fullTitle: title, desc, updated });
}

entries.sort((a, b) => (a.updated < b.updated ? 1 : -1));

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${SITE}/</id>
  <title>${esc("Unified AI System")} - self-hosted AI gateway and agent control plane</title>
  <subtitle>${esc("Every claim in these pages is reproducible: measured tool rosters, credential-free runs, and verbatim quotations from the projects compared.")}</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE}/feed.xml"/>
  <link rel="alternate" type="text/html" href="${SITE}/"/>
  <updated>${TODAY}</updated>
  <rights>Apache-2.0, Unified AI System contributors</rights>
${entries
  .map(
    (e) => `  <entry>
    <id>${e.url}</id>
    <title type="html">${esc(e.title)}</title>
    <link rel="alternate" type="text/html" href="${e.url}"/>
    <updated>${e.updated}</updated>
    <summary type="html">${esc(e.desc)}</summary>
    <category term="${esc(e.slug.endsWith(".html") ? e.slug.replace(/\.html$/, "") : e.slug)}"/>
  </entry>`,
  )
  .join("\n")}
</feed>
`;

writeFileSync("docs/feed.xml", feed);
console.log(`OK docs/feed.xml: ${entries.length} entries (sitemap had ${pages.length} after excluding the feed itself)`);
for (const e of entries.slice(0, 5)) console.log(`  ${e.updated.slice(0, 10)}  ${e.slug}`);
console.log("  ...");
