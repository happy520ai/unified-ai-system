import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import { win32 } from "node:path";

export const LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION =
  "local-client-windows-authority-file-v1" as const;
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION =
  "local-client-windows-authority-broker-v1" as const;
export const LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION =
  "local-client-windows-authority-request-v1" as const;

export const LOCAL_CLIENT_WINDOWS_PROTECTED_AUTHORITY_BOUNDARIES = Object.freeze({
  windowsOnly: true as const,
  sameUserResistance: "same-user-resistant-if-provisioned" as const,
  administratorResistance: "not-admin-resistant" as const,
  provisioningCapability: "not-provisioner" as const,
  automaticElevation: false as const,
  createsWindowsService: false as const,
  modifiesAcl: false as const,
  writesHklmDirectly: false as const,
  usesPowerShell: false as const,
  externalWritesRequirePrivilegedBroker: true as const,
  aclFactsRequireIndependentBrokerAttestation: true as const,
  nativeAclReaderImplemented: false as const,
  hklmView: "registry64" as const,
});

export type LocalClientWindowsAuthorityOperation = "inspect" | "prepare-next" | "finalize";

export interface LocalClientWindowsAuthorityCheckpointState {
  readonly currentGeneration: number;
  readonly currentDigest: string | null;
  readonly pendingGeneration: number | null;
  readonly pendingDigest: string | null;
}

export interface LocalClientWindowsAuthorityFileCheckpoint
  extends LocalClientWindowsAuthorityCheckpointState {
  readonly fileVersion: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION;
  readonly hostId: string;
  readonly serviceSid: string;
  readonly anchorPath: string;
  readonly hklmKeyPath: string;
  readonly hklmView: "registry64";
  readonly hmacSha256: string;
}

export interface LocalClientWindowsAuthorityAclFacts {
  readonly source: "independent-privileged-broker";
  readonly currentUserSid: string;
  readonly serviceSid: string;
  readonly rootOwnerSid: string;
  readonly rootAllowedWriteSids: readonly string[];
  readonly rootInheritedWriteSids: readonly string[];
  readonly rootCurrentUserCanWrite: boolean;
  readonly fileOwnerSid: string;
  readonly fileAllowedWriteSids: readonly string[];
  readonly fileInheritedWriteSids: readonly string[];
  readonly fileCurrentUserCanWrite: boolean;
  readonly registryOwnerSid: string;
  readonly registryAllowedWriteSids: readonly string[];
  readonly registryInheritedWriteSids: readonly string[];
  readonly registryCurrentUserCanWrite: boolean;
  readonly hklmHive: "HKLM";
  readonly hklmKeyPath: string;
  readonly hklmView: "registry64";
}

export interface LocalClientWindowsAuthorityBrokerRequest {
  readonly requestVersion: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION;
  readonly operation: LocalClientWindowsAuthorityOperation;
  readonly nonce: string;
  readonly hostId: string;
  readonly serviceSid: string;
  readonly currentUserSid: string;
  readonly anchorPath: string;
  readonly programDataRoot: string;
  readonly hklmKeyPath: string;
  readonly hklmView: "registry64";
  readonly expectedCurrentGeneration: number | null;
  readonly expectedCurrentDigest: string | null;
  readonly nextGeneration: number | null;
  readonly nextDigest: string | null;
  readonly requestHmacSha256: string;
}

export interface LocalClientWindowsAuthorityBrokerResponse {
  readonly brokerVersion: typeof LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION;
  readonly operation: LocalClientWindowsAuthorityOperation;
  readonly nonce: string;
  readonly osPlatform: "win32";
  readonly hostId: string;
  readonly serviceSid: string;
  readonly anchorPath: string;
  readonly programDataRoot: string;
  readonly hklmKeyPath: string;
  readonly hklmView: "registry64";
  readonly fileCheckpoint: LocalClientWindowsAuthorityCheckpointState;
  readonly hklmCheckpoint: LocalClientWindowsAuthorityCheckpointState;
  readonly acl: LocalClientWindowsAuthorityAclFacts;
  readonly responseHmacSha256: string;
}

