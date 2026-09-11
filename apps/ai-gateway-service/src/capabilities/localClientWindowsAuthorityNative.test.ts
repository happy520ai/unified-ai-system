import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createLocalClientPopSnapshotRollbackProtectedReplayGuard, LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION,
  type LocalClientPopReplayCheckpoint } from "./localClientPopSnapshotRollbackProtection.ts";
import { LocalClientSqlitePopReplayGuard } from "./localClientSqlitePopReplayGuard.ts";
import { expect, it, vi } from "vitest";
import {
  LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS, LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS, LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS,
  LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS, boundedJson, createLocalClientNativeAuthorityClient, createLocalClientNativePopReplayBinding,
  handleLocalClientNativeAuthorityRequest, parseLocalClientNativeAuthorityBootstrap,
  type LocalClientNativeAuthorityApi,
} from "./localClientWindowsAuthorityNative.ts";
import { createLocalClientNativeAuthorityZeroCheckpoints, handleLocalClientAuthorityWorkerEnvelope,
  createLocalClientNativeAuthorityMaintenanceCheckpoints, verifyLocalClientNativeAuthorityMaintenanceCheckpoints } from "./localClientWindowsAuthorityBrokerEntry.ts";
import * as authorityCrypto from "./localClientWindowsProtectedAuthorityAnchor.ts";
import { createLocalClientWindowsAuthorityProvisioningPlan, LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID } from "./localClientWindowsAuthorityBrokerService.ts";
import { createLocalClientWindowsAuthorityFileHmac, createLocalClientWindowsAuthorityRequestHmac,
  type LocalClientWindowsAuthorityBrokerRequest, type LocalClientWindowsAuthorityFileCheckpoint } from "./localClientWindowsProtectedAuthorityAnchor.ts";

import * as nativeAuthorityModule from "./localClientWindowsAuthorityNative.ts";
import { LocalClientProtectedSqliteCheckpoint } from "./localClientProtectedSqliteCheckpoint.ts";
import { createManagedLocalClientPopIdentityAuthority } from "./localClientPopIdentityAuthority.ts";
import { materializeConfiguredLocalClientPopRegistryKey, enrollConfiguredLocalClientNativePopReplayBaseline } from "./localClientPopReplayConfiguration.ts";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { runLocalClientNativePopReplayCommand } from "../../../../tools/local-client-native-pop-replay.mjs";
import { createLocalClientNativePopReplayRuntime, prepareLocalClientNativePopReplayRuntime,
  createNonOwningNativePopReplayGuardPort, isLocalClientNativePopReplayRuntime, enrollLocalClientNativePopReplayBaseline,
} from "./localClientNativePopReplayRuntime.ts";

const SERVICE_SID = LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
const USER_SID = "S-1-5-21-101-202-303-1001";
const ADMIN_SID = "S-1-5-32-544";
const SYSTEM_SID = "S-1-5-18";
const installationId = "12345678-1234-1234-1234-123456789012";
const bootstrap = { version: "local-client-windows-authority-bootstrap-v3" as const, installationId,
  hostId: `windows-authority-${installationId}`, currentUserSid: USER_SID,
  programDataBasePath: "C:\\fixture\\ProgramData", anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS], packageManifestSha256: "a".repeat(64) };
const BOOTSTRAP_REQUEST = JSON.stringify({ version: "local-client-windows-authority-bootstrap-request-v1" });

it("maintenance v4 preserves exact bootstrap versions and the v3 PoP lifecycle without accepting v2 PoP", async () => {
  const v4 = { ...bootstrap, version: "local-client-windows-authority-bootstrap-v4" as const };
  expect(parseLocalClientNativeAuthorityBootstrap(v4)).toEqual(v4);
  for (const invalid of [{ ...v4, extra: true }, { ...v4, version: "local-client-windows-authority-bootstrap-v5" },
    { ...v4, anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS] }]) {
    expect(() => parseLocalClientNativeAuthorityBootstrap(invalid)).toThrow();
  }
  const f = fixture(undefined, v4.version);
  const client = await createLocalClientNativeAuthorityClient(f.api, "pop-replay");
  await client.close();
  expect(f.nonceCount).toBe(0); expect(f.popClaimCount).toBe(2); expectClosed(f);
  const old = fixture();
  const readBootstrap = old.api.readBootstrap.bind(old.api);
  old.api.readBootstrap = () => {
    const loaded = readBootstrap();
    return { ...loaded, configJson: JSON.stringify({ ...old.configuration, version: "local-client-windows-authority-bootstrap-v2" }) };
  };
  await expect(createLocalClientNativeAuthorityClient(old.api, "pop-replay")).rejects.toThrow();
  expect(old.nonceCount).toBe(0); expect(old.popClaimCount).toBe(0); expectClosed(old);
});

it("maintenance signer signs exactly the two new PoP slots without signing any of the original twelve", () => {
  const key = Buffer.alloc(32, 74);
  const input = { hostId: bootstrap.hostId, currentUserSid: USER_SID, programDataBasePath: bootstrap.programDataBasePath,
    anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS], packageManifestSha256: bootstrap.packageManifestSha256, integrityKey: key.toString("base64") };
  const signer = vi.spyOn(authorityCrypto, "createLocalClientWindowsAuthorityFileHmac");
  try {
    const result = createLocalClientNativeAuthorityMaintenanceCheckpoints(input);
    expect(result.checkpoints.map(value => value.anchorId)).toEqual(["pop-replay", "validation-pop-replay"]);
    expect(signer).toHaveBeenCalledTimes(2);
    expect(input.integrityKey).toBe("");
    for (const item of result.checkpoints) {
      const file = JSON.parse(item.checkpointJson) as LocalClientWindowsAuthorityFileCheckpoint;
      const { hmacSha256, ...unsigned } = file;
      expect(state(file)).toEqual({ currentGeneration: 0, currentDigest: null, pendingGeneration: null, pendingDigest: null });
      expect(hmacSha256).toBe(createLocalClientWindowsAuthorityFileHmac(key, unsigned));
    }
    expect(() => createLocalClientNativeAuthorityMaintenanceCheckpoints({ ...input, integrityKey: key.toString("base64"), anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS] })).toThrow();
    expect(() => createLocalClientNativeAuthorityMaintenanceCheckpoints({ ...input, integrityKey: key.toString("base64"), existingCheckpoints: [] })).toThrow();
  } finally { signer.mockRestore(); key.fill(0); }
});

function maintenanceVerificationFixture(version: 1 | 2 | 3 | 4 = 4, retainPop = true) {
  const key = Buffer.alloc(32, 75);
  const { packageManifestSha256: _manifest, ...legacy } = bootstrap;
  const config = version === 1 ? { ...legacy, version: "local-client-windows-authority-bootstrap-v1" as const,
    anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS] }
    : { ...bootstrap, version: `local-client-windows-authority-bootstrap-v${version}` };
  const slots = retainPop ? LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS : LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS;
  const checkpoints = slots.map((anchorId, index) => {
    const plan = createLocalClientWindowsAuthorityProvisioningPlan(config.programDataBasePath, [], { anchorId });
    const currentGeneration = index + 7, currentDigest = createHash("sha256").update(anchorId).digest("hex");
    const pendingGeneration = index % 2 ? currentGeneration + 1 : null;
    const pendingDigest = pendingGeneration === null ? null : createHash("sha256").update(anchorId + "-pending").digest("hex");
    const checkpoint = { currentGeneration, currentDigest, pendingGeneration, pendingDigest };
    const unsigned = { fileVersion: "local-client-windows-authority-file-v1" as const, hostId: config.hostId,
      serviceSid: SERVICE_SID, anchorPath: plan.storage.anchorPath, hklmKeyPath: plan.registry.keyPath, hklmView: "registry64" as const, ...checkpoint };
    return { anchorId, fileJson: JSON.stringify({ ...unsigned, hmacSha256: createLocalClientWindowsAuthorityFileHmac(key, unsigned) }, null, 2) + "\n",
      registryJson: JSON.stringify(checkpoint) };
  });
  return { key, input: { bootstrap: config, integrityKey: key.toString("base64"), checkpoints } };
}

it.each([1, 2, 3, 4] as const)("maintenance verifier accepts v%s nonzero and pending checkpoints without changing raw state bytes", version => {
  const f = maintenanceVerificationFixture(version);
  const originalBytes = f.input.checkpoints.map(value => [value.fileJson, value.registryJson]);
  expect(verifyLocalClientNativeAuthorityMaintenanceCheckpoints(f.input)).toEqual({ verified: true, checkpointCount: 14 });
  expect(f.input.checkpoints.map(value => [value.fileJson, value.registryJson])).toEqual(originalBytes);
  expect(f.input.integrityKey).toBe(""); f.key.fill(0);
});

