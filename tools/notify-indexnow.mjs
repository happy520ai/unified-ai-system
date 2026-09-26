#!/usr/bin/env node
// Tell IndexNow-participating engines (Bing, Yandex, Seznam, and therefore DuckDuckGo's index)
// about the URLs our own Pages site publishes. Why this exists: the daily growth probe reads the
// index and found 8 of 14 published pages missing from it, including the two evidence pages the
// launch posts deep-link. A page nobody can search for only helps people who already arrived.
//
// The list is read from docs/sitemap.xml, not from an array in this file, so a newly published
// page is notified by the next run rather than by whoever remembers to edit a script.
//
// Ownership proof is fetched over HTTPS from the same URL the engine uses. If this script can
// read the key, the engine can verify the host - a local file read would prove nothing.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HOST = "happy520ai.github.io";
const BASE = `https://${HOST}/unified-ai-system`;
const KEY_URL = `${BASE}/indexnow-key.html`;
const SITEMAP = "docs/sitemap.xml";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export const parseSitemapUrls = (xml) =>
  [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.startsWith(`${BASE}/`));

export const pickKey = (text) => (text.match(/IndexNow key:\s*([0-9a-f]{32})/) || [])[1] ?? null;

const get = async (url, opts = {}) => {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30_000) });
  if (opts.consume !== false) await r.body?.cancel();
  return r;
};

export const run = async ({ dry = false, fetchImpl = null } = {}) => {
  const doFetch = fetchImpl ?? get;
  const xml = readFileSync(SITEMAP, "utf8");
  const urls = [...new Set(parseSitemapUrls(xml))];
  if (urls.length === 0) {
    return { status: "inconclusive", reason: `no ${BASE} URLs parsed out of ${SITEMAP}`, submitted: 0, total: 0 };
  }

  const served = await doFetch(KEY_URL, { consume: false });
  if (!served.ok) {
    return { status: "inconclusive", reason: `key URL returned ${served.status}`, submitted: 0, total: urls.length };
  }
  const key = pickKey(await served.text());
  if (!key) {
    return { status: "inconclusive", reason: "served key page contains no 32-hex key", submitted: 0, total: urls.length };
  }

  const checked = [];
  for (const url of urls) {
    const r = await doFetch(url);
    checked.push({ url, status: r.status });
  }
  // A 404 in the list would teach a crawler that this host submits dead links. Silence beats that.
  const live = checked.filter((c) => c.status === 200).map((c) => c.url);
  const dead = checked.filter((c) => c.status !== 200);
  if (live.length === 0) {
    return { status: "inconclusive", reason: "no sitemap URL returned 200", submitted: 0, total: urls.length, dead };
  }
  if (dry) {
    return { status: "dry-run", submitted: 0, live: live.length, total: urls.length, dead, keyFingerprint: `${key.slice(0, 4)}…${key.slice(-4)}` };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(40_000),
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key, keyLocation: KEY_URL, urlList: live }),
  });
  const body = await res.text();
  const accepted = res.status === 200 || res.status === 202;
  return {
    status: accepted ? "accepted" : "rejected",
    submitted: live.length,
    live: live.length,
    total: urls.length,
    dead,
    httpStatus: res.status,
    responseBody: body.slice(0, 160),
    keyFingerprint: `${key.slice(0, 4)}…${key.slice(-4)}`,
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = await run({ dry: process.argv.includes("--dry") });
  console.log(`=== indexnow notify ===`);
  console.log(`sitemap URLs: ${out.total} | live: ${out.live ?? 0} | key: ${out.keyFingerprint ?? "(unread)"}`);
  for (const d of out.dead ?? []) console.log(`  not-live ${d.url} -> ${d.status}`);
  console.log(`status=${out.status}${out.httpStatus ? ` http=${out.httpStatus}` : ""}${out.reason ? ` reason="${out.reason}"` : ""}${out.responseBody ? ` body="${out.responseBody}"` : ""}`);
  // Anything short of "accepted"/"dry-run" must be loud: a silently skipped notification looks
  // exactly like a working one in a log nobody re-reads.
  if (out.status === "rejected") process.exit(1);
  if (out.status === "inconclusive") process.exit(3);
}
