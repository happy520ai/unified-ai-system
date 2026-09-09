import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { isAbsolute, win32 } from "node:path";
import {
  LocalClientWindowsAuthorityBrokerService, createLocalClientWindowsAuthorityProvisioningPlan,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME, LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
  type WindowsAuthorityOsPort, type WindowsAuthorityStorageTarget, type WindowsAuthorityExpiringNonceInput,
} from "./localClientWindowsAuthorityBrokerService.ts";
import {
  LocalClientWindowsProtectedAuthorityAnchor, createLocalClientWindowsAuthorityRequestHmac,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION, LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION,
  type LocalClientWindowsAuthorityBrokerRequest, type LocalClientWindowsAuthorityPrivilegedBrokerPort,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";
import { LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION, LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION,
  type LocalClientPopExternalMonotonicAnchorPort, type LocalClientPopReplayCheckpoint,
  type LocalClientPopProtectedAnchorEvidence } from "./localClientPopSnapshotRollbackProtection.ts";

const LEGACY_BOOTSTRAP_VERSION = "local-client-windows-authority-bootstrap-v1";
const BOOTSTRAP_VERSION = "local-client-windows-authority-bootstrap-v2";
const LIFECYCLE_BOOTSTRAP_VERSION = "local-client-windows-authority-bootstrap-v3";
const MAINTENANCE_BOOTSTRAP_VERSION = "local-client-windows-authority-bootstrap-v4";
const BOOTSTRAP_REQUEST = "local-client-windows-authority-bootstrap-request-v1";
const BOOTSTRAP_RESPONSE = "local-client-windows-authority-bootstrap-response-v1";
const POP_BOOTSTRAP_REQUEST = "local-client-windows-authority-bootstrap-request-v2";
const POP_BOOTSTRAP_RESPONSE = "local-client-windows-authority-bootstrap-response-v2";
const MAX_BYTES = 65_536;
const LOCK_NAME = "Global\\UnifiedAiSystemLocalClientAuthorityBroker-v1";
const LEGACY_RUNTIME_SLOTS = Object.freeze([
  "gateway-vscode", "client-vscode", "workcopy-vscode", "gateway-cursor", "client-cursor", "workcopy-cursor",
]);
const LEGACY_VALIDATION_SLOTS = Object.freeze([
  "validation-gateway-vscode", "validation-client-vscode", "validation-workcopy-vscode",
  "validation-gateway-cursor", "validation-client-cursor", "validation-workcopy-cursor",
]);
export const LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS = Object.freeze([...LEGACY_RUNTIME_SLOTS, ...LEGACY_VALIDATION_SLOTS]);
export const LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS = Object.freeze([...LEGACY_RUNTIME_SLOTS, "pop-replay"]);
export const LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS = Object.freeze([...LEGACY_VALIDATION_SLOTS, "validation-pop-replay"]);
// One-use validation must not consume the future editor runtime's baselines.
export const LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS = Object.freeze([
  ...LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS, ...LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS,
]);

export interface LocalClientNativeAuthorityApi {
  inspectEnvironment(): { osPlatform: string; programDataBasePath: string };
  initializeService(input: { hostId: string; currentUserSid: string; serviceInstanceId?: string }): void;
  startPopServiceInstance?(): string;
  readPopServiceInstance?(lease: string, expectedHostInstance: string): { serviceInstanceId: string; observedAtMs: number };
  claimExpiringNonce?(lease: string, input: WindowsAuthorityExpiringNonceInput): { result: "claimed" | "replayed" | "expired" | "future" | "capacity"; observedAtMs: number };
  assertExpiringRequestFresh?(lease: string, input: WindowsAuthorityExpiringNonceInput): { observedAtMs: number };
  readBootstrap(): { configJson: string; integrityKey: Uint8Array };
  beginRequest(callerTokenHandle: string): string;
  endRequest(contextId: string): void;
  acquireLock(contextId: string): Promise<string>;
  releaseLock(lease: string): void;
  claimNonce(lease: string, nonce: string): "claimed" | "replayed";
  readProtectedFileCheckpoint(lease: string, target: WindowsAuthorityStorageTarget): string;
  writeProtectedFileCheckpointAtomically(lease: string, target: WindowsAuthorityStorageTarget, value: string): void;
  readHklmCheckpoint64(lease: string, target: WindowsAuthorityStorageTarget): string;
  writeHklmCheckpoint64(lease: string, target: WindowsAuthorityStorageTarget, value: string): void;
  inspectAclFacts(lease: string, contextId: string, target: WindowsAuthorityStorageTarget): unknown;
  request(payload: string): Promise<string>;
}
export type LocalClientNativeAuthorityBootstrap = Readonly<{
  version: typeof BOOTSTRAP_VERSION | typeof LEGACY_BOOTSTRAP_VERSION | typeof LIFECYCLE_BOOTSTRAP_VERSION | typeof MAINTENANCE_BOOTSTRAP_VERSION; installationId: string; hostId: string;
  currentUserSid: string; programDataBasePath: string; anchorIds: readonly string[];
  packageManifestSha256?: string;
}>;
const nativeClientBindings = new WeakMap<LocalClientWindowsProtectedAuthorityAnchor,
  Readonly<{ bootstrap: LocalClientNativeAuthorityBootstrap; anchorId: string; serviceInstanceId?: string }>>();

/** No automatic installation or fallback to a JavaScript authority model. The
 * service entry loads only its protected sibling addon; the build package can
 * also be explicitly loaded for non-mutating capability checks. */
export function loadLocalClientNativeAuthority(addonPath: string): LocalClientNativeAuthorityApi {
  if (process.platform !== "win32" || !isAbsolute(addonPath)
    || win32.basename(addonPath) !== "local-client-authority.node") fail();
  const native = createRequire(import.meta.url)(addonPath) as LocalClientNativeAuthorityApi;
  for (const name of ["inspectEnvironment", "initializeService", "readBootstrap", "beginRequest", "endRequest",
    "acquireLock", "releaseLock", "claimNonce", "readProtectedFileCheckpoint", "writeProtectedFileCheckpointAtomically",
    "readHklmCheckpoint64", "writeHklmCheckpoint64", "inspectAclFacts", "request"] as const) {
    if (typeof native[name] !== "function") fail();
  }
  return native;
}

export function parseLocalClientNativeAuthorityBootstrap(value: unknown): LocalClientNativeAuthorityBootstrap {
  const isV2 = isRecord(value) && (value.version === BOOTSTRAP_VERSION || hasPopLifecycle(value.version));
  exact(value, ["version", "installationId", "hostId", "currentUserSid", "programDataBasePath", "anchorIds", ...(isV2 ? ["packageManifestSha256"] : [])]);
  const slots = isV2 ? LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS : LOCAL_CLIENT_NATIVE_AUTHORITY_LEGACY_SLOTS;
  if ((value.version !== BOOTSTRAP_VERSION && value.version !== LEGACY_BOOTSTRAP_VERSION && !hasPopLifecycle(value.version)) || typeof value.installationId !== "string"
    || !/^[a-f0-9-]{16,64}$/u.test(value.installationId)
    || value.hostId !== `windows-authority-${value.installationId}`
    || typeof value.currentUserSid !== "string" || !/^S-1-5-21-(?:[0-9]+-){3}[0-9]+$/u.test(value.currentUserSid)
    || typeof value.programDataBasePath !== "string" || !Array.isArray(value.anchorIds)
    || value.anchorIds.length !== slots.length
    || new Set(value.anchorIds).size !== value.anchorIds.length
    || value.anchorIds.some(id => !slots.includes(id))
    || (isV2 && (typeof value.packageManifestSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.packageManifestSha256)))) fail();
  for (const anchorId of value.anchorIds) createLocalClientWindowsAuthorityProvisioningPlan(value.programDataBasePath, [], { anchorId });
  return Object.freeze({ version: value.version, installationId: value.installationId,
    hostId: String(value.hostId), currentUserSid: value.currentUserSid,
    programDataBasePath: value.programDataBasePath, anchorIds: Object.freeze([...value.anchorIds]),
    ...(isV2 ? { packageManifestSha256: String(value.packageManifestSha256) } : {}) });
}