it("maintenance verifier accepts original v1 twelve slots but never accepts partial PoP or arbitrary subsets", () => {
  const original = maintenanceVerificationFixture(1, false);
  expect(verifyLocalClientNativeAuthorityMaintenanceCheckpoints(original.input)).toEqual({ verified: true, checkpointCount: 12 });
  original.key.fill(0);
  for (const variant of ["one-pop-missing", "one-legacy-missing", "duplicate", "unknown", "v4-with-twelve"] as const) {
    const f = maintenanceVerificationFixture(variant === "v4-with-twelve" ? 4 : 1);
    if (variant === "one-pop-missing") f.input.checkpoints.pop();
    if (variant === "one-legacy-missing") f.input.checkpoints.shift();
    if (variant === "duplicate") f.input.checkpoints[1] = { ...f.input.checkpoints[0]! };
    if (variant === "unknown") f.input.checkpoints[0]!.anchorId = "unrecognized";
    if (variant === "v4-with-twelve") f.input.checkpoints = f.input.checkpoints.filter(value => !value.anchorId.includes("pop-replay"));
    expect(() => verifyLocalClientNativeAuthorityMaintenanceCheckpoints(f.input)).toThrow(); f.key.fill(0);
  }
});

it.each(["hmac", "identity", "path", "pending", "registry", "extra-file-field", "extra-registry-field", "wrong-key"] as const)
  ("maintenance verifier rejects %s drift without repairing or resigning existing state", variation => {
    const f = maintenanceVerificationFixture();
    const target = f.input.checkpoints[1]!;
    const file = JSON.parse(target.fileJson) as LocalClientWindowsAuthorityFileCheckpoint;
    const registry = JSON.parse(target.registryJson) as ReturnType<typeof state>;
    if (variation === "hmac") target.fileJson = JSON.stringify({ ...file, hmacSha256: "f".repeat(64) });
    if (variation === "identity") target.fileJson = JSON.stringify({ ...file, hostId: "different-installation" });
    if (variation === "path") target.fileJson = JSON.stringify({ ...file, anchorPath: file.anchorPath.replace("authority.json", "other.json") });
    if (variation === "pending") {
      const { hmacSha256: _mac, ...base } = file;
      const unsigned = { ...base, pendingGeneration: base.currentGeneration + 2 };
      target.fileJson = JSON.stringify({ ...unsigned, hmacSha256: createLocalClientWindowsAuthorityFileHmac(f.key, unsigned) });
    }
    if (variation === "registry") target.registryJson = JSON.stringify({ ...registry, pendingDigest: "e".repeat(64) });
    if (variation === "extra-file-field") target.fileJson = JSON.stringify({ ...file, extra: true });
    if (variation === "extra-registry-field") target.registryJson = JSON.stringify({ ...registry, extra: true });
    if (variation === "wrong-key") f.input.integrityKey = Buffer.alloc(32, 76).toString("base64");
    const changedBytes = [target.fileJson, target.registryJson];
    expect(() => verifyLocalClientNativeAuthorityMaintenanceCheckpoints(f.input)).toThrow();
    expect([target.fileJson, target.registryJson]).toEqual(changedBytes); f.key.fill(0);
  });

/** Native API behavior model only: these tests exercise the real TS broker and
 * signing code, not Windows tokens, filesystem ACLs, SCM, named pipes or DPAPI. */
function fixture(basePath?: string, version: "local-client-windows-authority-bootstrap-v3" | "local-client-windows-authority-bootstrap-v4" = bootstrap.version) {
  const configuration = { ...bootstrap, version, programDataBasePath: basePath ?? bootstrap.programDataBasePath };
  const key = Buffer.alloc(32, 73);
  const helperInput = { hostId: configuration.hostId, currentUserSid: USER_SID,
    programDataBasePath: configuration.programDataBasePath, anchorIds: configuration.anchorIds,
    packageManifestSha256: configuration.packageManifestSha256, integrityKey: key.toString("base64") };
  const files = new Map<string, LocalClientWindowsAuthorityFileCheckpoint>();
  const registry = new Map<string, ReturnType<typeof state>>();
  for (const item of createLocalClientNativeAuthorityZeroCheckpoints(helperInput).checkpoints) {
    const file = JSON.parse(item.checkpointJson) as LocalClientWindowsAuthorityFileCheckpoint;
    files.set(file.anchorPath, file); registry.set(file.hklmKeyPath, state(file));
    if (basePath) { mkdirSync(dirname(file.anchorPath), { recursive: true }); writeFileSync(file.anchorPath, JSON.stringify(file)); }
  }
  const calls = { context: 0, end: 0, lock: 0, release: 0, write: 0, acl: 0, initialize: 0, load: 0, transport: 0 };
  const returnedKeys: Buffer[] = [];
  const nonces = new Set<string>();
  const popNonces = new Map<string, { requestDigestSha256: string; expiresAtMs: number }>();
  let serviceInstanceId = "9".repeat(64), highWater = 0, popClaims = 0, popFaulted = false;
  const advanceClock = () => {
    if (popFaulted || Date.now() < highWater) throw new Error("MODEL_POP_UNAVAILABLE");
    highWater = Date.now(); for (const [nonce, record] of popNonces) if (record.expiresAtMs <= highWater) popNonces.delete(nonce);
    return highWater;
  };
  let active = false, lease: string | null = null, writable = false, refuseContext = false, refuseService = false, failWrite = false;
  const api: LocalClientNativeAuthorityApi = {
    inspectEnvironment: () => ({ osPlatform: "win32", programDataBasePath: configuration.programDataBasePath }),
    initializeService(input) { calls.initialize++; if (refuseService || input.hostId !== configuration.hostId || input.currentUserSid !== USER_SID) throw new Error("MODEL_SERVICE_REFUSED"); },
    readBootstrap() { calls.load++; const copy = Buffer.from(key); returnedKeys.push(copy); return { configJson: JSON.stringify(configuration), integrityKey: copy }; },
    beginRequest(handle) { calls.context++; if (refuseContext || handle !== "123") throw new Error("MODEL_CALLER_REFUSED"); active = true; return "context"; },
    endRequest(context) { expect(context).toBe("context"); expect(lease).toBeNull(); active = false; calls.end++; },
    async acquireLock(context) { expect(context).toBe("context"); expect(active).toBe(true); expect(lease).toBeNull(); calls.lock++; return lease = "lease"; },
    releaseLock(input) { expect(input).toBe(lease); lease = null; calls.release++; },
    claimNonce(input, nonce) { expect(input).toBe(lease); if (nonces.has(nonce)) return "replayed"; nonces.add(nonce); return "claimed"; },
    startPopServiceInstance() { throw new Error("MODEL_WORKER_CANNOT_START_INSTANCE"); },
    readPopServiceInstance(input, expected) { expect(input).toBe(lease); if (expected !== serviceInstanceId) throw new Error("MODEL_INSTANCE_MISMATCH"); return {serviceInstanceId, observedAtMs: advanceClock()}; },
    claimExpiringNonce(input, request) {
      expect(input).toBe(lease); if (request.serviceInstanceId !== serviceInstanceId) throw new Error("MODEL_INSTANCE_MISMATCH");
      const observedAtMs = advanceClock();
      if (request.issuedAtMs > observedAtMs) return {result:"future",observedAtMs};
      if (request.expiresAtMs <= observedAtMs) return {result:"expired",observedAtMs};
      if (popNonces.has(request.nonce)) return {result:"replayed",observedAtMs};
      if (popNonces.size >= 4096) return {result:"capacity",observedAtMs};
      popNonces.set(request.nonce,{requestDigestSha256:request.requestDigestSha256,expiresAtMs:request.expiresAtMs}); popClaims++;
      return {result:"claimed",observedAtMs};
    },
    assertExpiringRequestFresh(input, request) {
      expect(input).toBe(lease); const observedAtMs = advanceClock(); const record = popNonces.get(request.nonce);
      if (request.serviceInstanceId !== serviceInstanceId || request.issuedAtMs > observedAtMs || request.expiresAtMs <= observedAtMs
        || record?.requestDigestSha256 !== request.requestDigestSha256 || record.expiresAtMs !== request.expiresAtMs) throw new Error("MODEL_FRESHNESS_REJECTED");
      return {observedAtMs};
    },
    readProtectedFileCheckpoint(input, target) { expect(input).toBe(lease); return JSON.stringify(files.get(target.anchorPath)); },
    writeProtectedFileCheckpointAtomically(input, target, value) { expect(input).toBe(lease); if (failWrite) throw new Error("MODEL_WRITE_FAILED"); calls.write++; files.set(target.anchorPath, JSON.parse(value)); if (basePath) writeFileSync(target.anchorPath, value); },
    readHklmCheckpoint64(input, target) { expect(input).toBe(lease); return JSON.stringify(registry.get(target.hklmKeyPath)); },
    writeHklmCheckpoint64(input, target, value) { expect(input).toBe(lease); calls.write++; registry.set(target.hklmKeyPath, JSON.parse(value)); },
    inspectAclFacts(input, context, target) {
      expect(input).toBe(lease); expect(context).toBe("context"); expect(active).toBe(true); calls.acl++;
      return { source: "independent-privileged-broker", currentUserSid: USER_SID, serviceSid: SERVICE_SID,
        rootOwnerSid: SYSTEM_SID, rootAllowedWriteSids: [SYSTEM_SID, ADMIN_SID, SERVICE_SID], rootInheritedWriteSids: [], rootCurrentUserCanWrite: writable,
        fileOwnerSid: SYSTEM_SID, fileAllowedWriteSids: [SYSTEM_SID, ADMIN_SID, SERVICE_SID], fileInheritedWriteSids: [], fileCurrentUserCanWrite: writable,
        registryOwnerSid: SYSTEM_SID, registryAllowedWriteSids: [SYSTEM_SID, ADMIN_SID, SERVICE_SID], registryInheritedWriteSids: [], registryCurrentUserCanWrite: writable,
        hklmHive: "HKLM", hklmKeyPath: target.hklmKeyPath, hklmView: "registry64" };
    },
    request: payload => { calls.transport++; const request = JSON.parse(payload);
      const pop = request.version === "local-client-windows-authority-bootstrap-request-v2" || request.requestVersion === "local-client-windows-authority-request-v2";
      if (pop && popFaulted) return Promise.reject(new Error("MODEL_HOST_FAULTED"));
      return handleLocalClientNativeAuthorityRequest(api, "123", payload, pop ? serviceInstanceId : undefined); },
  };
  const target = createLocalClientWindowsAuthorityProvisioningPlan(configuration.programDataBasePath, [], { anchorId: "gateway-vscode" });
  function signed(operation: LocalClientWindowsAuthorityBrokerRequest["operation"], generation = 0, digest: string | null = null,
    nextGeneration: number | null = null, nextDigest: string | null = null) {
    const request = { requestVersion: "local-client-windows-authority-request-v1" as const, operation,
      nonce: randomBytes(32).toString("hex"), hostId: configuration.hostId, serviceSid: SERVICE_SID, currentUserSid: USER_SID,
      anchorPath: target.storage.anchorPath, programDataRoot: target.storage.programDataRoot, hklmKeyPath: target.registry.keyPath,
      hklmView: "registry64" as const, expectedCurrentGeneration: generation, expectedCurrentDigest: digest,
      nextGeneration, nextDigest };
    return { ...request, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(key, request) };
  }
  return { api, key, files, registry, calls, returnedKeys, target, signed, configuration, get nonceCount() { return nonces.size; },
    get popClaimCount() { return popClaims; }, get activePopClaims() { return popNonces.size; }, get highWater() { return highWater; },
    restartPop() { advanceClock(); serviceInstanceId = randomBytes(32).toString("hex"); }, faultPop() { popFaulted = true; },
    writable: () => { writable = true; }, refuseContext: () => { refuseContext = true; },
    refuseService: () => { refuseService = true; }, failWrite: () => { failWrite = true; } };
}
function state(file: LocalClientWindowsAuthorityFileCheckpoint) { return { currentGeneration: file.currentGeneration,
  currentDigest: file.currentDigest, pendingGeneration: file.pendingGeneration, pendingDigest: file.pendingDigest }; }
