import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION = 2 as const;

export const LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_BOUNDARIES = Object.freeze({
  mode: "sqlite-execution-feedback-outbox" as const,
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  journalMode: "wal" as const,
  synchronous: "full" as const,
  deliverySemantics: "at-least-once-leased-outbox" as const,
  enqueueIdempotency: "stable-event-id-with-bounded-delivered-retention" as const,
  pendingRetainedUntilDelivered: true as const,
  deliveredRetention: "logical-ttl-with-bounded-purge" as const,
  physicalDeletion: "best-effort-secure-delete-wal-dependent" as const,
  pendingTtlApplied: false as const,
  exclusiveBatchLeases: true as const,
  monotonicFencing: true as const,
  monotonicWithinDatabaseHistory: true as const,
  rollbackResistant: false as const,
  capacityPolicy: "fail-closed" as const,
  rowIntegrity: "hmac-sha256" as const,
  metadataIntegrity: "hmac-sha256" as const,
  activeEventSetIntegrity: "hmac-member-xor-plus-count" as const,
  hostBinding: "hmac-sha256" as const,
  namespaceBinding: "hmac-sha256" as const,
  clockRollbackPolicy: "fail-closed" as const,
  trustedSchema: false as const,
  secureDelete: true as const,
  defensiveMode: "runtime-detected-optional-hardening" as const,
  integrityKeyOwnership: "consumed-buffer-zeroized" as const,
  rawLeaseTokenPersisted: false as const,
  rawReceiptPersisted: false as const,
  rawResponseBodyPersisted: false as const,
  rawSecretPersisted: false as const,
  acceptedStatus: "success" as const,
  callerMustVerifyExecutionReceipt: true as const,
  receiptVerificationPerformed: false as const,
  feedbackDeliveryPerformed: false as const,
});

/**
 * A deliberately content-free feedback envelope derived by the caller only
 * after it has verified the execution receipt. The outbox never accepts or
 * persists the receipt, response body, error text, request payload, or secret.
 */
export interface LocalClientVerifiedReceiptFeedbackEnvelope {
  readonly eventId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly clientId: string;
  readonly taskId: string;
  readonly capabilities: readonly string[];
  readonly status: "success";
  readonly latencyMs: number;
  readonly observedAt: string;
}

export interface LocalClientSqliteExecutionFeedbackOutboxOptions {
  readonly sqlitePath: string;
  readonly hostId: string;
  /**
   * A dedicated 32-64 byte Buffer. Construction consumes and zeroes the
   * caller-owned buffer after cloning it into private store-owned memory.
   */
  readonly integrityKey: Buffer;
  readonly namespace?: string;
  readonly deliveredTtlMs?: number;
  readonly leaseTtlMs?: number;
  readonly maxEvents?: number;
  readonly maxBatchSize?: number;
  readonly busyTimeoutMs?: number;
  readonly now?: () => number;
}

export type LocalClientExecutionFeedbackEnqueueResult = Readonly<{
  success: true;
  queued: boolean;
  replayed: boolean;
  code:
    | "LOCAL_CLIENT_EXECUTION_FEEDBACK_QUEUED"
    | "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENQUEUE_REPLAYED";
  state: "pending" | "delivered";
  eventFingerprint: string;
  contentFingerprint: string;
  enqueuedAt: string;
}>;

export type LocalClientExecutionFeedbackDelivery = Readonly<{
  eventFingerprint: string;
  contentFingerprint: string;
  envelope: LocalClientVerifiedReceiptFeedbackEnvelope;
  enqueuedAt: string;
  claimCount: number;
}>;

export interface LocalClientExecutionFeedbackClaimBatchRequest {
  readonly limit: number;
}

export type LocalClientExecutionFeedbackLease = Readonly<{
  leaseToken: string;
  leaseTokenFingerprint: string;
  fencingToken: string;
  claimedAt: string;
  expiresAt: string;
  eventFingerprints: readonly string[];
}>;

export type LocalClientExecutionFeedbackClaimBatchResult = Readonly<{
  success: true;
  claimed: boolean;
  code:
    | "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_CLAIMED"
    | "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_EMPTY";
  lease: LocalClientExecutionFeedbackLease | null;
  deliveries: readonly LocalClientExecutionFeedbackDelivery[];
}>;

export interface LocalClientExecutionFeedbackClaimReference {
  readonly leaseToken: string;
  readonly fencingToken: string;
  readonly eventFingerprints: readonly string[];
}

export type LocalClientExecutionFeedbackDeliveredAcknowledgement = Readonly<{
  success: true;
  acknowledged: true;
  alreadyDelivered: boolean;
  code:
    | "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_DELIVERED"
    | "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_ALREADY_DELIVERED";
  fencingToken: string;
  deliveredAt: string;
  retireAt: string;
  eventFingerprints: readonly string[];
}>;

export type LocalClientExecutionFeedbackClaimRelease = Readonly<{
  success: true;
  released: true;
  code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_RELEASED";
  fencingToken: string;
  eventFingerprints: readonly string[];
}>;

export type LocalClientSqliteExecutionFeedbackOutboxErrorCode =
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENVELOPE_INVALID"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_EVENT_CONFLICT"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_INVALID"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_NOT_FOUND"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_STALE"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_EXPIRED"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CAPACITY"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_HOST_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_KEY_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOSED"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_UNAVAILABLE"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOCK_INVALID"
  | "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID";

export class LocalClientSqliteExecutionFeedbackOutboxError extends Error {
  readonly code: LocalClientSqliteExecutionFeedbackOutboxErrorCode;
  readonly category:
    | "configuration"
    | "validation"
    | "conflict"
    | "lease"
    | "capacity"
    | "persistence"
    | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientSqliteExecutionFeedbackOutboxErrorCode,
    message: string,
    category: LocalClientSqliteExecutionFeedbackOutboxError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientSqliteExecutionFeedbackOutboxError";
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
  delivered_ttl_ms: number;
  lease_ttl_ms: number;
  max_events: number;
  max_batch_size: number;
  busy_timeout_ms: number;
  last_clock_ms: number;
  last_fencing_token: string;
  active_event_count: number;
  active_event_accumulator: string;
  metadata_hmac: string;
};

type OutboxRow = {
  record_version: number;
  event_key_hmac: string;
  content_hmac: string;
  tenant_id: string;
  subject_id: string;
  client_id: string;
  event_id: string;
  task_id: string;
  capabilities_json: string;
  feedback_status: string;
  latency_ms: number;
  observed_at_ms: number;
  enqueued_at_ms: number;
  delivery_status: string;
  lease_token_hmac: string;
  lease_fencing_token: string;
  lease_claimed_at_ms: number;
  lease_expires_at_ms: number;
  claim_count: number;
  delivered_at_ms: number;
  retire_at_ms: number;
  row_hmac: string;
};

type NormalizedEnvelope = Readonly<{
  eventId: string;
  tenantId: string;
  subjectId: string;
  clientId: string;
  taskId: string;
  capabilities: readonly string[];
  status: "success";
  latencyMs: number;
  observedAt: string;
  observedAtMs: number;
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 1;
const DEFAULT_NAMESPACE = "local-client-execution-feedback-outbox";
const DEFAULT_DELIVERED_TTL_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_EVENTS = 50_000;
const DEFAULT_MAX_BATCH_SIZE = 100;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_FUTURE_OBSERVATION_SKEW_MS = 5 * 60_000;
const MIN_TTL_MS = 10;
const MAX_TTL_MS = 90 * 24 * 60 * 60_000;
const MIN_LEASE_TTL_MS = 10;
const MAX_LEASE_TTL_MS = 60 * 60_000;
const MAX_EVENTS = 1_000_000;
const MAX_BATCH_SIZE = 1_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_LATENCY_MS = 24 * 60 * 60_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_ID_LENGTH = 256;
const MAX_CAPABILITIES = 64;
const MAX_CAPABILITIES_JSON_LENGTH = 8_321;
const MAX_DATE_MS = 8_640_000_000_000_000;
const MAX_LEASE_TOKEN_LENGTH = 512;
const MAX_FENCING_TOKEN = 9_223_372_036_854_775_807n;
const PURGE_BATCH_SIZE = 64;
const INTEGRITY_SCAN_PAGE_SIZE = 64;
const EMPTY_ACTIVE_EVENT_ACCUMULATOR = "0".repeat(64);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9._:-]{0,127}$/u;
const DELIVERY_STATUS_PATTERN = /^(?:pending|delivered)$/u;
const HMAC_DOMAIN = "unified-ai/local-client-execution-feedback-outbox/v1";

