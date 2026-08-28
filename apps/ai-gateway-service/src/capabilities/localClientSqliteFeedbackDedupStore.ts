import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION = 2 as const;
export const LOCAL_CLIENT_FEEDBACK_AGGREGATE_DELTA_VERSION =
  "local-client-feedback-aggregate-delta-v1" as const;

export const LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_BOUNDARIES = Object.freeze({
  mode: "sqlite-feedback-dedup" as const,
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  exactlyOnceAdmission: true as const,
  simpleAdmitMode: "preview-non-delivery" as const,
  rawIdentityPersisted: false as const,
  rawEventIdPersisted: false as const,
  rawTaskIdPersisted: false as const,
  rawCapabilitiesPersisted: false as const,
  rawErrorPersisted: false as const,
  rawInputPersisted: false as const,
  canonicalContentFingerprint: "hmac-sha256" as const,
  rowIntegrity: "hmac-sha256" as const,
  metadataIntegrity: "hmac-sha256" as const,
  clockRollbackPolicy: "fail-closed" as const,
  deliveryMode: "exclusive-leased-acknowledged" as const,
  appliedDeduplicationWindow: "bounded-ttl" as const,
  pendingRetainedUntilApplied: true as const,
  rawLeaseTokenPersisted: false as const,
  monotonicFencing: true as const,
  aggregateMutationPerformed: false as const,
  routingDecisionPerformed: false as const,
});

export type LocalClientFeedbackOutcome = "success" | "failure" | "timeout" | "error";

/**
 * This port accepts identity only after the surrounding server has authenticated
 * tenant and client ownership. It deliberately has no user-supplied error or
 * task-content field.
 */
export interface LocalClientFeedbackDedupEvent {
  readonly tenantId: string;
  readonly clientId: string;
  readonly eventId: string;
  readonly taskId: string;
  readonly outcome: LocalClientFeedbackOutcome;
  readonly latencyMs: number;
  readonly capabilities: readonly string[];
  readonly observedAt: string;
}

export interface LocalClientSqliteFeedbackDedupStoreOptions {
  readonly sqlitePath: string;
  /** Stable host identity. Only a keyed binding is persisted. */
  readonly hostId: string;
  /** Dedicated 32-64 byte integrity key. It is cloned and never persisted. */
  readonly integrityKey: Uint8Array;
  readonly namespace?: string;
  readonly ttlMs?: number;
  readonly leaseTtlMs?: number;
  readonly maxEvents?: number;
  readonly busyTimeoutMs?: number;
  readonly now?: () => number;
}

export type LocalClientFeedbackAggregateDelta = Readonly<{
  deltaVersion: typeof LOCAL_CLIENT_FEEDBACK_AGGREGATE_DELTA_VERSION;
  apply: true;
  tenantFingerprint: string;
  clientFingerprint: string;
  eventFingerprint: string;
  taskFingerprint: string;
  contentFingerprint: string;
  capabilityFingerprints: readonly string[];
  outcome: LocalClientFeedbackOutcome;
  attemptDelta: 1;
  successDelta: 0 | 1;
  failureDelta: 0 | 1;
  timeoutDelta: 0 | 1;
  errorDelta: 0 | 1;
  reliabilitySample: 0 | 1;
  latencySampleMs: number;
  observedAt: string;
}>;

export type LocalClientFeedbackDeliveryLease = Readonly<{
  token: string;
  tokenFingerprint: string;
  fencingToken: string;
  claimedAt: string;
  expiresAt: string;
  claimCount: number;
}>;

export type LocalClientFeedbackClaimed = Readonly<{
  success: true;
  admitted: true;
  reclaimed: false;
  inProgress: false;
  replayed: false;
  state: "claimed";
  code: "LOCAL_CLIENT_FEEDBACK_EVENT_CLAIMED";
  eventFingerprint: string;
  admissionFingerprint: string;
  contentFingerprint: string;
  lease: LocalClientFeedbackDeliveryLease;
  aggregateDelta: LocalClientFeedbackAggregateDelta;
}>;

export type LocalClientFeedbackReclaimed = Readonly<{
  success: true;
  admitted: false;
  reclaimed: true;
  inProgress: false;
  replayed: false;
  state: "claimed";
  code: "LOCAL_CLIENT_FEEDBACK_EVENT_RECLAIMED";
  eventFingerprint: string;
  admissionFingerprint: string;
  contentFingerprint: string;
  lease: LocalClientFeedbackDeliveryLease;
  aggregateDelta: LocalClientFeedbackAggregateDelta;
}>;

export type LocalClientFeedbackInProgress = Readonly<{
  success: true;
  admitted: false;
  reclaimed: false;
  inProgress: true;
  replayed: false;
  state: "pending";
  code: "LOCAL_CLIENT_FEEDBACK_EVENT_IN_PROGRESS";
  eventFingerprint: string;
  admissionFingerprint: string;
  contentFingerprint: string;
  claimFingerprint: string;
  leaseExpiresAt: string;
  aggregateDelta: null;
}>;

export type LocalClientFeedbackAppliedReplay = Readonly<{
  success: true;
  admitted: false;
  reclaimed: false;
  inProgress: false;
  replayed: true;
  state: "applied";
  code: "LOCAL_CLIENT_FEEDBACK_EVENT_APPLIED_REPLAY";
  eventFingerprint: string;
  admissionFingerprint: string;
  contentFingerprint: string;
  appliedAt: string;
  retireAt: string;
  aggregateDelta: null;
}>;

export type LocalClientFeedbackDeliveryClaim =
  | LocalClientFeedbackClaimed
  | LocalClientFeedbackReclaimed
  | LocalClientFeedbackInProgress
  | LocalClientFeedbackAppliedReplay;

/** Non-persisting compatibility surface. It never delivers an aggregate delta. */
export type LocalClientFeedbackAdmissionPreview = Readonly<{
  success: true;
  preview: true;
  persisted: false;
  deliveryClaimed: false;
  code: "LOCAL_CLIENT_FEEDBACK_EVENT_PREVIEWED";
  eventFingerprint: string;
  contentFingerprint: string;
  aggregateDelta: null;
}>;

export interface LocalClientFeedbackClaimReference {
  readonly leaseToken: string;
  readonly fencingToken: string;
  readonly eventFingerprint: string;
  readonly contentFingerprint: string;
}

export type LocalClientFeedbackAppliedAcknowledgement = Readonly<{
  success: true;
  acknowledged: true;
  alreadyApplied: boolean;
  code:
    | "LOCAL_CLIENT_FEEDBACK_EVENT_APPLIED"
    | "LOCAL_CLIENT_FEEDBACK_EVENT_ALREADY_APPLIED";
  eventFingerprint: string;
  contentFingerprint: string;
  fencingToken: string;
  appliedAt: string;
  retireAt: string;
}>;

