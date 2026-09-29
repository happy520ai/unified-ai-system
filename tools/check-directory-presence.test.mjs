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
  githubMcpVerdict,
  smitheryVerdict,
  smitherySearchIsFilter,
  parseSmitheryTotal,
  SMITHERY_CONTROL_SLUGS,
  SMITHERY_NONSENSE_QUERY,
  combineOursStatuses,
  GITHUB_MCP_CONTROL_ID,
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

test("the github.com/mcp leg claims absence only with both controls answering", () => {
  const cases = [
    [{ oursStatus: 404, controlStatus: 200, controlHits: 2 }, "NOT_FOUND"],
    [{ oursStatus: 200, controlStatus: 200, controlHits: 2 }, "LISTED"],
    [{ oursStatus: 404, controlStatus: 200, controlHits: 0 }, "UNDECIDABLE"],
    [{ oursStatus: 404, controlStatus: 404, controlHits: 2 }, "UNDECIDABLE"],
    [{ oursStatus: 403, controlStatus: 200, controlHits: 2 }, "UNDECIDABLE"],
    [{ oursStatus: 0, controlStatus: 200, controlHits: 2 }, "UNDECIDABLE"],
    [{ oursStatus: 301, controlStatus: 200, controlHits: 2 }, "UNDECIDABLE"],
  ];
  for (const [input, want] of cases) {
    const got = githubMcpVerdict(input);
    assert.equal(got.verdict, want, JSON.stringify(input));
    if (want === "NOT_FOUND") assert.match(got.why, /control page is 200/);
    if (input.controlHits === 0 && input.controlStatus === 200 && got.verdict === "UNDECIDABLE") {
      assert.match(got.why, /proves nothing/);
    }
    if (input.controlStatus !== 200 && got.verdict === "UNDECIDABLE") assert.match(got.why, /no positive control/);
    if ((input.oursStatus === 403 || input.oursStatus === 0) && got.verdict === "UNDECIDABLE") {
      assert.match(got.why, /unreadable/);
    }
  }
});

test("a blocked read of our own entry never becomes a confident absence", () => {
  // Paired with the arm above: this instrument exists because four "we are not listed" readings were
  // wrong, and three of them were a blocked or blind leg dressed as absence.
  for (const blocked of [401, 403, 429, 500, 0]) {
    const got = githubMcpVerdict({ oursStatus: blocked, controlStatus: 200, controlHits: 3 });
    assert.equal(got.verdict, "UNDECIDABLE", `status ${blocked} must not read as NOT_FOUND`);
    assert.match(got.why, /unreadable/);
  }
});

test("the github control id is the pinned registry name, not a rebuilt slug", () => {
  // Load-bearing: without a second server that demonstrably answers 200 at the same URL shape, our own
  // 404 is indistinguishable from a wrong slug.
  assert.equal(GITHUB_MCP_CONTROL_ID, "io.github.bytebase/dbhub");
});

test("one live URL shape is enough to read as listed; one blind leg is enough to refuse", () => {
  // Measured 2026-09-29: the directory answers 200 for BOTH `/mcp/bytebase/dbhub` and
  // `/mcp/io.github.bytebase/dbhub`, while both shapes of our own entry answer 404. Probing one shape
  // would let a path-format change masquerade as removal from the catalogue.
  assert.equal(combineOursStatuses(404, 404), 404);
  assert.equal(combineOursStatuses(200, 404), 200);
  assert.equal(combineOursStatuses(404, 200), 200);
  assert.equal(combineOursStatuses(0, 404), 0);
  assert.equal(combineOursStatuses(403, 404), 0);
  assert.equal(combineOursStatuses(404, 301), "404/301");
  assert.equal(githubMcpVerdict({ oursStatus: combineOursStatuses(404, 301), controlStatus: 200, controlHits: 1 }).verdict, "UNDECIDABLE");
});

// The Smithery leg. Its live calibration on 2026-09-29 was: our two exact routes 404, `github` and `brave`
// 200, and `?q=` returning 190/177/107/194 rows for four unrelated queries. The fixtures below are those
// readings, so an arm that passes here is an arm that would have read the world correctly that day.
const smSearchNotFiltering = { filtering: false, why: "the nonsense query returned 194 rows against 144 for a server that exists, so ?q= re-ranks a sample instead of filtering", controlTotal: 144, nonsenseTotal: 194, oursTotal: 190 };