function expectClosed(f: ReturnType<typeof fixture>) {
  expect(f.calls.release).toBe(f.calls.lock);
  expect(f.returnedKeys.length).toBeGreaterThan(0);
  expect(f.returnedKeys.every(key => key.equals(Buffer.alloc(32)))).toBe(true);
}

async function withPopBinding(run: (f: ReturnType<typeof fixture>,
  binding: Awaited<ReturnType<typeof createLocalClientNativePopReplayBinding>>,
  checkpoint: LocalClientPopReplayCheckpoint) => Promise<void>) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "native-pop-boundary-"));
  let binding: Awaited<ReturnType<typeof createLocalClientNativePopReplayBinding>> | undefined;
  try {
    const f = fixture(join(root, "ProgramData"));
    binding = await createLocalClientNativePopReplayBinding(f.api);
    await run(f, binding, { checkpointVersion: LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION, state: "ready",
      storeBindingSha256: "1".repeat(64), anchorBindingSha256: binding.anchorBindingSha256,
      generation: 1, checkpointDigestSha256: "b".repeat(64) });
  } finally {
    await binding?.close();
    expect(realpathSync(root)).toBe(root); expect(dirname(root)).toBe(realpathSync(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
}

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

it("signs disjoint runtime and validation baselines without returning the dedicated key", () => {
  const f = fixture();
  expect(LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS).toHaveLength(7);
  expect(LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS).toHaveLength(7);
  expect([...LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS.slice(0, 6), ...LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS.slice(0, 6)])
    .toEqual(LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS);
  expect(LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS.some(id => LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS.includes(id))).toBe(false);
  expect(f.files.size).toBe(14);
  for (const file of f.files.values()) {
    const { hmacSha256, ...unsigned } = file;
    expect(hmacSha256).toBe(createLocalClientWindowsAuthorityFileHmac(f.key, unsigned));
    expect(state(file)).toEqual({ currentGeneration: 0, currentDigest: null, pendingGeneration: null, pendingDigest: null });
    expect(JSON.stringify(file)).not.toContain(f.key.toString("base64"));
  }
});

it("rejects configuration drift and additional worker-envelope authority before reading native bootstrap", async () => {
  for (const invalid of [{ ...bootstrap, extra: true }, { ...bootstrap, hostId: "another-host" },
    { ...bootstrap, anchorIds: [...bootstrap.anchorIds.slice(1), "arbitrary-slot"] },
    { ...bootstrap, programDataBasePath: "\\\\remote\\ProgramData" }]) {
    expect(() => parseLocalClientNativeAuthorityBootstrap(invalid)).toThrow();
  }
  const f = fixture();
  await expect(handleLocalClientAuthorityWorkerEnvelope(f.api, { id: "request-one", callerTokenHandle: "123", request: BOOTSTRAP_REQUEST, overrideSid: USER_SID })).rejects.toThrow();
  expect(f.calls.load).toBe(0);
});

it("delivers only the dedicated protocol key after actual-context and all-slot checks supplied by the native port", async () => {
  const f = fixture();
  const envelope = await handleLocalClientAuthorityWorkerEnvelope(f.api, { id: "request-one", callerTokenHandle: "123", request: BOOTSTRAP_REQUEST });
  const response = JSON.parse(envelope.response);
  expect(envelope.id).toBe("request-one");
  expect(Object.keys(response).sort()).toEqual(["bootstrap", "integrityKey", "version"]);
  expect(response.integrityKey).toBe(f.key.toString("base64"));
  expect(f.calls.context).toBe(1); expect(f.calls.end).toBe(1); expect(f.calls.acl).toBe(12); expect(f.calls.write).toBe(0);
  expectClosed(f);
});

it.each(["writable", "refuseContext", "refuseService"] as const)("refuses key delivery when native facts reject %s", async failure => {
  const f = fixture(); f[failure]();
  await expect(f.api.request(BOOTSTRAP_REQUEST)).rejects.toThrow();
  expect(f.calls.write).toBe(0); expectClosed(f);
  if (failure === "refuseService") expect(f.calls.context).toBe(0);
});

it("routes signed enrollment/advance/finalization through the existing monotonic broker and rejects a replay", async () => {
  const f = fixture(); const first = "a".repeat(64), second = "b".repeat(64);
  await f.api.request(boundedJson(f.signed("enroll-baseline", 0, null, 1, first)));
  const request = f.signed("prepare-next", 1, first, 2, second);
  const pending = JSON.parse(await f.api.request(boundedJson(request)));
  expect(pending.fileCheckpoint.pendingGeneration).toBe(2);
  await expect(f.api.request(boundedJson(request))).rejects.toThrow();
  const completed = JSON.parse(await f.api.request(boundedJson(f.signed("finalize", 1, first, 2, second))));
  expect(completed.fileCheckpoint).toEqual({ currentGeneration: 2, currentDigest: second, pendingGeneration: null, pendingDigest: null });
  expect(f.calls.write).toBe(6); expect(f.calls.context).toBe(f.calls.end); expectClosed(f);
});

it("rejects caller-selected token handles, unknown slots and signed caller mismatches without a write", async () => {
  const f = fixture();
  const valid = f.signed("inspect");
  for (const invalid of [{ ...valid, callerTokenHandle: "456" }, { ...valid, anchorPath: "C:\\outside\\authority.json" },
    { ...valid, currentUserSid: "S-1-5-21-101-202-303-1002" }]) {
    await expect(f.api.request(boundedJson(invalid))).rejects.toThrow();
  }
  expect(f.calls.write).toBe(0); expect(f.calls.context).toBe(f.calls.end); expectClosed(f);
});

it("releases the native lease/context and wipes loaded keys after a write failure", async () => {
  const f = fixture(); f.failWrite();
  await expect(f.api.request(boundedJson(f.signed("enroll-baseline", 0, null, 1, "a".repeat(64))))).rejects.toThrow();
  expect(f.calls.context).toBe(f.calls.end); expectClosed(f);
});

it("constructs an un-enrolled client anchor through the explicit authenticated transport bootstrap", async () => {
  const f = fixture();
  const client = await createLocalClientNativeAuthorityClient(f.api, "gateway-vscode");
  expect(f.calls.acl).toBe(12); expect(f.calls.write).toBe(0); expectClosed(f);
  await client.close();
  await expect(createLocalClientNativeAuthorityClient(f.api, "unknown-slot")).rejects.toThrow();
});

it("rejects a native host failure frame without constructing a client authority", async () => {
  const f = fixture();
  const api = { ...f.api, request: async () => boundedJson({ nativeError: "WORKER_REQUEST_REJECTED" }) };
  await expect(createLocalClientNativeAuthorityClient(api, "gateway-vscode"))
    .rejects.toThrow("LOCAL_CLIENT_NATIVE_AUTHORITY_REJECTED");
  expect(f.calls.context).toBe(0); expect(f.calls.acl).toBe(0); expect(f.calls.write).toBe(0);
});

it("keeps v1 clients on the original slots and rejects legacy or mixed bootstrap for PoP", async () => {
  const { packageManifestSha256: _manifest, ...oldFields } = bootstrap;
  const legacy = { ...oldFields, version: "local-client-windows-authority-bootstrap-v1", anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS] };
  expect(parseLocalClientNativeAuthorityBootstrap(legacy).anchorIds).toHaveLength(12);
  expect(() => parseLocalClientNativeAuthorityBootstrap({ ...legacy, anchorIds: bootstrap.anchorIds })).toThrow();
  expect(() => parseLocalClientNativeAuthorityBootstrap({ ...bootstrap, anchorIds: legacy.anchorIds })).toThrow();
  const f = fixture(); const original = f.api.readBootstrap;
  f.api.readBootstrap = () => ({ ...original(), configJson: JSON.stringify(legacy) });
  const client = await createLocalClientNativeAuthorityClient(f.api, "gateway-vscode");
  await client.close();
  await expect(createLocalClientNativePopReplayBinding(f.api)).rejects.toThrow();
  expect(f.calls.write).toBe(0); expectClosed(f);
});

it.skipIf(process.platform !== "win32")("MODEL: requires actual challenge HMAC validation before exposing PoP evidence and preserves the old slots", async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "native-pop-binding-"));
  let binding: Awaited<ReturnType<typeof createLocalClientNativePopReplayBinding>> | undefined;
  try {
    const base = join(root, "ProgramData");
    const f = fixture(base);
    const legacyState = () => JSON.stringify(LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS.map(anchorId =>
      f.files.get(createLocalClientWindowsAuthorityProvisioningPlan(base, [], { anchorId }).storage.anchorPath)));
    const before = legacyState();
    binding = await createLocalClientNativePopReplayBinding(f.api);
    const adapter = binding.createEvidenceAdapter("1".repeat(64));
    const checkpoint = { checkpointVersion: LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION, state: "ready" as const,
      storeBindingSha256: "1".repeat(64), anchorBindingSha256: binding.anchorBindingSha256,
      generation: 1, checkpointDigestSha256: "b".repeat(64) };
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    binding.authority.inspect = async () => ({ available: true, state: "ready", rollbackResistant: true } as never);
    await expect(adapter.preflight(checkpoint)).rejects.toThrow(); // fabricated public status does not bypass private attestation.
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256);
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    await expect(adapter.preflight(checkpoint)).resolves.toMatchObject({ attestationVerified: true,
      deploymentEvidenceSha256: bootstrap.packageManifestSha256, generation: 1 });
    expect(adapter.status.nativeDeploymentVerified).toBe(true);
    await expect(adapter.verifyCurrent({ checkpoint: { ...checkpoint, storeBindingSha256: "2".repeat(64) },
      challenge: Buffer.alloc(32, 30) })).rejects.toThrow();
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    const challenge = Buffer.alloc(32, 31);
    await adapter.verifyCurrent({ checkpoint, challenge });
    // Reusing challenge bytes in a fresh signed lifecycle is permitted; replaying an old frame is not.
    await expect(adapter.verifyCurrent({ checkpoint, challenge })).resolves.toMatchObject({ attestationVerified: true });
    expect(adapter.status.nativeDeploymentVerified).toBe(true);
    expect(legacyState()).toBe(before);
    const validation = createLocalClientWindowsAuthorityProvisioningPlan(base, [], { anchorId: "validation-pop-replay" });
    expect(f.files.get(validation.storage.anchorPath)?.currentGeneration).toBe(0);
    expect(f.calls.write).toBe(2); expectClosed(f);
    await binding.close();
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    await expect(adapter.verifyCurrent({ checkpoint, challenge: Buffer.alloc(32, 32) })).rejects.toThrow();
  } finally {
    await binding?.close();
    expect(realpathSync(root)).toBe(root); expect(dirname(root)).toBe(realpathSync(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

it.skipIf(process.platform !== "win32")("MODEL: bounds native request and nonce cost for the real SQLite consume plus wrapper attestation chain", async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "native-pop-nonce-cost-"));
  let binding: Awaited<ReturnType<typeof createLocalClientNativePopReplayBinding>> | undefined;
  let guard: LocalClientSqlitePopReplayGuard | undefined;
  let wrapped: Awaited<ReturnType<typeof createLocalClientPopSnapshotRollbackProtectedReplayGuard>> | undefined;
  try {
    const f = fixture(join(root, "ProgramData"));
    binding = await createLocalClientNativePopReplayBinding(f.api);
    expect({ frames: f.calls.transport, legacy: f.nonceCount, pop: f.popClaimCount }).toEqual({ frames: 1, legacy: 0, pop: 2 });
    guard = new LocalClientSqlitePopReplayGuard({ sqlitePath: join(root, "pop.sqlite"), hostId: f.configuration.hostId,
      integrityKey: Buffer.alloc(32, 88), protectedAuthority: binding.authority, anchorBindingSha256: binding.anchorBindingSha256 });
    const baseline = await guard.enrollProtectedBaseline();
    const adapter = binding.createEvidenceAdapter(baseline.storeBindingSha256);
    await adapter.preflight(baseline);
    wrapped = await createLocalClientPopSnapshotRollbackProtectedReplayGuard({ checkpointPort: guard, anchorPort: adapter });
    expect({ frames: f.calls.transport, legacy: f.nonceCount, pop: f.popClaimCount }).toEqual({ frames: 12, legacy: 0, pop: 13 });
    const before = { frames: f.calls.transport, nonces: f.popClaimCount };
    const request = { replayKeySha256: "c".repeat(64), replayScopeSha256: "d".repeat(64), nowMs: 1900000000000, expiresAtMs: 1900000010000 };
    await expect(wrapped.consumeOnce(request)).resolves.toBe("consumed");
    expect({ frames: f.calls.transport - before.frames, nonces: f.popClaimCount - before.nonces }).toEqual({ frames: 27, nonces: 27 });
    const replayBefore = f.popClaimCount;
    await expect(wrapped.consumeOnce(request)).resolves.toBe("replayed");
    expect(f.popClaimCount - replayBefore).toBe(23); // Identical timestamp: no replay-state mutation.
    expect(f.nonceCount).toBe(0);
  } finally {
    await wrapped?.close(); await guard?.close(); await binding?.close();
    expect(realpathSync(root)).toBe(root); expect(dirname(root)).toBe(realpathSync(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});

it.each(["before-adapter", "after-adapter"])("MODEL boundary: cannot replace the authority verifier %s to forge PoP evidence", async timing => {
  await withPopBinding(async (_f, binding, checkpoint) => {
    let replacementCalls = 0;
    const replaceVerifier = () => { binding.authority.verifyCheckpointChallenge = async input => {
      replacementCalls++;
      return { generation: input.generation, digest: input.digest, nonce: "f".repeat(64),
        challengeSha256: createHash("sha256").update(input.challenge).digest("hex"), attestationSha256: "e".repeat(64) };
    }; };
    if (timing === "before-adapter") replaceVerifier();
    const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256);
    if (timing === "after-adapter") replaceVerifier();
    await expect(adapter.preflight(checkpoint)).rejects.toThrow(); // The real slot has no enrolled baseline.
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256);
    await expect(adapter.preflight(checkpoint)).resolves.toMatchObject({ generation: 1, attestationVerified: true });
    expect(replacementCalls).toBe(0);
  });
});

it.each(["success-first", "failure-first"])("MODEL boundary: concurrent verification stays unavailable with %s delivery", async order => {
  await withPopBinding(async (f, binding, checkpoint) => {
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256);
    const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256);
    const transport = f.api.request, entered = signal(), releaseSuccess = signal(), releaseFailure = signal();
    let requests = 0;
    f.api.request = async payload => {
      if (++requests === 1) { entered.resolve(); await releaseSuccess.promise; return transport(payload); }
      await releaseFailure.promise; throw new Error("MODEL_CONCURRENT_FAILURE");
    };
    const first = adapter.verifyCurrent({ checkpoint, challenge: Buffer.alloc(32, 41) }).then(() => "accepted", () => "rejected");
    await entered.promise;
    const second = adapter.verifyCurrent({ checkpoint, challenge: Buffer.alloc(32, 42) }).then(() => "accepted", () => "rejected");
    if (order === "success-first") { releaseSuccess.resolve(); await first; releaseFailure.resolve(); }
    else { releaseFailure.resolve(); await second; releaseSuccess.resolve(); }
    const outcomes = await Promise.all([first, second]);
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    expect(adapter.status.available).toBe(false);
    expect(outcomes).toEqual(["rejected", "rejected"]);
    f.api.request = transport;
    await adapter.preflight(checkpoint); // A separate, non-overlapping verification may recover availability.
    expect(adapter.status.nativeDeploymentVerified).toBe(true);
  });
});

