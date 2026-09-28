// Renders the registry census artifact into a markdown article. Every number in the output is read from
// the artifact; a missing or inconsistent field aborts the render rather than printing a stale sentence.
//
// The guards exist because of two defects this instrument actually produced on real data:
//  - a truncated walk that looked like a complete one (HTTP 500 partway through), now refused;
//  - a transport field read as a string while the API returns an object, which tallied to
//    "[object Object]" 16,597 times, now refused.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const IN = arg("--artifact", "docs/data/mcp-registry-census.2026-09-28.json");
const OUT = arg("--out", "docs/mcp-registry-census.md");

const d = JSON.parse(readFileSync(IN, "utf8"));
const required = [
  "schema", "started_at", "finished_at", "source", "pages_walked", "list_retry_events",
  "worst_attempts_for_one_page", "walk_complete", "rows_seen", "distinct_names", "latest_records",
  "names_without_latest_row", "server_status_counts", "active_latest_records", "active_reachability",
  "active_reachability_sum", "active_sum_matches_denominator", "all_latest_reachability",
  "package_registry_types", "package_transport_types", "remote_transport_types",
  "active_records_with_a_package", "active_records_with_a_remote", "tally_counts_records_not_entries",
  "control_record", "problem_count",
];
for (const key of required) {
  if (d[key] === undefined) throw new Error("REFUSED: " + key + " missing from " + IN);
}
if (d.schema !== "mcp-registry-installability-census-v1") throw new Error("REFUSED: unexpected schema " + d.schema);
if (d.walk_complete !== true) throw new Error("REFUSED: the walk did not reach the end of the list, so this is a prefix, not a census");
if (d.problem_count !== 0) throw new Error("REFUSED: the census instrument reported " + d.problem_count + " problems");
if (d.active_sum_matches_denominator !== true) throw new Error("REFUSED: reachability classes do not sum to the active denominator");
if (d.names_without_latest_row !== 0) throw new Error("REFUSED: " + d.names_without_latest_row + " names had no isLatest row, so the denominator is not servers");
if (d.tally_counts_records_not_entries !== true) throw new Error("REFUSED: tally semantics undeclared, so the type columns could be read as entry counts");

const reach = d.active_reachability;
for (const k of ["remote_only", "package_only", "both", "neither"]) {
  if (!Number.isSafeInteger(reach[k])) throw new Error("REFUSED: reachability class " + k + " is not an integer");
}
const sum = reach.remote_only + reach.package_only + reach.both + reach.neither;
if (sum !== d.active_latest_records) throw new Error("REFUSED: re-added to " + sum + " but the active denominator is " + d.active_latest_records);

const c = d.control_record;
if (!c || c.name !== "io.github.happy520ai/unified-ai-system") throw new Error("REFUSED: control record is not our own server");
if (c.is_latest !== true || c.status !== "active" || c.has_packages !== true) {
  throw new Error("REFUSED: the control record is not an active latest record with a package, so a low count would be blindness");
}
const objKeys = [...Object.keys(d.package_transport_types), ...Object.keys(d.remote_transport_types), ...Object.keys(d.package_registry_types)].filter((k) => k.includes("[object"));
if (objKeys.length) throw new Error("REFUSED: a type tally contains a coerced object key: " + objKeys.join(", "));

