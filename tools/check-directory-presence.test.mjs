// Bidirectional anchors for the directory-presence probe: every arm that must say "absent" is
// paired with one that must say "cannot tell", because the failure this instrument exists to stop
// is a blind probe printing a confident NOT_FOUND.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyIndex,
  decide,
  isBlocked,
  matchOurs,
  slugUrls,
} from "./check-directory-presence.mjs";

const ID = { slug: "unified-ai-system", handle: "happy520ai" };

test("blocked statuses are those a bot filter, not an absence, produces", () => {
  assert.equal(isBlocked(403), true);
  assert.equal(isBlocked(429), true);
  assert.equal(isBlocked(0), true);
  assert.equal(isBlocked(503), true);
  assert.equal(isBlocked(200), false);
  assert.equal(isBlocked(404), false);
});

test("a loc ending in .xml is a child map, and a page named sitemap-mcp is not", () => {
  const index = [
    "<sitemapindex>",
    "<sitemap><loc>https://e/x/sitemaps/servers/6.xml</loc></sitemap>",
    "<sitemap><loc>https://e/x/sitemap-index.xml?pg=2</loc></sitemap>",
    "</sitemapindex>",
  ].join("");
  assert.deepEqual(classifyIndex(index).children, [
    "https://e/x/sitemaps/servers/6.xml",
    "https://e/x/sitemap-index.xml?pg=2",
  ]);
  // The exact shape that made the loose matcher fetch HTML pages as if they were sitemaps.
  const pages = [
    "<urlset>",
    "<url><loc>https://e/servers/someone/sitemap-mcp-server</loc></url>",
    "<url><loc>https://e/servers/other/sitemapkit-mcp</loc></url>",
    "</urlset>",
  ].join("");
  const shape = classifyIndex(pages);
  assert.equal(shape.kind, "pages");
  assert.equal(shape.children.length, 0);
  assert.equal(shape.pages.length, 2);
});

test("only a url carrying our handle, or a bare server path, counts as ours", () => {
  assert.equal(
    matchOurs(["https://d/servers/happy520ai/unified-ai-system"], ID),
    "https://d/servers/happy520ai/unified-ai-system",
  );
  assert.equal(matchOurs(["https://d/server/unified-ai-system"], ID), "https://d/server/unified-ai-system");
  assert.equal(matchOurs(["https://d/servers/someone-else/unified-ai-system"], ID), null);
  assert.equal(matchOurs(["https://d/servers/happy520ai/other-tool"], ID), null);
});

test("the slug alone matches other listings too, which is why it cannot be the evidence", () => {
  const body = [
    "<loc>https://d/servers/alpha/unified-ai-gateway</loc>",
    "<loc>https://d/servers/beta/unified-ai-system-legacy</loc>",
  ].join("");
  const hits = slugUrls(body, ID.slug);
  assert.equal(hits.length, 1);
  assert.equal(matchOurs(hits, ID), null);
});

test("NOT_FOUND needs a corpus; a thin or empty read is reported as undecidable", () => {
  const blind = decide({ childrenRead: 0, urlsSeen: 0, matched: null, genericOnly: 0 });
  assert.equal(blind.verdict, "UNDECIDABLE");
  assert.match(blind.why, /blind/);

  const thin = decide({ childrenRead: 3, urlsSeen: 19, matched: null, genericOnly: 0 });
  assert.equal(thin.verdict, "UNDECIDABLE");
  assert.match(thin.why, /too small/);

  // Boundary arm on the other side: one more url and absence becomes a claim worth acting on.
  const broad = decide({ childrenRead: 3, urlsSeen: 20, matched: null, genericOnly: 0 });
  assert.equal(broad.verdict, "NOT_FOUND");
  assert.match(broad.why, /20 url/);
});

test("a present entry wins over every absence guard", () => {
  const listed = decide({
    childrenRead: 1,
    urlsSeen: 0,
    matched: "https://d/servers/happy520ai/unified-ai-system",
    genericOnly: 4,
  });
  assert.equal(listed.verdict, "LISTED");
});

test("matching the word without matching us is not absence either", () => {
  const crowded = decide({ childrenRead: 4, urlsSeen: 900, matched: null, genericOnly: 2 });
  assert.equal(crowded.verdict, "UNDECIDABLE");
  assert.match(crowded.why, /other listings/);
});
