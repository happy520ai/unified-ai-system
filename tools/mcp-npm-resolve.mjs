// Do the npm packages the official MCP registry lists actually exist on npm, at the version listed?
//
// Drawn as a seeded simple random sample from the frame built by `mcp-npm-frame.mjs`, which is the only
// defensible way to sample this API: the list is ordered by server name, so paging yields an alphabetical
// prefix rather than a cross-section, and the published census already shows how far apart those two
// shapes are (11% package-bearing in the prefix against 41.85% in the population).
//
// Two probes per sampled package, both cheap and body-free where possible:
//   HEAD  https://registry.npmjs.org/<pkg>          -> does the package exist at all (200 vs 404)
//   GET   https://registry.npmjs.org/<pkg>/<version> -> is the LISTED version published
// Scoped names are percent-encoded, which is what npm's own registry endpoint expects.
//
// Controls are mandatory and the instrument refuses if either misbehaves:
//   known-good  : two packages with widely-known published versions must read exists+version-published;
//   known-absent: a name that cannot exist must read 404. Without it, "N of M listed packages are gone"
//                 is indistinguishable from "my probe cannot reach npm".
import { readFileSync, writeFileSync } from "node:fs";
import { encPkg, classify, isUnusable, isDefinite, waldCi } from "./mcp-npm-probe.mjs";

const FRAME = process.argv[2] || ".pm/mcp-npm-frame.json";
const OUT = process.argv[3] || ".pm/mcp-npm-resolve.json";
const N = Number(process.env.SAMPLE_N || 200);
const SEED = Number(process.env.SAMPLE_SEED || 20260928);

const frame = JSON.parse(readFileSync(FRAME, "utf8"));
if (frame.schema !== "mcp-npm-frame-v1") { console.log("REFUSED: unexpected frame schema " + frame.schema); process.exit(3); }
if (frame.walk_complete !== true) { console.log("REFUSED: the frame is a prefix, so any sample from it is biased"); process.exit(3); }
if (frame.problem_count !== 0) { console.log("REFUSED: the frame instrument reported " + frame.problem_count + " problems"); process.exit(3); }
const records = frame.records.filter((r) => r.identifier && r.version);
if (records.length < N) { console.log(`REFUSED: frame has only ${records.length} usable records, cannot draw ${N}`); process.exit(3); }
if (frame.npm_records_with_identifier !== records.length && Math.abs(frame.npm_records_with_identifier - records.length) > records.length * 0.05) {
  console.log(`REFUSED: the frame says ${frame.npm_records_with_identifier} identifiers but only ${records.length} also carry a version - too big a gap to sample silently`);
  process.exit(3);
}

// mulberry32 - a small deterministic PRNG so the sample is reproducible from the seed alone.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(SEED);
const picked = new Set();
while (picked.size < N) picked.add(Math.floor(rand() * records.length));
const sample = [...picked].sort((a, b) => a - b).map((i) => records[i]);
if (new Set(sample.map((r) => r.server)).size !== sample.length) { console.log("REFUSED: the draw repeated a server, so it is not a simple random sample"); process.exit(3); }

async function headStatus(url) {
  for (let i = 0; i < 4; i += 1) {
    try {
      const r = await fetch(url, { method: "HEAD", headers: { accept: "application/json" } });
      if (r.status >= 500 && i < 3) { await new Promise((res) => setTimeout(res, 800 * 2 ** i)); continue; }
      return r.status;
    } catch (e) { if (i < 3) { await new Promise((res) => setTimeout(res, 800 * 2 ** i)); continue; } return "ERR:" + e.name; }
  }
}
async function versionStatus(url) {
  for (let i = 0; i < 4; i += 1) {
    try {
      // GET, not HEAD: npm answers 404 for a missing *version* only on the GET path; HEAD /<pkg>/<ver>
      // reports the package, not the release, so a HEAD-only probe would silently read every listed
      // version as published.
      // application/json, not the abbreviated-metadata form: on 2026-09-28 npm answered the same
      // version path with 406 under `application/vnd.npm.install-v1+json` on one attempt and 200 on the
      // next, and a 406 must never be reachable from the path that decides "this release is missing".
      const r = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
      if (r.status >= 500 && i < 3) { await new Promise((res) => setTimeout(res, 800 * 2 ** i)); continue; }
      await r.body?.cancel?.();
      return r.status;
    } catch (e) { if (i < 3) { await new Promise((res) => setTimeout(res, 800 * 2 ** i)); continue; } return "ERR:" + e.name; }
  }
}

