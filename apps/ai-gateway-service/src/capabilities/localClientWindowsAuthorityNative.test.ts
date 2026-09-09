import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
import { createLocalClientNativeAuthorityZeroCheckpoints, handleLocalClientAuthorityWorkerEnvelope } from "./localClientWindowsAuthorityBrokerEntry.ts";
import { createLocalClientWindowsAuthorityProvisioningPlan, LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID } from "./localClientWindowsAuthorityBrokerService.ts";
import { createLocalClientWindowsAuthorityFileHmac, createLocalClientWindowsAuthorityRequestHmac,
  type LocalClientWindowsAuthorityBrokerRequest, type LocalClientWindowsAuthorityFileCheckpoint } from "./localClientWindowsProtectedAuthorityAnchor.ts";

const SERVICE_SID = LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
const USER_SID = "S-1-5-21-101-202-303-1001";
const ADMIN_SID = "S-1-5-32-544";
const SYSTEM_SID = "S-1-5-18";
const installationId = "12345678-1234-1234-1234-123456789012";
const bootstrap = { version: "local-client-windows-authority-bootstrap-v3" as const, installationId,
  hostId: `windows-authority-${installationId}`, currentUserSid: USER_SID,
  programDataBasePath: "C:\\fixture\\ProgramData", anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS], packageManifestSha256: "a".repeat(64) };
const BOOTSTRAP_REQUEST = JSON.stringify({ version: "local-client-windows-authority-bootstrap-request-v1" });

/** Native API behavior model only: these tests exercise the real TS broker and
 * signing code, not Windows tokens, filesystem ACLs, SCM, named pipes or DPAPI. */
function fixture(basePath?: string) {
  const configuration = { ...bootstrap, programDataBasePath: basePath ?? bootstrap.programDataBasePath };
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

it("MODEL: requires actual challenge HMAC validation before exposing PoP evidence and preserves the old slots", async () => {
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

it("MODEL: bounds native request and nonce cost for the real SQLite consume plus wrapper attestation chain", async () => {
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

it("MODEL boundary: closing an in-flight verification cannot restore ready status", async () => {
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

it("MODEL boundary: attestation binds the captured checkpoint and challenge while caller inputs change", async () => {
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

it("MODEL lifecycle: the full SQLite consume chain crosses two capacity windows with zero legacy claims", async () => {
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

it("MODEL lifecycle: a service restart rejects a captured unexpired frame and requires fresh bootstrap", async () => {
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

it("MODEL lifecycle: expiry and clock rollback withdraw cached adapter readiness", async () => {
  let now = Date.now(); const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try { await withPopBinding(async (_f, binding, checkpoint) => {
    await binding.authority.enrollBaseline(checkpoint.checkpointDigestSha256); const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256);
    await adapter.preflight(checkpoint); expect(adapter.status.available).toBe(true);
    now -= 1; expect(adapter.status.available).toBe(false); now += 1;
    expect(adapter.status.available).toBe(false); await adapter.preflight(checkpoint); expect(adapter.status.available).toBe(true);
    now += 8000; expect(adapter.status.available).toBe(false);
  }); } finally { clock.mockRestore(); }
});
