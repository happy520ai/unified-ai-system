import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { isAbsolute, win32 } from "node:path";
import {
  LocalClientWindowsAuthorityBrokerService, createLocalClientWindowsAuthorityProvisioningPlan,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME, LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
  type WindowsAuthorityOsPort, type WindowsAuthorityStorageTarget,
} from "./localClientWindowsAuthorityBrokerService.ts";
import {
  LocalClientWindowsProtectedAuthorityAnchor, createLocalClientWindowsAuthorityRequestHmac,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
  type LocalClientWindowsAuthorityBrokerRequest, type LocalClientWindowsAuthorityPrivilegedBrokerPort,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";

const BOOTSTRAP_VERSION = "local-client-windows-authority-bootstrap-v1";
const BOOTSTRAP_REQUEST = "local-client-windows-authority-bootstrap-request-v1";
const BOOTSTRAP_RESPONSE = "local-client-windows-authority-bootstrap-response-v1";
const MAX_BYTES = 65_536;
const LOCK_NAME = "Global\\UnifiedAiSystemLocalClientAuthorityBroker-v1";
export const LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS = Object.freeze([
  "gateway-vscode", "client-vscode", "workcopy-vscode", "gateway-cursor", "client-cursor", "workcopy-cursor",
]);
export const LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS = Object.freeze([
  "validation-gateway-vscode", "validation-client-vscode", "validation-workcopy-vscode",
  "validation-gateway-cursor", "validation-client-cursor", "validation-workcopy-cursor",
]);
// One-use validation must not consume the future editor runtime's baselines.
export const LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS = Object.freeze([
  ...LOCAL_CLIENT_NATIVE_AUTHORITY_RUNTIME_SLOTS, ...LOCAL_CLIENT_NATIVE_AUTHORITY_VALIDATION_SLOTS,
]);

export interface LocalClientNativeAuthorityApi {
  inspectEnvironment(): { osPlatform: string; programDataBasePath: string };
  initializeService(input: { hostId: string; currentUserSid: string }): void;
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
  version: typeof BOOTSTRAP_VERSION; installationId: string; hostId: string;
  currentUserSid: string; programDataBasePath: string; anchorIds: readonly string[];
}>;

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
  exact(value, ["version", "installationId", "hostId", "currentUserSid", "programDataBasePath", "anchorIds"]);
  if (value.version !== BOOTSTRAP_VERSION || typeof value.installationId !== "string"
    || !/^[a-f0-9-]{16,64}$/u.test(value.installationId)
    || value.hostId !== `windows-authority-${value.installationId}`
    || typeof value.currentUserSid !== "string" || !/^S-1-5-21-(?:[0-9]+-){3}[0-9]+$/u.test(value.currentUserSid)
    || typeof value.programDataBasePath !== "string" || !Array.isArray(value.anchorIds)
    || value.anchorIds.length !== LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS.length
    || new Set(value.anchorIds).size !== value.anchorIds.length
    || value.anchorIds.some(id => !LOCAL_CLIENT_NATIVE_AUTHORITY_SLOTS.includes(id))) fail();
  for (const anchorId of value.anchorIds) createLocalClientWindowsAuthorityProvisioningPlan(value.programDataBasePath, [], { anchorId });
  return Object.freeze({ version: BOOTSTRAP_VERSION, installationId: value.installationId,
    hostId: String(value.hostId), currentUserSid: value.currentUserSid,
    programDataBasePath: value.programDataBasePath, anchorIds: Object.freeze([...value.anchorIds]) });
}

/** Adapts authenticated native request state to the existing broker OS port.
 * The native layer independently checks the fixed target and expiring lease. */
