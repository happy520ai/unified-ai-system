// Renders the npm-resolution sample into a markdown article. Every number comes from the two artifacts;
// a missing or inconsistent field aborts the render instead of publishing a sentence the data lost.
//
// The shape of the finding is why the guards are strict: the headline is reassuring (196 of 200 install),
// and a reassuring number is exactly the kind that gets over-read. So the page is written to keep the
// confidence interval, the un-sampled ecosystems, and "resolves on npm" vs "runs" visibly apart.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const SAMPLE = arg("--sample", "docs/data/mcp-npm-installability-sample.2026-09-28.json");
const HEADER = arg("--frame", "docs/data/mcp-npm-frame-header.2026-09-28.json");
const OUT = arg("--out", "docs/mcp-npm-installability.md");

const s = JSON.parse(readFileSync(SAMPLE, "utf8"));
const f = JSON.parse(readFileSync(HEADER, "utf8"));
for (const k of ["schema", "run_at", "frame_records", "sample_size", "seed", "method", "controls", "verdict_tally", "unresolvable", "listed_package_unusable", "unusable_rate", "ci95", "rows"]) {
  if (s[k] === undefined) throw new Error("REFUSED: sample artifact is missing " + k);
}
for (const k of ["npm_records_in_frame", "rows_seen", "active_latest_records", "deviation_from_census_pct", "walk_complete", "census_published_npm", "problem_count"]) {
  if (f[k] === undefined) throw new Error("REFUSED: frame header is missing " + k);
}
if (s.schema !== "mcp-npm-resolve-v1" || f.schema !== "mcp-npm-frame-v1") throw new Error("REFUSED: unexpected schemas " + s.schema + " / " + f.schema);
if (f.walk_complete !== true) throw new Error("REFUSED: the frame is a prefix, so the sample is biased and must not be published");
if (f.problem_count !== 0) throw new Error("REFUSED: the frame reported " + f.problem_count + " problems");
if (f.deviation_from_census_pct > 2) throw new Error("REFUSED: the frame deviates " + f.deviation_from_census_pct + "% from the published census, so one of the two walks is wrong");
if (s.frame_records !== f.npm_records_in_frame) throw new Error("REFUSED: the sample drew from " + s.frame_records + " records but the frame holds " + f.npm_records_in_frame);

const T = s.verdict_tally;
const sum = Object.values(T).reduce((a, b) => a + b, 0);
if (sum !== s.sample_size) throw new Error("REFUSED: verdict tally sums to " + sum + " but " + s.sample_size + " were drawn");
const good = T.listed_version_published || 0;
const verMissing = T.package_exists_version_missing || 0;
const pkgMissing = T.package_missing || 0;
if (good + verMissing + pkgMissing !== s.sample_size) throw new Error("REFUSED: the three published/missing classes do not account for the draw; something else answered");
if (s.unresolvable !== 0) throw new Error("REFUSED: " + s.unresolvable + " sampled packages never got a definite answer, so the proportion is not over the whole draw");
const [lo, hi] = s.ci95;
if (!(lo >= 0 && hi <= 1 && lo <= s.unusable_rate && s.unusable_rate <= hi)) throw new Error("REFUSED: the interval " + JSON.stringify(s.ci95) + " does not contain the rate " + s.unusable_rate);

const controls = s.controls.map((c) => c.role + ":" + c.verdict);
for (const c of s.controls) {
  if (c.role === "known_good" && c.verdict !== "listed_version_published") throw new Error("REFUSED: control " + c.identifier + " did not read as published");
  if (c.role === "known_absent" && c.verdict !== "package_missing") throw new Error("REFUSED: the impossible name read as " + c.verdict + ", so absence cannot be trusted");
}
const date = s.run_at.slice(0, 10);
// One decimal when the value needs it: 3 of 200 is 1.5%, and rounding that to "2%" would misstate the
// very number this page exists to report.
const pctOf = (n) => {
  const v = (n / s.sample_size) * 100;
  return (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)) + "%";
};
const badRows = s.rows.filter((r) => r.verdict !== "listed_version_published");
const halfWidth = Math.round(((hi - lo) / 2) * 10000) / 100;
// The census number quoted below belongs to a different instrument, so it is read from that artifact
// rather than typed into this page's prose - the mistake that produced the 6-of-54 sentence.
const census = JSON.parse(readFileSync(arg("--census", "docs/data/mcp-registry-census.2026-09-28.json"), "utf8"));
const censusAnyPkg = census.active_records_with_a_package && census.active_latest_records
  ? ((census.active_records_with_a_package / census.active_latest_records) * 100).toFixed(2)
  : null;