test("smithery absence rests on the routes and says so when the search cannot be cited", () => {
  const absent = smitheryVerdict({ oursNamespace: 404, oursBare: 404, controlStatuses: [200, 200], search: smSearchNotFiltering });
  assert.equal(absent.verdict, "NOT_FOUND");
  assert.match(absent.why, /both exact routes 404/);
  assert.match(absent.why, /not citable/);
  // The claim must name the carrier of the negative: routes, not "Smithery has no record of you anywhere".
  assert.equal(/search (?:confirms|proves)/.test(absent.why), false, "a non-filtering search must never be quoted as evidence");

  const present = smitheryVerdict({ oursNamespace: 200, oursBare: 404, controlStatuses: [200, 200], search: smSearchNotFiltering });
  assert.equal(present.verdict, "LISTED");
  assert.match(present.why, /namespace leg 200/);
});

test("smithery refuses to call absence when its positive control is not answering", () => {
  const blocked = smitheryVerdict({ oursNamespace: 404, oursBare: 404, controlStatuses: [403, 200], search: smSearchNotFiltering });
  assert.equal(blocked.verdict, "UNDECIDABLE");
  assert.match(blocked.why, /control record\(s\) github did not answer 200/);

  const oursBlind = smitheryVerdict({ oursNamespace: 0, oursBare: 404, controlStatuses: [200, 200], search: smSearchNotFiltering });
  assert.equal(oursBlind.verdict, "UNDECIDABLE");
  assert.match(oursBlind.why, /our route leg is unreadable/);

  const oddShape = smitheryVerdict({ oursNamespace: 404, oursBare: 301, controlStatuses: [200, 200], search: smSearchNotFiltering });
  assert.equal(oddShape.verdict, "UNDECIDABLE", "a 301 on one shape is not a 404 on both");
});

test("a filtering search still cannot turn a non-zero row count into a clean absence sentence", () => {
  const filteringZero = { filtering: true, why: "the nonsense query returned 0 rows against 144 for a server that exists", controlTotal: 144, nonsenseTotal: 0, oursTotal: 0 };
  assert.match(smitheryVerdict({ oursNamespace: 404, oursBare: 404, controlStatuses: [200, 200], search: filteringZero }).why, /returned 0 rows for our slug/);
  const filteringNoise = { ...filteringZero, oursTotal: 5 };
  assert.match(smitheryVerdict({ oursNamespace: 404, oursBare: 404, controlStatuses: [200, 200], search: filteringNoise }).why, /not interpreted here/);
});

test("the filter test on ?q= is bidirectional, and an unparsed leg is not a refusal to filter", () => {
  assert.equal(smitherySearchIsFilter({ controlTotal: 144, nonsenseTotal: 194 }).filtering, false);
  assert.equal(smitherySearchIsFilter({ controlTotal: 107, nonsenseTotal: 190 }).filtering, false);
  assert.equal(smitherySearchIsFilter({ controlTotal: 144, nonsenseTotal: 0 }).filtering, true);
  assert.equal(smitherySearchIsFilter({ controlTotal: 144, nonsenseTotal: 20 }).filtering, true);
  // Boundary: "could not read" must not be folded into "does not filter", or a dead leg would silently
  // change which sentence the verdict is allowed to print.
  assert.equal(smitherySearchIsFilter({ controlTotal: null, nonsenseTotal: 194 }).filtering, null);
  assert.equal(smitherySearchIsFilter({ controlTotal: 144, nonsenseTotal: null }).filtering, null);
  assert.equal(SMITHERY_CONTROL_SLUGS.length, 2);
  assert.equal(smitherySearchIsFilter({ controlTotal: 144, nonsenseTotal: 144 }).filtering, false);
});

test("the totals parser only accepts what it was built for", () => {
  assert.equal(parseSmitheryTotal('{"servers":[],"pagination":{"currentPage":1,"totalCount":17677}}'), 17677);
  assert.equal(parseSmitheryTotal('{"servers":[]}'), null);
  assert.equal(parseSmitheryTotal("<html>502 gateway</html>"), null);
  assert.equal(parseSmitheryTotal('{"pagination":{"totalCount":-3}}'), null);
  assert.equal(parseSmitheryTotal('{"pagination":{"totalCount":1.5}}'), null);
  // The nonsense token must stay nonsense: if it ever becomes a substring of a real slug the control is gone.
  assert.equal(SMITHERY_NONSENSE_QUERY.includes("unified"), false);
});