/**
 * Durable, bounded, single-host outbox. It persists only the minimal feedback
 * envelope; it neither verifies receipts nor mutates the feedback aggregate.
 */
export class LocalClientSqliteExecutionFeedbackOutbox {
  readonly #db!: DatabaseSync;
  readonly #sqlitePath: string;
  readonly #key: Buffer;
  readonly #hostBindingHmac: string;
  readonly #namespaceBindingHmac: string;
  readonly #keyBindingHmac: string;
  readonly #deliveredTtlMs: number;
  readonly #leaseTtlMs: number;
  readonly #maxEvents: number;
  readonly #maxBatchSize: number;
  readonly #busyTimeoutMs: number;
  readonly #now: () => number;
  readonly #defensiveApiAvailable!: boolean;
  readonly #defensiveEnabled!: boolean;
  #closed = false;
  #closeFailed = false;
  #available = true;

  constructor(options: LocalClientSqliteExecutionFeedbackOutboxOptions) {
    const callerIntegrityKey = extractCallerIntegrityKey(options);
    let privateIntegrityKey: Buffer | null = null;
    try {
      assertOptions(options);
      const sqlitePath = resolveSqlitePath(options.sqlitePath);
      const hostId = assertHostId(options.hostId);
      const namespace = assertNamespace(options.namespace ?? DEFAULT_NAMESPACE);
      const deliveredTtlMs = boundedInteger(
        options.deliveredTtlMs,
        DEFAULT_DELIVERED_TTL_MS,
        MIN_TTL_MS,
        MAX_TTL_MS,
      );
      const leaseTtlMs = boundedInteger(
        options.leaseTtlMs,
        DEFAULT_LEASE_TTL_MS,
        MIN_LEASE_TTL_MS,
        MAX_LEASE_TTL_MS,
      );
      const maxEvents = boundedInteger(options.maxEvents, DEFAULT_MAX_EVENTS, 1, MAX_EVENTS);
      const maxBatchSize = boundedInteger(
        options.maxBatchSize,
        DEFAULT_MAX_BATCH_SIZE,
        1,
        MAX_BATCH_SIZE,
      );
      if (maxBatchSize > maxEvents) throw configurationError();
      const busyTimeoutMs = boundedInteger(
        options.busyTimeoutMs,
        DEFAULT_BUSY_TIMEOUT_MS,
        100,
        MAX_BUSY_TIMEOUT_MS,
      );
      if (options.now !== undefined && typeof options.now !== "function") {
        throw configurationError();
      }

      this.#sqlitePath = sqlitePath;
      privateIntegrityKey = cloneIntegrityKey(options.integrityKey);
      this.#key = privateIntegrityKey;
      this.#hostBindingHmac = keyedDigest(this.#key, "host-binding", hostId);
      this.#namespaceBindingHmac = keyedDigest(this.#key, "namespace-binding", namespace);
      this.#keyBindingHmac = keyedDigest(
        this.#key,
        "key-binding",
        canonicalJson({ schemaVersion: LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION }),
      );
      this.#deliveredTtlMs = deliveredTtlMs;
      this.#leaseTtlMs = leaseTtlMs;
      this.#maxEvents = maxEvents;
      this.#maxBatchSize = maxBatchSize;
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
        const trustedSchema = this.#db.prepare("PRAGMA trusted_schema").get() as
          | { trusted_schema?: unknown }
          | undefined;
        if (Number(trustedSchema?.trusted_schema) !== 0) throw schemaError();
        this.#db.exec("PRAGMA foreign_keys = ON");
        this.#db.exec("PRAGMA secure_delete = ON");
        const secureDelete = this.#db.prepare("PRAGMA secure_delete").get() as
          | { secure_delete?: unknown }
          | undefined;
        if (Number(secureDelete?.secure_delete) !== 1) throw schemaError();
        this.#initializeSchema();
        const defensive = (this.#db as DatabaseSync & {
          enableDefensive?: (enabled: boolean) => void;
        }).enableDefensive;
        this.#defensiveApiAvailable = typeof defensive === "function";
        if (typeof defensive === "function") Reflect.apply(defensive, this.#db, [true]);
        this.#defensiveEnabled = this.#defensiveApiAvailable;
        this.#assertDatabaseHealthy();
        this.#assertNoUnexpectedTriggers();
        this.#scanRows();
        try { chmodSync(this.#sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
      } catch (error) {
        try { this.#db?.close(); } catch { /* Preserve initialization error. */ }
        this.#key.fill(0);
        if (isKnownError(error)) throw error;
        throw unavailableError();
      }
    } catch (error) {
      privateIntegrityKey?.fill(0);
      throw error;
    } finally {
      callerIntegrityKey?.fill(0);
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_BOUNDARIES,
      available: !this.#closed && !this.#closeFailed && this.#available,
      closed: this.#closed,
      closeFailed: this.#closeFailed,
      schemaVersion: LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION,
      defensive: this.#defensiveEnabled,
      defensiveApiAvailable: this.#defensiveApiAvailable,
      defensiveEnabled: this.#defensiveEnabled,
      deliveredTtlMs: this.#deliveredTtlMs,
      leaseTtlMs: this.#leaseTtlMs,
      maxEvents: this.#maxEvents,
      maxBatchSize: this.#maxBatchSize,
      busyTimeoutMs: this.#busyTimeoutMs,
      purgeBatchSize: PURGE_BATCH_SIZE,
      integrityScanPageSize: INTEGRITY_SCAN_PAGE_SIZE,
      maxFutureObservationSkewMs: MAX_FUTURE_OBSERVATION_SKEW_MS,
    });
  }

  getStatus() {
    return this.status;
  }