if (censusAnyPkg === null) throw new Error("REFUSED: the census artifact has no package-bearing count to compare with");
const censusNeither = census.active_reachability && census.active_reachability.neither;
if (!Number.isSafeInteger(censusNeither)) throw new Error("REFUSED: the census artifact has no neither-count to compare with");
const censusGapMin = Math.round((new Date(f.started_at) - new Date(census.finished_at)) / 60000);
if (!Number.isFinite(censusGapMin)) throw new Error("REFUSED: cannot place the frame walk after the census walk in time");
const prior = JSON.parse(readFileSync(arg("--prior", "docs/data/mcp-registry-installability.2026-09-28.json"), "utf8"));
const priorPkg = prior.tally && prior.tally.package_present;
const priorRows = prior.rows && prior.rows.length;
if (!Number.isSafeInteger(priorPkg) || !Number.isSafeInteger(priorRows)) throw new Error("REFUSED: the earlier sample artifact has no package count to cite");

const lines = [
  "# Can you actually install what the MCP registry lists? " + good + " of " + s.sample_size + " sampled npm packages could",
  "",
  "Measured " + date + " by `tools/survey-mcp-npm-frame.mjs` (the population) and",
  "`tools/mcp-npm-resolve.mjs` (the draw), against `" + s.npm_registry + "`. " + s.method + ".",
  "Seeded random sample, seed " + s.seed + ", so this exact " + s.sample_size + " packages can be drawn again.",
  "No package content was downloaded and no server was contacted - only npm's own registry metadata.",
  "",
  "**Short answer: the npm listings in the official MCP registry are in good shape.** " + pctOf(good) +
  " of the sampled records point at a package that exists on npm *and* publishes the exact version the",
  "registry lists. " + pctOf(verMissing) + " point at a package that exists but not at the listed version, and " +
  pctOf(pkgMissing) + " at a name that is gone. Nothing failed to answer.",
  "",
  "## What was drawn, and why a frame was needed first",
  "",
  "The registry's list endpoint is ordered by server name ascending. Reading a few pages therefore yields",
  "the alphabetically-first servers, and this site has already published a number that got fooled by that:",
  "[the earlier sample](mcp-registry-installability.html) reported " + priorPkg + " of " + priorRows + " records carrying a package, while",
  "[the census](mcp-registry-census.html) of the same API measured " + censusAnyPkg + "% of active records carrying a package of",
  "any kind - " + ((f.npm_records_in_frame / f.active_latest_records) * 100).toFixed(1) + "% of them an npm one. So this measurement starts by walking the whole",
  "list to build the population it samples from:",
  "",
  "| | value |",
  "| --- | --- |",
  "| list pages walked | " + f.pages_walked.toLocaleString("en-US") + " |",
  "| version rows read | " + f.rows_seen.toLocaleString("en-US") + " |",
  "| active latest records | " + f.active_latest_records.toLocaleString("en-US") + " |",
  "| of those, records with an npm package | " + f.npm_records_in_frame.toLocaleString("en-US") + " |",
  "| deviation from the published census's npm tally | " + f.deviation_from_census_pct + "% |",
  "| sampled | " + s.sample_size + " (seed " + s.seed + ") |",
  "",
  "The frame is " + (f.records_bytes / 1e6).toFixed(1) + " MB of identifiers so it is not committed; its header is published, and one command",
  "regenerates it. The frame's npm count lands " + f.deviation_from_census_pct + "% from the census figure of " +
  f.census_published_npm.toLocaleString("en-US") + " that was measured " + censusGapMin + " minutes earlier - an independent walk",
  "reproducing an aggregate, which is the check that says both instruments are reading the same field.",
  "",
  "## The result",
  "",
  "| what npm says about the listed package and version | records | share of the draw |",
  "| --- | --- | --- |",
  "| package exists and the listed version is published | " + good + " | " + pctOf(good) + " |",
  "| package exists, listed version not published | " + verMissing + " | " + pctOf(verMissing) + " |",
  "| package name not found | " + pkgMissing + " | " + pctOf(pkgMissing) + " |",
  "| no answer at all (transport or server error) | " + s.unresolvable + " | " + pctOf(s.unresolvable) + " |",
  "",
  "Unusable rate **" + (s.unusable_rate * 100).toFixed(2) + "%**, 95% confidence interval **[" +
  (lo * 100).toFixed(2) + "%, " + (hi * 100).toFixed(2) + "%]** over " + (s.sample_size - s.unresolvable) +
  " definite readings (" + s.ci_method + "). The interval is the point of drawing " + s.sample_size +
  " rather than a handful: at n=" + s.sample_size + " the finding is ±" + halfWidth +
  " percentage points wide, and quoting the " + (s.unusable_rate * 100).toFixed(2) + "% without it would",
  " overstate what was measured.",
  "",
  "The " + badRows.length + " records that did not resolve are named in the published artifact with both HTTP",
  "readings (package lookup and version lookup), so an author can check their own case rather than take my",
  "word for it. " + verMissing + " are a version the registry lists that npm does not have; " + pkgMissing + " is a name npm",
  "does not have at all.",
  "",
  "## The controls, because a reassuring number deserves the same suspicion",
  "",
  "This instrument was built to be able to fail loudly, and it did - twice, before the draw:",
  "",
  "- **" + controls.join(", ") + "**. Two widely-published packages must read as present at their version, and a",
  "  name that cannot exist must read as absent. Without the second, \"1 package not found\" is",
  "  indistinguishable from \"my probe cannot reach npm\".",
  "- A version probe using npm's abbreviated-metadata `Accept` header answered **406 on one attempt and 200 on",
  "  the next for the same URL**. Read as absence, that would have manufactured a finding about packages that",
  "  install fine. The sampler therefore requests `application/json` and treats any status that is not a",
  "  clean yes/no as inconclusive, which removes it from the denominator rather than diluting the rate.",
  "- A `HEAD` on `/pkg/1.2.3` reports the package, not the release, so a HEAD-only probe would have read every",
  "  missing version as published. The version leg is a GET.",
  "- The first frame walk collected " + f.npm_records_in_frame.toLocaleString("en-US") + " null identifiers because it read `p.package` while the field is",
  "  `identifier`. The sampler refused to draw from it (`frame has only 0 usable records`) instead of",
  "  reporting \"0 installable\" as a discovery.",
  "- Scoped and unscoped forms (`@scope%2fname` and `@scope/name`) both answered 200 against npm on " + date + ",",
  "  so a 404 in this sample cannot be blamed on path encoding.",
  "",
  "## What this does not support",
  "",
  "- That the registry's non-npm listings are fine. " + f.npm_records_in_frame.toLocaleString("en-US") + " npm records were framed and sampled;",
  "  pypi, OCI, `mcpb`, cargo and nuget were not tested at all here.",
  "- That a package that installs is a working server. \"npm will hand over version 1.2.3\" and \"the server",
  "  starts and answers an MCP request\" are different claims; the transport-declaration gap is measured on",
  "  [the census](mcp-registry-census.html), which found " + censusNeither + " active records that declare no way to reach",
  "  them at all. Those are two different failures and this page is about the rarer one.",
  "- That " + (s.unusable_rate * 100).toFixed(2) + "% is stable. It is one draw on one day; the interval already runs",
  "  " + (lo * 100).toFixed(2) + "% to " + (hi * 100).toFixed(2) + "%, and a package unpublished after today would not appear here.",
  "- Any comparison with a directory's install button. No directory was asked anything; this is npm and the",
  "  registry's own metadata.",
  "",
  "## Why this page changes what an earlier page of mine implied",
  "",
  "The sample page on this site argued that a registry listing does not mean the server is installable, and",
  "the census showed its " + priorPkg + "-of-" + priorRows + " framing was an alphabetical artifact rather than an ecosystem fact. This",
  "measurement pushes in the other direction again: where a record does declare an npm package, the listing",
  "is almost always real and almost always at the version given. Recording that is not a hedge - it narrows",
  "the actual problem to the records that declare nothing, and it says the maintainers' publish-time",
  "validation is not silently accepting garbage.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "node tools/survey-mcp-npm-frame.mjs /tmp/frame.json                          # ~17 min, anonymous GETs",
  "node tools/mcp-npm-resolve.mjs /tmp/frame.json /tmp/resolve.json             # ~4 min, seed in the output",
  "node tools/render-mcp-npm-installability-doc.mjs --sample /tmp/resolve.json  # refuses if the controls misbehave",
  "```",
  "",
  "Published data: [`data/mcp-npm-installability-sample." + date + ".json`](data/mcp-npm-installability-sample." + date + ".json)",
  "(the draw, all " + s.sample_size + " records) and [`data/mcp-npm-frame-header." + date + ".json`](data/mcp-npm-frame-header." + date + ".json)",
  "(the population's bookkeeping).",
  "",
];

const text = lines.join("\n") + "\n";
if (text.includes("undefined") || text.includes("NaN")) throw new Error("REFUSED: output contains an undefined or NaN value");
writeFileSync(OUT, text, "utf8");
console.log("rendered " + OUT + ": frame=" + f.npm_records_in_frame + " drawn=" + s.sample_size + " published=" + good + " unusable=" + s.listed_package_unusable + " ci=" + JSON.stringify(s.ci95));
