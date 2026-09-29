// Which visibility parameters does the registry list endpoint actually document and honour?
//
// Why this exists: the census walk reads the DEFAULT view. A first version of its write-up claimed the
// server "cannot be asked" for an active-only count. The published OpenAPI says otherwise - it documents
// `include_deleted` and `updated_since` - and setting include_deleted=true surfaces rows whose status is
// `deleted`, which the default walk never sees. So this records the documented parameter list and what the
// three first-page readings look like, rather than leaving the claim resting on an ad-hoc probe.
//
// Shape note: the arithmetic lives in `evaluate`, pure over {documented, pages, specStatus}, and
// `--replay <artifact>` re-derives a saved artifact from the pages stored in it. That is what lets
// tools/probe-mcp-registry-visibility-params.test.mjs feed a fixture page and prove the tallies read
// `isLatest` rather than any other field - a live run can only ever show that the numbers agree with
// themselves. Replay checks stored-verdict-vs-pages consistency; it cannot show that `pages` was captured
// faithfully, so that half stays with the fixture test.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const REG = "https://registry.modelcontextprotocol.io";
const OFFICIAL = "io.modelcontextprotocol.registry/official";

// The seven first-page readings, in the order the artifact stores them. `version_latest` and `version_bogus`
// exist because the census page now tells a reader about the documented escape hatch, and a reader who learns
// the `status` trap without learning the escape leaves with a problem and no fix.
const READINGS = [
  ["default", ""],
  ["include_deleted_false", "&include_deleted=false"],
  ["include_deleted_true", "&include_deleted=true"],
  ["status_active", "&status=active"],
  ["include_deleted_bogus", "&include_deleted=nope"],
  ["version_latest", "&version=latest"],
  ["version_bogus", "&version=not-a-real-value"],
];

async function json(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const t = await r.text();
  return { status: r.status, text: t, body: (() => { try { return JSON.parse(t); } catch { return null; } })() };
}

// Counted separately from status: the claim this arm exists to support is about which record is
// current, and a page can be all-active and still be mostly superseded versions.
export function latestTally(body) {
  const out = { latest: 0, not_latest: 0 };
  for (const row of (body || {}).servers || []) {
    const meta = ((row._meta || {})[OFFICIAL]) || {};
    if (meta.isLatest === true) out.latest += 1;
    else out.not_latest += 1;
  }
  return out;
}

export function statusTally(body) {
  const out = {};
  for (const e of (body || {}).servers || []) {
    const s = (e._meta || {})[OFFICIAL] || {};
    out[s.status || "absent"] = (out[s.status || "absent"] || 0) + 1;
  }
  return out;
}

// Every claim the census page makes about this endpoint is derived here, so the instrument and the page can
// be checked against each other without a network.
export function evaluate({ documented, pages, specStatus, params = {} }) {
  const problems = [];
  if (specStatus !== 200 || documented.length === 0) problems.push("openapi.json unreadable, so the documented-parameter claim has no source");
  if (!documented.includes("include_deleted")) problems.push("include_deleted is not in the documented parameters - the paragraph this instrument supports would be false");
  if (pages.default.http !== 200 || pages.include_deleted_true.http !== 200) problems.push("a first-page read failed");
  if (pages.include_deleted_bogus.http !== 422) problems.push("include_deleted=nope did not return 422, so the parameter's validation behaviour changed shape");
  if (pages.default.sha256 !== pages.status_active.sha256) problems.push("?status=active is NOT ignored on page 1, so the bullet this instrument supports would be false");
  if ((pages.version_latest.latest.not_latest || 0) > 0) problems.push("?version=latest returned a row with isLatest not true, so the documented escape hatch does not do what the doc says");
  if (pages.version_latest.rows === 0) problems.push("?version=latest returned an empty first page, so nothing can be concluded from it");
  if (pages.version_bogus.rows > 0) problems.push("?version=not-a-real-value returned rows, so version is NOT a real filter and the comparison with ?status= would be wrong");
  if (!documented.includes("version")) problems.push("version is not in the documented parameters, so calling it documented would be false");
  // `updated_since` legs. The filter is judged against the record's `updatedAt`, which is what the readings
  // showed it uses; comparing `publishedAt` instead would report a leak where there is none, because a
  // server updated last week can hold a version published months ago.
  for (const leg of ["updated_since_week", "updated_since_future", "updated_since_bogus"]) {
    if (!pages[leg]) throw new Error(`REFUSED: pages.${leg} is missing, so this artifact predates the updated_since legs and cannot be judged`);
  }
  const week = pages.updated_since_week;
  if (!documented.includes("updated_since")) problems.push("updated_since is not in the documented parameters, so calling it documented would be false");
  if (week.rows === 0) problems.push("?updated_since=<7 days ago> returned an empty first page, so nothing can be concluded about the filter");
  if (params.updated_since_week && week.min_updated_at && week.min_updated_at < params.updated_since_week) {
    problems.push(`?updated_since leaked: a row carries updatedAt ${week.min_updated_at} before the requested ${params.updated_since_week}, so it is not filtering as the page says`);
  }
  if (pages.updated_since_future.rows > 0) problems.push("?updated_since=<30 days in the future> returned rows, so the parameter is not restricting as claimed");
  if (pages.updated_since_bogus.http !== 400) problems.push(`?updated_since=not-a-date answered ${pages.updated_since_bogus.http}, not the 400 the page reports - the bad-input comparison changes`);

  const facts = {
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
    updated_since_param_documented: documented.includes("updated_since"),
    updated_since_week_page: { rows: week.rows, min_updated_at: week.min_updated_at ?? null, min_published_at: week.min_published_at ?? null },
    // Two separate readings, because they answer different questions: does the parameter restrict at all,
    // and which field does it restrict on. The second is reported, not asserted - the page quotes whatever
    // it is, so a future change upstream shows up as a changed sentence rather than a stale one.
    updated_since_filters_by_updated_at: Boolean(params.updated_since_week) && week.rows > 0 && (!week.min_updated_at || week.min_updated_at >= params.updated_since_week),
    updated_since_matches_published_at: Boolean(params.updated_since_week) && Boolean(week.min_published_at) && week.min_published_at >= params.updated_since_week,
    updated_since_future_returns_zero_rows: pages.updated_since_future.rows === 0,
    updated_since_bogus_status: pages.updated_since_bogus.http,
  };
  return { problems, facts };
}

