// Do the registry's non-npm artifact listings resolve where they say they do?
//
// Companion to `mcp-npm-resolve.mjs`, which covered npm and found 196 of 200 installable at the listed
// version. This one covers the rest of the artifact types the registry emits - pypi, oci, mcpb, cargo,
// nuget - each probed against its own public endpoint, and cargo and nuget measured exhaustively rather
// than sampled because their populations (62 and 129) are small enough to enumerate.
//
// Every family carries two mandatory controls, and the run exits 3 if any of them misbehaves. That rule
// is not decoration: crates.io answers 403 to a request without a User-Agent for names that exist, so an
// uncalibrated probe would have reported every cargo listing in the registry as missing. Each control
// below is a case that was checked by hand on 2026-09-28 before being written into this file.
import { readFileSync, writeFileSync } from "node:fs";

const FRAME = process.argv[2] || ".pm/mcp-package-frame.json";
const OUT = process.argv[3] || ".pm/mcp-package-resolve.json";
const SEED = Number(process.env.SAMPLE_SEED || 20260928);
const SIZES = Object.fromEntries((process.env.SAMPLE_SIZES || "pypi=200,oci=200,mcpb=200,cargo=999,nuget=999").split(",").map((p) => p.split("=")).map(([k, v]) => [k, Number(v)]));
// npm is measured by its own instrument and page; it is framed here only because the same walk collects
// it, and 0 means "do not probe" rather than "probe nothing and call that a result".
const UA = "Mozilla/5.0 (compatible; mcp-registry-installability-probe/1.0; +https://happy520ai.github.io/unified-ai-system/)";

const frame = JSON.parse(readFileSync(FRAME, "utf8"));
if (frame.schema !== "mcp-npm-frame-v1") { console.log("REFUSED: unexpected frame schema " + frame.schema); process.exit(3); }
if (frame.walk_complete !== true) { console.log("REFUSED: the frame is a prefix"); process.exit(3); }
if (frame.problem_count !== 0) { console.log("REFUSED: the frame reported " + frame.problem_count + " problems"); process.exit(3); }
const byType = {};
for (const r of frame.records) { if (r.identifier && r.version) (byType[r.type] = byType[r.type] || []).push(r); }

function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function draw(rows, n, seed) {
  const take = Math.min(n, rows.length);
  if (rows.length > take) {
    const rnd = mul(seed);
    const picked = new Set();
    while (picked.size < take) picked.add(Math.floor(rnd() * rows.length));
    return [...picked].sort((a, b) => a - b).map((i) => rows[i]);
  }
  return rows.slice();
}

async function get(url, opts = {}) {
  for (let i = 0; i < 4; i += 1) {
    try {
      const r = await fetch(url, { method: opts.method || "GET", redirect: "follow", headers: { accept: opts.accept || "application/json", "user-agent": UA, ...(opts.headers || {}) } });
      if (r.status >= 500 && i < 3) { await new Promise((s) => setTimeout(s, 700 * 2 ** i)); continue; }
      await r.body?.cancel?.();
      return r.status;
    } catch (e) { if (i < 3) { await new Promise((s) => setTimeout(s, 700 * 2 ** i)); continue; } return "ERR:" + e.name; }
  }
}

const tagCache = new Map();
async function bearer(host, vRepo) {
  const tokUrl = host === "ghcr.io"
    ? `https://ghcr.io/token?scope=repository:${vRepo}:pull`
    : `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${vRepo}:pull`;
  try {
    const r = await fetch(tokUrl, { headers: { accept: "application/json", "user-agent": UA } });
    let token = null;
    if (r.ok) { try { token = ((await r.json()).token) || null; } catch { token = null; } }
    return { http: r.status, token };
  } catch (e) { return { http: "ERR:" + e.name, token: null }; }
}
async function ociStatuses(identifier, version) {
  const ref = identifier.includes(":") ? identifier : identifier + ":" + version;
  const base = ref.replace(/:[^:/]*$/, "");
  const tag = ref.slice(base.length + 1);
  const host = base.split("/")[0];
  const repo = base.slice(host.length + 1);
  if (!repo || host !== "ghcr.io" && host !== "docker.io") return { host, pkg: "unsupported_host", ver: "unsupported_host" };
  const vHost = host === "ghcr.io" ? "ghcr.io" : "registry-1.docker.io";
  const vRepo = host === "docker.io" && !repo.includes("/") ? "library/" + repo : repo;
  const key = host + "/" + vRepo;
  let auth = tagCache.get(key);
  if (auth === undefined) { auth = await bearer(host, vRepo); tagCache.set(key, auth); }
  // Measured on 2026-09-28: ghcr answers the anonymous pull-grant request with 403 when the repository
  // does not exist, and with a token when it does - so "unknown or private" and "tag missing" are
  // separable, and a deleted image is not silently renamed into "version missing".
  if (!auth.token) return { host, pkg: auth.http, ver: "no_token" };
  const h = { accept: "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json", authorization: "Bearer " + auth.token };
  const ver = await get(`https://${vHost}/v2/${vRepo}/manifests/${tag}`, { headers: h });
  return { host, pkg: auth.http, ver };
}