it.skipIf(process.platform !== "win32")("MODEL boundary: closing an in-flight verification cannot restore ready status", async () => {
  await withPopBinding(async (f, binding, checkpoint) => {
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256);
    const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256);
    const transport = f.api.request, entered = signal(), release = signal();
    f.api.request = async payload => { entered.resolve(); await release.promise; return transport(payload); };
    const result = adapter.verifyCurrent({ checkpoint, challenge: Buffer.alloc(32, 43) }).then(() => "accepted", () => "rejected");
    await entered.promise;
    await binding.close(); release.resolve();
    expect(await result).toBe("rejected");
    expect(adapter.status.nativeDeploymentVerified).toBe(false);
    await expect(adapter.preflight(checkpoint)).rejects.toThrow();
  });
});

it.skipIf(process.platform !== "win32")("MODEL boundary: attestation binds the captured checkpoint and challenge while caller inputs change", async () => {
  await withPopBinding(async (f, binding, initial) => {
    await binding.authority.enrollBaseline(initial.checkpointDigestSha256);
    const adapter = binding.createEvidenceAdapter(initial.storeBindingSha256);
    const checkpoint = { ...initial }, challenge = Buffer.alloc(32, 44);
    const challengeSha256 = createHash("sha256").update(challenge).digest("hex");
    const transport = f.api.request, entered = signal(), release = signal();
    f.api.request = async payload => { entered.resolve(); await release.promise; return transport(payload); };
    const pending = adapter.verifyCurrent({ checkpoint, challenge });
    await entered.promise;
    checkpoint.generation = 2; checkpoint.checkpointDigestSha256 = "c".repeat(64); challenge.fill(45);
    release.resolve();
    await expect(pending).resolves.toMatchObject({ generation: initial.generation,
      checkpointDigestSha256: initial.checkpointDigestSha256, challengeSha256 });
    expect(challenge).toEqual(Buffer.alloc(32, 45));
  });
});

