// Census: how many servers in the official MCP Registry can actually be reached from their record?
//
// Why this exists: the published 2026-09-28 article counted 6 installable of 54 servers, but that was
// a paged sample, and the list turns out to be grouped by server NAME ascending rather than spread over
// the registry. 54 is not the population. This walks the whole list and answers the same question with
// the whole denominator, which is also the figure upstream issue modelcontextprotocol/registry#1579 asks
// for ("387 active servers declare neither remotes nor packages and cannot be reached").
//
// Method notes that matter to the reading:
//  - One row per PUBLISHED VERSION. A server is identified by `name`, and the row carrying
//    `_meta["io.modelcontextprotocol.registry/official"].isLatest == true` is that server's current record.
//    Bucketing on the latest row is what makes "N servers" mean N servers.
//  - `status` as a query parameter is SILENTLY IGNORED (verified 2026-09-28: `?status=active`,
//    `?status[]=active` and `?state=active` each returned byte-identical first pages to no filter,
//    including deprecated rows). So filtering is done client-side here, and deprecated is reported
//    separately rather than dropped.
//  - There is no server-side count endpoint (`/v0/stats`, `/v0/servers/count`, `/v0.1/stats` all 404),
//    so the only available denominator is this walk. Its coverage ceiling is reported, never implied.
//  - Structure only: counts, booleans, registry/transport type strings. No server-authored text captured.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const REG = "https://registry.modelcontextprotocol.io";
const LIMIT = Number(process.env.CENSUS_LIMIT || 100);
const MAX_PAGES = Number(process.env.CENSUS_MAX_PAGES || 1400);
const OUT = process.argv[2] || ".pm/mcp-registry-census.json";
const CONTROL = "io.github.happy520ai/unified-ai-system";
const started = new Date().toISOString();

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    const text = await r.text();
    if (!r.ok) return { status: r.status, error: text.slice(0, 120) };
    return { status: r.status, body: JSON.parse(text) };
  } catch (e) {
    return { status: 0, error: e.name + " " + String(e.message).slice(0, 80) };
  }
}

// The list endpoint answers HTTP 500 "Failed to get registry list" partway through a long walk (observed
// at page 689 of a ~830-page walk on 2026-09-28), so a single failure is a transport event, not evidence
// about the registry. Retries are bounded and every attempt is recorded; exhausting them still refuses,
// because publishing a walk that stopped early would turn a prefix into a population.
async function getListPage(url, attempts = 8) {
  const tried = [];
  for (let i = 0; i < attempts; i += 1) {
    const r = await getJson(url);
    if (r.status === 200) return { ...r, attempts: i + 1, tried };
    tried.push(r.status + ":" + (r.error || "").slice(0, 40));
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 1500 * 2 ** i));
  }
  return { status: tried.length ? Number(tried[tried.length - 1].split(":")[0]) : 0, error: tried.join(" | "), attempts };
}

// One latest record per server name. Rows without a latest marker are still counted, and the two sets
// are compared at the end - a truncated walk shows up as names without a latest row.
const servers = new Map();
const seenNames = new Set();
let pages = 0, rows = 0, listErrors = 0, retryEvents = 0, worstRetryStreak = 0, cursor;
for (; pages < MAX_PAGES; pages += 1) {
  const url = new URL(REG + "/v0/servers");
  url.searchParams.set("limit", String(LIMIT));
  if (process.env.CENSUS_INCLUDE_DELETED === "true") url.searchParams.set("include_deleted", "true");
  if (cursor) url.searchParams.set("cursor", cursor);
  const r = await getListPage(url.toString());
  retryEvents += Math.max(0, r.attempts - 1);
  worstRetryStreak = Math.max(worstRetryStreak, r.attempts);
  if (r.status !== 200) {
    listErrors += 1;
    console.log(`REFUSED: list page ${pages} http=${r.status} after ${r.attempts} attempts ${r.error || ""} - walk is not complete`);
    process.exit(3);
  }
  const list = (r.body && r.body.servers) || [];
  if (list.length === 0) break;
  for (const entry of list) {
    const s = entry.server;
    if (!s || !s.name) continue;
    rows += 1;
    if (!seenNames.has(s.name)) seenNames.add(s.name);
    const off = (entry._meta || {})["io.modelcontextprotocol.registry/official"] || {};
    const rec = {
      name: s.name,
      version: s.version || null,
      status: off.status || "absent",
      is_latest: off.isLatest === true,
      has_packages: Array.isArray(s.packages) && s.packages.length > 0,
      package_count: (s.packages || []).length,
      registry_types: [...new Set((s.packages || []).map((p) => p.registryType || "absent"))].sort(),
      package_transports: [...new Set((s.packages || []).map((p) => (p.transport && p.transport.type) || "absent"))].sort(),
      has_remotes: Array.isArray(s.remotes) && s.remotes.length > 0,
      remote_count: (s.remotes || []).length,
      remote_types: [...new Set((s.remotes || []).map((x) => x.type || "absent"))].sort(),
    };
    const prev = servers.get(s.name);
    // Latest wins; otherwise keep the highest row count seen so no server silently disappears.
    if (!prev || (rec.is_latest && !prev.is_latest)) servers.set(s.name, rec);
  }
  cursor = (r.body.metadata || {}).nextCursor || null;
  if (!cursor) break;
  if (pages % 25 === 0) console.log(`... ${pages + 1} pages, ${rows} rows, ${servers.size} names, ${Date.now()}`);
}

