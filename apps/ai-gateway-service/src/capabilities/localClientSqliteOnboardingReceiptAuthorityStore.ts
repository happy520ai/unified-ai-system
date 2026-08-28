import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION = 1 as const;
export const LOCAL_CLIENT_ONBOARDING_ROLLBACK_MUTATION_DELTA_VERSION =
  "local-client-onboarding-rollback-mutation-delta-v1" as const;

export const LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_BOUNDARIES = Object.freeze({
  mode: "sqlite-onboarding-receipt-authority" as const,
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  identityBinding: "tenant-subject-fingerprint" as const,
  oneTimeRollbackAuthorization: true as const,
  rollbackClaimMode: "exclusive-leased-fenced" as const,
  rawTenantPersisted: false as const,
  rawSubjectPersisted: false as const,
  rawReceiptPersisted: false as const,
  rawConfigurationPersisted: false as const,
  rawPathPersisted: false as const,
  rawCommandPersisted: false as const,
  rawArgumentsPersisted: false as const,
  rawBearerPersisted: false as const,
  rowIntegrity: "hmac-sha256" as const,
  metadataIntegrity: "hmac-sha256" as const,
  monotonicFencing: true as const,
  clockRollbackPolicy: "fail-closed" as const,
});

export type LocalClientOnboardingReceiptProfileId =
  | "claude-compatible-mcp-json"
  | "cursor-mcp-json"
  | "vscode-mcp-json";
export type LocalClientOnboardingAppliedAction = "enable" | "disable";
export type LocalClientOnboardingReceiptAuthorityStatus =
  | "applied"
  | "rollback-pending"
  | "rolled-back";

export interface LocalClientOnboardingReceiptReference {
  readonly identityFingerprint: string;
  readonly profileId: LocalClientOnboardingReceiptProfileId;
  readonly action: LocalClientOnboardingAppliedAction;
  readonly receiptDigest: string;
  readonly receiptContentFingerprint: string;
}

export interface LocalClientOnboardingAppliedReceiptInput
  extends LocalClientOnboardingReceiptReference {
  readonly appliedAt: string;
}

export interface LocalClientOnboardingRollbackClaimReference
  extends LocalClientOnboardingReceiptReference {
  readonly leaseToken: string;
  readonly fencingToken: string;
}

export interface LocalClientSqliteOnboardingReceiptAuthorityStoreOptions {
  readonly sqlitePath: string;
  readonly hostId: string;
  readonly integrityKey: Uint8Array;
  readonly namespace?: string;
  readonly ttlMs?: number;
  readonly leaseTtlMs?: number;
  readonly maxRows?: number;
  readonly busyTimeoutMs?: number;
  readonly now?: () => number;
}

export type LocalClientOnboardingRollbackMutationDelta = Readonly<{
  deltaVersion: typeof LOCAL_CLIENT_ONBOARDING_ROLLBACK_MUTATION_DELTA_VERSION;
  apply: true;
  operation: "rollback";
  profileId: LocalClientOnboardingReceiptProfileId;
  action: LocalClientOnboardingAppliedAction;
  receiptDigest: string;
  receiptContentFingerprint: string;
  appliedAt: string;
}>;

export type LocalClientOnboardingRollbackLease = Readonly<{
  token: string;
  tokenFingerprint: string;
  fencingToken: string;
  claimedAt: string;
  expiresAt: string;
  claimCount: number;
}>;

export type LocalClientOnboardingAppliedRecordResult = Readonly<{
  success: true;
  recorded: boolean;
  replayed: boolean;
  code:
    | "LOCAL_CLIENT_ONBOARDING_RECEIPT_RECORDED"
    | "LOCAL_CLIENT_ONBOARDING_RECEIPT_REPLAYED";
  status: LocalClientOnboardingReceiptAuthorityStatus;
  profileId: LocalClientOnboardingReceiptProfileId;
  action: LocalClientOnboardingAppliedAction;
  receiptDigest: string;
  receiptContentFingerprint: string;
  appliedAt: string;
  retireAt: string;
  mutationDelta: null;
}>;

export type LocalClientOnboardingRollbackClaimed = Readonly<{
  success: true;
  claimed: true;
  reclaimed: boolean;
  inProgress: false;
  replayed: false;
  code:
    | "LOCAL_CLIENT_ONBOARDING_ROLLBACK_CLAIMED"
    | "LOCAL_CLIENT_ONBOARDING_ROLLBACK_RECLAIMED";
  status: "rollback-pending";
  receiptDigest: string;
  receiptContentFingerprint: string;
  lease: LocalClientOnboardingRollbackLease;
  mutationDelta: LocalClientOnboardingRollbackMutationDelta;
}>;

export type LocalClientOnboardingRollbackInProgress = Readonly<{
  success: true;
  claimed: false;
  reclaimed: false;
  inProgress: true;
  replayed: false;
  code: "LOCAL_CLIENT_ONBOARDING_ROLLBACK_IN_PROGRESS";
  status: "rollback-pending";
  receiptDigest: string;
  receiptContentFingerprint: string;
  claimFingerprint: string;
  leaseExpiresAt: string;
  mutationDelta: null;
}>;

export type LocalClientOnboardingRolledBackReplay = Readonly<{
  success: true;
  claimed: false;
  reclaimed: false;
  inProgress: false;
  replayed: true;
  code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_ALREADY_ROLLED_BACK";
  status: "rolled-back";
  receiptDigest: string;
  receiptContentFingerprint: string;
  rolledBackAt: string;
  retireAt: string;
  mutationDelta: null;
}>;

export type LocalClientOnboardingRollbackAuthorization =
  | LocalClientOnboardingRollbackClaimed
  | LocalClientOnboardingRollbackInProgress
  | LocalClientOnboardingRolledBackReplay;

export type LocalClientOnboardingRolledBackResult = Readonly<{
  success: true;
  marked: true;
  alreadyRolledBack: boolean;
  code:
    | "LOCAL_CLIENT_ONBOARDING_RECEIPT_ROLLED_BACK"
    | "LOCAL_CLIENT_ONBOARDING_RECEIPT_ALREADY_ROLLED_BACK";
  status: "rolled-back";
  receiptDigest: string;
  receiptContentFingerprint: string;
  fencingToken: string;
  rolledBackAt: string;
  retireAt: string;
  mutationDelta: null;
}>;

export type LocalClientOnboardingRollbackReleaseResult = Readonly<{
  success: true;
  released: true;
  code: "LOCAL_CLIENT_ONBOARDING_ROLLBACK_CLAIM_RELEASED";
  status: "applied";
  receiptDigest: string;
  receiptContentFingerprint: string;
  fencingToken: string;
  mutationDelta: null;
}>;

