// Guard for the registry publish path: `server.json` is what the public MCP directory shows, so an
// identifier pointing at a container tag that was never pushed would tell people to run an artifact
// that does not exist. This checks every OCI reference in the manifest against the registry itself,
// over anonymous HTTPS - no Docker daemon, no credentials.
//
//   node tools/check-registry-artifacts.mjs                    # advisory
//   node tools/check-registry-artifacts.mjs --require-present   # hard gate, run before publishing
//   node tools/check-registry-artifacts.mjs --selftest          # proves the probe separates 200 from 404
//
// GHCR answers 404 for a tag that *does* exist when the request carries no media-type `accept`
// header, which is indistinguishable from "never published". Every read below therefore sends the
// header, and --selftest refuses to pass unless a known tag and a known-absent tag come back apart.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(",");

// `host/namespace/name:tag`, optionally `@digest`. Anything without a dotted host is not an OCI
// reference; anything on a host this check does not read is reported as not_checked rather than
// skipped, because a guard that silently drops rows certifies less than it appears to.
export function parseOciReference(identifier) {
  const text = String(identifier ?? "").trim();
  if (!text.includes("/")) return null;
  const [host, ...rest] = text.split("/");
  if (!host.includes(".") || rest.length === 0) return null;
  if (host !== "ghcr.io") return { host, name: null, reference: null, unsupported: true };
  const path = rest.join("/");
  const atSplit = path.split("@");
  const beforeDigest = atSplit[0];
  const tagSplit = beforeDigest.lastIndexOf(":");
  const hasTag = tagSplit >= 0;
  const name = hasTag ? beforeDigest.slice(0, tagSplit) : beforeDigest;
  const reference = hasTag ? beforeDigest.slice(tagSplit + 1) : (atSplit[1] ?? null);
  if (!name || !reference || name.split("/").length < 2) {
    return { host, name: null, reference: null, unsupported: true };
  }
  return { host, name, reference, scope: `repository:${name}:pull`, unsupported: false };
}

export function classifyStatus(status) {
  if (status === 200) return "present";
  if (status === 404 || status === 405) return "missing";
  return "unknown";
}

export function artifactRows(packages) {
  const rows = [];
  for (const pkg of packages ?? []) {
    const parsed = parseOciReference(pkg.identifier);
    if (!parsed) {
      rows.push({ identifier: pkg.identifier, verdict: "not_checked", detail: "not an OCI reference" });
    } else if (parsed.unsupported) {
      rows.push({ identifier: pkg.identifier, verdict: "not_checked", detail: "a host or reference form this check does not read" });
    } else {
      rows.push({ identifier: pkg.identifier, verdict: null, parsed });
    }
  }
  return rows;
}

async function manifestStatus(parsed, fetchImpl) {
  const call = fetchImpl ?? fetch;
  const tokenUrl = `https://${parsed.host}/token?scope=${encodeURIComponent(parsed.scope)}&service=${parsed.host}`;
  const tokenResponse = await call(tokenUrl, { signal: AbortSignal.timeout(30_000) });
  if (!tokenResponse.ok) return { status: `token-http-${tokenResponse.status}` };
  const { token } = await tokenResponse.json();
  const url = `https://${parsed.host}/v2/${parsed.name}/manifests/${parsed.reference}`;
  const response = await call(url, {
    headers: { accept: MANIFEST_ACCEPT, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  return { status: response.status };
}

export async function probeReference(identifier, fetchImpl) {
  const parsed = parseOciReference(identifier);
  if (!parsed || parsed.unsupported) return { verdict: "not_checked", status: null };
  const { status } = await manifestStatus(parsed, fetchImpl);
  return {
    verdict: typeof status === "number" ? classifyStatus(status) : "unknown",
    status,
  };
}

export async function checkServerJson({ path, fetchImpl } = {}) {
  const text = readFileSync(path ?? fileURLToPath(new URL("../server.json", import.meta.url)), "utf8");
  const manifest = JSON.parse(text);
  const rows = artifactRows(manifest.packages);
  for (const row of rows) {
    if (row.verdict) continue;
    const probed = await probeReference(row.identifier, fetchImpl);
    row.status = probed.status;
    row.verdict = probed.verdict;
    if (probed.verdict === "unknown") {
      row.detail = `registry answered ${probed.status}, which is neither present nor absent`;
    }
  }
  return { version: manifest.version, rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Exit codes are assigned, never forced with process.exit(): this module has just finished a
  // round of fetches, and on Windows tearing the process down with a libuv handle still closing
  // aborts the run with exit 127 instead of the verdict it printed.
  const argv = process.argv.slice(2);
  const requirePresent = argv.includes("--require-present");
  const pathIndex = argv.indexOf("--server-json");
  const report = await checkServerJson(pathIndex >= 0 ? { path: argv[pathIndex + 1] } : {});
  for (const row of report.rows) {
    const suffix = row.detail ? `  (${row.detail})` : `  [status ${row.status}]`;
    console.log(`${row.verdict.padEnd(11)} ${row.identifier}${suffix}`);
  }
  const missing = report.rows.filter((row) => row.verdict === "missing");
  const unknown = report.rows.filter((row) => row.verdict === "unknown");

  if (argv.includes("--selftest")) {
    // Both arms have to separate or the probe is blind, and a blind probe must never gate a publish.
    const absent = await probeReference("ghcr.io/happy520ai/unified-ai-system/mcp-server:9.9.9");
    const presentArms = report.rows.filter((row) => row.verdict === "present").length;
    const ok = absent.verdict === "missing" && presentArms > 0;
    console.log(`selftest absent=9.9.9 -> ${absent.verdict} [status ${absent.status}]; present arms=${presentArms}`);
    console.log(ok ? "SELFTEST_OK" : "SELFTEST_FAILED");
    process.exitCode = ok ? 0 : 1;
  } else if (unknown.length > 0) {
    console.log(`undecidable: ${unknown.length} row(s) - an unreadable registry answer is never read as present`);
    process.exitCode = 2;
  } else if (missing.length > 0) {
    console.log(`${requirePresent ? "::error::" : "advisory:"} ${missing.length} identifier(s) point at artifacts the registry does not have`);
    process.exitCode = requirePresent ? 1 : 0;
  } else {
    console.log(`every identifier row is either present or outside what this check reads (${report.rows.length} row(s))`);
    process.exitCode = 0;
  }
}
