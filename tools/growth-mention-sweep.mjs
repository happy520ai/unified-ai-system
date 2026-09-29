// Who else is talking about this project, and which of those places are we already watching?
//
// Why this exists: on 2026-09-29 the carrier table was assembled from our own open pull requests, and a
// 7,699-star Chinese catalogue had been carrying us for six weeks without appearing in it. Searching for our
// own repository name found 297 files across 45 repositories. The same technique repeated by hand is worth
// about one discovery per session; the same technique in the nightly summary is worth one per day, and the
// cost of missing one is a claim on our own listing page that is quietly incomplete.
//
// This tool does not decide anything. It groups what GitHub's code search returned by the shape of the file
// that mentions us, so a human can look at the handful that matter - the unmonitored catalogues - and ignore
// the long tail of someone's star list. Adding a repository to the monitored set is tools/check-carrier-presence.mjs's
// CARRIERS table, edited by a person after re-reading the entry.
//
//   node tools/growth-mention-sweep.mjs            # table + MENTION_SUMMARY line
//   node tools/growth-mention-sweep.mjs --json     # one machine-readable report on stdout
//
// Exit codes: 0 a reading was obtained; 3 no search identity is available (gh missing, or unauthenticated -
// the search API rejects anonymous callers, so "no results" and "cannot ask" must not share a code); 4 the
// walk was truncated and the counts below are for a subset.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const QUERY = '"happy520ai/unified-ai-system"';
export const PAGES_MAX = 10;
export const PER_PAGE = 100;

export const GROUPS = ["SELF", "MONITORED", "CANDIDATE_CATALOGUE", "REDISTRIBUTION", "MIRROR", "AGGREGATOR", "PERSONAL"];

// Carriers we already re-probe nightly (tools/check-carrier-presence.mjs CARRIERS). Read from that table
// rather than restated here: two lists that can disagree is how the six-week blind spot happened.
export function monitoredRepos(carriers) {
  return new Set((carriers ?? []).map((c) => c.repo));
}

