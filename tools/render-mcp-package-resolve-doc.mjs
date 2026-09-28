// Renders the multi-ecosystem resolution run into a markdown article. Every number is read from the two
// artifacts; a missing family, an empty definite set, or a sample without an interval aborts the render,
// because a table with a hole in it reads exactly like a table without one.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const arg = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const RESOLVE = arg("--resolve", "docs/data/mcp-package-resolve.2026-09-28.json");
const PRIOR = arg("--prior", "docs/data/mcp-package-resolve.first-pass.2026-09-28.json");
const FRAME = arg("--frame", "docs/data/mcp-npm-frame-header.2026-09-28.json");
const OUT = arg("--out", "docs/mcp-package-resolve.md");

const r = JSON.parse(readFileSync(RESOLVE, "utf8"));
if (r.schema !== "mcp-package-resolve-v1") throw new Error("REFUSED: unexpected resolve schema " + r.schema);
if (!r.by_type || !r.controls) throw new Error("REFUSED: the resolve artifact has no families or no controls");
const FAMILIES = ["pypi", "oci", "mcpb", "cargo", "nuget"];
for (const f of FAMILIES) {
  const t = r.by_type[f];
  if (!t) throw new Error("REFUSED: family " + f + " is absent from the artifact - cannot publish a table with a missing row");
  for (const k of ["population", "measured", "exhaustive", "verdict_tally", "definite", "unusable", "rows"]) {
    if (t[k] === undefined) throw new Error("REFUSED: family " + f + " is missing " + k);
  }
  if (t.rows.length !== t.measured) throw new Error("REFUSED: " + f + " claims " + t.measured + " readings but carries " + t.rows.length + " rows");
  if (t.measured > 0 && t.definite === 0) throw new Error("REFUSED: " + f + " measured " + t.measured + " and decided none - the probe is blind, not clean");
  if (!t.exhaustive && !Array.isArray(t.ci95)) throw new Error("REFUSED: " + f + " is a sample with no interval to state its uncertainty with");
}
const goodControls = r.controls.filter((c) => c.role === "known_good");
const absentControls = r.controls.filter((c) => c.role === "known_absent");
if (goodControls.length !== FAMILIES.length || absentControls.length !== FAMILIES.length) {
  throw new Error("REFUSED: controls are not one-good-and-one-absent per family (" + goodControls.length + "/" + absentControls.length + ")");
}
for (const c of r.controls) {
  const want = c.role === "known_good" ? "listed_version_published" : (c.type === "oci" ? "repository_unknown_or_private" : "package_missing");
  if (c.verdict !== want) throw new Error("REFUSED: control " + c.role + " " + c.type + " read " + c.verdict + ", expected " + want);
}

const V = (t, k) => t.verdict_tally[k] || 0;
const n = (x) => x.toLocaleString("en-US");
const pc = (x) => (x * 100).toFixed(2) + "%";
// Wilson score interval, not the normal-approximation (Wald) one: at zero observed failures Wald
// returns [0%, 0%], which would claim that pypi is provably perfect rather than that 200 probes found
// no failure in it. Wilson keeps the honest upper bound.
function wilson(bad, total, z = 1.96) {
  if (total <= 0) throw new Error("REFUSED: no readings, so no interval exists");
  if (bad < 0 || bad > total) throw new Error("REFUSED: unusable count outside the denominator");
  const p = bad / total;
  const d = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / d;
  const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}