it.skipIf(process.platform !== "win32")("MODEL lifecycle: the full SQLite consume chain crosses two capacity windows with zero legacy claims", async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "native-pop-lifecycle-"));
  let now = Date.now(); const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  let binding: Awaited<ReturnType<typeof createLocalClientNativePopReplayBinding>> | undefined;
  let guard: LocalClientSqlitePopReplayGuard | undefined;
  let wrapped: Awaited<ReturnType<typeof createLocalClientPopSnapshotRollbackProtectedReplayGuard>> | undefined;
  try {
    const f = fixture(join(root, "ProgramData"));
    binding = await createLocalClientNativePopReplayBinding(f.api);
    guard = new LocalClientSqlitePopReplayGuard({ sqlitePath: join(root, "pop.sqlite"), hostId: f.configuration.hostId,
      integrityKey: Buffer.alloc(32, 88), protectedAuthority: binding.authority, anchorBindingSha256: binding.anchorBindingSha256 });
    const baseline = await guard.enrollProtectedBaseline(); const adapter = binding.createEvidenceAdapter(baseline.storeBindingSha256);
    await adapter.preflight(baseline); wrapped = await createLocalClientPopSnapshotRollbackProtectedReplayGuard({ checkpointPort: guard, anchorPort: adapter });
    const transport = f.api.request; let captured = "";
    f.api.request = async payload => { if (!captured && JSON.parse(payload).requestVersion === "local-client-windows-authority-request-v2") captured = payload; return transport(payload); };
    for (let index = 0; index < 350; ++index) {
      if (index === 120 || index === 240) now += 8000;
      await expect(wrapped.consumeOnce({ replayKeySha256: createHash("sha256").update(String(index)).digest("hex"),
        replayScopeSha256: "d".repeat(64), nowMs: 1900000000000, expiresAtMs: 1900000010000 })).resolves.toBe("consumed");
      expect(f.activePopClaims).toBeLessThanOrEqual(4096);
    }
    expect(f.popClaimCount).toBe(13 + 350 * 27); expect(f.popClaimCount).toBeGreaterThan(8192); expect(f.nonceCount).toBe(0);
    const writes = f.calls.write;
    await expect(transport(captured)).rejects.toThrow(); // Expired raw frame stays dead after its claim was collected.
    expect(f.calls.write).toBe(writes); expect(f.nonceCount).toBe(0);
    now -= 1;
    await expect(guard.readCurrentCheckpoint()).rejects.toThrow();
    expect(adapter.status.available).toBe(false); // Persistent model high-water is outside the SQLite store.
  } finally {
    await wrapped?.close(); await guard?.close(); await binding?.close(); clock.mockRestore();
    expect(realpathSync(root)).toBe(root); expect(dirname(root)).toBe(realpathSync(tmpdir())); rmSync(root, { recursive: true, force: true });
  }
}, 120_000);

it.skipIf(process.platform !== "win32")("MODEL lifecycle: a service restart rejects a captured unexpired frame and requires fresh bootstrap", async () => {
  await withPopBinding(async (f, binding, checkpoint) => {
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256);
    const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256), transport = f.api.request;
    let captured = "";
    f.api.request = async payload => { captured = payload; return transport(payload); };
    await adapter.preflight(checkpoint); f.api.request = transport;
    const writes = f.calls.write; f.restartPop();
    await expect(transport(captured)).rejects.toThrow();
    await expect(adapter.preflight(checkpoint)).rejects.toThrow(); expect(adapter.status.available).toBe(false);
    const next = await createLocalClientNativePopReplayBinding(f.api);
    try { await expect(next.createEvidenceAdapter(checkpoint.storeBindingSha256).preflight(checkpoint)).resolves.toMatchObject({ attestationVerified: true }); }
    finally { await next.close(); }
    expect(f.calls.write).toBe(writes); expect(f.nonceCount).toBe(0);
  });
});

it.skipIf(process.platform !== "win32")("MODEL lifecycle: expiry and clock rollback withdraw cached adapter readiness", async () => {
  let now = Date.now(); const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try { await withPopBinding(async (_f, binding, checkpoint) => {
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256); const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256);
    await adapter.preflight(checkpoint); expect(adapter.status.available).toBe(true);
    now -= 1; expect(adapter.status.available).toBe(false); now += 1;
    expect(adapter.status.available).toBe(false); await adapter.preflight(checkpoint); expect(adapter.status.available).toBe(true);
    now += 8000; expect(adapter.status.available).toBe(false);
  }); } finally { clock.mockRestore(); }
});

/** MODEL: real SQLite, TS authority/HMAC and runtime composition. Only the
 * pinned addon loader is replaced by the existing native API fixture above. */
