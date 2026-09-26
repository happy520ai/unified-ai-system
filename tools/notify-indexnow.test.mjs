// Offline tests for the IndexNow notify tool. Nothing here touches the network: run() takes a
// fetch implementation, which is the only honest way to test "what happens when the key page is
// a 404" without taking down a third-party endpoint.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseSitemapUrls, pickKey, run } from "./notify-indexnow.mjs";

const BASE = "https://happy520ai.github.io/unified-ai-system";

test("the real sitemap yields real URLs on our host, and nothing off-host", () => {
  const xml = readFileSync("docs/sitemap.xml", "utf8");
  const urls = parseSitemapUrls(xml);
  assert.ok(urls.length >= 10, `expected the published sitemap to carry pages, got ${urls.length}`);
  assert.ok(urls.every((u) => u.startsWith(`${BASE}/`)), "every URL must be on our own host");
  assert.ok(urls.some((u) => u.includes("verify-mcp-docker-image.html")), "the deep-linked evidence page must be in the set");
});

test("a sitemap with foreign hosts contributes no URLs to submit", () => {
  const urls = parseSitemapUrls("<urlset><url><loc>https://someone-else.example/page.html</loc></url></urlset>");
  assert.deepEqual(urls, []);
});

test("the key is only accepted in the exact shape engines fetch for", () => {
  assert.equal(pickKey("IndexNow key verification\n\nIndexNow key: 907b4e3774017b134dd67f82de5f1366\n"), "907b4e3774017b134dd67f82de5f1366");
  assert.equal(pickKey("IndexNow key: 907B4E3774017B134DD67F82DE5F1366"), null, "uppercase is not the published shape");
  assert.equal(pickKey("IndexNow key: 907b"), null);
  assert.equal(pickKey("<html></html>"), null);
});

const fakeFetch = ({ keyStatus = 200, keyBody = "IndexNow key: 907b4e3774017b134dd67f82de5f1366", pageStatus = 200 }) =>
  async (url) => {
    if (url.endsWith("indexnow-key.html")) {
      return { ok: keyStatus === 200, status: keyStatus, text: async () => keyBody };
    }
    return { ok: pageStatus === 200, status: pageStatus };
  };

test("dry-run counts live URLs and never posts", async () => {
  const out = await run({ dry: true, fetchImpl: fakeFetch({}) });
  assert.equal(out.status, "dry-run");
  assert.equal(out.submitted, 0);
  assert.ok(out.live >= 10, `expected live pages from the real sitemap, got ${out.live}`);
  assert.equal(out.keyFingerprint, "907b…1366");
});

test("an unreadable key page is inconclusive, never a silent success", async () => {
  const missing = await run({ fetchImpl: fakeFetch({ keyStatus: 404 }) });
  assert.equal(missing.status, "inconclusive");
  assert.match(missing.reason, /404/);
  assert.equal(missing.submitted, 0);

  const garbled = await run({ fetchImpl: fakeFetch({ keyBody: "placeholder page, no key here" }) });
  assert.equal(garbled.status, "inconclusive");
  assert.match(garbled.reason, /no 32-hex key/);
});

test("a dead page is named and excluded instead of poisoning the submission", async () => {
  let seen = null;
  const out = await run({
    dry: true,
    fetchImpl: async (url) => {
      if (url.endsWith("indexnow-key.html")) return { ok: true, status: 200, text: async () => "IndexNow key: 907b4e3774017b134dd67f82de5f1366" };
      const isTarget = url.includes("verify-mcp-docker-image.html");
      return { ok: !isTarget, status: isTarget ? 404 : 200 };
    },
  });
  seen = out.dead;
  assert.equal(seen.length, 1, `exactly one page was made dead, got ${seen?.length}`);
  assert.match(seen[0].url, /verify-mcp-docker-image\.html$/);
  assert.equal(seen[0].status, 404);
  assert.ok(out.live < out.total, "the live count must drop below the sitemap count");
});