export type LocalClientFeedbackClaimRelease = Readonly<{
  success: true;
  released: true;
  code: "LOCAL_CLIENT_FEEDBACK_CLAIM_RELEASED";
  eventFingerprint: string;
  contentFingerprint: string;
  fencingToken: string;
}>;

export type LocalClientSqliteFeedbackDedupStoreErrorCode =
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_FEEDBACK_EVENT_INVALID"
  | "LOCAL_CLIENT_FEEDBACK_EVENT_CONFLICT"
  | "LOCAL_CLIENT_FEEDBACK_EVENT_NOT_FOUND"
  | "LOCAL_CLIENT_FEEDBACK_CLAIM_INVALID"
  | "LOCAL_CLIENT_FEEDBACK_CLAIM_STALE"
  | "LOCAL_CLIENT_FEEDBACK_CLAIM_EXPIRED"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_CAPACITY"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_HOST_MISMATCH"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_KEY_MISMATCH"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_CLOSED"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_UNAVAILABLE"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_CLOCK_INVALID"
  | "LOCAL_CLIENT_FEEDBACK_DEDUP_INTEGRITY_INVALID";

export class LocalClientSqliteFeedbackDedupStoreError extends Error {
  readonly code: LocalClientSqliteFeedbackDedupStoreErrorCode;
  readonly category:
    | "configuration"
    | "validation"
    | "conflict"
    | "capacity"
    | "lease"
    | "persistence"
    | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientSqliteFeedbackDedupStoreErrorCode,
    message: string,
    category: LocalClientSqliteFeedbackDedupStoreError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientSqliteFeedbackDedupStoreError";
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
  max_events: number;
  busy_timeout_ms: number;
  last_clock_ms: number;
  last_fencing_token: string;
  metadata_hmac: string;
};

type FeedbackRow = {
  record_version: number;
  event_key_hmac: string;
  content_fingerprint: string;
  tenant_hmac: string;
  client_hmac: string;
  event_id_hmac: string;
  task_hmac: string;
  outcome: string;
  latency_ms: number;
  capabilities_hmac_json: string;
  observed_at_ms: number;
  admitted_at_ms: number;
  delivery_status: string;
  lease_token_digest: string;
  lease_fencing_token: string;
  lease_claimed_at_ms: number;
  lease_expires_at_ms: number;
  claim_count: number;
  applied_at_ms: number;
  retire_at_ms: number;
  record_hmac: string;
};

type NormalizedFeedback = Readonly<{
  tenantId: string;
  clientId: string;
  eventId: string;
  taskId: string;
  outcome: LocalClientFeedbackOutcome;
  latencyMs: number;
  capabilities: readonly string[];
  observedAt: string;
  observedAtMs: number;
}>;

