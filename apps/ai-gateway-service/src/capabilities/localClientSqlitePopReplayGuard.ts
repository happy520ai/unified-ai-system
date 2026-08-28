import { createHmac, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  ManagedLocalClientPopReplayConsumeInput,
  ManagedLocalClientPopReplayGuard,
  ManagedLocalClientPopReplayGuardStatus,
} from "./localClientPopIdentityAuthority.ts";

export const LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION = 3 as const;

export const LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES = Object.freeze({
  storageMode: "single-host-sqlite-pop-replay" as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  journalMode: "wal" as const,
  synchronous: "full" as const,
  trustedSchema: false as const,
  defensive: "runtime-detected" as const,
  defensiveRequiredForAvailability: false as const,
  atomicConsume: true as const,
  capacityIsolation: "per-scope-and-global" as const,
  authenticatedReplaySet: "count+xor-hmac-v1" as const,
  snapshotRollbackProtected: false as const,
  rowScan: "streamed-and-max-entries-bounded" as const,
  replayRetention: "proof-expiry-ttl" as const,
  clockRollbackPolicy: "fail-closed" as const,
  rowIntegrity: "hmac-sha256" as const,
  metadataIntegrity: "hmac-sha256" as const,
  rawReplayKeyPersisted: false as const,
  rawReplayScopePersisted: false as const,
  rawHostIdPersisted: false as const,
  rawNamespacePersisted: false as const,
  rawIntegrityKeyPersisted: false as const,
  inputIntegrityKeyConsumed: true as const,
});

export interface LocalClientSqlitePopReplayGuardOptions {
  readonly sqlitePath: string;
  /** Stable host identity. Only a keyed HMAC binding is persisted. */
  readonly hostId: string;
  /**
   * Dedicated 32-64 byte Buffer. Construction takes ownership and clears this
   * source Buffer on both success and failure; callers must not reuse it.
   */
  readonly integrityKey: Buffer;
  readonly namespace?: string;
  /** Global retained-entry ceiling across all replay scopes. */
  readonly maxEntries?: number;
  /**
   * Retained-entry ceiling for one opaque authority scope. Defaults below the
   * global ceiling whenever maxEntries is greater than one.
   */
  readonly maxEntriesPerScope?: number;
  readonly busyTimeoutMs?: number;
}

export type LocalClientSqlitePopReplayGuardErrorCode =
  | "LOCAL_CLIENT_POP_REPLAY_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_POP_REPLAY_INPUT_INVALID"
  | "LOCAL_CLIENT_POP_REPLAY_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_POP_REPLAY_HOST_MISMATCH"
  | "LOCAL_CLIENT_POP_REPLAY_NAMESPACE_MISMATCH"
  | "LOCAL_CLIENT_POP_REPLAY_KEY_MISMATCH"
  | "LOCAL_CLIENT_POP_REPLAY_CONFIG_MISMATCH"
  | "LOCAL_CLIENT_POP_REPLAY_CLOSED"
  | "LOCAL_CLIENT_POP_REPLAY_STORE_UNAVAILABLE"
  | "LOCAL_CLIENT_POP_REPLAY_CLOCK_ROLLBACK"
  | "LOCAL_CLIENT_POP_REPLAY_INTEGRITY_INVALID";

export class LocalClientSqlitePopReplayGuardError extends Error {
  readonly code: LocalClientSqlitePopReplayGuardErrorCode;
  readonly category: "configuration" | "validation" | "persistence" | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(input: Readonly<{
    code: LocalClientSqlitePopReplayGuardErrorCode;
    message: string;
    category: LocalClientSqlitePopReplayGuardError["category"];
    statusCode: number;
    retryable?: boolean;
  }>) {
    super(input.message);
    this.name = "LocalClientSqlitePopReplayGuardError";
    this.code = input.code;
    this.category = input.category;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
  }
}

type MetadataRow = {
  schema_version: number;
  key_binding_hmac: string;
  host_binding_hmac: string;
  namespace_binding_hmac: string;
  config_fingerprint: string;
  max_entries: number;
  max_entries_per_scope: number;
  busy_timeout_ms: number;
  last_clock_ms: number;
  entry_count: number;
  entry_accumulator_hmac: string;
  metadata_hmac: string;
};

type ReplayRow = {
  record_version: number;
  replay_key_hmac: string;
  scope_hmac: string;
  consumed_at_ms: number;
  expires_at_ms: number;
  row_hmac: string;
};

type NormalizedConsumeInput = Readonly<{
  replayKeyHmac: string;
  scopeHmac: string;
  nowMs: number;
  expiresAtMs: number;
}>;