// The shape of the mentioning file is the only signal available without reading each repository by hand, and
// it is a strong one: a README row is a listing, a copy of our SKILL.md is redistribution, a path that
// repeats our own owner/name is a page generated about us, and a .json blob is someone's dataset.
export function classifyFile(path) {
  const p = String(path ?? "");
  if (/unified-ai-gateway\/SKILL\.md$/iu.test(p)) return "REDISTRIBUTION";
  if (/happy520ai[\/%40@._-]*unified-ai-system/iu.test(p) && /(^|\/)(r|repo|repos|docs|data)\//iu.test(p)) return "MIRROR";
  if (/\.(?:json|jsonl|ya?ml)$/u.test(p) || /(^|\/)data\//u.test(p)) return "AGGREGATOR";
  if (/(^|\/)(?:README[^\/]*|index[^\/]*|docs?\/index[^\/]*)\.(?:md|html|txt)$/iu.test(p) || /(^|\/)docs\//u.test(p)) return "CANDIDATE_CATALOGUE";
  return "PERSONAL";
}

// One repository can be mentioned in twelve files; its group is the most informative shape present, not the
// first one the API happened to return. Order matters: redistribution of our own artifact outranks a README
// line, because "someone packaged this" is a different fact from "someone linked this".
const RANK = ["REDISTRIBUTION", "MIRROR", "CANDIDATE_CATALOGUE", "AGGREGATOR", "PERSONAL"];
export function groupOfFiles(paths) {
  const groups = (paths ?? []).map(classifyFile);
  for (const g of RANK) if (groups.includes(g)) return g;
  return groups.includes("PERSONAL") ? "PERSONAL" : "CANDIDATE_CATALOGUE";
}

export function groupRows(items, { selfOwner = "happy520ai", monitored = new Set() } = {}) {
  const byRepo = new Map();
  for (const it of items ?? []) {
    const repo = it?.repository?.full_name ?? it?.repo ?? null;
    if (!repo) continue;
    if (!byRepo.has(repo)) byRepo.set(repo, new Set());
    byRepo.get(repo).add(it.path);
  }
  const rows = [];
  for (const [repo, paths] of byRepo) {
    const [owner] = repo.split("/");
    let group;
    if (owner === selfOwner) group = "SELF";
    else if (monitored.has(repo)) group = "MONITORED";
    else group = groupOfFiles([...paths]);
    rows.push({ repo, group, files: paths.size, paths: [...paths].sort().slice(0, 3) });
  }
  return rows.sort((a, b) => (b.files - a.files) || a.repo.localeCompare(b.repo));
}

// Truncation is judged against what the API says exists, not against whether a page came back full. Measured
// 2026-09-29: the first page returned 99 rows while total_count said 303, so a rule of "stop when a page is
// short" reports a third of the population as if it were the whole of it - and every count printed below
// would be that subset.
export function needsNextPage({ collected, totalCount, page, pagesMax = PAGES_MAX }) {
  if (page >= pagesMax) return false;
  if (typeof totalCount !== "number") return collected > 0 && collected % PER_PAGE === 0;
  return collected < totalCount;
}

export function searchOnce({ page = 1, gh = "gh" }) {
  const r = spawnSync(gh, ["api", "-X", "GET", "search/code", "-f", "q=" + QUERY, "-F", "per_page=" + PER_PAGE,
    "-F", "page=" + page, "--jq", "{total_count:.total_count, items:[.items[]|{repo:.repository.full_name, path:.path}]}"],
    { encoding: "utf8", maxBuffer: 1 << 26, timeout: 90_000 });
  if (r.status !== 0) {
    const why = String(r.stderr || r.error?.message || "gh api failed").replace(/\s+/gu, " ").trim().slice(0, 160);
    return { ok: false, why };
  }
  try {
    return { ok: true, ...JSON.parse(r.stdout) };
  } catch (e) {
    return { ok: false, why: "search response was not JSON: " + String(e.message).slice(0, 80) };
  }
}

export function walk({ fetchPage = searchOnce, gh = "gh", pagesMax = PAGES_MAX } = {}) {
  const items = [];
  let totalCount = null;
  let exhausted = false;
  let pages = 0;
  for (let page = 1; page <= pagesMax; page += 1) {
    const leg = fetchPage({ page, gh });
    if (!leg.ok) return { ok: false, why: leg.why, items, pages: page - 1, exhausted: false, truncated: true };
    pages = page;
    if (typeof leg.total_count === "number") totalCount = leg.total_count;
    const got = leg.items ?? [];
    if (got.length === 0) { exhausted = true; break; }
    items.push(...got.map((x) => ({ repository: { full_name: x.repo }, path: x.path })));
    if (!needsNextPage({ collected: items.length, totalCount, page, pagesMax })) {
      exhausted = typeof totalCount !== "number" || items.length >= totalCount;
      break;
    }
  }
  // "truncated" is reserved for the case where *we* stopped - the ceiling - because that is the one the
  // reader can act on by raising pagesMax. When the API returns an empty page before reaching its own
  // advertised total, the discrepancy belongs to the endpoint, and the honest word is exhausted.
  const truncated = !exhausted && typeof totalCount === "number" && items.length < totalCount;
  return { ok: true, items, totalCount, pages, exhausted, truncated };
}

export function tally(rows) {
  const out = {};
  for (const g of GROUPS) out[g] = rows.filter((r) => r.group === g).length;
  return out;
}

async function main() {
  const { CARRIERS } = await import(new URL("./check-carrier-presence.mjs", import.meta.url));
  const result = walk({});
  if (!result.ok) {
    console.error("MENTION_SWEEP unavailable: " + result.why + " - GitHub code search needs an authenticated identity, so this is not a reading of zero mentions");
    return 3;
  }
  const rows = groupRows(result.items, { monitored: monitoredRepos(CARRIERS) });
  const t = tally(rows);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ query: QUERY, total_count: result.totalCount, rows_returned: result.items.length,
      pages: result.pages, exhausted: result.exhausted, truncated: result.truncated, tally: t, repos: rows }, null, 1));
  } else {
    console.log("# mention sweep for " + QUERY);
    console.log("api total_count=" + result.totalCount + " rows_returned=" + result.items.length +
      " pages=" + result.pages + " exhausted=" + result.exhausted + " truncated=" + result.truncated);
    for (const g of GROUPS) {
      const list = rows.filter((r) => r.group === g);
      if (!list.length) continue;
      console.log("\n[" + g + "] " + list.length + " repository(ies)");
      for (const r of list.slice(0, 14)) console.log("  " + r.repo.padEnd(46) + String(r.files).padStart(4) + " file(s)  " + r.paths.join(", ").slice(0, 90));
      if (list.length > 14) console.log("  … " + (list.length - 14) + " more");
    }
    console.log("\nAdd a repository to the monitored set by editing CARRIERS in tools/check-carrier-presence.mjs,");
    console.log("after reading its entry. This tool deliberately does not decide that for anyone.");
  }
  console.log("MENTION_SUMMARY repos=" + rows.length + " monitored=" + t.MONITORED + " candidates=" + t.CANDIDATE_CATALOGUE +
    " redistribution=" + t.REDISTRIBUTION + " mirror=" + t.MIRROR + " aggregator=" + t.AGGREGATOR + " personal=" + t.PERSONAL +
    " self=" + t.SELF);
  if (result.truncated) {
    console.error("MENTION_SWEEP truncated: " + result.items.length + " of " + (result.totalCount ?? "?") + " matches were walked, so the counts above are a subset");
    return 4;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();
