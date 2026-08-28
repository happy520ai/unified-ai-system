import { timingSafeEqual } from "node:crypto";
import { win32 } from "node:path";

import {
  LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
  createLocalClientWindowsAuthorityFileHmac,
  createLocalClientWindowsAuthorityRequestHmac,
  createLocalClientWindowsAuthorityResponseHmac,
  type LocalClientWindowsAuthorityAclFacts,
  type LocalClientWindowsAuthorityBrokerRequest,
  type LocalClientWindowsAuthorityBrokerResponse,
  type LocalClientWindowsAuthorityCheckpointState,
  type LocalClientWindowsAuthorityFileCheckpoint,
  type LocalClientWindowsAuthorityOperation,
  type LocalClientWindowsAuthorityPrivilegedBrokerPort,
} from "./localClientWindowsProtectedAuthorityAnchor.ts";

/**
 * Fixed Windows provisioning identity. The SID is the deterministic NT SERVICE
 * SID for LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME.
 */
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME =
  "UnifiedAiSystemLocalClientAuthorityBroker" as const;
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID =
  "S-1-5-80-2517572854-3647151239-2500651488-2982019916-1580030387" as const;
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_PROGRAM_DATA_SUBPATH =
  "UnifiedAISystem\\LocalClientAuthority" as const;
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_ANCHOR_FILE_NAME = "authority.json" as const;
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY =
  "HKLM\\Software\\UnifiedAISystem\\LocalClientAuthority" as const;

export const LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES = Object.freeze({
  windowsOnly: true as const,
  brokerCoreImplemented: true as const,
  nativeWindowsAdapterImplemented: false as const,
  brokerTransportImplemented: false as const,
  provisionerImplemented: false as const,
  provisioningPlanImplemented: true as const,
  integrityKeyProvisioningImplemented: false as const,
  defaultProvisioningMode: "check-only" as const,
  applyRequiresExplicitFlags: Object.freeze(["--apply", "--yes"] as const),
  shellExecution: false as const,
  hklmView: "registry64" as const,
  durableNonceClaimRequired: true as const,
  systemWideExclusiveLockRequired: true as const,
  callerTokenAuthenticationRequired: true as const,
  aclFactsRequireNativeSecurityDescriptorInspection: true as const,
  partialPairWriteRecovery: "administrator-reconciliation-required" as const,
  administratorResistance: "not-admin-resistant" as const,
});

export type LocalClientWindowsAuthorityProvisioningMode = "check-only" | "apply";

export interface LocalClientWindowsAuthorityProvisioningPlan {
  readonly planVersion: "local-client-windows-authority-provisioning-plan-v1";
  readonly mode: LocalClientWindowsAuthorityProvisioningMode;
  /** Creating this plan never mutates Windows. */
  readonly mutatesSystem: false;
  /** A native provisioner may apply only when this is true. */
  readonly applyAuthorized: boolean;
  readonly service: Readonly<{
    name: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME;
    sid: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
    account: `NT SERVICE\\${typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME}`;
    requireServiceSidToken: true;
  }>;
  readonly storage: Readonly<{
    programDataBasePath: string;
    programDataRoot: string;
    anchorPath: string;
    maxFileBytes: 65_536;
    rejectReparsePoints: true;
    requireAtomicReplaceAndFlush: true;
  }>;
  readonly registry: Readonly<{
    hive: "HKLM";
    keyPath: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY;
    view: "registry64";
  }>;
  readonly guard: Readonly<{
    defaultMode: "check-only";
    applyFlags: readonly ["--apply", "--yes"];
  }>;
  readonly nativeProvisionerRequirements: readonly string[];
  readonly boundaries: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES;
}

export interface WindowsAuthorityStorageTarget {
  readonly serviceName: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME;
  readonly serviceSid: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
  readonly programDataBasePath: string;
  readonly programDataRoot: string;
  readonly anchorPath: string;
  readonly hklmKeyPath: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY;
  readonly hklmView: "registry64";
}

export interface WindowsAuthorityRuntimeIdentity {
  readonly osPlatform: "win32";
  readonly hostId: string;
  readonly serviceName: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME;
  readonly serviceSid: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
  readonly runningAsServiceSid: true;
  readonly programDataBasePath: string;
  readonly hklmView: "registry64";
}

export interface WindowsAuthorityExclusiveLockInput {
  readonly name: "Global\\UnifiedAiSystemLocalClientAuthorityBroker-v1";
  readonly hostId: string;
  readonly serviceSid: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
}

export interface WindowsAuthorityNonceClaimInput {
  readonly hostId: string;
  readonly serviceSid: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID;
  readonly nonce: string;
}

/**
 * Native adapters must implement this port without command shells. In
 * particular, ACL facts must come from Windows security descriptors, HKLM
 * methods must force the 64-bit registry view, file methods must reject
 * reparse traversal, and nonce claims must survive broker restart.
 */