/** Adapts authenticated native request state to the existing broker OS port.
 * The native layer independently checks the fixed target and expiring lease. */
export function createLocalClientNativeAuthorityOsPort(native: LocalClientNativeAuthorityApi,
  bootstrap: LocalClientNativeAuthorityBootstrap, contextId: string, serviceInstanceId?: string): WindowsAuthorityOsPort {
  let lease: string | null = null;
  let active = false;
  const requiredLease = () => { if (lease === null) return fail(); return lease; };
  const identity = () => {
    native.initializeService({ hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid, ...(serviceInstanceId ? { serviceInstanceId } : {}) });
    const facts = native.inspectEnvironment();
    if (facts.osPlatform !== "win32" || win32.normalize(facts.programDataBasePath).toLowerCase()
      !== win32.normalize(bootstrap.programDataBasePath).toLowerCase()) fail();
    return Object.freeze({ osPlatform: "win32" as const, hostId: bootstrap.hostId,
      serviceName: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
      runningAsServiceSid: true as const, programDataBasePath: facts.programDataBasePath, hklmView: "registry64" as const });
  };
  return Object.freeze({
    async runExclusive<T>(input: Parameters<WindowsAuthorityOsPort["runExclusive"]>[0], action: () => Promise<T>): Promise<T> {
      if (active || input.name !== LOCK_NAME || input.hostId !== bootstrap.hostId
        || input.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID) fail();
      active = true;
      try { lease = await native.acquireLock(contextId); return await action(); }
      finally { try { if (lease !== null) native.releaseLock(lease); } finally { lease = null; active = false; } }
    },
    async inspectRuntimeIdentity() {
      requiredLease(); const facts = identity();
      if (serviceInstanceId) {
        if (!native.readPopServiceInstance) fail();
        const current = native.readPopServiceInstance(requiredLease(), serviceInstanceId);
        if (current.serviceInstanceId !== serviceInstanceId || !Number.isSafeInteger(current.observedAtMs) || current.observedAtMs < 0) fail();
      }
      return facts;
    },
    async claimNonce(input: Parameters<WindowsAuthorityOsPort["claimNonce"]>[0]) {
      if (input.hostId !== bootstrap.hostId || input.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID) fail();
      return native.claimNonce(requiredLease(), input.nonce);
    },
    async claimExpiringNonce(input: WindowsAuthorityExpiringNonceInput) {
      if (!serviceInstanceId || input.serviceInstanceId !== serviceInstanceId || input.hostId !== bootstrap.hostId
        || input.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID || !native.claimExpiringNonce) fail();
      return native.claimExpiringNonce(requiredLease(), input);
    },
    async assertExpiringRequestFresh(input: WindowsAuthorityExpiringNonceInput) {
      if (!serviceInstanceId || input.serviceInstanceId !== serviceInstanceId || input.hostId !== bootstrap.hostId
        || input.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID || !native.assertExpiringRequestFresh) fail();
      return native.assertExpiringRequestFresh(requiredLease(), input);
    },
    async readProtectedFileCheckpoint(target: WindowsAuthorityStorageTarget) {
      return parseBounded(native.readProtectedFileCheckpoint(requiredLease(), target));
    },
    async writeProtectedFileCheckpointAtomically(target: WindowsAuthorityStorageTarget, checkpoint: Parameters<WindowsAuthorityOsPort["writeProtectedFileCheckpointAtomically"]>[1]) {
      native.writeProtectedFileCheckpointAtomically(requiredLease(), target, boundedJson(checkpoint));
    },
    async readHklmCheckpoint64(target: WindowsAuthorityStorageTarget) {
      return parseBounded(native.readHklmCheckpoint64(requiredLease(), target));
    },
    async writeHklmCheckpoint64(target: WindowsAuthorityStorageTarget, checkpoint: Parameters<WindowsAuthorityOsPort["writeHklmCheckpoint64"]>[1]) {
      native.writeHklmCheckpoint64(requiredLease(), target, boundedJson(checkpoint));
    },
    async inspectAclFacts(target: WindowsAuthorityStorageTarget) {
      return native.inspectAclFacts(requiredLease(), contextId, target);
    },
  });
}