const CONTROLS_OK = [
  { identifier: "lodash", version: "4.17.21" },
  { identifier: "react", version: "18.3.1" },
];
const CONTROLS_ABSENT = [{ identifier: "qoder-nonexistent-mcp-probe-202609287", version: "9.9.9" }];

async function probe(rec) {
  const base = "https://registry.npmjs.org/" + encPkg(rec.identifier);
  const pkg = await headStatus(base);
  const ver = await versionStatus(base + "/" + encodeURIComponent(rec.version));
  const verdict = classify(pkg, ver);
  return { ...rec, pkg_http: pkg, version_http: ver, verdict };
}

const controlRows = [];
for (const c of CONTROLS_OK) controlRows.push({ ...c, role: "known_good", ...(await probe(c)) });
for (const c of CONTROLS_ABSENT) controlRows.push({ ...c, role: "known_absent", ...(await probe(c)) });

const goodFail = controlRows.filter((r) => r.role === "known_good" && r.verdict !== "listed_version_published");
const absentFail = controlRows.filter((r) => r.role === "known_absent" && r.verdict !== "package_missing");
const transportErrors = controlRows.filter((r) => r.verdict === "transport_error").length;
if (transportErrors) { console.log("REFUSED: " + transportErrors + " control probes never reached npm; the sample would measure nothing"); process.exit(3); }
if (goodFail.length) { console.log("REFUSED: a known-good package did not read as published (" + goodFail.map((r) => r.identifier + "@" + r.version + "=" + r.verdict).join(", ") + "); the verdict path is wrong"); process.exit(3); }
if (absentFail.length) { console.log("REFUSED: the impossible name did not read as missing (" + absentFail.map((r) => r.identifier + "=" + r.verdict).join(", ") + "); 'package_missing' is not evidence of absence"); process.exit(3); }

const rows = [];
for (const rec of sample) rows.push(await probe(rec));

const tally = {};
for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
const definite = rows.filter((r) => isDefinite(r.verdict));
if (definite.length < rows.length * 0.9) { console.log("REFUSED: only " + definite.length + "/" + rows.length + " sampled packages got a definite answer"); process.exit(3); }

// 95% Wald interval on the headline proportion. Denominator = definite readings only, so an npm CDN that
// answers 406 or 5xx cannot quietly dilute the finding; the inconclusive count is published instead.
const bad = rows.filter((r) => isUnusable(r.verdict)).length;
const p = bad / definite.length;
const ci = waldCi(bad, definite.length);

const result = {
  schema: "mcp-npm-resolve-v1",
  run_at: new Date().toISOString(),
  frame: FRAME,
  frame_records: records.length,
  sample_size: rows.length,
  seed: SEED,
  method: "HEAD registry.npmjs.org/<pkg> then GET <pkg>/<listed version>",
  npm_registry: "https://registry.npmjs.org",
  controls: controlRows,
  verdict_tally: tally,
  unresolvable: rows.length - definite.length,
  listed_package_unusable: bad,
  unusable_rate: Number(p.toFixed(4)),
  ci95: [Number(ci[0].toFixed(4)), Number(ci[1].toFixed(4))],
  ci_method: "Wald normal approximation on " + definite.length + " definite readings",
  rows,
};
writeFileSync(OUT, JSON.stringify(result) + "\n", "utf8");
console.log(JSON.stringify({ frame_records: records.length, sampled: rows.length, seed: SEED, tally, unusable: bad, rate: result.unusable_rate, ci95: result.ci95, controls: controlRows.map((r) => r.role + ":" + r.verdict), out: OUT }));
