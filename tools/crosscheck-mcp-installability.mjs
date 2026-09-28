// Member-level cross-check between two independent ways of reading the same registry records.
//
// The census derives a server's class from LIST rows (bucketed on the row whose isLatest marker is true).
// The 2026-09-28 sample derived it from `/v0/servers/{name}/versions/latest`. Same objects, different HTTP
// paths, so agreement is evidence and disagreement is a bug in one of them - which is the point: an
// aggregate that no member-level instrument reproduces is a number, not a measurement.
//
// Third path in the same loop: `GET /v0/servers?search=<name>`, which is the path upstream issue
// modelcontextprotocol/registry#1676 says returns superseded versions interleaved. It is exercised here
// because the census's bucketing rule (take the isLatest row) has to survive exactly that behaviour.
import { readFileSync, writeFileSync } from "node:fs";

const REG = "https://registry.modelcontextprotocol.io";
const SAMPLE = process.argv[2] || "docs/data/mcp-registry-installability.2026-09-28.json";
const OUT = process.argv[3] || ".pm/mcp-installability-crosscheck.json";

const sample = JSON.parse(readFileSync(SAMPLE, "utf8"));
const names = sample.rows.map((r) => r.row_label);
if (names.length < 40) { console.log("REFUSED: sample has " + names.length + " rows, too thin to cross-check"); process.exit(3); }

async function getJson(url) {
  for (let i = 0; i < 4; i += 1) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      const t = await r.text();
      if (r.ok) return { status: r.status, body: JSON.parse(t) };
      if (i < 3) await new Promise((res) => setTimeout(res, 1200 * 2 ** i));
      else return { status: r.status, error: t.slice(0, 80) };
    } catch (e) {
      if (i < 3) await new Promise((res) => setTimeout(res, 1200 * 2 ** i));
      else return { status: 0, error: e.name };
    }
  }
}

const classify = (s) => {
  const pkg = Array.isArray(s.packages) && s.packages.length > 0;
  const rem = Array.isArray(s.remotes) && s.remotes.length > 0;
  if (pkg && rem) return "both";
  if (pkg) return "package_only";
  if (rem) return "remote_only";
  return "neither";
};

// Which row of a server's version list is treated as "the record".
//   latest (default) - the row whose isLatest marker is true, which is the record a consumer should show.
//   oldest          - the FIRST row carrying that name, which is what a consumer gets if it forgets to
//                     filter (upstream issue modelcontextprotocol/registry#1676).
// The second mode exists so "54 of 54 agree" is a discriminating reading rather than a tautology: if
// bucketing on the wrong row produced the same classes everywhere, this instrument would have no way to
// show that the isLatest rule is load-bearing.
const BUCKET = process.argv[4] || "latest";

const rows = [];
for (const name of names) {
  const enc = encodeURIComponent(name);
  const lat = await getJson(`${REG}/v0/servers/${enc}/versions/latest`);
  const search = await getJson(`${REG}/v0/servers?search=${enc}&limit=100`);
  const latS = lat.body && lat.body.server;
  const hits = ((search.body || {}).servers || []).filter((e) => e.server && e.server.name === name);
  const latestHits = hits.filter((e) => (e._meta || {})["io.modelcontextprotocol.registry/official"]?.isLatest === true);
  const picked = BUCKET === "oldest" ? hits.slice(0, 1) : latestHits;
  const row = {
    name,
    bucket_mode: BUCKET,
    versions_latest_http: lat.status,
    search_http: search.status,
    search_rows_for_this_name: hits.length,
    search_latest_rows_for_this_name: latestHits.length,
    class_from_versions_latest_endpoint: latS ? classify(latS) : "unreadable",
    class_from_search_list_rows: picked.length === 1 ? classify(picked[0].server) : (picked.length === 0 ? "no_latest_row" : "ambiguous_multiple_latest"),
    version_from_versions_latest: latS ? latS.version : null,
    version_from_search_latest_row: picked.length === 1 ? picked[0].server.version : null,
  };
  row.paths_agree = row.class_from_versions_latest_endpoint === row.class_from_search_list_rows
    && row.version_from_versions_latest === row.version_from_search_latest_row;
  rows.push(row);
}

const agree = rows.filter((r) => r.paths_agree).length;
const classMismatch = rows.filter((r) => !r.paths_agree && r.class_from_versions_latest_endpoint !== r.class_from_search_list_rows);
const versionMismatch = rows.filter((r) => r.class_from_versions_latest_endpoint === r.class_from_search_list_rows && r.version_from_versions_latest !== r.version_from_search_latest_row);
const noLatestInSearch = rows.filter((r) => r.class_from_search_list_rows === "no_latest_row").length;
const ambiguous = rows.filter((r) => r.class_from_search_list_rows === "ambiguous_multiple_latest").length;
const unreadable = rows.filter((r) => r.class_from_versions_latest_endpoint === "unreadable").length;

const result = {
  schema: "mcp-installability-crosscheck-v1",
  run_at: new Date().toISOString(),
  sample_artifact: SAMPLE,
  names_checked: rows.length,
  paths_agree: agree,
  class_mismatch: classMismatch.length,
  version_mismatch_on_agreeing_class: versionMismatch.map((r) => ({ name: r.name, from_endpoint: r.version_from_versions_latest, from_search: r.version_from_search_latest_row })),
  search_returned_no_latest_row: noLatestInSearch,
  search_returned_multiple_latest_rows: ambiguous,
  versions_latest_endpoint_unreadable: unreadable,
  class_distribution_from_endpoint: rows.reduce((a, r) => { a[r.class_from_versions_latest_endpoint] = (a[r.class_from_versions_latest_endpoint] || 0) + 1; return a; }, {}),
  rows,
};
writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  names_checked: rows.length, paths_agree: agree, class_mismatch: classMismatch.length,
  version_mismatch: versionMismatch.length, no_latest_row: noLatestInSearch, multiple_latest: ambiguous,
  unreadable, distribution: result.class_distribution_from_endpoint, out: OUT,
}));
// This instrument exists to report a disagreement, so a run that cannot show one has not been proven to
// work: refuse unless at least one name is a live reading from both paths.
const bothPathsReadable = rows.filter((r) => r.class_from_versions_latest_endpoint !== "unreadable" && r.class_from_search_list_rows !== "no_latest_row").length;
if (bothPathsReadable < names.length * 0.5) {
  console.log(`REFUSED: only ${bothPathsReadable} of ${names.length} names readable through both paths - the comparison is blind, not clean`);
  process.exit(3);
}
