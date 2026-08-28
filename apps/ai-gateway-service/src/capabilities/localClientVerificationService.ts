import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
} from "./localClientAdapterRegistry.ts";

export const LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION = "local-client-verification-declaration-v1" as const;
export const LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION = "local-client-verification-probe-descriptor-v1" as const;
export const LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION = "local-client-verification-evidence-v1" as const;
export const LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION = "local-client-verification-promotion-v1" as const;

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_IDENTITY_LENGTH = 128;
const DEFAULT_MAX_EVIDENCE_TTL_MS = 24 * 60 * 60_000;
const MAX_EVIDENCE_TTL_MS = 7 * 24 * 60 * 60_000;

export interface LocalClientVerificationScope {
  readonly tenantId: string;
  readonly subjectId: string;
}

export interface LocalClientVerificationAdapterReference {
  readonly id: string;
  readonly type: string;
  readonly version: string;
}

/**
 * Trusted storage projection used for verification. Endpoints, commands,
 * credentials, process metadata, and raw client responses must never be added.
 */
export interface LocalClientVerificationDeclaration {
  readonly declarationVersion: typeof LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION;
  readonly tenantId: string;
  readonly clientId: string;
  readonly revision: number;
  readonly state: "declared";
  readonly enabled: true;
  readonly adapter: LocalClientVerificationAdapterReference;
  readonly manifestSha256: string;
  readonly capabilityIds: readonly string[];
}

export interface LocalClientVerificationEvidence {
  readonly evidenceVersion: typeof LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION;
  readonly fingerprint: string;
  readonly verifiedAtMs: number;
  readonly expiresAtMs: number;
}

export interface LocalClientVerificationProbeDescriptor {
  readonly descriptorVersion: typeof LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION;
  readonly assurance: "governed-hmac-sha256-loopback";
  readonly clientId: string;
  readonly adapter: LocalClientVerificationAdapterReference;
  readonly manifestSha256: string;
}

export interface LocalClientVerificationProbe {
  readonly descriptor: LocalClientVerificationProbeDescriptor;
  probe(
    this: void,
    request: Readonly<{ signal: AbortSignal }>,
  ): Promise<LocalClientVerificationEvidence>;
  close?(this: void): void | Promise<void>;
}

export interface VerifiedLocalClientPromotion {
  readonly promotionVersion: typeof LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION;
  readonly descriptorVersion: "verified-local-client-adapter-target-v1";
  readonly clientId: string;
  readonly revision: number;
  readonly state: "verified";
  readonly trustDecision: "verified";
  readonly adapter: LocalClientVerificationAdapterReference;
  readonly manifestSha256: string;
  readonly capabilityIds: readonly string[];
  readonly verification: LocalClientVerificationEvidence;
}

export interface LocalClientVerificationStore {
  /** Reads only within the authenticated tenant scope supplied by the service. */
  readCurrent(
    this: void,
    scope: LocalClientVerificationScope,
    clientId: string,
  ): Promise<LocalClientVerificationDeclaration | null>;

  /**
   * Must atomically compare every expected declaration field and promote once.
   * A mismatch, concurrent update, or already-promoted row returns null.
   */
  promoteExact(
    this: void,
    request: Readonly<{
      scope: LocalClientVerificationScope;
      expected: LocalClientVerificationDeclaration;
      declarationFingerprint: string;
      evidence: LocalClientVerificationEvidence;
    }>,
  ): Promise<VerifiedLocalClientPromotion | null>;
}

export interface VerifyLocalClientRequest {
  readonly clientId: string;
  readonly expectedRevision: number;
  readonly expectedAdapter: LocalClientVerificationAdapterReference;
  readonly expectedManifestSha256: string;
  readonly signal: AbortSignal;
}

export interface LocalClientVerificationServiceOptions {
  readonly store: LocalClientVerificationStore;
  readonly probes: readonly LocalClientVerificationProbe[];
  readonly maxEvidenceTtlMs?: number;
  readonly now?: () => number;
}

export type LocalClientVerificationErrorCode =
  | "LOCAL_CLIENT_VERIFICATION_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_VERIFICATION_SERVICE_CLOSED"
  | "LOCAL_CLIENT_VERIFICATION_SCOPE_REQUIRED"
  | "LOCAL_CLIENT_VERIFICATION_REQUEST_INVALID"
  | "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND"
  | "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE"
  | "LOCAL_CLIENT_VERIFICATION_PROBE_UNAVAILABLE"
  | "LOCAL_CLIENT_VERIFICATION_PROBE_FAILED"
  | "LOCAL_CLIENT_VERIFICATION_EVIDENCE_INVALID"
  | "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED"
  | "LOCAL_CLIENT_VERIFICATION_CANCELLED";