export interface WindowsAuthorityOsPort {
  runExclusive<T>(
    input: WindowsAuthorityExclusiveLockInput,
    action: () => Promise<T>,
  ): Promise<T>;
  inspectRuntimeIdentity(): Promise<WindowsAuthorityRuntimeIdentity>;
  claimNonce(input: WindowsAuthorityNonceClaimInput): Promise<"claimed" | "replayed">;
  readProtectedFileCheckpoint(target: WindowsAuthorityStorageTarget): Promise<unknown>;
  writeProtectedFileCheckpointAtomically(
    target: WindowsAuthorityStorageTarget,
    checkpoint: LocalClientWindowsAuthorityFileCheckpoint,
  ): Promise<void>;
  readHklmCheckpoint64(target: WindowsAuthorityStorageTarget): Promise<unknown>;
  writeHklmCheckpoint64(
    target: WindowsAuthorityStorageTarget,
    checkpoint: LocalClientWindowsAuthorityCheckpointState,
  ): Promise<void>;
  inspectAclFacts(target: WindowsAuthorityStorageTarget): Promise<unknown>;
}

export interface LocalClientWindowsAuthorityBrokerServiceOptions {
  readonly programDataBasePath: string;
  readonly hostId: string;
  readonly currentUserSid: string;
  readonly integrityKey: Uint8Array;
  readonly osPort: WindowsAuthorityOsPort;
}

export type LocalClientWindowsAuthorityBrokerErrorCode =
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CLOSED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_INVALID"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_AUTHENTICATION_FAILED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_BINDING_MISMATCH"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_NONCE_REPLAYED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_IDENTITY_MISMATCH"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_OS_PORT_UNAVAILABLE"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_INVALID"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_DIVERGED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_EXPECTATION_MISMATCH"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_PENDING_RECOVERY_REQUIRED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_ACL_INVALID"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_INCOMPLETE";

export class LocalClientWindowsAuthorityBrokerError extends Error {
  readonly code: LocalClientWindowsAuthorityBrokerErrorCode;
  readonly category: "configuration" | "authentication" | "integrity" | "recovery" | "persistence";
  readonly retryable: boolean;

  constructor(input: Readonly<{
    code: LocalClientWindowsAuthorityBrokerErrorCode;
    message: string;
    category: LocalClientWindowsAuthorityBrokerError["category"];
    retryable?: boolean;
  }>) {
    super(input.message);
    this.name = "LocalClientWindowsAuthorityBrokerError";
    this.code = input.code;
    this.category = input.category;
    this.retryable = input.retryable ?? false;
  }
}

type BrokerConfiguration = Readonly<{
  target: WindowsAuthorityStorageTarget;
  hostId: string;
  currentUserSid: string;
  integrityKey: Buffer;
  osPort: WindowsAuthorityOsPort;
  lock: WindowsAuthorityExclusiveLockInput;
}>;

type CheckedSnapshot = Readonly<{
  file: LocalClientWindowsAuthorityFileCheckpoint;
  state: LocalClientWindowsAuthorityCheckpointState;
}>;