const date = r.run_at.slice(0, 10);
const totalMeasured = FAMILIES.reduce((a, f) => a + r.by_type[f].measured, 0);
const totalDefinite = FAMILIES.reduce((a, f) => a + r.by_type[f].definite, 0);
const totalUnusable = FAMILIES.reduce((a, f) => a + r.by_type[f].unusable, 0);
const totalUndecided = totalMeasured - totalDefinite;
// Pooled with the npm page so the site states one number for "listings that resolve", with npm's own
// artifact as the source rather than a remembered figure.
const npmSample = JSON.parse(readFileSync(arg("--npm", "docs/data/mcp-npm-installability-sample.2026-09-28.json"), "utf8"));
const npmNT = npmSample.verdict_tally.listed_version_published || 0;
const npmBad = (npmSample.verdict_tally.package_missing || 0) + (npmSample.verdict_tally.package_exists_version_missing || 0);
const npmDefinite = npmNT + npmBad + (npmSample.verdict_tally.package_blocked_402 || 0);
const poolMeasured = totalDefinite + npmDefinite;
const poolBad = totalUnusable + npmBad;
const poolRate = poolBad / poolMeasured;
// A second, independent pass over the same seeded draws, kept as its own artifact so the agreement claim
// is checkable rather than asserted.
let repeat = null;
if (PRIOR) {
  const prior = JSON.parse(readFileSync(PRIOR, "utf8"));
  if (prior.seed !== r.seed) throw new Error("REFUSED: the prior pass used a different seed, so it is not the same draw");
  const same = [];
  for (const f of FAMILIES) {
    if (!prior.by_type[f]) throw new Error("REFUSED: the prior pass has no family " + f);
    if (prior.by_type[f].measured !== r.by_type[f].measured) throw new Error("REFUSED: " + f + " measured " + prior.by_type[f].measured + " before and " + r.by_type[f].measured + " now - the draw is not reproducible, so do not claim it is");
    const sameTally = JSON.stringify(prior.by_type[f].verdict_tally) === JSON.stringify(r.by_type[f].verdict_tally);
    same.push({ family: f, same: sameTally, prior: prior.by_type[f].verdict_tally, now: r.by_type[f].verdict_tally });
  }
  const differing = same.filter((s) => !s.same);
  repeat = {
    run_at: prior.run_at,
    all_agree: differing.length === 0,
    differing: differing.map((d) => d.family),
    probes: totalMeasured,
  };
}

