import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANIFEST_ACCEPT,
  artifactRows,
  classifyStatus,
  parseOciReference,
  probeReference,
} from "./check-registry-artifacts.mjs";

function fakeFetch({ manifestStatus, tokenOk = true }) {
  return async (url) => {
    if (String(url).includes("/token?")) {
      return tokenOk
        ? { ok: true, status: 200, json: async () => ({ token: "anonymous-pull-token" }) }
        : { ok: false, status: 500 };
    }
    return { ok: manifestStatus === 200, status: manifestStatus };
  };
}

test("registry references are parsed into the path GHCR actually serves", () => {
  const parsed = parseOciReference("ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0");
  assert.equal(parsed.host, "ghcr.io");
  assert.equal(parsed.name, "happy520ai/unified-ai-system/mcp-server");
  assert.equal(parsed.reference, "0.8.0");
  assert.equal(parsed.scope, "repository:happy520ai/unified-ai-system/mcp-server:pull");
  assert.equal(parsed.unsupported, false);

  // A digest reference is still one artifact; the digest is the reference.
  const byDigest = parseOciReference("ghcr.io/o/r/mcp-server@sha256:aaaa");
  assert.equal(byDigest.reference, "sha256:aaaa");

  assert.equal(parseOciReference("@scope/pkg@1.0.0"), null, "an npm package is not an OCI reference");
  assert.equal(parseOciReference("not-a-reference"), null);
  assert.equal(parseOciReference(""), null);
  assert.equal(parseOciReference("quay.io/some/thing:1").unsupported, true, "a host this check cannot read must be named");
  assert.equal(parseOciReference("ghcr.io/single-segment:1").unsupported, true);
});

test("a status code maps to exactly one verdict", () => {
  assert.equal(classifyStatus(200), "present");
  assert.equal(classifyStatus(404), "missing");
  assert.equal(classifyStatus(405), "missing");
  for (const other of [401, 403, 429, 500, 503]) {
    assert.equal(classifyStatus(other), "unknown", `${other} must never be read as absent or present`);
  }
});

test("an unreadable registry answer cannot become a pass", async () => {
  const id = "ghcr.io/happy520ai/unified-ai-system/mcp-server:0.8.0";
  assert.equal((await probeReference(id, fakeFetch({ manifestStatus: 200 }))).verdict, "present");
  assert.equal((await probeReference(id, fakeFetch({ manifestStatus: 404 }))).verdict, "missing");
  const denied = await probeReference(id, fakeFetch({ manifestStatus: 401 }));
  assert.equal(denied.verdict, "unknown");
  const tokenBroken = await probeReference(id, fakeFetch({ manifestStatus: 200, tokenOk: false }));
  assert.equal(tokenBroken.verdict, "unknown", "a failed token exchange says nothing about the tag");
});

test("every package row survives classification, including the ones not checked", () => {
  const rows = artifactRows([
    { registryType: "npm", identifier: "@scope/pkg@1.0.0" },
    { registryType: "oci", identifier: "quay.io/some/thing:1" },
    { registryType: "oci", identifier: "ghcr.io/o/r/mcp-server:0.8.0" },
    { registryType: "oci", identifier: undefined },
  ]);
  assert.equal(rows.length, 4, "a guard that drops rows certifies less than it appears to");
  assert.deepEqual(
    rows.map((row) => row.verdict),
    ["not_checked", "not_checked", null, "not_checked"],
    "npm and quay rows and a missing identifier must each be named, not skipped",
  );
  assert.ok(MANIFEST_ACCEPT.includes("application/vnd.oci.image.index.v1+json"), "GHCR 404s a real tag without this header");
});