const SYSTEM_SID = "S-1-5-18";
const ADMINISTRATORS_SID = "S-1-5-32-544";
const ALLOWED_AUTHORITY_SIDS = new Set([
  SYSTEM_SID,
  ADMINISTRATORS_SID,
  LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
]);
const BROAD_WRITE_SIDS = new Set([
  "S-1-1-0",
  "S-1-5-4",
  "S-1-5-11",
  "S-1-5-32-545",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NONCE_PATTERN = /^[a-f0-9]{64}$/u;
const SID_PATTERN = /^S-1-(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*))+$/u;

/**
 * Resolves the mandatory provisioning guard. This function authorizes no OS
 * work itself; a future native provisioner must call it and must still use a
 * Windows-native adapter. Unknown, duplicated, or partial flags fail closed.
 */
export function resolveLocalClientWindowsAuthorityProvisioningMode(
  argv: readonly string[],
): LocalClientWindowsAuthorityProvisioningMode {
  if (!Array.isArray(argv) || argv.length > 2 || argv.some((value) => typeof value !== "string")) {
    throw configurationError();
  }
  const flags = new Set(argv);
  if (flags.size !== argv.length || [...flags].some((flag) => !new Set([
    "--check-only",
    "--apply",
    "--yes",
  ]).has(flag))) throw configurationError();
  if (flags.size === 0 || (flags.size === 1 && flags.has("--check-only"))) return "check-only";
  if (flags.size === 2 && flags.has("--apply") && flags.has("--yes")) return "apply";
  throw configurationError();
}

export function createLocalClientWindowsAuthorityProvisioningPlan(
  programDataBasePath: string,
  argv: readonly string[] = [],
): LocalClientWindowsAuthorityProvisioningPlan {
  const target = createStorageTarget(programDataBasePath);
  const mode = resolveLocalClientWindowsAuthorityProvisioningMode(argv);
  return Object.freeze({
    planVersion: "local-client-windows-authority-provisioning-plan-v1" as const,
    mode,
    mutatesSystem: false as const,
    applyAuthorized: mode === "apply",
    service: Object.freeze({
      name: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME,
      sid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
      account: `NT SERVICE\\${LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME}` as const,
      requireServiceSidToken: true as const,
    }),
    storage: Object.freeze({
      programDataBasePath: target.programDataBasePath,
      programDataRoot: target.programDataRoot,
      anchorPath: target.anchorPath,
      maxFileBytes: 65_536 as const,
      rejectReparsePoints: true as const,
      requireAtomicReplaceAndFlush: true as const,
    }),
    registry: Object.freeze({
      hive: "HKLM" as const,
      keyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
      view: "registry64" as const,
    }),
    guard: Object.freeze({
      defaultMode: "check-only" as const,
      applyFlags: Object.freeze(["--apply", "--yes"] as const),
    }),
    nativeProvisionerRequirements: Object.freeze([
      "Use Windows service-control APIs; do not invoke a command shell.",
      "Expose only authenticated local IPC and bind the caller token SID to the configured client SID.",
      "Resolve ProgramData with a Windows known-folder API and require the exact fixed subtree.",
      "Create ACLs from native security descriptors and independently verify effective writes.",
      "Use KEY_WOW64_64KEY for the exact fixed HKLM key.",
      "Reject reparse points and files over 65536 bytes, atomically replace and flush the protected file, and flush HKLM.",
      "Persist nonce claims under the protected authority and serialize with the fixed global lock.",
      "Provision the 32-64 byte integrity key with a Windows protected-secret facility; never place it in the plan or command line.",
      "Initialize the protected file and HKLM to the same signed zero-generation checkpoint.",
    ]),
    boundaries: LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES,
  });
}

/**
 * Protocol-compatible broker core. It never performs filesystem, registry,
 * ACL, nonce-store, identity, or locking operations outside WindowsAuthorityOsPort.
 */
export class LocalClientWindowsAuthorityBrokerService
implements LocalClientWindowsAuthorityPrivilegedBrokerPort {
  readonly #configuration: BrokerConfiguration;
  #closed = false;

  constructor(options: LocalClientWindowsAuthorityBrokerServiceOptions) {
    this.#configuration = normalizeConfiguration(options);
  }

  get target(): WindowsAuthorityStorageTarget {
    return this.#configuration.target;
  }

  async inspect(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    return this.#execute(request, "inspect");
  }

  async prepareNext(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    return this.#execute(request, "prepare-next");
  }

  async finalize(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    return this.#execute(request, "finalize");
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try {
      await this.#configuration.osPort.runExclusive(this.#configuration.lock, async () => {
        this.#configuration.integrityKey.fill(0);
      });
    } catch {
      this.#configuration.integrityKey.fill(0);
    }
  }

  async #execute(
    rawRequest: LocalClientWindowsAuthorityBrokerRequest,
    operation: LocalClientWindowsAuthorityOperation,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse> {
    this.#assertOpen();
    const request = validateRequest(this.#configuration, rawRequest, operation);
    let invocationCount = 0;
    try {
      const response = await this.#configuration.osPort.runExclusive(
        this.#configuration.lock,
        async () => {
          invocationCount += 1;
          if (invocationCount !== 1) throw osPortUnavailableError();
          this.#assertOpen();
          await this.#assertRuntimeIdentity();
          await this.#claimNonce(request);
          const before = await this.#readSnapshot();
          assertRequestExpectation(request, before.state);
          const beforeAcl = await this.#readAndValidateAcl();
          let after = before;
          let responseAcl = beforeAcl;
          if (operation === "prepare-next") {
            after = await this.#writeTransition(createPreparedState(request));
            responseAcl = await this.#readAndValidateAcl();
          } else if (operation === "finalize") {
            after = await this.#writeTransition(createFinalizedState(request));
            responseAcl = await this.#readAndValidateAcl();
          }
          return createResponse(this.#configuration, request, after, responseAcl);
        },
      );
      if (invocationCount !== 1) throw osPortUnavailableError();
      return response;
    } catch (error) {
      if (error instanceof LocalClientWindowsAuthorityBrokerError) throw error;
      throw osPortUnavailableError();
    }
  }

  async #assertRuntimeIdentity(): Promise<void> {
    let identity: unknown;
    try { identity = await this.#configuration.osPort.inspectRuntimeIdentity(); } catch {
      throw osPortUnavailableError();
    }
    assertExactDataRecord(identity, [
      "osPlatform",
      "hostId",
      "serviceName",
      "serviceSid",
      "runningAsServiceSid",
      "programDataBasePath",
      "hklmView",
    ], identityMismatchError);
    if (
      identity.osPlatform !== "win32"
      || identity.hostId !== this.#configuration.hostId
      || identity.serviceName !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME
      || identity.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID
      || identity.runningAsServiceSid !== true
      || normalizeWindowsPath(String(identity.programDataBasePath))
        !== normalizeWindowsPath(this.#configuration.target.programDataBasePath)
      || identity.hklmView !== "registry64"
    ) throw identityMismatchError();
  }

  async #claimNonce(request: LocalClientWindowsAuthorityBrokerRequest): Promise<void> {
    let result: unknown;
    try {
      result = await this.#configuration.osPort.claimNonce(Object.freeze({
        hostId: this.#configuration.hostId,
        serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
        nonce: request.nonce,
      }));
    } catch {
      throw osPortUnavailableError();
    }
    if (result === "replayed") throw nonceReplayedError();
    if (result !== "claimed") throw osPortUnavailableError();
  }

  async #readSnapshot(): Promise<CheckedSnapshot> {
    let rawFile: unknown;
    let rawHklm: unknown;
    try {
      rawFile = await this.#configuration.osPort.readProtectedFileCheckpoint(
        this.#configuration.target,
      );
      rawHklm = await this.#configuration.osPort.readHklmCheckpoint64(
        this.#configuration.target,
      );
    } catch {
      throw osPortUnavailableError();
    }
    const file = validateFileCheckpoint(this.#configuration, rawFile);
    const hklm = validateCheckpoint(rawHklm, checkpointInvalidError);
    const state = checkpointProjection(file);
    if (!sameCheckpoint(state, hklm)) throw checkpointDivergedError();
    return Object.freeze({ file, state });
  }

  async #writeTransition(
    desired: LocalClientWindowsAuthorityCheckpointState,
  ): Promise<CheckedSnapshot> {
    const file = createSignedFileCheckpoint(this.#configuration, desired);
    try {
      await this.#configuration.osPort.writeProtectedFileCheckpointAtomically(
        this.#configuration.target,
        file,
      );
      const rawWrittenFile = await this.#configuration.osPort.readProtectedFileCheckpoint(
        this.#configuration.target,
      );
      const writtenFile = validateFileCheckpoint(this.#configuration, rawWrittenFile);
      if (!sameCheckpoint(checkpointProjection(writtenFile), desired)) throw writeIncompleteError();
      await this.#configuration.osPort.writeHklmCheckpoint64(
        this.#configuration.target,
        desired,
      );
    } catch (error) {
      if (
        error instanceof LocalClientWindowsAuthorityBrokerError
        && error.code === "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_INCOMPLETE"
      ) throw error;
      throw writeIncompleteError();
    }
    try {
      const snapshot = await this.#readSnapshot();
      if (!sameCheckpoint(snapshot.state, desired)) throw writeIncompleteError();
      return snapshot;
    } catch {
      throw writeIncompleteError();
    }
  }

  async #readAndValidateAcl(): Promise<LocalClientWindowsAuthorityAclFacts> {
    let raw: unknown;
    try {
      raw = await this.#configuration.osPort.inspectAclFacts(this.#configuration.target);
    } catch {
      throw osPortUnavailableError();
    }
    return validateAclFacts(this.#configuration, raw);
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw brokerError({
        code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CLOSED",
        message: "The Windows authority broker is closed.",
        category: "persistence",
      });
    }
  }
}

