import assert from "node:assert/strict";
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createRuntimeBuildIdentityReader, createRuntimeIdentityManifest, inspectRuntimeBuildIdentity, RUNTIME_IDENTITY_PATH } from "./runtimeBuildIdentity.ts";

function fixture(context: { after(fn: () => void): void }) {
  const root = mkdtempSync(join(tmpdir(), "uas-build-identity-"));
  context.after(() => {
    if (!root.startsWith(resolve(tmpdir()) + sep)) throw new Error("Unexpected test root");
    rmSync(root, { recursive: true, force: true });
  });
  const put = (path: string, value: string) => {
    const target = join(root, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, value); return target;
  };
  put("package.json", JSON.stringify({ name: "unified-ai-system", version: "0.6.0", type: "module" }));
  put("pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  put("pnpm-workspace.yaml", "packages: ['apps/*', 'packages/*']\n");
  put("apps/ai-gateway-service/package.json", "{}");
  put("apps/agent-console/package.json", "{}");
  put("apps/ai-gateway-service/src/index.js", "export const gateway = true;\n");
  put("apps/agent-console/src/index.js", "export const consoleApp = true;\n");
  put("packages/example/package.json", "{}");
  put("packages/example/src/runtimeCredentialStore.ts", "export const protectedStore = true;\n");
  for (const name of ["terminal-demo.mjs", "mcp-smoke.mjs", "build-runtime-identity.mjs"]) put("tools/" + name, "export {};\n");
  const stamp = () => {
    const manifest = createRuntimeIdentityManifest(root, "a".repeat(40));
    put(RUNTIME_IDENTITY_PATH, JSON.stringify(manifest, null, 2) + "\n"); return manifest;
  };
  return { root, put, stamp };
}

test("runtime identity distinguishes sources with the same package version", (context) => {
  const { root, put, stamp } = fixture(context);
  const first = stamp();
  const identity = inspectRuntimeBuildIdentity(root);
  assert.equal(identity.status, "verified");
  assert.equal(identity.attested, false);
  if (identity.status === "verified") assert.equal(identity.declaredRevision, "a".repeat(40));
  put("packages/example/src/runtimeCredentialStore.ts", "export const protectedStore = false;\n");
  const changed = createRuntimeIdentityManifest(root);
  assert.equal(changed.packageVersion, first.packageVersion);
  assert.notEqual(changed.sourceDigest, first.sourceDigest);
  assert.deepEqual(inspectRuntimeBuildIdentity(root).status, "unknown");
  assert.equal((inspectRuntimeBuildIdentity(root) as { reason: string }).reason, "source-mismatch");
});

test("runtime identity verifies the lockfile separately", (context) => {
  const { root, put, stamp } = fixture(context);
  const before = stamp();
  put("pnpm-lock.yaml", "lockfileVersion: '9.0'\nsettings: {}\n");
  const after = createRuntimeIdentityManifest(root);
  assert.equal(after.sourceDigest, before.sourceDigest);
  assert.notEqual(after.lockfileDigest, before.lockfileDigest);
  assert.equal(inspectRuntimeBuildIdentity(root).status, "unknown");
});

test("protected data, tests and dependencies do not enter the fixed source digest", (context) => {
  const { root, put } = fixture(context);
  const before = createRuntimeIdentityManifest(root);
  for (const path of [".env", ".mcp.json", "apps/ai-gateway-service/src/.env",
    "apps/ai-gateway-service/src/.mcp.json", "packages/example/src/fixture.test.ts",
    "packages/example/src/fixtures/sample.ts", "packages/example/node_modules/dep/index.js",
    "packages/example/.data/session.json", "packages/example/logs/events.jsonl",
    "packages/example/src/private.key", "packages/example/src/state.sqlite"]) put(path, "excluded synthetic data");
  assert.deepEqual(createRuntimeIdentityManifest(root), before);
});

test("missing, malformed and oversized manifests remain unknown", (context) => {
  const { root, put } = fixture(context);
  assert.equal((inspectRuntimeBuildIdentity(root) as { reason: string }).reason, "manifest-missing");
  put(RUNTIME_IDENTITY_PATH, "{invalid");
  assert.equal(inspectRuntimeBuildIdentity(root).status, "unknown");
  put(RUNTIME_IDENTITY_PATH, "x".repeat(16 * 1024 + 1));
  assert.equal(inspectRuntimeBuildIdentity(root).status, "unknown");
});

test("manifest paths, extra fields and duplicate JSON members are rejected", (context) => {
  const { root, put, stamp } = fixture(context);
  const manifest = stamp();
  put(RUNTIME_IDENTITY_PATH, JSON.stringify({ ...manifest, files: ["../../private.key"] }, null, 2) + "\n");
  assert.equal((inspectRuntimeBuildIdentity(root) as { reason: string }).reason, "manifest-invalid");
  put(RUNTIME_IDENTITY_PATH, JSON.stringify(manifest, null, 2).replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "schemaVersion": 1,') + "\n");
  assert.equal((inspectRuntimeBuildIdentity(root) as { reason: string }).reason, "manifest-invalid");
});

test("symlinked source directories and hardlinked manifests are not read as trusted inputs", (context) => {
  const source = fixture(context); const outside = fixture(context);
  source.stamp();
  symlinkSync(join(outside.root, "packages"), join(source.root, "packages", "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.equal((inspectRuntimeBuildIdentity(source.root) as { reason: string }).reason, "source-unavailable");
  const target = fixture(context); target.stamp();
  linkSync(join(target.root, RUNTIME_IDENTITY_PATH), join(target.root, "manifest-copy.json"));
  assert.equal((inspectRuntimeBuildIdentity(target.root) as { reason: string }).reason, "manifest-unsafe");
});

test("the runtime reader captures one immutable observation", (context) => {
  const { root, put, stamp } = fixture(context); stamp();
  const reader = createRuntimeBuildIdentityReader(root);
  const first = reader();
  put("apps/ai-gateway-service/src/index.js", "export const gateway = false;\n");
  assert.equal(reader(), first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(inspectRuntimeBuildIdentity(root).status, "unknown");
});

test("the build tool stamps and verifies one fixed artifact without overwriting existing output", (context) => {
  const { root, put } = fixture(context);
  const modulePath = put("apps/ai-gateway-service/src/application/runtimeBuildIdentity.ts", "");
  copyFileSync(new URL("./runtimeBuildIdentity.ts", import.meta.url), modulePath);
  const toolPath = join(root, "tools/build-runtime-identity.mjs");
  copyFileSync(new URL("../../../../tools/build-runtime-identity.mjs", import.meta.url), toolPath);
  const run = (args: string[]) => spawnSync(process.execPath, [toolPath, ...args], {
    cwd: root, encoding: "utf8", windowsHide: true, timeout: 10_000,
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, HOME: root, USERPROFILE: root,
      TEMP: root, TMP: root, NODE_ENV: "test", UAI_DECLARED_REVISION: "c".repeat(40) },
  });
  assert.equal(run(["--declared-revision", "b".repeat(40)]).status, 0);
  const bytes = readFileSync(join(root, RUNTIME_IDENTITY_PATH));
  const verified = run(["--verify", "--expect-revision", "b".repeat(40)]);
  assert.equal(verified.status, 0);
  assert.equal(JSON.parse(verified.stdout).identity.status, "verified");
  assert.equal(run(["--verify", "--expect-revision", "c".repeat(40)]).status, 1);
  assert.equal(run(["--declared-revision", "b".repeat(40)]).status, 1);
  assert.deepEqual(readFileSync(join(root, RUNTIME_IDENTITY_PATH)), bytes);
  assert.equal(run(["--root", "../outside"]).status, 1);
});