export class LocalClientVerificationError extends Error {
  readonly code: LocalClientVerificationErrorCode;
  readonly category: "configuration" | "auth" | "validation" | "not_found" | "conflict" | "network" | "integrity" | "cancellation";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientVerificationErrorCode,
    message: string,
    category: LocalClientVerificationError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientVerificationError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export class LocalClientVerificationService {
  readonly #store: LocalClientVerificationStore;
  readonly #probes: ReadonlyMap<string, LocalClientVerificationProbe>;
  readonly #maxEvidenceTtlMs: number;
  readonly #now: () => number;
  #closed = false;

  constructor(options: LocalClientVerificationServiceOptions) {
    assertServiceOptions(options);
    this.#store = options.store;
    this.#maxEvidenceTtlMs = boundedInteger(
      options.maxEvidenceTtlMs,
      DEFAULT_MAX_EVIDENCE_TTL_MS,
      1_000,
      MAX_EVIDENCE_TTL_MS,
    );
    this.#now = options.now ?? Date.now;
    const probes = new Map<string, LocalClientVerificationProbe>();
    for (const candidate of options.probes) {
      const descriptor = cloneProbeDescriptor(candidate?.descriptor);
      if (typeof candidate?.probe !== "function") throw configurationError();
      if (
        descriptor.adapter.id === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID
        || descriptor.adapter.type === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE
      ) {
        throw configurationError();
      }
      const key = probeKey(descriptor.clientId, descriptor.adapter.id);
      if (probes.has(key)) throw configurationError();
      probes.set(key, Object.freeze({
        descriptor,
        probe: candidate.probe,
        ...(candidate.close === undefined ? {} : { close: candidate.close }),
      }));
    }
    this.#probes = probes;
  }