export function createLocalClientWindowsAuthorityBrokerService(
  options: LocalClientWindowsAuthorityBrokerServiceOptions,
): LocalClientWindowsAuthorityBrokerService {
  return new LocalClientWindowsAuthorityBrokerService(options);
}

function normalizeConfiguration(
  options: LocalClientWindowsAuthorityBrokerServiceOptions,
): BrokerConfiguration {
  assertExactDataRecord(options, [
    "programDataBasePath",
    "hostId",
    "currentUserSid",
    "integrityKey",
    "osPort",
  ], configurationError);
  const target = createStorageTarget(options.programDataBasePath);
  const hostId = boundedText(options.hostId, 256);
  const currentUserSid = normalizeSid(options.currentUserSid, configurationError);
  if (ALLOWED_AUTHORITY_SIDS.has(currentUserSid) || BROAD_WRITE_SIDS.has(currentUserSid)) {
    throw configurationError();
  }
  const integrityKey = cloneKey(options.integrityKey);
  if (!validOsPort(options.osPort)) {
    integrityKey.fill(0);
    throw configurationError();
  }
  return Object.freeze({
    target,
    hostId,
    currentUserSid,
    integrityKey,
    osPort: options.osPort,
    lock: Object.freeze({
      name: "Global\\UnifiedAiSystemLocalClientAuthorityBroker-v1" as const,
      hostId,
      serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    }),
  });
}

function createStorageTarget(programDataBasePath: unknown): WindowsAuthorityStorageTarget {
  const base = assertLocalWindowsPath(programDataBasePath);
  if (win32.basename(base).toLowerCase() !== "programdata") throw configurationError();
  const programDataRoot = win32.join(base, LOCAL_CLIENT_WINDOWS_AUTHORITY_PROGRAM_DATA_SUBPATH);
  const anchorPath = win32.join(programDataRoot, LOCAL_CLIENT_WINDOWS_AUTHORITY_ANCHOR_FILE_NAME);
  return Object.freeze({
    serviceName: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_NAME,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    programDataBasePath: base,
    programDataRoot,
    anchorPath,
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
  });
}

