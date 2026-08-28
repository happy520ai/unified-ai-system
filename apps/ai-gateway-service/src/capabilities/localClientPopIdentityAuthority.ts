import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION =
  "managed-local-client-pop-proof-v1" as const;
export const MANAGED_LOCAL_CLIENT_POP_CANONICAL_VERSION =
  "managed-local-client-pop-canonical-v1" as const;

export const MANAGED_LOCAL_CLIENT_POP_BOUNDARIES = Object.freeze({
  secretInput: "dedicated-buffer-consumed-and-zeroized" as const,
  identitySource: "server-authenticated-context-required" as const,
  requestBinding: "method-canonical-path-raw-body-sha256" as const,
  signature: "hmac-sha256" as const,
  nonceConsumption: "atomic-replay-guard-required" as const,
  replayScope: "domain-separated-key-id-sha256" as const,
  defaultReplayScope: "single-process-memory" as const,
  keyRotation: "close-old-authority-and-create-new-key-id" as const,
  bearerProofAloneGrantsAuthority: false as const,
});

export const LOCAL_CLIENT_POP_ERROR_CODES = Object.freeze([
  "LOCAL_CLIENT_POP_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_POP_REQUEST_INVALID",
  "LOCAL_CLIENT_POP_PROOF_INVALID",
  "LOCAL_CLIENT_POP_PROOF_EXPIRED",
  "LOCAL_CLIENT_POP_PROOF_NOT_YET_VALID",
  "LOCAL_CLIENT_POP_NONCE_REPLAYED",
  "LOCAL_CLIENT_POP_REPLAY_GUARD_UNAVAILABLE",
  "LOCAL_CLIENT_POP_NONCE_GENERATION_FAILED",
  "LOCAL_CLIENT_POP_AUTHORITY_UNAVAILABLE",
  "LOCAL_CLIENT_POP_CLOSED",
] as const);

export type LocalClientPopErrorCode = typeof LOCAL_CLIENT_POP_ERROR_CODES[number];

export interface ManagedLocalClientPopIdentity {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly clientId: string;
  readonly clientRevision: number;
}

/**
 * The body must be the exact request bytes seen by the HTTP ingress. Parsed
 * JSON or a caller-provided digest is intentionally not accepted here.
 */
export interface ManagedLocalClientPopRequestBinding {
  readonly method: string;
  readonly path: string;
  readonly body: Uint8Array;
}

/**
 * Tenant, subject, client, request path, and body data are deliberately absent
 * from the transport proof. Verification recomputes the HMAC from trusted
 * context plus the exact inbound request.
 */
export interface ManagedLocalClientPopProof {
  readonly proofVersion: typeof MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION;
  readonly keyId: string;
  readonly nonce: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly signature: string;
}

export interface ManagedLocalClientPopIssueRequest {
  readonly identity: ManagedLocalClientPopIdentity;
  readonly request: ManagedLocalClientPopRequestBinding;
}

export interface ManagedLocalClientPopVerifyRequest {
  /** Must come from authenticated server state, never from the proof body. */
  readonly expectedIdentity: ManagedLocalClientPopIdentity;
  readonly request: ManagedLocalClientPopRequestBinding;
  readonly proof: ManagedLocalClientPopProof;
}

export interface ManagedLocalClientPopVerification {
  readonly verified: true;
  readonly identity: ManagedLocalClientPopIdentity;
  readonly proofFingerprint: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

export interface ManagedLocalClientPopReplayGuardStatus {
  readonly available: boolean;
  readonly durable: boolean;
  readonly distributed: boolean;
  readonly mode: string;
  readonly authenticatedReplaySet?: boolean;
  readonly snapshotRollbackProtected?: boolean;
  readonly defensiveEnabled?: boolean;
  readonly capacityIsolatedByScope?: boolean;
  readonly maxEntries?: number;
  readonly maxEntriesPerScope?: number;
}

export interface ManagedLocalClientPopReplayConsumeInput {
  readonly replayKeySha256: string;
  /**
   * Opaque authority scope used by shared guards for capacity isolation. This
   * remains optional so existing custom guards can continue implementing the
   * replay port; current authorities always provide it.
   */
  readonly replayScopeSha256?: string;
  readonly expiresAtMs: number;
  readonly nowMs: number;
}

export interface ManagedLocalClientPopReplayGuard {
  readonly status: ManagedLocalClientPopReplayGuardStatus;