  async verifyAndPromote(
    request: VerifyLocalClientRequest,
    rawScope: LocalClientVerificationScope,
  ): Promise<VerifiedLocalClientPromotion> {
    if (this.#closed) {
      throw verificationError(
        "LOCAL_CLIENT_VERIFICATION_SERVICE_CLOSED",
        "The local-client verification service is closed.",
        "configuration",
        503,
      );
    }
    const scope = cloneScope(rawScope);
    const expected = cloneVerificationRequest(request);
    throwIfAborted(expected.signal);

    const initial = await this.#readDeclaration(scope, expected.clientId);
    assertMatchesExpected(initial, expected);
    const declarationFingerprint = fingerprintDeclaration(initial);
    const probe = this.#probes.get(probeKey(initial.clientId, initial.adapter.id));
    if (!probe || !probeMatchesDeclaration(probe.descriptor, initial)) {
      throw verificationError(
        "LOCAL_CLIENT_VERIFICATION_PROBE_UNAVAILABLE",
        "No trusted probe is configured for the exact declared client and adapter.",
        "configuration",
        503,
      );
    }

    let rawEvidence: LocalClientVerificationEvidence;
    try {
      rawEvidence = await Reflect.apply(probe.probe, undefined, [Object.freeze({
        signal: expected.signal,
      })]);
    } catch {
      if (expected.signal.aborted) throw cancelledError();
      throw verificationError(
        "LOCAL_CLIENT_VERIFICATION_PROBE_FAILED",
        "The trusted local-client verification probe failed.",
        "network",
        502,
        true,
      );
    }
    const evidence = cloneEvidence(rawEvidence);
    throwIfAborted(expected.signal);
    assertEvidenceFresh(evidence, readNow(this.#now), this.#maxEvidenceTtlMs);

    // Re-read after the network boundary. This catches ordinary TOCTOU changes;
    // promoteExact remains the required atomic compare-and-set boundary.
    let current: LocalClientVerificationDeclaration;
    try {
      current = await this.#readDeclaration(scope, expected.clientId);
    } catch (error) {
      if (
        error instanceof LocalClientVerificationError
        && error.code === "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND"
      ) {
        throw staleError();
      }
      throw error;
    }
    if (!safeDigestEqual(fingerprintDeclaration(current), declarationFingerprint)) {
      throw staleError();
    }
    assertEvidenceFresh(evidence, readNow(this.#now), this.#maxEvidenceTtlMs);
    throwIfAborted(expected.signal);

    let promoted: VerifiedLocalClientPromotion | null;
    try {
      promoted = await Reflect.apply(this.#store.promoteExact, undefined, [Object.freeze({
        scope,
        expected: initial,
        declarationFingerprint,
        evidence,
      })]);
    } catch {
      throw verificationError(
        "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED",
        "The verified local-client state could not be persisted.",
        "integrity",
        503,
      );
    }
    if (!promoted) throw staleError();
    return cloneAndValidatePromotion(promoted, initial, evidence);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await Promise.allSettled([...this.#probes.values()].map((probe) => probe.close?.()));
  }

  async #readDeclaration(
    scope: LocalClientVerificationScope,
    clientId: string,
  ): Promise<LocalClientVerificationDeclaration> {
    let raw: LocalClientVerificationDeclaration | null;
    try {
      raw = await Reflect.apply(this.#store.readCurrent, undefined, [scope, clientId]);
    } catch {
      throw verificationError(
        "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED",
        "The local-client declaration store is unavailable.",
        "integrity",
        503,
      );
    }
    if (!raw) throw declarationNotFoundError();
    const declaration = cloneDeclaration(raw);
    if (declaration.tenantId !== scope.tenantId || declaration.clientId !== clientId) {
      // Do not reveal that a buggy or malicious store returned another tenant's row.
      throw declarationNotFoundError();
    }
    return declaration;
  }
}

export function createLocalClientVerificationService(
  options: LocalClientVerificationServiceOptions,
): LocalClientVerificationService {
  return new LocalClientVerificationService(options);
}

/** Canonical digest used by atomic declaration stores for compare-and-set. */
export function fingerprintLocalClientVerificationDeclaration(
  declaration: LocalClientVerificationDeclaration,
): string {
  return fingerprintDeclaration(cloneDeclaration(declaration));
}

function assertServiceOptions(options: LocalClientVerificationServiceOptions): void {
  assertExactObjectShape(options, ["store", "probes", "maxEvidenceTtlMs", "now"], configurationError);
  if (
    !isPlainRecord(options.store)
    || typeof options.store.readCurrent !== "function"
    || typeof options.store.promoteExact !== "function"
    || !Array.isArray(options.probes)
    || (options.now !== undefined && typeof options.now !== "function")
  ) {
    throw configurationError();
  }
}

function cloneScope(raw: LocalClientVerificationScope): LocalClientVerificationScope {
  assertExactObjectShape(raw, ["tenantId", "subjectId"], scopeError);
  return Object.freeze({
    tenantId: assertIdentity(raw.tenantId, scopeError),
    subjectId: assertIdentity(raw.subjectId, scopeError),
  });
}

function cloneVerificationRequest(raw: VerifyLocalClientRequest): VerifyLocalClientRequest {
  assertExactObjectShape(raw, [
    "clientId",
    "expectedRevision",
    "expectedAdapter",
    "expectedManifestSha256",
    "signal",
  ], requestError);
  if (!(raw.signal instanceof AbortSignal)) throw requestError();
  const revision = assertRevision(raw.expectedRevision, requestError);
  if (revision >= Number.MAX_SAFE_INTEGER) throw requestError();
  return Object.freeze({
    clientId: assertIdentifier(raw.clientId, requestError),
    expectedRevision: revision,
    expectedAdapter: cloneAdapterReference(raw.expectedAdapter, requestError),
    expectedManifestSha256: assertSha256(raw.expectedManifestSha256, requestError),
    signal: raw.signal,
  });
}

function cloneDeclaration(raw: LocalClientVerificationDeclaration): LocalClientVerificationDeclaration {
  assertExactObjectShape(raw, [
    "declarationVersion",
    "tenantId",
    "clientId",
    "revision",
    "state",
    "enabled",
    "adapter",
    "manifestSha256",
    "capabilityIds",
  ], staleError);
  if (
    raw.declarationVersion !== LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION
    || raw.state !== "declared"
    || raw.enabled !== true
  ) {
    throw staleError();
  }
  return Object.freeze({
    declarationVersion: LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION,
    tenantId: assertIdentity(raw.tenantId, staleError),
    clientId: assertIdentifier(raw.clientId, staleError),
    revision: assertRevision(raw.revision, staleError),
    state: "declared",
    enabled: true,
    adapter: cloneAdapterReference(raw.adapter, staleError),
    manifestSha256: assertSha256(raw.manifestSha256, staleError),
    capabilityIds: cloneCapabilityIds(raw.capabilityIds, staleError),
  });
}

function cloneProbeDescriptor(
  raw: LocalClientVerificationProbeDescriptor,
): LocalClientVerificationProbeDescriptor {
  assertExactObjectShape(raw, [
    "descriptorVersion",
    "assurance",
    "clientId",
    "adapter",
    "manifestSha256",
  ], configurationError);
  if (
    raw.descriptorVersion !== LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION
    || raw.assurance !== "governed-hmac-sha256-loopback"
  ) {
    throw configurationError();
  }
  return Object.freeze({
    descriptorVersion: LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
    assurance: "governed-hmac-sha256-loopback",
    clientId: assertIdentifier(raw.clientId, configurationError),
    adapter: cloneAdapterReference(raw.adapter, configurationError),
    manifestSha256: assertSha256(raw.manifestSha256, configurationError),
  });
}

function cloneEvidence(raw: LocalClientVerificationEvidence): LocalClientVerificationEvidence {
  assertExactObjectShape(raw, [
    "evidenceVersion",
    "fingerprint",
    "verifiedAtMs",
    "expiresAtMs",
  ], evidenceError);
  if (
    raw.evidenceVersion !== LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION
    || typeof raw.fingerprint !== "string"
    || !SHA256_PATTERN.test(raw.fingerprint)
    || !Number.isSafeInteger(raw.verifiedAtMs)
    || raw.verifiedAtMs < 0
    || !Number.isSafeInteger(raw.expiresAtMs)
    || raw.expiresAtMs <= raw.verifiedAtMs
  ) {
    throw evidenceError();
  }
  return Object.freeze({
    evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
    fingerprint: raw.fingerprint,
    verifiedAtMs: raw.verifiedAtMs,
    expiresAtMs: raw.expiresAtMs,
  });
}

function cloneAndValidatePromotion(
  raw: VerifiedLocalClientPromotion,
  declaration: LocalClientVerificationDeclaration,
  evidence: LocalClientVerificationEvidence,
): VerifiedLocalClientPromotion {
  assertExactObjectShape(raw, [
    "promotionVersion",
    "descriptorVersion",
    "clientId",
    "revision",
    "state",
    "trustDecision",
    "adapter",
    "manifestSha256",
    "capabilityIds",
    "verification",
  ], promotionError);
  const adapter = cloneAdapterReference(raw.adapter, promotionError);
  const capabilities = cloneCapabilityIds(raw.capabilityIds, promotionError);
  const promotedEvidence = cloneEvidence(raw.verification);
  if (
    raw.promotionVersion !== LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION
    || raw.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || raw.clientId !== declaration.clientId
    || raw.revision !== declaration.revision + 1
    || raw.state !== "verified"
    || raw.trustDecision !== "verified"
    || !adapterEqual(adapter, declaration.adapter)
    || !safeDigestEqual(raw.manifestSha256, declaration.manifestSha256)
    || capabilities.length !== declaration.capabilityIds.length
    || capabilities.some((capability, index) => capability !== declaration.capabilityIds[index])
    || !evidenceEqual(promotedEvidence, evidence)
  ) {
    throw promotionError();
  }
  return Object.freeze({
    promotionVersion: LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION,
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: raw.clientId,
    revision: raw.revision,
    state: "verified",
    trustDecision: "verified",
    adapter,
    manifestSha256: declaration.manifestSha256,
    capabilityIds: capabilities,
    verification: promotedEvidence,
  });
}

function cloneAdapterReference(
  raw: LocalClientVerificationAdapterReference,
  errorFactory: () => LocalClientVerificationError,
): LocalClientVerificationAdapterReference {
  assertExactObjectShape(raw, ["id", "type", "version"], errorFactory);
  if (typeof raw.version !== "string" || !SEMVER_PATTERN.test(raw.version)) throw errorFactory();
  return Object.freeze({
    id: assertIdentifier(raw.id, errorFactory),
    type: assertIdentifier(raw.type, errorFactory),
    version: raw.version,
  });
}

function cloneCapabilityIds(
  raw: readonly string[],
  errorFactory: () => LocalClientVerificationError,
): readonly string[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 128) throw errorFactory();
  const capabilities = raw.map((value) => assertIdentifier(value, errorFactory)).sort();
  if (new Set(capabilities).size !== capabilities.length) throw errorFactory();
  return Object.freeze(capabilities);
}

function assertMatchesExpected(
  declaration: LocalClientVerificationDeclaration,
  expected: VerifyLocalClientRequest,
): void {
  if (
    declaration.revision !== expected.expectedRevision
    || !adapterEqual(declaration.adapter, expected.expectedAdapter)
    || !safeDigestEqual(declaration.manifestSha256, expected.expectedManifestSha256)
  ) {
    throw staleError();
  }
}

function probeMatchesDeclaration(
  descriptor: LocalClientVerificationProbeDescriptor,
  declaration: LocalClientVerificationDeclaration,
): boolean {
  return descriptor.clientId === declaration.clientId
    && adapterEqual(descriptor.adapter, declaration.adapter)
    && safeDigestEqual(descriptor.manifestSha256, declaration.manifestSha256);
}

function fingerprintDeclaration(declaration: LocalClientVerificationDeclaration): string {
  return createHash("sha256").update(JSON.stringify([
    declaration.declarationVersion,
    declaration.tenantId,
    declaration.clientId,
    declaration.revision,
    declaration.state,
    declaration.enabled,
    declaration.adapter.id,
    declaration.adapter.type,
    declaration.adapter.version,
    declaration.manifestSha256,
    declaration.capabilityIds,
  ]), "utf8").digest("hex");
}

function assertEvidenceFresh(
  evidence: LocalClientVerificationEvidence,
  nowMs: number,
  maxEvidenceTtlMs: number,
): void {
  if (
    evidence.verifiedAtMs > nowMs
    || evidence.expiresAtMs <= nowMs
    || evidence.expiresAtMs - evidence.verifiedAtMs > maxEvidenceTtlMs
  ) {
    throw evidenceError();
  }
}

function evidenceEqual(
  left: LocalClientVerificationEvidence,
  right: LocalClientVerificationEvidence,
): boolean {
  return left.evidenceVersion === right.evidenceVersion
    && safeDigestEqual(left.fingerprint, right.fingerprint)
    && left.verifiedAtMs === right.verifiedAtMs
    && left.expiresAtMs === right.expiresAtMs;
}

function adapterEqual(
  left: LocalClientVerificationAdapterReference,
  right: LocalClientVerificationAdapterReference,
): boolean {
  return left.id === right.id && left.type === right.type && left.version === right.version;
}

function probeKey(clientId: string, adapterId: string): string {
  return `${clientId}\u0000${adapterId}`;
}

function assertExactObjectShape(
  value: unknown,
  allowed: readonly string[],
  errorFactory: () => LocalClientVerificationError,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw errorFactory();
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowed.includes(key))) throw errorFactory();
  for (const required of allowed) {
    if ((required === "maxEvidenceTtlMs" || required === "now") && !Object.hasOwn(value, required)) continue;
    if (!Object.hasOwn(value, required)) throw errorFactory();
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertIdentifier(
  value: unknown,
  errorFactory: () => LocalClientVerificationError,
): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw errorFactory();
  return value;
}

function assertIdentity(
  value: unknown,
  errorFactory: () => LocalClientVerificationError,
): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_IDENTITY_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw errorFactory();
  }
  return value;
}