function validateRequest(
  configuration: BrokerConfiguration,
  raw: unknown,
  operation: LocalClientWindowsAuthorityOperation,
): LocalClientWindowsAuthorityBrokerRequest {
  assertExactDataRecord(raw, [
    "requestVersion",
    "operation",
    "nonce",
    "hostId",
    "serviceSid",
    "currentUserSid",
    "anchorPath",
    "programDataRoot",
    "hklmKeyPath",
    "hklmView",
    "expectedCurrentGeneration",
    "expectedCurrentDigest",
    "nextGeneration",
    "nextDigest",
    "requestHmacSha256",
  ], requestInvalidError);
  if (
    raw.requestVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION
    || raw.operation !== operation
    || typeof raw.nonce !== "string"
    || !NONCE_PATTERN.test(raw.nonce)
    || typeof raw.requestHmacSha256 !== "string"
    || !SHA256_PATTERN.test(raw.requestHmacSha256)
  ) throw requestInvalidError();
  if (
    raw.hostId !== configuration.hostId
    || raw.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID
    || raw.currentUserSid !== configuration.currentUserSid
    || raw.anchorPath !== configuration.target.anchorPath
    || raw.programDataRoot !== configuration.target.programDataRoot
    || raw.hklmKeyPath !== LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY
    || raw.hklmView !== "registry64"
  ) throw requestBindingMismatchError();
  const expectedCurrentGeneration = normalizeRequestGeneration(
    raw.expectedCurrentGeneration,
    true,
  );
  const expectedCurrentDigest = normalizeNullableDigest(raw.expectedCurrentDigest, requestInvalidError);
  const nextGeneration = raw.nextGeneration === null
    ? null
    : normalizeRequestGeneration(raw.nextGeneration, false);
  const nextDigest = normalizeNullableDigest(raw.nextDigest, requestInvalidError);
  if (
    (expectedCurrentGeneration === 0) !== (expectedCurrentDigest === null)
    || (nextGeneration === null) !== (nextDigest === null)
    || (nextGeneration !== null && nextGeneration !== expectedCurrentGeneration + 1)
  ) throw requestInvalidError();
  if (
    operation !== "inspect"
    && (expectedCurrentGeneration === 0 || nextGeneration === null || nextDigest === null)
  ) throw requestInvalidError();
  const unsigned = {
    requestVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
    operation,
    nonce: raw.nonce,
    hostId: configuration.hostId,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    currentUserSid: configuration.currentUserSid,
    anchorPath: configuration.target.anchorPath,
    programDataRoot: configuration.target.programDataRoot,
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
    expectedCurrentGeneration,
    expectedCurrentDigest,
    nextGeneration,
    nextDigest,
  };
  const expectedHmac = createLocalClientWindowsAuthorityRequestHmac(
    configuration.integrityKey,
    unsigned,
  );
  if (!safeDigestEqual(raw.requestHmacSha256, expectedHmac)) {
    throw requestAuthenticationError();
  }
  return Object.freeze({ ...unsigned, requestHmacSha256: raw.requestHmacSha256 });
}

function assertRequestExpectation(
  request: LocalClientWindowsAuthorityBrokerRequest,
  state: LocalClientWindowsAuthorityCheckpointState,
): void {
  if (
    request.expectedCurrentGeneration !== state.currentGeneration
    || !nullableDigestEqual(request.expectedCurrentDigest, state.currentDigest)
  ) throw expectationMismatchError();
  if (request.operation === "inspect") {
    if (
      request.nextGeneration !== state.pendingGeneration
      || !nullableDigestEqual(request.nextDigest, state.pendingDigest)
    ) throw expectationMismatchError();
    return;
  }
  if (request.operation === "prepare-next") {
    if (state.pendingGeneration !== null || state.pendingDigest !== null) {
      throw pendingRecoveryError();
    }
    return;
  }
  if (
    state.pendingGeneration === null
    || request.nextGeneration !== state.pendingGeneration
    || !nullableDigestEqual(request.nextDigest, state.pendingDigest)
  ) throw pendingRecoveryError();
}

function createPreparedState(
  request: LocalClientWindowsAuthorityBrokerRequest,
): LocalClientWindowsAuthorityCheckpointState {
  if (
    request.expectedCurrentGeneration === null
    || request.nextGeneration === null
    || request.nextDigest === null
  ) throw requestInvalidError();
  return Object.freeze({
    currentGeneration: request.expectedCurrentGeneration,
    currentDigest: request.expectedCurrentDigest,
    pendingGeneration: request.nextGeneration,
    pendingDigest: request.nextDigest,
  });
}