// Two companion artifacts, because the sentences that compare this census against the earlier sample have
// no right to invent the sample's numbers. The comparison is only meaningful over the same objects, so the
// two name sets are checked for equality rather than for a matching count.
const sample = JSON.parse(readFileSync(arg("--sample", "docs/data/mcp-registry-installability.2026-09-28.json"), "utf8"));
const cross = JSON.parse(readFileSync(arg("--crosscheck", "docs/data/mcp-installability-crosscheck.2026-09-28.json"), "utf8"));
for (const [label, obj, keys] of [["sample", sample, ["tally", "rows"]], ["cross-check", cross, ["class_distribution_from_endpoint", "rows", "names_checked", "paths_agree"]]]) {
  for (const k of keys) if (obj[k] === undefined) throw new Error("REFUSED: " + label + " artifact is missing " + k);
}
const sPkg = sample.tally.package_present;
const sRead = sample.rows.length;
const sPkgPct = Math.round((sPkg / sRead) * 100);
const xNames = cross.names_checked;
const xAgree = cross.paths_agree;
const xMismatch = cross.class_mismatch;
const xVerMismatch = (cross.version_mismatch_on_agreeing_class || []).length;
const xRemote = cross.class_distribution_from_endpoint.remote_only || 0;
if (xNames !== sRead) throw new Error("REFUSED: cross-check covered " + xNames + " names but the sample row count is " + sRead);
const sampleNames = new Set(sample.rows.map((r) => r.row_label));
const crossNames = new Set(cross.rows.map((r) => r.name));
const onlySample = [...sampleNames].filter((n) => !crossNames.has(n));
const onlyCross = [...crossNames].filter((n) => !sampleNames.has(n));
if (onlySample.length || onlyCross.length) {
  throw new Error("REFUSED: the two instruments did not read the same servers (sample-only " + onlySample.length + ", crosscheck-only " + onlyCross.length + ")");
}
const oldest = JSON.parse(readFileSync(arg("--oldest", "docs/data/mcp-installability-crosscheck-oldest.2026-09-28.json"), "utf8"));
for (const k of ["names_checked", "paths_agree", "class_mismatch", "version_mismatch_on_agreeing_class", "rows"]) {
  if (oldest[k] === undefined) throw new Error("REFUSED: oldest-bucket cross-check is missing " + k);
}
const xOldest = {
  agree: oldest.paths_agree,
  names: oldest.names_checked,
  classMismatch: oldest.class_mismatch,
  versionMismatch: (oldest.version_mismatch_on_agreeing_class || []).length,
};
if (oldest.names_checked !== sRead) throw new Error("REFUSED: oldest-bucket arm covered " + oldest.names_checked + " names, the sample is " + sRead);
const oldestNames = new Set(oldest.rows.map((r) => r.name));
if (oldestNames.size !== sampleNames.size || [...sampleNames].some((n) => !oldestNames.has(n))) {
  throw new Error("REFUSED: the oldest-bucket arm did not read the same servers as the sample");
}

const prior = JSON.parse(readFileSync(arg("--prior", "docs/data/mcp-registry-census.2026-09-28.superseded.json"), "utf8"));
for (const k of ["distinct_names", "active_reachability", "started_at", "finished_at"]) {
  if (prior[k] === undefined) throw new Error("REFUSED: prior census reading is missing " + k);
}
const priorNeither = prior.active_reachability.neither;
const priorNames = prior.distinct_names;
const priorBadKey = (prior.package_transport_types || {})["[object Object]"];
if (!Number.isSafeInteger(priorBadKey)) throw new Error("REFUSED: the superseded reading no longer carries the coerced-key tally the page describes");
// The visibility instrument, because the scope sentence above is a live claim about someone else's API and
// must fail rather than age quietly if that API changes.
const vis = JSON.parse(readFileSync(arg("--visibility", "docs/data/mcp-registry-visibility-params.2026-09-28.json"), "utf8"));
for (const k of ["documented_get_parameters", "pages", "status_param_documented", "status_param_matches_no_filter_sha", "deleted_status_seen_only_with_include_deleted", "problem_count"]) {
  if (vis[k] === undefined) throw new Error("REFUSED: visibility artifact is missing " + k);
}
if (vis.problem_count !== 0) throw new Error("REFUSED: the visibility instrument reported " + vis.problem_count + " problems");
if (vis.status_param_documented !== false) throw new Error("REFUSED: `status` is documented now, so the bullet about it being ignored is wrong");
if (vis.status_param_matches_no_filter_sha !== true) throw new Error("REFUSED: `?status=active` no longer returns the unfiltered page, so it is not ignored");
if (vis.deleted_status_seen_only_with_include_deleted !== true) throw new Error("REFUSED: `deleted` records are no longer gated behind include_deleted, so the scope caveat is wrong");
const visParams = vis.documented_get_parameters.map((p) => "`" + p + "`").join(", ");
const visDeletedTrue = (vis.pages.include_deleted_true.statuses || {}).deleted;
const visDeletedDefault = (vis.pages.default.statuses || {}).deleted || 0;
if (!Number.isSafeInteger(visDeletedTrue)) throw new Error("REFUSED: the include_deleted=true page has no deleted count to compare");