type NativeRuntimeModel = ReturnType<typeof createLocalClientNativePopReplayRuntime>;
async function withNativeRuntimeModel(run: (model: {
  root: string; sqlitePath: string; addonPath: string; f: ReturnType<typeof fixture>;
  options: (key?: Buffer) => Parameters<typeof createLocalClientNativePopReplayRuntime>[0];
  create: (key?: Buffer, overrides?: Partial<Parameters<typeof createLocalClientNativePopReplayRuntime>[0]>) => NativeRuntimeModel;
  enroll: () => Promise<LocalClientPopReplayCheckpoint>; loadCount: () => number;
  snapshot: () => Map<string, Buffer>; fingerprint: () => string; restore: (snapshot: Map<string, Buffer>) => void;
  expectUnconfirmedClose: (runtime: NativeRuntimeModel) => void;
}) => Promise<void>) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "native-pop-runtime-")), base = join(root, "ProgramData");
  const priorProgramData = process.env.ProgramData;
  const f = fixture(base, "local-client-windows-authority-bootstrap-v4");
  const addonPath = join(base, "UnifiedAISystem", "LocalClientAuthority", "bin", "local-client-authority.node");
  mkdirSync(dirname(addonPath), { recursive: true }); const syntheticAddon = Buffer.from("T051 fixture bytes; never load as native code");
  writeFileSync(addonPath, syntheticAddon); process.env.ProgramData = base;
  const load = vi.spyOn(nativeAuthorityModule, "loadLocalClientNativeAuthority").mockReturnValue(f.api);
  const runtimes = new Set<NativeRuntimeModel>(), unconfirmedClosures = new Set<NativeRuntimeModel>(), sqlitePath = join(root, "pop.sqlite");
  const options = (key: Buffer = Buffer.alloc(32, 88)) => ({ sqlitePath, hostId: f.configuration.hostId, integrityKey: key,
    namespace: "native-runtime-model", maxEntries: 64, maxEntriesPerScope: 32, nativeAddonPath: addonPath,
    nativeAddonSha256: createHash("sha256").update(syntheticAddon).digest("hex") });
  const snapshot = () => new Map([sqlitePath, `${sqlitePath}-wal`, `${sqlitePath}-shm`]
    .filter(existsSync).map(path => [path, readFileSync(path)] as const));
  const fingerprint = () => JSON.stringify([...snapshot()].map(([path, bytes]) => [path, createHash("sha256").update(bytes).digest("hex")]));
  try {
    await run({ root, sqlitePath, addonPath, f, options, loadCount: () => load.mock.calls.length, snapshot, fingerprint,
      expectUnconfirmedClose: runtime => { unconfirmedClosures.add(runtime); },
      create(key = Buffer.alloc(32, 88), overrides = {}) {
        const runtime = createLocalClientNativePopReplayRuntime({ ...options(key), ...overrides });
        expect(key.equals(Buffer.alloc(key.length))).toBe(true); runtimes.add(runtime); return runtime;
      },
      async enroll() {
        const key = Buffer.alloc(32, 88), pending = enrollLocalClientNativePopReplayBaseline(options(key));
        expect(key.equals(Buffer.alloc(32))).toBe(true); return pending;
      },
      restore(saved) {
        expect(dirname(sqlitePath)).toBe(root);
        for (const path of [sqlitePath, `${sqlitePath}-wal`, `${sqlitePath}-shm`]) {
          if (saved.has(path)) writeFileSync(path, saved.get(path)!);
          else if (existsSync(path)) rmSync(path);
        }
      },
    });
  } finally {
    try {
      for (const runtime of runtimes) {
        if (unconfirmedClosures.has(runtime)) await expect(runtime.close()).rejects.toMatchObject({ code: "LOCAL_CLIENT_NATIVE_POP_CLOSE_UNCONFIRMED" });
        else await runtime.close();
      }
      expect(f.calls.context).toBe(f.calls.end); expect(f.calls.lock).toBe(f.calls.release);
      if (f.returnedKeys.length) expectClosed(f);
    } finally {
      load.mockRestore(); f.key.fill(0);
      if (priorProgramData === undefined) delete process.env.ProgramData; else process.env.ProgramData = priorProgramData;
      expect(realpathSync(root)).toBe(root); expect(dirname(root)).toBe(realpathSync(tmpdir())); rmSync(root, { recursive: true, force: true });
    }
  }
}
function runtimeReplay(index = 1) {
  return { replayKeySha256: createHash("sha256").update(`runtime-proof-${index}`).digest("hex"), replayScopeSha256: "d".repeat(64),
    nowMs: 1_900_000_000_000, expiresAtMs: 1_900_000_030_000 };
}