function createFinalizedState(
  request: LocalClientWindowsAuthorityBrokerRequest,
): LocalClientWindowsAuthorityCheckpointState {
  if (request.nextGeneration === null || request.nextDigest === null) throw requestInvalidError();
  return Object.freeze({
    currentGeneration: request.nextGeneration,
    currentDigest: request.nextDigest,
    pendingGeneration: null,
    pendingDigest: null,
  });
}

function validateFileCheckpoint(
  configuration: BrokerConfiguration,
  raw: unknown,
): LocalClientWindowsAuthorityFileCheckpoint {
  assertExactDataRecord(raw, [
    "fileVersion",
    "hostId",
    "serviceSid",
    "anchorPath",
    "hklmKeyPath",
    "hklmView",
    "currentGeneration",
    "currentDigest",
    "pendingGeneration",
    "pendingDigest",
    "hmacSha256",
  ], checkpointInvalidError);
  if (
    raw.fileVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION
    || raw.hostId !== configuration.hostId
    || raw.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID
    || raw.anchorPath !== configuration.target.anchorPath
    || raw.hklmKeyPath !== LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY
    || raw.hklmView !== "registry64"
    || typeof raw.hmacSha256 !== "string"
    || !SHA256_PATTERN.test(raw.hmacSha256)
  ) throw checkpointInvalidError();
  const state = validateCheckpoint(raw, checkpointInvalidError, false);
  const unsigned = {
    fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
    hostId: configuration.hostId,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    anchorPath: configuration.target.anchorPath,
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
    ...state,
  };
  const expectedHmac = createLocalClientWindowsAuthorityFileHmac(
    configuration.integrityKey,
    unsigned,
  );
  if (!safeDigestEqual(raw.hmacSha256, expectedHmac)) throw checkpointInvalidError();
  return Object.freeze({ ...unsigned, hmacSha256: raw.hmacSha256 });
}

function createSignedFileCheckpoint(
  configuration: BrokerConfiguration,
  state: LocalClientWindowsAuthorityCheckpointState,
): LocalClientWindowsAuthorityFileCheckpoint {
  const unsigned = {
    fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
    hostId: configuration.hostId,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    anchorPath: configuration.target.anchorPath,
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
    ...state,
  };
  return Object.freeze({
    ...unsigned,
    hmacSha256: createLocalClientWindowsAuthorityFileHmac(
      configuration.integrityKey,
      unsigned,
    ),
  });
}

function validateCheckpoint(
  raw: unknown,
  errorFactory: () => LocalClientWindowsAuthorityBrokerError,
  exact = true,
): LocalClientWindowsAuthorityCheckpointState {
  if (exact) {
    assertExactDataRecord(raw, [
      "currentGeneration",
      "currentDigest",
      "pendingGeneration",
      "pendingDigest",
    ], errorFactory);
  } else if (!isPlainDataRecord(raw)) {
    throw errorFactory();
  }
  const record = raw as Record<string, unknown>;
  const currentGeneration = normalizeStoredGeneration(record.currentGeneration, true, errorFactory);
  const currentDigest = normalizeNullableDigest(record.currentDigest, errorFactory);
  const pendingGeneration = record.pendingGeneration === null
    ? null
    : normalizeStoredGeneration(record.pendingGeneration, false, errorFactory);
  const pendingDigest = normalizeNullableDigest(record.pendingDigest, errorFactory);
  if (
    (currentGeneration === 0) !== (currentDigest === null)
    || (pendingGeneration === null) !== (pendingDigest === null)
    || (pendingGeneration !== null && pendingGeneration !== currentGeneration + 1)
  ) throw errorFactory();
  return Object.freeze({ currentGeneration, currentDigest, pendingGeneration, pendingDigest });
}