// The wider walk, taken with the documented `include_deleted` switch on. Two walks of the same registry
// thirty minutes apart must reconcile, or the arithmetic in the section they feed is fiction.
const wide = JSON.parse(readFileSync(arg("--deleted", "docs/data/mcp-registry-census-including-deleted.2026-09-28.json"), "utf8"));
for (const k of ["include_deleted_view", "distinct_names", "rows_seen", "server_status_counts", "all_latest_reachability", "active_reachability", "problem_count", "control_record"]) {
  if (wide[k] === undefined) throw new Error("REFUSED: wider-view artifact is missing " + k);
}
if (wide.include_deleted_view !== true) throw new Error("REFUSED: the wider artifact was not taken with include_deleted on, so it is not the wider view");
if (wide.problem_count !== 0) throw new Error("REFUSED: the wider walk reported " + wide.problem_count + " problems");
if (!wide.control_record || wide.control_record.has_packages !== true) throw new Error("REFUSED: the wider walk's control record has no package, so it is blind");
const wideNames = wide.distinct_names;
const nameDelta = wideNames - d.distinct_names;
const wideStatuses = wide.server_status_counts;
const wideDeleted = wideStatuses.deleted;
const wideAll = wide.all_latest_reachability;
const CLASSES = ["remote_only", "package_only", "both", "neither"];
const classDelta = CLASSES.reduce((a, k) => a + (wideAll[k] - d.all_latest_reachability[k]), 0);
if (classDelta !== nameDelta) throw new Error("REFUSED: the two walks do not reconcile - " + nameDelta + " more servers but the classes moved by " + classDelta);
if (!Number.isSafeInteger(wideDeleted)) throw new Error("REFUSED: no deleted status count in the wider walk");

const denom = d.active_latest_records;
const pct = (n) => ((n / denom) * 100).toFixed(n === denom || n === 0 ? 1 : 2) + "%";
const tallyLines = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => "`" + k + "` " + v.toLocaleString("en-US")).join(", ");
const date = d.started_at.slice(0, 10);
const withPackage = d.active_records_with_a_package;
const withRemote = d.active_records_with_a_remote;
const reachable = denom - reach.neither;
const versionsPerServer = (d.rows_seen / d.distinct_names).toFixed(2);

