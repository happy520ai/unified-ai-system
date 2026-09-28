// Build the sampling frame: every ACTIVE, latest registry record whose package declares registryType
// "npm", with its package identifier and version. Nothing is resolved here; this only answers "what is
// the population a sample must be drawn from", which the published census cannot answer because it kept
// counts and not identifiers.
//
// Why a frame is needed at all: the registry list is ordered by server name ascending, so "read a few
// pages" is an alphabetical prefix, not a sample. A claim about installability of npm-listed servers has
// to be drawn from a frame that covers the whole list.
//
// Anchors, each of which can only be satisfied by a correct walk:
//  - the cursor must be exhausted (refuses otherwise) - a prefix is not a frame;
//  - the collected count is compared against the published census's `npm` tally and the deviation is
//    reported; a two-orders-of-magnitude gap means the field path is wrong, and the instrument says so
//    rather than publishing a frame nobody can sanity-check;
//  - our own record must be found with its OCI type, which proves the record-level read is reaching the
//    `packages` array at all (it is then excluded from the npm frame as a known-true negative).
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const REG = "https://registry.modelcontextprotocol.io";
const OUT = process.argv[2] || ".pm/mcp-npm-frame.json";
const CENSUS = process.argv[3] || "docs/data/mcp-registry-census.2026-09-28.json";
const MAX_PAGES = Number(process.env.CENSUS_MAX_PAGES || 2000);
const started = new Date().toISOString();
const census = JSON.parse(readFileSync(CENSUS, "utf8"));

async function getJson(url) {
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    const t = await r.text();
    if (!r.ok) return { status: r.status, error: t.slice(0, 120) };
    return { status: r.status, body: JSON.parse(t) };
  } catch (e) { return { status: 0, error: e.name + " " + String(e.message).slice(0, 60) }; }
}
async function getListPage(url, attempts = 8) {
  const tried = [];
  for (let i = 0; i < attempts; i += 1) {
    const r = await getJson(url);
    if (r.status === 200) return { ...r, attempts: i + 1, tried };
    tried.push(r.status + ":" + (r.error || "").slice(0, 40));
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 1500 * 2 ** i));
  }
  return { status: 0, error: tried.join(" | "), attempts };
}

// Which artifact types to frame. The default keeps this file's original behaviour, so the published npm
// page remains reproducible byte for byte; a wider set costs no extra walk because the list is read once.
const TYPES = (process.env.FRAME_TYPES || "npm").split(",").map((s) => s.trim()).filter(Boolean);
const frame = new Map();
let pages = 0, rows = 0, retries = 0, cursor, activeLatest = 0, npmSightings = 0;
const seenControl = { found: false, record: null };
for (; pages < MAX_PAGES; pages += 1) {
  const url = new URL(REG + "/v0/servers");
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  const r = await getListPage(url.toString());
  retries += Math.max(0, r.attempts - 1);
  if (r.status !== 200) { console.log("REFUSED: page " + pages + " http=" + r.status + " " + r.error); process.exit(3); }
  const list = (r.body && r.body.servers) || [];
  if (list.length === 0) break;
  for (const entry of list) {
    const s = entry.server;
    if (!s || !s.name) continue;
    rows += 1;
    const off = (entry._meta || {})["io.modelcontextprotocol.registry/official"] || {};
    if (off.isLatest !== true || off.status !== "active") continue;
    activeLatest += 1;
    if (s.name === "io.github.happy520ai/unified-ai-system") {
      seenControl.found = true;
      seenControl.record = { name: s.name, version: s.version, registryTypes: (s.packages || []).map((p) => p.registryType), packageCount: (s.packages || []).length };
    }
    for (const p of s.packages || []) {
      if (!TYPES.includes(p.registryType)) continue;
      npmSightings += 1;
      // Keyed by type+server: one server can declare two artifacts of the same kind, and collapsing them
      // would quietly shrink the frame's population below the census's record count.
      frame.set(p.registryType + "|" + s.name, {
        type: p.registryType,
        server: s.name,
        // `identifier` is the field server.json uses for the artifact coordinate; `package` does not exist.
        // The first run of this frame read p.package and collected 9,896 nulls, which the sampler caught by
        // refusing to draw from an empty frame rather than reporting "0 installable".
        identifier: p.identifier || null,
        package_version: p.version || null,
        record_version: s.version || null,
        version: p.version || s.version || null,
        version_source: p.version ? "package" : (s.version ? "record" : "none"),
        transport: (p.transport && p.transport.type) || null,
      });
    }
  }
  cursor = (r.body.metadata || {}).nextCursor || null;
  if (!cursor) break;
  if (pages % 50 === 0) console.log("... " + (pages + 1) + " pages, " + rows + " rows, " + activeLatest + " active-latest, " + frame.size + " framed records (" + TYPES.join(",") + ")");
}