function validateAclFacts(
  configuration: BrokerConfiguration,
  raw: unknown,
): LocalClientWindowsAuthorityAclFacts {
  assertExactDataRecord(raw, [
    "source",
    "currentUserSid",
    "serviceSid",
    "rootOwnerSid",
    "rootAllowedWriteSids",
    "rootInheritedWriteSids",
    "rootCurrentUserCanWrite",
    "fileOwnerSid",
    "fileAllowedWriteSids",
    "fileInheritedWriteSids",
    "fileCurrentUserCanWrite",
    "registryOwnerSid",
    "registryAllowedWriteSids",
    "registryInheritedWriteSids",
    "registryCurrentUserCanWrite",
    "hklmHive",
    "hklmKeyPath",
    "hklmView",
  ], aclInvalidError);
  if (
    raw.source !== "independent-privileged-broker"
    || raw.currentUserSid !== configuration.currentUserSid
    || raw.serviceSid !== LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID
    || raw.hklmHive !== "HKLM"
    || raw.hklmKeyPath !== LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY
    || raw.hklmView !== "registry64"
    || raw.rootCurrentUserCanWrite !== false
    || raw.fileCurrentUserCanWrite !== false
    || raw.registryCurrentUserCanWrite !== false
  ) throw aclInvalidError();
  const rootOwnerSid = normalizeSid(raw.rootOwnerSid, aclInvalidError);
  const fileOwnerSid = normalizeSid(raw.fileOwnerSid, aclInvalidError);
  const registryOwnerSid = normalizeSid(raw.registryOwnerSid, aclInvalidError);
  if ([rootOwnerSid, fileOwnerSid, registryOwnerSid].some((sid) => !ALLOWED_AUTHORITY_SIDS.has(sid))) {
    throw aclInvalidError();
  }
  const rootAllowedWriteSids = normalizeSortedSidArray(raw.rootAllowedWriteSids);
  const rootInheritedWriteSids = normalizeSortedSidArray(raw.rootInheritedWriteSids);
  const fileAllowedWriteSids = normalizeSortedSidArray(raw.fileAllowedWriteSids);
  const fileInheritedWriteSids = normalizeSortedSidArray(raw.fileInheritedWriteSids);
  const registryAllowedWriteSids = normalizeSortedSidArray(raw.registryAllowedWriteSids);
  const registryInheritedWriteSids = normalizeSortedSidArray(raw.registryInheritedWriteSids);
  const allowedGroups = [rootAllowedWriteSids, fileAllowedWriteSids, registryAllowedWriteSids];
  const everyGroup = [
    ...allowedGroups,
    rootInheritedWriteSids,
    fileInheritedWriteSids,
    registryInheritedWriteSids,
  ];
  if (
    allowedGroups.some((sids) => !sids.includes(LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID))
    || everyGroup.some((sids) => sids.some((sid) => (
      !ALLOWED_AUTHORITY_SIDS.has(sid) || BROAD_WRITE_SIDS.has(sid)
    )))
  ) throw aclInvalidError();
  return Object.freeze({
    source: "independent-privileged-broker" as const,
    currentUserSid: configuration.currentUserSid,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    rootOwnerSid,
    rootAllowedWriteSids,
    rootInheritedWriteSids,
    rootCurrentUserCanWrite: false,
    fileOwnerSid,
    fileAllowedWriteSids,
    fileInheritedWriteSids,
    fileCurrentUserCanWrite: false,
    registryOwnerSid,
    registryAllowedWriteSids,
    registryInheritedWriteSids,
    registryCurrentUserCanWrite: false,
    hklmHive: "HKLM" as const,
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
  });
}

function createResponse(
  configuration: BrokerConfiguration,
  request: LocalClientWindowsAuthorityBrokerRequest,
  snapshot: CheckedSnapshot,
  acl: LocalClientWindowsAuthorityAclFacts,
): LocalClientWindowsAuthorityBrokerResponse {
  const unsigned = {
    brokerVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION,
    operation: request.operation,
    nonce: request.nonce,
    osPlatform: "win32" as const,
    hostId: configuration.hostId,
    serviceSid: LOCAL_CLIENT_WINDOWS_AUTHORITY_SERVICE_SID,
    anchorPath: configuration.target.anchorPath,
    programDataRoot: configuration.target.programDataRoot,
    hklmKeyPath: LOCAL_CLIENT_WINDOWS_AUTHORITY_HKLM_KEY,
    hklmView: "registry64" as const,
    fileCheckpoint: snapshot.state,
    hklmCheckpoint: snapshot.state,
    acl,
  };
  return Object.freeze({
    ...unsigned,
    responseHmacSha256: createLocalClientWindowsAuthorityResponseHmac(
      configuration.integrityKey,
      unsigned,
    ),
  });
}

function checkpointProjection(
  file: LocalClientWindowsAuthorityFileCheckpoint,
): LocalClientWindowsAuthorityCheckpointState {
  return Object.freeze({
    currentGeneration: file.currentGeneration,
    currentDigest: file.currentDigest,
    pendingGeneration: file.pendingGeneration,
    pendingDigest: file.pendingDigest,
  });
}

function sameCheckpoint(
  left: LocalClientWindowsAuthorityCheckpointState,
  right: LocalClientWindowsAuthorityCheckpointState,
): boolean {
  return left.currentGeneration === right.currentGeneration
    && left.pendingGeneration === right.pendingGeneration
    && nullableDigestEqual(left.currentDigest, right.currentDigest)
    && nullableDigestEqual(left.pendingDigest, right.pendingDigest);
}

function nullableDigestEqual(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return safeDigestEqual(left, right);
}

function normalizeSortedSidArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 32) throw aclInvalidError();
  const normalized = value.map((sid) => normalizeSid(sid, aclInvalidError));
  if (
    new Set(normalized).size !== normalized.length
    || normalized.some((sid, index) => sid !== value[index])
  ) throw aclInvalidError();
  return Object.freeze(normalized);
}

function normalizeStoredGeneration(
  value: unknown,
  allowZero: boolean,
  errorFactory: () => LocalClientWindowsAuthorityBrokerError,
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || (allowZero ? value < 0 : value <= 0)
  ) throw errorFactory();
  return value;
}