export interface LocalClientWindowsAuthorityPrivilegedBrokerPort {
  inspect(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse>;
  prepareNext(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse>;
  finalize(
    request: LocalClientWindowsAuthorityBrokerRequest,
  ): Promise<LocalClientWindowsAuthorityBrokerResponse>;
}

export interface LocalClientWindowsProtectedAuthorityEnabledOptions {
  readonly enabled: true;
  readonly anchorPath: string;
  readonly programDataRoot: string;
  readonly hklmKeyPath: string;
  readonly hostId: string;
  readonly serviceSid: string;
  readonly currentUserSid: string;
  readonly integrityKey: Uint8Array;
  readonly broker?: LocalClientWindowsAuthorityPrivilegedBrokerPort;
  readonly allowedOwnerSids?: readonly string[];
  readonly allowedWriterSids?: readonly string[];
  readonly nonceFactory?: () => string;
}

export interface LocalClientWindowsProtectedAuthorityDisabledOptions {
  readonly enabled?: false;
}

export type LocalClientWindowsProtectedAuthorityOptions =
  | LocalClientWindowsProtectedAuthorityEnabledOptions
  | LocalClientWindowsProtectedAuthorityDisabledOptions;

export type LocalClientWindowsAuthorityStatusState =
  | "disabled"
  | "unavailable"
  | "uninitialized"
  | "pending-recovery"
  | "ready";

export type LocalClientWindowsAuthorityReason =
  | "DISABLED"
  | "NOT_WINDOWS"
  | "BROKER_UNAVAILABLE"
  | "PATH_UNSAFE"
  | "ANCHOR_INVALID"
  | "ATTESTATION_INVALID"
  | "ATTESTATION_BINDING_MISMATCH"
  | "CHECKPOINT_DIVERGED"
  | "OWNER_NOT_ALLOWED"
  | "SERVICE_SID_NOT_ALLOWED"
  | "CURRENT_USER_WRITABLE"
  | "WRITE_PRINCIPAL_NOT_ALLOWED"
  | "INHERITED_BROAD_WRITE"
  | "HKLM_VIEW_MISMATCH"
  | "UNINITIALIZED"
  | "PENDING_RECOVERY_REQUIRED";

export interface LocalClientWindowsProtectedAuthorityStatus {
  readonly available: boolean;
  readonly rollbackResistant: boolean;
  readonly state: LocalClientWindowsAuthorityStatusState;
  readonly reason: LocalClientWindowsAuthorityReason | null;
  readonly currentGeneration: number | null;
  readonly currentDigest: string | null;
  readonly pendingGeneration: number | null;
  readonly pendingDigest: string | null;
  readonly hostFingerprint: string | null;
  readonly serviceSidFingerprint: string | null;
  readonly anchorFingerprint: string | null;
  readonly hklmKeyFingerprint: string | null;
  readonly brokerAttested: boolean;
  readonly localFileVerified: boolean;
  readonly aclVerified: boolean;
  readonly hklmVerified: boolean;
  readonly boundaries: typeof LOCAL_CLIENT_WINDOWS_PROTECTED_AUTHORITY_BOUNDARIES;
}

export type LocalClientWindowsAuthorityErrorCode =
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_UNAVAILABLE"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_ATTESTATION_INVALID"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_ROLLBACK_DETECTED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_GENERATION_MISMATCH"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_DIGEST_MISMATCH"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_PENDING_RECOVERY_REQUIRED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_NO_PENDING_GENERATION"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_FAILED"
  | "LOCAL_CLIENT_WINDOWS_AUTHORITY_CLOSED";

export class LocalClientWindowsProtectedAuthorityError extends Error {
  readonly code: LocalClientWindowsAuthorityErrorCode;
  readonly category: "configuration" | "integrity" | "recovery" | "persistence";
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly reason: LocalClientWindowsAuthorityReason | null;

  constructor(input: Readonly<{
    code: LocalClientWindowsAuthorityErrorCode;
    message: string;
    category: LocalClientWindowsProtectedAuthorityError["category"];
    statusCode: number;
    retryable?: boolean;
    reason?: LocalClientWindowsAuthorityReason | null;
  }>) {
    super(input.message);
    this.name = "LocalClientWindowsProtectedAuthorityError";
    this.code = input.code;
    this.category = input.category;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    this.reason = input.reason ?? null;
  }
}

type NormalizedConfiguration = Readonly<{
  anchorPath: string;
  programDataRoot: string;
  hklmKeyPath: string;
  hostId: string;
  serviceSid: string;
  currentUserSid: string;
  integrityKey: Buffer;
  broker: LocalClientWindowsAuthorityPrivilegedBrokerPort | null;
  allowedOwnerSids: ReadonlySet<string>;
  allowedWriterSids: ReadonlySet<string>;
  nonceFactory: () => string;
}>;

type StrictInspection = Readonly<{
  status: LocalClientWindowsProtectedAuthorityStatus;
  checkpoint: LocalClientWindowsAuthorityCheckpointState;
}>;

const SYSTEM_SID = "S-1-5-18";
const ADMINISTRATORS_SID = "S-1-5-32-544";
const BROAD_WRITE_SIDS = new Set([
  "S-1-1-0",
  "S-1-5-4",
  "S-1-5-11",
  "S-1-5-32-545",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NONCE_PATTERN = /^[a-f0-9]{64}$/u;
const SID_PATTERN = /^S-1-(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*))+$/u;
const SERVICE_SID_PATTERN = /^S-1-5-80-(?:[0-9]+-){4}[0-9]+$/u;
const MAX_FILE_BYTES = 64 * 1_024;
const MAX_NONCES = 1_024;
const REQUEST_DOMAIN = "unified-ai/local-client-windows-authority/request/v1";
const RESPONSE_DOMAIN = "unified-ai/local-client-windows-authority/response/v1";
const FILE_DOMAIN = "unified-ai/local-client-windows-authority/file/v1";

export class LocalClientWindowsProtectedAuthorityAnchor {
  readonly #configuration: NormalizedConfiguration | null;
  readonly #usedNonces = new Set<string>();
  #closed = false;

  constructor(options: LocalClientWindowsProtectedAuthorityOptions = {}) {
    assertExactOptions(options);
    this.#configuration = options.enabled === true ? normalizeConfiguration(options) : null;
  }

  async inspect(): Promise<LocalClientWindowsProtectedAuthorityStatus> {
    if (this.#closed) return unavailableStatus(this.#configuration, "unavailable", "BROKER_UNAVAILABLE");
    if (!this.#configuration) return unavailableStatus(null, "disabled", "DISABLED");
    try {
      return (await this.#inspectStrict()).status;
    } catch (error) {
      return unavailableStatus(
        this.#configuration,
        reasonState(errorReason(error)),
        errorReason(error),
      );
    }
  }

  async assertCurrent(
    generation: number,
    digest: string,
  ): Promise<Readonly<{ generation: number; digest: string }>> {
    this.#assertOpen();
    const expectedGeneration = assertGeneration(generation, false);
    const expectedDigest = assertDigest(digest);
    const inspected = await this.#inspectStrict();
    if (inspected.status.state === "pending-recovery") throw pendingError();
    if (!inspected.status.available || inspected.status.state !== "ready") throw unavailableError(inspected.status.reason);
    if (expectedGeneration < inspected.checkpoint.currentGeneration) {
      throw authorityError(
        "LOCAL_CLIENT_WINDOWS_AUTHORITY_ROLLBACK_DETECTED",
        "The supplied registry generation is older than the protected authority checkpoint.",
        "integrity",
        503,
      );
    }
    if (expectedGeneration !== inspected.checkpoint.currentGeneration) {
      throw authorityError(
        "LOCAL_CLIENT_WINDOWS_AUTHORITY_GENERATION_MISMATCH",
        "The supplied registry generation does not match the protected authority checkpoint.",
        "integrity",
        503,
      );
    }
    if (!safeDigestEqual(expectedDigest, inspected.checkpoint.currentDigest)) {
      throw authorityError(
        "LOCAL_CLIENT_WINDOWS_AUTHORITY_DIGEST_MISMATCH",
        "The supplied registry digest does not match the protected authority checkpoint.",
        "integrity",
        503,
      );
    }
    return Object.freeze({ generation: expectedGeneration, digest: expectedDigest });
  }

  async prepareNext(
    expectedCurrentGeneration: number,
    nextDigest: string,
  ): Promise<LocalClientWindowsProtectedAuthorityStatus> {
    this.#assertOpen();
    const configuration = this.#requireConfiguration();
    const expected = assertGeneration(expectedCurrentGeneration, false);
    const digest = assertDigest(nextDigest);
    const current = await this.#inspectStrict();
    if (current.status.state === "pending-recovery") throw pendingError();
    if (!current.status.available || current.status.state !== "ready") {
      throw unavailableError(current.status.reason);
    }
    if (current.checkpoint.currentGeneration !== expected) {
      throw authorityError(
        "LOCAL_CLIENT_WINDOWS_AUTHORITY_GENERATION_MISMATCH",
        "The expected current generation is stale.",
        "integrity",
        409,
      );
    }
    if (expected >= Number.MAX_SAFE_INTEGER) throw configurationError();
    const nextGeneration = expected + 1;
    const request = this.#createRequest({
      operation: "prepare-next",
      expectedCurrentGeneration: expected,
      expectedCurrentDigest: current.checkpoint.currentDigest,
      nextGeneration,
      nextDigest: digest,
    });
    let response: LocalClientWindowsAuthorityBrokerResponse;
    try {
      response = await configuration.broker!.prepareNext(request);
    } catch {
      throw brokerWriteError();
    }
    const inspected = await this.#validateMutationResponse(request, response);
    if (
      inspected.checkpoint.currentGeneration !== expected
      || !safeDigestEqual(inspected.checkpoint.currentDigest, current.checkpoint.currentDigest)
      || inspected.checkpoint.pendingGeneration !== nextGeneration
      || !safeDigestEqual(inspected.checkpoint.pendingDigest, digest)
      || inspected.status.state !== "pending-recovery"
    ) throw attestationError("CHECKPOINT_DIVERGED");
    return inspected.status;
  }

  async finalize(
    generation: number,
    digest: string,
  ): Promise<LocalClientWindowsProtectedAuthorityStatus> {
    this.#assertOpen();
    const configuration = this.#requireConfiguration();
    const expectedGeneration = assertGeneration(generation, false);
    const expectedDigest = assertDigest(digest);
    const current = await this.#inspectStrict();
    if (
      current.checkpoint.pendingGeneration === null
      || current.checkpoint.pendingDigest === null
    ) throw noPendingError();
    if (
      current.checkpoint.pendingGeneration !== expectedGeneration
      || !safeDigestEqual(current.checkpoint.pendingDigest, expectedDigest)
    ) throw pendingError();
    const request = this.#createRequest({
      operation: "finalize",
      expectedCurrentGeneration: current.checkpoint.currentGeneration,
      expectedCurrentDigest: current.checkpoint.currentDigest,
      nextGeneration: expectedGeneration,
      nextDigest: expectedDigest,
    });
    let response: LocalClientWindowsAuthorityBrokerResponse;
    try {
      response = await configuration.broker!.finalize(request);
    } catch {
      throw brokerWriteError();
    }
    const inspected = await this.#validateMutationResponse(request, response);
    if (
      inspected.checkpoint.currentGeneration !== expectedGeneration
      || !safeDigestEqual(inspected.checkpoint.currentDigest, expectedDigest)
      || inspected.checkpoint.pendingGeneration !== null
      || inspected.checkpoint.pendingDigest !== null
      || inspected.status.state !== "ready"
    ) throw attestationError("CHECKPOINT_DIVERGED");
    return inspected.status;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#configuration?.integrityKey.fill(0);
    this.#usedNonces.clear();
  }

  async #inspectStrict(): Promise<StrictInspection> {
    const configuration = this.#requireConfiguration();
    if (process.platform !== "win32") throw unavailableReason("NOT_WINDOWS");
    if (!configuration.broker) throw unavailableReason("BROKER_UNAVAILABLE");
    const localFile = await readAndValidateAnchorFile(configuration);
    const request = this.#createRequest({
      operation: "inspect",
      expectedCurrentGeneration: localFile.currentGeneration,
      expectedCurrentDigest: localFile.currentDigest,
      nextGeneration: localFile.pendingGeneration,
      nextDigest: localFile.pendingDigest,
    });
    let response: LocalClientWindowsAuthorityBrokerResponse;
    try {
      response = await configuration.broker.inspect(request);
    } catch {
      throw unavailableReason("BROKER_UNAVAILABLE");
    }
    return validateAttestation(configuration, request, response, localFile);
  }

  async #validateMutationResponse(
    request: LocalClientWindowsAuthorityBrokerRequest,
    response: LocalClientWindowsAuthorityBrokerResponse,
  ): Promise<StrictInspection> {
    const configuration = this.#requireConfiguration();
    const localFile = await readAndValidateAnchorFile(configuration);
    return validateAttestation(configuration, request, response, localFile);
  }

  #createRequest(input: Readonly<{
    operation: LocalClientWindowsAuthorityOperation;
    expectedCurrentGeneration: number | null;
    expectedCurrentDigest: string | null;
    nextGeneration: number | null;
    nextDigest: string | null;
  }>): LocalClientWindowsAuthorityBrokerRequest {
    const configuration = this.#requireConfiguration();
    const nonce = this.#nextNonce(configuration);
    const unsigned = {
      requestVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_REQUEST_VERSION,
      operation: input.operation,
      nonce,
      hostId: configuration.hostId,
      serviceSid: configuration.serviceSid,
      currentUserSid: configuration.currentUserSid,
      anchorPath: configuration.anchorPath,
      programDataRoot: configuration.programDataRoot,
      hklmKeyPath: configuration.hklmKeyPath,
      hklmView: "registry64" as const,
      expectedCurrentGeneration: input.expectedCurrentGeneration,
      expectedCurrentDigest: input.expectedCurrentDigest,
      nextGeneration: input.nextGeneration,
      nextDigest: input.nextDigest,
    };
    return Object.freeze({
      ...unsigned,
      requestHmacSha256: createLocalClientWindowsAuthorityRequestHmac(
        configuration.integrityKey,
        unsigned,
      ),
    });
  }

  #nextNonce(configuration: NormalizedConfiguration): string {
    let nonce: unknown;
    try { nonce = configuration.nonceFactory(); } catch { throw configurationError(); }
    if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce) || this.#usedNonces.has(nonce)) {
      throw configurationError();
    }
    this.#usedNonces.add(nonce);
    if (this.#usedNonces.size > MAX_NONCES) {
      const oldest = this.#usedNonces.values().next().value as string | undefined;
      if (oldest) this.#usedNonces.delete(oldest);
    }
    return nonce;
  }

  #requireConfiguration(): NormalizedConfiguration {
    if (!this.#configuration) throw unavailableReason("DISABLED");
    if (!this.#configuration.broker) throw unavailableReason("BROKER_UNAVAILABLE");
    return this.#configuration;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw authorityError(
        "LOCAL_CLIENT_WINDOWS_AUTHORITY_CLOSED",
        "The Windows protected authority anchor is closed.",
        "persistence",
        503,
      );
    }
  }
}

