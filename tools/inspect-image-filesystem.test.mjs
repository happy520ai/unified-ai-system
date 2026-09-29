import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { evaluate, configFacts, pickChild } from "./inspect-image-filesystem.mjs";

const entry = (name, extra = {}) => ({ name, kind: "file", isFile: true, mode: 0o644, uid: 0, gid: 0, size: 10, linkName: "", ...extra });
const layers = (n = 3) => Array.from({ length: n }, (_, i) => ({ digest: `sha256:${i}`, digest_verified: true }));

// The healthy fixture is the one this session actually read off GHCR for 0.8.0: layers present, app/ present,
// package manifests readable, nothing above the root. If this shape produced problems, the instrument would be
// refusing its own correct readings.
test("a complete read produces no problems and reports the denominators", () => {
  const merged = [
    entry("app/", { kind: "dir", isFile: false }),
    entry("app/packages/mcp-server/src/server.js"),
    entry("app/node_modules/x/package.json", { content: new TextEncoder().encode('{"name":"x","scripts":{"postinstall":"node-gyp rebuild"}}') }),
    entry("usr/bin/passwd", { mode: 0o4755 }),
  ];
  const { problems, facts } = evaluate({
    tag: "0.8.0", repository: "r", arch: "amd64", indexDigest: "sha256:idx", manifestDigest: "sha256:man", configDigest: "sha256:cfg",
    layers: layers(3), merged,
  });
  assert.deepEqual(problems, [], JSON.stringify(problems));
  assert.equal(facts.layers_scanned, 3);
  // The artifact must carry the digests it read. Two platforms compared on an empty layer list are "identical"
  // by accident, which is the reading this fixture exists to make impossible.
  assert.deepEqual(facts.layers.map((l) => l.digest), ["sha256:0", "sha256:1", "sha256:2"]);
  assert.equal(facts.findings.files, 3);
  assert.equal(facts.findings.setuid.length, 1);
  assert.equal(facts.lifecycle_hooks.length, 1);
  assert.equal(facts.package_manifests_read, 1);
});

test("an empty or half-empty read is refused rather than reported as clean", () => {
  const base = { tag: "0.8.0", repository: "r", arch: "amd64", indexDigest: "i", manifestDigest: "m", configDigest: "c" };
  assert.match(evaluate({ ...base, layers: [], merged: [entry("app/a.js")] }).problems.join(";"), /lists no layers/);
  assert.match(evaluate({ ...base, layers: layers(), merged: [] }).problems.join(";"), /blind read/);
  assert.match(evaluate({ ...base, layers: layers(), merged: [entry("usr/bin/x")] }).problems.join(";"), /no files under app\//);
  const noManifests = [entry("app/server.js")];
  assert.match(evaluate({ ...base, layers: layers(), merged: noManifests }).problems.join(";"), /install-hook question is unanswered/);
  // A layer that failed its digest must never be able to ride along as a clean finding.
  const unverified = evaluate({ ...base, layers: [{ digest: "sha256:1", digest_verified: false }], merged: [entry("app/a.js"), entry("app/package.json", { content: new TextEncoder().encode("{}") })] });
  assert.match(unverified.problems.join(";"), /did not match the digest/);
});

test("the image config is reported as names, never as values", () => {
  const facts = configFacts({
    architecture: "amd64", os: "linux", created: "2026-09-25T16:00:00Z", history: [{}, {}],
    config: { User: "node", WorkingDir: "/app", Entrypoint: ["docker-entrypoint.sh"], Cmd: ["node", "server.js"], Env: ["PATH=/usr/bin", "UAI_SECRET=hunter2"], ExposedPorts: { "8787/tcp": {} }, Volumes: { "/data": {} } },
  });
  assert.equal(facts.user, "node");
  assert.deepEqual(facts.env_names, ["PATH", "UAI_SECRET"]);
  assert.equal(JSON.stringify(facts).includes("hunter2"), false, "an env value must not be reachable from the reported facts");
  assert.deepEqual(facts.exposed_ports, ["8787/tcp"]);
  assert.equal(facts.history_entries, 2);
});

test("the child manifest is picked by architecture and os", () => {
  const index = { manifests: [{ digest: "sha256:a", platform: { architecture: "arm64", os: "linux" } }, { digest: "sha256:b", platform: { architecture: "amd64", os: "linux" } }, { digest: "sha256:c", platform: { architecture: "amd64", os: "windows" } }] };
  assert.equal(pickChild(index, "amd64"), "sha256:b");
  assert.equal(pickChild(index, "arm64"), "sha256:a");
  assert.equal(pickChild(index, "s390x"), null);
  assert.equal(pickChild({ manifests: [] }, "amd64"), null);
  assert.equal(pickChild(undefined, "amd64"), null, "a missing index is a null, not a throw");
});

test("--help answers without touching the network", () => {
  const GEN = resolve(import.meta.dirname, "inspect-image-filesystem.mjs");
  const r = spawnSync(process.execPath, [GEN, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /anonymous registry token/);
  const bad = spawnSync(process.execPath, [GEN, "0.0.0-does-not-exist"], { encoding: "utf8" });
  assert.equal(bad.status, 2, "a tag that cannot be read must exit non-zero, not print an empty review");
  assert.match(bad.stderr, /REFUSED|HTTP/, bad.stderr);
});

test("an ELF built for the other architecture is reported as a finding, not as a failed read", () => {
  const elf = (machine) => {
    const bytes = new Uint8Array(64);
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
    bytes[18] = machine & 0xff;
    bytes[19] = machine >> 8;
    return bytes;
  };
  const natives = [
    entry("app/node_modules/better-sqlite3/build/Release/better_sqlite3.node", { content: elf(0x3e) }),
    entry("app/node_modules/@x/canvas.linux-x64-gnu.node", { content: elf(0x3e) }),
    entry("usr/local/lib/node_modules/pnpm/dist/reflink.darwin-arm64.node", { content: new Uint8Array([0xcf, 0xfa, 0xed, 0xfe, ...Array(60).fill(0)]) }),
    entry("app/plain.js"),
  ];
  const base = { repository: "r", indexDigest: "i", manifestDigest: "m", configDigest: "c", layers: layers(), merged: [...natives, entry("app/package.json", { content: new TextEncoder().encode("{}") })] };
  const onArm = evaluate({ ...base, tag: "0.8.0", arch: "arm64" });
  assert.equal(onArm.facts.native_modules.length, 3);
  assert.equal(onArm.facts.elf_arch_mismatch.length, 2, "both x86-64 modules are wrong for arm64");
  assert.match(onArm.facts.elf_arch_mismatch[0], /x86-64/);
  assert.equal(onArm.facts.foreign_platform_modules.length, 1);
  assert.deepEqual(onArm.problems, [], "a defect in the image must not become a refusal of the review");
  const onAmd = evaluate({ ...base, tag: "0.8.0", arch: "amd64" });
  assert.equal(onAmd.facts.elf_arch_mismatch.length, 0, "the same bytes are correct for amd64");
  // A third architecture compares only the files that ARE ELF: the Mach-O module stays in
  // foreign_platform_modules rather than being counted as a wrong-architecture Linux binary.
  assert.equal(evaluate({ ...base, tag: "0.8.0", arch: "riscv64" }).facts.elf_arch_mismatch.length, 2);
});