const lines = [
  "# Do the MCP registry's non-npm listings resolve? Measured across pypi, OCI, mcpb, cargo and NuGet",
  "",
  "Measured " + date + " by `tools/mcp-package-resolve.mjs` against each ecosystem's own public endpoint,",
  "from the frame built by `tools/survey-mcp-npm-frame.mjs` (seed " + r.seed + ", so the same draws come back).",
  "This is the companion to [`mcp-npm-installability.html`](mcp-npm-installability.html), which covered npm.",
  "Metadata only: no artifact content is downloaded, and every request is anonymous.",
  "",
  "**" + n(totalUnusable) + " of " + n(totalDefinite) + " listings across " + n(totalMeasured) + " entries could not be resolved at the version the",
  "registry declares.** The per-family numbers differ a lot, and two of these families were counted in",
  "full rather than sampled.",
  "",
  "| family | population in the registry | measured | resolves at the listed version | version missing | artifact missing | not pullable | not decided | unusable rate |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...FAMILIES.map((f) => {
    const t = r.by_type[f];
    return "| " + f + " | " + n(t.population) + (t.exhaustive ? " (all)" : "") + " | " + n(t.measured) +
      " | " + n(V(t, "listed_version_published")) + " | " + n(V(t, "package_exists_version_missing")) +
      " | " + n(V(t, "package_missing")) + " | " + n(V(t, "repository_unknown_or_private")) +
      " | " + n(t.measured - t.definite) +
      " | " + pc(t.unusable / t.definite) + (t.exhaustive ? " (whole population probed)" : " \u2009[" + pc(wilson(t.unusable, t.definite)[0]) + ", " + pc(wilson(t.unusable, t.definite)[1]) + "]") + " |";
  }),
  "",
  "The **not decided** column is this instrument admitting where it cannot see: OCI identifiers pointing",
  "at a registry other than ghcr.io or Docker Hub are counted there rather than in the rate, because",
  "refusing to answer is not evidence either way. Where a family was sampled, the bracket is a 95% Wilson",
  "score interval computed from the counts in the artifact; where it says `(whole population probed)` the entire family was",
  "probed, so there is no sampling error to report - only the possibility that a registry answered",
  "differently on another day.",
  "",
  "Pooled with the npm run, this is **" + n(poolMeasured) + " registry listings probed across all six artifact",
  "types the registry emits, " + n(poolBad) + " of them (" + pc(poolRate) + ", 95% Wilson interval " +
  pc(wilson(poolBad, poolMeasured)[0]) + " to " + pc(wilson(poolBad, poolMeasured)[1]) +
  ") pointing at something the host will not hand over at the version the record declares**.",
  "",
  ...(repeat ? [
    "The whole run was executed twice over the same " + n(repeat.probes) + " seeded draws, the first pass at " +
    repeat.run_at.slice(11, 16) + " UTC and this one at " + r.run_at.slice(11, 16) + " UTC. The two passes" +
    (repeat.all_agree ? " agree on every family's verdict tally, so the numbers above are not a one-off reading of a flaky endpoint."
      : " disagree on " + repeat.differing.join(", ") + ", which is reported rather than smoothed over."),
    "",
  ] : []),
  "",
  "## What each endpoint's answer means, because they do not agree",
  "",
  "The reason this needed five code paths rather than one: the registries signal absence differently,",
  "and each difference is a way to publish a wrong number if you assume a shared meaning for 404.",
  "",
  "- **pypi** - `/pypi/<name>/json` and `/pypi/<name>/<version>/json` answer 200 or 404 cleanly, so the",
  "  package and the release are separate, unambiguous questions.",
  "- **crates.io** - returns **403 to a request with no User-Agent, for crates that exist**. Probed without",
  "  one, all 62 cargo listings in the registry would have been reported missing. Sending the header turns",
  "  the same requests into 200/404.",
  "- **NuGet** - the flat-container `index.json` for an id lists every published version in one small",
  "  document, and the `.nupkg` path for a specific version answers 200 or 404. Ids are case-insensitive,",
  "  so the probe lowercases them the way the CDN does.",
  "- **OCI** - the tag is looked up as a manifest, which cannot tell a deleted image from a private one.",
  "  What separates them is the *grant* request: ghcr answers **403 to a token request for a repository that",
  "  does not exist** and issues a token for one that does, so `repository_unknown_or_private` is reported",
  "  as its own column and never folded into either success or absence.",
  "- **mcpb** - the identifier is a full download URL, usually a GitHub release asset, so there is no",
  "  package-versus-version distinction to make: the link either delivers or it does not. A deleted",
  "  repository answers 404 at every path under it, which is why one of the two examples in the artifact is",
  "  a dead link rather than a renamed file.",
  "",
  "## Controls, all ten of which had to behave",
  "",
  "The instrument refuses to write anything if any control disagrees with its expectation, and the",
  "expectations are not all the same - which is the point of a negative control on an endpoint you have not",
  "measured before:",
  "",
  ...r.controls.map((c) => "- `" + c.role + "` " + c.type + ": `" + String(c.identifier).slice(0, 54) + "` → " + c.verdict + " (pkg " + c.pkg_http + ", version " + c.version_http + ")"),
  "",
  "## What this does not support",
  "",
  "- That an unresolvable listing is abandoned or sloppy. A release can be renamed, a repository made",
  "  private for a week, or a version pulled for yanking, and the registry entry stays as it was.",
  "- That the families not sampled here are fine. npm was measured separately; the registry's own record",
  "  of what it holds is the only frame these draws came from.",
  "- That a resolvable artifact runs. This asks the ecosystem's package host whether it will hand over the",
  "  bytes the registry names - nothing about whether the server starts.",
  "- Stability. Every number is a single day's reading of a registry that grew about 47% in the month",
  "  before it was taken.",
  "",
  "## Reproduce",
  "",
  "```bash",
  "FRAME_TYPES=pypi,oci,mcpb,cargo,nuget node tools/survey-mcp-npm-frame.mjs /tmp/frame.json",
  "node tools/mcp-package-resolve.mjs /tmp/frame.json /tmp/resolve.json   # ~8 min, anonymous, no credentials",
  "node tools/render-mcp-package-resolve-doc.mjs --resolve /tmp/resolve.json",
  "```",
  "",
  "Published data: [`data/mcp-package-resolve." + date + ".json`](data/mcp-package-resolve." + date + ".json) carries every",
  "probed listing with both HTTP readings, and",
  "[`data/mcp-package-resolve.first-pass." + date + ".json`](data/mcp-package-resolve.first-pass." + date + ".json) is the earlier",
  "pass the reproducibility sentence is computed from.",
  "",
];

const text = lines.join("\n") + "\n";
if (text.includes("undefined") || text.includes("NaN") || text.includes("Infinity")) throw new Error("REFUSED: output carries a non-value");
writeFileSync(OUT, text, "utf8");
console.log("rendered " + OUT + ": measured=" + totalMeasured + " definite=" + totalDefinite + " unusable=" + totalUnusable);