  async enqueue(
    input: LocalClientVerifiedReceiptFeedbackEnvelope,
  ): Promise<LocalClientExecutionFeedbackEnqueueResult> {
    this.#assertOpen();
    const envelope = normalizeEnvelope(input);
    const eventKeyHmac = digestEventKey(this.#key, envelope.tenantId, envelope.eventId);
    const contentHmac = digestEnvelope(this.#key, envelope);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      if (envelope.observedAtMs > safeAdd(nowMs, MAX_FUTURE_OBSERVATION_SKEW_MS)) {
        throw envelopeInvalidError();
      }
      this.#purgeDelivered(nowMs);
      const existing = this.#selectByEventKey(eventKeyHmac);
      if (existing) {
        const row = this.#decodeRow(existing);
        if (!safeDigestEqual(row.content_hmac, contentHmac)) throw conflictError();
        return toEnqueueReplay(row);
      }
      if (this.#countAll() >= this.#maxEvents) throw capacityError();
      const row = createPendingRow(this.#key, envelope, eventKeyHmac, contentHmac, nowMs);
      const result = this.#db.prepare(`
        INSERT INTO local_client_execution_feedback_outbox (
          record_version, event_key_hmac, content_hmac, tenant_id, subject_id,
          client_id, event_id, task_id, capabilities_json, feedback_status,
          latency_ms, observed_at_ms, enqueued_at_ms, delivery_status,
          lease_token_hmac, lease_fencing_token, lease_claimed_at_ms,
          lease_expires_at_ms, claim_count, delivered_at_ms, retire_at_ms, row_hmac
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...rowValues(row));
      if (Number(result.changes) !== 1) throw integrityError();
      this.#updateActiveEventSet([], [row]);
      return Object.freeze({
        success: true as const,
        queued: true as const,
        replayed: false as const,
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_QUEUED" as const,
        state: "pending" as const,
        eventFingerprint: row.event_key_hmac,
        contentFingerprint: row.content_hmac,
        enqueuedAt: toIso(row.enqueued_at_ms),
      });
    });
  }

  async claimBatch(
    request: LocalClientExecutionFeedbackClaimBatchRequest,
  ): Promise<LocalClientExecutionFeedbackClaimBatchResult> {
    this.#assertOpen();
    const limit = normalizeBatchRequest(request, this.#maxBatchSize);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeDelivered(nowMs);
      const candidates = this.#db.prepare(`
        ${selectOutboxFields()}
        WHERE delivery_status = 'pending'
          AND (lease_token_hmac = '' OR lease_expires_at_ms <= ?)
        ORDER BY enqueued_at_ms ASC, event_key_hmac ASC
        LIMIT ?
      `).all(nowMs, limit) as unknown as OutboxRow[];
      if (candidates.length === 0) {
        return Object.freeze({
          success: true as const,
          claimed: false as const,
          code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_EMPTY" as const,
          lease: null,
          deliveries: Object.freeze([]) as readonly LocalClientExecutionFeedbackDelivery[],
        });
      }
      const leaseToken = randomBytes(32).toString("base64url");
      const leaseTokenHmac = keyedDigest(this.#key, "lease-token", leaseToken);
      const fencingToken = this.#allocateFencingToken();
      const expiresAtMs = safeAdd(nowMs, this.#leaseTtlMs);
      const claimedRows = candidates.map((candidate) => {
        const current = this.#decodeRow(candidate);
        const updated = createRow(this.#key, {
          ...current,
          lease_token_hmac: leaseTokenHmac,
          lease_fencing_token: fencingToken,
          lease_claimed_at_ms: nowMs,
          lease_expires_at_ms: expiresAtMs,
          claim_count: current.claim_count + 1,
        });
        this.#replaceRow(current, updated);
        return updated;
      });
      const eventFingerprints = Object.freeze(claimedRows.map((row) => row.event_key_hmac));
      return Object.freeze({
        success: true as const,
        claimed: true as const,
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_CLAIMED" as const,
        lease: Object.freeze({
          leaseToken,
          leaseTokenFingerprint: leaseTokenHmac.slice(0, 16),
          fencingToken,
          claimedAt: toIso(nowMs),
          expiresAt: toIso(expiresAtMs),
          eventFingerprints,
        }),
        deliveries: Object.freeze(claimedRows.map(toDelivery)),
      });
    });
  }

  async acknowledgeDelivered(
    input: LocalClientExecutionFeedbackClaimReference,
  ): Promise<LocalClientExecutionFeedbackDeliveredAcknowledgement> {
    this.#assertOpen();
    const reference = normalizeClaimReference(input, this.#maxBatchSize);
    const leaseTokenHmac = keyedDigest(this.#key, "lease-token", reference.leaseToken);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeDelivered(nowMs);
      const rows = this.#loadExactClaimBatch(reference, leaseTokenHmac);
      const deliveredCount = rows.filter((row) => row.delivery_status === "delivered").length;
      if (deliveredCount !== 0 && deliveredCount !== rows.length) throw integrityError();
      if (deliveredCount === rows.length) return toDeliveredAcknowledgement(rows, true);
      if (rows.some((row) => nowMs >= row.lease_expires_at_ms)) throw claimExpiredError();
      const retireAtMs = safeAdd(nowMs, this.#deliveredTtlMs);
      const updatedRows = rows.map((row) => {
        const updated = createRow(this.#key, {
          ...row,
          delivery_status: "delivered",
          delivered_at_ms: nowMs,
          retire_at_ms: retireAtMs,
        });
        this.#replaceRow(row, updated);
        return updated;
      });
      return toDeliveredAcknowledgement(updatedRows, false);
    });
  }

  async releaseClaim(
    input: LocalClientExecutionFeedbackClaimReference,
  ): Promise<LocalClientExecutionFeedbackClaimRelease> {
    this.#assertOpen();
    const reference = normalizeClaimReference(input, this.#maxBatchSize);
    const leaseTokenHmac = keyedDigest(this.#key, "lease-token", reference.leaseToken);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeDelivered(nowMs);
      const rows = this.#loadExactClaimBatch(reference, leaseTokenHmac);
      rows.forEach((row) => {
        if (row.delivery_status !== "pending") throw claimStaleError();
      });
      rows.forEach((row) => {
        const updated = createRow(this.#key, {
          ...row,
          lease_token_hmac: "",
          lease_fencing_token: "0",
          lease_claimed_at_ms: 0,
          lease_expires_at_ms: 0,
        });
        this.#replaceRow(row, updated);
      });
      return Object.freeze({
        success: true as const,
        released: true as const,
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_RELEASED" as const,
        fencingToken: reference.fencingToken,
        eventFingerprints: Object.freeze([...reference.eventFingerprints]),
      });
    });
  }

  async checkHealth() {
    this.#assertOpen();
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeDelivered(nowMs);
      this.#assertDatabaseHealthy();
      this.#scanRows();
      const counts = this.#countStates(nowMs);
      return Object.freeze({ ...this.status, ...counts });
    });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    try {
      this.#db.close();
      this.#closed = true;
      this.#closeFailed = false;
    } catch {
      this.#closeFailed = true;
      throw unavailableError();
    } finally {
      this.#key.fill(0);
    }
  }

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      const userVersion = readUserVersion(this.#db);
      if (
        userVersion !== 0
        && userVersion !== LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION
      ) throw schemaError();
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_execution_feedback_outbox_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          host_binding_hmac TEXT NOT NULL,
          namespace_binding_hmac TEXT NOT NULL,
          key_binding_hmac TEXT NOT NULL,
          delivered_ttl_ms INTEGER NOT NULL CHECK (delivered_ttl_ms > 0),
          lease_ttl_ms INTEGER NOT NULL CHECK (lease_ttl_ms > 0),
          max_events INTEGER NOT NULL CHECK (max_events > 0),
          max_batch_size INTEGER NOT NULL CHECK (max_batch_size > 0),
          busy_timeout_ms INTEGER NOT NULL CHECK (busy_timeout_ms > 0),
          last_clock_ms INTEGER NOT NULL CHECK (last_clock_ms >= 0),
          last_fencing_token TEXT NOT NULL,
          active_event_count INTEGER NOT NULL CHECK (active_event_count >= 0),
          active_event_accumulator TEXT NOT NULL,
          metadata_hmac TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_execution_feedback_outbox (
          record_version INTEGER NOT NULL,
          event_key_hmac TEXT PRIMARY KEY,
          content_hmac TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          capabilities_json TEXT NOT NULL,
          feedback_status TEXT NOT NULL CHECK (feedback_status = 'success'),
          latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
          observed_at_ms INTEGER NOT NULL CHECK (observed_at_ms >= 0),
          enqueued_at_ms INTEGER NOT NULL CHECK (enqueued_at_ms >= 0),
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'delivered')),
          lease_token_hmac TEXT NOT NULL,
          lease_fencing_token TEXT NOT NULL,
          lease_claimed_at_ms INTEGER NOT NULL CHECK (lease_claimed_at_ms >= 0),
          lease_expires_at_ms INTEGER NOT NULL CHECK (lease_expires_at_ms >= 0),
          claim_count INTEGER NOT NULL CHECK (claim_count >= 0),
          delivered_at_ms INTEGER NOT NULL CHECK (delivered_at_ms >= 0),
          retire_at_ms INTEGER NOT NULL CHECK (retire_at_ms >= 0),
          row_hmac TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_execution_feedback_outbox_claim_idx
          ON local_client_execution_feedback_outbox (
            delivery_status, lease_expires_at_ms, enqueued_at_ms, event_key_hmac
          );
        CREATE INDEX IF NOT EXISTS local_client_execution_feedback_outbox_retire_idx
          ON local_client_execution_feedback_outbox (delivery_status, retire_at_ms);
      `);
      this.#assertNoUnexpectedTriggers();
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        if (metadata || this.#countAll() !== 0) throw schemaError();
        const initial = createMetadataRow(this.#key, {
          hostBindingHmac: this.#hostBindingHmac,
          namespaceBindingHmac: this.#namespaceBindingHmac,
          keyBindingHmac: this.#keyBindingHmac,
          deliveredTtlMs: this.#deliveredTtlMs,
          leaseTtlMs: this.#leaseTtlMs,
          maxEvents: this.#maxEvents,
          maxBatchSize: this.#maxBatchSize,
          busyTimeoutMs: this.#busyTimeoutMs,
          lastClockMs: 0,
          lastFencingToken: "0",
          activeEventCount: 0,
          activeEventAccumulator: EMPTY_ACTIVE_EVENT_ACCUMULATOR,
        });
        this.#db.prepare(`
          INSERT INTO local_client_execution_feedback_outbox_metadata (
            singleton, schema_version, host_binding_hmac, namespace_binding_hmac,
            key_binding_hmac, delivered_ttl_ms, lease_ttl_ms, max_events,
            max_batch_size, busy_timeout_ms, last_clock_ms,
            last_fencing_token, active_event_count,
            active_event_accumulator, metadata_hmac
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.host_binding_hmac,
          initial.namespace_binding_hmac,
          initial.key_binding_hmac,
          initial.delivered_ttl_ms,
          initial.lease_ttl_ms,
          initial.max_events,
          initial.max_batch_size,
          initial.busy_timeout_ms,
          initial.last_clock_ms,
          initial.last_fencing_token,
          initial.active_event_count,
          initial.active_event_accumulator,
          initial.metadata_hmac,
        );
        this.#db.exec(
          `PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION}`,
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
      deliveredTtlMs: metadata.delivered_ttl_ms,
      leaseTtlMs: metadata.lease_ttl_ms,
      maxEvents: metadata.max_events,
      maxBatchSize: metadata.max_batch_size,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastClockMs: nowMs,
      lastFencingToken: metadata.last_fencing_token,
      activeEventCount: metadata.active_event_count,
      activeEventAccumulator: metadata.active_event_accumulator,
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
      deliveredTtlMs: metadata.delivered_ttl_ms,
      leaseTtlMs: metadata.lease_ttl_ms,
      maxEvents: metadata.max_events,
      maxBatchSize: metadata.max_batch_size,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastClockMs: metadata.last_clock_ms,
      lastFencingToken: fencingToken,
      activeEventCount: metadata.active_event_count,
      activeEventAccumulator: metadata.active_event_accumulator,
    });
    this.#replaceMetadata(metadata, updated);
    return fencingToken;
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, host_binding_hmac, namespace_binding_hmac,
             key_binding_hmac, delivered_ttl_ms, lease_ttl_ms, max_events,
             max_batch_size, busy_timeout_ms, last_clock_ms,
             last_fencing_token, active_event_count,
             active_event_accumulator, metadata_hmac
      FROM local_client_execution_feedback_outbox_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION
      || !isDigest(row.host_binding_hmac)
      || !isDigest(row.namespace_binding_hmac)
      || !isDigest(row.key_binding_hmac)
      || !isPositiveInteger(row.delivered_ttl_ms)
      || !isPositiveInteger(row.lease_ttl_ms)
      || !isPositiveInteger(row.max_events)
      || !isPositiveInteger(row.max_batch_size)
      || !isPositiveInteger(row.busy_timeout_ms)
      || !isNonNegativeInteger(row.last_clock_ms)
      || row.last_clock_ms > MAX_DATE_MS
      || !isFencingToken(row.last_fencing_token, true)
      || !isNonNegativeInteger(row.active_event_count)
      || row.active_event_count > row.max_events
      || !isDigest(row.active_event_accumulator)
      || !isDigest(row.metadata_hmac)
    ) throw integrityError();
    if (!safeDigestEqual(row.key_binding_hmac, this.#keyBindingHmac)) throw keyMismatchError();
    const expected = digestMetadataRow(this.#key, row);
    if (!safeDigestEqual(row.metadata_hmac, expected)) throw integrityError();
    if (!safeDigestEqual(row.host_binding_hmac, this.#hostBindingHmac)) throw hostMismatchError();
    if (!safeDigestEqual(row.namespace_binding_hmac, this.#namespaceBindingHmac)) {
      throw namespaceMismatchError();
    }
    if (
      row.delivered_ttl_ms !== this.#deliveredTtlMs
      || row.lease_ttl_ms !== this.#leaseTtlMs
      || row.max_events !== this.#maxEvents
      || row.max_batch_size !== this.#maxBatchSize
      || row.busy_timeout_ms !== this.#busyTimeoutMs
    ) throw configurationError();
  }

  #replaceMetadata(previous: MetadataRow, updated: MetadataRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_execution_feedback_outbox_metadata
      SET last_clock_ms = ?, last_fencing_token = ?, active_event_count = ?,
          active_event_accumulator = ?, metadata_hmac = ?
      WHERE singleton = ? AND metadata_hmac = ?
    `).run(
      updated.last_clock_ms,
      updated.last_fencing_token,
      updated.active_event_count,
      updated.active_event_accumulator,
      updated.metadata_hmac,
      METADATA_SINGLETON,
      previous.metadata_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #updateActiveEventSet(
    removedRows: readonly OutboxRow[],
    addedRows: readonly OutboxRow[],
  ): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    const activeEventCount = metadata.active_event_count - removedRows.length + addedRows.length;
    if (
      !isNonNegativeInteger(activeEventCount)
      || activeEventCount > this.#maxEvents
    ) throw integrityError();
    let accumulator = metadata.active_event_accumulator;
    for (const row of removedRows) {
      accumulator = xorDigests(accumulator, digestActiveEventMember(this.#key, row));
    }
    for (const row of addedRows) {
      accumulator = xorDigests(accumulator, digestActiveEventMember(this.#key, row));
    }
    const updated = createMetadataRow(this.#key, {
      hostBindingHmac: metadata.host_binding_hmac,
      namespaceBindingHmac: metadata.namespace_binding_hmac,
      keyBindingHmac: metadata.key_binding_hmac,
      deliveredTtlMs: metadata.delivered_ttl_ms,
      leaseTtlMs: metadata.lease_ttl_ms,
      maxEvents: metadata.max_events,
      maxBatchSize: metadata.max_batch_size,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastClockMs: metadata.last_clock_ms,
      lastFencingToken: metadata.last_fencing_token,
      activeEventCount,
      activeEventAccumulator: accumulator,
    });
    this.#replaceMetadata(metadata, updated);
  }

  #assertActiveEventCount(): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    if (this.#countAll() !== metadata.active_event_count) throw integrityError();
  }

  #assertNoUnexpectedTriggers(): void {
    const row = this.#db.prepare(`
      SELECT COUNT(*) AS count FROM sqlite_schema
      WHERE type = 'trigger'
        AND tbl_name IN (
          'local_client_execution_feedback_outbox',
          'local_client_execution_feedback_outbox_metadata'
        )
    `).get() as { count?: unknown } | undefined;
    const count = Number(row?.count ?? -1);
    if (!isNonNegativeInteger(count) || count !== 0) throw integrityError();
  }

  #selectByEventKey(eventKeyHmac: string): OutboxRow | undefined {
    return this.#db.prepare(`${selectOutboxFields()} WHERE event_key_hmac = ?`)
      .get(eventKeyHmac) as OutboxRow | undefined;
  }

  #loadExactClaimBatch(
    reference: Readonly<LocalClientExecutionFeedbackClaimReference>,
    leaseTokenHmac: string,
  ): readonly OutboxRow[] {
    const persisted = this.#db.prepare(`
      ${selectOutboxFields()}
      WHERE lease_token_hmac = ? AND lease_fencing_token = ?
    `).all(leaseTokenHmac, reference.fencingToken) as unknown as OutboxRow[];
    if (persisted.length === 0) {
      const referencedRowStillExists = reference.eventFingerprints.some((eventFingerprint) => {
        const selected = this.#selectByEventKey(eventFingerprint);
        if (!selected) return false;
        this.#decodeRow(selected);
        return true;
      });
      if (referencedRowStillExists) throw claimStaleError();
      throw batchNotFoundError();
    }
    const rowsByEvent = new Map(persisted.map((row) => {
      const decoded = this.#decodeRow(row);
      assertClaimOwner(decoded, reference.fencingToken, leaseTokenHmac);
      return [decoded.event_key_hmac, decoded] as const;
    }));
    if (
      rowsByEvent.size !== reference.eventFingerprints.length
      || reference.eventFingerprints.some((eventFingerprint) => !rowsByEvent.has(eventFingerprint))
    ) throw claimStaleError();
    return Object.freeze(reference.eventFingerprints.map((eventFingerprint) => (
      rowsByEvent.get(eventFingerprint)!
    )));
  }

  #decodeRow(row: OutboxRow): OutboxRow {
    validateRow(row);
    const expectedEventKey = digestEventKey(this.#key, row.tenant_id, row.event_id);
    if (!safeDigestEqual(row.event_key_hmac, expectedEventKey)) throw integrityError();
    const envelope = envelopeFromRow(row);
    if (!safeDigestEqual(row.content_hmac, digestEnvelope(this.#key, envelope))) {
      throw integrityError();
    }
    if (!safeDigestEqual(row.row_hmac, digestRow(this.#key, row))) throw integrityError();
    return row;
  }

  #replaceRow(previous: OutboxRow, updated: OutboxRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_execution_feedback_outbox SET
        content_hmac = ?, tenant_id = ?, subject_id = ?, client_id = ?,
        event_id = ?, task_id = ?, capabilities_json = ?, feedback_status = ?,
        latency_ms = ?, observed_at_ms = ?, enqueued_at_ms = ?,
        delivery_status = ?, lease_token_hmac = ?, lease_fencing_token = ?,
        lease_claimed_at_ms = ?, lease_expires_at_ms = ?, claim_count = ?,
        delivered_at_ms = ?, retire_at_ms = ?, row_hmac = ?
      WHERE event_key_hmac = ? AND row_hmac = ?
    `).run(
      updated.content_hmac,
      updated.tenant_id,
      updated.subject_id,
      updated.client_id,
      updated.event_id,
      updated.task_id,
      updated.capabilities_json,
      updated.feedback_status,
      updated.latency_ms,
      updated.observed_at_ms,
      updated.enqueued_at_ms,
      updated.delivery_status,
      updated.lease_token_hmac,
      updated.lease_fencing_token,
      updated.lease_claimed_at_ms,
      updated.lease_expires_at_ms,
      updated.claim_count,
      updated.delivered_at_ms,
      updated.retire_at_ms,
      updated.row_hmac,
      previous.event_key_hmac,
      previous.row_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
    this.#updateActiveEventSet([previous], [updated]);
  }

  #purgeDelivered(nowMs: number): void {
    const expired = this.#db.prepare(`
      ${selectOutboxFields()}
      WHERE delivery_status = 'delivered' AND retire_at_ms <= ?
      ORDER BY retire_at_ms ASC, event_key_hmac ASC
      LIMIT ?
    `).all(nowMs, PURGE_BATCH_SIZE) as unknown as OutboxRow[];
    expired.forEach((row) => this.#decodeRow(row));
    const deleteStatement = this.#db.prepare(`
      DELETE FROM local_client_execution_feedback_outbox
      WHERE event_key_hmac = ? AND row_hmac = ?
    `);
    for (const row of expired) {
      const result = deleteStatement.run(row.event_key_hmac, row.row_hmac);
      if (Number(result.changes) !== 1) throw integrityError();
    }
    if (expired.length > 0) this.#updateActiveEventSet(expired, []);
  }

  #countAll(): number {
    const row = this.#db.prepare(
      "SELECT COUNT(*) AS count FROM local_client_execution_feedback_outbox",
    ).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!isNonNegativeInteger(count)) throw integrityError();
    return count;
  }

  #countStates(nowMs: number) {
    const row = this.#db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN delivery_status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN delivery_status = 'pending' AND lease_token_hmac != ''
                  AND lease_expires_at_ms > ? THEN 1 ELSE 0 END) AS leased,
        SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered
      FROM local_client_execution_feedback_outbox
    `).get(nowMs) as Record<string, unknown> | undefined;
    const total = Number(row?.total ?? 0);
    const pending = Number(row?.pending ?? 0);
    const leased = Number(row?.leased ?? 0);
    const delivered = Number(row?.delivered ?? 0);
    if (![total, pending, leased, delivered].every(isNonNegativeInteger)) throw integrityError();
    return Object.freeze({ totalEvents: total, pendingEvents: pending, leasedEvents: leased, deliveredEvents: delivered });
  }

  #scanRows(): void {
    const metadata = this.#readMetadata();
    if (!metadata) throw integrityError();
    this.#assertMetadata(metadata);
    const statement = this.#db.prepare(`
      ${selectOutboxFields()}
      WHERE event_key_hmac > ?
      ORDER BY event_key_hmac ASC
      LIMIT ?
    `);
    let cursor = "";
    let activeEventCount = 0;
    let accumulator = EMPTY_ACTIVE_EVENT_ACCUMULATOR;
    while (true) {
      const rows = statement.all(cursor, INTEGRITY_SCAN_PAGE_SIZE) as unknown as OutboxRow[];
      if (rows.length === 0) break;
      for (const raw of rows) {
        const row = this.#decodeRow(raw);
        if (row.event_key_hmac <= cursor) throw integrityError();
        cursor = row.event_key_hmac;
        activeEventCount += 1;
        if (activeEventCount > this.#maxEvents) throw integrityError();
        accumulator = xorDigests(accumulator, digestActiveEventMember(this.#key, row));
      }
      if (rows.length < INTEGRITY_SCAN_PAGE_SIZE) break;
    }
    if (
      activeEventCount !== metadata.active_event_count
      || !safeDigestEqual(accumulator, metadata.active_event_accumulator)
    ) throw integrityError();
  }

  #assertDatabaseHealthy(): void {
    const row = this.#db.prepare("PRAGMA quick_check").get() as
      | { quick_check?: unknown }
      | undefined;
    if (String(row?.quick_check ?? "").toLowerCase() !== "ok") throw integrityError();
  }

  #transaction<T>(operation: () => T): T {
    try {
      const result = this.#rawTransaction(() => {
        this.#assertNoUnexpectedTriggers();
        this.#assertActiveEventCount();
        const operationResult = operation();
        this.#assertActiveEventCount();
        return operationResult;
      });
      this.#available = true;
      return result;
    } catch (error) {
      if (isKnownError(error)) {
        if (error.category === "persistence" || error.category === "integrity") {
          this.#available = false;
        }
        throw error;
      }
      this.#available = false;
      throw unavailableError();
    }
  }

  #rawTransaction<T>(operation: () => T): T {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      try { this.#db.exec("ROLLBACK"); } catch { /* Preserve original failure. */ }
      throw error;
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw closedError();
    if (this.#closeFailed) throw unavailableError();
  }
}

function createMetadataRow(
  key: Uint8Array,
  input: Readonly<{
    hostBindingHmac: string;
    namespaceBindingHmac: string;
    keyBindingHmac: string;
    deliveredTtlMs: number;
    leaseTtlMs: number;
    maxEvents: number;
    maxBatchSize: number;
    busyTimeoutMs: number;
    lastClockMs: number;
    lastFencingToken: string;
    activeEventCount: number;
    activeEventAccumulator: string;
  }>,
): MetadataRow {
  const row: MetadataRow = {
    schema_version: LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_VERSION,
    host_binding_hmac: input.hostBindingHmac,
    namespace_binding_hmac: input.namespaceBindingHmac,
    key_binding_hmac: input.keyBindingHmac,
    delivered_ttl_ms: input.deliveredTtlMs,
    lease_ttl_ms: input.leaseTtlMs,
    max_events: input.maxEvents,
    max_batch_size: input.maxBatchSize,
    busy_timeout_ms: input.busyTimeoutMs,
    last_clock_ms: input.lastClockMs,
    last_fencing_token: input.lastFencingToken,
    active_event_count: input.activeEventCount,
    active_event_accumulator: input.activeEventAccumulator,
    metadata_hmac: "",
  };
  row.metadata_hmac = digestMetadataRow(key, row);
  return row;
}

function digestMetadataRow(key: Uint8Array, row: MetadataRow): string {
  return keyedDigest(key, "metadata-row", canonicalJson({
    schemaVersion: row.schema_version,
    hostBindingHmac: row.host_binding_hmac,
    namespaceBindingHmac: row.namespace_binding_hmac,
    keyBindingHmac: row.key_binding_hmac,
    deliveredTtlMs: row.delivered_ttl_ms,
    leaseTtlMs: row.lease_ttl_ms,
    maxEvents: row.max_events,
    maxBatchSize: row.max_batch_size,
    busyTimeoutMs: row.busy_timeout_ms,
    lastClockMs: row.last_clock_ms,
    lastFencingToken: row.last_fencing_token,
    activeEventCount: row.active_event_count,
    activeEventAccumulator: row.active_event_accumulator,
  }));
}

function createPendingRow(
  key: Uint8Array,
  envelope: NormalizedEnvelope,
  eventKeyHmac: string,
  contentHmac: string,
  nowMs: number,
): OutboxRow {
  return createRow(key, {
    record_version: RECORD_VERSION,
    event_key_hmac: eventKeyHmac,
    content_hmac: contentHmac,
    tenant_id: envelope.tenantId,
    subject_id: envelope.subjectId,
    client_id: envelope.clientId,
    event_id: envelope.eventId,
    task_id: envelope.taskId,
    capabilities_json: JSON.stringify(envelope.capabilities),
    feedback_status: envelope.status,
    latency_ms: envelope.latencyMs,
    observed_at_ms: envelope.observedAtMs,
    enqueued_at_ms: nowMs,
    delivery_status: "pending",
    lease_token_hmac: "",
    lease_fencing_token: "0",
    lease_claimed_at_ms: 0,
    lease_expires_at_ms: 0,
    claim_count: 0,
    delivered_at_ms: 0,
    retire_at_ms: 0,
    row_hmac: "",
  });
}

function createRow(key: Uint8Array, input: OutboxRow): OutboxRow {
  const row: OutboxRow = { ...input, row_hmac: "" };
  row.row_hmac = digestRow(key, row);
  return row;
}

function digestRow(key: Uint8Array, row: OutboxRow): string {
  return keyedDigest(key, "outbox-row", canonicalJson({
    recordVersion: row.record_version,
    eventKeyHmac: row.event_key_hmac,
    contentHmac: row.content_hmac,
    tenantId: row.tenant_id,
    subjectId: row.subject_id,
    clientId: row.client_id,
    eventId: row.event_id,
    taskId: row.task_id,
    capabilitiesJson: row.capabilities_json,
    feedbackStatus: row.feedback_status,
    latencyMs: row.latency_ms,
    observedAtMs: row.observed_at_ms,
    enqueuedAtMs: row.enqueued_at_ms,
    deliveryStatus: row.delivery_status,
    leaseTokenHmac: row.lease_token_hmac,
    leaseFencingToken: row.lease_fencing_token,
    leaseClaimedAtMs: row.lease_claimed_at_ms,
    leaseExpiresAtMs: row.lease_expires_at_ms,
    claimCount: row.claim_count,
    deliveredAtMs: row.delivered_at_ms,
    retireAtMs: row.retire_at_ms,
  }));
}

function digestEnvelope(key: Uint8Array, envelope: NormalizedEnvelope): string {
  return keyedDigest(key, "feedback-envelope", canonicalJson({
    eventId: envelope.eventId,
    tenantId: envelope.tenantId,
    subjectId: envelope.subjectId,
    clientId: envelope.clientId,
    taskId: envelope.taskId,
    capabilities: envelope.capabilities,
    status: envelope.status,
    latencyMs: envelope.latencyMs,
    observedAt: envelope.observedAt,
  }));
}

function validateRow(row: OutboxRow): void {
  if (
    row.record_version !== RECORD_VERSION
    || !isDigest(row.event_key_hmac)
    || !isDigest(row.content_hmac)
    || !isValidId(row.tenant_id)
    || !isValidId(row.subject_id)
    || !isValidId(row.client_id)
    || !isValidId(row.event_id)
    || !isValidId(row.task_id)
    || typeof row.capabilities_json !== "string"
    || row.capabilities_json.length < 2
    || row.capabilities_json.length > MAX_CAPABILITIES_JSON_LENGTH
    || row.feedback_status !== "success"
    || !isNonNegativeInteger(row.latency_ms)
    || row.latency_ms > MAX_LATENCY_MS
    || !isNonNegativeInteger(row.observed_at_ms)
    || row.observed_at_ms > MAX_DATE_MS
    || !isNonNegativeInteger(row.enqueued_at_ms)
    || row.enqueued_at_ms > MAX_DATE_MS
    || !DELIVERY_STATUS_PATTERN.test(String(row.delivery_status ?? ""))
    || !(row.lease_token_hmac === "" || isDigest(row.lease_token_hmac))
    || !isFencingToken(row.lease_fencing_token, true)
    || !isNonNegativeInteger(row.lease_claimed_at_ms)
    || row.lease_claimed_at_ms > MAX_DATE_MS
    || !isNonNegativeInteger(row.lease_expires_at_ms)
    || row.lease_expires_at_ms > MAX_DATE_MS
    || !isNonNegativeInteger(row.claim_count)
    || !isNonNegativeInteger(row.delivered_at_ms)
    || row.delivered_at_ms > MAX_DATE_MS
    || !isNonNegativeInteger(row.retire_at_ms)
    || row.retire_at_ms > MAX_DATE_MS
    || !isDigest(row.row_hmac)
  ) throw integrityError();
  parseCapabilitiesJson(row.capabilities_json);
  if (row.observed_at_ms > safeAdd(row.enqueued_at_ms, MAX_FUTURE_OBSERVATION_SKEW_MS)) {
    throw integrityError();
  }
  if (row.lease_token_hmac === "") {
    if (
      row.delivery_status !== "pending"
      || row.lease_fencing_token !== "0"
      || row.lease_claimed_at_ms !== 0
      || row.lease_expires_at_ms !== 0
      || row.delivered_at_ms !== 0
      || row.retire_at_ms !== 0
    ) throw integrityError();
    return;
  }
  if (
    row.lease_fencing_token === "0"
    || row.claim_count < 1
    || row.lease_claimed_at_ms < row.enqueued_at_ms
    || row.lease_expires_at_ms <= row.lease_claimed_at_ms
  ) throw integrityError();
  if (row.delivery_status === "pending") {
    if (row.delivered_at_ms !== 0 || row.retire_at_ms !== 0) throw integrityError();
  } else if (
    row.delivered_at_ms < row.lease_claimed_at_ms
    || row.retire_at_ms <= row.delivered_at_ms
  ) throw integrityError();
}

function normalizeEnvelope(input: LocalClientVerifiedReceiptFeedbackEnvelope): NormalizedEnvelope {
  if (!isPlainRecord(input)) throw envelopeInvalidError();
  assertExactKeys(input, [
    "eventId",
    "tenantId",
    "subjectId",
    "clientId",
    "taskId",
    "capabilities",
    "status",
    "latencyMs",
    "observedAt",
  ], false, envelopeInvalidError);
  const eventId = normalizeId(input.eventId);
  const tenantId = normalizeId(input.tenantId);
  const subjectId = normalizeId(input.subjectId);
  const clientId = normalizeId(input.clientId);
  const taskId = normalizeId(input.taskId);
  if (input.status !== "success") throw envelopeInvalidError();
  if (
    !Number.isSafeInteger(input.latencyMs)
    || input.latencyMs < 0
    || input.latencyMs > MAX_LATENCY_MS
  ) throw envelopeInvalidError();
  if (
    !Array.isArray(input.capabilities)
    || input.capabilities.length < 1
    || input.capabilities.length > MAX_CAPABILITIES
  ) throw envelopeInvalidError();
  const capabilities = input.capabilities.map((capability) => {
    if (typeof capability !== "string" || !CAPABILITY_PATTERN.test(capability)) {
      throw envelopeInvalidError();
    }
    return capability;
  }).sort();
  if (capabilities.some((capability, index) => index > 0 && capability === capabilities[index - 1])) {
    throw envelopeInvalidError();
  }
  const observedAtMs = parseCanonicalIso(input.observedAt, envelopeInvalidError);
  return Object.freeze({
    eventId,
    tenantId,
    subjectId,
    clientId,
    taskId,
    capabilities: Object.freeze(capabilities),
    status: "success" as const,
    latencyMs: input.latencyMs,
    observedAt: input.observedAt,
    observedAtMs,
  });
}

function envelopeFromRow(row: OutboxRow): NormalizedEnvelope {
  return Object.freeze({
    eventId: row.event_id,
    tenantId: row.tenant_id,
    subjectId: row.subject_id,
    clientId: row.client_id,
    taskId: row.task_id,
    capabilities: parseCapabilitiesJson(row.capabilities_json),
    status: "success" as const,
    latencyMs: row.latency_ms,
    observedAt: toIso(row.observed_at_ms),
    observedAtMs: row.observed_at_ms,
  });
}

function parseCapabilitiesJson(value: string): readonly string[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw integrityError(); }
  if (
    !Array.isArray(parsed)
    || parsed.length < 1
    || parsed.length > MAX_CAPABILITIES
    || parsed.some((item) => typeof item !== "string" || !CAPABILITY_PATTERN.test(item))
    || parsed.some((item, index) => index > 0 && item <= parsed[index - 1]!)
    || JSON.stringify(parsed) !== value
  ) throw integrityError();
  return Object.freeze([...parsed] as string[]);
}

function toDelivery(row: OutboxRow): LocalClientExecutionFeedbackDelivery {
  const envelope = envelopeFromRow(row);
  const publicEnvelope: LocalClientVerifiedReceiptFeedbackEnvelope = Object.freeze({
    eventId: envelope.eventId,
    tenantId: envelope.tenantId,
    subjectId: envelope.subjectId,
    clientId: envelope.clientId,
    taskId: envelope.taskId,
    capabilities: envelope.capabilities,
    status: envelope.status,
    latencyMs: envelope.latencyMs,
    observedAt: envelope.observedAt,
  });
  return Object.freeze({
    eventFingerprint: row.event_key_hmac,
    contentFingerprint: row.content_hmac,
    envelope: publicEnvelope,
    enqueuedAt: toIso(row.enqueued_at_ms),
    claimCount: row.claim_count,
  });
}

function toEnqueueReplay(row: OutboxRow): LocalClientExecutionFeedbackEnqueueResult {
  return Object.freeze({
    success: true as const,
    queued: false as const,
    replayed: true as const,
    code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENQUEUE_REPLAYED" as const,
    state: row.delivery_status as "pending" | "delivered",
    eventFingerprint: row.event_key_hmac,
    contentFingerprint: row.content_hmac,
    enqueuedAt: toIso(row.enqueued_at_ms),
  });
}

function toDeliveredAcknowledgement(
  rows: readonly OutboxRow[],
  alreadyDelivered: boolean,
): LocalClientExecutionFeedbackDeliveredAcknowledgement {
  const first = rows[0];
  if (!first || rows.some((row) => (
    row.delivery_status !== "delivered"
    || row.lease_fencing_token !== first.lease_fencing_token
    || row.delivered_at_ms !== first.delivered_at_ms
    || row.retire_at_ms !== first.retire_at_ms
  ))) throw integrityError();
  return Object.freeze({
    success: true as const,
    acknowledged: true as const,
    alreadyDelivered,
    code: alreadyDelivered
      ? "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_ALREADY_DELIVERED" as const
      : "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_DELIVERED" as const,
    fencingToken: first.lease_fencing_token,
    deliveredAt: toIso(first.delivered_at_ms),
    retireAt: toIso(first.retire_at_ms),
    eventFingerprints: Object.freeze(rows.map((row) => row.event_key_hmac)),
  });
}

function assertClaimOwner(row: OutboxRow, fencingToken: string, leaseTokenHmac: string): void {
  if (
    row.lease_token_hmac === ""
    || !safeDigestEqual(row.lease_token_hmac, leaseTokenHmac)
    || row.lease_fencing_token !== fencingToken
  ) throw claimStaleError();
}

function normalizeBatchRequest(
  input: LocalClientExecutionFeedbackClaimBatchRequest,
  maxBatchSize: number,
): number {
  if (!isPlainRecord(input)) throw batchInvalidError();
  assertExactKeys(input, ["limit"], false, batchInvalidError);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > maxBatchSize) {
    throw batchInvalidError();
  }
  return input.limit;
}

function normalizeClaimReference(
  input: LocalClientExecutionFeedbackClaimReference,
  maxBatchSize: number,
): Readonly<LocalClientExecutionFeedbackClaimReference> {
  if (!isPlainRecord(input)) throw batchInvalidError();
  assertExactKeys(input, ["leaseToken", "fencingToken", "eventFingerprints"], false, batchInvalidError);
  if (
    typeof input.leaseToken !== "string"
    || input.leaseToken.length < 32
    || input.leaseToken.length > MAX_LEASE_TOKEN_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(input.leaseToken)
    || !isFencingToken(input.fencingToken, false)
    || !Array.isArray(input.eventFingerprints)
    || input.eventFingerprints.length < 1
    || input.eventFingerprints.length > maxBatchSize
    || input.eventFingerprints.some((item) => !isDigest(item))
    || new Set(input.eventFingerprints).size !== input.eventFingerprints.length
  ) throw batchInvalidError();
  return Object.freeze({
    leaseToken: input.leaseToken,
    fencingToken: input.fencingToken,
    eventFingerprints: Object.freeze([...input.eventFingerprints]),
  });
}

function rowValues(row: OutboxRow): readonly (string | number)[] {
  return [
    row.record_version,
    row.event_key_hmac,
    row.content_hmac,
    row.tenant_id,
    row.subject_id,
    row.client_id,
    row.event_id,
    row.task_id,
    row.capabilities_json,
    row.feedback_status,
    row.latency_ms,
    row.observed_at_ms,
    row.enqueued_at_ms,
    row.delivery_status,
    row.lease_token_hmac,
    row.lease_fencing_token,
    row.lease_claimed_at_ms,
    row.lease_expires_at_ms,
    row.claim_count,
    row.delivered_at_ms,
    row.retire_at_ms,
    row.row_hmac,
  ];
}

function selectOutboxFields(): string {
  return `SELECT
    record_version, event_key_hmac, content_hmac, tenant_id, subject_id,
    client_id, event_id, task_id, capabilities_json, feedback_status,
    latency_ms, observed_at_ms, enqueued_at_ms, delivery_status,
    lease_token_hmac, lease_fencing_token, lease_claimed_at_ms,
    lease_expires_at_ms, claim_count, delivered_at_ms, retire_at_ms, row_hmac
    FROM local_client_execution_feedback_outbox`;
}

function assertOptions(options: LocalClientSqliteExecutionFeedbackOutboxOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  assertExactKeys(options, [
    "sqlitePath",
    "hostId",
    "integrityKey",
    "namespace",
    "deliveredTtlMs",
    "leaseTtlMs",
    "maxEvents",
    "maxBatchSize",
    "busyTimeoutMs",
    "now",
  ], true, configurationError);
  if (
    !Object.hasOwn(options, "sqlitePath")
    || !Object.hasOwn(options, "hostId")
    || !Object.hasOwn(options, "integrityKey")
    || !Buffer.isBuffer(options.integrityKey)
    || options.integrityKey.byteLength < 32
    || options.integrityKey.byteLength > 64
  ) throw configurationError();
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  allowMissing: boolean,
  errorFactory: () => Error,
): void {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) {
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

function extractCallerIntegrityKey(value: unknown): Buffer | null {
  if (value === null || typeof value !== "object") return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "integrityKey");
  return descriptor && Object.hasOwn(descriptor, "value") && Buffer.isBuffer(descriptor.value)
    ? descriptor.value
    : null;
}

function cloneIntegrityKey(value: Buffer): Buffer {
  return Buffer.from(value);
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) {
    throw configurationError();
  }
  return resolved;
}

function normalizeId(value: unknown): string {
  if (!isValidId(value)) throw envelopeInvalidError();
  return value;
}

function isValidId(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function parseCanonicalIso(value: unknown, errorFactory: () => Error): number {
  if (
    typeof value !== "string"
    || value.length < 20
    || value.length > 32
    || value !== value.trim()
  ) throw errorFactory();
  const parsed = Date.parse(value);
  if (!isNonNegativeInteger(parsed) || parsed > MAX_DATE_MS) throw errorFactory();
  try {
    if (new Date(parsed).toISOString() !== value) throw errorFactory();
  } catch {
    throw errorFactory();
  }
  return parsed;
}

function readClock(now: () => number): number {
  let value: unknown;
  try { value = now(); } catch { throw clockError(); }
  if (!isNonNegativeInteger(value) || value > MAX_DATE_MS) throw clockError();
  return value;
}

function safeAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0 || result > MAX_DATE_MS) throw clockError();
  return result;
}

function readUserVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version?: unknown } | undefined;
  const value = Number(row?.user_version);
  if (!isNonNegativeInteger(value)) throw schemaError();
  return value;
}

function toIso(value: number): string {
  try { return new Date(value).toISOString(); } catch { throw integrityError(); }
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

function digestEventKey(key: Uint8Array, tenantId: string, eventId: string): string {
  return keyedDigest(key, "event-key", canonicalJson({ tenantId, eventId }));
}

function digestActiveEventMember(key: Uint8Array, row: OutboxRow): string {
  return keyedDigest(key, "active-event-member", canonicalJson({
    eventKeyHmac: row.event_key_hmac,
    rowHmac: row.row_hmac,
  }));
}

function xorDigests(left: string, right: string): string {
  if (!isDigest(left) || !isDigest(right)) throw integrityError();
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  try {
    for (let index = 0; index < leftBytes.length; index += 1) {
      leftBytes[index] = leftBytes[index]! ^ rightBytes[index]!;
    }
    return leftBytes.toString("hex");
  } finally {
    leftBytes.fill(0);
    rightBytes.fill(0);
  }
}

function safeDigestEqual(left: string, right: string): boolean {
  if (!isDigest(left) || !isDigest(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
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
  return (prototype === Object.prototype || prototype === null)
    && Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => (
      Object.hasOwn(descriptor, "value")
      && descriptor.get === undefined
      && descriptor.set === undefined
    ));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
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

function parseFencingToken(value: string, allowZero: boolean): bigint {
  if (!isFencingToken(value, allowZero)) throw integrityError();
  return BigInt(value);
}

function isKnownError(error: unknown): error is LocalClientSqliteExecutionFeedbackOutboxError {
  return error instanceof LocalClientSqliteExecutionFeedbackOutboxError;
}

function outboxError(
  code: LocalClientSqliteExecutionFeedbackOutboxErrorCode,
  message: string,
  category: LocalClientSqliteExecutionFeedbackOutboxError["category"],
  statusCode: number,
  retryable = false,
): LocalClientSqliteExecutionFeedbackOutboxError {
  return new LocalClientSqliteExecutionFeedbackOutboxError(
    code,
    message,
    category,
    statusCode,
    retryable,
  );
}

function configurationError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CONFIGURATION_INVALID",
    "The local-client execution feedback outbox configuration is invalid.",
    "configuration",
    500,
  );
}

function envelopeInvalidError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENVELOPE_INVALID",
    "A minimal verified-receipt local-client feedback envelope is required.",
    "validation",
    400,
  );
}

function conflictError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_EVENT_CONFLICT",
    "The stable feedback event ID was already enqueued with different content.",
    "conflict",
    409,
  );
}

function batchInvalidError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_INVALID",
    "A complete bounded execution feedback batch request is required.",
    "validation",
    400,
  );
}

function batchNotFoundError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_NOT_FOUND",
    "The claimed feedback batch is no longer retained.",
    "lease",
    404,
  );
}

function claimStaleError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_STALE",
    "The feedback claim is stale or does not own the complete batch.",
    "lease",
    409,
  );
}

function claimExpiredError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_EXPIRED",
    "The feedback batch lease expired before delivery acknowledgement.",
    "lease",
    409,
    true,
  );
}

function capacityError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CAPACITY",
    "The bounded feedback outbox is full and pending feedback cannot be discarded.",
    "capacity",
    429,
    true,
  );
}

function schemaError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_INCOMPATIBLE",
    "The execution feedback outbox schema is incompatible.",
    "persistence",
    500,
  );
}

function hostMismatchError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_HOST_MISMATCH",
    "The execution feedback outbox belongs to another host.",
    "configuration",
    500,
  );
}

function namespaceMismatchError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE_MISMATCH",
    "The execution feedback outbox belongs to another namespace.",
    "configuration",
    500,
  );
}

function keyMismatchError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_KEY_MISMATCH",
    "The execution feedback outbox is bound to another HMAC key.",
    "configuration",
    500,
  );
}

function closedError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOSED",
    "The execution feedback outbox is closed.",
    "persistence",
    503,
  );
}

function unavailableError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_UNAVAILABLE",
    "The execution feedback outbox is unavailable.",
    "persistence",
    503,
    true,
  );
}

function clockError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOCK_INVALID",
    "The execution feedback outbox clock moved backwards or is invalid.",
    "integrity",
    503,
  );
}

function integrityError() {
  return outboxError(
    "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    "The execution feedback outbox failed an integrity check.",
    "integrity",
    500,
  );
}