const walk_complete = !cursor;
const all = [...servers.values()];
const latest = all.filter((r) => r.is_latest);
const control = servers.get(CONTROL) || null;

// ---- Guards. Each of these can only fire if the instrument itself is wrong, so firing means stop. ----
const problems = [];
if (!walk_complete) problems.push(`cursor still present after ${pages} pages - this is a truncated walk, not a census`);
if (listErrors) problems.push(`${listErrors} list-page errors`);
if (rows === 0) problems.push("zero rows read");
// Boundary arm: if rows == names then the per-version model changed and the whole premise of this
// instrument is dead; refuse rather than publish a number whose denominator moved underneath it.
if (rows === all.length) problems.push(`rows (${rows}) equals distinct names (${all.length}) - the one-row-per-version premise no longer holds`);
// Membership arm: a name that has rows but no latest row means the bucket dropped a server's current record.
const namesWithoutLatest = all.length - latest.length;
if (namesWithoutLatest !== 0) problems.push(`${namesWithoutLatest} of ${all.length} names had no isLatest row - bucketing incomplete`);
// Positive control: our own published server must appear WITH a package. If it does not, the walk or the
// field path is broken; this is the known-true target that makes the negative readings mean something.
if (!control) problems.push(`control ${CONTROL} absent from census - instrument is blind, refuse to publish`);
else if (!control.has_packages) problems.push(`control ${CONTROL} latest row shows no package - field path is wrong`);

function tally(list, key) {
  const out = {};
  for (const r of list) for (const v of r[key]) out[v] = (out[v] || 0) + 1;
  return out;
}
function classify(r) {
  if (r.has_packages && r.has_remotes) return "both";
  if (r.has_packages) return "package_only";
  if (r.has_remotes) return "remote_only";
  return "neither";
}

const byStatus = {};
for (const r of latest) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
const reachClass = {};
for (const r of latest) reachClass[classify(r)] = (reachClass[classify(r)] || 0) + 1;
// Sum guard: the four classes must partition the active set exactly. A sum that does not match the
// denominator means a branch is missing, and a missing branch reads as "0 in that bucket".
const active = latest.filter((r) => r.status === "active");
function reachClassActive(list) {
  const out = {};
  for (const r of list) { const k = classify(r); out[k] = (out[k] || 0) + 1; }
  return out;
}
const activeTally = reachClassActive(active);
const pkgActive = active.filter((r) => r.has_packages);
const remActive = active.filter((r) => r.has_remotes);
const packageRegistryTypes = tally(pkgActive, "registry_types");
const packageTransportTypes = tally(pkgActive, "package_transports");
const remoteTransportTypes = tally(remActive, "remote_types");
// A key that stringified to "[object Object]" means a field was read as a string while the API returns an
// object - which is exactly how the first run of this instrument lost the package transport column.
for (const [label, obj] of [["package_registry_types", packageRegistryTypes], ["package_transport_types", packageTransportTypes], ["remote_transport_types", remoteTransportTypes]]) {
  for (const k of Object.keys(obj)) {
    if (k.includes("[object")) problems.push(`${label} key "${k}" is a coerced object - the field path is wrong`);
  }
}

const result = {
  schema: "mcp-registry-installability-census-v1",
  started_at: started,
  finished_at: new Date().toISOString(),
  source: `${REG}/v0/servers`,
  include_deleted_view: process.env.CENSUS_INCLUDE_DELETED === "true",
  limit_per_page: LIMIT,
  pages_walked: pages,
  list_retry_events: retryEvents,
  worst_attempts_for_one_page: worstRetryStreak,
  walk_complete,
  rows_seen: rows,
  distinct_names: all.length,
  latest_records: latest.length,
  names_without_latest_row: namesWithoutLatest,
  server_status_counts: byStatus,
  active_latest_records: active.length,
  active_reachability: activeTally,
  active_reachability_sum: Object.values(activeTally).reduce((a, b) => a + b, 0),
  active_sum_matches_denominator: Object.values(activeTally).reduce((a, b) => a + b, 0) === active.length,
  all_latest_reachability: reachClass,
  package_registry_types: packageRegistryTypes,
  package_transport_types: packageTransportTypes,
  remote_transport_types: remoteTransportTypes,
  active_records_with_a_package: pkgActive.length,
  active_records_with_a_remote: remActive.length,
  // Tally semantics a reader needs: these count RECORDS that mention a type, and a record may mention
  // several, so the columns can sum to more than the record count. Not a tally of package entries.
  tally_counts_records_not_entries: true,
  control_record: control,
  // Selection-bias evidence for the older sampled article: the list is grouped by name ascending, so the
  // first 54 distinct names are the alphabetically-first ones, not a random slice.
  first_twelve_names_in_walk_order: [...seenNames.keys()].slice(0, 12),
  problem_count: problems.length,
  problems,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  pages_walked: pages, rows_seen: rows, distinct_names: all.length, active_latest_records: active.length,
  active_reachability: activeTally, registry_types: result.package_registry_types,
  control_in_census: Boolean(control), problem_count: problems.length, out: OUT,
}));
if (!result.active_sum_matches_denominator || problems.length) {
  console.log("REFUSED: " + (problems.join("; ") || "active reachability classes do not sum to the active denominator"));
  process.exit(3);
}