it.each(["missing", "empty", "schema3"] as const)("MODEL native runtime: ordinary startup rejects %s without creating or changing DB state", async mode => {
  await withNativeRuntimeModel(async model => {
    if (mode === "empty") writeFileSync(model.sqlitePath, Buffer.alloc(0));
    if (mode === "schema3") {
      const legacy = new LocalClientSqlitePopReplayGuard({ sqlitePath: model.sqlitePath, hostId: model.f.configuration.hostId,
        integrityKey: Buffer.alloc(32, 88), namespace: "native-runtime-model", maxEntries: 64, maxEntriesPerScope: 32 });
      await legacy.close();
    }
    const before = model.fingerprint(), runtime = model.create();
    await expect(runtime.ready).resolves.toBe(false);
    await expect(prepareLocalClientNativePopReplayRuntime(runtime)).resolves.toBe(false);
    await expect(runtime.consumeOnce(runtimeReplay())).rejects.toThrow();
    await runtime.close(); expect(runtime.status.available).toBe(false);
    expect(model.fingerprint()).toBe(before); expect(model.loadCount()).toBe(0); expect(model.f.calls.write).toBe(0);
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: explicit generation-one enrollment resumes the identical baseline", async () => {
  await withNativeRuntimeModel(async model => {
    const first = await model.enroll(), writes = model.f.calls.write, before = model.fingerprint();
    expect(first.generation).toBe(1); expect(first.state).toBe("ready");
    await expect(model.enroll()).resolves.toEqual(first);
    expect(model.f.calls.write).toBe(writes); expect(model.fingerprint()).toBe(before);
    const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    expect(runtime.status).toMatchObject({ available: true, snapshotRollbackProtected: true });
    expect(model.f.nonceCount).toBe(0);
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: explicit enrollment cannot reset an authority already at generation two", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const binding = await createLocalClientNativePopReplayBinding(model.f.api);
    try { await binding.authority.prepareNext(1, "f".repeat(64)); await binding.authority.finalize(2, "f".repeat(64)); }
    finally { await binding.close(); }
    const before = model.fingerprint(), writes = model.f.calls.write;
    await expect(model.enroll()).rejects.toThrow();
    expect(model.f.calls.write).toBe(writes); expect(model.fingerprint()).toBe(before);
    const slot = createLocalClientWindowsAuthorityProvisioningPlan(model.f.configuration.programDataBasePath, [], { anchorId: "pop-replay" });
    expect(model.f.files.get(slot.storage.anchorPath)?.currentGeneration).toBe(2);
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: reopening with the same key preserves replay and a wrong key fails without rewriting state", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const first = model.create(); await expect(first.ready).resolves.toBe(true);
    await expect(first.consumeOnce(runtimeReplay())).resolves.toBe("consumed"); await first.close();
    const second = model.create(); await expect(second.ready).resolves.toBe(true);
    await expect(second.consumeOnce(runtimeReplay())).resolves.toBe("replayed"); await second.close();
    const before = model.fingerprint(), writes = model.f.calls.write, wrong = model.create(Buffer.alloc(32, 89));
    await expect(wrong.ready).resolves.toBe(false); await expect(wrong.consumeOnce(runtimeReplay(2))).rejects.toThrow(); await wrong.close();
    expect(model.fingerprint()).toBe(before); expect(model.f.calls.write).toBe(writes);
    const recovered = model.create(); await expect(recovered.ready).resolves.toBe(true);
    await expect(recovered.consumeOnce(runtimeReplay())).resolves.toBe("replayed");
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: restoring the entire older SQLite file set is rejected by the retained native checkpoint", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const oldDatabase = model.snapshot();
    const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    await expect(runtime.consumeOnce(runtimeReplay())).resolves.toBe("consumed"); await runtime.close();
    const writes = model.f.calls.write; model.restore(oldDatabase); const restored = model.fingerprint();
    const rollback = model.create(); await expect(rollback.ready).resolves.toBe(false);
    await expect(rollback.consumeOnce(runtimeReplay())).rejects.toThrow(); await rollback.close();
    expect(model.f.calls.write).toBe(writes); expect(model.fingerprint()).toBe(restored);
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: an expired live status can refresh after eight idle seconds", async () => {
  let now = Date.now(); const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try { await withNativeRuntimeModel(async model => {
    await model.enroll(); const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    expect(runtime.status.available).toBe(true); now += 8_001;
    expect(runtime.status.available).toBe(false); expect(runtime.status.snapshotRollbackProtected).toBe(false);
    await expect(prepareLocalClientNativePopReplayRuntime(runtime)).resolves.toBe(true);
    expect(runtime.status.available).toBe(true); await expect(runtime.consumeOnce(runtimeReplay())).resolves.toBe("consumed");
  }); } finally { clock.mockRestore(); }
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: service restart refuses one consume without retry and a later prepare establishes a fresh instance", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    const writes = model.f.calls.write, loads = model.loadCount(); model.f.restartPop();
    await expect(runtime.consumeOnce(runtimeReplay())).rejects.toThrow();
    expect(runtime.status.available).toBe(false); expect(model.f.calls.write).toBe(writes); expect(model.loadCount()).toBe(loads);
    await expect(prepareLocalClientNativePopReplayRuntime(runtime)).resolves.toBe(true);
    expect(model.loadCount()).toBe(loads + 1); await expect(runtime.consumeOnce(runtimeReplay())).resolves.toBe("consumed");
    expect(model.f.nonceCount).toBe(0);
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: concurrent prepare is shared and consumes use the same serialization boundary", async () => {
  let now = Date.now(); const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try { await withNativeRuntimeModel(async model => {
    await model.enroll(); const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true); now += 8_001;
    const transport = model.f.api.request, entered = signal(), release = signal(); let first = true, active = 0, maximum = 0;
    model.f.api.request = async payload => {
      active++; maximum = Math.max(maximum, active);
      try { if (first) { first = false; entered.resolve(); await release.promise; } return await transport(payload); }
      finally { active--; }
    };
    const initial = prepareLocalClientNativePopReplayRuntime(runtime); await entered.promise;
    const concurrent = prepareLocalClientNativePopReplayRuntime(runtime);
    const firstConsume = runtime.consumeOnce(runtimeReplay(1)), secondConsume = runtime.consumeOnce(runtimeReplay(2));
    release.resolve();
    await expect(Promise.all([initial, concurrent, firstConsume, secondConsume])).resolves.toEqual([true, true, "consumed", "consumed"]);
    expect(maximum).toBe(1); expect(model.f.nonceCount).toBe(0);
  }); } finally { clock.mockRestore(); }
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: closing during initialization cannot publish a late ready state", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const transport = model.f.api.request, entered = signal(), release = signal(); let first = true;
    model.f.api.request = async payload => { if (first) { first = false; entered.resolve(); await release.promise; } return transport(payload); };
    const runtime = model.create(); await entered.promise; const closing = runtime.close();
    expect(runtime.status.available).toBe(false); release.resolve(); await closing;
    await expect(runtime.ready).resolves.toBe(false); await expect(prepareLocalClientNativePopReplayRuntime(runtime)).resolves.toBe(false);
    expect(runtime.runtimeStatus.state).toBe("closed"); expect(runtime.status.available).toBe(false);
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: closing during a failed consume preserves the final closed state", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    const transport = model.f.api.request, entered = signal(), release = signal(); let first = true;
    model.f.api.request = async payload => { if (first) { first = false; entered.resolve(); await release.promise; } return transport(payload); };
    try {
      model.f.restartPop(); const consume = runtime.consumeOnce(runtimeReplay()).then(() => "accepted", () => "rejected");
      await entered.promise; const closing = runtime.close(); expect(runtime.runtimeStatus.state).toBe("closed");
      release.resolve(); expect(await consume).toBe("rejected"); await closing;
      expect(runtime.runtimeStatus.state).toBe("closed"); expect(runtime.status.available).toBe(false);
      await expect(prepareLocalClientNativePopReplayRuntime(runtime)).resolves.toBe(false);
    } finally { release.resolve(); model.f.api.request = transport; }
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: disappearance of an existing DB during native bootstrap cannot recreate it", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const original = model.snapshot(), writes = model.f.calls.write;
    const transport = model.f.api.request, entered = signal(), release = signal(); let first = true;
    model.f.api.request = async payload => { if (first) { first = false; entered.resolve(); await release.promise; } return transport(payload); };
    const runtime = model.create();
    try {
      await entered.promise;
      for (const path of original.keys()) {
        expect(dirname(path)).toBe(model.root); expect(dirname(`${path}.retained`)).toBe(model.root);
        renameSync(path, `${path}.retained`);
      }
      release.resolve(); await expect(runtime.ready).resolves.toBe(false); await runtime.close();
      expect(existsSync(model.sqlitePath)).toBe(false); expect(model.f.calls.write).toBe(writes);
      for (const [path, bytes] of original) expect(readFileSync(`${path}.retained`)).toEqual(bytes);
    } finally { release.resolve(); model.f.api.request = transport; await runtime.close(); }
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: a prepare queued before cleanup failure cannot reconnect or publish ready", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    const original = LocalClientProtectedSqliteCheckpoint.prototype.close, entered = signal(), release = signal();
    const close = vi.spyOn(LocalClientProtectedSqliteCheckpoint.prototype, "close").mockImplementationOnce(async function (this: LocalClientProtectedSqliteCheckpoint) {
      await original.call(this); entered.resolve(); await release.promise;
      throw new Error("MODEL_CLOSE_UNCONFIRMED");
    });
    model.expectUnconfirmedClose(runtime);
    try {
      const loads = model.loadCount(); model.f.restartPop();
      const consume = runtime.consumeOnce(runtimeReplay()).then(() => "accepted", () => "rejected");
      await entered.promise; const queued = prepareLocalClientNativePopReplayRuntime(runtime); release.resolve();
      expect(await consume).toBe("rejected"); await expect(queued).resolves.toBe(false);
      expect(model.loadCount()).toBe(loads); expect(runtime.status.available).toBe(false);
      expect(runtime.runtimeStatus.reason).toBe("CLOSE_UNCONFIRMED");
      await expect(prepareLocalClientNativePopReplayRuntime(runtime)).resolves.toBe(false);
    } finally { release.resolve(); close.mockRestore(); }
  });
});

it.skipIf(process.platform !== "win32")("MODEL native runtime: private branding survives a non-owning port and does not spread extra status fields", async () => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const runtime = model.create(); await expect(runtime.ready).resolves.toBe(true);
    const nonOwning = createNonOwningNativePopReplayGuardPort(runtime)!;
    expect(nonOwning).not.toBeNull(); expect(isLocalClientNativePopReplayRuntime(nonOwning)).toBe(true);
    await nonOwning.close?.(); expect(runtime.status.available).toBe(true);
    await expect(prepareLocalClientNativePopReplayRuntime(nonOwning)).resolves.toBe(true);
    const fake = { ...runtime, status: { ...runtime.status }, runtimeStatus: runtime.runtimeStatus };
    expect(isLocalClientNativePopReplayRuntime(fake)).toBe(false); expect(createNonOwningNativePopReplayGuardPort(fake)).toBeNull();
    await expect(prepareLocalClientNativePopReplayRuntime(fake)).resolves.toBe(false);
    const allowed = new Set(["available", "durable", "distributed", "mode", "authenticatedReplaySet", "snapshotRollbackProtected", "defensiveEnabled", "capacityIsolatedByScope", "maxEntries", "maxEntriesPerScope"]);
    expect(Reflect.ownKeys(runtime.status).every(key => typeof key === "string" && allowed.has(key))).toBe(true);
    await runtime.close(); expect(nonOwning.status.available).toBe(false);
  });
});

it.each(["hash", "path"] as const)("MODEL native runtime: a changed addon %s is refused before invoking the native loader", async failure => {
  await withNativeRuntimeModel(async model => {
    await model.enroll(); const loads = model.loadCount(), before = model.fingerprint();
    const options = failure === "hash" ? { nativeAddonSha256: "0".repeat(64) } : { nativeAddonPath: join(model.root, "local-client-authority.node") };
    const runtime = model.create(Buffer.alloc(32, 88), options); await expect(runtime.ready).resolves.toBe(false); await runtime.close();
    expect(model.loadCount()).toBe(loads); expect(model.fingerprint()).toBe(before);
  });
});