/** The host creates callerTokenHandle from its actual pipe impersonation token
 * and delivers it through private worker stdin. It is never read from a request.
 * Dedicated authority-key delivery uses that authenticated pipe only. No SQLite
 * row/storage key or existing credential is part of this protocol. */
export async function handleLocalClientNativeAuthorityRequest(native: LocalClientNativeAuthorityApi,
  callerTokenHandle: string, requestText: string, hostServiceInstanceId?: string): Promise<string> {
  const loaded = native.readBootstrap();
  let key: Buffer | null = null;
  let context: string | null = null;
  const brokers: LocalClientWindowsAuthorityBrokerService[] = [];
  try {
    if (!(loaded.integrityKey instanceof Uint8Array) || loaded.integrityKey.byteLength !== 32) fail();
    key = Buffer.from(loaded.integrityKey); loaded.integrityKey.fill(0);
    const bootstrap = parseLocalClientNativeAuthorityBootstrap(parseBounded(loaded.configJson));
    if (hostServiceInstanceId !== undefined && !/^[a-f0-9]{64}$/u.test(hostServiceInstanceId)) fail();
    native.initializeService({ hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid,
      ...(hostServiceInstanceId ? { serviceInstanceId: hostServiceInstanceId } : {}) });
    if (!/^[1-9][0-9]{0,19}$/u.test(callerTokenHandle)) fail();
    context = native.beginRequest(callerTokenHandle);
    const port = createLocalClientNativeAuthorityOsPort(native, bootstrap, context, hostServiceInstanceId);
    const byPath = new Map<string, LocalClientWindowsAuthorityBrokerService>();
    for (const anchorId of bootstrap.anchorIds) {
      const broker = new LocalClientWindowsAuthorityBrokerService({ programDataBasePath: bootstrap.programDataBasePath,
        anchorId, hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid, integrityKey: key, osPort: port });
      brokers.push(broker); byPath.set(broker.target.anchorPath, broker);
    }
    const request = parseBounded(requestText);
    const popBootstrap = isRecord(request) && request.version === POP_BOOTSTRAP_REQUEST;
    if (isRecord(request) && (request.version === BOOTSTRAP_REQUEST || popBootstrap)) {
      exact(request, popBootstrap ? ["version", "challenge", "clientSessionId", "issuedAtMs", "expiresAtMs"] : ["version"]);
      let popObservedAtMs: number | undefined;
      if (popBootstrap) {
        if (!hasPopLifecycle(bootstrap.version) || !hostServiceInstanceId || !native.readPopServiceInstance
          || typeof request.challenge !== "string" || !/^[a-f0-9]{64}$/u.test(request.challenge)
          || typeof request.clientSessionId !== "string" || !/^[a-f0-9]{64}$/u.test(request.clientSessionId)
          || !Number.isSafeInteger(request.issuedAtMs) || !Number.isSafeInteger(request.expiresAtMs)
          || Number(request.issuedAtMs) < 0 || Number(request.issuedAtMs) >= Number(request.expiresAtMs)
          || Number(request.expiresAtMs) - Number(request.issuedAtMs) > 8000) fail();
      }
      // Reuse the broker's independent ACL/file/HKLM checks before delivering its
      // dedicated shared HMAC key. No ACL is loosened to read the DPAPI key file.
      let bootstrapSequence = 0;
      for (const broker of brokers) {
        const isPopSlot = /\\(?:validation-)?pop-replay\\authority\.json$/u.test(broker.target.anchorPath);
        if (isPopSlot !== popBootstrap) continue;
        let local: Record<string, unknown> | null = null;
        await port.runExclusive({ name: LOCK_NAME, hostId: bootstrap.hostId, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID }, async () => {
          const value = await port.readProtectedFileCheckpoint(broker.target);
          if (!isRecord(value)) fail(); local = value;
        });
        if (!local) fail();
        const current = local as Record<string, unknown>;
        const unsigned = { requestVersion: popBootstrap ? LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION : LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION, operation: "inspect" as const,
          nonce: randomBytes(32).toString("hex"), hostId: bootstrap.hostId, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
          currentUserSid: bootstrap.currentUserSid, anchorPath: broker.target.anchorPath, programDataRoot: broker.target.programDataRoot,
          hklmKeyPath: broker.target.hklmKeyPath, hklmView: "registry64" as const,
          expectedCurrentGeneration: current.currentGeneration as number, expectedCurrentDigest: current.currentDigest as string | null,
          nextGeneration: current.pendingGeneration as number | null, nextDigest: current.pendingDigest as string | null,
          ...(popBootstrap ? { serviceInstanceId: hostServiceInstanceId!, clientSessionId: String(request.clientSessionId), requestSequence: ++bootstrapSequence,
            issuedAtMs: Number(request.issuedAtMs), expiresAtMs: Number(request.expiresAtMs), attestationContext: null } : {}) };
        const signed = { ...unsigned, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(key, unsigned as Omit<LocalClientWindowsAuthorityBrokerRequest, "requestHmacSha256">) } as LocalClientWindowsAuthorityBrokerRequest;
        const checked = await broker.inspect(signed);
        if ("observedAtMs" in checked) popObservedAtMs = checked.observedAtMs;
      }
      if (popBootstrap) return boundedJson({ version: POP_BOOTSTRAP_RESPONSE, bootstrap, integrityKey: key.toString("base64"),
        challenge: request.challenge, clientSessionId: request.clientSessionId, serviceInstanceId: hostServiceInstanceId,
        issuedAtMs: request.issuedAtMs, expiresAtMs: request.expiresAtMs, observedAtMs: popObservedAtMs });
      return boundedJson({ version: BOOTSTRAP_RESPONSE, bootstrap, integrityKey: key.toString("base64") });
    }
    if (!isRecord(request) || typeof request.anchorPath !== "string") fail();
    const broker = byPath.get(request.anchorPath); if (!broker) fail();
    const isPop = /\\(?:validation-)?pop-replay\\authority\.json$/u.test(broker.target.anchorPath);
    if (isPop && (!hostServiceInstanceId || !hasPopLifecycle(bootstrap.version)
      || request.requestVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_V2_VERSION || request.serviceInstanceId !== hostServiceInstanceId)) fail();
    const operation = request.operation;
    const method = operation === "inspect" ? "inspect" : operation === "prepare-next" ? "prepareNext"
      : operation === "finalize" ? "finalize" : operation === "enroll-baseline" ? "enrollBaseline" : null;
    if (!method) fail();
    return boundedJson(await broker[method](request as unknown as LocalClientWindowsAuthorityBrokerRequest));
  } finally {
    try { for (const broker of brokers) await broker.close(); }
    finally { try { if (context !== null) native.endRequest(context); } finally { key?.fill(0); loaded.integrityKey.fill(0); } }
  }
}

