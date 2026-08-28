import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  LocalClientExecutionFence,
  LocalClientExecutionIdentity,
} from "./localClientExecutionOrchestrator.ts";

export const LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION = 1 as const;
export const LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_BOUNDARIES = Object.freeze({
  mode: "sqlite-fenced" as const,
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  exclusiveClaim: true as const,
  monotonicFencing: true as const,
  rawOwnershipTokenPersisted: false as const,
  rawIdentityPersisted: false as const,
  clockRollbackPolicy: "fail-closed" as const,
});

export interface LocalClientSqliteExecutionClaimStoreOptions {
  readonly sqlitePath: string;
  /** Stable, host-unique identifier. Only its SHA-256 binding is persisted. */
  readonly hostId: string;
  readonly namespace?: string;
  readonly ttlMs?: number;
  readonly maxClaims?: number;
  readonly busyTimeoutMs?: number;
  readonly now?: () => number;
}

export interface LocalClientExecutionClaimIdentity extends LocalClientExecutionIdentity {
  readonly executionId: string;
  readonly planId: string;
  readonly fencingToken?: string;
}

export interface LocalClientExecutionClaimIssueRequest extends LocalClientExecutionClaimIdentity {
  readonly ttlMs?: number;
}

export type LocalClientExecutionClaimRecord = Readonly<{
  claimFingerprint: string;
  executionFingerprint: string;
  planFingerprint: string;
  tenantFingerprint: string;
  subjectFingerprint: string;
  tokenFingerprint: string;
  fenceFingerprint: string;
  fencingToken: string;
  status: "active";
  issuedAt: string;
  expiresAt: string;
  renewalCount: number;
}>;

export type LocalClientExecutionClaimFailure = Readonly<{
  success: false;
  valid: false;
  code:
    | "LOCAL_CLIENT_EXECUTION_CLAIM_TOKEN_INVALID"
    | "LOCAL_CLIENT_EXECUTION_CLAIM_NOT_FOUND"
    | "LOCAL_CLIENT_EXECUTION_CLAIM_EXPIRED"
    | "LOCAL_CLIENT_EXECUTION_CLAIM_ALREADY_HELD"
    | "LOCAL_CLIENT_EXECUTION_CLAIM_IDENTITY_MISMATCH"
    | "LOCAL_CLIENT_EXECUTION_CLAIM_FENCE_MISMATCH"
    | "LOCAL_CLIENT_EXECUTION_CLAIM_CAPACITY";
  reason: string;
  retryable: boolean;
  record?: LocalClientExecutionClaimRecord;
}>;

export type LocalClientExecutionClaimIssueSuccess = Readonly<{
  success: true;
  valid: true;
  code: "LOCAL_CLIENT_EXECUTION_CLAIM_ISSUED";
  token: string;
  fencingToken: string;
  expiresAt: string;
  record: LocalClientExecutionClaimRecord;
}>;

export type LocalClientExecutionClaimValidationSuccess = Readonly<{
  success: true;
  valid: true;
  code: "LOCAL_CLIENT_EXECUTION_CLAIM_VALID";
  record: LocalClientExecutionClaimRecord;
}>;

export type LocalClientExecutionClaimRenewSuccess = Readonly<{
  success: true;
  valid: true;
  code: "LOCAL_CLIENT_EXECUTION_CLAIM_RENEWED";
  previousExpiresAt: string;
  expiresAt: string;
  renewalCount: number;
  record: LocalClientExecutionClaimRecord;
}>;

export type LocalClientExecutionClaimReleaseSuccess = Readonly<{
  success: true;
  valid: true;
  code: "LOCAL_CLIENT_EXECUTION_CLAIM_RELEASED";
  record: LocalClientExecutionClaimRecord;
}>;

export type LocalClientExecutionClaimValidation =
  | LocalClientExecutionClaimFailure
  | LocalClientExecutionClaimValidationSuccess;

export type LocalClientSqliteExecutionClaimStoreErrorCode =
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_HOST_MISMATCH"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CLOSED"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_STORE_UNAVAILABLE"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CLOCK_INVALID"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_INTEGRITY_INVALID"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_NOT_ACTIVE"
  | "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_ABORTED";

export class LocalClientSqliteExecutionClaimStoreError extends Error {
  readonly code: LocalClientSqliteExecutionClaimStoreErrorCode;
  readonly category: "configuration" | "persistence" | "concurrency" | "integrity" | "cancellation";
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly reasonCode?: LocalClientExecutionClaimFailure["code"];

  constructor(
    code: LocalClientSqliteExecutionClaimStoreErrorCode,
    message: string,
    category: LocalClientSqliteExecutionClaimStoreError["category"],
    statusCode: number,
    retryable = false,
    reasonCode?: LocalClientExecutionClaimFailure["code"],
  ) {
    super(message);
    this.name = "LocalClientSqliteExecutionClaimStoreError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.reasonCode = reasonCode;
  }
}

type MetadataRow = {
  schema_version: number;
  host_binding_sha256: string;
  namespace_sha256: string;
  ttl_ms: number;
  max_claims: number;
  busy_timeout_ms: number;
  last_observed_at_ms: number;
  last_fencing_token: string;
  metadata_digest: string;
};

type ClaimRow = {
  record_version: number;
  claim_key_sha256: string;
  execution_sha256: string;
  plan_sha256: string;
  tenant_sha256: string;
  subject_sha256: string;
  token_digest: string;
  token_fingerprint: string;
  fence_fingerprint: string;
  fencing_token: string;
  issued_at_ms: number;
  expires_at_ms: number;
  renewal_count: number;
  record_digest: string;
};