export function createLocalClientWindowsProtectedAuthorityAnchor(
  options: LocalClientWindowsProtectedAuthorityOptions = {},
): LocalClientWindowsProtectedAuthorityAnchor {
  return new LocalClientWindowsProtectedAuthorityAnchor(options);
}

export function createLocalClientWindowsAuthorityRequestHmac(
  key: Uint8Array,
  request: Omit<LocalClientWindowsAuthorityBrokerRequest, "requestHmacSha256">,
): string {
  return keyedDigest(key, REQUEST_DOMAIN, request);
}

export function createLocalClientWindowsAuthorityResponseHmac(
  key: Uint8Array,
  response: Omit<LocalClientWindowsAuthorityBrokerResponse, "responseHmacSha256">,
): string {
  return keyedDigest(key, RESPONSE_DOMAIN, response);
}

export function createLocalClientWindowsAuthorityFileHmac(
  key: Uint8Array,
  checkpoint: Omit<LocalClientWindowsAuthorityFileCheckpoint, "hmacSha256">,
): string {
  return keyedDigest(key, FILE_DOMAIN, checkpoint);
}

async function readAndValidateAnchorFile(
  configuration: NormalizedConfiguration,
): Promise<LocalClientWindowsAuthorityFileCheckpoint> {
  await assertSafeNodeTopology(configuration);
  let handle;
  try {
    handle = await open(configuration.anchorPath, "r");
    const before = await handle.stat();
    if (!before.isFile() || before.size < 2 || before.size > MAX_FILE_BYTES) {
      throw unavailableReason("ANCHOR_INVALID");
    }
    const bytes = Buffer.alloc(Number(before.size));
    const read = await handle.read(bytes, 0, bytes.byteLength, 0);
    const after = await handle.stat();
    if (
      read.bytesRead !== bytes.byteLength
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs
    ) throw unavailableReason("ANCHOR_INVALID");
    let raw: unknown;
    try { raw = JSON.parse(bytes.toString("utf8")); } catch { throw unavailableReason("ANCHOR_INVALID"); }
    return validateFileCheckpoint(configuration, raw);
  } catch (error) {
    if (error instanceof LocalClientWindowsProtectedAuthorityError) throw error;
    throw unavailableReason("ANCHOR_INVALID");
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function assertSafeNodeTopology(configuration: NormalizedConfiguration): Promise<void> {
  try {
    const [rootStat, fileStat] = await Promise.all([
      lstat(configuration.programDataRoot),
      lstat(configuration.anchorPath),
    ]);
    if (
      !rootStat.isDirectory()
      || rootStat.isSymbolicLink()
      || !fileStat.isFile()
      || fileStat.isSymbolicLink()
      || normalizeWindowsPath(win32.dirname(configuration.anchorPath))
        !== normalizeWindowsPath(configuration.programDataRoot)
    ) throw unavailableReason("PATH_UNSAFE");
    const [resolvedRoot, resolvedFile] = await Promise.all([
      realpath(configuration.programDataRoot),
      realpath(configuration.anchorPath),
    ]);
    if (
      normalizeWindowsPath(win32.dirname(resolvedFile)) !== normalizeWindowsPath(resolvedRoot)
      || win32.basename(resolvedFile).toLowerCase()
        !== win32.basename(configuration.anchorPath).toLowerCase()
    ) throw unavailableReason("PATH_UNSAFE");
  } catch (error) {
    if (error instanceof LocalClientWindowsProtectedAuthorityError) throw error;
    throw unavailableReason("PATH_UNSAFE");
  }
}

function validateFileCheckpoint(
  configuration: NormalizedConfiguration,
  raw: unknown,
): LocalClientWindowsAuthorityFileCheckpoint {
  assertExactRecord(raw, [
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
  ], "ANCHOR_INVALID");
  if (
    raw.fileVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION
    || raw.hostId !== configuration.hostId
    || raw.serviceSid !== configuration.serviceSid
    || raw.anchorPath !== configuration.anchorPath
    || raw.hklmKeyPath !== configuration.hklmKeyPath
    || raw.hklmView !== "registry64"
    || typeof raw.hmacSha256 !== "string"
    || !SHA256_PATTERN.test(raw.hmacSha256)
  ) throw unavailableReason("ANCHOR_INVALID");
  const state = validateCheckpointState(raw, "ANCHOR_INVALID", false);
  const unsigned = {
    fileVersion: LOCAL_CLIENT_WINDOWS_AUTHORITY_FILE_VERSION,
    hostId: configuration.hostId,
    serviceSid: configuration.serviceSid,
    anchorPath: configuration.anchorPath,
    hklmKeyPath: configuration.hklmKeyPath,
    hklmView: "registry64" as const,
    ...state,
  };
  const expected = createLocalClientWindowsAuthorityFileHmac(configuration.integrityKey, unsigned);
  if (!safeDigestEqual(raw.hmacSha256, expected)) throw unavailableReason("ANCHOR_INVALID");
  return Object.freeze({ ...unsigned, hmacSha256: raw.hmacSha256 });
}

function validateAttestation(
  configuration: NormalizedConfiguration,
  request: LocalClientWindowsAuthorityBrokerRequest,
  response: LocalClientWindowsAuthorityBrokerResponse,
  localFile: LocalClientWindowsAuthorityFileCheckpoint,
): StrictInspection {
  validateResponseShape(response);
  const { responseHmacSha256, ...unsigned } = response;
  const expectedHmac = createLocalClientWindowsAuthorityResponseHmac(
    configuration.integrityKey,
    unsigned,
  );
  if (!safeDigestEqual(responseHmacSha256, expectedHmac)) {
    throw attestationError("ATTESTATION_INVALID");
  }
  if (
    response.operation !== request.operation
    || response.nonce !== request.nonce
    || response.osPlatform !== "win32"
    || response.hostId !== configuration.hostId
    || response.serviceSid !== configuration.serviceSid
    || response.anchorPath !== configuration.anchorPath
    || response.programDataRoot !== configuration.programDataRoot
    || response.hklmKeyPath !== configuration.hklmKeyPath
  ) throw attestationError("ATTESTATION_BINDING_MISMATCH");
  if (response.hklmView !== "registry64") throw attestationError("HKLM_VIEW_MISMATCH");
  const fileState = validateCheckpointState(response.fileCheckpoint, "ATTESTATION_INVALID", true);
  const hklmState = validateCheckpointState(response.hklmCheckpoint, "ATTESTATION_INVALID", true);
  const localState = checkpointProjection(localFile);
  if (!sameCheckpoint(fileState, hklmState) || !sameCheckpoint(fileState, localState)) {
    throw attestationError("CHECKPOINT_DIVERGED");
  }
  validateAclFacts(configuration, response.acl);
  const status = statusFromCheckpoint(configuration, fileState);
  return Object.freeze({ status, checkpoint: fileState });
}

function validateResponseShape(response: unknown): asserts response is LocalClientWindowsAuthorityBrokerResponse {
  assertExactRecord(response, [
    "brokerVersion",
    "operation",
    "nonce",
    "osPlatform",
    "hostId",
    "serviceSid",
    "anchorPath",
    "programDataRoot",
    "hklmKeyPath",
    "hklmView",
    "fileCheckpoint",
    "hklmCheckpoint",
    "acl",
    "responseHmacSha256",
  ], "ATTESTATION_INVALID");
  if (
    response.brokerVersion !== LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_VERSION
    || !new Set(["inspect", "prepare-next", "finalize"]).has(String(response.operation ?? ""))
    || typeof response.nonce !== "string"
    || !NONCE_PATTERN.test(response.nonce)
    || typeof response.responseHmacSha256 !== "string"
    || !SHA256_PATTERN.test(response.responseHmacSha256)
    || !isPlainRecord(response.fileCheckpoint)
    || !isPlainRecord(response.hklmCheckpoint)
    || !isPlainRecord(response.acl)
  ) throw attestationError("ATTESTATION_INVALID");
}

function validateAclFacts(
  configuration: NormalizedConfiguration,
  raw: unknown,
): void {
  assertExactRecord(raw, [
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
  ], "ATTESTATION_INVALID");
  if (
    raw.source !== "independent-privileged-broker"
    || raw.currentUserSid !== configuration.currentUserSid
    || raw.serviceSid !== configuration.serviceSid
    || raw.hklmHive !== "HKLM"
    || raw.hklmKeyPath !== configuration.hklmKeyPath
  ) throw attestationError("ATTESTATION_BINDING_MISMATCH");
  if (raw.hklmView !== "registry64") throw attestationError("HKLM_VIEW_MISMATCH");
  const owners = [raw.rootOwnerSid, raw.fileOwnerSid, raw.registryOwnerSid]
    .map((sid) => normalizeSid(sid));
  if (owners.some((sid) => !configuration.allowedOwnerSids.has(sid))) {
    throw attestationError("OWNER_NOT_ALLOWED");
  }
  const writerGroups = [
    normalizeSidArray(raw.rootAllowedWriteSids),
    normalizeSidArray(raw.fileAllowedWriteSids),
    normalizeSidArray(raw.registryAllowedWriteSids),
  ];
  const inheritedGroups = [
    normalizeSidArray(raw.rootInheritedWriteSids),
    normalizeSidArray(raw.fileInheritedWriteSids),
    normalizeSidArray(raw.registryInheritedWriteSids),
  ];
  if (writerGroups.some((sids) => !sids.includes(configuration.serviceSid))) {
    throw attestationError("SERVICE_SID_NOT_ALLOWED");
  }
  if (
    raw.rootCurrentUserCanWrite !== false
    || raw.fileCurrentUserCanWrite !== false
    || raw.registryCurrentUserCanWrite !== false
  ) throw attestationError("CURRENT_USER_WRITABLE");
  if ([...writerGroups, ...inheritedGroups].some((sids) => (
    sids.some((sid) => BROAD_WRITE_SIDS.has(sid))
  ))) throw attestationError("INHERITED_BROAD_WRITE");
  if ([...writerGroups, ...inheritedGroups].some((sids) => (
    sids.some((sid) => !configuration.allowedWriterSids.has(sid))
  ))) throw attestationError("WRITE_PRINCIPAL_NOT_ALLOWED");
}

function statusFromCheckpoint(
  configuration: NormalizedConfiguration,
  checkpoint: LocalClientWindowsAuthorityCheckpointState,
): LocalClientWindowsProtectedAuthorityStatus {
  if (checkpoint.pendingGeneration !== null) {
    return createStatus(configuration, {
      available: false,
      rollbackResistant: false,
      state: "pending-recovery",
      reason: "PENDING_RECOVERY_REQUIRED",
      checkpoint,
      verified: true,
    });
  }
  if (checkpoint.currentGeneration === 0 || checkpoint.currentDigest === null) {
    return createStatus(configuration, {
      available: false,
      rollbackResistant: false,
      state: "uninitialized",
      reason: "UNINITIALIZED",
      checkpoint,
      verified: true,
    });
  }
  return createStatus(configuration, {
    available: true,
    rollbackResistant: true,
    state: "ready",
    reason: null,
    checkpoint,
    verified: true,
  });
}

function unavailableStatus(
  configuration: NormalizedConfiguration | null,
  state: "disabled" | "unavailable" | "pending-recovery",
  reason: LocalClientWindowsAuthorityReason,
): LocalClientWindowsProtectedAuthorityStatus {
  return createStatus(configuration, {
    available: false,
    rollbackResistant: false,
    state,
    reason,
    checkpoint: null,
    verified: false,
  });
}

function createStatus(
  configuration: NormalizedConfiguration | null,
  input: Readonly<{
    available: boolean;
    rollbackResistant: boolean;
    state: LocalClientWindowsAuthorityStatusState;
    reason: LocalClientWindowsAuthorityReason | null;
    checkpoint: LocalClientWindowsAuthorityCheckpointState | null;
    verified: boolean;
  }>,
): LocalClientWindowsProtectedAuthorityStatus {
  return Object.freeze({
    available: input.available,
    rollbackResistant: input.rollbackResistant,
    state: input.state,
    reason: input.reason,
    currentGeneration: input.checkpoint?.currentGeneration ?? null,
    currentDigest: input.checkpoint?.currentDigest ?? null,
    pendingGeneration: input.checkpoint?.pendingGeneration ?? null,
    pendingDigest: input.checkpoint?.pendingDigest ?? null,
    hostFingerprint: configuration ? fingerprint(configuration.hostId) : null,
    serviceSidFingerprint: configuration ? fingerprint(configuration.serviceSid) : null,
    anchorFingerprint: configuration ? fingerprint(configuration.anchorPath) : null,
    hklmKeyFingerprint: configuration ? fingerprint(configuration.hklmKeyPath) : null,
    brokerAttested: input.verified,
    localFileVerified: input.verified,
    aclVerified: input.verified,
    hklmVerified: input.verified,
    boundaries: LOCAL_CLIENT_WINDOWS_PROTECTED_AUTHORITY_BOUNDARIES,
  });
}

function normalizeConfiguration(
  options: LocalClientWindowsProtectedAuthorityEnabledOptions,
): NormalizedConfiguration {
  const anchorPath = assertLocalWindowsPath(options.anchorPath);
  const programDataRoot = assertLocalWindowsPath(options.programDataRoot);
  if (normalizeWindowsPath(win32.dirname(anchorPath)) !== normalizeWindowsPath(programDataRoot)) {
    throw configurationError();
  }
  const hklmKeyPath = assertHklmKeyPath(options.hklmKeyPath);
  const hostId = boundedText(options.hostId, 256);
  const serviceSid = normalizeSid(options.serviceSid);
  if (!SERVICE_SID_PATTERN.test(serviceSid)) throw configurationError();
  const currentUserSid = normalizeSid(options.currentUserSid);
  if (currentUserSid === serviceSid) throw configurationError();
  const integrityKey = cloneKey(options.integrityKey);
  const defaultAllowlist = [serviceSid, SYSTEM_SID, ADMINISTRATORS_SID];
  const allowedOwnerSids = new Set(normalizeConfiguredSidList(
    options.allowedOwnerSids ?? defaultAllowlist,
  ));
  const allowedWriterSids = new Set(normalizeConfiguredSidList(
    options.allowedWriterSids ?? defaultAllowlist,
  ));
  if (
    !allowedOwnerSids.has(serviceSid)
    || !allowedWriterSids.has(serviceSid)
    || [...allowedOwnerSids, ...allowedWriterSids].some((sid) => BROAD_WRITE_SIDS.has(sid))
    || allowedOwnerSids.has(currentUserSid)
    || allowedWriterSids.has(currentUserSid)
  ) {
    integrityKey.fill(0);
    throw configurationError();
  }
  if (options.broker !== undefined && !validBroker(options.broker)) {
    integrityKey.fill(0);
    throw configurationError();
  }
  if (options.nonceFactory !== undefined && typeof options.nonceFactory !== "function") {
    integrityKey.fill(0);
    throw configurationError();
  }
  return Object.freeze({
    anchorPath,
    programDataRoot,
    hklmKeyPath,
    hostId,
    serviceSid,
    currentUserSid,
    integrityKey,
    broker: options.broker ?? null,
    allowedOwnerSids,
    allowedWriterSids,
    nonceFactory: options.nonceFactory ?? (() => randomBytes(32).toString("hex")),
  });
}

function assertExactOptions(options: LocalClientWindowsProtectedAuthorityOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  if (options.enabled !== true) {
    if (Reflect.ownKeys(options).some((key) => key !== "enabled")) throw configurationError();
    return;
  }
  const allowed = [
    "enabled",
    "anchorPath",
    "programDataRoot",
    "hklmKeyPath",
    "hostId",
    "serviceSid",
    "currentUserSid",
    "integrityKey",
    "broker",
    "allowedOwnerSids",
    "allowedWriterSids",
    "nonceFactory",
  ];
  const optional = new Set(["broker", "allowedOwnerSids", "allowedWriterSids", "nonceFactory"]);
  const keys = Reflect.ownKeys(options);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.includes(key))
    || allowed.some((key) => !optional.has(key) && !Object.hasOwn(options, key))
  ) throw configurationError();
}