export async function createLocalClientNativeAuthorityClient(native: LocalClientNativeAuthorityApi, anchorId: string) {
  if (!LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS.includes(anchorId)) fail();
  const isPop = anchorId === "pop-replay" || anchorId === "validation-pop-replay";
  const startedAtMs = Date.now(), startedTick = performance.now(), challenge = randomBytes(32).toString("hex"), clientSessionId = randomBytes(32).toString("hex");
  const expiresAtMs = startedAtMs + 8000;
  const response = parseBounded(await native.request(boundedJson(isPop ? {
    version: POP_BOOTSTRAP_REQUEST, challenge, clientSessionId, issuedAtMs: startedAtMs, expiresAtMs,
  } : { version: BOOTSTRAP_REQUEST })));
  exact(response, ["version", "bootstrap", "integrityKey", ...(isPop ? ["challenge", "clientSessionId", "serviceInstanceId", "issuedAtMs", "expiresAtMs", "observedAtMs"] : [])]);
  if (response.version !== (isPop ? POP_BOOTSTRAP_RESPONSE : BOOTSTRAP_RESPONSE) || typeof response.integrityKey !== "string") fail();
  if (isPop && (response.challenge !== challenge || response.clientSessionId !== clientSessionId
    || response.issuedAtMs !== startedAtMs || response.expiresAtMs !== expiresAtMs
    || typeof response.serviceInstanceId !== "string" || !/^[a-f0-9]{64}$/u.test(response.serviceInstanceId)
    || !Number.isSafeInteger(response.observedAtMs) || Number(response.observedAtMs) < startedAtMs || Number(response.observedAtMs) >= expiresAtMs
    || Date.now() < Number(response.observedAtMs) || Date.now() >= expiresAtMs || performance.now() - startedTick >= 8000)) fail();
  const key = Buffer.from(response.integrityKey, "base64");
  try {
    if (key.byteLength !== 32 || key.toString("base64") !== response.integrityKey) fail();
    response.integrityKey = "";
    const bootstrap = parseLocalClientNativeAuthorityBootstrap(response.bootstrap);
    if (isPop && !hasPopLifecycle(bootstrap.version)) throw new Error("LOCAL_CLIENT_NATIVE_POP_LIFECYCLE_REQUIRED");
    if (!bootstrap.anchorIds.includes(anchorId)) throw new Error("LOCAL_CLIENT_NATIVE_AUTHORITY_SLOT_VERSION_REQUIRED");
    const environment = native.inspectEnvironment();
    if (environment.osPlatform !== "win32" || win32.normalize(environment.programDataBasePath).toLowerCase()
      !== win32.normalize(bootstrap.programDataBasePath).toLowerCase()) fail();
    const target = createLocalClientWindowsAuthorityProvisioningPlan(bootstrap.programDataBasePath, [], { anchorId });
    const invoke = async (request: LocalClientWindowsAuthorityBrokerRequest) => parseBounded(await native.request(boundedJson(request))) as Awaited<ReturnType<LocalClientWindowsAuthorityPrivilegedBrokerPort["inspect"]>>;
    const broker: LocalClientWindowsAuthorityPrivilegedBrokerPort = { inspect: invoke, prepareNext: invoke, finalize: invoke, enrollBaseline: invoke };
    const authority = new LocalClientWindowsProtectedAuthorityAnchor({ enabled: true,
      anchorPath: target.storage.anchorPath, programDataRoot: target.storage.programDataRoot,
      hklmKeyPath: target.registry.keyPath, hostId: bootstrap.hostId, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
      currentUserSid: bootstrap.currentUserSid, integrityKey: key, broker,
      ...(isPop ? { popProtocol: { serviceInstanceId: String(response.serviceInstanceId),
        installedManifestSha256: bootstrap.packageManifestSha256!, anchorBindingSha256: popAnchorBinding(bootstrap, anchorId) } } : {}) });
    nativeClientBindings.set(authority, Object.freeze({ bootstrap, anchorId, ...(isPop ? { serviceInstanceId: String(response.serviceInstanceId) } : {}) }));
    return authority;
  } finally { key.fill(0); }
}