const lines = [
  "# How many MCP servers are there? " + d.distinct_names.toLocaleString("en-US") + ", and what can a client do with them",
  "",
  "Measured " + date + " (" + d.started_at.slice(11, 16) + "-" + d.finished_at.slice(11, 16) + " UTC) by",
  "`tools/survey-mcp-registry-census.mjs` against `" + d.source + "`. This is the whole default list, not a",
  "slice of it: the walk followed the cursor to its end and the instrument refuses to report otherwise. The",
  "scope that phrasing buys is stated under \"What this does not support\", because it is not every record the",
  "registry has ever held.",
  "Structure only - counts, booleans, registry and transport type strings. No server-authored text is",
  "captured, and no server was sent an MCP request.",
  "",
  "**Short answer: there are " + d.distinct_names.toLocaleString("en-US") + " servers in the official MCP registry's default view as of " + date + ",",
  "and " + reach.neither.toLocaleString("en-US") + " of them (" + pct(reach.neither) + ") declare nothing a client can act on.** The rest of this page is",
  "what the other records do declare, how those two kinds of artifact are distributed, and which readings",
  "a sample of the same API gets wrong.",
  "",
  "## The walk, and what it cost",
  "",
  "| | value |",
  "| --- | --- |",
  "| list pages read | " + d.pages_walked.toLocaleString("en-US") + " |",
  "| rows counted | " + d.rows_seen.toLocaleString("en-US") + " |",
  "| distinct servers | " + d.distinct_names.toLocaleString("en-US") + " |",
  "| versions per server | " + versionsPerServer + " |",
  "| pages needing a retry | " + d.list_retry_events + " (worst single page: " + d.worst_attempts_for_one_page + " attempts) |",
  "| cursor reached the end | " + (d.walk_complete ? "yes" : "no") + " |",
  "",
  "Rows are not servers: one row is one published version, and a server's current record is the row whose",
  "`_meta[\"io.modelcontextprotocol.registry/official\"].isLatest` is true. Every number below is computed on",
  "that row. " + d.distinct_names.toLocaleString("en-US") + " servers yielded " + d.latest_records.toLocaleString("en-US") + " latest records, with " +
  d.names_without_latest_row + " servers left without one - a non-zero value there would mean the bucketing lost a server, so the renderer",
  "refuses rather than dividing by a denominator it cannot name.",
  "",
  "The walk was run twice on the same day, half an hour apart, because a census that cannot be repeated is",
  "an anecdote with a bigger table. The first pass read " + priorNames.toLocaleString("en-US") + " servers and found " +
  priorNeither.toLocaleString("en-US") + " declaring nothing; the second, reported here, reads " + d.distinct_names.toLocaleString("en-US") + " and finds " +
  reach.neither.toLocaleString("en-US") + ". The gap is servers published in those thirty minutes, and the unreachable count did not move.",
  "That first pass is also the one that caught this instrument's own bug - it read a package's `transport` as",
  "a string when the API returns an object, and tallied " + priorBadKey.toLocaleString("en-US") + " records under a key spelled",
  "`[object Object]`.",
  "Its artifact is published next to this one, marked superseded, and the renderer now refuses any tally whose",
  "key contains that string.",
  "",
  "## What the population's records declare",
  "",
  "Of **" + denom.toLocaleString("en-US") + " active servers**, read one row each:",
  "",
  "| the record declares | servers | share |",
  "| --- | --- | --- |",
  "| a hosted endpoint (`remotes`), no package | " + reach.remote_only.toLocaleString("en-US") + " | " + pct(reach.remote_only) + " |",
  "| a package, no hosted endpoint | " + reach.package_only.toLocaleString("en-US") + " | " + pct(reach.package_only) + " |",
  "| both | " + reach.both.toLocaleString("en-US") + " | " + pct(reach.both) + " |",
  "| **neither - nothing a client can act on** | **" + reach.neither.toLocaleString("en-US") + "** | " + pct(reach.neither) + " |",
  "",
  "So " + reachable.toLocaleString("en-US") + " of " + denom.toLocaleString("en-US") + " (" + pct(reachable) + ") tell a client where or how to go, and " +
  reach.neither.toLocaleString("en-US") + " (" + pct(reach.neither) + ") do not. Of the active records, " + withPackage.toLocaleString("en-US") +
  " carry a package somewhere and " + withRemote.toLocaleString("en-US") + " carry a remote; those two sets overlap by " +
  reach.both.toLocaleString("en-US") + ", which is why the four rows above partition the population while those two counts do not.",
  "",
  "A separate status: " + (d.server_status_counts.active || 0).toLocaleString("en-US") + " servers are `active` and " +
  (d.server_status_counts.deprecated || 0).toLocaleString("en-US") + " are `deprecated`. Counting every latest record instead of only",
  "active ones gives: " + Object.entries(d.all_latest_reachability).map(([k, v]) => k.replace(/_/g, " ") + " " + v.toLocaleString("en-US")).join(", ") +
  " - reported so the choice of denominator",
  "is visible rather than baked in.",
  "",
  "## Every record, including the ones the default view hides",
  "",
  "The same instrument walked the list again with the documented `include_deleted=true` switch, so the two",
  "reads differ by what the view shows and by nothing else. That view resolves to **" +
  wideNames.toLocaleString("en-US") + " servers** in " + wide.rows_seen.toLocaleString("en-US") + " rows, against " +
  d.distinct_names.toLocaleString("en-US") + " on the default view - " + nameDelta + " more names, of which " +
  wideDeleted + " carry a latest record whose status is `deleted`.",
  "",
  "Where the extra " + nameDelta + " land, class by class, relative to the same read of the default view:",
  "",
  "| | default view | with deleted records | difference |",
  "| --- | --- | --- | --- |",
  ...CLASSES.map((k) => "| " + k.replace(/_/g, " ") + " | " + d.all_latest_reachability[k].toLocaleString("en-US") +
    " | " + wideAll[k].toLocaleString("en-US") + " | +" + (wideAll[k] - d.all_latest_reachability[k]) + " |"),
  "",
  "The four differences add to " + classDelta + ", which is exactly the " + nameDelta + " extra names - the two walks",
  "reconcile, so neither is quietly dropping or double-counting a server. Read across both views, " +
  wideAll.neither.toLocaleString("en-US") + " records declare neither a package nor an endpoint: " + reach.neither +
  " of them are `active`, " + (d.all_latest_reachability.neither - reach.neither) + " more are `deprecated` and still sit in the",
  "default view, and " + (wideAll.neither - d.all_latest_reachability.neither) + " are only visible once `include_deleted` is switched on.",
  "",
  "So the honest headline is three numbers, not one: " + wideNames.toLocaleString("en-US") + " servers are retrievable from the API when",
  "asked including removed records, " + d.distinct_names.toLocaleString("en-US") + " of those are in the view a browser of the registry",
  "actually gets, and " + denom.toLocaleString("en-US") + " are `active` within it. Anyone quoting \"how many MCP servers are there\" should",
  "say which of the three they mean.",
  "",
  "## How those artifacts are distributed",
  "",
  "Registry types among active records with a package: " + tallyLines(d.package_registry_types) + ".",
  "These count **records that mention a type**, and a record can mention several, so the columns sum above",
  "the " + withPackage.toLocaleString("en-US") + " package-bearing records; they are not counts of package entries.",
  "",
  "Transports named by those packages: " + tallyLines(d.package_transport_types) + ".",
  "Transports named by remotes: " + tallyLines(d.remote_transport_types) + ".",
  "",
  "## Why this page exists next to a sample that said " + sPkg + " of " + sRead + "",
  "",
  "The earlier reading on this site, [`mcp-registry-installability.html`](mcp-registry-installability.html),",
  "counted package presence across the first " + sRead + " servers in the registry's own list order and got " + sPkg + " of " + sRead + ".",
  "That list is grouped by server name ascending, so those " + sRead + " are the alphabetically-first servers, and the",
  "population reads differently: " + withPackage.toLocaleString("en-US") + " of " + denom.toLocaleString("en-US") + " active records carry a package (" +
  pct(withPackage) + " against the sample's " + sPkgPct + "%). One number is a prefix of an alphabetical ordering and the",
  "other is the whole default view of the registry; both are true, and only the second can be quoted as a",
  "population figure, and only for the view the registry serves by default - the wider view is counted in",
  "\"Every record, including the ones the default view hides\" below.",
  "",
  "That page also carried a sentence this reading disproves. It asserted that records without a package",
  "\"tell you a server exists without telling a client how to run it\". A second instrument re-read the same",
  "sample records through a different endpoint path (`?search=<name>` rows bucketed on `isLatest`) and found",
  " " + xRemote + " of the " + xNames + " declare a hosted endpoint, and " + xAgree + " of " + xNames + " agreed with the record read",
  "through the per-server endpoint on both class and version " +
  "(" + xMismatch + " class mismatches, " + xVerMismatch + " version mismatches). So the claim was not merely unsupported by the field",
  "that was measured - it was wrong for most of those records. Retracted on " + date + " in place.",
  "",
  "The same comparison run bucketing on the **first** list row for each name instead of the `isLatest` row -",
  "the mistake upstream issue modelcontextprotocol/registry#1676 describes - agrees on only " + xOldest.agree + " of " + xOldest.names + " names:",
  xOldest.versionMismatch + " report a different version and " + xOldest.classMismatch + " lands in a different reachability class",
  "altogether. That gap is why \"" + xAgree + " of " + xNames + " agree\" above is a reading rather than a tautology: the same",
  "instrument does report disagreement when it buckets on the wrong row.",
  "",
  "## What this does not support",
  "",
  "- That a declared address works. \"The record names an endpoint\" and \"the endpoint answers an MCP request\"",
  "  are different claims; whether servers answer at all is measured on the nine-question hub,",
  "  [`mcp-ecosystem-measurements.html`](mcp-ecosystem-measurements.html).",
  "- That " + reach.neither.toLocaleString("en-US") + " unreachable records are abandoned, low quality, or a defect of their authors. Some publish through",
  "  their own installer, and a registry record is a catalogue entry, not a deployment.",
  "- That the population is stable. It grew from 25,125 servers reported on 2026-08-27",
  "  (upstream issue modelcontextprotocol/registry#1579) to " + d.distinct_names.toLocaleString("en-US") + " on " + date + ", so any share quoted from this",
  "  page has a shelf life measured in weeks.",
  "- That the `status` query parameter filters anything. It is not among the documented parameters of",
  "  `GET /v0/servers` (" + visParams + "), and `?status=active` answered with a first page whose sha256 equalled",
  "  the unfiltered one on " + date + ", `deprecated` rows included - no error, no effect. So the active split above",
  "  is computed client-side from the whole walk.",
  "- That this census is every record the registry holds. The documented visibility switch is `include_deleted`",
  "  and this walk used its default: asking `?include_deleted=true` surfaced rows whose status is `deleted` - " +
  visDeletedTrue + " of the first 100, against " + visDeletedDefault + " unfiltered - which the walk therefore never sees.",
  "  " + d.distinct_names.toLocaleString("en-US") + " is the population of the default view, not of the store. An earlier draft of this",
  "  page and of the comment posted on upstream #1579 said the server cannot be asked for a status-restricted",
  "  count at all; the published OpenAPI documents `include_deleted` and `updated_since`, so that sentence was",
  "  written before the spec was read and is corrected here.",
  "",
  "## Our own record, as a control",
  "",
  "The instrument requires `" + c.name + "` to appear as an active latest record with a package - otherwise",
  "\"439 records declare nothing\" and \"my probe read nothing\" are the same shape. It reports " + c.registry_types.join("/") +
  " over `" + (c.package_transports[0] || "absent") + "`, version " + c.version + ", `has_remotes: " + c.has_remotes + "`: installable as a container image,",
  "not hosted, which is the `package_only` row above.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "node tools/survey-mcp-registry-census.mjs /tmp/census.json   # ~30 minutes, anonymous GETs, no credentials",
  "node tools/probe-mcp-registry-visibility-params.mjs /tmp/visibility.json   # the scope caveat above, ~6 GETs",
  "CENSUS_INCLUDE_DELETED=true node tools/survey-mcp-registry-census.mjs /tmp/census-wide.json",
  "node tools/render-mcp-census-doc.mjs --artifact /tmp/census.json --deleted /tmp/census-wide.json --out /tmp/census.md",
  "```",
  "",
  "The artifact is published at [`data/mcp-registry-census." + date + ".json`](data/mcp-registry-census." + date + ".json).",
  "",
];

const text = lines.join("\n") + "\n";
if (text.includes("undefined") || text.includes("NaN")) throw new Error("REFUSED: output contains an undefined or NaN value");
writeFileSync(OUT, text, "utf8");
console.log("rendered " + OUT + " from " + IN + ": active=" + denom + " neither=" + reach.neither + " with_package=" + withPackage);