function validateCheckpointState(
  raw: unknown,
  reason: LocalClientWindowsAuthorityReason,
  exact: boolean,
): LocalClientWindowsAuthorityCheckpointState {
  if (!isPlainRecord(raw)) throw unavailableReason(reason);
  if (exact) {
    assertExactRecord(raw, [
      "currentGeneration",
      "currentDigest",
      "pendingGeneration",
      "pendingDigest",
    ], reason);
  }
  const currentGeneration = assertGenerationForAttestation(raw.currentGeneration, true, reason);
  const currentDigest = assertNullableDigest(raw.currentDigest, reason);
  const pendingGeneration = raw.pendingGeneration === null
    ? null
    : assertGenerationForAttestation(raw.pendingGeneration, false, reason);
  const pendingDigest = assertNullableDigest(raw.pendingDigest, reason);
  if (
    (currentGeneration === 0) !== (currentDigest === null)
    || (pendingGeneration === null) !== (pendingDigest === null)
    || (pendingGeneration !== null && pendingGeneration !== currentGeneration + 1)
  ) throw unavailableReason(reason);
  return Object.freeze({ currentGeneration, currentDigest, pendingGeneration, pendingDigest });
}

function checkpointProjection(
  checkpoint: LocalClientWindowsAuthorityFileCheckpoint,
): LocalClientWindowsAuthorityCheckpointState {
  return Object.freeze({
    currentGeneration: checkpoint.currentGeneration,
    currentDigest: checkpoint.currentDigest,
    pendingGeneration: checkpoint.pendingGeneration,
    pendingDigest: checkpoint.pendingDigest,
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

function normalizeConfiguredSidList(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw configurationError();
  const normalized = value.map(normalizeSid).sort();
  if (new Set(normalized).size !== normalized.length) throw configurationError();
  return Object.freeze(normalized);
}

function normalizeSidArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > 32) throw attestationError("ATTESTATION_INVALID");
  const normalized = value.map((sid) => normalizeSid(sid)).sort();
  if (
    new Set(normalized).size !== normalized.length
    || normalized.some((sid, index) => sid !== value[index])
  ) throw attestationError("ATTESTATION_INVALID");
  return Object.freeze(normalized);
}

function normalizeSid(value: unknown): string {
  if (typeof value !== "string" || value !== value.trim() || !SID_PATTERN.test(value)) {
    throw configurationError();
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

function assertHklmKeyPath(value: unknown): string {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < 10
    || value.length > 1_024
    || !/^HKLM\\[A-Za-z0-9 _.-]+(?:\\[A-Za-z0-9 _.-]+)+$/u.test(value)
    || value.includes("..")
  ) throw configurationError();
  return value;
}

function normalizeWindowsPath(value: string): string {
  return win32.normalize(value).toLowerCase();
}

function validBroker(value: unknown): value is LocalClientWindowsAuthorityPrivilegedBrokerPort {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<LocalClientWindowsAuthorityPrivilegedBrokerPort>;
  return typeof candidate.inspect === "function"
    && typeof candidate.prepareNext === "function"
    && typeof candidate.finalize === "function";
}

function cloneKey(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < 32 || value.byteLength > 64) {
    throw configurationError();
  }
  return Buffer.from(value);
}

function boundedText(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < 1
    || value.length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw configurationError();
  return value;
}

function assertGeneration(value: unknown, allowZero: boolean): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || (allowZero ? value < 0 : value <= 0)
  ) throw configurationError();
  return value;
}