type KeyedFeedback = Readonly<{
  eventKeyHmac: string;
  contentFingerprint: string;
  tenantHmac: string;
  clientHmac: string;
  eventIdHmac: string;
  taskHmac: string;
  capabilityHmacs: readonly string[];
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 1;
const DEFAULT_NAMESPACE = "local-client-feedback-dedup";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60_000;
const DEFAULT_LEASE_TTL_MS = 30_000;
const DEFAULT_MAX_EVENTS = 50_000;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_FUTURE_OBSERVATION_SKEW_MS = 5 * 60_000;
const MIN_TTL_MS = 10;
const MAX_TTL_MS = 90 * 24 * 60 * 60_000;
const MIN_LEASE_TTL_MS = 10;
const MAX_LEASE_TTL_MS = 60 * 60_000;
const MAX_EVENTS = 1_000_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_LATENCY_MS = 24 * 60 * 60_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_ID_LENGTH = 256;
const MAX_CAPABILITIES = 64;
const MAX_DATE_MS = 8_640_000_000_000_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const CAPABILITY_PATTERN = /^[a-z][a-z0-9._:-]{0,127}$/u;
const OUTCOME_PATTERN = /^(?:success|failure|timeout|error)$/u;
const DELIVERY_STATUS_PATTERN = /^(?:pending|applied)$/u;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
const MAX_FENCING_TOKEN = 9_223_372_036_854_775_807n;
const MAX_LEASE_TOKEN_LENGTH = 512;
const HMAC_DOMAIN = "unified-ai/local-client-feedback-dedup/v1";

/**
 * Durable, bounded, process-safe feedback admission for one host. The store
 * emits one aggregation sample for a newly admitted event and never applies
 * EWMA, routing policy, health status, or any other adjudication itself.
 */
export class LocalClientSqliteFeedbackDedupStore {
  readonly #db!: DatabaseSync;
  readonly #sqlitePath: string;
  readonly #key: Buffer;
  readonly #hostBindingHmac: string;
  readonly #namespaceBindingHmac: string;
  readonly #keyBindingHmac: string;
  readonly #ttlMs: number;
  readonly #leaseTtlMs: number;
  readonly #maxEvents: number;
  readonly #busyTimeoutMs: number;
  readonly #now: () => number;
  #closed = false;

  constructor(options: LocalClientSqliteFeedbackDedupStoreOptions) {
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
    const maxEvents = boundedInteger(options.maxEvents, DEFAULT_MAX_EVENTS, 1, MAX_EVENTS);
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
      canonicalJson({ schemaVersion: LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION }),
    );
    this.#ttlMs = ttlMs;
    this.#leaseTtlMs = leaseTtlMs;
    this.#maxEvents = maxEvents;
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
      this.#scanPersistedRecords();
      try { chmodSync(this.#sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve initialization error. */ }
      this.#key.fill(0);
      if (isKnownError(error)) throw error;
      throw storeUnavailableError();
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_BOUNDARIES,
      available: !this.#closed,
      schemaVersion: LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION,
      journalMode: "wal" as const,
      synchronous: "full" as const,
      defensive: true as const,
      ttlMs: this.#ttlMs,
      leaseTtlMs: this.#leaseTtlMs,
      maxEvents: this.#maxEvents,
      busyTimeoutMs: this.#busyTimeoutMs,
      maxFutureObservationSkewMs: MAX_FUTURE_OBSERVATION_SKEW_MS,
    });
  }

  getStatus() {
    return this.status;
  }

  /**
   * Compatibility-only validation preview. This does not persist dedup state,
   * claim delivery, or return an applicable aggregate delta.
   */
  async admit(input: LocalClientFeedbackDedupEvent): Promise<LocalClientFeedbackAdmissionPreview> {
    this.#assertOpen();
    const feedback = normalizeFeedback(input);
    const keyed = createKeyedFeedback(this.#key, feedback);
    const nowMs = readClock(this.#now);
    if (feedback.observedAtMs > safeAdd(nowMs, MAX_FUTURE_OBSERVATION_SKEW_MS)) {
      throw eventInvalidError();
    }
    return Object.freeze({
      success: true as const,
      preview: true as const,
      persisted: false as const,
      deliveryClaimed: false as const,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_PREVIEWED" as const,
      eventFingerprint: keyed.eventKeyHmac,
      contentFingerprint: keyed.contentFingerprint,
      aggregateDelta: null,
    });
  }

  async admitAndClaim(input: LocalClientFeedbackDedupEvent): Promise<LocalClientFeedbackDeliveryClaim> {
    this.#assertOpen();
    const feedback = normalizeFeedback(input);
    const keyed = createKeyedFeedback(this.#key, feedback);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      if (feedback.observedAtMs > safeAdd(nowMs, MAX_FUTURE_OBSERVATION_SKEW_MS)) {
        throw eventInvalidError();
      }
      this.#purgeRetired(nowMs);

      const existing = this.#selectByEventKey(keyed.eventKeyHmac);
      if (existing) {
        const row = this.#decodeRow(existing);
        if (!safeDigestEqual(row.content_fingerprint, keyed.contentFingerprint)) {
          throw conflictError();
        }
        if (row.delivery_status === "applied") return toAppliedReplayResult(row);
        if (hasActiveLease(row, nowMs)) return toInProgressResult(row);
        return this.#claimExisting(row, nowMs);
      }

      if (this.#countEvents() >= this.#maxEvents) throw capacityError();
      const leaseToken = randomBytes(32).toString("base64url");
      const leaseTokenDigest = digestLeaseToken(this.#key, leaseToken);
      const fencingToken = this.#allocateFencingToken();
      const row = createFeedbackRow(this.#key, feedback, keyed, {
        admittedAtMs: nowMs,
        leaseTokenDigest,
        fencingToken,
        leaseClaimedAtMs: nowMs,
        leaseExpiresAtMs: safeAdd(nowMs, this.#leaseTtlMs),
      });
      const inserted = this.#db.prepare(`
        INSERT INTO local_client_feedback_dedup_events (
          record_version, event_key_hmac, content_fingerprint, tenant_hmac,
          client_hmac, event_id_hmac, task_hmac, outcome, latency_ms,
          capabilities_hmac_json, observed_at_ms, admitted_at_ms,
          delivery_status, lease_token_digest, lease_fencing_token,
          lease_claimed_at_ms, lease_expires_at_ms, claim_count,
          applied_at_ms, retire_at_ms, record_hmac
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.record_version,
        row.event_key_hmac,
        row.content_fingerprint,
        row.tenant_hmac,
        row.client_hmac,
        row.event_id_hmac,
        row.task_hmac,
        row.outcome,
        row.latency_ms,
        row.capabilities_hmac_json,
        row.observed_at_ms,
        row.admitted_at_ms,
        row.delivery_status,
        row.lease_token_digest,
        row.lease_fencing_token,
        row.lease_claimed_at_ms,
        row.lease_expires_at_ms,
        row.claim_count,
        row.applied_at_ms,
        row.retire_at_ms,
        row.record_hmac,
      );
      if (Number(inserted.changes) !== 1) throw integrityError();
      return toClaimedResult(row, leaseToken, true);
    });
  }

  async acknowledgeApplied(
    input: LocalClientFeedbackClaimReference,
  ): Promise<LocalClientFeedbackAppliedAcknowledgement> {
    this.#assertOpen();
    const reference = normalizeClaimReference(input);
    const tokenDigest = digestLeaseToken(this.#key, reference.leaseToken);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const row = this.#selectByEventKey(reference.eventFingerprint);
      if (!row) throw eventNotFoundError();
      const current = this.#decodeRow(row);
      assertClaimMatches(current, reference, tokenDigest);
      if (current.delivery_status === "applied") {
        return toAcknowledgementResult(current, true);
      }
      if (nowMs >= current.lease_expires_at_ms) throw claimExpiredError();
      const updated = createFeedbackRowFromPersisted(this.#key, {
        ...current,
        delivery_status: "applied",
        applied_at_ms: nowMs,
        retire_at_ms: safeAdd(nowMs, this.#ttlMs),
        record_hmac: "",
      });
      this.#replaceFeedbackRow(current, updated);
      return toAcknowledgementResult(updated, false);
    });
  }

  async releaseClaim(
    input: LocalClientFeedbackClaimReference,
  ): Promise<LocalClientFeedbackClaimRelease> {
    this.#assertOpen();
    const reference = normalizeClaimReference(input);
    const tokenDigest = digestLeaseToken(this.#key, reference.leaseToken);
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      const row = this.#selectByEventKey(reference.eventFingerprint);
      if (!row) throw eventNotFoundError();
      const current = this.#decodeRow(row);
      if (current.delivery_status !== "pending") throw claimStaleError();
      assertClaimMatches(current, reference, tokenDigest);
      const updated = createFeedbackRowFromPersisted(this.#key, {
        ...current,
        lease_token_digest: "",
        lease_claimed_at_ms: 0,
        lease_expires_at_ms: 0,
        record_hmac: "",
      });
      this.#replaceFeedbackRow(current, updated);
      return Object.freeze({
        success: true as const,
        released: true as const,
        code: "LOCAL_CLIENT_FEEDBACK_CLAIM_RELEASED" as const,
        eventFingerprint: updated.event_key_hmac,
        contentFingerprint: updated.content_fingerprint,
        fencingToken: updated.lease_fencing_token,
      });
    });
  }

  async checkHealth() {
    const counts = this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeRetired(nowMs);
      this.#assertDatabaseHealthy();
      this.#scanPersistedRecords();
      return this.#countDeliveryStates(nowMs);
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
      if (userVersion !== 0 && userVersion !== LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION) {
        throw schemaError();
      }
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_feedback_dedup_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          host_binding_hmac TEXT NOT NULL,
          namespace_binding_hmac TEXT NOT NULL,
          key_binding_hmac TEXT NOT NULL,
          ttl_ms INTEGER NOT NULL CHECK (ttl_ms > 0),
          lease_ttl_ms INTEGER NOT NULL CHECK (lease_ttl_ms > 0),
          max_events INTEGER NOT NULL CHECK (max_events > 0),
          busy_timeout_ms INTEGER NOT NULL CHECK (busy_timeout_ms > 0),
          last_clock_ms INTEGER NOT NULL CHECK (last_clock_ms >= 0),
          last_fencing_token TEXT NOT NULL,
          metadata_hmac TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_feedback_dedup_events (
          record_version INTEGER NOT NULL,
          event_key_hmac TEXT PRIMARY KEY,
          content_fingerprint TEXT NOT NULL,
          tenant_hmac TEXT NOT NULL,
          client_hmac TEXT NOT NULL,
          event_id_hmac TEXT NOT NULL,
          task_hmac TEXT NOT NULL,
          outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'timeout', 'error')),
          latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
          capabilities_hmac_json TEXT NOT NULL,
          observed_at_ms INTEGER NOT NULL CHECK (observed_at_ms >= 0),
          admitted_at_ms INTEGER NOT NULL CHECK (admitted_at_ms >= 0),
          delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'applied')),
          lease_token_digest TEXT NOT NULL,
          lease_fencing_token TEXT NOT NULL,
          lease_claimed_at_ms INTEGER NOT NULL CHECK (lease_claimed_at_ms >= 0),
          lease_expires_at_ms INTEGER NOT NULL CHECK (lease_expires_at_ms >= 0),
          claim_count INTEGER NOT NULL CHECK (claim_count > 0),
          applied_at_ms INTEGER NOT NULL CHECK (applied_at_ms >= 0),
          retire_at_ms INTEGER NOT NULL CHECK (retire_at_ms >= 0),
          record_hmac TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_feedback_dedup_retire_idx
          ON local_client_feedback_dedup_events (delivery_status, retire_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_feedback_dedup_lease_idx
          ON local_client_feedback_dedup_events (delivery_status, lease_expires_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_feedback_dedup_client_idx
          ON local_client_feedback_dedup_events (client_hmac, observed_at_ms);
      `);
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        if (metadata || this.#countEvents() !== 0) throw schemaError();
        const initial = createMetadataRow(this.#key, {
          hostBindingHmac: this.#hostBindingHmac,
          namespaceBindingHmac: this.#namespaceBindingHmac,
          keyBindingHmac: this.#keyBindingHmac,
          ttlMs: this.#ttlMs,
          leaseTtlMs: this.#leaseTtlMs,
          maxEvents: this.#maxEvents,
          busyTimeoutMs: this.#busyTimeoutMs,
          lastClockMs: 0,
          lastFencingToken: "0",
        });
        this.#db.prepare(`
          INSERT INTO local_client_feedback_dedup_metadata (
            singleton, schema_version, host_binding_hmac,
            namespace_binding_hmac, key_binding_hmac, ttl_ms,
            lease_ttl_ms, max_events, busy_timeout_ms, last_clock_ms,
            last_fencing_token, metadata_hmac
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.host_binding_hmac,
          initial.namespace_binding_hmac,
          initial.key_binding_hmac,
          initial.ttl_ms,
          initial.lease_ttl_ms,
          initial.max_events,
          initial.busy_timeout_ms,
          initial.last_clock_ms,
          initial.last_fencing_token,
          initial.metadata_hmac,
        );
        this.#db.exec(`PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION}`);
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
      maxEvents: metadata.max_events,
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
      maxEvents: metadata.max_events,
      busyTimeoutMs: metadata.busy_timeout_ms,
      lastClockMs: metadata.last_clock_ms,
      lastFencingToken: fencingToken,
    });
    this.#replaceMetadata(metadata, updated);
    return fencingToken;
  }

  #replaceMetadata(previous: MetadataRow, updated: MetadataRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_feedback_dedup_metadata
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
             key_binding_hmac, ttl_ms, lease_ttl_ms, max_events,
             busy_timeout_ms, last_clock_ms, last_fencing_token, metadata_hmac
      FROM local_client_feedback_dedup_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION
      || !isDigest(row.host_binding_hmac)
      || !isDigest(row.namespace_binding_hmac)
      || !isDigest(row.key_binding_hmac)
      || !isSafePositiveInteger(row.ttl_ms)
      || !isSafePositiveInteger(row.lease_ttl_ms)
      || !isSafePositiveInteger(row.max_events)
      || !isSafePositiveInteger(row.busy_timeout_ms)
      || !isSafeNonNegativeInteger(row.last_clock_ms)
      || !isFencingToken(row.last_fencing_token, true)
      || !isDigest(row.metadata_hmac)
    ) throw integrityError();

    if (!safeDigestEqual(row.key_binding_hmac, this.#keyBindingHmac)) throw keyMismatchError();
    const expectedHmac = createMetadataRow(this.#key, {
      hostBindingHmac: row.host_binding_hmac,
      namespaceBindingHmac: row.namespace_binding_hmac,
      keyBindingHmac: row.key_binding_hmac,
      ttlMs: row.ttl_ms,
      leaseTtlMs: row.lease_ttl_ms,
      maxEvents: row.max_events,
      busyTimeoutMs: row.busy_timeout_ms,
      lastClockMs: row.last_clock_ms,
      lastFencingToken: row.last_fencing_token,
    }).metadata_hmac;
    if (!safeDigestEqual(row.metadata_hmac, expectedHmac)) throw integrityError();
    if (!safeDigestEqual(row.host_binding_hmac, this.#hostBindingHmac)) throw hostMismatchError();
    if (
      !safeDigestEqual(row.namespace_binding_hmac, this.#namespaceBindingHmac)
      || row.ttl_ms !== this.#ttlMs
      || row.lease_ttl_ms !== this.#leaseTtlMs
      || row.max_events !== this.#maxEvents
      || row.busy_timeout_ms !== this.#busyTimeoutMs
    ) throw configurationError();
  }

  #selectByEventKey(eventKeyHmac: string): FeedbackRow | undefined {
    return this.#db.prepare(`${selectFeedbackFields()} WHERE event_key_hmac = ?`)
      .get(eventKeyHmac) as FeedbackRow | undefined;
  }

  #decodeRow(row: FeedbackRow): FeedbackRow {
    validateFeedbackRow(row);
    const expected = digestFeedbackRow(this.#key, { ...row, record_hmac: "" });
    if (!safeDigestEqual(row.record_hmac, expected)) throw integrityError();
    const capabilities = parseCapabilityHmacs(row.capabilities_hmac_json);
    if (row.capabilities_hmac_json !== JSON.stringify(capabilities)) throw integrityError();
    return row;
  }

  #claimExisting(row: FeedbackRow, nowMs: number): LocalClientFeedbackReclaimed {
    if (row.delivery_status !== "pending" || hasActiveLease(row, nowMs)) throw claimStaleError();
    const leaseToken = randomBytes(32).toString("base64url");
    const fencingToken = this.#allocateFencingToken();
    const updated = createFeedbackRowFromPersisted(this.#key, {
      ...row,
      lease_token_digest: digestLeaseToken(this.#key, leaseToken),
      lease_fencing_token: fencingToken,
      lease_claimed_at_ms: nowMs,
      lease_expires_at_ms: safeAdd(nowMs, this.#leaseTtlMs),
      claim_count: row.claim_count + 1,
      record_hmac: "",
    });
    this.#replaceFeedbackRow(row, updated);
    return toClaimedResult(updated, leaseToken, false);
  }

  #replaceFeedbackRow(previous: FeedbackRow, updated: FeedbackRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_feedback_dedup_events
      SET delivery_status = ?, lease_token_digest = ?, lease_fencing_token = ?,
          lease_claimed_at_ms = ?, lease_expires_at_ms = ?, claim_count = ?,
          applied_at_ms = ?, retire_at_ms = ?, record_hmac = ?
      WHERE event_key_hmac = ? AND record_hmac = ?
    `).run(
      updated.delivery_status,
      updated.lease_token_digest,
      updated.lease_fencing_token,
      updated.lease_claimed_at_ms,
      updated.lease_expires_at_ms,
      updated.claim_count,
      updated.applied_at_ms,
      updated.retire_at_ms,
      updated.record_hmac,
      previous.event_key_hmac,
      previous.record_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #purgeRetired(nowMs: number): void {
    const rows = this.#db.prepare(`
      ${selectFeedbackFields()}
      WHERE delivery_status = 'applied' AND retire_at_ms > 0 AND retire_at_ms <= ?
    `)
      .all(nowMs) as FeedbackRow[];
    for (const row of rows) this.#decodeRow(row);
    if (rows.length > 0) {
      const deleted = this.#db.prepare(
        `DELETE FROM local_client_feedback_dedup_events
         WHERE delivery_status = 'applied' AND retire_at_ms > 0 AND retire_at_ms <= ?`,
      ).run(nowMs);
      if (Number(deleted.changes) !== rows.length) throw integrityError();
    }
  }

  #countEvents(): number {
    const row = this.#db.prepare(
      "SELECT COUNT(*) AS count FROM local_client_feedback_dedup_events",
    ).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_EVENTS) throw integrityError();
    return count;
  }

  #countDeliveryStates(nowMs: number) {
    const row = this.#db.prepare(`
      SELECT
        COUNT(*) AS active_events,
        SUM(CASE WHEN delivery_status = 'pending' THEN 1 ELSE 0 END) AS pending_events,
        SUM(CASE WHEN delivery_status = 'applied' THEN 1 ELSE 0 END) AS applied_events,
        SUM(CASE WHEN delivery_status = 'pending'
                  AND lease_token_digest <> '' AND lease_expires_at_ms > ?
                 THEN 1 ELSE 0 END) AS active_leases
      FROM local_client_feedback_dedup_events
    `).get(nowMs) as Record<string, unknown>;
    const result = {
      activeEvents: Number(row.active_events),
      pendingEvents: Number(row.pending_events),
      appliedEvents: Number(row.applied_events),
      activeLeases: Number(row.active_leases),
    };
    if (Object.values(result).some((value) => (
      !Number.isSafeInteger(value) || value < 0 || value > this.#maxEvents
    ))) throw integrityError();
    if (result.pendingEvents + result.appliedEvents !== result.activeEvents) throw integrityError();
    return Object.freeze(result);
  }

  #scanPersistedRecords(): void {
    const rows = this.#db.prepare(selectFeedbackFields()).all() as FeedbackRow[];
    if (rows.length > this.#maxEvents) throw integrityError();
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
        try { this.#db.exec("ROLLBACK"); } catch { /* Preserve original failure. */ }
      }
      throw error;
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw closedError();
  }
}

export function createLocalClientSqliteFeedbackDedupStore(
  options: LocalClientSqliteFeedbackDedupStoreOptions,
): LocalClientSqliteFeedbackDedupStore {
  return new LocalClientSqliteFeedbackDedupStore(options);
}

function createMetadataRow(
  key: Uint8Array,
  input: Readonly<{
    hostBindingHmac: string;
    namespaceBindingHmac: string;
    keyBindingHmac: string;
    ttlMs: number;
    leaseTtlMs: number;
    maxEvents: number;
    busyTimeoutMs: number;
    lastClockMs: number;
    lastFencingToken: string;
  }>,
): MetadataRow {
  const canonical = canonicalJson({
    schemaVersion: LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION,
    hostBindingHmac: input.hostBindingHmac,
    namespaceBindingHmac: input.namespaceBindingHmac,
    keyBindingHmac: input.keyBindingHmac,
    ttlMs: input.ttlMs,
    leaseTtlMs: input.leaseTtlMs,
    maxEvents: input.maxEvents,
    busyTimeoutMs: input.busyTimeoutMs,
    lastClockMs: input.lastClockMs,
    lastFencingToken: input.lastFencingToken,
  });
  return {
    schema_version: LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_SCHEMA_VERSION,
    host_binding_hmac: input.hostBindingHmac,
    namespace_binding_hmac: input.namespaceBindingHmac,
    key_binding_hmac: input.keyBindingHmac,
    ttl_ms: input.ttlMs,
    lease_ttl_ms: input.leaseTtlMs,
    max_events: input.maxEvents,
    busy_timeout_ms: input.busyTimeoutMs,
    last_clock_ms: input.lastClockMs,
    last_fencing_token: input.lastFencingToken,
    metadata_hmac: keyedDigest(key, "metadata-row", canonical),
  };
}

function createKeyedFeedback(key: Uint8Array, feedback: NormalizedFeedback): KeyedFeedback {
  const canonicalContent = canonicalJson({
    tenantId: feedback.tenantId,
    clientId: feedback.clientId,
    eventId: feedback.eventId,
    taskId: feedback.taskId,
    outcome: feedback.outcome,
    latencyMs: feedback.latencyMs,
    capabilities: feedback.capabilities,
    observedAt: feedback.observedAt,
  });
  const clientScope = canonicalJson({ tenantId: feedback.tenantId, clientId: feedback.clientId });
  return Object.freeze({
    eventKeyHmac: keyedDigest(
      key,
      "event-key",
      canonicalJson({
        tenantId: feedback.tenantId,
        clientId: feedback.clientId,
        eventId: feedback.eventId,
      }),
    ),
    contentFingerprint: keyedDigest(key, "canonical-content", canonicalContent),
    tenantHmac: keyedDigest(key, "tenant-id", feedback.tenantId),
    clientHmac: keyedDigest(key, "client-id", clientScope),
    eventIdHmac: keyedDigest(key, "event-id", canonicalJson({ clientScope, eventId: feedback.eventId })),
    taskHmac: keyedDigest(key, "task-id", canonicalJson({ clientScope, taskId: feedback.taskId })),
    capabilityHmacs: Object.freeze(feedback.capabilities.map((capability) => (
      keyedDigest(key, "capability-id", canonicalJson({ clientScope, capability }))
    )).sort()),
  });
}

function createFeedbackRow(
  key: Uint8Array,
  feedback: NormalizedFeedback,
  keyed: KeyedFeedback,
  delivery: Readonly<{
    admittedAtMs: number;
    leaseTokenDigest: string;
    fencingToken: string;
    leaseClaimedAtMs: number;
    leaseExpiresAtMs: number;
  }>,
): FeedbackRow {
  return createFeedbackRowFromPersisted(key, {
    record_version: RECORD_VERSION,
    event_key_hmac: keyed.eventKeyHmac,
    content_fingerprint: keyed.contentFingerprint,
    tenant_hmac: keyed.tenantHmac,
    client_hmac: keyed.clientHmac,
    event_id_hmac: keyed.eventIdHmac,
    task_hmac: keyed.taskHmac,
    outcome: feedback.outcome,
    latency_ms: feedback.latencyMs,
    capabilities_hmac_json: JSON.stringify(keyed.capabilityHmacs),
    observed_at_ms: feedback.observedAtMs,
    admitted_at_ms: delivery.admittedAtMs,
    delivery_status: "pending",
    lease_token_digest: delivery.leaseTokenDigest,
    lease_fencing_token: delivery.fencingToken,
    lease_claimed_at_ms: delivery.leaseClaimedAtMs,
    lease_expires_at_ms: delivery.leaseExpiresAtMs,
    claim_count: 1,
    applied_at_ms: 0,
    retire_at_ms: 0,
    record_hmac: "",
  });
}

function createFeedbackRowFromPersisted(key: Uint8Array, row: FeedbackRow): FeedbackRow {
  const unsigned = { ...row, record_hmac: "" };
  return { ...unsigned, record_hmac: digestFeedbackRow(key, unsigned) };
}

function digestFeedbackRow(key: Uint8Array, row: FeedbackRow): string {
  return keyedDigest(key, "feedback-row", canonicalJson({
    recordVersion: row.record_version,
    eventKeyHmac: row.event_key_hmac,
    contentFingerprint: row.content_fingerprint,
    tenantHmac: row.tenant_hmac,
    clientHmac: row.client_hmac,
    eventIdHmac: row.event_id_hmac,
    taskHmac: row.task_hmac,
    outcome: row.outcome,
    latencyMs: row.latency_ms,
    capabilitiesHmacJson: row.capabilities_hmac_json,
    observedAtMs: row.observed_at_ms,
    admittedAtMs: row.admitted_at_ms,
    deliveryStatus: row.delivery_status,
    leaseTokenDigest: row.lease_token_digest,
    leaseFencingToken: row.lease_fencing_token,
    leaseClaimedAtMs: row.lease_claimed_at_ms,
    leaseExpiresAtMs: row.lease_expires_at_ms,
    claimCount: row.claim_count,
    appliedAtMs: row.applied_at_ms,
    retireAtMs: row.retire_at_ms,
  }));
}

function toClaimedResult(
  row: FeedbackRow,
  leaseToken: string,
  admitted: true,
): LocalClientFeedbackClaimed;
function toClaimedResult(
  row: FeedbackRow,
  leaseToken: string,
  admitted: false,
): LocalClientFeedbackReclaimed;
function toClaimedResult(
  row: FeedbackRow,
  leaseToken: string,
  admitted: boolean,
): LocalClientFeedbackClaimed | LocalClientFeedbackReclaimed {
  const lease = Object.freeze({
    token: leaseToken,
    tokenFingerprint: fingerprint(row.lease_token_digest),
    fencingToken: row.lease_fencing_token,
    claimedAt: toIso(row.lease_claimed_at_ms),
    expiresAt: toIso(row.lease_expires_at_ms),
    claimCount: row.claim_count,
  });
  const common = {
    success: true as const,
    inProgress: false as const,
    replayed: false as const,
    state: "claimed" as const,
    eventFingerprint: row.event_key_hmac,
    admissionFingerprint: feedbackAdmissionFingerprint(row),
    contentFingerprint: row.content_fingerprint,
    lease,
    aggregateDelta: toAggregateDelta(row),
  };
  return admitted
    ? Object.freeze({
      ...common,
      admitted: true as const,
      reclaimed: false as const,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_CLAIMED" as const,
    })
    : Object.freeze({
      ...common,
      admitted: false as const,
      reclaimed: true as const,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_RECLAIMED" as const,
    });
}

function toAggregateDelta(row: FeedbackRow): LocalClientFeedbackAggregateDelta {
  const outcome = row.outcome as LocalClientFeedbackOutcome;
  const success = outcome === "success";
  return Object.freeze({
    deltaVersion: LOCAL_CLIENT_FEEDBACK_AGGREGATE_DELTA_VERSION,
    apply: true as const,
    tenantFingerprint: fingerprint(row.tenant_hmac),
    clientFingerprint: fingerprint(row.client_hmac),
    eventFingerprint: row.event_key_hmac,
    taskFingerprint: fingerprint(row.task_hmac),
    contentFingerprint: row.content_fingerprint,
    capabilityFingerprints: Object.freeze(parseCapabilityHmacs(row.capabilities_hmac_json).map(fingerprint)),
    outcome,
    attemptDelta: 1 as const,
    successDelta: success ? 1 as const : 0 as const,
    failureDelta: success ? 0 as const : 1 as const,
    timeoutDelta: outcome === "timeout" ? 1 as const : 0 as const,
    errorDelta: outcome === "error" ? 1 as const : 0 as const,
    reliabilitySample: success ? 1 as const : 0 as const,
    latencySampleMs: row.latency_ms,
    observedAt: toIso(row.observed_at_ms),
  });
}

function toInProgressResult(row: FeedbackRow): LocalClientFeedbackInProgress {
  return Object.freeze({
    success: true as const,
    admitted: false as const,
    reclaimed: false as const,
    inProgress: true as const,
    replayed: false as const,
    state: "pending" as const,
    code: "LOCAL_CLIENT_FEEDBACK_EVENT_IN_PROGRESS" as const,
    eventFingerprint: row.event_key_hmac,
    admissionFingerprint: feedbackAdmissionFingerprint(row),
    contentFingerprint: row.content_fingerprint,
    claimFingerprint: fingerprint(row.lease_token_digest),
    leaseExpiresAt: toIso(row.lease_expires_at_ms),
    aggregateDelta: null,
  });
}

function toAppliedReplayResult(row: FeedbackRow): LocalClientFeedbackAppliedReplay {
  return Object.freeze({
    success: true as const,
    admitted: false as const,
    reclaimed: false as const,
    inProgress: false as const,
    replayed: true as const,
    state: "applied" as const,
    code: "LOCAL_CLIENT_FEEDBACK_EVENT_APPLIED_REPLAY" as const,
    eventFingerprint: row.event_key_hmac,
    admissionFingerprint: feedbackAdmissionFingerprint(row),
    contentFingerprint: row.content_fingerprint,
    appliedAt: toIso(row.applied_at_ms),
    retireAt: toIso(row.retire_at_ms),
    aggregateDelta: null,
  });
}

function feedbackAdmissionFingerprint(row: FeedbackRow): string {
  return createHash("sha256")
    .update("unified-ai/local-client-feedback-admission/v1\0", "utf8")
    .update(row.event_key_hmac, "utf8")
    .update("\0", "utf8")
    .update(String(row.admitted_at_ms), "utf8")
    .digest("hex");
}

function toAcknowledgementResult(
  row: FeedbackRow,
  alreadyApplied: boolean,
): LocalClientFeedbackAppliedAcknowledgement {
  return Object.freeze({
    success: true as const,
    acknowledged: true as const,
    alreadyApplied,
    code: alreadyApplied
      ? "LOCAL_CLIENT_FEEDBACK_EVENT_ALREADY_APPLIED" as const
      : "LOCAL_CLIENT_FEEDBACK_EVENT_APPLIED" as const,
    eventFingerprint: row.event_key_hmac,
    contentFingerprint: row.content_fingerprint,
    fencingToken: row.lease_fencing_token,
    appliedAt: toIso(row.applied_at_ms),
    retireAt: toIso(row.retire_at_ms),
  });
}

function validateFeedbackRow(row: FeedbackRow): void {
  if (
    row.record_version !== RECORD_VERSION
    || !isDigest(row.event_key_hmac)
    || !isDigest(row.content_fingerprint)
    || !isDigest(row.tenant_hmac)
    || !isDigest(row.client_hmac)
    || !isDigest(row.event_id_hmac)
    || !isDigest(row.task_hmac)
    || !OUTCOME_PATTERN.test(String(row.outcome ?? ""))
    || !isSafeNonNegativeInteger(row.latency_ms)
    || row.latency_ms > MAX_LATENCY_MS
    || typeof row.capabilities_hmac_json !== "string"
    || row.capabilities_hmac_json.length < 2
    || row.capabilities_hmac_json.length > MAX_CAPABILITIES * 68
    || !isSafeNonNegativeInteger(row.observed_at_ms)
    || row.observed_at_ms > MAX_DATE_MS
    || !isSafeNonNegativeInteger(row.admitted_at_ms)
    || row.admitted_at_ms > MAX_DATE_MS
    || !DELIVERY_STATUS_PATTERN.test(String(row.delivery_status ?? ""))
    || !(row.lease_token_digest === "" || isDigest(row.lease_token_digest))
    || !isFencingToken(row.lease_fencing_token, false)
    || !isSafeNonNegativeInteger(row.lease_claimed_at_ms)
    || row.lease_claimed_at_ms > MAX_DATE_MS
    || !isSafeNonNegativeInteger(row.lease_expires_at_ms)
    || row.lease_expires_at_ms > MAX_DATE_MS
    || !isSafePositiveInteger(row.claim_count)
    || !isSafeNonNegativeInteger(row.applied_at_ms)
    || row.applied_at_ms > MAX_DATE_MS
    || !isSafeNonNegativeInteger(row.retire_at_ms)
    || row.retire_at_ms > MAX_DATE_MS
    || !isDigest(row.record_hmac)
  ) throw integrityError();
  if (row.lease_token_digest === "") {
    if (
      row.delivery_status !== "pending"
      || row.lease_claimed_at_ms !== 0
      || row.lease_expires_at_ms !== 0
      || row.applied_at_ms !== 0
      || row.retire_at_ms !== 0
    ) throw integrityError();
    return;
  }
  if (
    row.lease_claimed_at_ms < row.admitted_at_ms
    || row.lease_expires_at_ms <= row.lease_claimed_at_ms
  ) throw integrityError();
  if (row.delivery_status === "pending") {
    if (row.applied_at_ms !== 0 || row.retire_at_ms !== 0) throw integrityError();
  } else if (
    row.applied_at_ms < row.lease_claimed_at_ms
    || row.retire_at_ms <= row.applied_at_ms
  ) throw integrityError();
}

function parseCapabilityHmacs(value: string): readonly string[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw integrityError(); }
  if (
    !Array.isArray(parsed)
    || parsed.length > MAX_CAPABILITIES
    || parsed.some((item) => !isDigest(item))
    || parsed.some((item, index) => index > 0 && item <= parsed[index - 1]!)
  ) throw integrityError();
  return Object.freeze([...parsed] as string[]);
}

function normalizeFeedback(input: LocalClientFeedbackDedupEvent): NormalizedFeedback {
  if (!isPlainRecord(input)) throw eventInvalidError();
  assertExactKeys(input, [
    "tenantId",
    "clientId",
    "eventId",
    "taskId",
    "outcome",
    "latencyMs",
    "capabilities",
    "observedAt",
  ], false, eventInvalidError);
  const tenantId = normalizeId(input.tenantId);
  const clientId = normalizeId(input.clientId);
  const eventId = normalizeId(input.eventId);
  const taskId = normalizeId(input.taskId);
  if (typeof input.outcome !== "string" || !OUTCOME_PATTERN.test(input.outcome)) {
    throw eventInvalidError();
  }
  if (
    typeof input.latencyMs !== "number"
    || !Number.isSafeInteger(input.latencyMs)
    || input.latencyMs < 0
    || input.latencyMs > MAX_LATENCY_MS
  ) throw eventInvalidError();
  if (!Array.isArray(input.capabilities) || input.capabilities.length > MAX_CAPABILITIES) {
    throw eventInvalidError();
  }
  const capabilities = input.capabilities.map((item) => {
    if (typeof item !== "string" || !CAPABILITY_PATTERN.test(item)) throw eventInvalidError();
    return item;
  }).sort();
  if (capabilities.some((item, index) => index > 0 && item === capabilities[index - 1])) {
    throw eventInvalidError();
  }
  const observedAtMs = parseCanonicalIso(input.observedAt);
  return Object.freeze({
    tenantId,
    clientId,
    eventId,
    taskId,
    outcome: input.outcome,
    latencyMs: input.latencyMs,
    capabilities: Object.freeze(capabilities),
    observedAt: input.observedAt,
    observedAtMs,
  });
}

function normalizeId(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_ID_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw eventInvalidError();
  return value;
}

function parseCanonicalIso(value: unknown): number {
  if (
    typeof value !== "string"
    || value.length < 20
    || value.length > 32
    || value !== value.trim()
  ) throw eventInvalidError();
  const parsed = Date.parse(value);
  if (!isSafeNonNegativeInteger(parsed) || parsed > MAX_DATE_MS) throw eventInvalidError();
  try {
    if (new Date(parsed).toISOString() !== value) throw eventInvalidError();
  } catch {
    throw eventInvalidError();
  }
  return parsed;
}

function normalizeClaimReference(input: LocalClientFeedbackClaimReference) {
  if (!isPlainRecord(input)) throw claimInvalidError();
  assertExactKeys(input, [
    "leaseToken",
    "fencingToken",
    "eventFingerprint",
    "contentFingerprint",
  ], false, claimInvalidError);
  if (
    typeof input.leaseToken !== "string"
    || input.leaseToken.length < 32
    || input.leaseToken.length > MAX_LEASE_TOKEN_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(input.leaseToken)
    || !isFencingToken(input.fencingToken, false)
    || !isDigest(input.eventFingerprint)
    || !isDigest(input.contentFingerprint)
  ) throw claimInvalidError();
  return Object.freeze({ ...input });
}

function digestLeaseToken(key: Uint8Array, token: string): string {
  return keyedDigest(key, "lease-token", token);
}

function assertClaimMatches(
  row: FeedbackRow,
  reference: LocalClientFeedbackClaimReference,
  tokenDigest: string,
): void {
  if (
    !safeDigestEqual(row.event_key_hmac, reference.eventFingerprint)
    || !safeDigestEqual(row.content_fingerprint, reference.contentFingerprint)
    || row.lease_token_digest === ""
    || !safeDigestEqual(row.lease_token_digest, tokenDigest)
    || row.lease_fencing_token !== reference.fencingToken
  ) throw claimStaleError();
}

function hasActiveLease(row: FeedbackRow, nowMs: number): boolean {
  return row.delivery_status === "pending"
    && row.lease_token_digest !== ""
    && nowMs < row.lease_expires_at_ms;
}

function assertOptions(options: LocalClientSqliteFeedbackDedupStoreOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  assertExactKeys(options, [
    "sqlitePath",
    "hostId",
    "integrityKey",
    "namespace",
    "ttlMs",
    "leaseTtlMs",
    "maxEvents",
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

function readPragmaInteger(db: DatabaseSync, name: "user_version"): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value) || value < 0) throw schemaError();
  return value;
}

function selectFeedbackFields(): string {
  return `SELECT
    record_version, event_key_hmac, content_fingerprint, tenant_hmac,
    client_hmac, event_id_hmac, task_hmac, outcome, latency_ms,
    capabilities_hmac_json, observed_at_ms, admitted_at_ms,
    delivery_status, lease_token_digest, lease_fencing_token,
    lease_claimed_at_ms, lease_expires_at_ms, claim_count,
    applied_at_ms, retire_at_ms, record_hmac
    FROM local_client_feedback_dedup_events`;
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

function fingerprint(digest: string): string {
  if (!isDigest(digest)) throw integrityError();
  return digest.slice(0, 16);
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
  return prototype === Object.prototype || prototype === null;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
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

function isKnownError(error: unknown): error is LocalClientSqliteFeedbackDedupStoreError {
  return error instanceof LocalClientSqliteFeedbackDedupStoreError;
}

function feedbackStoreError(
  code: LocalClientSqliteFeedbackDedupStoreErrorCode,
  message: string,
  category: LocalClientSqliteFeedbackDedupStoreError["category"],
  statusCode: number,
  retryable = false,
): LocalClientSqliteFeedbackDedupStoreError {
  return new LocalClientSqliteFeedbackDedupStoreError(
    code,
    message,
    category,
    statusCode,
    retryable,
  );
}

function configurationError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_CONFIGURATION_INVALID",
    "The local-client feedback deduplication configuration is invalid.",
    "configuration",
    500,
  );
}

function eventInvalidError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_EVENT_INVALID",
    "The local-client feedback event is invalid.",
    "validation",
    400,
  );
}

function conflictError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_EVENT_CONFLICT",
    "The local-client feedback event ID was already admitted with different canonical content.",
    "conflict",
    409,
  );
}

function eventNotFoundError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_EVENT_NOT_FOUND",
    "The local-client feedback event is no longer available for acknowledgement.",
    "lease",
    404,
  );
}

function claimInvalidError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_CLAIM_INVALID",
    "A complete local-client feedback delivery claim is required.",
    "validation",
    400,
  );
}

function claimStaleError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_CLAIM_STALE",
    "The local-client feedback delivery claim is stale or does not own this event.",
    "lease",
    409,
  );
}

function claimExpiredError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_CLAIM_EXPIRED",
    "The local-client feedback delivery claim expired before acknowledgement.",
    "lease",
    409,
    true,
  );
}

function capacityError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_CAPACITY",
    "The bounded local-client feedback deduplication store is full.",
    "capacity",
    429,
    true,
  );
}

function schemaError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_SCHEMA_INCOMPATIBLE",
    "The local-client feedback deduplication schema is incompatible.",
    "persistence",
    500,
  );
}

function hostMismatchError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_HOST_MISMATCH",
    "The local-client feedback deduplication store belongs to another host.",
    "configuration",
    500,
  );
}

function keyMismatchError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_KEY_MISMATCH",
    "The local-client feedback deduplication store is bound to another integrity key.",
    "configuration",
    500,
  );
}

function closedError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_CLOSED",
    "The local-client feedback deduplication store is closed.",
    "persistence",
    503,
  );
}

function storeUnavailableError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_UNAVAILABLE",
    "The local-client feedback deduplication store is unavailable.",
    "persistence",
    503,
    true,
  );
}

function clockError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_CLOCK_INVALID",
    "The local-client feedback deduplication clock moved backwards or is invalid.",
    "integrity",
    503,
  );
}

function integrityError(): LocalClientSqliteFeedbackDedupStoreError {
  return feedbackStoreError(
    "LOCAL_CLIENT_FEEDBACK_DEDUP_INTEGRITY_INVALID",
    "The local-client feedback deduplication store failed an integrity check.",
    "integrity",
    500,
  );
}