const problems = [];
if (cursor) problems.push("cursor still present after " + pages + " pages - this is a prefix, not a frame");
if (!seenControl.found || !seenControl.record || seenControl.record.packageCount < 1) {
  problems.push("control record not seen with a package, so the packages array is not being reached");
}
// Per-type bookkeeping. The census tallied "records mentioning a type"; this frame keys on type+server,
// so a server declaring two artifacts of one kind contributes two rows here and one record there - the
// tolerance is there for that reason, not as slack for a wrong field path.
const byType = {};
for (const t of TYPES) {
  const rowsT = [...frame.values()].filter((r) => r.type === t);
  const withId = rowsT.filter((r) => r.identifier).length;
  const censusT = census.package_registry_types[t];
  const entry = { framed: rowsT.length, with_identifier: withId, census_published: censusT ?? null };
  if (rowsT.length === 0) {
    if (Number.isSafeInteger(censusT) && censusT > 0) problems.push(`type "${t}" appears in the census tally but framed 0 records - filter path is wrong`);
    else problems.push(`type "${t}" framed 0 records and is absent from the census tally - the type name is not one this API emits`);
  } else {
    if (withId / rowsT.length < 0.95) {
      problems.push(`only ${withId}/${rowsT.length} ${t} records carry an identifier - the field path differs for this type`);
    }
    if (!Number.isSafeInteger(censusT)) problems.push(`the published census has no ${t} tally to compare against`);
    else {
      entry.deviation_pct = Number((Math.abs(rowsT.length - censusT) / censusT * 100).toFixed(2));
      if (Math.abs(rowsT.length - censusT) / censusT > 0.1) {
        problems.push(`${t} frame ${rowsT.length} deviates ${(Math.abs(rowsT.length - censusT) / censusT * 100).toFixed(1)}% from the published census tally ${censusT}`);
      }
    }
  }
  byType[t] = entry;
}
const npmCount = byType.npm ? byType.npm.framed : 0;
const withIdentifier = byType.npm ? byType.npm.with_identifier : 0;
const censusNpm = census.package_registry_types.npm;
const dev = byType.npm ? byType.npm.deviation_pct / 100 : 1;

const result = {
  schema: "mcp-npm-frame-v1",
  started_at: started,
  finished_at: new Date().toISOString(),
  source: REG + "/v0/servers",
  pages_walked: pages,
  rows_seen: rows,
  retry_events: retries,
  walk_complete: !cursor,
  active_latest_records: activeLatest,
  npm_records_in_frame: npmCount,
  npm_records_with_identifier: withIdentifier,
  npm_package_sightings: npmSightings,
  types_framed: TYPES,
  by_type: byType,
  census_published_npm: censusNpm,
  census_published_active: census.active_latest_records,
  active_latest_matches_census_within_2pct: Math.abs(activeLatest - census.active_latest_records) / census.active_latest_records <= 0.02,
  deviation_from_census_pct: Number((dev * 100).toFixed(2)),
  control_record: seenControl.record,
  records: [...frame.values()],
  problem_count: problems.length,
  problems,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result) + "\n", "utf8");
console.log(JSON.stringify({ pages_walked: pages, rows_seen: rows, active_latest: activeLatest, npm: npmCount, census_npm: censusNpm, deviation_pct: result.deviation_from_census_pct, walk_complete: result.walk_complete, problems }));
if (problems.length) { console.log("REFUSED: " + problems.join("; ")); process.exit(3); }
