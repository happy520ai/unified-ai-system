// Decide whether a directory already lists us, using only the probes that can actually answer.
//
// Why this exists: on 2026-09-27 four separate readings of "we are not on <site>" were wrong, and
// each was wrong for a different reason - a 403 that was a bot block rather than an absence, a
// guessed slug shape that 404'd for the wrong cause, a first sitemap child that genuinely did not
// contain the page while a later one did, and a generic-word match that hit dozens of other
// servers' slugs. A fifth reason appeared while writing this script: the first version shelled out
// to curl with `-o /dev/stdout`, which under Git Bash hands back an empty body, so it read nothing
// and still printed NOT_FOUND for a site that does list us. Absence and blindness must not share a
// sentence, so `decide()` refuses to emit NOT_FOUND unless it first saw a real listing corpus.
//
// Calibration (2026-09-27, known truth): mcpservers.org and mcpmarket.com both list us. If this
// script says otherwise about either, the script is wrong, not the world.
//
// Usage: node tools/check-directory-presence.mjs [--slug unified-ai-system] [--handle happy520ai] [--github-mcp] [--smithery] <site>...
import { pathToFileURL } from "node:url";

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TIMEOUT_MS = 40000;

// A blocked probe cannot answer either question. 403 in particular has repeatedly meant "bot
// filtered", not "this catalogue has no entry for you".
export function isBlocked(status) {
  return status === 401 || status === 403 || status === 429 || status === 0 || status >= 500;
}

export async function get(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    const body = await res.text();
    return { status: res.status, url: res.url, body };
  } catch (err) {
    return { status: 0, url, body: "", error: String(err && err.message ? err.message : err) };
  } finally {
    clearTimeout(timer);
  }
}

