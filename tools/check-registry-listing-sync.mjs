// Is our row in the official MCP Registry still ours, and is the newest one what we publish?
//
// Why this exists: registry search matches the `name` field (measured 2026-09-29: every returned
// row of an uncapped term name-matched, and a 3,000-server sample had 230 description-only mentions
// with zero surfaced). So that row is the whole listing, and losing it - or having the newest slot
// not be ours - loses the channel. Issue #207.
//
// The registry answers one row PER VERSION, so "the row" is the one with `isLatest: true`. The first
// draft of this tool matched the first name hit and reported our 0.8.0 listing as not_latest because
// it had picked up 0.3.1. That false alarm is why `pickLatest` is separate and why the tests below
// feed it a multi-version listing rather than one tidy row.
//
// Deliberate calibration, so the nightly is not trained to ignore red:
//   no row, or no row marked latest, or not active  -> exit 4, about us.
//   registry newest != manifest version, or older syndicated text -> reported, NOT red: publishing a
//       new record is version-gated ("cannot publish duplicate version"), so this clears at the next
//       release and reddening it nightly would push an owner decision through CI noise.
//   network/schema failure                          -> exit 2, environment.
//
//   node tools/check-registry-listing-sync.mjs [--manifest server.json] [--output FILE] [--offline FILE]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY = "https://registry.modelcontextprotocol.io/v0/servers";
const OFFICIAL = "io.modelcontextprotocol.registry/official";

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Pure: version numbers as dotted triples, or null when the shape is not ours to compare. */
export function parseVersion(value) {
  const parts = String(value ?? "").split(".");
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/u.test(p))) return null;
  return parts.map(Number);
}

/** Pure: the registry answers per-version rows; the listing a client sees is the isLatest one. */
export function pickLatest(rows, name) {
  if (!Array.isArray(rows)) return { error: "unreadable", detail: "response had no servers array", versions: [], row: null };
  const mine = rows.filter((r) => String(r?.server?.name ?? "") === String(name));
  const versions = mine.map((r) => String(r?.server?.version ?? "?"));
  const row = mine.find((r) => r?._meta?.[OFFICIAL]?.isLatest === true) ?? null;
  return { error: null, detail: "", versions, rows_for_name: mine.length, row, scanned: rows.length };
}

/** Pure: compare the listing a client would see against the manifest we publish. */
export function compareManifest(picked, manifest) {
  if (picked.error) return { state: "unreadable", red: false, fields: [], note: picked.detail };
  if (picked.rows_for_name === 0) return { state: "absent", red: true, fields: [`no row named ${manifest.name}`], note: "the registry does not list this name at all" };
  if (!picked.row) return { state: "no_latest", red: true, fields: [`versions seen: ${picked.versions.join(", ")}, none marked isLatest`], note: "the registry should flag exactly one version as latest" };

  const server = picked.row.server || {};
  const official = picked.row._meta?.[OFFICIAL] || {};
  if (String(official.status ?? "active") !== "active") return { state: "not_active", red: true, fields: [`status=${official.status}`], note: "the newest record is not active" };

  const registry = String(server.version ?? "");
  const want = String(manifest.version ?? "");
  const fields = [];
  if (registry !== want) {
    const [a, b] = [parseVersion(registry), parseVersion(want)];
    const behind = a && b && (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2]))));
    fields.push(`registry newest=${registry}, manifest=${want}${behind ? " (registry behind the manifest)" : ""}`);
    return { state: "publish_pending", red: false, fields, note: "publishing a new record is version-gated, so this clears at the next release" };
  }
  if (String(server.description ?? "") !== String(manifest.description ?? "")) fields.push("description differs from server.json");
  if (String(server.title ?? "") !== String(manifest.title ?? "")) fields.push("title differs from server.json");
  if (fields.length > 0) return { state: "text_drift", red: false, fields, note: "same version, older syndicated copy; clears at the next publish" };
  return { state: "synced", red: false, fields: [], note: "" };
}

async function fetchRows(name, fetchImpl) {
  const url = `${REGISTRY}?search=${encodeURIComponent(name)}&limit=50`;
  const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`registry answered HTTP ${res.status}`);
  const body = await res.json();
  return body?.servers;
}

export async function run({ manifest, fetchImpl = globalThis.fetch, offlineRows = null }) {
  let rows = offlineRows;
  if (!offlineRows) {
    try {
      rows = await fetchRows(manifest.name, fetchImpl);
    } catch (error) {
      return { error: "unreadable", detail: String(error?.message ?? error).slice(0, 160) };
    }
  }
  const picked = pickLatest(rows, manifest.name);
  const verdict = compareManifest(picked, manifest);
  return { error: picked.error ?? null, detail: picked.detail, picked, verdict };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const manifestPath = arg("--manifest", "server.json");
  const OUT = arg("--output", "");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    process.stdout.write(`REFUSED: ${manifestPath} is not readable JSON: ${String(error.message).slice(0, 90)}\n`);
    process.exit(3);
  }
  const offlinePath = arg("--offline", "");
  let offlineRows = null;
  if (offlinePath) {
    try {
      offlineRows = JSON.parse(readFileSync(offlinePath, "utf8"));
    } catch (error) {
      process.stdout.write(`REFUSED: --offline ${offlinePath} is not readable JSON: ${String(error.message).slice(0, 90)}\n`);
      process.exit(3);
    }
  }

  const result = await run({ manifest, offlineRows });
  if (result.error) {
    process.stdout.write(`UNREADABLE: ${result.detail} - this says nothing about whether our listing exists.\n`);
    process.exit(2);
  }
  const row = result.picked.row;
  const line = {
    checked_at: new Date().toISOString(),
    name: manifest.name,
    manifest_version: manifest.version,
    registry_newest: row?.server?.version ?? null,
    versions_seen: result.picked.versions,
    rows_for_name: result.picked.rows_for_name,
    registry_description: row?.server?.description ?? null,
    state: result.verdict.state,
    red: result.verdict.red,
    fields: result.verdict.fields,
    note: result.verdict.note,
  };
  process.stdout.write(`REGISTRY_SYNC ${JSON.stringify(line)}\n`);
  if (OUT) writeFileSync(OUT, JSON.stringify(line, null, 2) + "\n");
  if (result.verdict.red) {
    process.stdout.write(`PROBLEM: ${result.verdict.state} - ${result.verdict.fields.join("; ")}\n`);
    process.exit(4);
  }
  if (result.verdict.state !== "synced") {
    process.stdout.write(`NOTED (not red): ${result.verdict.state} - ${result.verdict.note}\n`);
  }
}
