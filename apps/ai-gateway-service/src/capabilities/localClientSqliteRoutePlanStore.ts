import { createHash, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_ENTRIES,
  LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
  LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_TTL_MS,
  LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES,
  LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_INPUT_BYTES,
  LOCAL_CLIENT_ROUTE_PLAN_MAX_TTL_MS,
  LOCAL_CLIENT_ROUTE_PLAN_VERSION,
  LocalClientRoutePlanStore,
  LocalClientRoutePlanStoreError,
  verifyLocalClientRoutePlanInput,
  type CreateLocalClientRoutePlanRequest,
  type LocalClientRoutePlan,
  type LocalClientRoutePlanBoundaries,
  type LocalClientRoutePlanReference,
  type VerifiedLocalClientRoutePlanInput,
} from "./localClientRoutePlanStore.ts";

export const LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION = 1 as const;
export const LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES = Object.freeze({
  storageMode: "single-host-sqlite" as const,
  available: true as const,
  durable: true as const,
  distributed: false as const,
  previewOnly: true as const,
  grantsApproval: false as const,
  providesExternalEffectFence: false as const,
  oneTimeConsume: true as const,
  singleHost: true as const,
}) satisfies LocalClientRoutePlanBoundaries;

export interface LocalClientSqliteRoutePlanStoreOptions {
  readonly sqlitePath: string;
  /** Stable, host-unique identifier. Only its SHA-256 binding is persisted. */
  readonly hostId: string;
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly maxInputBytes?: number;
  readonly busyTimeoutMs?: number;
  readonly now?: () => number;
}

export type LocalClientSqliteRoutePlanStoreErrorCode =
  | "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_HOST_MISMATCH"
  | "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CLOSED"
  | "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_STORE_UNAVAILABLE"
  | "LOCAL_CLIENT_ROUTE_PLAN_CLOCK_INVALID"
  | "LOCAL_CLIENT_ROUTE_PLAN_CAPACITY_REACHED"
  | "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE"
  | "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED"
  | "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED"
  | "LOCAL_CLIENT_ROUTE_PLAN_INTEGRITY_INVALID";

export class LocalClientSqliteRoutePlanStoreError extends Error {
  readonly code: LocalClientSqliteRoutePlanStoreErrorCode;
  readonly category: "configuration" | "persistence" | "auth" | "capacity" | "lifecycle" | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientSqliteRoutePlanStoreErrorCode,
    message: string,
    category: LocalClientSqliteRoutePlanStoreError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientSqliteRoutePlanStoreError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type MetadataRow = {
  schema_version: number;
  host_binding_sha256: string;
  ttl_ms: number;
  max_entries: number;
  max_input_bytes: number;
  last_observed_at_ms: number;
  metadata_digest: string;
};

type PlanState = "active" | "consumed";

type PlanRow = {
  record_version: number;
  plan_id: string;
  tenant_id: string;
  subject_id: string;
  plan_json: string;
  input_sha256: string;
  created_at_ms: number;
  expires_at_ms: number;
  state: PlanState;
  consumed_at_ms: number | null;
  record_digest: string;
};

type DecodedRow = Readonly<{
  row: PlanRow;
  plan: LocalClientRoutePlan;
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 1;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_PLAN_JSON_BYTES = 16 * 1_024;
const MAX_DATE_MS = 8_640_000_000_000_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;

/**
 * Durable across process restarts and safe for multiple processes on one host.
 * It is deliberately not a distributed store, approval grant, or external-
 * effect fence. A stable hostId prevents accidental reuse from another host.
 */
export class LocalClientSqliteRoutePlanStore {
  readonly status: Readonly<{
    storageMode: "single-host-sqlite";
    available: true;
    durable: true;
    distributed: false;
    singleHost: true;
    crossHostSupported: false;
    previewOnly: true;
    grantsApproval: false;
    providesExternalEffectFence: false;
    oneTimeConsume: true;
    schemaVersion: 1;
    journalMode: "wal";
    synchronous: "full";
    ttlMs: number;
    maxEntries: number;
    maxInputBytes: number;
    busyTimeoutMs: number;
  }>;

  readonly #db!: DatabaseSync;
  readonly #sqlitePath: string;
  readonly #hostBindingSha256: string;
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #maxInputBytes: number;
  readonly #now: () => number;
  #closed = false;

  constructor(options: LocalClientSqliteRoutePlanStoreOptions) {
    assertOptions(options);
    this.#sqlitePath = resolveSqlitePath(options.sqlitePath);
    this.#hostBindingSha256 = sha256(assertHostId(options.hostId));
    this.#ttlMs = boundedInteger(
      options.ttlMs,
      LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_TTL_MS,
      1,
      LOCAL_CLIENT_ROUTE_PLAN_MAX_TTL_MS,
    );
    this.#maxEntries = boundedInteger(
      options.maxEntries,
      LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_ENTRIES,
      1,
      LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES,
    );
    this.#maxInputBytes = boundedInteger(
      options.maxInputBytes,
      LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
      2,
      LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_INPUT_BYTES,
    );
    const busyTimeoutMs = boundedInteger(options.busyTimeoutMs, DEFAULT_BUSY_TIMEOUT_MS, 100, MAX_BUSY_TIMEOUT_MS);
    if (options.now !== undefined && typeof options.now !== "function") throw configurationError();
    this.#now = options.now ?? Date.now;