export type LocalClientSqliteOnboardingReceiptAuthorityStoreErrorCode =
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INPUT_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NOT_FOUND"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_EXPIRED"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_STALE"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_EXPIRED"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CAPACITY"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_HOST_MISMATCH"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_KEY_MISMATCH"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLOSED"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_STORE_UNAVAILABLE"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLOCK_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INTEGRITY_INVALID";

export class LocalClientSqliteOnboardingReceiptAuthorityStoreError extends Error {
  readonly code: LocalClientSqliteOnboardingReceiptAuthorityStoreErrorCode;
  readonly category:
    | "configuration"
    | "validation"
    | "conflict"
    | "not_found"
    | "lease"
    | "capacity"
    | "persistence"
    | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientSqliteOnboardingReceiptAuthorityStoreErrorCode,
    message: string,
    category: LocalClientSqliteOnboardingReceiptAuthorityStoreError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientSqliteOnboardingReceiptAuthorityStoreError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type MetadataRow = {
  schema_version: number;
  host_binding_hmac: string;
  namespace_binding_hmac: string;
  key_binding_hmac: string;
  ttl_ms: number;
  lease_ttl_ms: number;
  max_rows: number;
  busy_timeout_ms: number;
  last_clock_ms: number;
  last_fencing_token: string;
  metadata_hmac: string;
};

type ReceiptRow = {
  record_version: number;
  identity_binding_hmac: string;
  profile_id: string;
  action: string;
  receipt_digest: string;
  receipt_content_fingerprint: string;
  applied_at_ms: number;
  retire_at_ms: number;
  status: string;
  rollback_token_digest: string;
  rollback_fencing_token: string;
  rollback_claimed_at_ms: number;
  rollback_lease_expires_at_ms: number;
  rollback_claim_count: number;
  rolled_back_at_ms: number;
  row_hmac: string;
};

type NormalizedAppliedReceipt = Readonly<{
  identityBindingHmac: string;
  profileId: LocalClientOnboardingReceiptProfileId;
  action: LocalClientOnboardingAppliedAction;
  receiptDigest: string;
  receiptContentFingerprint: string;
  appliedAt: string;
  appliedAtMs: number;
}>;

type NormalizedReceiptReference = Readonly<{
  identityBindingHmac: string;
  profileId: LocalClientOnboardingReceiptProfileId;
  action: LocalClientOnboardingAppliedAction;
  receiptDigest: string;
  receiptContentFingerprint: string;
}>;

type NormalizedRollbackClaimReference = NormalizedReceiptReference & Readonly<{
  leaseToken: string;
  fencingToken: string;
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 1;
const DEFAULT_NAMESPACE = "local-client-onboarding-receipt-authority";
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60_000;
const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MIN_TTL_MS = 10;
const MAX_TTL_MS = 365 * 24 * 60 * 60_000;
const MIN_LEASE_TTL_MS = 10;
const MAX_LEASE_TTL_MS = 60 * 60_000;
const MAX_ROWS = 1_000_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_DATE_MS = 8_640_000_000_000_000;
const MAX_BEARER_LENGTH = 512;
const MAX_FENCING_TOKEN = 9_223_372_036_854_775_807n;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const FENCING_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
const PROFILE_IDS = new Set<LocalClientOnboardingReceiptProfileId>([
  "claude-compatible-mcp-json",
  "cursor-mcp-json",
  "vscode-mcp-json",
]);
const ACTIONS = new Set<LocalClientOnboardingAppliedAction>(["enable", "disable"]);
const STATUSES = new Set<LocalClientOnboardingReceiptAuthorityStatus>([
  "applied",
  "rollback-pending",
  "rolled-back",
]);
const HMAC_DOMAIN = "unified-ai/local-client-onboarding-receipt-authority/v1";

export class LocalClientSqliteOnboardingReceiptAuthorityStore {
  readonly #db!: DatabaseSync;
  readonly #sqlitePath: string;
  readonly #key: Buffer;
  readonly #hostBindingHmac: string;
  readonly #namespaceBindingHmac: string;
  readonly #keyBindingHmac: string;
  readonly #ttlMs: number;
  readonly #leaseTtlMs: number;
  readonly #maxRows: number;
  readonly #busyTimeoutMs: number;
  readonly #now: () => number;
  #closed = false;

  constructor(options: LocalClientSqliteOnboardingReceiptAuthorityStoreOptions) {
    assertOptions(options);
    const sqlitePath = resolveSqlitePath(options.sqlitePath);
    const hostId = assertHostId(options.hostId);
    const namespace = assertNamespace(options.namespace ?? DEFAULT_NAMESPACE);
    const ttlMs = boundedInteger(options.ttlMs, DEFAULT_TTL_MS, MIN_TTL_MS, MAX_TTL_MS);
    const leaseTtlMs = boundedInteger(
      options.leaseTtlMs,
      DEFAULT_LEASE_TTL_MS,
      MIN_LEASE_TTL_MS,
      MAX_LEASE_TTL_MS,
    );
    const maxRows = boundedInteger(options.maxRows, DEFAULT_MAX_ROWS, 1, MAX_ROWS);
    const busyTimeoutMs = boundedInteger(
      options.busyTimeoutMs,
      DEFAULT_BUSY_TIMEOUT_MS,
      100,
      MAX_BUSY_TIMEOUT_MS,
    );
    if (options.now !== undefined && typeof options.now !== "function") throw configurationError();

    this.#sqlitePath = sqlitePath;
    this.#key = cloneIntegrityKey(options.integrityKey);
    this.#hostBindingHmac = keyedDigest(this.#key, "host-binding", hostId);
    this.#namespaceBindingHmac = keyedDigest(this.#key, "namespace-binding", namespace);
    this.#keyBindingHmac = keyedDigest(
      this.#key,
      "key-binding",
      canonicalJson({ schemaVersion: LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION }),
    );
    this.#ttlMs = ttlMs;
    this.#leaseTtlMs = leaseTtlMs;
    this.#maxRows = maxRows;
    this.#busyTimeoutMs = busyTimeoutMs;
    this.#now = options.now ?? Date.now;

    try {
      mkdirSync(dirname(this.#sqlitePath), { recursive: true, mode: 0o700 });
      try { chmodSync(dirname(this.#sqlitePath), 0o700); } catch { /* Best effort on Windows. */ }
      this.#db = new DatabaseSync(this.#sqlitePath);
      this.#db.exec(`PRAGMA busy_timeout = ${this.#busyTimeoutMs}`);
      const journal = this.#db.prepare("PRAGMA journal_mode = WAL").get() as
        | { journal_mode?: unknown }
        | undefined;
      if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") throw schemaError();
      this.#db.exec("PRAGMA synchronous = FULL");
      const synchronous = this.#db.prepare("PRAGMA synchronous").get() as
        | { synchronous?: unknown }
        | undefined;
      if (Number(synchronous?.synchronous) !== 2) throw schemaError();
      this.#db.exec("PRAGMA trusted_schema = OFF");
      this.#db.exec("PRAGMA foreign_keys = ON");
      this.#initializeSchema();
      const defensive = (this.#db as DatabaseSync & {
        enableDefensive?: (enabled: boolean) => void;
      }).enableDefensive;
      if (typeof defensive !== "function") throw schemaError();
      Reflect.apply(defensive, this.#db, [true]);
      this.#assertDatabaseHealthy();
      this.#scanRows();
      try { chmodSync(this.#sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve initialization error. */ }
      this.#key.fill(0);
      if (isKnownError(error)) throw error;
      throw unavailableError();
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_BOUNDARIES,
      available: !this.#closed,
      schemaVersion: LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION,
      journalMode: "wal" as const,
      synchronous: "full" as const,
      trustedSchema: false as const,
      defensive: true as const,
      ttlMs: this.#ttlMs,
      leaseTtlMs: this.#leaseTtlMs,
      maxRows: this.#maxRows,
      busyTimeoutMs: this.#busyTimeoutMs,
    });
  }

  getStatus() {
    return this.status;
  }

  async recordApplied(
    input: LocalClientOnboardingAppliedReceiptInput,
  ): Promise<LocalClientOnboardingAppliedRecordResult> {
    this.#assertOpen();
    const receipt = normalizeAppliedReceipt(this.#key, input);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      if (receipt.appliedAtMs > nowMs) throw inputError();
      this.#purgeRetired(nowMs);
      const retireAtMs = safeAdd(receipt.appliedAtMs, this.#ttlMs);
      if (retireAtMs <= nowMs) throw receiptExpiredError();

      const byDigest = this.#selectByReceiptDigest(receipt.receiptDigest);
      const byContent = this.#selectByContentFingerprint(receipt.receiptContentFingerprint);
      if (byDigest || byContent) {
        if (!byDigest || !byContent || byDigest.receipt_digest !== byContent.receipt_digest) {
          throw conflictError();
        }
        const current = this.#decodeRow(byDigest);
        assertReceiptMatches(current, receipt);
        if (current.applied_at_ms !== receipt.appliedAtMs) throw conflictError();
        return toRecordResult(current, false);
      }
      if (this.#countRows() >= this.#maxRows) throw capacityError();
      const row = createReceiptRow(this.#key, receipt, retireAtMs);
      const inserted = this.#db.prepare(`
        INSERT INTO local_client_onboarding_receipt_authority (
          record_version, identity_binding_hmac, profile_id, action,
          receipt_digest, receipt_content_fingerprint, applied_at_ms,
          retire_at_ms, status, rollback_token_digest,
          rollback_fencing_token, rollback_claimed_at_ms,
          rollback_lease_expires_at_ms, rollback_claim_count,
          rolled_back_at_ms, row_hmac
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.record_version,
        row.identity_binding_hmac,
        row.profile_id,
        row.action,
        row.receipt_digest,
        row.receipt_content_fingerprint,
        row.applied_at_ms,
        row.retire_at_ms,
        row.status,
        row.rollback_token_digest,
        row.rollback_fencing_token,
        row.rollback_claimed_at_ms,
        row.rollback_lease_expires_at_ms,
        row.rollback_claim_count,
        row.rolled_back_at_ms,
        row.row_hmac,
      );
      if (Number(inserted.changes) !== 1) throw integrityError();
      return toRecordResult(row, true);
    });
  }

  async authorizeRollback(
    input: LocalClientOnboardingReceiptReference,
  ): Promise<LocalClientOnboardingRollbackAuthorization> {
    this.#assertOpen();
    const reference = normalizeReceiptReference(this.#key, input);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const raw = this.#selectByReceiptDigest(reference.receiptDigest);
      if (!raw) throw notFoundError();
      const current = this.#decodeRow(raw);
      assertReceiptMatches(current, reference);
      if (current.status === "rolled-back") return toRolledBackReplay(current);
      if (hasActiveClaim(current, nowMs)) return toInProgress(current);
      return this.#claimRollback(current, nowMs);
    });
  }

  async markRolledBack(
    input: LocalClientOnboardingRollbackClaimReference,
  ): Promise<LocalClientOnboardingRolledBackResult> {
    this.#assertOpen();
    const claim = normalizeClaimReference(this.#key, input);
    const tokenDigest = digestBearer(this.#key, claim.leaseToken);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const raw = this.#selectByReceiptDigest(claim.receiptDigest);
      if (!raw) throw notFoundError();
      const current = this.#decodeRow(raw);
      assertReceiptMatches(current, claim);
      assertClaimMatches(current, claim, tokenDigest);
      if (current.status === "rolled-back") return toMarkedResult(current, true);
      if (current.status !== "rollback-pending") throw claimStaleError();
      if (nowMs >= current.rollback_lease_expires_at_ms) throw claimExpiredError();
      const updated = signReceiptRow(this.#key, {
        ...current,
        status: "rolled-back",
        rolled_back_at_ms: nowMs,
        retire_at_ms: safeAdd(nowMs, this.#ttlMs),
        row_hmac: "",
      });
      this.#replaceRow(current, updated);
      return toMarkedResult(updated, false);
    });
  }

  async releaseRollbackClaim(
    input: LocalClientOnboardingRollbackClaimReference,
  ): Promise<LocalClientOnboardingRollbackReleaseResult> {
    this.#assertOpen();
    const claim = normalizeClaimReference(this.#key, input);
    const tokenDigest = digestBearer(this.#key, claim.leaseToken);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const raw = this.#selectByReceiptDigest(claim.receiptDigest);
      if (!raw) throw notFoundError();
      const current = this.#decodeRow(raw);
      assertReceiptMatches(current, claim);
      if (current.status !== "rollback-pending") throw claimStaleError();
      assertClaimMatches(current, claim, tokenDigest);
      const updated = signReceiptRow(this.#key, {
        ...current,
        status: "applied",
        rollback_token_digest: "",
        rollback_claimed_at_ms: 0,
        rollback_lease_expires_at_ms: 0,
        row_hmac: "",
      });
      this.#replaceRow(current, updated);
      return Object.freeze({
        success: true as const,
        released: true as const,
        code: "LOCAL_CLIENT_ONBOARDING_ROLLBACK_CLAIM_RELEASED" as const,
        status: "applied" as const,
        receiptDigest: updated.receipt_digest,
        receiptContentFingerprint: updated.receipt_content_fingerprint,
        fencingToken: updated.rollback_fencing_token,
        mutationDelta: null,
      });
    });
  }

  async checkHealth() {
    const counts = this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      this.#assertDatabaseHealthy();
      this.#scanRows();
      return this.#countStates(nowMs);
    });
    return Object.freeze({ ...this.status, ...counts });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#db.close();
    } finally {
      this.#key.fill(0);
    }
  }

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      const userVersion = readPragmaInteger(this.#db, "user_version");
      if (
        userVersion !== 0
        && userVersion !== LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION
      ) throw schemaError();
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_onboarding_receipt_authority_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          host_binding_hmac TEXT NOT NULL,
          namespace_binding_hmac TEXT NOT NULL,
          key_binding_hmac TEXT NOT NULL,
          ttl_ms INTEGER NOT NULL CHECK (ttl_ms > 0),
          lease_ttl_ms INTEGER NOT NULL CHECK (lease_ttl_ms > 0),
          max_rows INTEGER NOT NULL CHECK (max_rows > 0),
          busy_timeout_ms INTEGER NOT NULL CHECK (busy_timeout_ms > 0),
          last_clock_ms INTEGER NOT NULL CHECK (last_clock_ms >= 0),
          last_fencing_token TEXT NOT NULL,
          metadata_hmac TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_onboarding_receipt_authority (
          record_version INTEGER NOT NULL,
          identity_binding_hmac TEXT NOT NULL,
          profile_id TEXT NOT NULL,
          action TEXT NOT NULL CHECK (action IN ('enable', 'disable')),
          receipt_digest TEXT PRIMARY KEY,
          receipt_content_fingerprint TEXT NOT NULL UNIQUE,
          applied_at_ms INTEGER NOT NULL CHECK (applied_at_ms >= 0),
          retire_at_ms INTEGER NOT NULL CHECK (retire_at_ms > applied_at_ms),
          status TEXT NOT NULL CHECK (status IN ('applied', 'rollback-pending', 'rolled-back')),
          rollback_token_digest TEXT NOT NULL,
          rollback_fencing_token TEXT NOT NULL,
          rollback_claimed_at_ms INTEGER NOT NULL CHECK (rollback_claimed_at_ms >= 0),
          rollback_lease_expires_at_ms INTEGER NOT NULL CHECK (rollback_lease_expires_at_ms >= 0),
          rollback_claim_count INTEGER NOT NULL CHECK (rollback_claim_count >= 0),
          rolled_back_at_ms INTEGER NOT NULL CHECK (rolled_back_at_ms >= 0),
          row_hmac TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_onboarding_receipt_retire_idx
          ON local_client_onboarding_receipt_authority (retire_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_onboarding_receipt_status_idx
          ON local_client_onboarding_receipt_authority (status, rollback_lease_expires_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_onboarding_receipt_identity_idx
          ON local_client_onboarding_receipt_authority (identity_binding_hmac, profile_id);
      `);
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        if (metadata || this.#countRows() !== 0) throw schemaError();
        const initial = createMetadataRow(this.#key, {
          hostBindingHmac: this.#hostBindingHmac,
          namespaceBindingHmac: this.#namespaceBindingHmac,
          keyBindingHmac: this.#keyBindingHmac,
          ttlMs: this.#ttlMs,
          leaseTtlMs: this.#leaseTtlMs,
          maxRows: this.#maxRows,
          busyTimeoutMs: this.#busyTimeoutMs,
          lastClockMs: 0,
          lastFencingToken: "0",
        });
        this.#db.prepare(`
          INSERT INTO local_client_onboarding_receipt_authority_metadata (
            singleton, schema_version, host_binding_hmac, namespace_binding_hmac,
            key_binding_hmac, ttl_ms, lease_ttl_ms, max_rows,
            busy_timeout_ms, last_clock_ms, last_fencing_token, metadata_hmac
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.host_binding_hmac,
          initial.namespace_binding_hmac,
          initial.key_binding_hmac,
          initial.ttl_ms,
          initial.lease_ttl_ms,
          initial.max_rows,
          initial.busy_timeout_ms,
          initial.last_clock_ms,
          initial.last_fencing_token,
          initial.metadata_hmac,
        );
        this.#db.exec(
          `PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION}`,
        );
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
    if (nowMs < metadata.last_clock_ms) throw clockError();
    const updated = createMetadataRow(this.#key, {
      hostBindingHmac: metadata.host_binding_hmac,
      namespaceBindingHmac: metadata.namespace_binding_hmac,
      keyBindingHmac: metadata.key_binding_hmac,
      ttlMs: metadata.ttl_ms,
      leaseTtlMs: metadata.lease_ttl_ms,
      maxRows: metadata.max_rows,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastClockMs: nowMs,
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
    const updated = createMetadataRow(this.#key, {
      hostBindingHmac: metadata.host_binding_hmac,
      namespaceBindingHmac: metadata.namespace_binding_hmac,
      keyBindingHmac: metadata.key_binding_hmac,
      ttlMs: metadata.ttl_ms,
      leaseTtlMs: metadata.lease_ttl_ms,
      maxRows: metadata.max_rows,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastClockMs: metadata.last_clock_ms,
      lastFencingToken: fencingToken,
    });
    this.#replaceMetadata(metadata, updated);
    return fencingToken;
  }

  #replaceMetadata(previous: MetadataRow, updated: MetadataRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_onboarding_receipt_authority_metadata
      SET last_clock_ms = ?, last_fencing_token = ?, metadata_hmac = ?
      WHERE singleton = ? AND metadata_hmac = ?
    `).run(
      updated.last_clock_ms,
      updated.last_fencing_token,
      updated.metadata_hmac,
      METADATA_SINGLETON,
      previous.metadata_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, host_binding_hmac, namespace_binding_hmac,
             key_binding_hmac, ttl_ms, lease_ttl_ms, max_rows,
             busy_timeout_ms, last_clock_ms, last_fencing_token, metadata_hmac
      FROM local_client_onboarding_receipt_authority_metadata
      WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION
      || !isDigest(row.host_binding_hmac)
      || !isDigest(row.namespace_binding_hmac)
      || !isDigest(row.key_binding_hmac)
      || !isSafePositiveInteger(row.ttl_ms)
      || !isSafePositiveInteger(row.lease_ttl_ms)
      || !isSafePositiveInteger(row.max_rows)
      || !isSafePositiveInteger(row.busy_timeout_ms)
      || !isSafeNonNegativeInteger(row.last_clock_ms)
      || !isFencingToken(row.last_fencing_token, true)
      || !isDigest(row.metadata_hmac)
    ) throw integrityError();
    if (!safeDigestEqual(row.key_binding_hmac, this.#keyBindingHmac)) throw keyMismatchError();
    const expected = createMetadataRow(this.#key, {
      hostBindingHmac: row.host_binding_hmac,
      namespaceBindingHmac: row.namespace_binding_hmac,
      keyBindingHmac: row.key_binding_hmac,
      ttlMs: row.ttl_ms,
      leaseTtlMs: row.lease_ttl_ms,
      maxRows: row.max_rows,
      busyTimeoutMs: row.busy_timeout_ms,
      lastClockMs: row.last_clock_ms,
      lastFencingToken: row.last_fencing_token,
    }).metadata_hmac;
    if (!safeDigestEqual(row.metadata_hmac, expected)) throw integrityError();
    if (!safeDigestEqual(row.host_binding_hmac, this.#hostBindingHmac)) throw hostMismatchError();
    if (
      !safeDigestEqual(row.namespace_binding_hmac, this.#namespaceBindingHmac)
      || row.ttl_ms !== this.#ttlMs
      || row.lease_ttl_ms !== this.#leaseTtlMs
      || row.max_rows !== this.#maxRows
      || row.busy_timeout_ms !== this.#busyTimeoutMs
    ) throw configurationError();
  }

  #selectByReceiptDigest(receiptDigest: string): ReceiptRow | undefined {
    return this.#db.prepare(`${selectReceiptFields()} WHERE receipt_digest = ?`)
      .get(receiptDigest) as ReceiptRow | undefined;
  }

  #selectByContentFingerprint(contentFingerprint: string): ReceiptRow | undefined {
    return this.#db.prepare(`${selectReceiptFields()} WHERE receipt_content_fingerprint = ?`)
      .get(contentFingerprint) as ReceiptRow | undefined;
  }

  #decodeRow(row: ReceiptRow): ReceiptRow {
    validateReceiptRow(row);
    const expected = digestReceiptRow(this.#key, { ...row, row_hmac: "" });
    if (!safeDigestEqual(row.row_hmac, expected)) throw integrityError();
    return row;
  }

  #claimRollback(row: ReceiptRow, nowMs: number): LocalClientOnboardingRollbackClaimed {
    if (row.status === "rolled-back" || hasActiveClaim(row, nowMs)) throw claimStaleError();
    if (row.retire_at_ms <= nowMs) throw receiptExpiredError();
    if (row.rollback_claim_count >= Number.MAX_SAFE_INTEGER) throw integrityError();
    const leaseToken = randomBytes(32).toString("base64url");
    const fencingToken = this.#allocateFencingToken();
    const leaseExpiresAtMs = Math.min(safeAdd(nowMs, this.#leaseTtlMs), row.retire_at_ms);
    if (leaseExpiresAtMs <= nowMs) throw receiptExpiredError();
    const reclaimed = row.rollback_claim_count > 0;
    const updated = signReceiptRow(this.#key, {
      ...row,
      status: "rollback-pending",
      rollback_token_digest: digestBearer(this.#key, leaseToken),
      rollback_fencing_token: fencingToken,
      rollback_claimed_at_ms: nowMs,
      rollback_lease_expires_at_ms: leaseExpiresAtMs,
      rollback_claim_count: row.rollback_claim_count + 1,
      row_hmac: "",
    });
    this.#replaceRow(row, updated);
    return toClaimedResult(updated, leaseToken, reclaimed);
  }

  #replaceRow(previous: ReceiptRow, updated: ReceiptRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_onboarding_receipt_authority
      SET retire_at_ms = ?, status = ?, rollback_token_digest = ?,
          rollback_fencing_token = ?, rollback_claimed_at_ms = ?,
          rollback_lease_expires_at_ms = ?, rollback_claim_count = ?,
          rolled_back_at_ms = ?, row_hmac = ?
      WHERE receipt_digest = ? AND row_hmac = ?
    `).run(
      updated.retire_at_ms,
      updated.status,
      updated.rollback_token_digest,
      updated.rollback_fencing_token,
      updated.rollback_claimed_at_ms,
      updated.rollback_lease_expires_at_ms,
      updated.rollback_claim_count,
      updated.rolled_back_at_ms,
      updated.row_hmac,
      previous.receipt_digest,
      previous.row_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #purgeRetired(nowMs: number): void {
    const rows = this.#db.prepare(`${selectReceiptFields()} WHERE retire_at_ms <= ?`)
      .all(nowMs) as ReceiptRow[];
    for (const row of rows) this.#decodeRow(row);
    if (rows.length > 0) {
      const deleted = this.#db.prepare(
        "DELETE FROM local_client_onboarding_receipt_authority WHERE retire_at_ms <= ?",
      ).run(nowMs);
      if (Number(deleted.changes) !== rows.length) throw integrityError();
    }
  }

  #countRows(): number {
    const row = this.#db.prepare(
      "SELECT COUNT(*) AS count FROM local_client_onboarding_receipt_authority",
    ).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_ROWS) throw integrityError();
    return count;
  }

  #countStates(nowMs: number) {
    const row = this.#db.prepare(`
      SELECT
        COUNT(*) AS receipt_count,
        SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) AS applied_count,
        SUM(CASE WHEN status = 'rollback-pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'rolled-back' THEN 1 ELSE 0 END) AS rolled_back_count,
        SUM(CASE WHEN status = 'rollback-pending'
                  AND rollback_token_digest <> ''
                  AND rollback_lease_expires_at_ms > ?
                 THEN 1 ELSE 0 END) AS active_claim_count
      FROM local_client_onboarding_receipt_authority
    `).get(nowMs) as Record<string, unknown>;
    const result = {
      receiptCount: Number(row.receipt_count),
      appliedCount: Number(row.applied_count),
      rollbackPendingCount: Number(row.pending_count),
      rolledBackCount: Number(row.rolled_back_count),
      activeRollbackClaimCount: Number(row.active_claim_count),
    };
    if (Object.values(result).some((value) => (
      !Number.isSafeInteger(value) || value < 0 || value > this.#maxRows
    ))) throw integrityError();
    if (
      result.appliedCount + result.rollbackPendingCount + result.rolledBackCount
      !== result.receiptCount
    ) throw integrityError();
    return Object.freeze(result);
  }

  #scanRows(): void {
    const rows = this.#db.prepare(selectReceiptFields()).all() as ReceiptRow[];
    if (rows.length > this.#maxRows) throw integrityError();
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
      throw unavailableError();
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
        try { this.#db.exec("ROLLBACK"); } catch { /* Preserve original failure. */ }
      }
      throw error;
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw closedError();
  }
}

export function createLocalClientSqliteOnboardingReceiptAuthorityStore(
  options: LocalClientSqliteOnboardingReceiptAuthorityStoreOptions,
): LocalClientSqliteOnboardingReceiptAuthorityStore {
  return new LocalClientSqliteOnboardingReceiptAuthorityStore(options);
}

function createMetadataRow(
  key: Uint8Array,
  input: Readonly<{
    hostBindingHmac: string;
    namespaceBindingHmac: string;
    keyBindingHmac: string;
    ttlMs: number;
    leaseTtlMs: number;
    maxRows: number;
    busyTimeoutMs: number;
    lastClockMs: number;
    lastFencingToken: string;
  }>,
): MetadataRow {
  const canonical = canonicalJson({
    schemaVersion: LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION,
    hostBindingHmac: input.hostBindingHmac,
    namespaceBindingHmac: input.namespaceBindingHmac,
    keyBindingHmac: input.keyBindingHmac,
    ttlMs: input.ttlMs,
    leaseTtlMs: input.leaseTtlMs,
    maxRows: input.maxRows,
    busyTimeoutMs: input.busyTimeoutMs,
    lastClockMs: input.lastClockMs,
    lastFencingToken: input.lastFencingToken,
  });
  return {
    schema_version: LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_VERSION,
    host_binding_hmac: input.hostBindingHmac,
    namespace_binding_hmac: input.namespaceBindingHmac,
    key_binding_hmac: input.keyBindingHmac,
    ttl_ms: input.ttlMs,
    lease_ttl_ms: input.leaseTtlMs,
    max_rows: input.maxRows,
    busy_timeout_ms: input.busyTimeoutMs,
    last_clock_ms: input.lastClockMs,
    last_fencing_token: input.lastFencingToken,
    metadata_hmac: keyedDigest(key, "metadata-row", canonical),
  };
}

function createReceiptRow(
  key: Uint8Array,
  receipt: NormalizedAppliedReceipt,
  retireAtMs: number,
): ReceiptRow {
  return signReceiptRow(key, {
    record_version: RECORD_VERSION,
    identity_binding_hmac: receipt.identityBindingHmac,
    profile_id: receipt.profileId,
    action: receipt.action,
    receipt_digest: receipt.receiptDigest,
    receipt_content_fingerprint: receipt.receiptContentFingerprint,
    applied_at_ms: receipt.appliedAtMs,
    retire_at_ms: retireAtMs,
    status: "applied",
    rollback_token_digest: "",
    rollback_fencing_token: "0",
    rollback_claimed_at_ms: 0,
    rollback_lease_expires_at_ms: 0,
    rollback_claim_count: 0,
    rolled_back_at_ms: 0,
    row_hmac: "",
  });
}

function signReceiptRow(key: Uint8Array, row: ReceiptRow): ReceiptRow {
  const unsigned = { ...row, row_hmac: "" };
  return { ...unsigned, row_hmac: digestReceiptRow(key, unsigned) };
}

function digestReceiptRow(key: Uint8Array, row: ReceiptRow): string {
  return keyedDigest(key, "receipt-row", canonicalJson({
    recordVersion: row.record_version,
    identityBindingHmac: row.identity_binding_hmac,
    profileId: row.profile_id,
    action: row.action,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    appliedAtMs: row.applied_at_ms,
    retireAtMs: row.retire_at_ms,
    status: row.status,
    rollbackTokenDigest: row.rollback_token_digest,
    rollbackFencingToken: row.rollback_fencing_token,
    rollbackClaimedAtMs: row.rollback_claimed_at_ms,
    rollbackLeaseExpiresAtMs: row.rollback_lease_expires_at_ms,
    rollbackClaimCount: row.rollback_claim_count,
    rolledBackAtMs: row.rolled_back_at_ms,
  }));
}

function validateReceiptRow(row: ReceiptRow): void {
  if (
    row.record_version !== RECORD_VERSION
    || !isDigest(row.identity_binding_hmac)
    || !isProfileId(row.profile_id)
    || !isAction(row.action)
    || !isDigest(row.receipt_digest)
    || !isDigest(row.receipt_content_fingerprint)
    || !isSafeNonNegativeInteger(row.applied_at_ms)
    || row.applied_at_ms > MAX_DATE_MS
    || !isSafeNonNegativeInteger(row.retire_at_ms)
    || row.retire_at_ms <= row.applied_at_ms
    || row.retire_at_ms > MAX_DATE_MS
    || !isStatus(row.status)
    || !(row.rollback_token_digest === "" || isDigest(row.rollback_token_digest))
    || !isFencingToken(row.rollback_fencing_token, true)
    || !isSafeNonNegativeInteger(row.rollback_claimed_at_ms)
    || row.rollback_claimed_at_ms > MAX_DATE_MS
    || !isSafeNonNegativeInteger(row.rollback_lease_expires_at_ms)
    || row.rollback_lease_expires_at_ms > MAX_DATE_MS
    || !isSafeNonNegativeInteger(row.rollback_claim_count)
    || !isSafeNonNegativeInteger(row.rolled_back_at_ms)
    || row.rolled_back_at_ms > MAX_DATE_MS
    || !isDigest(row.row_hmac)
  ) throw integrityError();
  if (row.status === "applied") {
    if (
      row.rollback_token_digest !== ""
      || row.rollback_claimed_at_ms !== 0
      || row.rollback_lease_expires_at_ms !== 0
      || row.rolled_back_at_ms !== 0
      || (row.rollback_claim_count === 0 && row.rollback_fencing_token !== "0")
      || (row.rollback_claim_count > 0 && !isFencingToken(row.rollback_fencing_token, false))
    ) throw integrityError();
    return;
  }
  if (
    !isDigest(row.rollback_token_digest)
    || !isFencingToken(row.rollback_fencing_token, false)
    || row.rollback_claim_count < 1
    || row.rollback_claimed_at_ms < row.applied_at_ms
    || row.rollback_lease_expires_at_ms <= row.rollback_claimed_at_ms
  ) throw integrityError();
  if (row.status === "rollback-pending") {
    if (
      row.rolled_back_at_ms !== 0
      || row.rollback_lease_expires_at_ms > row.retire_at_ms
    ) throw integrityError();
  } else if (
    row.rolled_back_at_ms < row.rollback_claimed_at_ms
    || row.rolled_back_at_ms >= row.rollback_lease_expires_at_ms
    || row.retire_at_ms <= row.rolled_back_at_ms
  ) throw integrityError();
}

function normalizeAppliedReceipt(
  key: Uint8Array,
  input: LocalClientOnboardingAppliedReceiptInput,
): NormalizedAppliedReceipt {
  const reference = normalizeReceiptReference(key, input, ["appliedAt"]);
  const appliedAtMs = parseCanonicalIso(input.appliedAt);
  return Object.freeze({ ...reference, appliedAt: input.appliedAt, appliedAtMs });
}

function normalizeReceiptReference(
  key: Uint8Array,
  input: LocalClientOnboardingReceiptReference,
  extraKeys: readonly string[] = [],
): NormalizedReceiptReference {
  if (!isPlainRecord(input)) throw inputError();
  assertExactKeys(input, [
    "identityFingerprint",
    "profileId",
    "action",
    "receiptDigest",
    "receiptContentFingerprint",
    ...extraKeys,
  ], false, inputError);
  if (
    !isDigest(input.identityFingerprint)
    || !isProfileId(input.profileId)
    || !isAction(input.action)
    || !isDigest(input.receiptDigest)
    || !isDigest(input.receiptContentFingerprint)
  ) throw inputError();
  return Object.freeze({
    identityBindingHmac: keyedDigest(
      key,
      "tenant-subject-identity-binding",
      input.identityFingerprint,
    ),
    profileId: input.profileId,
    action: input.action,
    receiptDigest: input.receiptDigest,
    receiptContentFingerprint: input.receiptContentFingerprint,
  });
}

function normalizeClaimReference(
  key: Uint8Array,
  input: LocalClientOnboardingRollbackClaimReference,
): NormalizedRollbackClaimReference {
  if (!isPlainRecord(input)) throw claimInvalidError();
  assertExactKeys(input, [
    "identityFingerprint",
    "profileId",
    "action",
    "receiptDigest",
    "receiptContentFingerprint",
    "leaseToken",
    "fencingToken",
  ], false, claimInvalidError);
  if (
    !isDigest(input.identityFingerprint)
    || !isProfileId(input.profileId)
    || !isAction(input.action)
    || !isDigest(input.receiptDigest)
    || !isDigest(input.receiptContentFingerprint)
    || typeof input.leaseToken !== "string"
    || input.leaseToken.length < 32
    || input.leaseToken.length > MAX_BEARER_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(input.leaseToken)
    || !isFencingToken(input.fencingToken, false)
  ) throw claimInvalidError();
  return Object.freeze({
    identityBindingHmac: keyedDigest(
      key,
      "tenant-subject-identity-binding",
      input.identityFingerprint,
    ),
    profileId: input.profileId,
    action: input.action,
    receiptDigest: input.receiptDigest,
    receiptContentFingerprint: input.receiptContentFingerprint,
    leaseToken: input.leaseToken,
    fencingToken: input.fencingToken,
  });
}

function assertReceiptMatches(
  row: ReceiptRow,
  reference: NormalizedReceiptReference,
): void {
  if (
    !safeDigestEqual(row.identity_binding_hmac, reference.identityBindingHmac)
    || row.profile_id !== reference.profileId
    || row.action !== reference.action
    || !safeDigestEqual(row.receipt_digest, reference.receiptDigest)
    || !safeDigestEqual(row.receipt_content_fingerprint, reference.receiptContentFingerprint)
  ) throw conflictError();
}

function assertClaimMatches(
  row: ReceiptRow,
  claim: NormalizedRollbackClaimReference,
  tokenDigest: string,
): void {
  if (
    row.rollback_token_digest === ""
    || !safeDigestEqual(row.rollback_token_digest, tokenDigest)
    || row.rollback_fencing_token !== claim.fencingToken
  ) throw claimStaleError();
}

function hasActiveClaim(row: ReceiptRow, nowMs: number): boolean {
  return row.status === "rollback-pending"
    && row.rollback_token_digest !== ""
    && nowMs < row.rollback_lease_expires_at_ms;
}

function toRecordResult(row: ReceiptRow, recorded: boolean): LocalClientOnboardingAppliedRecordResult {
  return Object.freeze({
    success: true as const,
    recorded,
    replayed: !recorded,
    code: recorded
      ? "LOCAL_CLIENT_ONBOARDING_RECEIPT_RECORDED" as const
      : "LOCAL_CLIENT_ONBOARDING_RECEIPT_REPLAYED" as const,
    status: row.status as LocalClientOnboardingReceiptAuthorityStatus,
    profileId: row.profile_id as LocalClientOnboardingReceiptProfileId,
    action: row.action as LocalClientOnboardingAppliedAction,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    appliedAt: toIso(row.applied_at_ms),
    retireAt: toIso(row.retire_at_ms),
    mutationDelta: null,
  });
}

function toClaimedResult(
  row: ReceiptRow,
  leaseToken: string,
  reclaimed: boolean,
): LocalClientOnboardingRollbackClaimed {
  return Object.freeze({
    success: true as const,
    claimed: true as const,
    reclaimed,
    inProgress: false as const,
    replayed: false as const,
    code: reclaimed
      ? "LOCAL_CLIENT_ONBOARDING_ROLLBACK_RECLAIMED" as const
      : "LOCAL_CLIENT_ONBOARDING_ROLLBACK_CLAIMED" as const,
    status: "rollback-pending" as const,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    lease: Object.freeze({
      token: leaseToken,
      tokenFingerprint: fingerprint(row.rollback_token_digest),
      fencingToken: row.rollback_fencing_token,
      claimedAt: toIso(row.rollback_claimed_at_ms),
      expiresAt: toIso(row.rollback_lease_expires_at_ms),
      claimCount: row.rollback_claim_count,
    }),
    mutationDelta: toMutationDelta(row),
  });
}

function toMutationDelta(row: ReceiptRow): LocalClientOnboardingRollbackMutationDelta {
  return Object.freeze({
    deltaVersion: LOCAL_CLIENT_ONBOARDING_ROLLBACK_MUTATION_DELTA_VERSION,
    apply: true as const,
    operation: "rollback" as const,
    profileId: row.profile_id as LocalClientOnboardingReceiptProfileId,
    action: row.action as LocalClientOnboardingAppliedAction,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    appliedAt: toIso(row.applied_at_ms),
  });
}

function toInProgress(row: ReceiptRow): LocalClientOnboardingRollbackInProgress {
  return Object.freeze({
    success: true as const,
    claimed: false as const,
    reclaimed: false as const,
    inProgress: true as const,
    replayed: false as const,
    code: "LOCAL_CLIENT_ONBOARDING_ROLLBACK_IN_PROGRESS" as const,
    status: "rollback-pending" as const,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    claimFingerprint: fingerprint(row.rollback_token_digest),
    leaseExpiresAt: toIso(row.rollback_lease_expires_at_ms),
    mutationDelta: null,
  });
}

function toRolledBackReplay(row: ReceiptRow): LocalClientOnboardingRolledBackReplay {
  return Object.freeze({
    success: true as const,
    claimed: false as const,
    reclaimed: false as const,
    inProgress: false as const,
    replayed: true as const,
    code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_ALREADY_ROLLED_BACK" as const,
    status: "rolled-back" as const,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    rolledBackAt: toIso(row.rolled_back_at_ms),
    retireAt: toIso(row.retire_at_ms),
    mutationDelta: null,
  });
}

function toMarkedResult(
  row: ReceiptRow,
  alreadyRolledBack: boolean,
): LocalClientOnboardingRolledBackResult {
  return Object.freeze({
    success: true as const,
    marked: true as const,
    alreadyRolledBack,
    code: alreadyRolledBack
      ? "LOCAL_CLIENT_ONBOARDING_RECEIPT_ALREADY_ROLLED_BACK" as const
      : "LOCAL_CLIENT_ONBOARDING_RECEIPT_ROLLED_BACK" as const,
    status: "rolled-back" as const,
    receiptDigest: row.receipt_digest,
    receiptContentFingerprint: row.receipt_content_fingerprint,
    fencingToken: row.rollback_fencing_token,
    rolledBackAt: toIso(row.rolled_back_at_ms),
    retireAt: toIso(row.retire_at_ms),
    mutationDelta: null,
  });
}

function assertOptions(options: LocalClientSqliteOnboardingReceiptAuthorityStoreOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  assertExactKeys(options, [
    "sqlitePath",
    "hostId",
    "integrityKey",
    "namespace",
    "ttlMs",
    "leaseTtlMs",
    "maxRows",
    "busyTimeoutMs",
    "now",
  ], true, configurationError);
  if (
    !Object.hasOwn(options, "sqlitePath")
    || !Object.hasOwn(options, "hostId")
    || !Object.hasOwn(options, "integrityKey")
  ) throw configurationError();
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  allowMissing: boolean,
  errorFactory: () => Error,
): void {
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
    throw errorFactory();
  }
  if (!allowMissing && allowedKeys.some((key) => !Object.hasOwn(value, key))) {
    throw errorFactory();
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
  ) throw configurationError();
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
  if (typeof value !== "string" || !NAMESPACE_PATTERN.test(value)) throw configurationError();
  return value;
}

function cloneIntegrityKey(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < 32 || value.byteLength > 64) {
    throw configurationError();
  }
  return Buffer.from(value);
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

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0 || result > MAX_DATE_MS) throw clockError();
  return result;
}

function parseCanonicalIso(value: unknown): number {
  if (
    typeof value !== "string"
    || value.length < 20
    || value.length > 32
    || value !== value.trim()
  ) throw inputError();
  const parsed = Date.parse(value);
  if (!isSafeNonNegativeInteger(parsed) || parsed > MAX_DATE_MS) throw inputError();
  try {
    if (new Date(parsed).toISOString() !== value) throw inputError();
  } catch {
    throw inputError();
  }
  return parsed;
}

function readPragmaInteger(db: DatabaseSync, name: "user_version"): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value) || value < 0) throw schemaError();
  return value;
}

function selectReceiptFields(): string {
  return `SELECT
    record_version, identity_binding_hmac, profile_id, action,
    receipt_digest, receipt_content_fingerprint, applied_at_ms,
    retire_at_ms, status, rollback_token_digest, rollback_fencing_token,
    rollback_claimed_at_ms, rollback_lease_expires_at_ms,
    rollback_claim_count, rolled_back_at_ms, row_hmac
    FROM local_client_onboarding_receipt_authority`;
}

function keyedDigest(key: Uint8Array, domain: string, value: string): string {
  return createHmac("sha256", key)
    .update(HMAC_DOMAIN, "utf8")
    .update("\u0000", "utf8")
    .update(domain, "utf8")
    .update("\u0000", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

function digestBearer(key: Uint8Array, bearer: string): string {
  return keyedDigest(key, "rollback-bearer", bearer);
}

function safeDigestEqual(left: string, right: string): boolean {
  if (!isDigest(left) || !isDigest(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function fingerprint(digest: string): string {
  if (!isDigest(digest)) throw integrityError();
  return digest.slice(0, 16);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isProfileId(value: unknown): value is LocalClientOnboardingReceiptProfileId {
  return typeof value === "string" && PROFILE_IDS.has(value as LocalClientOnboardingReceiptProfileId);
}

function isAction(value: unknown): value is LocalClientOnboardingAppliedAction {
  return typeof value === "string" && ACTIONS.has(value as LocalClientOnboardingAppliedAction);
}

function isStatus(value: unknown): value is LocalClientOnboardingReceiptAuthorityStatus {
  return typeof value === "string" && STATUSES.has(value as LocalClientOnboardingReceiptAuthorityStatus);
}

function parseFencingToken(value: string, allowZero: boolean): bigint {
  if (!isFencingToken(value, allowZero)) throw integrityError();
  return BigInt(value);
}

function isFencingToken(value: unknown, allowZero: boolean): value is string {
  if (typeof value !== "string" || !FENCING_PATTERN.test(value)) return false;
  try {
    const parsed = BigInt(value);
    return parsed <= MAX_FENCING_TOKEN && (allowZero ? parsed >= 0n : parsed > 0n);
  } catch {
    return false;
  }
}

function toIso(value: number): string {
  try { return new Date(value).toISOString(); } catch { throw integrityError(); }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
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

function isKnownError(
  error: unknown,
): error is LocalClientSqliteOnboardingReceiptAuthorityStoreError {
  return error instanceof LocalClientSqliteOnboardingReceiptAuthorityStoreError;
}

function authorityError(
  code: LocalClientSqliteOnboardingReceiptAuthorityStoreErrorCode,
  message: string,
  category: LocalClientSqliteOnboardingReceiptAuthorityStoreError["category"],
  statusCode: number,
  retryable = false,
) {
  return new LocalClientSqliteOnboardingReceiptAuthorityStoreError(
    code,
    message,
    category,
    statusCode,
    retryable,
  );
}

function configurationError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFIGURATION_INVALID",
    "The local-client onboarding receipt authority configuration is invalid.",
    "configuration",
    500,
  );
}

function inputError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INPUT_INVALID",
    "The local-client onboarding receipt authority input is invalid.",
    "validation",
    400,
  );
}

function conflictError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT",
    "The onboarding receipt does not match its recorded authority binding.",
    "conflict",
    409,
  );
}

function notFoundError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NOT_FOUND",
    "No active onboarding receipt authority exists for this receipt.",
    "not_found",
    404,
  );
}

function receiptExpiredError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_EXPIRED",
    "The onboarding receipt authority retention window expired.",
    "not_found",
    410,
  );
}

function claimInvalidError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_INVALID",
    "A complete onboarding rollback claim is required.",
    "validation",
    400,
  );
}

function claimStaleError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_STALE",
    "The onboarding rollback claim is stale or does not own this receipt.",
    "lease",
    409,
  );
}

function claimExpiredError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_EXPIRED",
    "The onboarding rollback claim expired before completion.",
    "lease",
    409,
    true,
  );
}

function capacityError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CAPACITY",
    "The bounded onboarding receipt authority store is full.",
    "capacity",
    429,
    true,
  );
}

function schemaError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SCHEMA_INCOMPATIBLE",
    "The onboarding receipt authority schema is incompatible.",
    "persistence",
    500,
  );
}

function hostMismatchError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_HOST_MISMATCH",
    "The onboarding receipt authority belongs to another host.",
    "configuration",
    500,
  );
}

function keyMismatchError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_KEY_MISMATCH",
    "The onboarding receipt authority is bound to another integrity key.",
    "configuration",
    500,
  );
}

function closedError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLOSED",
    "The onboarding receipt authority store is closed.",
    "persistence",
    503,
  );
}

function unavailableError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_STORE_UNAVAILABLE",
    "The onboarding receipt authority store is unavailable.",
    "persistence",
    503,
    true,
  );
}

function clockError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLOCK_INVALID",
    "The onboarding receipt authority clock moved backwards or is invalid.",
    "integrity",
    503,
  );
}

function integrityError() {
  return authorityError(
    "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INTEGRITY_INVALID",
    "The onboarding receipt authority failed an integrity check.",
    "integrity",
    500,
  );
}