  /**
   * This operation must atomically consume replayKeySha256 once and, when a
   * replayScopeSha256 is supplied, enforce any scope quota in the same atomic
   * operation. A distributed deployment must inject a distributed
   * implementation; a read-then-write implementation does not satisfy this
   * contract.
   */
  consumeOnce(
    this: void,
    input: ManagedLocalClientPopReplayConsumeInput,
  ):
    | "consumed"
    | "replayed"
    | "capacity"
    | Promise<"consumed" | "replayed" | "capacity">;

  close?(this: void): void | Promise<void>;
}

export interface ManagedLocalClientPopAuthorityStatus {
  readonly available: boolean;
  readonly closed: boolean;
  readonly keyId: string;
  readonly proofTtlMs: number;
  readonly maxClockSkewMs: number;
  readonly replayGuard: ManagedLocalClientPopReplayGuardStatus;
  readonly boundaries: typeof MANAGED_LOCAL_CLIENT_POP_BOUNDARIES;
}

export interface ManagedLocalClientPopAuthorityPort {
  readonly status: ManagedLocalClientPopAuthorityStatus;
  issue(
    this: void,
    request: ManagedLocalClientPopIssueRequest,
  ): Promise<ManagedLocalClientPopProof>;
  verify(
    this: void,
    request: ManagedLocalClientPopVerifyRequest,
  ): Promise<ManagedLocalClientPopVerification>;
  close(this: void): Promise<void>;
}

export interface ManagedLocalClientPopAuthorityOptions {
  /**
   * A dedicated, domain-separated HMAC key. Ownership transfers to this
   * constructor: the supplied Buffer is wiped after a private copy is made.
   */
  readonly key: Buffer;
  readonly keyId: string;
  readonly proofTtlMs?: number;
  readonly maxClockSkewMs?: number;
  readonly maxReplayEntries?: number;
  /** Ownership transfers to the authority; close() is invoked during shutdown. */
  readonly replayGuard?: ManagedLocalClientPopReplayGuard;
  readonly now?: () => number;
  readonly nonceFactory?: () => Buffer;
}

export interface ManagedLocalClientPopKeyDerivationInput {
  readonly sharedSecret: Buffer;
  readonly tenantId: string;
  readonly clientId: string;
}

export interface ManagedLocalClientPopDerivedKey {
  /** Ownership transfers to the authority constructor or another secure signer. */
  readonly key: Buffer;
  readonly keyId: string;
}

export class LocalClientPopAuthorityError extends Error {
  readonly code: LocalClientPopErrorCode;
  readonly category:
    | "configuration"
    | "validation"
    | "auth"
    | "conflict"
    | "availability";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientPopErrorCode,
    message: string,
    category: LocalClientPopAuthorityError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientPopAuthorityError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

const DEFAULT_PROOF_TTL_MS = 30_000;
const MIN_PROOF_TTL_MS = 1_000;
const MAX_PROOF_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_CLOCK_SKEW_MS = 1_000;
const MAX_CLOCK_SKEW_MS = 30_000;
const DEFAULT_MAX_REPLAY_ENTRIES = 10_000;
const MAX_REPLAY_ENTRIES = 100_000;
const MIN_KEY_BYTES = 32;
const MAX_KEY_BYTES = 64;
const NONCE_BYTES = 32;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_PATH_BYTES = 2_048;
const OPAQUE_IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const KEY_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/u;
const METHOD_PATTERN = /^[A-Z]{3,16}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/u;

type NormalizedOptions = Readonly<{
  key: Buffer;
  keyId: string;
  proofTtlMs: number;
  maxClockSkewMs: number;
  replayGuard: ManagedLocalClientPopReplayGuard;
  now: () => number;
  nonceFactory: () => Buffer;
}>;

type CanonicalRequestBinding = Readonly<{
  method: string;
  path: string;
  bodySha256: string;
}>;

type UnsignedProof = Omit<ManagedLocalClientPopProof, "signature">;

class InMemoryManagedLocalClientPopReplayGuard
implements ManagedLocalClientPopReplayGuard {
  readonly status = Object.freeze({
    available: true,
    durable: false,
    distributed: false,
    mode: "single-process-memory",
    authenticatedReplaySet: false,
    snapshotRollbackProtected: false,
    defensiveEnabled: false,
    capacityIsolatedByScope: true,
  });

  readonly #entries = new Map<string, number>();
  readonly #maxEntries: number;
  #closed = false;

  constructor(maxEntries: number) {
    this.#maxEntries = maxEntries;
  }

  readonly consumeOnce = (
    input: ManagedLocalClientPopReplayConsumeInput,
  ): "consumed" | "replayed" | "capacity" => {
    if (this.#closed) return "capacity";
    for (const [key, expiresAtMs] of this.#entries) {
      if (expiresAtMs <= input.nowMs) this.#entries.delete(key);
    }
    if (this.#entries.has(input.replayKeySha256)) return "replayed";
    if (this.#entries.size >= this.#maxEntries) return "capacity";
    this.#entries.set(input.replayKeySha256, input.expiresAtMs);
    return "consumed";
  };

  readonly close = (): void => {
    this.#closed = true;
    this.#entries.clear();
  };
}

export class ManagedLocalClientPopIdentityAuthority
implements ManagedLocalClientPopAuthorityPort {
  readonly #key: Buffer;
  readonly #keyId: string;
  readonly #replayScopeSha256: string;
  readonly #proofTtlMs: number;
  readonly #maxClockSkewMs: number;
  readonly #replayGuard: ManagedLocalClientPopReplayGuard;
  readonly #now: () => number;
  readonly #nonceFactory: () => Buffer;
  #closed = false;

  constructor(options: ManagedLocalClientPopAuthorityOptions) {
    const normalized = normalizeOptions(options);
    this.#key = normalized.key;
    this.#keyId = normalized.keyId;
    this.#replayScopeSha256 = replayScopeSha256(normalized.keyId);
    this.#proofTtlMs = normalized.proofTtlMs;
    this.#maxClockSkewMs = normalized.maxClockSkewMs;
    this.#replayGuard = normalized.replayGuard;
    this.#now = normalized.now;
    this.#nonceFactory = normalized.nonceFactory;
  }

  get status(): ManagedLocalClientPopAuthorityStatus {
    const replayGuardStatus = cloneReplayGuardStatus(this.#replayGuard.status);
    return Object.freeze({
      available: !this.#closed && replayGuardStatus.available === true,
      closed: this.#closed,
      keyId: this.#keyId,
      proofTtlMs: this.#proofTtlMs,
      maxClockSkewMs: this.#maxClockSkewMs,
      replayGuard: replayGuardStatus,
      boundaries: MANAGED_LOCAL_CLIENT_POP_BOUNDARIES,
    });
  }

  async issue(
    request: ManagedLocalClientPopIssueRequest,
  ): Promise<ManagedLocalClientPopProof> {
    this.#assertOpen();
    try {
      assertExactRecord(request, ["identity", "request"], requestError);
      const identity = normalizeIdentity(request.identity);
      const binding = normalizeRequestBinding(request.request);
      const issuedAtMs = readNow(this.#now);
      const expiresAtMs = safeAdd(issuedAtMs, this.#proofTtlMs);
      const nonce = createNonce(this.#nonceFactory);
      const unsigned = Object.freeze({
        proofVersion: MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION,
        keyId: this.#keyId,
        nonce,
        issuedAtMs,
        expiresAtMs,
      });
      const signature = signCanonicalPayload(this.#key, identity, binding, unsigned);
      return Object.freeze({ ...unsigned, signature });
    } catch (error) {
      throw publicOperationError(error);
    }
  }

  async verify(
    request: ManagedLocalClientPopVerifyRequest,
  ): Promise<ManagedLocalClientPopVerification> {
    this.#assertOpen();
    try {
      assertExactRecord(
        request,
        ["expectedIdentity", "request", "proof"],
        requestError,
      );
      const identity = normalizeIdentity(request.expectedIdentity);
      const binding = normalizeRequestBinding(request.request);
      const proof = normalizeProof(request.proof);
      const unsigned: UnsignedProof = Object.freeze({
        proofVersion: proof.proofVersion,
        keyId: proof.keyId,
        nonce: proof.nonce,
        issuedAtMs: proof.issuedAtMs,
        expiresAtMs: proof.expiresAtMs,
      });
      const expectedSignature = signCanonicalPayload(
        this.#key,
        identity,
        binding,
        unsigned,
      );
      const signatureValid = constantTimeHexEqual(
        expectedSignature,
        proof.signature,
      );
      if (!signatureValid || proof.keyId !== this.#keyId) throw proofInvalid();

      const durationMs = proof.expiresAtMs - proof.issuedAtMs;
      if (durationMs !== this.#proofTtlMs) throw proofInvalid();
      const nowMs = readNow(this.#now);
      if (proof.issuedAtMs > safeAdd(nowMs, this.#maxClockSkewMs)) {
        throw popError(
          "LOCAL_CLIENT_POP_PROOF_NOT_YET_VALID",
          "The local-client proof is not yet valid.",
          "auth",
          401,
        );
      }
      if (proof.expiresAtMs <= nowMs) {
        throw popError(
          "LOCAL_CLIENT_POP_PROOF_EXPIRED",
          "The local-client proof has expired.",
          "auth",
          401,
        );
      }

      const replayResult = await consumeReplayGuard(this.#replayGuard, {
        replayKeySha256: replayKeySha256(proof.keyId, proof.nonce),
        replayScopeSha256: this.#replayScopeSha256,
        expiresAtMs: proof.expiresAtMs,
        nowMs,
      });
      if (replayResult === "replayed") {
        throw popError(
          "LOCAL_CLIENT_POP_NONCE_REPLAYED",
          "The local-client proof nonce has already been consumed.",
          "conflict",
          409,
        );
      }
      if (replayResult !== "consumed") throw replayGuardUnavailable();

      return Object.freeze({
        verified: true as const,
        identity,
        proofFingerprint: proofFingerprint(proof),
        issuedAtMs: proof.issuedAtMs,
        expiresAtMs: proof.expiresAtMs,
      });
    } catch (error) {
      throw publicOperationError(error);
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#key.fill(0);
    try {
      await this.#replayGuard.close?.();
    } catch {
      // The authority remains closed and its key remains wiped, but shutdown
      // must observe that the owned replay resource did not close cleanly.
      throw Object.assign(new Error("The local-client PoP replay guard failed to close."), {
        code: "LOCAL_CLIENT_POP_REPLAY_CLOSE_FAILED",
      });
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw popError(
        "LOCAL_CLIENT_POP_CLOSED",
        "The local-client proof authority is closed.",
        "availability",
        503,
      );
    }
  }
}

export function createManagedLocalClientPopIdentityAuthority(
  options: ManagedLocalClientPopAuthorityOptions,
): ManagedLocalClientPopIdentityAuthority {
  return new ManagedLocalClientPopIdentityAuthority(options);
}

export function deriveManagedLocalClientPopKey(
  raw: ManagedLocalClientPopKeyDerivationInput,
): ManagedLocalClientPopDerivedKey {
  try {
    assertExactRecord(raw, ["sharedSecret", "tenantId", "clientId"], configurationError);
    if (
      !Buffer.isBuffer(raw.sharedSecret)
      || raw.sharedSecret.length < MIN_KEY_BYTES
      || raw.sharedSecret.length > MAX_KEY_BYTES
    ) throw configurationError();
    const tenantId = strictIdentifier(raw.tenantId, OPAQUE_IDENTITY_PATTERN, configurationError);
    const clientId = strictIdentifier(raw.clientId, CLIENT_ID_PATTERN, configurationError);
    const context = `${tenantId}\0${clientId}`;
    const key = createHmac("sha256", raw.sharedSecret)
      .update("managed-local-client-pop-derived-key-v1\0", "utf8")
      .update(context, "utf8")
      .digest();
    const keyId = `lcpop-${createHmac("sha256", raw.sharedSecret)
      .update("managed-local-client-pop-key-id-v1\0", "utf8")
      .update(context, "utf8")
      .digest("hex")
      .slice(0, 24)}`;
    return Object.freeze({ key, keyId });
  } catch (error) {
    if (error instanceof LocalClientPopAuthorityError) throw error;
    throw configurationError();
  }
}

function normalizeOptions(raw: ManagedLocalClientPopAuthorityOptions): NormalizedOptions {
  let sourceKey: Buffer | null = null;
  let privateKey: Buffer | null = null;
  try {
    sourceKey = extractBufferDataProperty(raw, "key");
    assertExactRecord(raw, [
      "key",
      "keyId",
      "proofTtlMs",
      "maxClockSkewMs",
      "maxReplayEntries",
      "replayGuard",
      "now",
      "nonceFactory",
    ], configurationError, true);
    if (
      sourceKey === null
      || sourceKey.length < MIN_KEY_BYTES
      || sourceKey.length > MAX_KEY_BYTES
    ) throw configurationError();
    privateKey = Buffer.from(sourceKey);
    const keyId = strictIdentifier(raw.keyId, KEY_ID_PATTERN, configurationError);
    const proofTtlMs = boundedInteger(
      raw.proofTtlMs,
      DEFAULT_PROOF_TTL_MS,
      MIN_PROOF_TTL_MS,
      MAX_PROOF_TTL_MS,
      configurationError,
    );
    const maxClockSkewMs = boundedInteger(
      raw.maxClockSkewMs,
      DEFAULT_MAX_CLOCK_SKEW_MS,
      0,
      MAX_CLOCK_SKEW_MS,
      configurationError,
    );
    const maxReplayEntries = boundedInteger(
      raw.maxReplayEntries,
      DEFAULT_MAX_REPLAY_ENTRIES,
      1,
      MAX_REPLAY_ENTRIES,
      configurationError,
    );
    if (raw.now !== undefined && typeof raw.now !== "function") {
      throw configurationError();
    }
    if (raw.nonceFactory !== undefined && typeof raw.nonceFactory !== "function") {
      throw configurationError();
    }
    const replayGuard = raw.replayGuard
      ?? new InMemoryManagedLocalClientPopReplayGuard(maxReplayEntries);
    assertReplayGuard(replayGuard);
    const normalized = Object.freeze({
      key: privateKey,
      keyId,
      proofTtlMs,
      maxClockSkewMs,
      replayGuard,
      now: raw.now ?? Date.now,
      nonceFactory: raw.nonceFactory ?? (() => randomBytes(NONCE_BYTES)),
    });
    privateKey = null;
    return normalized;
  } catch {
    privateKey?.fill(0);
    throw configurationError();
  } finally {
    sourceKey?.fill(0);
  }
}

function assertReplayGuard(value: ManagedLocalClientPopReplayGuard): void {
  if (
    value === null
    || typeof value !== "object"
    || typeof value.consumeOnce !== "function"
  ) {
    throw configurationError();
  }
  const status = cloneReplayGuardStatus(value.status);
  if (!status.available) throw configurationError();
}

function cloneReplayGuardStatus(
  value: ManagedLocalClientPopReplayGuardStatus,
): ManagedLocalClientPopReplayGuardStatus {
  if (!isPlainDataRecord(value)) throw configurationError();
  const allowedKeys = new Set([
    "available",
    "durable",
    "distributed",
    "mode",
    "authenticatedReplaySet",
    "snapshotRollbackProtected",
    "defensiveEnabled",
    "capacityIsolatedByScope",
    "maxEntries",
    "maxEntriesPerScope",
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) throw configurationError();
  if (
    typeof value.available !== "boolean"
    || typeof value.durable !== "boolean"
    || typeof value.distributed !== "boolean"
    || typeof value.mode !== "string"
    || value.mode.length < 1
    || value.mode.length > 64
  ) throw configurationError();
  for (const key of [
    "authenticatedReplaySet",
    "snapshotRollbackProtected",
    "defensiveEnabled",
    "capacityIsolatedByScope",
  ] as const) {
    if (Object.hasOwn(value, key) && typeof value[key] !== "boolean") throw configurationError();
  }
  for (const key of ["maxEntries", "maxEntriesPerScope"] as const) {
    if (
      Object.hasOwn(value, key)
      && (!Number.isSafeInteger(value[key]) || Number(value[key]) < 1)
    ) throw configurationError();
  }
  return Object.freeze({
    available: value.available,
    durable: value.durable,
    distributed: value.distributed,
    mode: value.mode,
    ...(Object.hasOwn(value, "authenticatedReplaySet")
      ? { authenticatedReplaySet: value.authenticatedReplaySet }
      : {}),
    ...(Object.hasOwn(value, "snapshotRollbackProtected")
      ? { snapshotRollbackProtected: value.snapshotRollbackProtected }
      : {}),
    ...(Object.hasOwn(value, "defensiveEnabled")
      ? { defensiveEnabled: value.defensiveEnabled }
      : {}),
    ...(Object.hasOwn(value, "capacityIsolatedByScope")
      ? { capacityIsolatedByScope: value.capacityIsolatedByScope }
      : {}),
    ...(Object.hasOwn(value, "maxEntries") ? { maxEntries: value.maxEntries } : {}),
    ...(Object.hasOwn(value, "maxEntriesPerScope")
      ? { maxEntriesPerScope: value.maxEntriesPerScope }
      : {}),
  });
}

function normalizeIdentity(raw: ManagedLocalClientPopIdentity): ManagedLocalClientPopIdentity {
  assertExactRecord(
    raw,
    ["tenantId", "subjectId", "clientId", "clientRevision"],
    requestError,
  );
  return Object.freeze({
    tenantId: strictIdentifier(raw.tenantId, OPAQUE_IDENTITY_PATTERN, requestError),
    subjectId: strictIdentifier(raw.subjectId, OPAQUE_IDENTITY_PATTERN, requestError),
    clientId: strictIdentifier(raw.clientId, CLIENT_ID_PATTERN, requestError),
    clientRevision: positiveSafeInteger(raw.clientRevision, requestError),
  });
}

function normalizeRequestBinding(
  raw: ManagedLocalClientPopRequestBinding,
): CanonicalRequestBinding {
  assertExactRecord(raw, ["method", "path", "body"], requestError);
  if (typeof raw.method !== "string" || !METHOD_PATTERN.test(raw.method)) {
    throw requestError();
  }
  const path = canonicalPath(raw.path);
  if (!(raw.body instanceof Uint8Array) || raw.body.byteLength > MAX_BODY_BYTES) {
    throw requestError();
  }
  return Object.freeze({
    method: raw.method,
    path,
    bodySha256: createHash("sha256").update(raw.body).digest("hex"),
  });
}

function normalizeProof(raw: ManagedLocalClientPopProof): ManagedLocalClientPopProof {
  assertExactRecord(raw, [
    "proofVersion",
    "keyId",
    "nonce",
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ], proofInvalid);
  if (
    raw.proofVersion !== MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION
    || typeof raw.keyId !== "string"
    || !KEY_ID_PATTERN.test(raw.keyId)
    || typeof raw.nonce !== "string"
    || !NONCE_PATTERN.test(raw.nonce)
    || !isPositiveSafeInteger(raw.issuedAtMs)
    || !isPositiveSafeInteger(raw.expiresAtMs)
    || raw.expiresAtMs <= raw.issuedAtMs
    || typeof raw.signature !== "string"
  ) throw proofInvalid();
  return Object.freeze({
    proofVersion: raw.proofVersion,
    keyId: raw.keyId,
    nonce: raw.nonce,
    issuedAtMs: raw.issuedAtMs,
    expiresAtMs: raw.expiresAtMs,
    signature: raw.signature,
  });
}

function canonicalPath(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || value.includes("#")
    || /[\s\u0000-\u001f\u007f]/u.test(value)
  ) throw requestError();
  try {
    const parsed = new URL(value, "http://local-client.invalid");
    if (
      parsed.origin !== "http://local-client.invalid"
      || `${parsed.pathname}${parsed.search}` !== value
    ) throw requestError();
  } catch (error) {
    if (error instanceof LocalClientPopAuthorityError) throw error;
    throw requestError();
  }
  return value;
}

function signCanonicalPayload(
  key: Buffer,
  identity: ManagedLocalClientPopIdentity,
  request: CanonicalRequestBinding,
  proof: UnsignedProof,
): string {
  const payload = {
    canonicalVersion: MANAGED_LOCAL_CLIENT_POP_CANONICAL_VERSION,
    proofVersion: proof.proofVersion,
    keyId: proof.keyId,
    tenantId: identity.tenantId,
    subjectId: identity.subjectId,
    clientId: identity.clientId,
    clientRevision: identity.clientRevision,
    method: request.method,
    path: request.path,
    bodySha256: request.bodySha256,
    nonce: proof.nonce,
    issuedAtMs: proof.issuedAtMs,
    expiresAtMs: proof.expiresAtMs,
  };
  return createHmac("sha256", key)
    .update(canonicalJson(payload), "utf8")
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw authorityUnavailable();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!isPlainDataRecord(value)) throw authorityUnavailable();
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(",")}}`;
}

function constantTimeHexEqual(expectedHex: string, suppliedHex: string): boolean {
  const syntaxValid = SIGNATURE_PATTERN.test(suppliedHex);
  const expected = Buffer.from(expectedHex, "hex");
  const supplied = syntaxValid
    ? Buffer.from(suppliedHex, "hex")
    : Buffer.alloc(expected.length);
  let equal = false;
  try {
    equal = timingSafeEqual(expected, supplied);
  } finally {
    expected.fill(0);
    supplied.fill(0);
  }
  return syntaxValid && equal;
}

async function consumeReplayGuard(
  replayGuard: ManagedLocalClientPopReplayGuard,
  input: ManagedLocalClientPopReplayConsumeInput,
): Promise<"consumed" | "replayed" | "capacity"> {
  try {
    const result = await Reflect.apply(replayGuard.consumeOnce, undefined, [
      Object.freeze({ ...input }),
    ]);
    if (!["consumed", "replayed", "capacity"].includes(result)) {
      throw replayGuardUnavailable();
    }
    return result;
  } catch (error) {
    if (error instanceof LocalClientPopAuthorityError) throw error;
    throw replayGuardUnavailable();
  }
}

function createNonce(factory: () => Buffer): string {
  let raw: Buffer | null = null;
  try {
    raw = factory();
    if (!Buffer.isBuffer(raw) || raw.length !== NONCE_BYTES) {
      throw nonceGenerationFailed();
    }
    const nonce = raw.toString("base64url");
    if (!NONCE_PATTERN.test(nonce)) throw nonceGenerationFailed();
    return nonce;
  } catch (error) {
    if (error instanceof LocalClientPopAuthorityError) throw error;
    throw nonceGenerationFailed();
  } finally {
    raw?.fill(0);
  }
}

function replayKeySha256(keyId: string, nonce: string): string {
  const digest = createHash("sha256")
    .update("managed-local-client-pop-replay-v1\0", "utf8")
    .update(keyId, "utf8")
    .update("\0", "utf8")
    .update(nonce, "utf8")
    .digest("hex");
  if (!SHA256_PATTERN.test(digest)) throw authorityUnavailable();
  return digest;
}

function replayScopeSha256(keyId: string): string {
  return createHash("sha256")
    .update("managed-local-client-pop-replay-scope-v1\0", "utf8")
    .update(keyId, "utf8")
    .digest("hex");
}

function proofFingerprint(proof: ManagedLocalClientPopProof): string {
  return createHash("sha256")
    .update("managed-local-client-pop-proof-fingerprint-v1\0", "utf8")
    .update(proof.keyId, "utf8")
    .update("\0", "utf8")
    .update(proof.nonce, "utf8")
    .update("\0", "utf8")
    .update(proof.signature, "utf8")
    .digest("hex");
}

function readNow(clock: () => number): number {
  let value: unknown;
  try {
    value = clock();
  } catch {
    throw authorityUnavailable();
  }
  if (!isPositiveSafeInteger(value)) throw authorityUnavailable();
  return value;
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result <= 0) throw authorityUnavailable();
  return result;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  onError: () => LocalClientPopAuthorityError,
): number {
  const normalized = value === undefined ? fallback : value;
  if (
    typeof normalized !== "number"
    || !Number.isSafeInteger(normalized)
    || normalized < minimum
    || normalized > maximum
  ) throw onError();
  return normalized;
}

function positiveSafeInteger(
  value: unknown,
  onError: () => LocalClientPopAuthorityError,
): number {
  if (!isPositiveSafeInteger(value)) throw onError();
  return value;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function strictIdentifier(
  value: unknown,
  pattern: RegExp,
  onError: () => LocalClientPopAuthorityError,
): string {
  if (typeof value !== "string" || !pattern.test(value)) throw onError();
  return value;
}

function assertExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  onError: () => LocalClientPopAuthorityError,
  optionalKeys = false,
): asserts value is Record<string, unknown> {
  if (!isPlainDataRecord(value)) throw onError();
  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    throw onError();
  }
  if (!optionalKeys && allowedKeys.some((key) => !Object.hasOwn(value, key))) {
    throw onError();
  }
  if (
    optionalKeys
    && (!Object.hasOwn(value, "key") || !Object.hasOwn(value, "keyId"))
  ) {
    throw onError();
  }
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => Object.hasOwn(descriptor, "value")
      && descriptor.get === undefined
      && descriptor.set === undefined,
  );
}

function extractBufferDataProperty(value: unknown, key: string): Buffer | null {
  if (value === null || typeof value !== "object") return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") && Buffer.isBuffer(descriptor.value)
    ? descriptor.value
    : null;
}

function publicOperationError(error: unknown): LocalClientPopAuthorityError {
  return error instanceof LocalClientPopAuthorityError
    ? error
    : authorityUnavailable();
}

function popError(
  code: LocalClientPopErrorCode,
  message: string,
  category: LocalClientPopAuthorityError["category"],
  statusCode: number,
  retryable = false,
): LocalClientPopAuthorityError {
  return new LocalClientPopAuthorityError(
    code,
    message,
    category,
    statusCode,
    retryable,
  );
}

function configurationError(): LocalClientPopAuthorityError {
  return popError(
    "LOCAL_CLIENT_POP_CONFIGURATION_INVALID",
    "The local-client proof authority configuration is invalid.",
    "configuration",
    503,
  );
}

function requestError(): LocalClientPopAuthorityError {
  return popError(
    "LOCAL_CLIENT_POP_REQUEST_INVALID",
    "The local-client proof request is invalid.",
    "validation",
    400,
  );
}

function proofInvalid(): LocalClientPopAuthorityError {
  return popError(
    "LOCAL_CLIENT_POP_PROOF_INVALID",
    "The local-client proof is invalid.",
    "auth",
    401,
  );
}

function replayGuardUnavailable(): LocalClientPopAuthorityError {
  return popError(
    "LOCAL_CLIENT_POP_REPLAY_GUARD_UNAVAILABLE",
    "The local-client proof replay guard is unavailable.",
    "availability",
    503,
    true,
  );
}

function nonceGenerationFailed(): LocalClientPopAuthorityError {
  return popError(
    "LOCAL_CLIENT_POP_NONCE_GENERATION_FAILED",
    "The local-client proof nonce could not be generated safely.",
    "availability",
    503,
  );
}

function authorityUnavailable(): LocalClientPopAuthorityError {
  return popError(
    "LOCAL_CLIENT_POP_AUTHORITY_UNAVAILABLE",
    "The local-client proof authority is unavailable.",
    "availability",
    503,
  );
}