// Two answers per record: does the artifact coordinate exist at all, and is the listed release there.
async function probe(rec) {
  const id = rec.identifier, v = rec.version;
  if (rec.type === "pypi") {
    const pkg = await get(`https://pypi.org/pypi/${encodeURIComponent(id)}/json`);
    const ver = await get(`https://pypi.org/pypi/${encodeURIComponent(id)}/${encodeURIComponent(v)}/json`);
    return { pkg, ver };
  }
  if (rec.type === "cargo") {
    const pkg = await get(`https://crates.io/api/v1/crates/${encodeURIComponent(id)}`);
    const ver = await get(`https://crates.io/api/v1/crates/${encodeURIComponent(id)}/${encodeURIComponent(v)}`);
    return { pkg, ver };
  }
  if (rec.type === "nuget") {
    const low = id.toLowerCase();
    const pkg = await get(`https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(low)}/index.json`);
    const ver = await get(`https://api.nuget.org/v3-flatcontainer/${encodeURIComponent(low)}/${encodeURIComponent(v)}/${encodeURIComponent(low)}.${encodeURIComponent(v)}.nupkg`);
    return { pkg, ver };
  }
  if (rec.type === "mcpb") {
    if (!/^https:\/\//.test(id)) return { pkg: "not_https_url", ver: "not_https_url" };
    const pkg = await get(id, { accept: "*/*" });
    return { pkg, ver: pkg };
  }
  if (rec.type === "oci") return await ociStatuses(id, v);
  return { pkg: "unknown_type", ver: "unknown_type" };
}

function verdictOf(type, pkg, ver) {
  if (type === "oci") {
    // The grant endpoint is the repository test, so the two kinds of absence are not folded together:
    // 403 on the token means the repository is unknown-or-private (uninstallable, but not provably
    // deleted), while 404 on the tag with a working grant means the image is there and the pinned
    // version is not.
    if (pkg === 200 && ver >= 200 && ver < 400) return "listed_version_published";
    if (pkg === 200 && ver === 404) return "package_exists_version_missing";
    if (pkg === 403) return "repository_unknown_or_private";
    return "oci_probe_" + pkg + "_" + ver;
  }
  if (typeof pkg === "string" || typeof ver === "string") return "transport_error";
  if (pkg === 404) return "package_missing";
  if (pkg === 401 || pkg === 403) return "access_denied_" + pkg;
  if (pkg >= 200 && pkg < 400 && ver >= 200 && ver < 400) return "listed_version_published";
  if (pkg >= 200 && pkg < 400 && ver === 404) return "package_exists_version_missing";
  if (pkg >= 500 || ver >= 500) return "server_error";
  return "other_http_" + pkg + "_" + ver;
}

const CONTROLS = [
  { role: "known_good", expect: "listed_version_published", type: "pypi", identifier: "requests", version: "2.31.0" },
  { role: "known_good", expect: "listed_version_published", type: "cargo", identifier: "serde", version: "1.0.0" },
  { role: "known_good", expect: "listed_version_published", type: "nuget", identifier: "Newtonsoft.Json", version: "13.0.3" },
  { role: "known_good", expect: "listed_version_published", type: "oci", identifier: "ghcr.io/happy520ai/unified-ai-system/mcp-server", version: "0.8.0" },
  { role: "known_good", expect: "listed_version_published", type: "mcpb", identifier: "https://github.com/underloam/xbbg/releases/download/v1.4.12/xbbg-mcp-v1.4.12.mcpb", version: "1.4.12" },
  { role: "known_absent", expect: "package_missing", type: "pypi", identifier: "qoder-nonexistent-pypi-xzz", version: "1.0.0" },
  { role: "known_absent", expect: "package_missing", type: "cargo", identifier: "qoder-nonexistent-crate-xzz", version: "1.0.0" },
  { role: "known_absent", expect: "package_missing", type: "nuget", identifier: "Qoder.Nonexistent.Xzz", version: "1.0.0" },
  // A repository that does not exist, not a tag that does not: on ghcr the former is refused at the grant
  // endpoint and the latter at the manifest path, and the two must not share an expectation.
  { role: "known_absent", expect: "repository_unknown_or_private", type: "oci", identifier: "ghcr.io/happy520ai/qoder-nonexistent-repo-xzz", version: "1.0.0" },
  { role: "known_absent", expect: "package_missing", type: "mcpb", identifier: "https://github.com/underloam/xbbg/releases/download/v99.99.99/nope.mcpb", version: "9.9.9" },
];

async function main() {
  const controlRows = [];
  for (const c of CONTROLS) {
    const { pkg, ver } = await probe(c);
    controlRows.push({ ...c, pkg_http: pkg, version_http: ver, verdict: verdictOf(c.type, pkg, ver) });
    await new Promise((s) => setTimeout(s, 120));
  }
  const bad = controlRows.filter((c) => c.verdict !== c.expect);
  for (const c of controlRows) console.log("control " + c.role + " " + c.type + " -> " + c.verdict + " (pkg=" + c.pkg_http + " ver=" + c.version_http + ")");
  if (bad.length) { console.log("REFUSED: " + bad.length + " control(s) misbehaved, so this instrument cannot tell presence from absence on those endpoints"); process.exit(3); }

  const out = { controls: controlRows, by_type: {} };
  const PROBED = ["pypi", "oci", "mcpb", "cargo", "nuget"];
  for (const type of Object.keys(byType)) {
    if (!PROBED.includes(type)) { console.log(type + ": not probed by this instrument (npm has its own); skipped rather than recorded as a failure"); continue; }
    const size = SIZES[type];
    if (!size) { console.log(type + ": no size configured, skipped"); continue; }
    const sample = draw(byType[type], size, SEED + type.length);
    const rows = [];
    for (const rec of sample) {
      const { pkg, ver } = await probe(rec);
      rows.push({ ...rec, pkg_http: pkg, version_http: ver, verdict: verdictOf(type, pkg, ver) });
      await new Promise((s) => setTimeout(s, 90));
    }
    const tally = {};
    for (const r of rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
    const DEFINITE_V = ["listed_version_published", "package_missing", "package_exists_version_missing", "repository_unknown_or_private"];
    const definite = rows.filter((r) => DEFINITE_V.includes(r.verdict));
    const unusable = rows.filter((r) => r.verdict !== "listed_version_published" && DEFINITE_V.includes(r.verdict));
    if (rows.length > 0 && definite.length === 0) {
      console.log("REFUSED: " + type + " gave " + rows.length + " readings and none is definite - the probe is blind here, so no rate may be published. tally=" + JSON.stringify(tally));
      process.exit(3);
    }
    const p = definite.length ? unusable.length / definite.length : null;
    // Wilson score interval, not Wald: at zero failures Wald returns [0, 0] and would let the page claim
    // a family is provably perfect on the strength of a sample that simply found no problem in it.
    let ci = null;
    if (p !== null) {
      const z = 1.96, d = 1 + (z * z) / definite.length;
      const centre = (p + (z * z) / (2 * definite.length)) / d;
      const half = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * definite.length)) / definite.length)) / d;
      ci = [Number(Math.max(0, centre - half).toFixed(4)), Number(Math.min(1, centre + half).toFixed(4))];
    }
    out.by_type[type] = {
      population: byType[type].length,
      measured: rows.length,
      exhaustive: rows.length === byType[type].length,
      verdict_tally: tally,
      definite: definite.length,
      unusable: unusable.length,
      unusable_rate: p === null ? null : Number(p.toFixed(4)),
      ci95: ci,
      ci_method: "Wilson score interval, 95%, over the definite readings",
      rows,
    };
    console.log(type + ": measured " + rows.length + "/" + byType[type].length + " " + JSON.stringify(tally));
  }
  out.schema = "mcp-package-resolve-v1";
  out.seed = SEED;
  out.frame_population = frame.records.length;
  out.run_at = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(out) + "\n", "utf8");
  console.log("wrote " + OUT);
}
main();