    mkdirSync(dirname(this.#sqlitePath), { recursive: true, mode: 0o700 });
    try { chmodSync(dirname(this.#sqlitePath), 0o700); } catch { /* Windows may not expose POSIX modes. */ }
    try {
      this.#db = new DatabaseSync(this.#sqlitePath);
      this.#db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
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

    this.status = Object.freeze({
      ...LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES,
      crossHostSupported: false as const,
      schemaVersion: LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION,
      journalMode: "wal" as const,
      synchronous: "full" as const,
      ttlMs: this.#ttlMs,
      maxEntries: this.#maxEntries,
      maxInputBytes: this.#maxInputBytes,
      busyTimeoutMs,
    });
  }

  async create(request: CreateLocalClientRoutePlanRequest): Promise<LocalClientRoutePlan> {
    return this.#transaction(() => {
      const nowMs = this.#observeNow();
      this.#purgeExpired(nowMs);
      const plan = this.#buildPlan(request, nowMs);
      const existing = this.#selectRow(plan.planId);
      if (existing) {
        const decoded = this.#decodeRow(existing);
        if (canonicalJson(decoded.plan) !== canonicalJson(plan)) throw integrityError();
        if (existing.state === "consumed") throw consumedError();
        return decoded.plan;
      }
      const count = this.#countEntries();
      if (count >= this.#maxEntries) throw capacityError();
      const row = createPlanRow(plan, "active", null);
      const result = this.#db.prepare(`
        INSERT INTO local_client_route_plans (
          record_version, plan_id, tenant_id, subject_id, plan_json,
          input_sha256, created_at_ms, expires_at_ms, state,
          consumed_at_ms, record_digest
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.record_version,
        row.plan_id,
        row.tenant_id,
        row.subject_id,
        row.plan_json,
        row.input_sha256,
        row.created_at_ms,
        row.expires_at_ms,
        row.state,
        row.consumed_at_ms,
        row.record_digest,
      );
      if (Number(result.changes) !== 1) throw integrityError();
      return plan;
    });
  }

  async get(reference: LocalClientRoutePlanReference): Promise<LocalClientRoutePlan> {
    const normalized = validateReference(reference);
    const outcome = this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#selectRow(normalized.planId);
      if (!row) throw unavailableError();
      const decoded = this.#decodeRow(row);
      assertScope(decoded.plan, normalized);
      if (nowMs >= row.expires_at_ms) {
        this.#deleteExactRow(row);
        return null;
      }
      if (row.state === "consumed") throw consumedError();
      return decoded.plan;
    });
    if (outcome === null) throw expiredError();
    return outcome;
  }

  async consume(reference: LocalClientRoutePlanReference): Promise<LocalClientRoutePlan> {
    const normalized = validateReference(reference);
    const outcome = this.#transaction(() => {
      const nowMs = this.#observeNow();
      const row = this.#selectRow(normalized.planId);
      if (!row) throw unavailableError();
      const decoded = this.#decodeRow(row);
      assertScope(decoded.plan, normalized);
      if (nowMs >= row.expires_at_ms) {
        this.#deleteExactRow(row);
        return null;
      }
      if (row.state === "consumed") throw consumedError();
      const consumedRow = createPlanRow(decoded.plan, "consumed", nowMs);
      const result = this.#db.prepare(`
        UPDATE local_client_route_plans
        SET state = 'consumed', consumed_at_ms = ?, record_digest = ?
        WHERE plan_id = ? AND state = 'active' AND record_digest = ?
      `).run(nowMs, consumedRow.record_digest, row.plan_id, row.record_digest);
      if (Number(result.changes) !== 1) throw integrityError();
      return decoded.plan;
    });
    if (outcome === null) throw expiredError();
    return outcome;
  }

  /** Input comparison only; it grants no scope, approval, or execution authority. */
  async verifyInput(
    reference: LocalClientRoutePlanReference,
    input: unknown,
  ): Promise<VerifiedLocalClientRoutePlanInput> {
    const plan = await this.get(reference);
    return verifyLocalClientRoutePlanInput(plan, input, this.#maxInputBytes);
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#db.close();
  }

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      // Read the version after acquiring the write lock so simultaneous first
      // openers observe the schema committed by the winner instead of both
      // attempting initialization from a stale version-zero snapshot.
      const userVersion = readPragmaInteger(this.#db, "user_version");
      if (userVersion !== 0 && userVersion !== LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION) {
        throw schemaError();
      }
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_route_plan_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          host_binding_sha256 TEXT NOT NULL,
          ttl_ms INTEGER NOT NULL CHECK (ttl_ms > 0),
          max_entries INTEGER NOT NULL CHECK (max_entries > 0),
          max_input_bytes INTEGER NOT NULL CHECK (max_input_bytes > 0),
          last_observed_at_ms INTEGER NOT NULL CHECK (last_observed_at_ms >= 0),
          metadata_digest TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_route_plans (
          record_version INTEGER NOT NULL,
          plan_id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          plan_json TEXT NOT NULL,
          input_sha256 TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
          expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms),
          state TEXT NOT NULL CHECK (state IN ('active', 'consumed')),
          consumed_at_ms INTEGER,
          record_digest TEXT NOT NULL,
          CHECK (
            (state = 'active' AND consumed_at_ms IS NULL)
            OR (state = 'consumed' AND consumed_at_ms IS NOT NULL)
          )
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_route_plans_expiry_idx
          ON local_client_route_plans (expires_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_route_plans_scope_idx
          ON local_client_route_plans (tenant_id, subject_id, plan_id);
      `);
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        const planCount = this.#countEntries();
        if (metadata || planCount !== 0) throw schemaError();
        const initial = createMetadataRow({
          hostBindingSha256: this.#hostBindingSha256,
          ttlMs: this.#ttlMs,
          maxEntries: this.#maxEntries,
          maxInputBytes: this.#maxInputBytes,
          lastObservedAtMs: 0,
        });
        this.#db.prepare(`
          INSERT INTO local_client_route_plan_metadata (
            singleton, schema_version, host_binding_sha256, ttl_ms,
            max_entries, max_input_bytes, last_observed_at_ms, metadata_digest
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.host_binding_sha256,
          initial.ttl_ms,
          initial.max_entries,
          initial.max_input_bytes,
          initial.last_observed_at_ms,
          initial.metadata_digest,
        );
        this.#db.exec(`PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION}`);
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
      hostBindingSha256: this.#hostBindingSha256,
      ttlMs: this.#ttlMs,
      maxEntries: this.#maxEntries,
      maxInputBytes: this.#maxInputBytes,
      lastObservedAtMs: nowMs,
    });
    const result = this.#db.prepare(`
      UPDATE local_client_route_plan_metadata
      SET last_observed_at_ms = ?, metadata_digest = ?
      WHERE singleton = ? AND metadata_digest = ?
    `).run(nowMs, updated.metadata_digest, METADATA_SINGLETON, metadata.metadata_digest);
    if (Number(result.changes) !== 1) throw integrityError();
    return nowMs;
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, host_binding_sha256, ttl_ms, max_entries,
             max_input_bytes, last_observed_at_ms, metadata_digest
      FROM local_client_route_plan_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      !isSafeNonNegativeInteger(row.schema_version)
      || !isSafeNonNegativeInteger(row.ttl_ms)
      || !isSafeNonNegativeInteger(row.max_entries)
      || !isSafeNonNegativeInteger(row.max_input_bytes)
      || !isSafeNonNegativeInteger(row.last_observed_at_ms)
      || !SHA256_PATTERN.test(String(row.host_binding_sha256 ?? ""))
      || !SHA256_PATTERN.test(String(row.metadata_digest ?? ""))
    ) {
      throw integrityError();
    }
    if (row.schema_version !== LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION) throw schemaError();
    if (row.host_binding_sha256 !== this.#hostBindingSha256) throw hostMismatchError();
    if (
      row.ttl_ms !== this.#ttlMs
      || row.max_entries !== this.#maxEntries
      || row.max_input_bytes !== this.#maxInputBytes
    ) {
      throw configurationError();
    }
    const expected = createMetadataRow({
      hostBindingSha256: row.host_binding_sha256,
      ttlMs: row.ttl_ms,
      maxEntries: row.max_entries,
      maxInputBytes: row.max_input_bytes,
      lastObservedAtMs: row.last_observed_at_ms,
    }).metadata_digest;
    if (!safeDigestEqual(row.metadata_digest, expected)) throw integrityError();
  }

  #buildPlan(request: CreateLocalClientRoutePlanRequest, nowMs: number): LocalClientRoutePlan {
    const transient = new LocalClientRoutePlanStore({
      ttlMs: this.#ttlMs,
      maxEntries: 1,
      maxInputBytes: this.#maxInputBytes,
      now: () => nowMs,
    }).create(request);
    const { planId: _memoryPlanId, boundaries: _memoryBoundaries, ...core } = transient;
    const unsigned = Object.freeze({
      ...core,
      boundaries: LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES,
    });
    const planId = sha256(canonicalJson(unsigned));
    return freezeSqlitePlan({ ...unsigned, planId });
  }

  #selectRow(planId: string): PlanRow | undefined {
    return this.#db.prepare(`
      SELECT record_version, plan_id, tenant_id, subject_id, plan_json,
             input_sha256, created_at_ms, expires_at_ms, state,
             consumed_at_ms, record_digest
      FROM local_client_route_plans WHERE plan_id = ?
    `).get(planId) as PlanRow | undefined;
  }

  #countEntries(): number {
    const row = this.#db.prepare("SELECT COUNT(*) AS count FROM local_client_route_plans").get() as {
      count?: unknown;
    } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES) {
      throw integrityError();
    }
    return count;
  }

  #decodeRow(row: PlanRow): DecodedRow {
    validatePlanRowShape(row);
    const expectedRecordDigest = digestPlanRow({ ...row, record_digest: "" });
    if (!safeDigestEqual(row.record_digest, expectedRecordDigest)) throw integrityError();
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.plan_json);
    } catch {
      throw integrityError();
    }
    const plan = validateAndFreezePlan(parsed, this.#ttlMs);
    if (
      plan.planId !== row.plan_id
      || plan.tenantId !== row.tenant_id
      || plan.subjectId !== row.subject_id
      || plan.inputSha256 !== row.input_sha256
      || Date.parse(plan.createdAt) !== row.created_at_ms
      || Date.parse(plan.expiresAt) !== row.expires_at_ms
      || canonicalJson(plan) !== row.plan_json
    ) {
      throw integrityError();
    }
    return Object.freeze({ row, plan });
  }

  #deleteExactRow(row: PlanRow): void {
    const result = this.#db.prepare(`
      DELETE FROM local_client_route_plans WHERE plan_id = ? AND record_digest = ?
    `).run(row.plan_id, row.record_digest);
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #purgeExpired(nowMs: number): void {
    const rows = this.#db.prepare(`
      SELECT record_version, plan_id, tenant_id, subject_id, plan_json,
             input_sha256, created_at_ms, expires_at_ms, state,
             consumed_at_ms, record_digest
      FROM local_client_route_plans WHERE expires_at_ms <= ?
    `).all(nowMs) as PlanRow[];
    for (const row of rows) this.#decodeRow(row);
    if (rows.length > 0) {
      const result = this.#db.prepare("DELETE FROM local_client_route_plans WHERE expires_at_ms <= ?").run(nowMs);
      if (Number(result.changes) !== rows.length) throw integrityError();
    }
  }

  #scanPersistedRecords(): void {
    const rows = this.#db.prepare(`
      SELECT record_version, plan_id, tenant_id, subject_id, plan_json,
             input_sha256, created_at_ms, expires_at_ms, state,
             consumed_at_ms, record_digest
      FROM local_client_route_plans
    `).all() as PlanRow[];
    if (rows.length > this.#maxEntries) throw capacityError();
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

export function createLocalClientSqliteRoutePlanStore(
  options: LocalClientSqliteRoutePlanStoreOptions,
): LocalClientSqliteRoutePlanStore {
  return new LocalClientSqliteRoutePlanStore(options);
}

function createMetadataRow(input: {
  hostBindingSha256: string;
  ttlMs: number;
  maxEntries: number;
  maxInputBytes: number;
  lastObservedAtMs: number;
}): MetadataRow {
  const unsigned = {
    schemaVersion: LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION,
    hostBindingSha256: input.hostBindingSha256,
    ttlMs: input.ttlMs,
    maxEntries: input.maxEntries,
    maxInputBytes: input.maxInputBytes,
    lastObservedAtMs: input.lastObservedAtMs,
  };
  return {
    schema_version: LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION,
    host_binding_sha256: input.hostBindingSha256,
    ttl_ms: input.ttlMs,
    max_entries: input.maxEntries,
    max_input_bytes: input.maxInputBytes,
    last_observed_at_ms: input.lastObservedAtMs,
    metadata_digest: sha256(canonicalJson(unsigned)),
  };
}

function createPlanRow(plan: LocalClientRoutePlan, state: PlanState, consumedAtMs: number | null): PlanRow {
  const rowWithoutDigest: Omit<PlanRow, "record_digest"> = {
    record_version: RECORD_VERSION,
    plan_id: plan.planId,
    tenant_id: plan.tenantId,
    subject_id: plan.subjectId,
    plan_json: canonicalJson(plan),
    input_sha256: plan.inputSha256,
    created_at_ms: Date.parse(plan.createdAt),
    expires_at_ms: Date.parse(plan.expiresAt),
    state,
    consumed_at_ms: consumedAtMs,
  };
  return { ...rowWithoutDigest, record_digest: digestPlanRow({ ...rowWithoutDigest, record_digest: "" }) };
}

function digestPlanRow(row: PlanRow): string {
  return sha256(canonicalJson({
    recordVersion: row.record_version,
    planId: row.plan_id,
    tenantId: row.tenant_id,
    subjectId: row.subject_id,
    planJson: row.plan_json,
    inputSha256: row.input_sha256,
    createdAtMs: row.created_at_ms,
    expiresAtMs: row.expires_at_ms,
    state: row.state,
    consumedAtMs: row.consumed_at_ms,
  }));
}

function validatePlanRowShape(row: PlanRow): void {
  if (
    row.record_version !== RECORD_VERSION
    || typeof row.plan_id !== "string"
    || !SHA256_PATTERN.test(row.plan_id)
    || !isBoundedIdentity(row.tenant_id)
    || !isBoundedIdentity(row.subject_id)
    || typeof row.plan_json !== "string"
    || Buffer.byteLength(row.plan_json, "utf8") > MAX_PLAN_JSON_BYTES
    || typeof row.input_sha256 !== "string"
    || !SHA256_PATTERN.test(row.input_sha256)
    || !isSafeNonNegativeInteger(row.created_at_ms)
    || !isSafeNonNegativeInteger(row.expires_at_ms)
    || row.expires_at_ms <= row.created_at_ms
    || (row.state !== "active" && row.state !== "consumed")
    || (row.state === "active" && row.consumed_at_ms !== null)
    || (row.state === "consumed" && (
      !isSafeNonNegativeInteger(row.consumed_at_ms)
      || row.consumed_at_ms < row.created_at_ms
      || row.consumed_at_ms >= row.expires_at_ms
    ))
    || !SHA256_PATTERN.test(String(row.record_digest ?? ""))
  ) {
    throw integrityError();
  }
}

function validateAndFreezePlan(value: unknown, ttlMs: number): LocalClientRoutePlan {
  if (!isPlainRecord(value)) throw integrityError();
  assertExactKeys(value, [
    "planVersion",
    "tenantId",
    "subjectId",
    "clientId",
    "clientRevision",
    "clientState",
    "clientTrustDecision",
    "adapterId",
    "adapterType",
    "adapterVersion",
    "capabilityId",
    "actionId",
    "inputSha256",
    "policyVersion",
    "createdAt",
    "expiresAt",
    "boundaries",
    "planId",
  ]);
  if (!isPlainRecord(value.boundaries)) throw integrityError();
  assertExactKeys(value.boundaries, [
    "storageMode",
    "available",
    "durable",
    "distributed",
    "previewOnly",
    "grantsApproval",
    "providesExternalEffectFence",
    "oneTimeConsume",
    "singleHost",
  ]);
  const createdAtMs = Date.parse(String(value.createdAt ?? ""));
  const expiresAtMs = Date.parse(String(value.expiresAt ?? ""));
  if (
    value.planVersion !== LOCAL_CLIENT_ROUTE_PLAN_VERSION
    || !SHA256_PATTERN.test(String(value.planId ?? ""))
    || !isBoundedIdentity(value.tenantId)
    || !isBoundedIdentity(value.subjectId)
    || !isIdentifier(value.clientId)
    || !Number.isSafeInteger(value.clientRevision)
    || Number(value.clientRevision) < 1
    || value.clientState !== "verified"
    || value.clientTrustDecision !== "verified"
    || !isIdentifier(value.adapterId)
    || !isIdentifier(value.adapterType)
    || typeof value.adapterVersion !== "string"
    || value.adapterVersion.length > 64
    || !SEMVER_PATTERN.test(value.adapterVersion)
    || !isIdentifier(value.capabilityId)
    || !isIdentifier(value.actionId)
    || !SHA256_PATTERN.test(String(value.inputSha256 ?? ""))
    || !isBoundedPolicyVersion(value.policyVersion)
    || !Number.isSafeInteger(createdAtMs)
    || !Number.isSafeInteger(expiresAtMs)
    || expiresAtMs - createdAtMs !== ttlMs
    || new Date(createdAtMs).toISOString() !== value.createdAt
    || new Date(expiresAtMs).toISOString() !== value.expiresAt
    || canonicalJson(value.boundaries) !== canonicalJson(LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES)
  ) {
    throw integrityError();
  }
  const unsigned = { ...value };
  delete unsigned.planId;
  if (sha256(canonicalJson(unsigned)) !== value.planId) throw integrityError();
  return freezeSqlitePlan({
    planVersion: LOCAL_CLIENT_ROUTE_PLAN_VERSION,
    tenantId: value.tenantId,
    subjectId: value.subjectId,
    clientId: value.clientId,
    clientRevision: value.clientRevision,
    clientState: "verified",
    clientTrustDecision: "verified",
    adapterId: value.adapterId,
    adapterType: value.adapterType,
    adapterVersion: value.adapterVersion,
    capabilityId: value.capabilityId,
    actionId: value.actionId,
    inputSha256: value.inputSha256,
    policyVersion: value.policyVersion,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    boundaries: LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES,
    planId: value.planId,
  } as LocalClientRoutePlan);
}

function freezeSqlitePlan(plan: LocalClientRoutePlan): LocalClientRoutePlan {
  return Object.freeze({ ...plan, boundaries: LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES });
}

function validateReference(reference: LocalClientRoutePlanReference): LocalClientRoutePlanReference {
  if (!isPlainRecord(reference)) throw unavailableError();
  assertExactKeys(reference, ["tenantId", "subjectId", "planId"], unavailableError);
  if (
    !isBoundedIdentity(reference.tenantId)
    || !isBoundedIdentity(reference.subjectId)
    || typeof reference.planId !== "string"
    || !SHA256_PATTERN.test(reference.planId)
  ) {
    throw unavailableError();
  }
  return Object.freeze({
    tenantId: reference.tenantId,
    subjectId: reference.subjectId,
    planId: reference.planId,
  });
}

function assertScope(plan: LocalClientRoutePlan, reference: LocalClientRoutePlanReference): void {
  if (plan.tenantId !== reference.tenantId || plan.subjectId !== reference.subjectId) throw unavailableError();
}

function assertOptions(options: LocalClientSqliteRoutePlanStoreOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  const allowed = new Set([
    "sqlitePath",
    "hostId",
    "ttlMs",
    "maxEntries",
    "maxInputBytes",
    "busyTimeoutMs",
    "now",
  ]);
  const keys = Reflect.ownKeys(options);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.has(key))
    || !Object.hasOwn(options, "sqlitePath")
    || !Object.hasOwn(options, "hostId")
  ) {
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
  ) {
    throw configurationError();
  }
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

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  errorFactory: () => Error = integrityError,
): void {
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length
    || actual.some((key) => typeof key !== "string" || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw errorFactory();
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

function isBoundedIdentity(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isBoundedPolicyVersion(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 128
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
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

function isKnownError(error: unknown): error is Error {
  return error instanceof LocalClientSqliteRoutePlanStoreError
    || error instanceof LocalClientRoutePlanStoreError;
}

function sqliteRoutePlanError(
  code: LocalClientSqliteRoutePlanStoreErrorCode,
  message: string,
  category: LocalClientSqliteRoutePlanStoreError["category"],
  statusCode: number,
  retryable = false,
): LocalClientSqliteRoutePlanStoreError {
  return new LocalClientSqliteRoutePlanStoreError(code, message, category, statusCode, retryable);
}

function configurationError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CONFIGURATION_INVALID",
    "The single-host SQLite route-plan configuration is invalid or inconsistent.",
    "configuration",
    500,
  );
}

function schemaError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_INCOMPATIBLE",
    "The SQLite route-plan schema version or journal mode is incompatible.",
    "configuration",
    500,
  );
}

function hostMismatchError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_HOST_MISMATCH",
    "The SQLite route-plan file is bound to a different host identity.",
    "configuration",
    409,
  );
}

function closedError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CLOSED",
    "The SQLite route-plan store is closed.",
    "persistence",
    503,
  );
}

function storeUnavailableError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_STORE_UNAVAILABLE",
    "The single-host SQLite route-plan store is unavailable.",
    "persistence",
    503,
    true,
  );
}

function clockError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_CLOCK_INVALID",
    "The durable route-plan clock is invalid or moved backwards.",
    "integrity",
    503,
  );
}

function capacityError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_CAPACITY_REACHED",
    "The bounded single-host route-plan store is full.",
    "capacity",
    503,
    true,
  );
}

function unavailableError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    "The route plan is unavailable in this tenant and subject scope.",
    "auth",
    404,
  );
}

function expiredError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED",
    "The durable route plan has expired and was removed.",
    "lifecycle",
    410,
  );
}

function consumedError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
    "The durable one-time route plan has already been consumed.",
    "lifecycle",
    409,
  );
}

function integrityError(): LocalClientSqliteRoutePlanStoreError {
  return sqliteRoutePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_INTEGRITY_INVALID",
    "The durable route-plan record failed canonical integrity validation.",
    "integrity",
    409,
  );
}