export function parseLocs(xml) {
  return (xml.match(/<loc>\s*([^<\s]+)\s*<\/loc>/g) || [])
    .map((l) => l.replace(/<\/?[^>]+>/g, "").trim())
    .filter((l) => /^https?:\/\//i.test(l));
}

// A sitemap index points at children; a sitemap file points at pages. Distinguishing them by shape
// is what stopped the "static.xml has no entry for us, therefore we are absent" reading.
// Only a `.xml` loc is a child map: mcpservers.org has live pages named `/servers/<owner>/sitemap-mcp`,
// and treating an HTML page as a sitemap leg inflates the corpus counter with a leg that cannot hold
// a listing, which is how a blind probe earns the right to claim absence.
export function classifyIndex(xml) {
  const locs = parseLocs(xml);
  const isChildMap = (l) => /\.xml(\?|#|$)/i.test(l);
  const children = locs.filter(isChildMap);
  return children.length > 0 ? { kind: "index", children } : { kind: "pages", children: [], pages: locs };
}

function escapeRe(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export function slugUrls(body, slug) {
  return body.match(new RegExp(`https?://[^<"\\s]*${escapeRe(slug)}[^<"\\s]*`, "g")) || [];
}

// Both the slug and the handle have to be in the same url. An entry for a different repository of
// ours would otherwise read as "this catalogue already lists us", which is a false positive that
// silently suppresses a legitimate submission.
export function matchOurs(urls, { slug, handle }) {
  const bare = new RegExp(`/server[s]?/${escapeRe(slug)}\\b`, "i");
  const lower = slug.toLowerCase();
  return urls.filter((u) => (u.includes(handle) && u.toLowerCase().includes(lower)) || bare.test(u))[0] ?? null;
}

// The whole point: NOT_FOUND is only a claim about the world if the probe demonstrably saw the
// world. urlsSeen is that demonstration; below the floor the honest verdict is UNDECIDABLE.
export function decide({ childrenRead, urlsSeen, matched, genericOnly }) {
  if (matched) {
    return { verdict: "LISTED", why: "entry found in a sitemap child" };
  }
  if (childrenRead === 0) {
    return { verdict: "UNDECIDABLE", why: "no sitemap child readable: the probe is blind, not the site" };
  }
  if (urlsSeen < 20) {
    return { verdict: "UNDECIDABLE", why: `listing corpus too small to prove absence (saw ${urlsSeen} url(s))` };
  }
  if (genericOnly > 0) {
    return { verdict: "UNDECIDABLE", why: "slug matched other listings but none carrying our handle" };
  }
  return { verdict: "NOT_FOUND", why: `${urlsSeen} url(s) seen across ${childrenRead} child(ren), no entry carrying our handle` };
}

const MIN_CHILD_BUDGET = 40;

// The site root and its HTML pages are not load-bearing: mcpservers.org answers 403 for both under
// a plain user-agent while serving robots.txt and every sitemap child at 200. Only "no XML leg at
// all readable" counts as blindness, because that is the only case where absence has no evidence base.
export async function checkSite(site, { slug, handle }) {
  const blocked = [];
  const probe = await get(site);
  if (isBlocked(probe.status)) blocked.push(`root ${probe.status}`);
  const robots = await get(new URL("/robots.txt", site).href);
  if (isBlocked(robots.status)) blocked.push(`robots.txt ${robots.status}`);
  const declared = isBlocked(robots.status)
    ? []
    : (robots.body.match(/^Sitemap:\s*(\S+)/gim) || []).map((line) => line.split(/\s+/)[1]);

  // robots.txt is the map, but a catalogue that hides it from this UA is not thereby absent: fall
  // back to the conventional names so the XML legs still get a chance to speak.
  const roots = declared.length > 0
    ? declared
    : ["/sitemap.xml", "/sitemap-index.xml"].map((p) => new URL(p, site).href);

  const queue = [...roots];
  const visited = new Set();
  let childrenRead = 0;
  let pagesRead = 0;
  let urlsSeen = 0;
  let genericOnly = 0;
  let matched = null;
  const path = [];

  while (queue.length > 0 && path.length < MIN_CHILD_BUDGET && !matched) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const res = await get(url);
    if (isBlocked(res.status) || res.status >= 400) {
      blocked.push(`${url} ${res.status}`);
      continue;
    }
    const shape = classifyIndex(res.body);
    if (shape.kind === "index") {
      path.push(`${url} (index)`);
      queue.unshift(...shape.children);
      continue;
    }
    path.push(url);
    pagesRead += 1;
    childrenRead += 1;
    const locs = shape.pages.length > 0 ? shape.pages : parseLocs(res.body);
    urlsSeen += locs.length;
    const hits = slugUrls(res.body, slug);
    const ours = matchOurs(hits, { slug, handle });
    if (hits.length > 0 && !ours) genericOnly += hits.length;
    if (ours) matched = ours;
    else if (locs.length > 0) {
      const oursInLocs = matchOurs(locs, { slug, handle });
      if (oursInLocs) matched = oursInLocs;
    }
  }

  return {
    site,
    ...decide({ childrenRead, urlsSeen, matched, genericOnly }),
    evidence: matched,
    pagesRead,
    childrenRead,
    urlsSeen,
    genericWordMatches: genericOnly,
    blockedLegs: blocked,
    scanned: path,
  };
}

// github.com/mcp is not a sitemap-shaped catalogue: it is a React directory whose server pages live at
// `/mcp/<namespace>/<slug>`, and whose search is `/mcp?q=<term>`. Measured on 2026-09-29, another small
// registry record (`io.github.amansingh63/dbhub-analytics`) is absent exactly like ours while
// `bytebase/dbhub` answers 200 - so this directory curates rather than mirrors, and a 404 for us only
// means absence when the control legs demonstrably answer. Same rule as everywhere else in this file:
// absence and blindness must not share a sentence.
export const GITHUB_MCP_CONTROL_ID = "io.github.bytebase/dbhub";
// The directory emits the GitHub owner/repo shape in its hrefs (measured 2026-09-29: `?q=dbhub` returned
// exactly one href, "/mcp/bytebase/dbhub"), so the control is counted by that tail. Both shapes resolve
// for the control server, and both are probed for us, so a 404 on one path cannot fake an absence.
export const GITHUB_MCP_CONTROL_SLUG = "bytebase/dbhub";
export const GITHUB_MCP_CONTROL_QUERY = "dbhub";

// Two URL shapes are live for listed servers, so absence has to survive both.
export function combineOursStatuses(a, b) {
  if (a === 200 || b === 200) return 200;
  if (isBlocked(a) || isBlocked(b)) return 0;
  if (a === 404 && b === 404) return 404;
  return a === b ? a : `${a}/${b}`;
}

export function githubMcpVerdict({ oursStatus, controlStatus, controlHits }) {
  if (isBlocked(oursStatus)) return { verdict: "UNDECIDABLE", why: `our entry leg is unreadable (${oursStatus})` };
  if (controlStatus !== 200) return { verdict: "UNDECIDABLE", why: `control server page is not 200 (${controlStatus}), so the probe has no positive control` };
  if (!(controlHits >= 1)) return { verdict: "UNDECIDABLE", why: `directory search for "${GITHUB_MCP_CONTROL_QUERY}" surfaced ${controlHits} control card(s), so a zero for us proves nothing` };
  if (oursStatus === 200) return { verdict: "LISTED", why: `entry page 200 with ${controlHits} control card(s) in search` };
  if (oursStatus === 404) return { verdict: "NOT_FOUND", why: `both entry shapes 404 while the control page is 200 and its search card is present (${controlHits})` };
  return { verdict: "UNDECIDABLE", why: `unexpected status for our entry: ${oursStatus}` };
}

async function statusNoRedirect(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "manual", signal: controller.signal });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGithubMcp({ slug, handle }) {
  const registryId = `io.github.${handle}/${slug}`;
  const repoId = `${handle}/${slug}`;
  const oursUrls = [`https://github.com/mcp/${registryId}`, `https://github.com/mcp/${repoId}`];
  const controlUrl = `https://github.com/mcp/${GITHUB_MCP_CONTROL_ID}`;
  const searchUrl = `https://github.com/mcp?q=${GITHUB_MCP_CONTROL_QUERY}`;
  const [first, second] = [await statusNoRedirect(oursUrls[0]), await statusNoRedirect(oursUrls[1])];
  const oursStatus = combineOursStatuses(first, second);
  const [controlStatus, search] = [await statusNoRedirect(controlUrl), await get(searchUrl)];
  const controlHits = (search.body.match(new RegExp(`/mcp/[^"]*${escapeRe(GITHUB_MCP_CONTROL_SLUG)}`, "g")) || []).length;
  return {
    site: "https://github.com/mcp",
    ...githubMcpVerdict({ oursStatus, controlStatus, controlHits }),
    evidence: oursStatus === 200 ? oursUrls[0] : null,
    legs: { ours_registry: first, ours_repo: second, control: controlStatus, search: search.status, controlHits },
    urls: { oursUrls, controlUrl, searchUrl },
  };
}

// Smithery's registry answers presence by exact route and does NOT answer it by search. Measured 2026-09-29:
// `/servers/happy520ai/unified-ai-system` returns 404 {"error":"Server not found"} while `/servers/github`
// (67 KB of record) and `/servers/brave` (14 KB) return 200, so the route shape is live and nothing answers
// for us. The search parameter is the trap: `?q=` reported pagination.totalCount 190 for our slug, 177 for
// "unified", 107 for "brave" and 194 for a token that cannot name any server. Four unrelated queries landing
// near 180 is a re-ranked sample, not a filter, so a zero from it would be blindness wearing a measurement's
// clothes - the same shape as the official registry's silently ignored `status` parameter. This leg measures
// whether the search behaved like a filter and refuses to cite it when it did not.
//
// Scope of the negative claim: their rows carry `unlisted` and `inactive`, and an entry hidden by either is
// indistinguishable from a missing one from outside. NOT_FOUND here means "no record answers at either exact
// route", which is what a visitor gets, and nothing beyond that.
export const SMITHERY_CONTROL_SLUGS = ["github", "brave"];
export const SMITHERY_NONSENSE_QUERY = "zzzq-not-a-real-server-token";

export function parseSmitheryTotal(text) {
  try {
    const j = JSON.parse(text);
    const total = j && j.pagination ? j.pagination.totalCount : null;
    return Number.isSafeInteger(total) && total >= 0 ? total : null;
  } catch {
    return null;
  }
}

// A query that cannot name anything must come back near-empty for `?q=` to be a filter. The bar is set against
// the row count a real server's query returns, so their ranking getting noisier cannot quietly re-earn the
// search leg the right to prove absence.
export function smitherySearchIsFilter({ controlTotal, nonsenseTotal }) {
  if (controlTotal === null || nonsenseTotal === null) return { filtering: null, why: "the search legs did not parse, so the search is not being cited either way" };
  if (nonsenseTotal === 0) return { filtering: true, why: `the nonsense query returned 0 rows against ${controlTotal} for a server that exists` };
  if (nonsenseTotal * 4 <= controlTotal) return { filtering: true, why: `the nonsense query returned ${nonsenseTotal} rows against ${controlTotal}, small enough to be a filter` };
  return { filtering: false, why: `the nonsense query returned ${nonsenseTotal} rows against ${controlTotal} for a server that exists, so ?q= re-ranks a sample instead of filtering` };
}

export function smitheryVerdict({ oursNamespace, oursBare, controlStatuses, search }) {
  const ours = combineOursStatuses(oursNamespace, oursBare);
  if (isBlocked(ours)) return { verdict: "UNDECIDABLE", why: `our route leg is unreadable (${ours})` };
  const deadControls = SMITHERY_CONTROL_SLUGS.filter((_, i) => controlStatuses[i] !== 200);
  if (deadControls.length) return { verdict: "UNDECIDABLE", why: `control record(s) ${deadControls.join(", ")} did not answer 200 (got ${controlStatuses.join("/")}), so the route shape is not proven live` };
  if (ours === 200) return { verdict: "LISTED", why: `a record answers at our exact route (namespace leg ${oursNamespace}, bare leg ${oursBare})` };
  if (ours === 404) {
    // Only a search leg proven to filter may be quoted, and even then a non-zero row count for our own slug is
    // reported rather than interpreted - this leg's claim rests on the two exact routes either way.
    const via = search.filtering === true
      ? (search.oursTotal === 0 ? "and the filtered search returned 0 rows for our slug" : `and the filtered search still returned ${search.oursTotal} row(s) for our slug, which is not interpreted here`)
      : "; the search leg is not citable, because " + search.why;
    return { verdict: "NOT_FOUND", why: `both exact routes 404 while ${SMITHERY_CONTROL_SLUGS.join(" and ")} answer 200${via}` };
  }
  return { verdict: "UNDECIDABLE", why: `unexpected combined status for our two route shapes: ${ours}` };
}

export async function checkSmithery({ slug, handle }) {
  const api = "https://api.smithery.ai/servers";
  const urls = {
    ours_namespace: `${api}/${handle}/${slug}`,
    ours_bare: `${api}/${slug}`,
    controls: SMITHERY_CONTROL_SLUGS.map((s) => `${api}/${s}`),
    q_control: `${api}?q=${encodeURIComponent(SMITHERY_CONTROL_SLUGS[0])}&pageSize=20`,
    q_nonsense: `${api}?q=${encodeURIComponent(SMITHERY_NONSENSE_QUERY)}&pageSize=20`,
    q_ours: `${api}?q=${encodeURIComponent(slug)}&pageSize=20`,
  };
  const [oursNamespace, oursBare, controlStatuses, qControl, qNonsense, qOurs] = await Promise.all([
    get(urls.ours_namespace),
    get(urls.ours_bare),
    Promise.all(urls.controls.map((u) => get(u).then((r) => r.status))),
    get(urls.q_control),
    get(urls.q_nonsense),
    get(urls.q_ours),
  ]);
  const controlTotal = parseSmitheryTotal(qControl.body);
  const nonsenseTotal = parseSmitheryTotal(qNonsense.body);
  const oursTotal = parseSmitheryTotal(qOurs.body);
  const search = { ...smitherySearchIsFilter({ controlTotal, nonsenseTotal }), controlTotal, nonsenseTotal, oursTotal, http: [qControl.status, qNonsense.status, qOurs.status] };
  const verdict = smitheryVerdict({ oursNamespace: oursNamespace.status, oursBare: oursBare.status, controlStatuses, search });
  return {
    site: "https://smithery.ai",
    ...verdict,
    evidence: verdict.verdict === "LISTED" ? (oursNamespace.status === 200 ? urls.ours_namespace : urls.ours_bare) : null,
    legs: { ours_namespace: oursNamespace.status, ours_bare: oursBare.status, controls: controlStatuses, search },
    urls,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => {
    const i = args.indexOf(name);
    if (i < 0) return dflt;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const slug = opt("--slug", "unified-ai-system");
  const handle = opt("--handle", "happy520ai");
  // A valueless flag, so it must be removed before the remaining positional args are read as sites.
  const withGithubMcp = args.includes("--github-mcp");
  if (withGithubMcp) args.splice(args.indexOf("--github-mcp"), 1);
  const withSmithery = args.includes("--smithery");
  if (withSmithery) args.splice(args.indexOf("--smithery"), 1);
  const sites = args.length > 0 ? args : ["https://mcpservers.org", "https://mcpmarket.com", "https://glama.ai/"];
  const report = [];
  for (const site of sites) {
    report.push(await checkSite(site.replace(/\/+$/, ""), { slug, handle }));
  }
  if (withGithubMcp) report.push(await checkGithubMcp({ slug, handle }));
  if (withSmithery) report.push(await checkSmithery({ slug, handle }));
  const count = (v) => report.filter((r) => r.verdict === v).length;
  console.log(JSON.stringify({ checked_at_utc: new Date().toISOString(), slug, handle, report }, null, 1));
  console.log(`SUMMARY listed=${count("LISTED")} not_found=${count("NOT_FOUND")} undecidable=${count("UNDECIDABLE")}`);
  // Refuse a clean exit if the instrument claims nothing at all was found anywhere: that is the
  // shape a broken probe makes, and it is the shape that caused four wrong submissions.
  if (count("LISTED") === 0 && count("NOT_FOUND") === report.length) {
    console.log("WARNING: every site read as absent. That is this instrument's known blind-mode; re-check against a site you know lists you.");
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
