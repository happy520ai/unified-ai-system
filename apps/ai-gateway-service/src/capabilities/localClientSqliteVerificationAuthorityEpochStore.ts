import { createHmac, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION = 1 as const;

export const LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_BOUNDARIES = Object.freeze({
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  authenticated: true as const,
  monotonicCheckpoint: true as const,
  rollbackResistant: false as const,
  clockDependent: false as const,
  integrityMode: "hmac-sha256" as const,
  rawHostIdPersisted: false as const,
  rawNamespacePersisted: false as const,
  rawIntegrityKeyPersisted: false as const,
  rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back" as const,
});

export interface LocalClientSqliteVerificationAuthorityEpochStoreOptions {
  readonly sqlitePath: string;
  /** Stable, host-unique identifier. Only a keyed binding is persisted. */
  readonly hostId: string;
  /** Dedicated random 32-64 byte HMAC key. The raw key is never persisted. */
  readonly integrityKey: Uint8Array;
  readonly namespace?: string;
  readonly maxCheckpoints?: number;
  readonly busyTimeoutMs?: number;
}

export type LocalClientVerificationAuthorityEpochErrorCode =
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_SCHEMA_INCOMPATIBLE"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_KEY_MISMATCH"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_HOST_MISMATCH"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_CONFIG_MISMATCH"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_CLOSED"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_UNAVAILABLE"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_INVALID"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_CAPACITY_REACHED"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_GENERATION_EXHAUSTED"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_EXPECTED_GENERATION_MISMATCH"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_RECOVERY_REQUIRED"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_GENERATION_MISMATCH"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_NO_PENDING_GENERATION"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_UNINITIALIZED"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_ROLLBACK_DETECTED"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_GENERATION_MISMATCH"
  | "LOCAL_CLIENT_AUTHORITY_EPOCH_REGISTRY_DIGEST_MISMATCH";

export type LocalClientVerificationAuthorityRecoveryState = Readonly<{
  required: true;
  reason: "pending-registry-checkpoint";
  currentGeneration: number;
  pendingGeneration: number;
  nextAction: "verify the signed registry; finalize pendingGeneration if present, or if it still matches currentRegistryDigest, regenerate and atomically replace pendingGeneration before finalizing";
}>;

export class LocalClientVerificationAuthorityEpochError extends Error {
  readonly code: LocalClientVerificationAuthorityEpochErrorCode;
  readonly category: "configuration" | "persistence" | "integrity" | "concurrency" | "recovery";
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly recovery: LocalClientVerificationAuthorityRecoveryState | null;

  constructor(input: Readonly<{
    code: LocalClientVerificationAuthorityEpochErrorCode;
    message: string;
    category: LocalClientVerificationAuthorityEpochError["category"];
    statusCode: number;
    retryable?: boolean;
    recovery?: LocalClientVerificationAuthorityRecoveryState | null;
  }>) {
    super(input.message);
    this.name = "LocalClientVerificationAuthorityEpochError";
    this.code = input.code;
    this.category = input.category;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    this.recovery = input.recovery ?? null;
  }
}

export type LocalClientVerificationAuthorityEpochState = Readonly<{
  initialized: boolean;
  ready: boolean;
  recoveryRequired: boolean;
  currentGeneration: number;
  currentRegistryDigest: string | null;
  pendingGeneration: number | null;
  checkpointCount: number;
}>;

export type LocalClientVerificationAuthorityEpochReservation = Readonly<{
  state: "pending";
  generation: number;
  previousGeneration: number;
  recoveryRequired: true;
}>;

export type LocalClientVerificationAuthorityCheckpoint = Readonly<{
  state: "finalized";
  generation: number;
  registryDigest: string;
}>;

type MetadataRow = {
  schema_version: number;
  key_binding_hmac: string;
  host_binding_hmac: string;
  config_binding_hmac: string;
  max_checkpoints: number;
  current_generation: number;
  current_registry_digest: string | null;
  pending_generation: number | null;
  metadata_hmac: string;
};

type EpochRow = {
  record_version: number;
  generation: number;
  previous_generation: number;
  state: "pending" | "finalized";
  registry_digest: string | null;
  row_hmac: string;
};

type CheckedState = Readonly<{
  metadata: MetadataRow;
  rows: readonly EpochRow[];
}>;

const METADATA_SINGLETON = 1;
const RECORD_VERSION = 1;
const DEFAULT_NAMESPACE = "local-client-verification-authority";
const DEFAULT_MAX_CHECKPOINTS = 32;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MIN_MAX_CHECKPOINTS = 2;
const HARD_MAX_CHECKPOINTS = 4_096;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const MAX_NAMESPACE_LENGTH = 128;
const MIN_KEY_BYTES = 32;
const MAX_KEY_BYTES = 64;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;

/**
 * A single-host monotonic checkpoint for the signed local-client registry.
 *
 * This detects a registry-only rollback. It cannot detect an attacker restoring
 * the registry and this checkpoint database to the same older snapshot; that
 * requires a separately protected monotonic anchor.
 */
export class LocalClientSqliteVerificationAuthorityEpochStore {
  readonly #db!: DatabaseSync;
  readonly #sqlitePath: string;
  readonly #integrityKey: Buffer;
  readonly #keyBindingHmac: string;
  readonly #hostBindingHmac: string;
  readonly #configBindingHmac: string;
  readonly #maxCheckpoints: number;
  readonly #busyTimeoutMs: number;
  #closed = false;

  constructor(options: LocalClientSqliteVerificationAuthorityEpochStoreOptions) {
    assertOptions(options);
    this.#sqlitePath = resolveSqlitePath(options.sqlitePath);
    this.#integrityKey = cloneIntegrityKey(options.integrityKey);
    const hostId = assertHostId(options.hostId);
    const namespace = assertNamespace(options.namespace ?? DEFAULT_NAMESPACE);
    this.#maxCheckpoints = boundedInteger(
      options.maxCheckpoints,
      DEFAULT_MAX_CHECKPOINTS,
      MIN_MAX_CHECKPOINTS,
      HARD_MAX_CHECKPOINTS,
    );
    this.#busyTimeoutMs = boundedInteger(
      options.busyTimeoutMs,
      DEFAULT_BUSY_TIMEOUT_MS,
      100,
      MAX_BUSY_TIMEOUT_MS,
    );
    this.#keyBindingHmac = keyedDigest(this.#integrityKey, "key-binding", {
      schema: LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION,
    });
    this.#hostBindingHmac = keyedDigest(this.#integrityKey, "host-binding", { hostId });
    this.#configBindingHmac = keyedDigest(this.#integrityKey, "config-binding", {
      schema: LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION,
      namespace,
      maxCheckpoints: this.#maxCheckpoints,
      busyTimeoutMs: this.#busyTimeoutMs,
    });

    mkdirSync(dirname(this.#sqlitePath), { recursive: true, mode: 0o700 });
    try { chmodSync(dirname(this.#sqlitePath), 0o700); } catch { /* Best effort on Windows. */ }
    try {
      this.#db = new DatabaseSync(this.#sqlitePath);
      this.#db.exec(`PRAGMA busy_timeout = ${this.#busyTimeoutMs}`);
      const journal = this.#db.prepare("PRAGMA journal_mode = WAL").get() as {
        journal_mode?: unknown;
      } | undefined;
      if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") throw schemaError();
      this.#db.exec("PRAGMA synchronous = FULL");
      const synchronous = this.#db.prepare("PRAGMA synchronous").get() as {
        synchronous?: unknown;
      } | undefined;
      if (Number(synchronous?.synchronous) !== 2) throw schemaError();
      this.#db.exec("PRAGMA trusted_schema = OFF");
      this.#db.exec("PRAGMA foreign_keys = ON");
      this.#initializeSchema();
      const defensiveDatabase = this.#db as DatabaseSync & {
        enableDefensive?: (enabled: boolean) => void;
      };
      if (typeof defensiveDatabase.enableDefensive !== "function") throw schemaError();
      defensiveDatabase.enableDefensive(true);
      this.#assertConnectionHardening();
      this.#assertDatabaseHealthy();
      try { chmodSync(this.#sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
    } catch (error) {
      try { this.#db?.close(); } catch { /* Preserve initialization error. */ }
      this.#integrityKey.fill(0);
      if (isKnownError(error)) throw error;
      throw storeUnavailableError();
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_BOUNDARIES,
      available: !this.#closed,
      schemaVersion: LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION,
      journalMode: "wal" as const,
      synchronous: "full" as const,
      trustedSchema: false as const,
      defensive: true as const,
      maxCheckpoints: this.#maxCheckpoints,
      busyTimeoutMs: this.#busyTimeoutMs,
    });
  }

  async reserveNextGeneration(
    expectedCurrent: number,
  ): Promise<LocalClientVerificationAuthorityEpochReservation> {
    const expected = normalizeGeneration(expectedCurrent, true);
    return this.#transaction(() => {
      const checked = this.#readAndAssertState();
      if (checked.metadata.pending_generation !== null) {
        throw pendingRecoveryError(toPublicState(checked));
      }
      if (expected !== checked.metadata.current_generation) {
        throw epochError({
          code: "LOCAL_CLIENT_AUTHORITY_EPOCH_EXPECTED_GENERATION_MISMATCH",
          message: "The expected verification-authority generation is stale.",
          category: "concurrency",
          statusCode: 409,
        });
      }
      if (expected >= Number.MAX_SAFE_INTEGER) throw generationExhaustedError();
      const nextGeneration = expected + 1;
      this.#pruneBeforeReservation(checked.rows, checked.metadata.current_generation);
      const row = createEpochRow(this.#integrityKey, {
        generation: nextGeneration,
        previousGeneration: expected,
        state: "pending",
        registryDigest: null,
      });
      const inserted = this.#db.prepare(`
        INSERT INTO local_client_verification_authority_epochs (
          record_version, generation, previous_generation, state,
          registry_digest, row_hmac
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        row.record_version,
        row.generation,
        row.previous_generation,
        row.state,
        row.registry_digest,
        row.row_hmac,
      );
      if (Number(inserted.changes) !== 1) throw integrityError();
      const updated = createMetadataRow(this.#integrityKey, {
        keyBindingHmac: checked.metadata.key_binding_hmac,
        hostBindingHmac: checked.metadata.host_binding_hmac,
        configBindingHmac: checked.metadata.config_binding_hmac,
        maxCheckpoints: checked.metadata.max_checkpoints,
        currentGeneration: expected,
        currentRegistryDigest: checked.metadata.current_registry_digest,
        pendingGeneration: nextGeneration,
      });
      this.#replaceMetadata(checked.metadata, updated);
      return Object.freeze({
        state: "pending" as const,
        generation: nextGeneration,
        previousGeneration: expected,
        recoveryRequired: true as const,
      });
    });
  }

  /** Finalizes a pending generation after the signed registry was durably replaced. */
  async finalize(
    generation: number,
    registryDigest: string,
  ): Promise<LocalClientVerificationAuthorityCheckpoint> {
    const normalizedGeneration = normalizeGeneration(generation, false);
    const normalizedDigest = normalizeRegistryDigest(registryDigest);
    return this.#transaction(() => {
      const checked = this.#readAndAssertState();
      if (checked.metadata.pending_generation === null) {
        if (checked.metadata.current_generation === normalizedGeneration) {
          if (!safeDigestEqual(checked.metadata.current_registry_digest, normalizedDigest)) {
            throw registryDigestMismatchError();
          }
          return toCheckpoint(normalizedGeneration, normalizedDigest);
        }
        throw epochError({
          code: "LOCAL_CLIENT_AUTHORITY_EPOCH_NO_PENDING_GENERATION",
          message: "No pending verification-authority generation can be finalized.",
          category: "recovery",
          statusCode: 409,
        });
      }
      if (checked.metadata.pending_generation !== normalizedGeneration) {
        throw epochError({
          code: "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_GENERATION_MISMATCH",
          message: "The requested generation is not the pending verification-authority generation.",
          category: "recovery",
          statusCode: 409,
          recovery: createRecoveryState(checked.metadata),
        });
      }
      const pending = checked.rows.find((row) => row.generation === normalizedGeneration);
      if (!pending || pending.state !== "pending" || pending.registry_digest !== null) {
        throw integrityError();
      }
      const finalized = createEpochRow(this.#integrityKey, {
        generation: pending.generation,
        previousGeneration: pending.previous_generation,
        state: "finalized",
        registryDigest: normalizedDigest,
      });
      const rowUpdate = this.#db.prepare(`
        UPDATE local_client_verification_authority_epochs
        SET state = 'finalized', registry_digest = ?, row_hmac = ?
        WHERE generation = ? AND state = 'pending'
          AND registry_digest IS NULL AND row_hmac = ?
      `).run(
        finalized.registry_digest,
        finalized.row_hmac,
        pending.generation,
        pending.row_hmac,
      );
      if (Number(rowUpdate.changes) !== 1) throw integrityError();
      const updated = createMetadataRow(this.#integrityKey, {
        keyBindingHmac: checked.metadata.key_binding_hmac,
        hostBindingHmac: checked.metadata.host_binding_hmac,
        configBindingHmac: checked.metadata.config_binding_hmac,
        maxCheckpoints: checked.metadata.max_checkpoints,
        currentGeneration: normalizedGeneration,
        currentRegistryDigest: normalizedDigest,
        pendingGeneration: null,
      });
      this.#replaceMetadata(checked.metadata, updated);
      return toCheckpoint(normalizedGeneration, normalizedDigest);
    });
  }

  /** Alias for callers that name the second phase "commit". */
  async commit(
    generation: number,
    registryDigest: string,
  ): Promise<LocalClientVerificationAuthorityCheckpoint> {
    return this.finalize(generation, registryDigest);
  }

  async assertCurrent(
    generation: number,
    registryDigest: string,
  ): Promise<LocalClientVerificationAuthorityCheckpoint> {
    return this.assertCurrentSync(generation, registryDigest);
  }

  /** Synchronous startup gate used before the application can report ready. */
  assertCurrentSync(
    generation: number,
    registryDigest: string,
  ): LocalClientVerificationAuthorityCheckpoint {
    const normalizedGeneration = normalizeGeneration(generation, false);
    const normalizedDigest = normalizeRegistryDigest(registryDigest);
    return this.#transaction(() => {
      const checked = this.#readAndAssertState();
      if (checked.metadata.pending_generation !== null) {
        throw pendingRecoveryError(toPublicState(checked));
      }
      if (
        checked.metadata.current_generation === 0
        || checked.metadata.current_registry_digest === null
      ) {
        throw epochError({
          code: "LOCAL_CLIENT_AUTHORITY_EPOCH_UNINITIALIZED",
          message: "No finalized verification-authority checkpoint exists.",
          category: "recovery",
          statusCode: 503,
        });
      }
      if (normalizedGeneration < checked.metadata.current_generation) {
        throw epochError({
          code: "LOCAL_CLIENT_AUTHORITY_EPOCH_ROLLBACK_DETECTED",
          message: "The signed local-client registry is older than the monotonic authority checkpoint.",
          category: "integrity",
          statusCode: 503,
        });
      }
      if (normalizedGeneration !== checked.metadata.current_generation) {
        throw epochError({
          code: "LOCAL_CLIENT_AUTHORITY_EPOCH_GENERATION_MISMATCH",
          message: "The signed local-client registry generation does not match the authority checkpoint.",
          category: "integrity",
          statusCode: 503,
        });
      }
      if (!safeDigestEqual(checked.metadata.current_registry_digest, normalizedDigest)) {
        throw registryDigestMismatchError();
      }
      return toCheckpoint(normalizedGeneration, normalizedDigest);
    });
  }

  async inspect(): Promise<LocalClientVerificationAuthorityEpochState> {
    return this.inspectSync();
  }

  /** Synchronous startup inspection; it never clears or rewinds pending state. */
  inspectSync(): LocalClientVerificationAuthorityEpochState {
    return this.#transaction(() => toPublicState(this.#readAndAssertState()));
  }

  /** Explicit current-generation read; pending recovery remains visible. */
  async readCurrent(): Promise<LocalClientVerificationAuthorityEpochState> {
    return this.inspectSync();
  }

  async checkHealth() {
    return this.#transaction(() => {
      this.#assertConnectionHardening();
      this.#assertQuickCheck();
      const state = toPublicState(this.#readAndAssertState());
      return Object.freeze({ ...this.status, ...state });
    });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#db.close();
    } finally {
      this.#integrityKey.fill(0);
    }
  }

  #initializeSchema(): void {
    this.#rawTransaction(() => {
      const userVersion = readPragmaInteger(this.#db, "user_version");
      if (
        userVersion !== 0
        && userVersion !== LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION
      ) {
        throw schemaError();
      }
      this.#db.exec(`
        CREATE TABLE IF NOT EXISTS local_client_verification_authority_epoch_metadata (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          key_binding_hmac TEXT NOT NULL,
          host_binding_hmac TEXT NOT NULL,
          config_binding_hmac TEXT NOT NULL,
          max_checkpoints INTEGER NOT NULL CHECK (max_checkpoints >= 2),
          current_generation INTEGER NOT NULL CHECK (current_generation >= 0),
          current_registry_digest TEXT,
          pending_generation INTEGER,
          metadata_hmac TEXT NOT NULL,
          CHECK (
            (current_generation = 0 AND current_registry_digest IS NULL)
            OR (current_generation > 0 AND current_registry_digest IS NOT NULL)
          ),
          CHECK (pending_generation IS NULL OR pending_generation = current_generation + 1)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS local_client_verification_authority_epochs (
          record_version INTEGER NOT NULL,
          generation INTEGER PRIMARY KEY CHECK (generation > 0),
          previous_generation INTEGER NOT NULL CHECK (previous_generation >= 0),
          state TEXT NOT NULL CHECK (state IN ('pending', 'finalized')),
          registry_digest TEXT,
          row_hmac TEXT NOT NULL,
          CHECK (generation = previous_generation + 1),
          CHECK (
            (state = 'pending' AND registry_digest IS NULL)
            OR (state = 'finalized' AND registry_digest IS NOT NULL)
          )
        ) STRICT;
        CREATE INDEX IF NOT EXISTS local_client_verification_authority_epoch_state_idx
          ON local_client_verification_authority_epochs (state, generation);
      `);
      const metadata = this.#readMetadata();
      const rowCount = this.#countRows();
      if (userVersion === 0) {
        if (metadata || rowCount !== 0) throw schemaError();
        const initial = createMetadataRow(this.#integrityKey, {
          keyBindingHmac: this.#keyBindingHmac,
          hostBindingHmac: this.#hostBindingHmac,
          configBindingHmac: this.#configBindingHmac,
          maxCheckpoints: this.#maxCheckpoints,
          currentGeneration: 0,
          currentRegistryDigest: null,
          pendingGeneration: null,
        });
        const inserted = this.#db.prepare(`
          INSERT INTO local_client_verification_authority_epoch_metadata (
            singleton, schema_version, key_binding_hmac, host_binding_hmac,
            config_binding_hmac, max_checkpoints, current_generation,
            current_registry_digest, pending_generation, metadata_hmac
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          METADATA_SINGLETON,
          initial.schema_version,
          initial.key_binding_hmac,
          initial.host_binding_hmac,
          initial.config_binding_hmac,
          initial.max_checkpoints,
          initial.current_generation,
          initial.current_registry_digest,
          initial.pending_generation,
          initial.metadata_hmac,
        );
        if (Number(inserted.changes) !== 1) throw integrityError();
        this.#db.exec(
          `PRAGMA user_version = ${LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION}`,
        );
      } else {
        if (!metadata) throw schemaError();
        this.#assertMetadata(metadata);
      }
    });
  }

  #readAndAssertState(): CheckedState {
    const metadata = this.#readMetadata();
    if (!metadata) throw schemaError();
    this.#assertMetadata(metadata);
    const rows = this.#readRows();
    if (rows.length > this.#maxCheckpoints) throw integrityError();
    for (const row of rows) this.#assertEpochRow(row);

    const sorted = [...rows].sort((left, right) => left.generation - right.generation);
    const finalized = sorted.filter((row) => row.state === "finalized");
    const pending = sorted.filter((row) => row.state === "pending");
    if (metadata.current_generation === 0) {
      if (metadata.current_registry_digest !== null || finalized.length !== 0) throw integrityError();
    } else {
      if (metadata.current_registry_digest === null || finalized.length === 0) throw integrityError();
      const current = finalized.at(-1);
      if (
        !current
        || current.generation !== metadata.current_generation
        || !safeDigestEqual(current.registry_digest, metadata.current_registry_digest)
      ) {
        throw integrityError();
      }
      if (finalized.some((row) => row.generation > metadata.current_generation)) throw integrityError();
    }
    if (metadata.pending_generation === null) {
      if (pending.length !== 0) throw integrityError();
    } else {
      if (pending.length !== 1) throw integrityError();
      const pendingRow = pending[0];
      if (
        !pendingRow
        || pendingRow.generation !== metadata.pending_generation
        || pendingRow.previous_generation !== metadata.current_generation
        || pendingRow.generation !== metadata.current_generation + 1
      ) {
        throw integrityError();
      }
    }
    if (sorted.some((row) => (
      row.state === "finalized" && row.generation > metadata.current_generation
    ))) throw integrityError();
    return Object.freeze({ metadata, rows: Object.freeze(sorted) });
  }

  #assertMetadata(row: MetadataRow): void {
    if (
      row.schema_version !== LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION
      || !SHA256_PATTERN.test(String(row.key_binding_hmac ?? ""))
      || !SHA256_PATTERN.test(String(row.host_binding_hmac ?? ""))
      || !SHA256_PATTERN.test(String(row.config_binding_hmac ?? ""))
      || !Number.isSafeInteger(row.max_checkpoints)
      || row.max_checkpoints < MIN_MAX_CHECKPOINTS
      || row.max_checkpoints > HARD_MAX_CHECKPOINTS
      || !isGeneration(row.current_generation, true)
      || !isNullableDigest(row.current_registry_digest)
      || (row.pending_generation !== null && !isGeneration(row.pending_generation, false))
      || !SHA256_PATTERN.test(String(row.metadata_hmac ?? ""))
    ) {
      throw integrityError();
    }
    if (!safeDigestEqual(row.key_binding_hmac, this.#keyBindingHmac)) {
      throw epochError({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_KEY_MISMATCH",
        message: "The verification-authority checkpoint uses another integrity key.",
        category: "configuration",
        statusCode: 500,
      });
    }
    const expected = createMetadataRow(this.#integrityKey, {
      keyBindingHmac: row.key_binding_hmac,
      hostBindingHmac: row.host_binding_hmac,
      configBindingHmac: row.config_binding_hmac,
      maxCheckpoints: row.max_checkpoints,
      currentGeneration: row.current_generation,
      currentRegistryDigest: row.current_registry_digest,
      pendingGeneration: row.pending_generation,
    }).metadata_hmac;
    if (!safeDigestEqual(row.metadata_hmac, expected)) throw integrityError();
    if (!safeDigestEqual(row.host_binding_hmac, this.#hostBindingHmac)) {
      throw epochError({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_HOST_MISMATCH",
        message: "The verification-authority checkpoint belongs to another host.",
        category: "configuration",
        statusCode: 500,
      });
    }
    if (
      !safeDigestEqual(row.config_binding_hmac, this.#configBindingHmac)
      || row.max_checkpoints !== this.#maxCheckpoints
    ) {
      throw epochError({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_CONFIG_MISMATCH",
        message: "The verification-authority checkpoint configuration changed.",
        category: "configuration",
        statusCode: 500,
      });
    }
  }

  #assertEpochRow(row: EpochRow): void {
    if (
      row.record_version !== RECORD_VERSION
      || !isGeneration(row.generation, false)
      || !isGeneration(row.previous_generation, true)
      || row.generation !== row.previous_generation + 1
      || (row.state !== "pending" && row.state !== "finalized")
      || !isNullableDigest(row.registry_digest)
      || (row.state === "pending" && row.registry_digest !== null)
      || (row.state === "finalized" && row.registry_digest === null)
      || !SHA256_PATTERN.test(String(row.row_hmac ?? ""))
    ) {
      throw integrityError();
    }
    const expected = createEpochRow(this.#integrityKey, {
      generation: row.generation,
      previousGeneration: row.previous_generation,
      state: row.state,
      registryDigest: row.registry_digest,
    }).row_hmac;
    if (!safeDigestEqual(row.row_hmac, expected)) throw integrityError();
  }

  #pruneBeforeReservation(rows: readonly EpochRow[], currentGeneration: number): void {
    let remaining = rows.length;
    const removable = rows
      .filter((row) => row.state === "finalized" && row.generation !== currentGeneration)
      .sort((left, right) => left.generation - right.generation);
    for (const row of removable) {
      if (remaining < this.#maxCheckpoints) break;
      const deleted = this.#db.prepare(`
        DELETE FROM local_client_verification_authority_epochs
        WHERE generation = ? AND state = 'finalized' AND row_hmac = ?
      `).run(row.generation, row.row_hmac);
      if (Number(deleted.changes) !== 1) throw integrityError();
      remaining -= 1;
    }
    if (remaining >= this.#maxCheckpoints) {
      throw epochError({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_CAPACITY_REACHED",
        message: "The bounded verification-authority checkpoint store is full.",
        category: "persistence",
        statusCode: 503,
        retryable: false,
      });
    }
  }

  #replaceMetadata(previous: MetadataRow, updated: MetadataRow): void {
    const result = this.#db.prepare(`
      UPDATE local_client_verification_authority_epoch_metadata
      SET current_generation = ?, current_registry_digest = ?,
          pending_generation = ?, metadata_hmac = ?
      WHERE singleton = ? AND metadata_hmac = ?
    `).run(
      updated.current_generation,
      updated.current_registry_digest,
      updated.pending_generation,
      updated.metadata_hmac,
      METADATA_SINGLETON,
      previous.metadata_hmac,
    );
    if (Number(result.changes) !== 1) throw integrityError();
  }

  #readMetadata(): MetadataRow | undefined {
    return this.#db.prepare(`
      SELECT schema_version, key_binding_hmac, host_binding_hmac,
             config_binding_hmac, max_checkpoints, current_generation,
             current_registry_digest, pending_generation, metadata_hmac
      FROM local_client_verification_authority_epoch_metadata
      WHERE singleton = 1
    `).get() as MetadataRow | undefined;
  }

  #readRows(): EpochRow[] {
    return this.#db.prepare(`
      SELECT record_version, generation, previous_generation, state,
             registry_digest, row_hmac
      FROM local_client_verification_authority_epochs
    `).all() as EpochRow[];
  }

  #countRows(): number {
    const row = this.#db.prepare(`
      SELECT COUNT(*) AS count FROM local_client_verification_authority_epochs
    `).get() as { count?: unknown } | undefined;
    const count = Number(row?.count);
    if (!Number.isSafeInteger(count) || count < 0 || count > HARD_MAX_CHECKPOINTS) {
      throw integrityError();
    }
    return count;
  }

  #assertConnectionHardening(): void {
    const trustedSchema = this.#db.prepare("PRAGMA trusted_schema").get() as {
      trusted_schema?: unknown;
    } | undefined;
    if (Number(trustedSchema?.trusted_schema) !== 0) throw schemaError();
  }

  #assertQuickCheck(): void {
    const rows = this.#db.prepare("PRAGMA quick_check").all() as Array<Record<string, unknown>>;
    if (rows.length !== 1 || String(rows[0]?.quick_check ?? "").toLowerCase() !== "ok") {
      throw integrityError();
    }
  }

  #assertDatabaseHealthy(): void {
    this.#assertQuickCheck();
    this.#readAndAssertState();
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
    if (this.#closed) {
      throw epochError({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_CLOSED",
        message: "The verification-authority checkpoint store is closed.",
        category: "persistence",
        statusCode: 503,
      });
    }
  }
}

export function createLocalClientSqliteVerificationAuthorityEpochStore(
  options: LocalClientSqliteVerificationAuthorityEpochStoreOptions,
): LocalClientSqliteVerificationAuthorityEpochStore {
  return new LocalClientSqliteVerificationAuthorityEpochStore(options);
}

function createMetadataRow(
  integrityKey: Buffer,
  input: Readonly<{
    keyBindingHmac: string;
    hostBindingHmac: string;
    configBindingHmac: string;
    maxCheckpoints: number;
    currentGeneration: number;
    currentRegistryDigest: string | null;
    pendingGeneration: number | null;
  }>,
): MetadataRow {
  const unsigned = {
    schemaVersion: LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION,
    keyBindingHmac: input.keyBindingHmac,
    hostBindingHmac: input.hostBindingHmac,
    configBindingHmac: input.configBindingHmac,
    maxCheckpoints: input.maxCheckpoints,
    currentGeneration: input.currentGeneration,
    currentRegistryDigest: input.currentRegistryDigest,
    pendingGeneration: input.pendingGeneration,
  };
  return {
    schema_version: LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_SCHEMA_VERSION,
    key_binding_hmac: input.keyBindingHmac,
    host_binding_hmac: input.hostBindingHmac,
    config_binding_hmac: input.configBindingHmac,
    max_checkpoints: input.maxCheckpoints,
    current_generation: input.currentGeneration,
    current_registry_digest: input.currentRegistryDigest,
    pending_generation: input.pendingGeneration,
    metadata_hmac: keyedDigest(integrityKey, "metadata", unsigned),
  };
}

function createEpochRow(
  integrityKey: Buffer,
  input: Readonly<{
    generation: number;
    previousGeneration: number;
    state: "pending" | "finalized";
    registryDigest: string | null;
  }>,
): EpochRow {
  const unsigned = {
    recordVersion: RECORD_VERSION,
    generation: input.generation,
    previousGeneration: input.previousGeneration,
    state: input.state,
    registryDigest: input.registryDigest,
  };
  return {
    record_version: RECORD_VERSION,
    generation: input.generation,
    previous_generation: input.previousGeneration,
    state: input.state,
    registry_digest: input.registryDigest,
    row_hmac: keyedDigest(integrityKey, "epoch-row", unsigned),
  };
}

function toPublicState(checked: CheckedState): LocalClientVerificationAuthorityEpochState {
  const pendingGeneration = checked.metadata.pending_generation;
  const initialized = checked.metadata.current_registry_digest !== null;
  return Object.freeze({
    initialized,
    ready: initialized && pendingGeneration === null,
    recoveryRequired: pendingGeneration !== null,
    currentGeneration: checked.metadata.current_generation,
    currentRegistryDigest: checked.metadata.current_registry_digest,
    pendingGeneration,
    checkpointCount: checked.rows.length,
  });
}

function toCheckpoint(
  generation: number,
  registryDigest: string,
): LocalClientVerificationAuthorityCheckpoint {
  return Object.freeze({ state: "finalized" as const, generation, registryDigest });
}

function createRecoveryState(
  metadata: MetadataRow,
): LocalClientVerificationAuthorityRecoveryState | null {
  if (metadata.pending_generation === null) return null;
  return Object.freeze({
    required: true as const,
    reason: "pending-registry-checkpoint" as const,
    currentGeneration: metadata.current_generation,
    pendingGeneration: metadata.pending_generation,
    nextAction: "verify the signed registry; finalize pendingGeneration if present, or if it still matches currentRegistryDigest, regenerate and atomically replace pendingGeneration before finalizing" as const,
  });
}

function pendingRecoveryError(
  state: LocalClientVerificationAuthorityEpochState,
): LocalClientVerificationAuthorityEpochError {
  if (state.pendingGeneration === null) throw integrityError();
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_RECOVERY_REQUIRED",
    message: "A reserved verification-authority generation is pending; verify the signed registry and finalize it before startup can continue.",
    category: "recovery",
    statusCode: 503,
    recovery: Object.freeze({
      required: true as const,
      reason: "pending-registry-checkpoint" as const,
      currentGeneration: state.currentGeneration,
      pendingGeneration: state.pendingGeneration,
      nextAction: "verify the signed registry; finalize pendingGeneration if present, or if it still matches currentRegistryDigest, regenerate and atomically replace pendingGeneration before finalizing" as const,
    }),
  });
}

function assertOptions(options: LocalClientSqliteVerificationAuthorityEpochStoreOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  const allowed = [
    "sqlitePath",
    "hostId",
    "integrityKey",
    "namespace",
    "maxCheckpoints",
    "busyTimeoutMs",
  ];
  if (
    Reflect.ownKeys(options).some((key) => typeof key !== "string" || !allowed.includes(key))
    || !Object.hasOwn(options, "sqlitePath")
    || !Object.hasOwn(options, "hostId")
    || !Object.hasOwn(options, "integrityKey")
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

function cloneIntegrityKey(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < MIN_KEY_BYTES || value.byteLength > MAX_KEY_BYTES) {
    throw configurationError();
  }
  return Buffer.from(value);
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw configurationError();
  }
  return normalized;
}

function normalizeGeneration(value: unknown, allowZero: boolean): number {
  if (!isGeneration(value, allowZero)) throw configurationError();
  return value;
}

function isGeneration(value: unknown, allowZero: boolean): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && (allowZero ? value >= 0 : value > 0);
}

function normalizeRegistryDigest(value: unknown): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw configurationError();
  return value;
}

function isNullableDigest(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && SHA256_PATTERN.test(value));
}

function readPragmaInteger(db: DatabaseSync, name: "user_version"): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value) || value < 0) throw schemaError();
  return value;
}

function keyedDigest(key: Buffer, domain: string, value: unknown): string {
  return createHmac("sha256", key)
    .update("local-client-verification-authority-epoch-v1\u0000", "utf8")
    .update(domain, "utf8")
    .update("\u0000", "utf8")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isKnownError(error: unknown): error is LocalClientVerificationAuthorityEpochError {
  return error instanceof LocalClientVerificationAuthorityEpochError;
}

function epochError(input: ConstructorParameters<typeof LocalClientVerificationAuthorityEpochError>[0]) {
  return new LocalClientVerificationAuthorityEpochError(input);
}

function configurationError(): LocalClientVerificationAuthorityEpochError {
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_CONFIGURATION_INVALID",
    message: "The verification-authority checkpoint configuration or input is invalid.",
    category: "configuration",
    statusCode: 500,
  });
}

function schemaError(): LocalClientVerificationAuthorityEpochError {
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_SCHEMA_INCOMPATIBLE",
    message: "The verification-authority checkpoint schema or SQLite hardening is incompatible.",
    category: "persistence",
    statusCode: 500,
  });
}

function storeUnavailableError(): LocalClientVerificationAuthorityEpochError {
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_UNAVAILABLE",
    message: "The verification-authority checkpoint store is unavailable.",
    category: "persistence",
    statusCode: 503,
    retryable: true,
  });
}

function integrityError(): LocalClientVerificationAuthorityEpochError {
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_INVALID",
    message: "The verification-authority checkpoint failed a keyed integrity check.",
    category: "integrity",
    statusCode: 503,
  });
}

function generationExhaustedError(): LocalClientVerificationAuthorityEpochError {
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_GENERATION_EXHAUSTED",
    message: "The verification-authority generation cannot be incremented safely.",
    category: "integrity",
    statusCode: 503,
  });
}

function registryDigestMismatchError(): LocalClientVerificationAuthorityEpochError {
  return epochError({
    code: "LOCAL_CLIENT_AUTHORITY_EPOCH_REGISTRY_DIGEST_MISMATCH",
    message: "The signed local-client registry digest does not match the authority checkpoint.",
    category: "integrity",
    statusCode: 503,
  });
}