type NativeRuntimeFixture = Parameters<Parameters<typeof withNativeRuntimeModel>[0]>[0];
function nativeWiringEnv(model: NativeRuntimeFixture): Record<string, string> {
  return {
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(model.root, "model-library.json"),
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false", PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(model.root, "clients.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(model.root, "client-execution.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH: join(model.root, "discovery.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(model.root, "client-control"),
    AI_GATEWAY_USAGE_LOG_DIR: join(model.root, "usage"), WORKFORCE_EXECUTION_DIR: join(model.root, "workforce"),
    WORKFLOW_OUTPUT_DIR: join(model.root, "workflows"), CREDENTIAL_VAULT_DIR: join(model.root, "vault"),
    PME_API_KEY_STORE_PATH: join(model.root, "api-keys.json"), PME_ENTERPRISE_USER_STORE_PATH: join(model.root, "users.json"),
    PME_AUDIT_LOG_PATH: join(model.root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(model.root, "audit-chain.jsonl"),
    PME_AUDIT_CHECKPOINT_PATH: join(model.root, "audit-checkpoint.json"),
    PME_AUDIT_CHECKPOINT_HMAC_KEY: `hex:${"43".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_HOST_ID: model.f.configuration.hostId,
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true", AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43128",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.native-runtime", AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-native-runtime",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "9".repeat(64),
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:NATIVE_MODEL_CLIENT_SECRET", NATIVE_MODEL_CLIENT_SECRET: `hex:${"41".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF: "env_key_name:NATIVE_MODEL_REGISTRY_SECRET", NATIVE_MODEL_REGISTRY_SECRET: `hex:${"42".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON: JSON.stringify({ version: 1,
      bindings: [{ tenantId: "tenant-native-runtime", subjectId: "operator-native-runtime", clientId: "managed.native-runtime" }] }),
    AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: "sqlite", AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: model.sqlitePath,
    AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE: "native-wiring-model", AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES: "64",
    AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE: "32", AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS: "100",
    AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_PROTECTION_MODE: "windows-native", AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_PATH: model.addonPath,
    AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_SHA256: createHash("sha256").update(readFileSync(model.addonPath)).digest("hex"),
  };
}
async function closeNativeWiringApplication(application?: ReturnType<typeof createGatewayApplication>) {
  if (!application) return;
  for (const resource of [application.localClientRoutePlanStore, application.localClientExecutionClaimStore,
    application.localClientExecutionControl, application.localClientSmartManagementScheduler, application.localClientExecutionReceiptRecoveryService,
    application.localClientExecutionFeedbackDispatcher, application.localClientExecutionFeedbackOutbox, application.localClientExecutionReceiptJournalRegistry,
    application.localClientGovernedOnboardingRuntime, application.localClientOnboardingReceiptAuthorityStore, application.localClientPopIdentityAuthority,
    application.localClientVerificationService, application.localClientAdapterRegistry, application.localClientManagementService,
    application.localClientFeedbackDedupStore, application.localClientAuthorityEpochStore, application.idempotencyCoordinator,
    application.workforceExecutor, application.requestLogger, application.providerDispatchGate, application.externalEffectGate,
    application.mcpGatewayService, application.enterpriseGovernanceService, application.runtimeCredentialStore]) {
    if (resource && "close" in resource && typeof resource.close === "function") await resource.close();
  }
}

it.skipIf(process.platform !== "win32")("MODEL native wiring: identity authority accepts only private-branded initial unavailability without consuming a proof", async () => {
  await withNativeRuntimeModel(async model => {
    const runtime = model.create(), nonOwning = createNonOwningNativePopReplayGuardPort(runtime)!;
    const authority = createManagedLocalClientPopIdentityAuthority({ key: Buffer.alloc(32, 90), keyId: "native-wiring-key", replayGuard: nonOwning,
      now: () => 1_900_000_000_000, nonceFactory: () => Buffer.alloc(32, 17) });
    try {
      expect(authority.status.available).toBe(false); await expect(runtime.ready).resolves.toBe(false);
      const identity = { tenantId: "tenant-native-runtime", subjectId: "operator-native-runtime", clientId: "managed.native-runtime", clientRevision: 1 };
      const request = { method: "POST", path: "/local-clients/heartbeat", body: Buffer.from("{}") };
      const proof = await authority.issue({ identity, request });
      await expect(authority.verify({ expectedIdentity: identity, request, proof })).rejects.toMatchObject({ code: "LOCAL_CLIENT_POP_REPLAY_GUARD_UNAVAILABLE" });
      expect(model.loadCount()).toBe(0); expect(model.f.calls.write).toBe(0); expect(existsSync(model.sqlitePath)).toBe(false);
      const consume = vi.fn(() => "consumed" as const), sourceKey = Buffer.alloc(32, 90);
      expect(() => createManagedLocalClientPopIdentityAuthority({ key: sourceKey, keyId: "native-wiring-key",
        replayGuard: { status: { available: false, durable: true, distributed: false, mode: "windows-native-snapshot-protected-sqlite" }, consumeOnce: consume },
      })).toThrow();
      expect(consume).not.toHaveBeenCalled(); expect(sourceKey.equals(Buffer.alloc(32))).toBe(true);
    } finally { await authority.close(); }
  });
});

it.skipIf(process.platform !== "win32")("MODEL native wiring: gateway stays unavailable without enrollment and shared configuration restores live readiness after idle", async () => {
  let now = Date.now(); const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try { await withNativeRuntimeModel(async model => {
    const env = nativeWiringEnv(model); let application: ReturnType<typeof createGatewayApplication> | undefined;
    try {
      application = createGatewayApplication(env);
      const dispatches = [vi.spyOn(application.gatewayService, "execute"), vi.spyOn(application.gatewayService, "executeStream"),
        vi.spyOn(application.gatewayService, "executeProviderOperation")];
      expect(application.localClientPopIdentityStatus.available).toBe(false);
      const binding = { tenantId: "tenant-native-runtime", clientId: "managed.native-runtime" };
      await expect(application.localClientPopIdentityAuthority!.prepareReplayProtection(binding)).resolves.toBe(false);
      expect(existsSync(model.sqlitePath)).toBe(false); expect(model.f.calls.write).toBe(0);
      const registryKey = materializeConfiguredLocalClientPopRegistryKey(env);
      try { await expect(enrollConfiguredLocalClientNativePopReplayBaseline(env, registryKey)).resolves.toMatchObject({ generation: 1, state: "ready" }); }
      finally { registryKey.fill(0); }
      await expect(application.localClientPopIdentityAuthority!.prepareReplayProtection(binding)).resolves.toBe(true);
      expect(application.localClientPopIdentityStatus).toMatchObject({ available: true, snapshotRollbackProtected: true });
      now += 8_001; expect(application.localClientPopIdentityStatus.available).toBe(false);
      await expect(application.localClientPopIdentityAuthority!.prepareReplayProtection(binding)).resolves.toBe(true);
      expect(application.localClientPopIdentityStatus.available).toBe(true);
      for (const dispatch of dispatches) { expect(dispatch).not.toHaveBeenCalled(); dispatch.mockRestore(); }
    } finally { await closeNativeWiringApplication(application); }
  }); } finally { clock.mockRestore(); }
});

it.skipIf(process.platform !== "win32")("MODEL native wiring: management CLI enrolls through the same configuration and emits only a safe checkpoint", async () => {
  await withNativeRuntimeModel(async model => {
    const env = nativeWiringEnv(model), output: string[] = []; let application: ReturnType<typeof createGatewayApplication> | undefined;
    try {
      await expect(runLocalClientNativePopReplayCommand(["enroll-baseline", "--yes"], env, (text: string) => { output.push(text); return true; })).resolves.toBe(0);
      expect(output).toHaveLength(1); const result = JSON.parse(output[0]);
      expect(result).toMatchObject({ success: true, operation: "enroll-baseline", checkpointVersion: LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION, generation: 1 });
      expect(Object.keys(result).sort()).toEqual(["anchorBindingSha256", "checkpointDigestSha256", "checkpointVersion", "generation", "operation", "storeBindingSha256", "success"]);
      expect(output.join("")).not.toContain(env.NATIVE_MODEL_CLIENT_SECRET); expect(output.join("")).not.toContain(env.NATIVE_MODEL_REGISTRY_SECRET);
      application = createGatewayApplication(env);
      await expect(application.localClientPopIdentityAuthority!.prepareReplayProtection({ tenantId: "tenant-native-runtime", clientId: "managed.native-runtime" })).resolves.toBe(true);
      expect(application.localClientPopIdentityStatus).toMatchObject({ available: true, snapshotRollbackProtected: true });
      const registryKey = materializeConfiguredLocalClientPopRegistryKey(env);
      try {
        const same = await enrollConfiguredLocalClientNativePopReplayBaseline(env, registryKey);
        expect(same.storeBindingSha256).toBe(result.storeBindingSha256); expect(same.anchorBindingSha256).toBe(result.anchorBindingSha256);
        expect(same.checkpointDigestSha256).toBe(result.checkpointDigestSha256); expect(same.generation).toBe(1);
      } finally { registryKey.fill(0); }
      expect(model.f.nonceCount).toBe(0);
    } finally { await closeNativeWiringApplication(application); }
  });
});