function assertSha256(
  value: unknown,
  errorFactory: () => LocalClientVerificationError,
): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw errorFactory();
  return value;
}

function assertRevision(
  value: unknown,
  errorFactory: () => LocalClientVerificationError,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw errorFactory();
  return Number(value);
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configurationError();
  return resolved;
}

function readNow(now: () => number): number {
  let value: unknown;
  try {
    value = now();
  } catch {
    throw evidenceError();
  }
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw evidenceError();
  return Number(value);
}

function safeDigestEqual(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !SHA256_PATTERN.test(left)
    || !SHA256_PATTERN.test(right)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw cancelledError();
}

function verificationError(
  code: LocalClientVerificationErrorCode,
  message: string,
  category: LocalClientVerificationError["category"],
  statusCode: number,
  retryable = false,
): LocalClientVerificationError {
  return new LocalClientVerificationError(code, message, category, statusCode, retryable);
}

function configurationError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_CONFIGURATION_INVALID",
    "The local-client verification service configuration is invalid.",
    "configuration",
    500,
  );
}

function scopeError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_SCOPE_REQUIRED",
    "Local-client verification requires an authenticated tenant and subject scope.",
    "auth",
    401,
  );
}

function requestError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_REQUEST_INVALID",
    "The local-client verification request is invalid.",
    "validation",
    400,
  );
}

function declarationNotFoundError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND",
    "No declared local client exists in the authenticated tenant scope.",
    "not_found",
    404,
  );
}

function staleError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE",
    "The declared local client changed before verification promotion completed.",
    "conflict",
    409,
  );
}

function evidenceError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_EVIDENCE_INVALID",
    "The trusted probe returned invalid or expired verification evidence.",
    "integrity",
    502,
  );
}

function promotionError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED",
    "The verified local-client promotion result failed integrity validation.",
    "integrity",
    503,
  );
}

function cancelledError(): LocalClientVerificationError {
  return verificationError(
    "LOCAL_CLIENT_VERIFICATION_CANCELLED",
    "Local-client verification was cancelled.",
    "cancellation",
    499,
  );
}