function normalizeRequestGeneration(value: unknown, allowZero: boolean): number {
  return normalizeStoredGeneration(value, allowZero, requestInvalidError);
}

function normalizeNullableDigest(
  value: unknown,
  errorFactory: () => LocalClientWindowsAuthorityBrokerError,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw errorFactory();
  return value;
}

function normalizeSid(
  value: unknown,
  errorFactory: () => LocalClientWindowsAuthorityBrokerError,
): string {
  if (typeof value !== "string" || value !== value.trim() || !SID_PATTERN.test(value)) {
    throw errorFactory();
  }
  return value;
}

function assertLocalWindowsPath(value: unknown): string {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < 4
    || value.length > 4_096
    || value.includes("\0")
    || !win32.isAbsolute(value)
    || value.startsWith("\\\\")
    || value.startsWith("//")
    || value.startsWith("\\?\\")
    || value.startsWith("\\.\\")
  ) throw configurationError();
  return win32.normalize(value);
}

function normalizeWindowsPath(value: string): string {
  return win32.normalize(value).toLowerCase();
}

function boundedText(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < 8
    || value.length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw configurationError();
  return value;
}

function cloneKey(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < 32 || value.byteLength > 64) {
    throw configurationError();
  }
  return Buffer.from(value);
}

function safeDigestEqual(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !SHA256_PATTERN.test(left)
    || !SHA256_PATTERN.test(right)
  ) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function validOsPort(value: unknown): value is WindowsAuthorityOsPort {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<WindowsAuthorityOsPort>;
  return typeof candidate.runExclusive === "function"
    && typeof candidate.inspectRuntimeIdentity === "function"
    && typeof candidate.claimNonce === "function"
    && typeof candidate.readProtectedFileCheckpoint === "function"
    && typeof candidate.writeProtectedFileCheckpointAtomically === "function"
    && typeof candidate.readHklmCheckpoint64 === "function"
    && typeof candidate.writeHklmCheckpoint64 === "function"
    && typeof candidate.inspectAclFacts === "function";
}

function assertExactDataRecord(
  value: unknown,
  keys: readonly string[],
  errorFactory: () => LocalClientWindowsAuthorityBrokerError,
): asserts value is Record<string, unknown> {
  if (!isPlainDataRecord(value)) throw errorFactory();
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length
    || actual.some((key) => typeof key !== "string" || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
  ) throw errorFactory();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some((key) => {
    const descriptor = descriptors[key];
    return !descriptor || !("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined;
  })) throw errorFactory();
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function brokerError(
  input: ConstructorParameters<typeof LocalClientWindowsAuthorityBrokerError>[0],
): LocalClientWindowsAuthorityBrokerError {
  return new LocalClientWindowsAuthorityBrokerError(input);
}

function configurationError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CONFIGURATION_INVALID",
    message: "The Windows authority broker configuration or provisioning flags are invalid.",
    category: "configuration",
  });
}

function requestInvalidError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_INVALID",
    message: "The Windows authority broker request is invalid.",
    category: "authentication",
  });
}

function requestAuthenticationError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_AUTHENTICATION_FAILED",
    message: "The Windows authority broker request authentication failed.",
    category: "authentication",
  });
}

function requestBindingMismatchError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_REQUEST_BINDING_MISMATCH",
    message: "The Windows authority broker request is not bound to this service target.",
    category: "authentication",
  });
}

function nonceReplayedError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_NONCE_REPLAYED",
    message: "The Windows authority broker request nonce was already claimed.",
    category: "authentication",
  });
}

function identityMismatchError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_IDENTITY_MISMATCH",
    message: "The native runtime identity does not match the fixed Windows broker identity.",
    category: "integrity",
  });
}

function osPortUnavailableError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_OS_PORT_UNAVAILABLE",
    message: "The Windows native authority adapter is unavailable.",
    category: "persistence",
    retryable: true,
  });
}

function checkpointInvalidError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_INVALID",
    message: "A protected Windows authority checkpoint is invalid.",
    category: "integrity",
  });
}

function checkpointDivergedError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_CHECKPOINT_DIVERGED",
    message: "The protected file and HKLM checkpoints diverged.",
    category: "recovery",
  });
}

function expectationMismatchError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_EXPECTATION_MISMATCH",
    message: "The authenticated request is stale relative to the protected checkpoint.",
    category: "integrity",
  });
}

function pendingRecoveryError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_PENDING_RECOVERY_REQUIRED",
    message: "The protected checkpoint has a pending generation requiring exact finalization.",
    category: "recovery",
  });
}

function aclInvalidError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_ACL_INVALID",
    message: "The native Windows ACL facts do not satisfy the fixed authority policy.",
    category: "integrity",
  });
}

function writeIncompleteError(): LocalClientWindowsAuthorityBrokerError {
  return brokerError({
    code: "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_INCOMPLETE",
    message: "The protected file and HKLM transition did not complete consistently.",
    category: "persistence",
  });
}