type NormalizedIdentity = Readonly<{
  executionId: string;
  planId: string;
  tenantId: string;
  subjectId: string;
  claimKeySha256: string;
  executionSha256: string;
  planSha256: string;
  tenantSha256: string;
  subjectSha256: string;
  fencingToken?: string;
}>;

type ResolvedClaim = Readonly<{
  row: ClaimRow;
  publicRecord: LocalClientExecutionClaimRecord;
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 1;
const DEFAULT_NAMESPACE = "local-client-execution";
const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_CLAIMS = 2_000;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MIN_TTL_MS = 10;
const MAX_TTL_MS = 24 * 60 * 60_000;
const MAX_CLAIMS = 100_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_NAMESPACE_LENGTH = 128;
const MAX_ID_LENGTH = 256;
const MAX_TOKEN_LENGTH = 512;
const MAX_DATE_MS = 8_640_000_000_000_000;
const MAX_FENCING_TOKEN = 9_223_372_036_854_775_807n;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;

/**
 * Durable, process-safe fenced ownership for local-client execution on one host.
 * Rows retain no raw bearer token and no raw execution, tenant, or subject ID.
 */
export class LocalClientSqliteExecutionClaimStore {
  readonly #db!: DatabaseSync;
  readonly #sqlitePath: string;
  readonly #hostBindingSha256: string;
  readonly #namespaceSha256: string;
  readonly #ttlMs: number;
  readonly #maxClaims: number;
  readonly #busyTimeoutMs: number;
  readonly #now: () => number;
  #closed = false;

  constructor(options: LocalClientSqliteExecutionClaimStoreOptions) {
    assertOptions(options);
    this.#sqlitePath = resolveSqlitePath(options.sqlitePath);
    this.#hostBindingSha256 = sha256(assertHostId(options.hostId));
    this.#namespaceSha256 = sha256(assertNamespace(options.namespace ?? DEFAULT_NAMESPACE));
    this.#ttlMs = boundedInteger(options.ttlMs, DEFAULT_TTL_MS, MIN_TTL_MS, MAX_TTL_MS);
    this.#maxClaims = boundedInteger(options.maxClaims, DEFAULT_MAX_CLAIMS, 1, MAX_CLAIMS);
    this.#busyTimeoutMs = boundedInteger(
      options.busyTimeoutMs,
      DEFAULT_BUSY_TIMEOUT_MS,
      100,
      MAX_BUSY_TIMEOUT_MS,
    );
    if (options.now !== undefined && typeof options.now !== "function") throw configurationError();
    this.#now = options.now ?? Date.now;

    mkdirSync(dirname(this.#sqlitePath), { recursive: true, mode: 0o700 });
    try { chmodSync(dirname(this.#sqlitePath), 0o700); } catch { /* Windows may not expose POSIX modes. */ }
    try {
      this.#db = new DatabaseSync(this.#sqlitePath);
      this.#db.exec(`PRAGMA busy_timeout = ${this.#busyTimeoutMs}`);
      const journal = this.#db.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: unknown } | undefined;
      if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") throw schemaError();
      this.#db.exec("PRAGMA synchronous = FULL");
      const synchronous = this.#db.prepare("PRAGMA synchronous").get() as { synchronous?: unknown } | undefined;
      if (Number(synchronous?.synchronous) !== 2) throw schemaError();
      this.#db.exec("PRAGMA trusted_schema = OFF");
      this.#db.exec("PRAGMA foreign_keys = ON");
      this.#initializeSchema();
      (this.#db as DatabaseSync & { enableDefensive?: (enabled: boolean) => void })
        .enableDefensive?.(true);
      this.#assertDatabaseHealthy();
      this.#scanPersistedRecords();
      try { chmodSync(this.#sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve initialization error. */ }
      if (isKnownError(error)) throw error;
      throw storeUnavailableError();
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_BOUNDARIES,
      available: !this.#closed,
      schemaVersion: LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION,
      journalMode: "wal" as const,
      synchronous: "full" as const,
      ttlMs: this.#ttlMs,
      maxClaims: this.#maxClaims,
      busyTimeoutMs: this.#busyTimeoutMs,
    });
  }

  getStatus() {
    return this.status;
  }

  async issue(
    input: LocalClientExecutionClaimIssueRequest,
  ): Promise<LocalClientExecutionClaimIssueSuccess | LocalClientExecutionClaimFailure> {
    if (!isPlainRecord(input)) throw configurationError();
    assertExactKeys(input, ["executionId", "planId", "tenantId", "subjectId", "ttlMs"], true);
    const identity = normalizeIdentity({
      executionId: input.executionId,
      planId: input.planId,
      tenantId: input.tenantId,
      subjectId: input.subjectId,
    }, true);
    const ttlMs = boundedLeaseTtl(input?.ttlMs, this.#ttlMs);
    const token = randomBytes(32).toString("base64url");
    const tokenDigest = sha256(token);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeExpired(nowMs);
      const existing = this.#selectByClaimKey(identity.claimKeySha256);
      if (existing) {
        const resolved = this.#decodeRow(existing);
        return failed(
          "LOCAL_CLIENT_EXECUTION_CLAIM_ALREADY_HELD",
          "The execution and plan already have an active fenced claim.",
          true,
          resolved.publicRecord,
        );
      }
      if (this.#countClaims() >= this.#maxClaims) {
        return failed(
          "LOCAL_CLIENT_EXECUTION_CLAIM_CAPACITY",
          "The bounded local-client execution claim store is full.",
          true,
        );
      }

      const fencingToken = this.#allocateFencingToken();
      const row = createClaimRow({
        identity,
        tokenDigest,
        fencingToken,
        issuedAtMs: nowMs,
        expiresAtMs: createExpiry(nowMs, ttlMs),
        renewalCount: 0,
      });
      const inserted = this.#db.prepare(`
        INSERT INTO local_client_execution_claims (
          record_version, claim_key_sha256, execution_sha256, plan_sha256,
          tenant_sha256, subject_sha256, token_digest, token_fingerprint,
          fence_fingerprint, fencing_token, issued_at_ms, expires_at_ms,
          renewal_count, record_digest
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.record_version,
        row.claim_key_sha256,
        row.execution_sha256,
        row.plan_sha256,
        row.tenant_sha256,
        row.subject_sha256,
        row.token_digest,
        row.token_fingerprint,
        row.fence_fingerprint,
        row.fencing_token,
        row.issued_at_ms,
        row.expires_at_ms,
        row.renewal_count,
        row.record_digest,
      );
      if (Number(inserted.changes) !== 1) throw integrityError();
      const record = toPublicRecord(row);
      return Object.freeze({
        success: true as const,
        valid: true as const,
        code: "LOCAL_CLIENT_EXECUTION_CLAIM_ISSUED" as const,
        token,
        fencingToken,
        expiresAt: record.expiresAt,
        record,
      });
    });
  }

  async validate(
    token: unknown,
    context: Partial<LocalClientExecutionClaimIdentity> = {},
  ): Promise<LocalClientExecutionClaimValidation> {
    const tokenDigest = normalizeTokenDigest(token);
    if (!tokenDigest) return invalidTokenFailure();
    const normalizedContext = normalizePartialIdentity(context);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const resolved = this.#resolveClaim(tokenDigest, normalizedContext, nowMs);
      if (isFailure(resolved)) return resolved;
      return Object.freeze({
        success: true as const,
        valid: true as const,
        code: "LOCAL_CLIENT_EXECUTION_CLAIM_VALID" as const,
        record: resolved.publicRecord,
      });
    });
  }

  async assertActive(
    token: unknown,
    context: Partial<LocalClientExecutionClaimIdentity> = {},
  ): Promise<LocalClientExecutionClaimRecord> {
    const result = await this.validate(token, context);
    if (!result.success) throw notActiveError(result);
    return result.record;
  }

  async renew(
    token: unknown,
    context: Partial<LocalClientExecutionClaimIdentity> = {},
    extendMs?: number,
  ): Promise<LocalClientExecutionClaimRenewSuccess | LocalClientExecutionClaimFailure> {
    const tokenDigest = normalizeTokenDigest(token);
    if (!tokenDigest) return invalidTokenFailure();
    const normalizedContext = normalizePartialIdentity(context);
    const ttlMs = boundedLeaseTtl(extendMs, this.#ttlMs);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const resolved = this.#resolveClaim(tokenDigest, normalizedContext, nowMs);
      if (isFailure(resolved)) return resolved;
      const previous = resolved.row;
      const updated = createClaimRowFromPersisted({
        ...previous,
        expires_at_ms: createExpiry(nowMs, ttlMs),
        renewal_count: previous.renewal_count + 1,
      });
      const result = this.#db.prepare(`
        UPDATE local_client_execution_claims
        SET expires_at_ms = ?, renewal_count = ?, record_digest = ?
        WHERE claim_key_sha256 = ? AND token_digest = ?
          AND fencing_token = ? AND record_digest = ?
      `).run(
        updated.expires_at_ms,
        updated.renewal_count,
        updated.record_digest,
        previous.claim_key_sha256,
        previous.token_digest,
        previous.fencing_token,
        previous.record_digest,
      );
      if (Number(result.changes) !== 1) throw integrityError();
      const record = toPublicRecord(updated);
      return Object.freeze({
        success: true as const,
        valid: true as const,
        code: "LOCAL_CLIENT_EXECUTION_CLAIM_RENEWED" as const,
        previousExpiresAt: toIso(previous.expires_at_ms),
        expiresAt: record.expiresAt,
        renewalCount: record.renewalCount,
        record,
      });
    });
  }

  async release(
    token: unknown,
    context: Partial<LocalClientExecutionClaimIdentity> = {},
  ): Promise<LocalClientExecutionClaimReleaseSuccess | LocalClientExecutionClaimFailure> {
    const tokenDigest = normalizeTokenDigest(token);
    if (!tokenDigest) return invalidTokenFailure();
    const normalizedContext = normalizePartialIdentity(context);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      const resolved = this.#resolveClaim(tokenDigest, normalizedContext, nowMs);
      if (isFailure(resolved)) return resolved;
      this.#deleteExactRow(resolved.row);
      return Object.freeze({
        success: true as const,
        valid: true as const,
        code: "LOCAL_CLIENT_EXECUTION_CLAIM_RELEASED" as const,
        record: resolved.publicRecord,
      });
    });
  }

  /** Bound adapter matching LocalClientExecutionOrchestratorDependencies.acquireFence. */
  readonly acquireFence = async (input: Readonly<{
    executionId: string;
    plan: Readonly<{ planId: string }>;
    identity: LocalClientExecutionIdentity;
    signal?: AbortSignal;
  }>): Promise<LocalClientExecutionFence> => {
    throwIfAborted(input?.signal);
    const identity = Object.freeze({
      executionId: input?.executionId,
      planId: input?.plan?.planId,
      tenantId: input?.identity?.tenantId,
      subjectId: input?.identity?.subjectId,
    });
    const issued = await this.issue(identity);
    if (!issued.success) throw notActiveError(issued);
    let token: string | null = issued.token;
    let released = false;
    if (input.signal?.aborted) {
      await this.release(token, { ...identity, fencingToken: issued.fencingToken });
      token = null;
      throw abortedError();
    }
    return Object.freeze({
      fingerprint: issued.record.fenceFingerprint,
      assertActive: async (_phase: "reserve" | "commit" | "dispatch") => {
        if (released || token === null) throw notActiveError(notFoundFailure());
        return this.assertActive(token, { ...identity, fencingToken: issued.fencingToken });
      },
      release: async () => {
        if (released || token === null) return;
        const activeToken = token;
        token = null;
        released = true;
        const result = await this.release(activeToken, {
          ...identity,
          fencingToken: issued.fencingToken,
        });
        if (!result.success && result.code !== "LOCAL_CLIENT_EXECUTION_CLAIM_NOT_FOUND") {
          throw notActiveError(result);
        }
      },
    });
  };

  async checkHealth() {
    const activeClaims = this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeExpired(nowMs);
      this.#assertDatabaseHealthy();
      this.#scanPersistedRecords();
      return this.#countClaims();
    });
    return Object.freeze({ ...this.status, activeClaims });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#db.close();
  }

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      const userVersion = readPragmaInteger(this.#db, "user_version");
      if (userVersion !== 0 && userVersion !== LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION) {
        throw schemaError();
      }
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_execution_claim_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          host_binding_sha256 TEXT NOT NULL,
          namespace_sha256 TEXT NOT NULL,
          ttl_ms INTEGER NOT NULL CHECK (ttl_ms > 0),
          max_claims INTEGER NOT NULL CHECK (max_claims > 0),
          busy_timeout_ms INTEGER NOT NULL CHECK (busy_timeout_ms > 0),
          last_observed_at_ms INTEGER NOT NULL CHECK (last_observed_at_ms >= 0),
          last_fencing_token TEXT NOT NULL,
          metadata_digest TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_execution_claims (
          record_version INTEGER NOT NULL,
          claim_key_sha256 TEXT PRIMARY KEY,
          execution_sha256 TEXT NOT NULL,
          plan_sha256 TEXT NOT NULL,
          tenant_sha256 TEXT NOT NULL,
          subject_sha256 TEXT NOT NULL,
          token_digest TEXT NOT NULL UNIQUE,
          token_fingerprint TEXT NOT NULL,
          fence_fingerprint TEXT NOT NULL,
          fencing_token TEXT NOT NULL UNIQUE,
          issued_at_ms INTEGER NOT NULL CHECK (issued_at_ms >= 0),
          expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > issued_at_ms),
          renewal_count INTEGER NOT NULL CHECK (renewal_count >= 0),
          record_digest TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_execution_claim_expiry_idx
          ON local_client_execution_claims (expires_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_execution_claim_plan_idx
          ON local_client_execution_claims (plan_sha256, expires_at_ms);
      `);
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        if (metadata || this.#countClaims() !== 0) throw schemaError();
        const initial = createMetadataRow({
          hostBindingSha256: this.#hostBindingSha256,
          namespaceSha256: this.#namespaceSha256,
          ttlMs: this.#ttlMs,
          maxClaims: this.#maxClaims,
          busyTimeoutMs: this.#busyTimeoutMs,
          lastObservedAtMs: 0,
          lastFencingToken: "0",
        });
        this.#db.prepare(`
          INSERT INTO local_client_execution_claim_metadata (
            singleton, schema_version, host_binding_sha256, namespace_sha256,
            ttl_ms, max_claims, busy_timeout_ms, last_observed_at_ms,
            last_fencing_token, metadata_digest
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.host_binding_sha256,
          initial.namespace_sha256,
          initial.ttl_ms,
          initial.max_claims,
          initial.busy_timeout_ms,
          initial.last_observed_at_ms,
          initial.last_fencing_token,
          initial.metadata_digest,
        );
        this.#db.exec(`PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION}`);
      } else {
        if (!metadata) throw schemaError();
        this.#assertMetadata(metadata);
      }
    });
  }

  #observeNow(): number {
    const nowMs = readClock(this.#now);
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    if (nowMs < metadata.last_observed_at_ms) throw clockError();
    const updated = createMetadataRow({
      hostBindingSha256: metadata.host_binding_sha256,
      namespaceSha256: metadata.namespace_sha256,
      ttlMs: metadata.ttl_ms,
      maxClaims: metadata.max_claims,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastObservedAtMs: nowMs,
      lastFencingToken: metadata.last_fencing_token,
    });
    this.#replaceMetadata(metadata, updated);
    return nowMs;
  }

  #allocateFencingToken(): string {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    const current = parseFencingToken(metadata.last_fencing_token, true);
    if (current >= MAX_FENCING_TOKEN) throw integrityError();
    const fencingToken = String(current + 1n);
    const updated = createMetadataRow({
      hostBindingSha256: metadata.host_binding_sha256,
      namespaceSha256: metadata.namespace_sha256,
      ttlMs: metadata.ttl_ms,
      maxClaims: metadata.max_claims,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastObservedAtMs: metadata.last_observed_at_ms,
      lastFencingToken: fencingToken,
    });
    this.#replaceMetadata(metadata, updated);
    return fencingToken;
  }

  #replaceMetadata(previous: MetadataRow, updated: MetadataRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_execution_claim_metadata
      SET last_observed_at_ms = ?, last_fencing_token = ?, metadata_digest = ?
      WHERE singleton = ? AND metadata_digest = ?
    `).run(
      updated.last_observed_at_ms,
      updated.last_fencing_token,
      updated.metadata_digest,
      METADATA_SINGLETON,
      previous.metadata_digest,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, host_binding_sha256, namespace_sha256, ttl_ms,
             max_claims, busy_timeout_ms, last_observed_at_ms,
             last_fencing_token, metadata_digest
      FROM local_client_execution_claim_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION
      || !SHA256_PATTERN.test(String(row.host_binding_sha256 ?? ""))
      || !SHA256_PATTERN.test(String(row.namespace_sha256 ?? ""))
      || !isSafePositiveInteger(row.ttl_ms)
      || !isSafePositiveInteger(row.max_claims)
      || !isSafePositiveInteger(row.busy_timeout_ms)
      || !isSafeNonNegativeInteger(row.last_observed_at_ms)
      || !isFencingToken(row.last_fencing_token, true)
      || !SHA256_PATTERN.test(String(row.metadata_digest ?? ""))
    ) {
      throw integrityError();
    }
    if (row.host_binding_sha256 !== this.#hostBindingSha256) throw hostMismatchError();
    if (
      row.namespace_sha256 !== this.#namespaceSha256
      || row.ttl_ms !== this.#ttlMs
      || row.max_claims !== this.#maxClaims
      || row.busy_timeout_ms !== this.#busyTimeoutMs
    ) {
      throw configurationError();
    }
    const expected = createMetadataRow({
      hostBindingSha256: row.host_binding_sha256,
      namespaceSha256: row.namespace_sha256,
      ttlMs: row.ttl_ms,
      maxClaims: row.max_claims,
      busyTimeoutMs: row.busy_timeout_ms,
      lastObservedAtMs: row.last_observed_at_ms,
      lastFencingToken: row.last_fencing_token,
    }).metadata_digest;
    if (!safeDigestEqual(row.metadata_digest, expected)) throw integrityError();
  }

  #selectByClaimKey(claimKeySha256: string): ClaimRow | undefined {
    return this.#db.prepare(`${selectClaimFields()} WHERE claim_key_sha256 = ?`)
      .get(claimKeySha256) as ClaimRow | undefined;
  }

  #selectByTokenDigest(tokenDigest: string): ClaimRow | undefined {
    return this.#db.prepare(`${selectClaimFields()} WHERE token_digest = ?`)
      .get(tokenDigest) as ClaimRow | undefined;
  }

  #resolveClaim(
    tokenDigest: string,
    context: Partial<NormalizedIdentity>,
    nowMs: number,
  ): ResolvedClaim | LocalClientExecutionClaimFailure {
    const row = this.#selectByTokenDigest(tokenDigest);
    if (!row) return notFoundFailure();
    const resolved = this.#decodeRow(row);
    if (!safeDigestEqual(row.token_digest, tokenDigest)) throw integrityError();
    if (nowMs >= row.expires_at_ms) {
      this.#deleteExactRow(row);
      return failed(
        "LOCAL_CLIENT_EXECUTION_CLAIM_EXPIRED",
        "The local-client execution claim expired and cannot authorize an effect.",
        false,
        resolved.publicRecord,
      );
    }
    if (
      (context.claimKeySha256 !== undefined && context.claimKeySha256 !== row.claim_key_sha256)
      || (context.executionSha256 !== undefined && context.executionSha256 !== row.execution_sha256)
      || (context.planSha256 !== undefined && context.planSha256 !== row.plan_sha256)
      || (context.tenantSha256 !== undefined && context.tenantSha256 !== row.tenant_sha256)
      || (context.subjectSha256 !== undefined && context.subjectSha256 !== row.subject_sha256)
    ) {
      return failed(
        "LOCAL_CLIENT_EXECUTION_CLAIM_IDENTITY_MISMATCH",
        "The claim is bound to a different local-client execution identity.",
        false,
      );
    }
    if (context.fencingToken !== undefined && context.fencingToken !== row.fencing_token) {
      return failed(
        "LOCAL_CLIENT_EXECUTION_CLAIM_FENCE_MISMATCH",
        "The local-client execution fencing token is stale.",
        false,
      );
    }
    return resolved;
  }

  #decodeRow(row: ClaimRow): ResolvedClaim {
    validateClaimRow(row);
    const expectedDigest = digestClaimRow({ ...row, record_digest: "" });
    if (!safeDigestEqual(row.record_digest, expectedDigest)) throw integrityError();
    const expectedFenceFingerprint = createFenceFingerprint(
      row.claim_key_sha256,
      row.token_digest,
      row.fencing_token,
    );
    if (
      row.token_fingerprint !== row.token_digest.slice(0, 16)
      || !safeDigestEqual(row.fence_fingerprint, expectedFenceFingerprint)
    ) {
      throw integrityError();
    }
    return Object.freeze({ row, publicRecord: toPublicRecord(row) });
  }

  #purgeExpired(nowMs: number): void {
    const rows = this.#db.prepare(`${selectClaimFields()} WHERE expires_at_ms <= ?`)
      .all(nowMs) as ClaimRow[];
    for (const row of rows) this.#decodeRow(row);
    if (rows.length > 0) {
      const result = this.#db.prepare(
        "DELETE FROM local_client_execution_claims WHERE expires_at_ms <= ?",
      ).run(nowMs);
      if (Number(result.changes) !== rows.length) throw integrityError();
    }
  }

  #deleteExactRow(row: ClaimRow): void {
    const result = this.#db.prepare(`
      DELETE FROM local_client_execution_claims
      WHERE claim_key_sha256 = ? AND token_digest = ?
        AND fencing_token = ? AND record_digest = ?
    `).run(row.claim_key_sha256, row.token_digest, row.fencing_token, row.record_digest);
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #countClaims(): number {
    const row = this.#db.prepare(
      "SELECT COUNT(*) AS count FROM local_client_execution_claims",
    ).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_CLAIMS) throw integrityError();
    return count;
  }

  #scanPersistedRecords(): void {
    const rows = this.#db.prepare(selectClaimFields()).all() as ClaimRow[];
    if (rows.length > this.#maxClaims) throw integrityError();
    for (const row of rows) this.#decodeRow(row);
  }

  #assertDatabaseHealthy(): void {
    const rows = this.#db.prepare("PRAGMA quick_check").all() as Array<Record<string, unknown>>;
    if (rows.length !== 1 || String(rows[0]?.quick_check ?? "").toLowerCase() !== "ok") {
      throw integrityError();
    }
    const metadata = this.#readMetadata();
    if (!metadata) throw schemaError();
    this.#assertMetadata(metadata);
  }

  #transaction<T>(operation: () => T): T {
    this.#assertOpen();
    try {
      return this.#rawTransaction(operation);
    } catch (error) {
      if (isKnownError(error)) throw error;
      throw storeUnavailableError();
    }
  }

  #rawTransaction<T>(operation: () => T): T {
    let began = false;
    try {
      this.#db.exec("BEGIN IMMEDIATE");
      began = true;
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      if (began) {
        try { this.#db.exec("ROLLBACK"); } catch { /* Preserve the original failure. */ }
      }
      throw error;
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw closedError();
  }
}

export function createLocalClientSqliteExecutionClaimStore(
  options: LocalClientSqliteExecutionClaimStoreOptions,
): LocalClientSqliteExecutionClaimStore {
  return new LocalClientSqliteExecutionClaimStore(options);
}

function createMetadataRow(input: {
  hostBindingSha256: string;
  namespaceSha256: string;
  ttlMs: number;
  maxClaims: number;
  busyTimeoutMs: number;
  lastObservedAtMs: number;
  lastFencingToken: string;
}): MetadataRow {
  const unsigned = {
    schemaVersion: LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION,
    hostBindingSha256: input.hostBindingSha256,
    namespaceSha256: input.namespaceSha256,
    ttlMs: input.ttlMs,
    maxClaims: input.maxClaims,
    busyTimeoutMs: input.busyTimeoutMs,
    lastObservedAtMs: input.lastObservedAtMs,
    lastFencingToken: input.lastFencingToken,
  };
  return {
    schema_version: LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_VERSION,
    host_binding_sha256: input.hostBindingSha256,
    namespace_sha256: input.namespaceSha256,
    ttl_ms: input.ttlMs,
    max_claims: input.maxClaims,
    busy_timeout_ms: input.busyTimeoutMs,
    last_observed_at_ms: input.lastObservedAtMs,
    last_fencing_token: input.lastFencingToken,
    metadata_digest: sha256(canonicalJson(unsigned)),
  };
}

function createClaimRow(input: {
  identity: NormalizedIdentity;
  tokenDigest: string;
  fencingToken: string;
  issuedAtMs: number;
  expiresAtMs: number;
  renewalCount: number;
}): ClaimRow {
  return createClaimRowFromPersisted({
    record_version: RECORD_VERSION,
    claim_key_sha256: input.identity.claimKeySha256,
    execution_sha256: input.identity.executionSha256,
    plan_sha256: input.identity.planSha256,
    tenant_sha256: input.identity.tenantSha256,
    subject_sha256: input.identity.subjectSha256,
    token_digest: input.tokenDigest,
    token_fingerprint: input.tokenDigest.slice(0, 16),
    fence_fingerprint: createFenceFingerprint(
      input.identity.claimKeySha256,
      input.tokenDigest,
      input.fencingToken,
    ),
    fencing_token: input.fencingToken,
    issued_at_ms: input.issuedAtMs,
    expires_at_ms: input.expiresAtMs,
    renewal_count: input.renewalCount,
    record_digest: "",
  });
}

function createClaimRowFromPersisted(row: ClaimRow): ClaimRow {
  const unsigned = { ...row, record_digest: "" };
  return { ...unsigned, record_digest: digestClaimRow(unsigned) };
}

function digestClaimRow(row: ClaimRow): string {
  return sha256(canonicalJson({
    recordVersion: row.record_version,
    claimKeySha256: row.claim_key_sha256,
    executionSha256: row.execution_sha256,
    planSha256: row.plan_sha256,
    tenantSha256: row.tenant_sha256,
    subjectSha256: row.subject_sha256,
    tokenDigest: row.token_digest,
    tokenFingerprint: row.token_fingerprint,
    fenceFingerprint: row.fence_fingerprint,
    fencingToken: row.fencing_token,
    issuedAtMs: row.issued_at_ms,
    expiresAtMs: row.expires_at_ms,
    renewalCount: row.renewal_count,
  }));
}

function createFenceFingerprint(claimKeySha256: string, tokenDigest: string, fencingToken: string): string {
  return sha256(canonicalJson({
    schema: "local-client-execution-fence-v1",
    claimKeySha256,
    tokenDigest,
    fencingToken,
  }));
}

function toPublicRecord(row: ClaimRow): LocalClientExecutionClaimRecord {
  return Object.freeze({
    claimFingerprint: row.claim_key_sha256.slice(0, 16),
    executionFingerprint: row.execution_sha256.slice(0, 16),
    planFingerprint: row.plan_sha256.slice(0, 16),
    tenantFingerprint: row.tenant_sha256.slice(0, 16),
    subjectFingerprint: row.subject_sha256.slice(0, 16),
    tokenFingerprint: row.token_fingerprint,
    fenceFingerprint: row.fence_fingerprint,
    fencingToken: row.fencing_token,
    status: "active" as const,
    issuedAt: toIso(row.issued_at_ms),
    expiresAt: toIso(row.expires_at_ms),
    renewalCount: row.renewal_count,
  });
}

function validateClaimRow(row: ClaimRow): void {
  if (
    row.record_version !== RECORD_VERSION
    || !SHA256_PATTERN.test(String(row.claim_key_sha256 ?? ""))
    || !SHA256_PATTERN.test(String(row.execution_sha256 ?? ""))
    || !SHA256_PATTERN.test(String(row.plan_sha256 ?? ""))
    || !SHA256_PATTERN.test(String(row.tenant_sha256 ?? ""))
    || !SHA256_PATTERN.test(String(row.subject_sha256 ?? ""))
    || !SHA256_PATTERN.test(String(row.token_digest ?? ""))
    || !/^[a-f0-9]{16}$/u.test(String(row.token_fingerprint ?? ""))
    || !SHA256_PATTERN.test(String(row.fence_fingerprint ?? ""))
    || !isFencingToken(row.fencing_token, false)
    || !isSafeNonNegativeInteger(row.issued_at_ms)
    || !isSafeNonNegativeInteger(row.expires_at_ms)
    || row.expires_at_ms <= row.issued_at_ms
    || !isSafeNonNegativeInteger(row.renewal_count)
    || !SHA256_PATTERN.test(String(row.record_digest ?? ""))
  ) {
    throw integrityError();
  }
}

function normalizeIdentity(
  input: Partial<LocalClientExecutionClaimIdentity>,
  requireAll: true,
): NormalizedIdentity;
function normalizeIdentity(
  input: Partial<LocalClientExecutionClaimIdentity>,
  requireAll: false,
): Partial<NormalizedIdentity>;
function normalizeIdentity(
  input: Partial<LocalClientExecutionClaimIdentity>,
  requireAll: boolean,
): NormalizedIdentity | Partial<NormalizedIdentity> {
  if (!isPlainRecord(input)) throw configurationError();
  assertExactKeys(input, ["executionId", "planId", "tenantId", "subjectId", "fencingToken"], true);
  const executionId = normalizeOptionalId(input.executionId, "executionId", requireAll);
  const planId = normalizeOptionalId(input.planId, "planId", requireAll);
  const tenantId = normalizeOptionalId(input.tenantId, "tenantId", requireAll);
  const subjectId = normalizeOptionalId(input.subjectId, "subjectId", requireAll);
  const fencingToken = input.fencingToken === undefined
    ? undefined
    : normalizeFencingToken(input.fencingToken);
  const executionSha256 = executionId === undefined ? undefined : sha256(executionId);
  const planSha256 = planId === undefined ? undefined : sha256(planId);
  const tenantSha256 = tenantId === undefined ? undefined : sha256(tenantId);
  const subjectSha256 = subjectId === undefined ? undefined : sha256(subjectId);
  const claimKeySha256 = executionId === undefined || planId === undefined
    ? undefined
    : sha256(canonicalJson({ executionId, planId }));
  const result = {
    ...(executionId === undefined ? {} : { executionId }),
    ...(planId === undefined ? {} : { planId }),
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(subjectId === undefined ? {} : { subjectId }),
    ...(claimKeySha256 === undefined ? {} : { claimKeySha256 }),
    ...(executionSha256 === undefined ? {} : { executionSha256 }),
    ...(planSha256 === undefined ? {} : { planSha256 }),
    ...(tenantSha256 === undefined ? {} : { tenantSha256 }),
    ...(subjectSha256 === undefined ? {} : { subjectSha256 }),
    ...(fencingToken === undefined ? {} : { fencingToken }),
  };
  if (requireAll && (
    executionId === undefined
    || planId === undefined
    || tenantId === undefined
    || subjectId === undefined
    || claimKeySha256 === undefined
  )) throw configurationError();
  return Object.freeze(result) as NormalizedIdentity | Partial<NormalizedIdentity>;
}

function normalizePartialIdentity(
  input: Partial<LocalClientExecutionClaimIdentity>,
): Partial<NormalizedIdentity> {
  return normalizeIdentity(input, false);
}

function normalizeOptionalId(value: unknown, _field: string, required: boolean): string | undefined {
  if (value === undefined && !required) return undefined;
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_ID_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw configurationError();
  }
  return value;
}

function normalizeFencingToken(value: unknown): string {
  const token = String(value ?? "");
  if (!isFencingToken(token, false)) throw configurationError();
  return token;
}

function normalizeTokenDigest(token: unknown): string | null {
  if (
    typeof token !== "string"
    || token.length < 1
    || token.length > MAX_TOKEN_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(token)
  ) return null;
  return sha256(token);
}

function boundedLeaseTtl(value: number | undefined, configuredTtlMs: number): number {
  if (value === undefined) return configuredTtlMs;
  if (!Number.isSafeInteger(value) || value < MIN_TTL_MS || value > configuredTtlMs) {
    throw configurationError();
  }
  return value;
}

function createExpiry(nowMs: number, ttlMs: number): number {
  const expiresAtMs = nowMs + ttlMs;
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs > MAX_DATE_MS) throw clockError();
  return expiresAtMs;
}

function assertOptions(options: LocalClientSqliteExecutionClaimStoreOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  assertExactKeys(options, [
    "sqlitePath",
    "hostId",
    "namespace",
    "ttlMs",
    "maxClaims",
    "busyTimeoutMs",
    "now",
  ], true);
  if (!Object.hasOwn(options, "sqlitePath") || !Object.hasOwn(options, "hostId")) {
    throw configurationError();
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  allowMissing: boolean,
): void {
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    throw configurationError();
  }
  if (!allowMissing && allowedKeys.some((key) => !Object.hasOwn(value, key))) {
    throw configurationError();
  }
}

function resolveSqlitePath(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_PATH_LENGTH
    || value !== value.trim()
    || value === ":memory:"
    || value.includes("\u0000")
    || value.startsWith("\\\\")
    || value.startsWith("//")
  ) {
    throw configurationError();
  }
  const absolute = resolve(value);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) throw configurationError();
  return absolute;
}

function assertHostId(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 8
    || value.length > MAX_HOST_ID_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw configurationError();
  return value;
}

function assertNamespace(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length > MAX_NAMESPACE_LENGTH
    || !NAMESPACE_PATTERN.test(value)
  ) throw configurationError();
  return value;
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configurationError();
  return resolved;
}

function readClock(now: () => number): number {
  let value: unknown;
  try { value = now(); } catch { throw clockError(); }
  if (!isSafeNonNegativeInteger(value) || value > MAX_DATE_MS) throw clockError();
  return value;
}

function readPragmaInteger(db: DatabaseSync, name: "user_version"): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value) || value < 0) throw schemaError();
  return value;
}

function selectClaimFields(): string {
  return `SELECT
    record_version, claim_key_sha256, execution_sha256, plan_sha256,
    tenant_sha256, subject_sha256, token_digest, token_fingerprint,
    fence_fingerprint, fencing_token, issued_at_ms, expires_at_ms,
    renewal_count, record_digest
    FROM local_client_execution_claims`;
}

function toIso(value: number): string {
  try { return new Date(value).toISOString(); } catch { throw integrityError(); }
}

function parseFencingToken(value: string, allowZero: boolean): bigint {
  if (!isFencingToken(value, allowZero)) throw integrityError();
  const parsed = BigInt(value);
  if (parsed > MAX_FENCING_TOKEN) throw integrityError();
  return parsed;
}

function isFencingToken(value: unknown, allowZero: boolean): value is string {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) return false;
  try {
    const parsed = BigInt(value);
    return parsed <= MAX_FENCING_TOKEN && (allowZero ? parsed >= 0n : parsed > 0n);
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeDigestEqual(left: string, right: string): boolean {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortedError();
}

function isFailure(
  value: ResolvedClaim | LocalClientExecutionClaimFailure,
): value is LocalClientExecutionClaimFailure {
  return "success" in value && value.success === false;
}

function failed(
  code: LocalClientExecutionClaimFailure["code"],
  reason: string,
  retryable: boolean,
  record?: LocalClientExecutionClaimRecord,
): LocalClientExecutionClaimFailure {
  return Object.freeze({
    success: false as const,
    valid: false as const,
    code,
    reason,
    retryable,
    ...(record ? { record } : {}),
  });
}

function invalidTokenFailure(): LocalClientExecutionClaimFailure {
  return failed(
    "LOCAL_CLIENT_EXECUTION_CLAIM_TOKEN_INVALID",
    "A bounded local-client execution ownership token is required.",
    false,
  );
}

function notFoundFailure(): LocalClientExecutionClaimFailure {
  return failed(
    "LOCAL_CLIENT_EXECUTION_CLAIM_NOT_FOUND",
    "The local-client execution claim does not exist or is no longer active.",
    false,
  );
}

function isKnownError(error: unknown): error is LocalClientSqliteExecutionClaimStoreError {
  return error instanceof LocalClientSqliteExecutionClaimStoreError;
}

function claimStoreError(
  code: LocalClientSqliteExecutionClaimStoreErrorCode,
  message: string,
  category: LocalClientSqliteExecutionClaimStoreError["category"],
  statusCode: number,
  retryable = false,
  reasonCode?: LocalClientExecutionClaimFailure["code"],
): LocalClientSqliteExecutionClaimStoreError {
  return new LocalClientSqliteExecutionClaimStoreError(
    code,
    message,
    category,
    statusCode,
    retryable,
    reasonCode,
  );
}

function configurationError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID",
    "The local-client SQLite execution claim configuration is invalid.",
    "configuration",
    500,
  );
}

function schemaError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_INCOMPATIBLE",
    "The local-client SQLite execution claim schema is incompatible.",
    "persistence",
    500,
  );
}

function hostMismatchError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_HOST_MISMATCH",
    "The local-client SQLite execution claim store belongs to another host.",
    "configuration",
    500,
  );
}

function closedError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CLOSED",
    "The local-client SQLite execution claim store is closed.",
    "persistence",
    503,
  );
}

function storeUnavailableError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_STORE_UNAVAILABLE",
    "The local-client SQLite execution claim store is unavailable.",
    "persistence",
    503,
    true,
  );
}

function clockError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CLOCK_INVALID",
    "The local-client execution claim clock moved backwards or returned an invalid value.",
    "integrity",
    503,
  );
}

function integrityError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_INTEGRITY_INVALID",
    "The local-client SQLite execution claim store failed an integrity check.",
    "integrity",
    500,
  );
}

function notActiveError(
  failure: LocalClientExecutionClaimFailure,
): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_NOT_ACTIVE",
    "An active, identity-bound local-client execution claim is required.",
    "concurrency",
    failure.code === "LOCAL_CLIENT_EXECUTION_CLAIM_ALREADY_HELD" ? 409 : 503,
    failure.retryable,
    failure.code,
  );
}

function abortedError(): LocalClientSqliteExecutionClaimStoreError {
  return claimStoreError(
    "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_ABORTED",
    "Local-client execution claim acquisition was aborted.",
    "cancellation",
    499,
  );
}
