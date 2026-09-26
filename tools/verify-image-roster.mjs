#!/usr/bin/env node
// Read the MCP tool roster a published container image actually ships.
//
// Why this exists: a listing, a README or a third-party catalogue can state any tool
// count, and the number is the part readers repeat. The image is a better witness. GHCR
// hands out an anonymous pull token, every layer blob is addressed by its own sha256, and
// the roster is frozen as MCP_TOOL_NAMES in the server source inside the image - so a
// reader can check the claim without Docker, without credentials, and without trusting
// this repository's own copy of the answer.
//
// Usage:
//   node tools/verify-image-roster.mjs <tag> [--repository owner/repo/name] [--json]
//
// Exits non-zero when the roster cannot be read or a layer fails its digest check.

import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const DEFAULT_REPOSITORY = 'happy520ai/unified-ai-system/mcp-server';
export const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(',');
export const ROSTER_MEMBER_SUFFIX = 'mcp-server/src/server.js';

// A multi-arch index lists children by platform; amd64/linux is what a typical laptop
// pulls. The unknown/unknown children are attestations, not images.
export function pickAmd64Child(index) {
  const entries = Array.isArray(index?.manifests) ? index.manifests : [];
  const child = entries.find((entry) => {
    const platform = entry?.platform ?? {};
    return platform.architecture === 'amd64' && platform.os === 'linux';
  });
  return child?.digest ?? null;
}

// Returns the roster names, or null when the marker is absent. Absent is never zero: a
// parser that answers [] for a file it could not read is how a blind check passes.
export function rosterFromSource(text) {
  if (typeof text !== 'string') return null;
  const marker = 'MCP_TOOL_NAMES = Object.freeze([';
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const end = text.indexOf('])', start);
  if (end < 0) return null;
  const names = [...text.slice(start, end).matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]);
  return names.length > 0 ? names : null;
}

export function isGzip(blob) {
  return blob.length > 2 && blob[0] === 0x1f && blob[1] === 0x8b;
}

function cstr(bytes) {
  const end = bytes.indexOf(0);
  return decoder.decode(bytes.subarray(0, end < 0 ? bytes.length : end));
}

// Uint8Array.prototype.toString ignores an encoding argument and joins with commas, so
// every decode here goes through TextDecoder explicitly.
const decoder = new TextDecoder('utf8');

function octalField(bytes) {
  const digits = decoder.decode(bytes).replace(/[^0-7]/g, '');
  return digits.length > 0 ? Number.parseInt(digits, 8) : 0;
}

// Walk a ustar stream 512-byte header at a time and return the payload of the first regular
// file whose name ends with `suffix`. Names longer than 100 bytes are not expected in these
// layers; if one appears, the caller gets "member not found" rather than a wrong answer.
export function findTarMember(blob, suffix) {
  let offset = 0;
  while (offset + 512 <= blob.length) {
    const header = blob.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const type = String.fromCharCode(header[156]);
    const size = octalField(header.subarray(124, 136));
    const name = cstr(header.subarray(0, 100));
    const payloadOffset = offset + 512;
    if ((type === '0' || type === '\0') && name.endsWith(suffix)) {
      return { name, text: decoder.decode(blob.subarray(payloadOffset, payloadOffset + size)) };
    }
    offset = payloadOffset + Math.ceil(size / 512) * 512;
  }
  return null;
}

export async function fetchImageRoster({
  tag = 'latest',
  repository = DEFAULT_REPOSITORY,
  fetchImpl = globalThis.fetch,
} = {}) {
  const tokenResponse = await fetchImpl(`https://ghcr.io/token?scope=repository:${repository}:pull`, {
    headers: { Accept: 'application/json' },
  });
  if (!tokenResponse.ok) throw new Error(`token request -> HTTP ${tokenResponse.status}`);
  const { token } = await tokenResponse.json();
  const base = `https://ghcr.io/v2/${repository}`;
  const auth = { Authorization: `Bearer ${token}` };

  const withAuth = (url, accept = MANIFEST_ACCEPT) =>
    fetchImpl(url, { headers: { ...auth, Accept: accept } });

  const indexResponse = await withAuth(`${base}/manifests/${tag}`);
  if (!indexResponse.ok) throw new Error(`manifest ${tag} -> HTTP ${indexResponse.status}`);
  const index = await indexResponse.json();

  let manifest = index;
  if (Array.isArray(index?.manifests)) {
    const child = pickAmd64Child(index);
    if (!child) throw new Error(`${repository}:${tag} has no amd64/linux child`);
    const childResponse = await withAuth(`${base}/manifests/${child}`);
    if (!childResponse.ok) throw new Error(`child manifest -> HTTP ${childResponse.status}`);
    manifest = await childResponse.json();
  }

  const layers = Array.isArray(manifest?.layers) ? manifest.layers : [];
  const hits = [];
  for (const layer of layers) {
    const response = await withAuth(`${base}/blobs/${layer.digest}`, '*/*');
    if (!response.ok) throw new Error(`blob ${layer.digest} -> HTTP ${response.status}`);
    const blob = new Uint8Array(await response.arrayBuffer());
    const digest = `sha256:${createHash('sha256').update(blob).digest('hex')}`;
    if (digest !== layer.digest) {
      throw new Error(`layer ${layer.digest} failed its digest check (computed ${digest})`);
    }
    const bytes = isGzip(blob) ? new Uint8Array(gunzipSync(blob)) : blob;
    const member = findTarMember(bytes, ROSTER_MEMBER_SUFFIX);
    if (!member) continue;
    hits.push({
      digest: layer.digest,
      layerBytes: blob.length,
      path: member.name,
      names: rosterFromSource(member.text),
    });
  }
  if (hits.length === 0) {
    throw new Error(`no ${ROSTER_MEMBER_SUFFIX} in any of the ${layers.length} layers of ${repository}:${tag}`);
  }
  return { repository, tag, layersScanned: layers.length, hits };
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const repoFlag = args.includes('--repository') ? args[args.indexOf('--repository') + 1] : DEFAULT_REPOSITORY;
  const tag = args.find((arg) => !arg.startsWith('-') && arg !== repoFlag);
  if (!tag) {
    console.error('Usage: node tools/verify-image-roster.mjs <tag> [--repository owner/repo/name] [--json]');
    process.exit(1);
  }
  fetchImageRoster({ tag, repository: repoFlag })
    .then((result) => {
      if (asJson) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      for (const hit of result.hits) {
        console.log(`${result.repository}:${result.tag}`);
        console.log(`  layer   ${hit.digest}`);
        console.log(`  digest  verified, ${(hit.layerBytes / 1024 / 1024).toFixed(1)} MB compressed`);
        console.log(`  path    ${hit.path}`);
        if (hit.names === null) {
          console.log('  roster  UNREADABLE (MCP_TOOL_NAMES marker absent)');
          process.exitCode = 1;
          continue;
        }
        console.log(`  tools   ${hit.names.length}`);
        console.log(`  names   ${hit.names.join(', ')}`);
      }
      console.log(`  layers  ${result.layersScanned} scanned`);
    })
    .catch((error) => {
      // exitCode rather than exit(): forcing the process down while a registry socket is
      // still closing crashed inside libuv on Windows and reported 127, not 1.
      console.error(`FAILED ${error.message}`);
      process.exitCode = 1;
    });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