type ReplaySetSnapshot = Readonly<{
  count: number;
  selectedScopeHmac?: string;
  selectedScopeCount: number;
  accumulatorHmac: string;
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 2;
const DEFAULT_NAMESPACE = "local-client-pop-replay";
const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_MAX_ENTRIES_PER_SCOPE = 1_000;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_ENTRIES = 1_000_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_DATE_MS = 8_640_000_000_000_000;
const MIN_KEY_BYTES = 32;
const MAX_KEY_BYTES = 64;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const HMAC_DOMAIN = "local-client-sqlite-pop-replay-v3";
const DEFENSIVE_MODE = "single-host-sqlite-pop-replay";
const LEGACY_REPLAY_SCOPE = "legacy-unscoped-replay-port";

/**
 * Durable one-host PoP nonce consumption. BEGIN IMMEDIATE plus a keyed primary
 * key makes consumeOnce atomic across processes sharing the same SQLite file.
 * This is deliberately not a distributed or cross-host replay guard.
 */
export class LocalClientSqlitePopReplayGuard
implements ManagedLocalClientPopReplayGuard {
  readonly #db!: DatabaseSync;
  readonly #key!: Buffer;
  readonly #hostBindingHmac!: string;
  readonly #namespaceBindingHmac!: string;
  readonly #keyBindingHmac!: string;
  readonly #configFingerprint!: string;
  readonly #maxEntries!: number;
  readonly #maxEntriesPerScope!: number;
  readonly #busyTimeoutMs!: number;
  readonly #defensiveEnabled!: boolean;
  #closed = false;
  #available = true;

  constructor(options: LocalClientSqlitePopReplayGuardOptions) {
    const sourceKey = ownedSourceKey(options);
    let internalKey: Buffer | null = null;
    try {
      assertOptions(options);
      const sqlitePath = resolveSqlitePath(options.sqlitePath);
      const hostId = assertHostId(options.hostId);
      const namespace = assertNamespace(options.namespace ?? DEFAULT_NAMESPACE);
      const maxEntries = boundedInteger(options.maxEntries, DEFAULT_MAX_ENTRIES, 1, MAX_ENTRIES);
      const maxEntriesPerScope = resolveMaxEntriesPerScope(
        options.maxEntriesPerScope,
        maxEntries,
      );
      const busyTimeoutMs = boundedInteger(
        options.busyTimeoutMs,
        DEFAULT_BUSY_TIMEOUT_MS,
        100,
        MAX_BUSY_TIMEOUT_MS,
      );

      internalKey = Buffer.from(options.integrityKey);
      this.#key = internalKey;
      this.#hostBindingHmac = keyedDigest(this.#key, "host-binding", hostId);
      this.#namespaceBindingHmac = keyedDigest(this.#key, "namespace-binding", namespace);
      this.#keyBindingHmac = keyedDigest(this.#key, "key-binding", canonicalJson({
        schemaVersion: LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION,
      }));
      this.#configFingerprint = keyedDigest(this.#key, "config-fingerprint", canonicalJson({
        schemaVersion: LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION,
        maxEntries,
        maxEntriesPerScope,
        busyTimeoutMs,
        replayRetention: LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES.replayRetention,
        clockRollbackPolicy: LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES.clockRollbackPolicy,
      }));
      this.#maxEntries = maxEntries;
      this.#maxEntriesPerScope = maxEntriesPerScope;
      this.#busyTimeoutMs = busyTimeoutMs;

      const sqliteDirectory = dirname(sqlitePath);
      const sqliteDirectoryExisted = existsSync(sqliteDirectory);
      mkdirSync(sqliteDirectory, { recursive: true, mode: 0o700 });
      if (!sqliteDirectoryExisted) {
        try { chmodSync(sqliteDirectory, 0o700); } catch { /* Best effort on Windows. */ }
      }
      this.#db = new DatabaseSync(sqlitePath);
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
      this.#defensiveEnabled = typeof defensive === "function";
      if (this.#defensiveEnabled) Reflect.apply(defensive!, this.#db, [true]);
      this.#assertConnectionHardening();
      this.#assertDatabaseHealthy();
      try { chmodSync(sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
      internalKey = null;
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve the initialization error. */ }
      internalKey?.fill(0);
      if (isKnownError(error)) throw error;
      throw storeUnavailableError();
    } finally {
      sourceKey?.fill(0);
    }
  }

  get status(): ManagedLocalClientPopReplayGuardStatus {
    return Object.freeze({
      available: !this.#closed && this.#available,
      durable: true,
      distributed: false,
      mode: DEFENSIVE_MODE,
      authenticatedReplaySet: true,
      snapshotRollbackProtected: false,
      defensiveEnabled: this.#defensiveEnabled,
      capacityIsolatedByScope: true,
      maxEntries: this.#maxEntries,
      maxEntriesPerScope: this.#maxEntriesPerScope,
    });
  }

  /** Runtime capability detail also exposed on the replay-port status. */
  get defensiveEnabled(): boolean {
    return this.#defensiveEnabled;
  }

  readonly consumeOnce = (
    input: ManagedLocalClientPopReplayConsumeInput,
  ): "consumed" | "replayed" | "capacity" => {
    this.#assertOpen();
    const normalized = normalizeConsumeInput(this.#key, input);
    return this.#transaction(() => {
      const metadata = this.#readMetadata();
      if (!metadata) throw integrityError();
      this.#assertMetadata(metadata);
      if (normalized.nowMs < metadata.last_clock_ms) throw clockRollbackError();

      const authenticatedSet = this.#scanRows(normalized.scopeHmac);
      this.#assertReplaySet(metadata, authenticatedSet);
      let updatedSet = this.#purgeExpired(normalized.nowMs, authenticatedSet);

      const existing = this.#selectReplayRow(normalized.replayKeyHmac);
      if (existing) {
        this.#decodeRow(existing);
        const updatedMetadata = this.#replaceMetadataIfChanged(
          metadata,
          normalized.nowMs,
          updatedSet,
        );
        this.#assertReplaySetCount(updatedMetadata);
        return "replayed";
      }
      if (
        updatedSet.selectedScopeCount >= this.#maxEntriesPerScope
        || updatedSet.count >= this.#maxEntries
      ) {
        const updatedMetadata = this.#replaceMetadataIfChanged(
          metadata,
          normalized.nowMs,
          updatedSet,
        );
        this.#assertReplaySetCount(updatedMetadata);
        return "capacity";
      }

      const row = createReplayRow(this.#key, {
        replayKeyHmac: normalized.replayKeyHmac,
        scopeHmac: normalized.scopeHmac,
        consumedAtMs: normalized.nowMs,
        expiresAtMs: normalized.expiresAtMs,
      });
      const result = this.#db.prepare(`
        INSERT INTO local_client_pop_replay_entries (
          record_version, replay_key_hmac, scope_hmac, consumed_at_ms,
          expires_at_ms, row_hmac
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        row.record_version,
        row.replay_key_hmac,
        row.scope_hmac,
        row.consumed_at_ms,
        row.expires_at_ms,
        row.row_hmac,
      );
      if (Number(result.changes) !== 1) throw integrityError();
      const persisted = this.#selectReplayRow(row.replay_key_hmac);
      if (!persisted || !sameReplayRow(this.#decodeRow(persisted), row)) throw integrityError();
      updatedSet = toggleReplaySetMember(this.#key, updatedSet, row, 1);
      const updatedMetadata = this.#replaceMetadataIfChanged(
        metadata,
        normalized.nowMs,
        updatedSet,
      );
      this.#assertReplaySetCount(updatedMetadata);
      return "consumed";
    });
  };

  readonly close = (): void => {
    if (this.#closed) return;
    this.#closed = true;
    this.#available = false;
    try {
      this.#db.close();
    } finally {
      this.#key.fill(0);
    }
  };

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      const userVersion = readPragmaInteger(this.#db, "user_version");
      if (userVersion !== 0 && userVersion !== LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION) {
        throw schemaError();
      }
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_pop_replay_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          key_binding_hmac TEXT NOT NULL,
          host_binding_hmac TEXT NOT NULL,
          namespace_binding_hmac TEXT NOT NULL,
          config_fingerprint TEXT NOT NULL,
          max_entries INTEGER NOT NULL CHECK (max_entries > 0),
          max_entries_per_scope INTEGER NOT NULL
            CHECK (max_entries_per_scope > 0 AND max_entries_per_scope <= max_entries),
          busy_timeout_ms INTEGER NOT NULL CHECK (busy_timeout_ms > 0),
           last_clock_ms INTEGER NOT NULL CHECK (last_clock_ms >= 0),
           entry_count INTEGER NOT NULL CHECK (entry_count >= 0 AND entry_count <= max_entries),
           entry_accumulator_hmac TEXT NOT NULL,
           metadata_hmac TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_pop_replay_entries (
          record_version INTEGER NOT NULL,
          replay_key_hmac TEXT PRIMARY KEY,
          scope_hmac TEXT NOT NULL,
          consumed_at_ms INTEGER NOT NULL CHECK (consumed_at_ms >= 0),
          expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > consumed_at_ms),
          row_hmac TEXT NOT NULL
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_pop_replay_expiry_idx
          ON local_client_pop_replay_entries (expires_at_ms);
        CREATE INDEX IF NOT EXISTS local_client_pop_replay_scope_idx
          ON local_client_pop_replay_entries (scope_hmac);
      `);
      this.#assertNoTargetTriggers();
      const metadata = this.#readMetadata();
      if (userVersion === 0) {
        if (metadata || this.#countRows() !== 0) throw schemaError();
        const emptySet = emptyReplaySet(this.#key);
        const initial = createMetadataRow(this.#key, {
          keyBindingHmac: this.#keyBindingHmac,
          hostBindingHmac: this.#hostBindingHmac,
          namespaceBindingHmac: this.#namespaceBindingHmac,
          configFingerprint: this.#configFingerprint,
          maxEntries: this.#maxEntries,
          maxEntriesPerScope: this.#maxEntriesPerScope,
          busyTimeoutMs: this.#busyTimeoutMs,
          lastClockMs: 0,
          entryCount: emptySet.count,
          entryAccumulatorHmac: emptySet.accumulatorHmac,
        });
        const inserted = this.#db.prepare(`
          INSERT INTO local_client_pop_replay_metadata (
            singleton, schema_version, key_binding_hmac, host_binding_hmac,
            namespace_binding_hmac, config_fingerprint, max_entries,
            max_entries_per_scope, busy_timeout_ms, last_clock_ms,
            entry_count, entry_accumulator_hmac, metadata_hmac
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.key_binding_hmac,
          initial.host_binding_hmac,
          initial.namespace_binding_hmac,
          initial.config_fingerprint,
          initial.max_entries,
          initial.max_entries_per_scope,
          initial.busy_timeout_ms,
          initial.last_clock_ms,
          initial.entry_count,
          initial.entry_accumulator_hmac,
          initial.metadata_hmac,
        );
        if (Number(inserted.changes) !== 1) throw schemaError();
        this.#db.exec(`PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION}`);
      } else {
        if (!metadata) throw schemaError();
        this.#assertMetadata(metadata);
      }
    });
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, key_binding_hmac, host_binding_hmac,
             namespace_binding_hmac, config_fingerprint, max_entries,
             max_entries_per_scope, busy_timeout_ms, last_clock_ms, entry_count,
             entry_accumulator_hmac, metadata_hmac
      FROM local_client_pop_replay_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION
      || !isDigest(row.key_binding_hmac)
      || !isDigest(row.host_binding_hmac)
      || !isDigest(row.namespace_binding_hmac)
      || !isDigest(row.config_fingerprint)
      || !isSafePositiveInteger(row.max_entries)
      || !isSafePositiveInteger(row.max_entries_per_scope)
      || row.max_entries_per_scope > row.max_entries
      || !isSafePositiveInteger(row.busy_timeout_ms)
      || !isSafeNonNegativeInteger(row.last_clock_ms)
      || row.last_clock_ms > MAX_DATE_MS
      || !isSafeNonNegativeInteger(row.entry_count)
      || row.entry_count > row.max_entries
      || !isDigest(row.entry_accumulator_hmac)
      || !isDigest(row.metadata_hmac)
    ) throw integrityError();
    if (!safeDigestEqual(row.key_binding_hmac, this.#keyBindingHmac)) throw keyMismatchError();

    const expectedHmac = createMetadataRow(this.#key, {
      keyBindingHmac: row.key_binding_hmac,
      hostBindingHmac: row.host_binding_hmac,
      namespaceBindingHmac: row.namespace_binding_hmac,
      configFingerprint: row.config_fingerprint,
      maxEntries: row.max_entries,
      maxEntriesPerScope: row.max_entries_per_scope,
      busyTimeoutMs: row.busy_timeout_ms,
      lastClockMs: row.last_clock_ms,
      entryCount: row.entry_count,
      entryAccumulatorHmac: row.entry_accumulator_hmac,
    }).metadata_hmac;
    if (!safeDigestEqual(row.metadata_hmac, expectedHmac)) throw integrityError();
    if (!safeDigestEqual(row.host_binding_hmac, this.#hostBindingHmac)) throw hostMismatchError();
    if (!safeDigestEqual(row.namespace_binding_hmac, this.#namespaceBindingHmac)) {
      throw namespaceMismatchError();
    }
    if (
      !safeDigestEqual(row.config_fingerprint, this.#configFingerprint)
      || row.max_entries !== this.#maxEntries
      || row.max_entries_per_scope !== this.#maxEntriesPerScope
      || row.busy_timeout_ms !== this.#busyTimeoutMs
    ) throw configMismatchError();
  }

  #selectReplayRow(replayKeyHmac: string): ReplayRow | undefined {
    return this.#db.prepare(`${selectReplayFields()} WHERE replay_key_hmac = ?`)
      .get(replayKeyHmac) as ReplayRow | undefined;
  }

  #decodeRow(row: ReplayRow): ReplayRow {
    if (
      row.record_version !== RECORD_VERSION
      || !isDigest(row.replay_key_hmac)
      || !isDigest(row.scope_hmac)
      || !isSafeNonNegativeInteger(row.consumed_at_ms)
      || row.consumed_at_ms > MAX_DATE_MS
      || !isSafePositiveInteger(row.expires_at_ms)
      || row.expires_at_ms > MAX_DATE_MS
      || row.expires_at_ms <= row.consumed_at_ms
      || !isDigest(row.row_hmac)
    ) throw integrityError();
    const expected = createReplayRow(this.#key, {
      replayKeyHmac: row.replay_key_hmac,
      scopeHmac: row.scope_hmac,
      consumedAtMs: row.consumed_at_ms,
      expiresAtMs: row.expires_at_ms,
    }).row_hmac;
    if (!safeDigestEqual(row.row_hmac, expected)) throw integrityError();
    return row;
  }

  #scanRows(selectedScopeHmac?: string): ReplaySetSnapshot {
    let snapshot = emptyReplaySet(this.#key, selectedScopeHmac);
    const rows = this.#db.prepare(`${selectReplayFields()} LIMIT ?`)
      .iterate(this.#maxEntries + 1) as Iterable<ReplayRow>;
    for (const raw of rows) {
      if (snapshot.count >= this.#maxEntries) throw integrityError();
      const row = this.#decodeRow(raw);
      snapshot = toggleReplaySetMember(this.#key, snapshot, row, 1);
    }
    return snapshot;
  }

  #assertReplaySet(metadata: MetadataRow, snapshot: ReplaySetSnapshot): void {
    if (
      metadata.entry_count !== snapshot.count
      || !safeDigestEqual(metadata.entry_accumulator_hmac, snapshot.accumulatorHmac)
    ) throw integrityError();
  }

  #assertReplaySetCount(metadata: MetadataRow): void {
    if (this.#countRows() !== metadata.entry_count) throw integrityError();
  }

  #purgeExpired(nowMs: number, snapshot: ReplaySetSnapshot): ReplaySetSnapshot {
    const rows = this.#db.prepare(`${selectReplayFields()} WHERE expires_at_ms <= ?`)
      .iterate(nowMs) as Iterable<ReplayRow>;
    let updated = snapshot;
    let expiredCount = 0;
    for (const raw of rows) {
      const row = this.#decodeRow(raw);
      updated = toggleReplaySetMember(this.#key, updated, row, -1);
      expiredCount += 1;
    }
    if (expiredCount === 0) return updated;
    const deleted = this.#db.prepare(
      "DELETE FROM local_client_pop_replay_entries WHERE expires_at_ms <= ?",
    ).run(nowMs);
    if (Number(deleted.changes) !== expiredCount) throw integrityError();
    return updated;
  }

  #countRows(): number {
    const row = this.#db.prepare(
      "SELECT COUNT(*) AS count FROM local_client_pop_replay_entries",
    ).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > MAX_ENTRIES) throw integrityError();
    return count;
  }

  #replaceMetadataIfChanged(
    previous: MetadataRow,
    nowMs: number,
    replaySet: ReplaySetSnapshot,
  ): MetadataRow {
    if (
      previous.last_clock_ms === nowMs
      && previous.entry_count === replaySet.count
      && safeDigestEqual(previous.entry_accumulator_hmac, replaySet.accumulatorHmac)
    ) return previous;
    const updated = createMetadataRow(this.#key, {
      keyBindingHmac: previous.key_binding_hmac,
      hostBindingHmac: previous.host_binding_hmac,
      namespaceBindingHmac: previous.namespace_binding_hmac,
      configFingerprint: previous.config_fingerprint,
      maxEntries: previous.max_entries,
      maxEntriesPerScope: previous.max_entries_per_scope,
      busyTimeoutMs: previous.busy_timeout_ms,
      lastClockMs: nowMs,
      entryCount: replaySet.count,
      entryAccumulatorHmac: replaySet.accumulatorHmac,
    });
    const result = this.#db.prepare(`
      UPDATE local_client_pop_replay_metadata
      SET last_clock_ms = ?, entry_count = ?, entry_accumulator_hmac = ?, metadata_hmac = ?
      WHERE singleton = ? AND metadata_hmac = ?
    `).run(
      updated.last_clock_ms,
      updated.entry_count,
      updated.entry_accumulator_hmac,
      updated.metadata_hmac,
      METADATA_SINGLETON,
      previous.metadata_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
    return updated;
  }

  #assertConnectionHardening(): void {
    const journal = this.#db.prepare("PRAGMA journal_mode").get() as
      | { journal_mode?: unknown }
      | undefined;
    const synchronous = this.#db.prepare("PRAGMA synchronous").get() as
      | { synchronous?: unknown }
      | undefined;
    const trustedSchema = this.#db.prepare("PRAGMA trusted_schema").get() as
      | { trusted_schema?: unknown }
      | undefined;
    const foreignKeys = this.#db.prepare("PRAGMA foreign_keys").get() as
      | { foreign_keys?: unknown }
      | undefined;
    if (
      String(journal?.journal_mode ?? "").toLowerCase() !== "wal"
      || Number(synchronous?.synchronous) !== 2
      || Number(trustedSchema?.trusted_schema) !== 0
      || Number(foreignKeys?.foreign_keys) !== 1
    ) throw schemaError();
  }

  #assertNoTargetTriggers(): void {
    const row = this.#db.prepare(`
      SELECT COUNT(*) AS count
      FROM sqlite_schema
      WHERE type = 'trigger'
        AND tbl_name IN ('local_client_pop_replay_metadata', 'local_client_pop_replay_entries')
    `).get() as { count?: unknown } | undefined;
    if (Number(row?.count) !== 0) throw schemaError();
  }

  #assertDatabaseHealthy(): void {
    const rows = this.#db.prepare("PRAGMA quick_check").all() as Array<Record<string, unknown>>;
    if (rows.length !== 1 || String(rows[0]?.quick_check ?? "").toLowerCase() !== "ok") {
      throw integrityError();
    }
    const metadata = this.#readMetadata();
    if (!metadata) throw schemaError();
    this.#assertMetadata(metadata);
    this.#assertNoTargetTriggers();
    this.#assertReplaySet(metadata, this.#scanRows());
  }

  #transaction<T>(operation: () => T): T {
    this.#assertOpen();
    try {
      const result = this.#rawTransaction(() => {
        this.#assertNoTargetTriggers();
        return operation();
      });
      this.#available = true;
      return result;
    } catch (error) {
      this.#available = false;
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

export function createLocalClientSqlitePopReplayGuard(
  options: LocalClientSqlitePopReplayGuardOptions,
): LocalClientSqlitePopReplayGuard {
  return new LocalClientSqlitePopReplayGuard(options);
}

function ownedSourceKey(options: unknown): Buffer | null {
  if (!isPlainRecord(options)) return null;
  const descriptor = Object.getOwnPropertyDescriptor(options, "integrityKey");
  return descriptor && Object.hasOwn(descriptor, "value") && Buffer.isBuffer(descriptor.value)
    ? descriptor.value
    : null;
}

function assertOptions(options: LocalClientSqlitePopReplayGuardOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  const allowed = [
    "sqlitePath",
    "hostId",
    "integrityKey",
    "namespace",
    "maxEntries",
    "maxEntriesPerScope",
    "busyTimeoutMs",
  ];
  if (
    Reflect.ownKeys(options).some((key) => typeof key !== "string" || !allowed.includes(key))
    || !Object.hasOwn(options, "sqlitePath")
    || !Object.hasOwn(options, "hostId")
    || !Object.hasOwn(options, "integrityKey")
    || !Buffer.isBuffer(options.integrityKey)
    || options.integrityKey.length < MIN_KEY_BYTES
    || options.integrityKey.length > MAX_KEY_BYTES
  ) throw configurationError();
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

function resolveMaxEntriesPerScope(value: number | undefined, maxEntries: number): number {
  const fallback = Math.min(
    DEFAULT_MAX_ENTRIES_PER_SCOPE,
    maxEntries === 1 ? 1 : maxEntries - 1,
  );
  const resolved = boundedInteger(value, fallback, 1, maxEntries);
  if (maxEntries > 1 && resolved >= maxEntries) throw configurationError();
  return resolved;
}

function normalizeConsumeInput(
  key: Buffer,
  input: ManagedLocalClientPopReplayConsumeInput,
): NormalizedConsumeInput {
  if (!isPlainRecord(input)) throw inputError();
  const requiredKeys = ["replayKeySha256", "expiresAtMs", "nowMs"];
  const allowedKeys = [...requiredKeys, "replayScopeSha256"];
  if (
    Reflect.ownKeys(input).some((candidate) => (
      typeof candidate !== "string" || !allowedKeys.includes(candidate)
    ))
    || requiredKeys.some((candidate) => !Object.hasOwn(input, candidate))
    || !isDigest(input.replayKeySha256)
    || (Object.hasOwn(input, "replayScopeSha256") && !isDigest(input.replayScopeSha256))
    || !isSafeNonNegativeInteger(input.nowMs)
    || input.nowMs > MAX_DATE_MS
    || !isSafePositiveInteger(input.expiresAtMs)
    || input.expiresAtMs > MAX_DATE_MS
    || input.expiresAtMs <= input.nowMs
  ) throw inputError();
  return Object.freeze({
    replayKeyHmac: keyedDigest(key, "replay-key", input.replayKeySha256),
    scopeHmac: keyedDigest(
      key,
      "replay-scope",
      input.replayScopeSha256 ?? LEGACY_REPLAY_SCOPE,
    ),
    nowMs: input.nowMs,
    expiresAtMs: input.expiresAtMs,
  });
}

function createMetadataRow(
  key: Buffer,
  input: Readonly<{
    keyBindingHmac: string;
    hostBindingHmac: string;
    namespaceBindingHmac: string;
    configFingerprint: string;
    maxEntries: number;
    maxEntriesPerScope: number;
    busyTimeoutMs: number;
    lastClockMs: number;
    entryCount: number;
    entryAccumulatorHmac: string;
  }>,
): MetadataRow {
  const unsigned = {
    schemaVersion: LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION,
    keyBindingHmac: input.keyBindingHmac,
    hostBindingHmac: input.hostBindingHmac,
    namespaceBindingHmac: input.namespaceBindingHmac,
    configFingerprint: input.configFingerprint,
    maxEntries: input.maxEntries,
    maxEntriesPerScope: input.maxEntriesPerScope,
    busyTimeoutMs: input.busyTimeoutMs,
    lastClockMs: input.lastClockMs,
    entryCount: input.entryCount,
    entryAccumulatorHmac: input.entryAccumulatorHmac,
  };
  return {
    schema_version: LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION,
    key_binding_hmac: input.keyBindingHmac,
    host_binding_hmac: input.hostBindingHmac,
    namespace_binding_hmac: input.namespaceBindingHmac,
    config_fingerprint: input.configFingerprint,
    max_entries: input.maxEntries,
    max_entries_per_scope: input.maxEntriesPerScope,
    busy_timeout_ms: input.busyTimeoutMs,
    last_clock_ms: input.lastClockMs,
    entry_count: input.entryCount,
    entry_accumulator_hmac: input.entryAccumulatorHmac,
    metadata_hmac: keyedDigest(key, "metadata-row", canonicalJson(unsigned)),
  };
}

function createReplayRow(
  key: Buffer,
  input: Readonly<{
    replayKeyHmac: string;
    scopeHmac: string;
    consumedAtMs: number;
    expiresAtMs: number;
  }>,
): ReplayRow {
  const unsigned = {
    recordVersion: RECORD_VERSION,
    replayKeyHmac: input.replayKeyHmac,
    scopeHmac: input.scopeHmac,
    consumedAtMs: input.consumedAtMs,
    expiresAtMs: input.expiresAtMs,
  };
  return {
    record_version: RECORD_VERSION,
    replay_key_hmac: input.replayKeyHmac,
    scope_hmac: input.scopeHmac,
    consumed_at_ms: input.consumedAtMs,
    expires_at_ms: input.expiresAtMs,
    row_hmac: keyedDigest(key, "replay-row", canonicalJson(unsigned)),
  };
}

function emptyReplaySet(key: Buffer, selectedScopeHmac?: string): ReplaySetSnapshot {
  return Object.freeze({
    count: 0,
    ...(selectedScopeHmac === undefined ? {} : { selectedScopeHmac }),
    selectedScopeCount: 0,
    accumulatorHmac: keyedDigest(
      key,
      "replay-set-empty",
      canonicalJson({ recordVersion: RECORD_VERSION }),
    ),
  });
}

function toggleReplaySetMember(
  key: Buffer,
  snapshot: ReplaySetSnapshot,
  row: ReplayRow,
  countDelta: 1 | -1,
): ReplaySetSnapshot {
  const nextCount = snapshot.count + countDelta;
  const selectedScopeDelta = snapshot.selectedScopeHmac !== undefined
    && safeDigestEqual(snapshot.selectedScopeHmac, row.scope_hmac)
    ? countDelta
    : 0;
  const nextSelectedScopeCount = snapshot.selectedScopeCount + selectedScopeDelta;
  if (!Number.isSafeInteger(nextCount) || nextCount < 0 || nextCount > MAX_ENTRIES) {
    throw integrityError();
  }
  if (
    !Number.isSafeInteger(nextSelectedScopeCount)
    || nextSelectedScopeCount < 0
    || nextSelectedScopeCount > MAX_ENTRIES
  ) throw integrityError();
  const accumulator = Buffer.from(snapshot.accumulatorHmac, "hex");
  const member = Buffer.from(keyedDigest(
    key,
    "replay-set-member",
    canonicalJson({
      recordVersion: row.record_version,
      replayKeyHmac: row.replay_key_hmac,
      scopeHmac: row.scope_hmac,
      consumedAtMs: row.consumed_at_ms,
      expiresAtMs: row.expires_at_ms,
      rowHmac: row.row_hmac,
    }),
  ), "hex");
  for (let index = 0; index < accumulator.length; index += 1) {
    accumulator[index] = accumulator[index]! ^ member[index]!;
  }
  member.fill(0);
  return Object.freeze({
    count: nextCount,
    ...(snapshot.selectedScopeHmac === undefined
      ? {}
      : { selectedScopeHmac: snapshot.selectedScopeHmac }),
    selectedScopeCount: nextSelectedScopeCount,
    accumulatorHmac: accumulator.toString("hex"),
  });
}

function sameReplayRow(left: ReplayRow, right: ReplayRow): boolean {
  return left.record_version === right.record_version
    && left.consumed_at_ms === right.consumed_at_ms
    && left.expires_at_ms === right.expires_at_ms
    && safeDigestEqual(left.replay_key_hmac, right.replay_key_hmac)
    && safeDigestEqual(left.scope_hmac, right.scope_hmac)
    && safeDigestEqual(left.row_hmac, right.row_hmac);
}

function selectReplayFields(): string {
  return `SELECT record_version, replay_key_hmac, scope_hmac,
                 consumed_at_ms, expires_at_ms, row_hmac
          FROM local_client_pop_replay_entries`;
}

function readPragmaInteger(db: DatabaseSync, name: "user_version"): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value) || value < 0) throw schemaError();
  return value;
}

function keyedDigest(key: Buffer, domain: string, value: string): string {
  return createHmac("sha256", key)
    .update(HMAC_DOMAIN, "utf8")
    .update("\u0000", "utf8")
    .update(domain, "utf8")
    .update("\u0000", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

function safeDigestEqual(left: string, right: string): boolean {
  if (!isDigest(left) || !isDigest(right)) return false;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => Object.hasOwn(descriptor, "value")
      && descriptor.get === undefined
      && descriptor.set === undefined,
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isKnownError(error: unknown): error is LocalClientSqlitePopReplayGuardError {
  return error instanceof LocalClientSqlitePopReplayGuardError;
}

function replayError(
  input: ConstructorParameters<typeof LocalClientSqlitePopReplayGuardError>[0],
): LocalClientSqlitePopReplayGuardError {
  return new LocalClientSqlitePopReplayGuardError(input);
}

function configurationError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_CONFIGURATION_INVALID",
    message: "The SQLite PoP replay guard configuration is invalid.",
    category: "configuration",
    statusCode: 500,
  });
}

function inputError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_INPUT_INVALID",
    message: "The PoP replay-consumption input is invalid.",
    category: "validation",
    statusCode: 400,
  });
}

function schemaError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_SCHEMA_INCOMPATIBLE",
    message: "The SQLite PoP replay schema or connection hardening is incompatible.",
    category: "persistence",
    statusCode: 500,
  });
}

function hostMismatchError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_HOST_MISMATCH",
    message: "The SQLite PoP replay guard belongs to another host.",
    category: "configuration",
    statusCode: 500,
  });
}

function namespaceMismatchError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_NAMESPACE_MISMATCH",
    message: "The SQLite PoP replay guard belongs to another namespace.",
    category: "configuration",
    statusCode: 500,
  });
}

function keyMismatchError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_KEY_MISMATCH",
    message: "The SQLite PoP replay guard is bound to another HMAC key.",
    category: "configuration",
    statusCode: 500,
  });
}

function configMismatchError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_CONFIG_MISMATCH",
    message: "The SQLite PoP replay guard configuration fingerprint changed.",
    category: "configuration",
    statusCode: 500,
  });
}

function closedError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_CLOSED",
    message: "The SQLite PoP replay guard is closed.",
    category: "persistence",
    statusCode: 503,
  });
}

function storeUnavailableError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_STORE_UNAVAILABLE",
    message: "The SQLite PoP replay guard is unavailable.",
    category: "persistence",
    statusCode: 503,
    retryable: true,
  });
}

function clockRollbackError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_CLOCK_ROLLBACK",
    message: "The PoP replay clock moved backwards.",
    category: "integrity",
    statusCode: 503,
  });
}

function integrityError(): LocalClientSqlitePopReplayGuardError {
  return replayError({
    code: "LOCAL_CLIENT_POP_REPLAY_INTEGRITY_INVALID",
    message: "The SQLite PoP replay guard failed a keyed integrity check.",
    category: "integrity",
    statusCode: 503,
  });
}