function pageRecord(r, filterParam) {
  const sha = createHash("sha256").update(r.text).digest("hex");
  const rows = (r.body || {}).servers || [];
  const times = (field) => {
    const got = rows.map((e) => ((e._meta || {})[OFFICIAL] || {})[field]).filter((t) => typeof t === "string");
    return got.length ? got.slice().sort()[0] : null;
  };
  return {
    http: r.status,
    rows: rows.length,
    statuses: statusTally(r.body),
    latest: latestTally(r.body),
    cursor: Boolean(((r.body || {}).metadata || {}).nextCursor),
    sha256: sha,
    utf8_bytes: Buffer.byteLength(r.text),
    code_units: r.text.length,
    ...(filterParam ? { filter_param: filterParam, min_updated_at: times("updatedAt"), min_published_at: times("publishedAt") } : {}),
  };
}

function flagValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

// Re-derive a saved artifact from the pages it stored. Exit 4 names a verdict that no longer follows from
// its own inputs, which is what a silently edited or half-regenerated artifact looks like.
function replay(path) {
  const saved = JSON.parse(readFileSync(path, "utf8"));
  const { problems, facts } = evaluate({ documented: saved.documented_get_parameters, pages: saved.pages, specStatus: 200, params: saved.params || {} });
  const drift = [];
  for (const [k, v] of Object.entries(facts)) {
    if (JSON.stringify(saved[k]) !== JSON.stringify(v)) drift.push(k + ": stored " + JSON.stringify(saved[k]) + ", recomputed " + JSON.stringify(v));
  }
  console.log(JSON.stringify({ replay: path, drift_count: drift.length, problem_count: problems.length, recomputed_problems: problems, drift }, null, 2));
  if (drift.length) return 4;
  if (problems.length) return 3;
  return 0;
}

async function run(argv) {
  const out = flagValue(argv, "--out") || argv.find((a) => !a.startsWith("--")) || ".pm/mcp-registry-visibility-params.json";
  const spec = await json(REG + "/openapi.json");
  const op = spec.body && ((spec.body.paths || {})["/v0/servers"] || {}).get;
  const documented = (op && op.parameters ? op.parameters : []).map((p) => p.name);

  const pages = {};
  for (const [label, q] of READINGS) pages[label] = pageRecord(await json(`${REG}/v0/servers?limit=100${q}`));

  // Three legs for `updated_since`. The values are relative to the run, so they are stored in the artifact:
  // a reader has to be able to see which instant the filter was tested against, and `--replay` has to be
  // able to re-derive the verdict from the same numbers rather than from a date it invents now.
  const params = {
    updated_since_week: new Date(Date.now() - 7 * 864e5).toISOString(),
    updated_since_future: new Date(Date.now() + 30 * 864e5).toISOString(),
    updated_since_bogus: "not-a-date",
  };
  for (const label of ["week", "future", "bogus"]) {
    const value = params[`updated_since_${label}`];
    pages[`updated_since_${label}`] = pageRecord(await json(`${REG}/v0/servers?limit=100&updated_since=${encodeURIComponent(value)}`), value);
  }

  const { problems, facts } = evaluate({ documented, pages, specStatus: spec.status, params });
  const result = {
    schema: "mcp-registry-visibility-params-v1",
    run_at: new Date().toISOString(),
    source: REG + "/openapi.json",
    documented_get_parameters: documented,
    pages,
    params,
    ...facts,
    problems,
    problem_count: problems.length,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ documented, statuses_default: pages.default.statuses, statuses_true: pages.include_deleted_true.statuses, latest_default: pages.default.latest, latest_version_latest: pages.version_latest.latest, bogus_rows: pages.version_bogus.rows, status_param_documented: facts.status_param_documented, version_param_documented: facts.version_param_documented, deleted_only_with_flag: facts.deleted_status_seen_only_with_include_deleted, problem_count: problems.length }));
  if (problems.length) { console.log("REFUSED: " + problems.join("; ")); return 3; }
  return 0;
}

// The guard is the whole point of the split: the test imports evaluate and the tallies from here, and an
// import must not trigger a network run.
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const argv = process.argv.slice(2);
  const replayPath = flagValue(argv, "--replay");
  if (argv.includes("--help")) {
    console.log("usage: node tools/probe-mcp-registry-visibility-params.mjs [--out <artifact.json>] | [--replay <artifact.json>]");
    process.exit(0);
  }
  process.exit(replayPath ? replay(replayPath) : await run(argv));
}