export function createLocalClientNativeAuthorityOsPort(native: LocalClientNativeAuthorityApi,
  bootstrap: LocalClientNativeAuthorityBootstrap, contextId: string): WindowsAuthorityOsPort {
  let lease: string | null = null;
  let active = false;
  const requiredLease = () => { if (lease === null) return fail(); return lease; };
  const identity = () => {
    native.initializeService({ hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid });
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
    async inspectRuntimeIdentity() { requiredLease(); return identity(); },
    async claimNonce(input: Parameters<WindowsAuthorityOsPort["claimNonce"]>[0]) {
      if (input.hostId !== bootstrap.hostId || input.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID) fail();
      return native.claimNonce(requiredLease(), input.nonce);
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
  callerTokenHandle: string, requestText: string): Promise<string> {
  const loaded = native.readBootstrap();
  let key: Buffer | null = null;
  let context: string | null = null;
  const brokers: LocalClientWindowsAuthorityBrokerService[] = [];
  try {
    if (!(loaded.integrityKey instanceof Uint8Array) || loaded.integrityKey.byteLength !== 32) fail();
    key = Buffer.from(loaded.integrityKey); loaded.integrityKey.fill(0);
    const bootstrap = parseLocalClientNativeAuthorityBootstrap(parseBounded(loaded.configJson));
    native.initializeService({ hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid });
    if (!/^[1-9][0-9]{0,19}$/u.test(callerTokenHandle)) fail();
    context = native.beginRequest(callerTokenHandle);
    const port = createLocalClientNativeAuthorityOsPort(native, bootstrap, context);
    const byPath = new Map<string, LocalClientWindowsAuthorityBrokerService>();
    for (const anchorId of bootstrap.anchorIds) {
      const broker = new LocalClientWindowsAuthorityBrokerService({ programDataBasePath: bootstrap.programDataBasePath,
        anchorId, hostId: bootstrap.hostId, currentUserSid: bootstrap.currentUserSid, integrityKey: key, osPort: port });
      brokers.push(broker); byPath.set(broker.target.anchorPath, broker);
    }
    const request = parseBounded(requestText);
    if (isRecord(request) && request.version === BOOTSTRAP_REQUEST) {
      exact(request, ["version"]);
      // Reuse the broker's independent ACL/file/HKLM checks before delivering its
      // dedicated shared HMAC key. No ACL is loosened to read the DPAPI key file.
      for (const broker of brokers) {
        let local: Record<string, unknown> | null = null;
        await port.runExclusive({ name: LOCK_NAME, hostId: bootstrap.hostId, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID }, async () => {
          const value = await port.readProtectedFileCheckpoint(broker.target);
          if (!isRecord(value)) fail(); local = value;
        });
        if (!local) fail();
        const current = local as Record<string, unknown>;
        const unsigned = { requestVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION, operation: "inspect" as const,
          nonce: randomBytes(32).toString("hex"), hostId: bootstrap.hostId, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
          currentUserSid: bootstrap.currentUserSid, anchorPath: broker.target.anchorPath, programDataRoot: broker.target.programDataRoot,
          hklmKeyPath: broker.target.hklmKeyPath, hklmView: "registry64" as const,
          expectedCurrentGeneration: current.currentGeneration as number, expectedCurrentDigest: current.currentDigest as string | null,
          nextGeneration: current.pendingGeneration as number | null, nextDigest: current.pendingDigest as string | null };
        await broker.inspect({ ...unsigned, requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(key, unsigned) });
      }
      return boundedJson({ version: BOOTSTRAP_RESPONSE, bootstrap, integrityKey: key.toString("base64") });
    }
    if (!isRecord(request) || typeof request.anchorPath !== "string") fail();
    const broker = byPath.get(request.anchorPath); if (!broker) fail();
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
  const response = parseBounded(await native.request(boundedJson({ version: BOOTSTRAP_REQUEST })));
  exact(response, ["version", "bootstrap", "integrityKey"]);
  if (response.version !== BOOTSTRAP_RESPONSE || typeof response.integrityKey !== "string") fail();
  const key = Buffer.from(response.integrityKey, "base64");
  try {
    if (key.byteLength !== 32 || key.toString("base64") !== response.integrityKey) fail();
    response.integrityKey = "";
    const bootstrap = parseLocalClientNativeAuthorityBootstrap(response.bootstrap);
    const environment = native.inspectEnvironment();
    if (environment.osPlatform !== "win32" || win32.normalize(environment.programDataBasePath).toLowerCase()
      !== win32.normalize(bootstrap.programDataBasePath).toLowerCase()) fail();
    const target = createLocalClientWindowsAuthorityProvisioningPlan(bootstrap.programDataBasePath, [], { anchorId });
    const invoke = async (request: LocalClientWindowsAuthorityBrokerRequest) => parseBounded(await native.request(boundedJson(request))) as Awaited<ReturnType<LocalClientWindowsAuthorityPrivilegedBrokerPort["inspect"]>>;
    const broker: LocalClientWindowsAuthorityPrivilegedBrokerPort = { inspect: invoke, prepareNext: invoke, finalize: invoke, enrollBaseline: invoke };
    return new LocalClientWindowsProtectedAuthorityAnchor({ enabled: true,
      anchorPath: target.storage.anchorPath, programDataRoot: target.storage.programDataRoot,
      hklmKeyPath: target.registry.keyPath, hostId: bootstrap.hostId, serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
      currentUserSid: bootstrap.currentUserSid, integrityKey: key, broker });
  } finally { key.fill(0); }
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