/** The native API is a trusted OS transport, not caller JSON. This creates no baseline or service. */
export async function createLocalClientNativePopReplayBinding(native: LocalClientNativeAuthorityApi) {
  const authority = await createLocalClientNativeAuthorityClient(native, "pop-replay");
  const binding = nativeClientBindings.get(authority)!;
  if (!hasPopLifecycle(binding.bootstrap.version) || !binding.bootstrap.packageManifestSha256 || !binding.serviceInstanceId) {
    await authority.close(); throw new Error("LOCAL_CLIENT_NATIVE_POP_V2_REQUIRED");
  }
  const deploymentEvidenceSha256 = binding.bootstrap.packageManifestSha256;
  const anchorBindingSha256 = popAnchorBinding(binding.bootstrap, binding.anchorId);
  // Capture the real private-validation entry point before exposing the authority.
  const verifyCheckpointChallenge = authority.verifyCheckpointChallenge.bind(authority);
  let closed = false, verified = false, adapterCreated = false;
  let verifying = false, verificationSequence = 0;
  let verifiedUntilMs = 0, observedClockMs = 0, verifiedTick = 0;
  const close = async () => { closed = true; verified = false; await authority.close(); };
  return Object.freeze({ authority, anchorBindingSha256, close,
    createEvidenceAdapter(storeBindingSha256: string) {
      if (closed || adapterCreated || !/^[a-f0-9]{64}$/u.test(storeBindingSha256)) fail();
      adapterCreated = true;
      const combinedBinding = createHash("sha256").update(JSON.stringify([
        storeBindingSha256, anchorBindingSha256, deploymentEvidenceSha256,
      ])).digest("hex");
      const verifyCurrent: LocalClientPopExternalMonotonicAnchorPort["verifyCurrent"] = async ({ checkpoint, challenge }) => {
        const sequence = ++verificationSequence;
        verified = false;
        // An overlapping attempt invalidates the current result; neither may publish ready.
        if (closed || verifying) fail();
        verifying = true;
        let challengeSnapshot: Buffer | undefined;
        try {
          if (checkpoint?.checkpointVersion !== LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION
            || checkpoint.state !== "ready" || checkpoint.storeBindingSha256 !== storeBindingSha256
            || checkpoint.anchorBindingSha256 !== anchorBindingSha256
            || !(challenge instanceof Uint8Array) || challenge.byteLength !== 32) fail();
          const generation = checkpoint.generation, digest = checkpoint.checkpointDigestSha256;
          challengeSnapshot = Buffer.from(challenge);
          const challengeSha256 = createHash("sha256").update(challengeSnapshot).digest("hex");
          const proof = await verifyCheckpointChallenge({ generation, digest,
            bindingSha256: combinedBinding, storeBindingSha256, challenge: challengeSnapshot });
          // This result follows response HMAC+nonce, independent file, HKLM and ACL verification.
          if (closed || sequence !== verificationSequence || proof.generation !== generation || proof.digest !== digest
            || proof.challengeSha256 !== challengeSha256 || !/^[a-f0-9]{64}$/u.test(proof.attestationSha256)
            || proof.serviceInstanceId !== binding.serviceInstanceId || !Number.isSafeInteger(proof.expiresAtMs)
            || !Number.isSafeInteger(proof.observedAtMs) || Date.now() < Number(proof.observedAtMs) || Date.now() >= Number(proof.expiresAtMs)) fail();
          verifiedUntilMs = Number(proof.expiresAtMs); observedClockMs = Date.now(); verifiedTick = performance.now();
          verified = true;
          return Object.freeze({ evidenceVersion: LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION,
            evidenceKind: "native-protected-external-monotonic-anchor", storeBindingSha256, anchorBindingSha256,
            generation, checkpointDigestSha256: digest, challengeSha256,
            deploymentEvidenceSha256, nativeDeploymentVerified: true, monotonic: true,
            externalToReplayStoreSnapshot: true, protectedFromReplayStoreWriter: true, attestationVerified: true }) satisfies LocalClientPopProtectedAnchorEvidence;
        } catch (error) { verified = false; throw error; }
        finally { verifying = false; challengeSnapshot?.fill(0); }
      };
      return Object.freeze({
        get status() { const now = Date.now(); if (now < observedClockMs || now >= verifiedUntilMs
          || performance.now() - verifiedTick >= 8000) verified = false; else observedClockMs = now;
          const ready = !closed && !verifying && verified; return Object.freeze({ available: ready,
          mode: "windows-native-pop-replay-v2", anchorBindingSha256, deploymentEvidenceSha256,
          nativeDeploymentVerified: ready, monotonic: ready, externalToReplayStoreSnapshot: ready,
          protectedFromReplayStoreWriter: ready, challengeAttestation: ready }); },
        verifyCurrent, close,
        async preflight(checkpoint: LocalClientPopReplayCheckpoint) {
          const challenge = randomBytes(32);
          try { return await verifyCurrent({ checkpoint, challenge }); } finally { challenge.fill(0); }
        },
      });
    },
  });
}

function popAnchorBinding(bootstrap: LocalClientNativeAuthorityBootstrap, anchorId: string) {
  return createHash("sha256").update(JSON.stringify(["local-client-native-pop-anchor-v1", bootstrap.installationId,
    bootstrap.hostId, bootstrap.currentUserSid, bootstrap.programDataBasePath, anchorId])).digest("hex");
}
function hasPopLifecycle(version: unknown): version is typeof LIFECYCLE_BOOTSTRAP_VERSION | typeof MAINTENANCE_BOOTSTRAP_VERSION {
  return version === LIFECYCLE_BOOTSTRAP_VERSION || version === MAINTENANCE_BOOTSTRAP_VERSION;
}

export function parseBounded(text: string): unknown {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > MAX_BYTES || text.length < 2) return fail();
  try { return JSON.parse(text); } catch { return fail(); }
}
export function boundedJson(value: unknown) { const text = JSON.stringify(value); parseBounded(text); return text; }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) fail();
}
function fail(): never { throw new Error("LOCAL_CLIENT_NATIVE_AUTHORITY_REJECTED"); }
