// Which visibility parameters does the registry list endpoint actually document and honour?
//
// Why this exists: the census walk reads the DEFAULT view. A first version of its write-up claimed the
// server "cannot be asked" for an active-only count. The published OpenAPI says otherwise - it documents
// `include_deleted` and `updated_since` - and setting include_deleted=true surfaces rows whose status is
// `deleted`, which the default walk never sees. So this records the documented parameter list and what the
// three first-page readings look like, rather than leaving the claim resting on an ad-hoc probe.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";

const REG = "https://registry.modelcontextprotocol.io";
const OUT = process.argv[2] || ".pm/mcp-registry-visibility-params.json";

async function json(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const t = await r.text();
  return { status: r.status, text: t, body: (() => { try { return JSON.parse(t); } catch { return null; } })() };
}

// Counted separately from status: the claim this arm exists to support is about which record is
// current, and a page can be all-active and still be mostly superseded versions.
function latestTally(body) {
  const out = { latest: 0, not_latest: 0 };
  for (const row of (body || {}).servers || []) {
    const meta = ((row._meta || {})["io.modelcontextprotocol.registry/official"]) || {};
    if (meta.isLatest === true) out.latest += 1;
    else out.not_latest += 1;
  }
  return out;
}

function statusTally(body) {
  const out = {};
  for (const e of (body || {}).servers || []) {
    const s = (e._meta || {})["io.modelcontextprotocol.registry/official"] || {};
    out[s.status || "absent"] = (out[s.status || "absent"] || 0) + 1;
  }
  return out;
}

const spec = await json(REG + "/openapi.json");
const op = spec.body && ((spec.body.paths || {})["/v0/servers"] || {}).get;
const documented = (op && op.parameters ? op.parameters : []).map((p) => p.name);

const pages = {};
for (const [label, q] of [["default", ""], ["include_deleted_false", "&include_deleted=false"], ["include_deleted_true", "&include_deleted=true"], ["status_active", "&status=active"], ["include_deleted_bogus", "&include_deleted=nope"], ["version_latest", "&version=latest"], ["version_bogus", "&version=not-a-real-value"]]) {
  const r = await json(`${REG}/v0/servers?limit=100${q}`);
  const sha = createHash("sha256").update(r.text).digest("hex");
  pages[label] = { http: r.status, rows: ((r.body || {}).servers || []).length, statuses: statusTally(r.body), latest: latestTally(r.body), cursor: Boolean(((r.body || {}).metadata || {}).nextCursor), sha256: sha, utf8_bytes: Buffer.byteLength(r.text), code_units: r.text.length };
}

const problems = [];
if (spec.status !== 200 || documented.length === 0) problems.push("openapi.json unreadable, so the documented-parameter claim has no source");
if (!documented.includes("include_deleted")) problems.push("include_deleted is not in the documented parameters - the paragraph this instrument supports would be false");
if (pages.default.http !== 200 || pages.include_deleted_true.http !== 200) problems.push("a first-page read failed");
if (pages.include_deleted_bogus.http !== 422) problems.push("include_deleted=nope did not return 422, so the parameter's validation behaviour changed shape");
if (pages.default.sha256 !== pages.status_active.sha256) problems.push("?status=active is NOT ignored on page 1, so the bullet this instrument supports would be false");
// The census page tells a reader to filter on isLatest. If ?version=latest also works, the page should
// say so - a reader who learns the trap but not the documented escape leaves with a problem and no fix.
if ((pages.version_latest.latest.not_latest || 0) > 0) problems.push("?version=latest returned a row with isLatest not true, so the documented escape hatch does not do what the doc says");
if (pages.version_latest.rows === 0) problems.push("?version=latest returned an empty first page, so nothing can be concluded from it");
if (pages.version_bogus.rows > 0) problems.push("?version=not-a-real-value returned rows, so version is NOT a real filter and the comparison with ?status= would be wrong");
if (!documented.includes("version")) problems.push("version is not in the documented parameters, so calling it documented would be false");

const result = {
  schema: "mcp-registry-visibility-params-v1",
  run_at: new Date().toISOString(),
  source: REG + "/openapi.json",
  documented_get_parameters: documented,
  pages,
  default_and_include_deleted_false_sha_equal: pages.default.sha256 === pages.include_deleted_false.sha256,
  default_and_include_deleted_true_sha_equal: pages.default.sha256 === pages.include_deleted_true.sha256,
  status_param_matches_no_filter_sha: pages.default.sha256 === pages.status_active.sha256,
  status_param_documented: documented.includes("status"),
  version_param_documented: documented.includes("version"),
  version_latest_returns_only_current: (pages.version_latest.latest.not_latest || 0) === 0 && pages.version_latest.rows > 0,
  version_latest_page: pages.version_latest.latest,
  default_page_latest_mix: pages.default.latest,
  version_bogus_returns_zero_rows: pages.version_bogus.rows === 0,
  deleted_status_seen_only_with_include_deleted: (pages.include_deleted_true.statuses.deleted || 0) > 0 && (pages.default.statuses.deleted || 0) === 0,
  problems,
  problem_count: problems.length,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ documented, statuses_default: pages.default.statuses, statuses_true: pages.include_deleted_true.statuses, status_param_documented: result.status_param_documented, deleted_only_with_flag: result.deleted_status_seen_only_with_include_deleted, problem_count: problems.length }));
if (problems.length) { console.log("REFUSED: " + problems.join("; ")); process.exit(3); }