function assertGenerationForAttestation(
  value: unknown,
  allowZero: boolean,
  reason: LocalClientWindowsAuthorityReason,
): number {
  try { return assertGeneration(value, allowZero); } catch { throw unavailableReason(reason); }
}

function assertDigest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw configurationError();
  return value;
}

function assertNullableDigest(
  value: unknown,
  reason: LocalClientWindowsAuthorityReason,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw unavailableReason(reason);
  return value;
}

function nullableDigestEqual(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  return safeDigestEqual(left, right);
}

function keyedDigest(key: Uint8Array, domain: string, value: unknown): string {
  return createHmac("sha256", key)
    .update(domain, "utf8")
    .update("\0", "utf8")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function fingerprint(value: string): string {
  return createHmac("sha256", "local-client-windows-authority-public-fingerprint-v1")
    .update(value, "utf8")
    .digest("hex")
    .slice(0, 16);
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

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function assertExactRecord(
  value: unknown,
  keys: readonly string[],
  reason: LocalClientWindowsAuthorityReason,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw unavailableReason(reason);
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length
    || actual.some((key) => typeof key !== "string" || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
  ) throw unavailableReason(reason);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function errorReason(error: unknown): LocalClientWindowsAuthorityReason {
  if (error instanceof LocalClientWindowsProtectedAuthorityError && error.reason) return error.reason;
  return "ATTESTATION_INVALID";
}

function reasonState(reason: LocalClientWindowsAuthorityReason): "unavailable" | "pending-recovery" {
  return reason === "PENDING_RECOVERY_REQUIRED" ? "pending-recovery" : "unavailable";
}

function authorityError(
  code: LocalClientWindowsAuthorityErrorCode,
  message: string,
  category: LocalClientWindowsProtectedAuthorityError["category"],
  statusCode: number,
  reason: LocalClientWindowsAuthorityReason | null = null,
  retryable = false,
): LocalClientWindowsProtectedAuthorityError {
  return new LocalClientWindowsProtectedAuthorityError({
    code,
    message,
    category,
    statusCode,
    reason,
    retryable,
  });
}

function configurationError(): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_CONFIGURATION_INVALID",
    "The Windows protected authority anchor configuration is invalid.",
    "configuration",
    500,
  );
}

function unavailableReason(
  reason: LocalClientWindowsAuthorityReason,
): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_UNAVAILABLE",
    "The Windows protected authority anchor could not be verified.",
    "integrity",
    503,
    reason,
  );
}

function attestationError(
  reason: LocalClientWindowsAuthorityReason,
): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_ATTESTATION_INVALID",
    "The privileged Windows authority attestation failed validation.",
    "integrity",
    503,
    reason,
  );
}

function unavailableError(
  reason: LocalClientWindowsAuthorityReason | null,
): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_UNAVAILABLE",
    "A verified protected authority checkpoint is required.",
    "integrity",
    503,
    reason,
  );
}

function pendingError(): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_PENDING_RECOVERY_REQUIRED",
    "The protected authority anchor has a pending generation requiring explicit recovery.",
    "recovery",
    409,
    "PENDING_RECOVERY_REQUIRED",
  );
}

function noPendingError(): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_NO_PENDING_GENERATION",
    "No pending protected authority generation can be finalized.",
    "recovery",
    409,
  );
}

function brokerWriteError(): LocalClientWindowsProtectedAuthorityError {
  return authorityError(
    "LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_WRITE_FAILED",
    "The privileged authority broker did not complete the requested checkpoint write.",
    "persistence",
    503,
    "BROKER_UNAVAILABLE",
    true,
  );
}
