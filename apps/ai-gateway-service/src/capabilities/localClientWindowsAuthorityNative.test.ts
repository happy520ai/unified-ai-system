import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import {
  LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS, LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS, LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS,
  boundedJson, createLocalClientNativeAuthorityClient,
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
const bootstrap = { version: "local-client-windows-authority-bootstrap-v1" as const, installationId,
  hostId: `windows-authority-${installationId}`, currentUserSid: USER_SID,
  programDataBasePath: "C:\\fixture\\ProgramData", anchorIds: [...LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS] };
const BOOTSTRAP_REQUEST = JSON.stringify({ version: "local-client-windows-authority-bootstrap-request-v1" });

/** Native API behavior model only: these tests exercise the real TS broker and
 * signing code, not Windows tokens, filesystem ACLs, SCM, named pipes or DPAPI. */
function fixture() {
  const key = Buffer.alloc(32, 73);
  const helperInput = { hostId: bootstrap.hostId, currentUserSid: USER_SID,
    programDataBasePath: bootstrap.programDataBasePath, anchorIds: bootstrap.anchorIds, integrityKey: key.toString("base64") };
  const files = new Map<string, LocalClientWindowsAuthorityFileCheckpoint>();
  const registry = new Map<string, ReturnType<typeof state>>();
  for (const item of createLocalClientNativeAuthorityZeroCheckpoints(helperInput).checkpoints) {
    const file = JSON.parse(item.checkpointJson) as LocalClientWindowsAuthorityFileCheckpoint;
    files.set(file.anchorPath, file); registry.set(file.hklmKeyPath, state(file));
  }
  const calls = { context: 0, end: 0, lock: 0, release: 0, write: 0, acl: 0, initialize: 0, load: 0 };
  const returnedKeys: Buffer[] = [];
  const nonces = new Set<string>();
  let active = false, lease: string | null = null, writable = false, refuseContext = false, refuseService = false, failWrite = false;
  const api: LocalClientNativeAuthorityApi = {
    inspectEnvironment: () => ({ osPlatform: "win32", programDataBasePath: bootstrap.programDataBasePath }),
    initializeService(input) { calls.initialize++; if (refuseService || input.hostId !== bootstrap.hostId || input.currentUserSid !== USER_SID) throw new Error("MODEL_SERVICE_REFUSED"); },
    readBootstrap() { calls.load++; const copy = Buffer.from(key); returnedKeys.push(copy); return { configJson: JSON.stringify(bootstrap), integrityKey: copy }; },
    beginRequest(handle) { calls.context++; if (refuseContext || handle !== "123") throw new Error("MODEL_CALLER_REFUSED"); active = true; return "context"; },
    endRequest(context) { expect(context).toBe("context"); expect(lease).toBeNull(); active = false; calls.end++; },
    async acquireLock(context) { expect(context).toBe("context"); expect(active).toBe(true); expect(lease).toBeNull(); calls.lock++; return lease = "lease"; },
    releaseLock(input) { expect(input).toBe(lease); lease = null; calls.release++; },
    claimNonce(input, nonce) { expect(input).toBe(lease); if (nonces.has(nonce)) return "replayed"; nonces.add(nonce); return "claimed"; },
    readProtectedFileCheckpoint(input, target) { expect(input).toBe(lease); return JSON.stringify(files.get(target.anchorPath)); },
    writeProtectedFileCheckpointAtomically(input, target, value) { expect(input).toBe(lease); if (failWrite) throw new Error("MODEL_WRITE_FAILED"); calls.write++; files.set(target.anchorPath, JSON.parse(value)); },
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
    request: payload => handleLocalClientNativeAuthorityRequest(api, "123", payload),
  };
  const target = createLocalClientWindowsAuthorityProvisioningPlan(bootstrap.programDataBasePath, [], { anchorId: "gateway-vscode" });
  function signed(operation: LocalClientWindowsAuthorityBrokerRequest["operation"], generation = 0, digest: string | null = null,
    nextGeneration: number | null = null, nextDigest: string | null = null) {
    const request = { requestVersion: "local-client-windows-authority-request-v1" as const, operation,
      nonce: randomBytes(32).toString("hex"), hostId: bootstrap.hostId, serviceSid: SERVICE_SID, currentUserSid: USER_SID,
      anchorPath: target.storage.anchorPath, programDataRoot: target.storage.programDataRoot, hklmKeyPath: target.registry.keyPath,
      hklmView: "registry64" as const, expectedCurrentGeneration: generation, expectedCurrentDigest: digest,
      nextGeneration, nextDigest };
    return { ...request, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(key, request) };
  }
  return { api, key, files, registry, calls, returnedKeys, target, signed,
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

it("signs disjoint runtime and validation baselines without returning the dedicated key", () => {
  const f = fixture();
  expect(LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS).toHaveLength(6);
  expect(LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS).toHaveLength(6);
  expect(LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS.some(id => LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS.includes(id))).toBe(false);
  expect(f.files.size).toBe(12);
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
