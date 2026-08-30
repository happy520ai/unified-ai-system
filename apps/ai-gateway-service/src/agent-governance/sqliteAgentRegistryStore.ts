import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  AgentClassification,
  AgentFamily,
  AgentRegistryRecord,
  AgentStatus,
  AgentTrait,
  RiskLevel,
} from "@unified-ai-system/shared-contracts";
import type { AgentRegistryStore } from "./agentRegistryStore.ts";
import {
  SQLITE_AGENT_REGISTRY_MIGRATIONS,
  SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
  type SqliteAgentRegistryMigration,
} from "./sqliteAgentRegistryMigrations.ts";

export const SQLITE_AGENT_REGISTRY_BOUNDARIES = Object.freeze({
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  transactional: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  journalMode: "wal" as const,
  synchronous: "full" as const,
  foreignKeys: true as const,
  rollbackProtected: false as const,
  cryptographicallyTamperEvident: false as const,
});

export interface SqliteAgentRegistryStoreOptions {
  sqlitePath: string;
  /** Stable identity for the one host allowed to reopen this SQLite file. */
  hostId: string;
  busyTimeoutMs?: number;
  maxRecordBytes?: number;
  now?: () => string;
}

export type SqliteAgentRegistryHealth = Readonly<{
  status: "ready" | "degraded" | "closed";
  available: boolean;
  loaded: boolean;
  schemaVersion: number;
  migrationCount: number;
  recordCount: number | null;
  busyTimeoutMs: number;
  pathExposed: false;
  lastErrorCode: string | null;
} & typeof SQLITE_AGENT_REGISTRY_BOUNDARIES>;

export interface SqliteAgentRegistryStore extends AgentRegistryStore {
  getAuthorityBinding(): string;
  close(): Promise<void>;
  getHealth(): SqliteAgentRegistryHealth;
}

type MigrationRow = {
  version: number;
  name: string;
  checksum: string;
};

type MetadataRow = {
  schema_version: number;
  host_binding_sha256: string;
  created_at: string;
  updated_at: string;
  metadata_checksum: string;
};

type RegistryRow = {
  agent_id: string;
  tenant_id: string;
  owner_user_id: string;
  parent_agent_id: string | null;
  generation_depth: number;
  status: string;
  policy_hash: string;
  created_at: string;
  expires_at: string;
  record_json: string;
};

const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RECORD_BYTES = 256 * 1_024;
const MAX_RECORD_BYTES = 1024 * 1_024;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;
const POLICY_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const FREE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RESERVED_TOOL_NAMES = new Set<string>([
  "__proto__",
  "prototype",
  ...Object.getOwnPropertyNames(Object.prototype),
]);
const FAMILIES = new Set<AgentFamily>([
  "analysis", "execution", "communication", "monitoring", "development", "orchestration", "governance",
]);
const TRAITS = new Set<AgentTrait>([
  "read_only", "write_capable", "external_communication", "handles_sensitive_data",
  "financial_operation", "code_execution", "subagent_creator", "destructive_operation",
]);
const RISKS = new Set<RiskLevel>(["low", "medium", "high", "critical"]);
const STATUSES = new Set<AgentStatus>([
  "DRAFT", "VALIDATED", "ACTIVE", "COMPLETED", "EXPIRED", "REVOKED", "FAILED", "ARCHIVED",
]);
const REQUIRED_RECORD_KEYS = [
  "agentId", "name", "purpose", "tenantId", "ownerUserId", "createdBy", "parentAgentId",
  "generationDepth", "classification", "traits", "riskLevel", "requestedTools", "grantedTools",
  "policyHash", "status", "createdAt", "expiresAt",
] as const;
const OPTIONAL_RECORD_KEYS = ["revokedAt"] as const;

export class SqliteAgentRegistryError extends Error {
  readonly code: string;
  readonly category: "configuration" | "persistence" | "integrity" | "lifecycle";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    category: SqliteAgentRegistryError["category"],
    statusCode: number,
    retryable = false,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SqliteAgentRegistryError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function createSqliteAgentRegistryStore(
  options: SqliteAgentRegistryStoreOptions,
): SqliteAgentRegistryStore {
  const sqlitePath = resolveSqlitePath(options?.sqlitePath);
  const hostBindingSha256 = sha256(normalizeHostId(options?.hostId));
  const authorityBinding = `sqlite-v1:${sha256(`${hostBindingSha256}\0${sqlitePath}`)}`;
  const busyTimeoutMs = boundedInteger(options?.busyTimeoutMs, DEFAULT_BUSY_TIMEOUT_MS, 100, MAX_BUSY_TIMEOUT_MS);
  const maxRecordBytes = boundedInteger(options?.maxRecordBytes, DEFAULT_MAX_RECORD_BYTES, 1_024, MAX_RECORD_BYTES);
  if (options?.now !== undefined && typeof options.now !== "function") throw configurationError();
  const now = options?.now ?? (() => new Date().toISOString());

  assertNoLinkedParentComponents(dirname(sqlitePath));
  mkdirSync(dirname(sqlitePath), { recursive: true, mode: 0o700 });
  try { chmodSync(dirname(sqlitePath), 0o700); } catch { /* Windows ACLs are applied at the governance directory boundary. */ }
  assertSafeDatabaseFile(sqlitePath, true);

  let db: DatabaseSync | null = null;
  let closed = false;
  let loaded = false;
  let lastErrorCode: string | null = null;
  try {
    db = new DatabaseSync(sqlitePath);
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    const journal = db.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: unknown } | undefined;
    if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") throw schemaError();
    db.exec("PRAGMA synchronous = FULL");
    db.exec("PRAGMA trusted_schema = OFF");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA recursive_triggers = OFF");
    assertPragmas(db, busyTimeoutMs);
    initializeMigrations(db, now);
    initializeHostMetadata(db, hostBindingSha256, now);
    (db as DatabaseSync & { enableDefensive?: (enabled: boolean) => void }).enableDefensive?.(true);
    assertSchema(db);
    assertSafeDatabaseFile(sqlitePath, false);
    try { chmodSync(sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
  } catch (error) {
    try { db?.close(); } catch { /* Preserve initialization failure. */ }
    if (isKnownError(error)) throw error;
    throw unavailableError(error);
  }

  if (!db) throw unavailableError();
  const database: DatabaseSync = db;
  const selectById = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json
    FROM agent_registry_records
    WHERE agent_id = ?
  `);
  const selectScoped = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json
    FROM agent_registry_records
    WHERE agent_id = ? AND tenant_id = ?
  `);
  const selectByTenant = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json
    FROM agent_registry_records
    WHERE tenant_id = ?
    ORDER BY created_at DESC, agent_id ASC
  `);
  const selectByParent = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json
    FROM agent_registry_records
    WHERE parent_agent_id = ?
    ORDER BY rowid ASC
  `);
  const selectAll = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json
    FROM agent_registry_records
    ORDER BY rowid ASC
  `);
  const countChildren = database.prepare(`
    SELECT COUNT(*) AS count
    FROM agent_registry_records
    WHERE parent_agent_id = ? AND status NOT IN ('REVOKED', 'ARCHIVED')
  `);
  const upsertRecord = database.prepare(`
    INSERT INTO agent_registry_records (
      agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
      status, policy_hash, created_at, expires_at, record_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      owner_user_id = excluded.owner_user_id,
      parent_agent_id = excluded.parent_agent_id,
      generation_depth = excluded.generation_depth,
      status = excluded.status,
      policy_hash = excluded.policy_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      record_json = excluded.record_json,
      updated_at = excluded.updated_at
  `);

  async function load(): Promise<void> {
    assertOpen();
    if (loaded) return;
    try {
      assertDatabaseHealthy(database);
      for (const row of selectAll.all() as RegistryRow[]) decodeRow(row, maxRecordBytes);
      loaded = true;
      lastErrorCode = null;
    } catch (error) {
      lastErrorCode = errorCode(error);
      if (isKnownError(error)) throw error;
      throw unavailableError(error);
    }
  }

  async function upsertMany(records: AgentRegistryRecord[]): Promise<void> {
    await load();
    if (!Array.isArray(records)) throw corrupt("Agent registry batch is malformed.");
    if (records.length === 0) return;
    const validated = records.map((record) => {
      if (!isPlainRecord(record)) throw corrupt("Agent registry record identity is malformed.");
      return validateRecord(String(record.agentId ?? ""), record, maxRecordBytes);
    });
    const byId = new Map(validated.map((record) => [record.agentId, record]));
    if (byId.size !== validated.length) throw corrupt("Agent registry batch contains duplicate identities.");

    try {
      transaction(database, () => {
        for (const record of validated) {
          const existingRow = selectById.get(record.agentId) as RegistryRow | undefined;
          if (existingRow) assertImmutableIdentity(decodeRow(existingRow, maxRecordBytes), record);
        }
        for (const record of validated) assertParentBinding(record, byId, selectById, maxRecordBytes);
        // A parent update must not leave an existing child outside the batch
        // with an expanded tool/TTL/tenant/owner relationship.
        for (const parent of validated) {
          for (const childRow of selectByParent.all(parent.agentId) as RegistryRow[]) {
            const child = byId.get(childRow.agent_id) ?? decodeRow(childRow, maxRecordBytes);
            assertParentBinding(child, byId, selectById, maxRecordBytes);
          }
        }
        const updatedAt = normalizedTimestamp(now());
        for (const record of validated) {
          const recordJson = JSON.stringify(record);
          const result = upsertRecord.run(
            record.agentId,
            record.tenantId,
            record.ownerUserId,
            record.parentAgentId,
            record.generationDepth,
            record.status,
            record.policyHash,
            record.createdAt,
            record.expiresAt,
            recordJson,
            updatedAt,
          );
          if (Number(result.changes) !== 1) throw writeError();
        }
      });
      lastErrorCode = null;
    } catch (error) {
      lastErrorCode = errorCode(error);
      if (isKnownError(error)) throw error;
      throw writeError(error);
    }
  }

  function assertOpen(): void {
    if (closed) throw closedError();
  }

  function readQuery<T>(operation: () => T): T {
    assertOpen();
    try {
      const result = operation();
      lastErrorCode = null;
      return result;
    } catch (error) {
      lastErrorCode = errorCode(error);
      if (isKnownError(error)) throw error;
      throw unavailableError(error);
    }
  }

  return {
    getAuthorityBinding() { return authorityBinding; },
    load,
    async upsert(record) { await upsertMany([record]); },
    upsertMany,
    async get(agentId, tenantId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(agentId ?? "")) || !validScope(tenantId)) return null;
      return readQuery(() => {
        const row = selectScoped.get(agentId, tenantId.trim()) as RegistryRow | undefined;
        return row ? decodeRow(row, maxRecordBytes) : null;
      });
    },
    async getUnscoped(agentId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(agentId ?? ""))) return null;
      return readQuery(() => {
        const row = selectById.get(agentId) as RegistryRow | undefined;
        return row ? decodeRow(row, maxRecordBytes) : null;
      });
    },
    async listByTenant(tenantId) {
      await load();
      if (!validScope(tenantId)) return [];
      return readQuery(() => (
        (selectByTenant.all(tenantId.trim()) as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes))
      ));
    },
    async countChildren(parentAgentId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(parentAgentId ?? ""))) return 0;
      return readQuery(() => {
        const row = countChildren.get(parentAgentId) as { count?: unknown } | undefined;
        const count = Number(row?.count ?? 0);
        if (!Number.isSafeInteger(count) || count < 0) throw corrupt("Agent child count is malformed.");
        return count;
      });
    },
    async listByParent(parentAgentId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(parentAgentId ?? ""))) return [];
      return readQuery(() => (
        (selectByParent.all(parentAgentId) as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes))
      ));
    },
    async listAll() {
      await load();
      return readQuery(() => (
        (selectAll.all() as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes))
      ));
    },
    async close() {
      if (closed) return;
      closed = true;
      database.close();
    },
    getHealth() {
      if (closed) return health("closed", false, null);
      try {
        assertDatabaseHealthy(database);
        if (!loaded) {
          for (const persisted of selectAll.all() as RegistryRow[]) decodeRow(persisted, maxRecordBytes);
          loaded = true;
        }
        const row = database.prepare("SELECT COUNT(*) AS count FROM agent_registry_records").get() as { count?: unknown };
        const count = Number(row.count ?? 0);
        if (!Number.isSafeInteger(count) || count < 0) throw corrupt("Agent registry count is malformed.");
        lastErrorCode = null;
        return health("ready", true, count);
      } catch (error) {
        lastErrorCode = errorCode(error);
        return health("degraded", false, null);
      }
    },
  };

  function health(
    status: SqliteAgentRegistryHealth["status"],
    available: boolean,
    recordCount: number | null,
  ): SqliteAgentRegistryHealth {
    return Object.freeze({
      ...SQLITE_AGENT_REGISTRY_BOUNDARIES,
      status,
      available,
      loaded,
      schemaVersion: SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
      migrationCount: SQLITE_AGENT_REGISTRY_MIGRATIONS.length,
      recordCount,
      busyTimeoutMs,
      pathExposed: false,
      lastErrorCode,
    });
  }
}

function initializeMigrations(db: DatabaseSync, now: () => string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY CHECK (version > 0),
      name TEXT NOT NULL,
      checksum TEXT NOT NULL CHECK (length(checksum) = 64),
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  validateMigrationRows(readMigrations(db));
  for (const migration of SQLITE_AGENT_REGISTRY_MIGRATIONS) {
    transaction(db, () => {
      const applied = readMigrations(db);
      validateMigrationRows(applied);
      if (applied.some((row) => row.version === migration.version)) return;
      const expectedNext = applied.length + 1;
      if (migration.version !== expectedNext) throw migrationError();
      db.exec(migration.sql);
      db.prepare(`
        INSERT INTO schema_migrations (version, name, checksum, applied_at)
        VALUES (?, ?, ?, ?)
      `).run(migration.version, migration.name, migration.checksum, normalizedTimestamp(now()));
    });
  }
  validateMigrationRows(readMigrations(db), true);
  db.exec(`PRAGMA user_version = ${SQLITE_AGENT_REGISTRY_SCHEMA_VERSION}`);
}

function readMigrations(db: DatabaseSync): MigrationRow[] {
  return db.prepare(`
    SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC
  `).all() as MigrationRow[];
}

function validateMigrationRows(rows: MigrationRow[], requireComplete = false): void {
  if (!Array.isArray(rows) || rows.length > SQLITE_AGENT_REGISTRY_MIGRATIONS.length) throw migrationError();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const expected = SQLITE_AGENT_REGISTRY_MIGRATIONS[index];
    if (!expected || Number(row.version) !== expected.version
      || row.name !== expected.name || row.checksum !== expected.checksum) {
      throw migrationError();
    }
  }
  if (requireComplete && rows.length !== SQLITE_AGENT_REGISTRY_MIGRATIONS.length) throw migrationError();
}

function initializeHostMetadata(db: DatabaseSync, hostBindingSha256: string, now: () => string): void {
  transaction(db, () => {
    const row = db.prepare(`
      SELECT schema_version, host_binding_sha256, created_at, updated_at, metadata_checksum
      FROM agent_registry_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
    if (!row) {
      const timestamp = normalizedTimestamp(now());
      db.prepare(`
        INSERT INTO agent_registry_metadata (
          singleton, schema_version, host_binding_sha256, created_at, updated_at, metadata_checksum
        ) VALUES (1, ?, ?, ?, ?, ?)
      `).run(
        SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
        hostBindingSha256,
        timestamp,
        timestamp,
        metadataChecksum(SQLITE_AGENT_REGISTRY_SCHEMA_VERSION, hostBindingSha256, timestamp, timestamp),
      );
      return;
    }
    if (Number(row.schema_version) !== SQLITE_AGENT_REGISTRY_SCHEMA_VERSION
      || !SHA256_PATTERN.test(row.host_binding_sha256)
      || row.host_binding_sha256 !== hostBindingSha256) {
      throw hostMismatchError();
    }
    const expected = metadataChecksum(
      Number(row.schema_version), row.host_binding_sha256, row.created_at, row.updated_at,
    );
    if (row.metadata_checksum !== expected) throw corrupt("Agent registry metadata integrity failed.");
  });
}

function assertSchema(db: DatabaseSync): void {
  const userVersion = readPragmaInteger(db, "user_version");
  if (userVersion !== SQLITE_AGENT_REGISTRY_SCHEMA_VERSION) throw schemaError();
  const tables = db.prepare("PRAGMA table_list").all() as Array<{ name?: unknown; strict?: unknown }>;
  for (const name of ["schema_migrations", "agent_registry_metadata", "agent_registry_records"]) {
    const table = tables.find((entry) => entry.name === name);
    if (!table || Number(table.strict) !== 1) throw schemaError();
  }
  assertColumns(db, "schema_migrations", ["version", "name", "checksum", "applied_at"]);
  assertColumns(db, "agent_registry_metadata", [
    "singleton", "schema_version", "host_binding_sha256", "created_at", "updated_at", "metadata_checksum",
  ]);
  assertColumns(db, "agent_registry_records", [
    "agent_id", "tenant_id", "owner_user_id", "parent_agent_id", "generation_depth", "status",
    "policy_hash", "created_at", "expires_at", "record_json", "updated_at",
  ]);
  const indexes = new Set(
    (db.prepare("PRAGMA index_list('agent_registry_records')").all() as Array<{ name?: unknown }>)
      .map((entry) => String(entry.name ?? "")),
  );
  for (const name of [
    "agent_registry_tenant_created_idx", "agent_registry_parent_status_idx", "agent_registry_status_expiry_idx",
  ]) {
    if (!indexes.has(name)) throw schemaError();
  }
  const triggers = db.prepare(`
    SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'agent_registry_records'
  `).all();
  if (triggers.length !== 0) throw schemaError();
  assertDatabaseHealthy(db);
}

function assertColumns(db: DatabaseSync, table: string, expected: string[]): void {
  const rows = db.prepare(`PRAGMA table_info('${table}')`).all() as Array<{ name?: unknown }>;
  if (rows.length !== expected.length || rows.some((row, index) => row.name !== expected[index])) throw schemaError();
}

function assertPragmas(db: DatabaseSync, busyTimeoutMs: number): void {
  if (readPragmaInteger(db, "foreign_keys") !== 1
    || readPragmaInteger(db, "synchronous") !== 2
    || readPragmaInteger(db, "busy_timeout") !== busyTimeoutMs) {
    throw schemaError();
  }
}

function assertDatabaseHealthy(db: DatabaseSync): void {
  const quick = db.prepare("PRAGMA quick_check").get() as { quick_check?: unknown } | undefined;
  if (String(quick?.quick_check ?? "").toLowerCase() !== "ok") throw corrupt("Agent registry SQLite integrity check failed.");
  if (db.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw corrupt("Agent registry foreign-key integrity check failed.");
  }
}

function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    throw error;
  }
}

function assertParentBinding(
  record: AgentRegistryRecord,
  batch: Map<string, AgentRegistryRecord>,
  selectById: ReturnType<DatabaseSync["prepare"]>,
  maxRecordBytes: number,
): void {
  if (record.parentAgentId === null) return;
  const parent = batch.get(record.parentAgentId)
    ?? decodeOptionalRow(selectById.get(record.parentAgentId) as RegistryRow | undefined, maxRecordBytes);
  if (!parent) throw corrupt(`Agent registry parent ${record.parentAgentId} is missing.`);
  if (parent.tenantId !== record.tenantId || parent.ownerUserId !== record.ownerUserId
    || parent.generationDepth + 1 !== record.generationDepth
    || Date.parse(record.expiresAt) > Date.parse(parent.expiresAt)) {
    throw corrupt(`Agent registry lineage for ${record.agentId} is malformed.`);
  }
  const ceiling = new Set(parent.grantedTools);
  if (record.requestedTools.some((tool) => !ceiling.has(tool))
    || record.grantedTools.some((tool) => !ceiling.has(tool))) {
    throw corrupt(`Agent registry lineage for ${record.agentId} expands parent tools.`);
  }
}

function assertImmutableIdentity(previous: AgentRegistryRecord, next: AgentRegistryRecord): void {
  for (const key of [
    "tenantId", "ownerUserId", "createdBy", "parentAgentId", "generationDepth", "createdAt",
  ] as const) {
    if (previous[key] !== next[key]) throw corrupt(`Agent registry identity field ${key} is immutable.`);
  }
  for (const key of ["name", "purpose", "classification", "traits", "riskLevel", "requestedTools"] as const) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      throw corrupt(`Agent registry definition field ${key} is immutable.`);
    }
  }
}

function decodeOptionalRow(row: RegistryRow | undefined, maxRecordBytes: number): AgentRegistryRecord | null {
  return row ? decodeRow(row, maxRecordBytes) : null;
}

function decodeRow(row: RegistryRow, maxRecordBytes: number): AgentRegistryRecord {
  if (!row || typeof row.record_json !== "string" || Buffer.byteLength(row.record_json) > maxRecordBytes) {
    throw corrupt("Agent registry SQLite row is malformed.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(row.record_json); }
  catch (error) { throw corrupt("Agent registry record JSON could not be parsed.", error); }
  const record = validateRecord(row.agent_id, parsed, maxRecordBytes);
  if (row.tenant_id !== record.tenantId || row.owner_user_id !== record.ownerUserId
    || row.parent_agent_id !== record.parentAgentId || Number(row.generation_depth) !== record.generationDepth
    || row.status !== record.status || row.policy_hash !== record.policyHash
    || row.created_at !== record.createdAt || row.expires_at !== record.expiresAt) {
    throw corrupt(`Agent registry columns diverge from record JSON for ${record.agentId}.`);
  }
  return record;
}

function validateRecord(id: string, input: unknown, maxRecordBytes: number): AgentRegistryRecord {
  if (!AGENT_ID_PATTERN.test(String(id ?? "")) || !isPlainRecord(input)) {
    throw corrupt("Agent registry record identity is malformed.");
  }
  assertExactKeys(input, REQUIRED_RECORD_KEYS, OPTIONAL_RECORD_KEYS);
  if (input.agentId !== id
    || !boundedText(input.name, 200) || !boundedFreeText(input.purpose, 4_000)
    || !boundedText(input.tenantId, 256) || !boundedText(input.ownerUserId, 256)
    || !boundedText(input.createdBy, 256)
    || (input.parentAgentId !== null && !AGENT_ID_PATTERN.test(String(input.parentAgentId ?? "")))
    || !Number.isSafeInteger(input.generationDepth) || Number(input.generationDepth) < 0
    || Number(input.generationDepth) > 1_024
    || !validClassification(input.classification)
    || !validTraits(input.traits) || !RISKS.has(input.riskLevel as RiskLevel)
    || !validTools(input.requestedTools) || !validTools(input.grantedTools)
    || !POLICY_HASH_PATTERN.test(String(input.policyHash ?? ""))
    || !STATUSES.has(input.status as AgentStatus)
    || !validTimestamp(input.createdAt) || !validTimestamp(input.expiresAt)
    || Date.parse(String(input.expiresAt)) < Date.parse(String(input.createdAt))
    || (input.revokedAt !== undefined && !validTimestamp(input.revokedAt))) {
    throw corrupt(`Agent registry record ${id} is malformed.`);
  }
  if ((input.parentAgentId === null) !== (input.generationDepth === 0)) {
    throw corrupt(`Agent registry record ${id} has malformed lineage depth.`);
  }
  const cloned = structuredClone(input) as unknown as AgentRegistryRecord;
  if (Buffer.byteLength(JSON.stringify(cloned)) > maxRecordBytes) {
    throw corrupt(`Agent registry record ${id} exceeds the SQLite record limit.`);
  }
  return cloned;
}

function validClassification(value: unknown): value is AgentClassification {
  if (!isPlainRecord(value)) return false;
  assertExactKeys(value, ["family", "domain", "subclass"], []);
  return FAMILIES.has(value.family as AgentFamily)
    && boundedText(value.domain, 256)
    && boundedText(value.subclass, 256);
}

function validTraits(value: unknown): value is AgentTrait[] {
  return isPlainDataArray(value, TRAITS.size)
    && value.every((item) => typeof item === "string" && TRAITS.has(item as AgentTrait))
    && new Set(value).size === value.length;
}

function validTools(value: unknown): value is string[] {
  return isPlainDataArray(value, 256)
    && value.every((item) => typeof item === "string" && item === item.trim()
      && item.length > 0 && item.length <= 256 && !CONTROL_PATTERN.test(item)
      && !RESERVED_TOOL_NAMES.has(item))
    && new Set(value).size === value.length;
}

function isPlainDataArray(value: unknown, maximumLength: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > maximumLength || Object.keys(value).length !== value.length) return false;
  return Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key, descriptor]) => (
    key === "length"
    || (descriptor.enumerable === true && descriptor.get === undefined && descriptor.set === undefined)
  ));
}

function assertExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): void {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !allowed.has(key))) {
    throw corrupt("Agent registry record contains missing or unknown fields.");
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => (
    descriptor.enumerable === true
    && descriptor.get === undefined
    && descriptor.set === undefined
  ));
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length > 0
    && value.length <= maxLength && !CONTROL_PATTERN.test(value);
}

function boundedFreeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maxLength
    && !FREE_TEXT_CONTROL_PATTERN.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && !CONTROL_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function normalizedTimestamp(value: unknown): string {
  if (!validTimestamp(value)) throw configurationError();
  return String(value);
}

function validScope(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value === value.trim()
    && value.length <= 256 && !CONTROL_PATTERN.test(value);
}

function metadataChecksum(
  schemaVersion: number,
  hostBindingSha256: string,
  createdAt: string,
  updatedAt: string,
): string {
  return sha256(`${schemaVersion}\0${hostBindingSha256}\0${createdAt}\0${updatedAt}`);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function resolveSqlitePath(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === ":memory:" || normalized.length > MAX_PATH_LENGTH || CONTROL_PATTERN.test(normalized)) {
    throw configurationError();
  }
  return resolve(normalized);
}

function normalizeHostId(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > MAX_HOST_ID_LENGTH || CONTROL_PATTERN.test(normalized)) throw configurationError();
  return normalized;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw configurationError();
  return Number(value);
}

function assertSafeDatabaseFile(path: string, allowMissing: boolean): void {
  if (!existsSync(path)) {
    if (allowMissing) return;
    throw configurationError();
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw configurationError();
}

function assertNoLinkedParentComponents(path: string): void {
  const chain: string[] = [];
  let current = resolve(path);
  while (true) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const candidate of chain.reverse()) {
    if (!existsSync(candidate)) continue;
    const stats = lstatSync(candidate);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw configurationError();
  }
}

function readPragmaInteger(db: DatabaseSync, name: string): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  return Number(row?.[name] ?? (row ? Object.values(row)[0] : undefined));
}

function errorCode(error: unknown): string {
  return typeof (error as { code?: unknown })?.code === "string"
    ? String((error as { code: string }).code).slice(0, 128)
    : "AGENT_REGISTRY_SQLITE_UNAVAILABLE";
}

function isKnownError(error: unknown): boolean {
  return error instanceof SqliteAgentRegistryError
    || Boolean(error && typeof error === "object" && (error as { name?: unknown }).name === "GovernanceAgentRegistryCorrupt");
}

function configurationError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_CONFIGURATION_INVALID",
    "The SQLite Agent registry configuration is invalid.",
    "configuration",
    500,
  );
}

function schemaError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_SCHEMA_INCOMPATIBLE",
    "The SQLite Agent registry schema or required PRAGMAs are incompatible.",
    "integrity",
    500,
  );
}

function migrationError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_MIGRATION_MISMATCH",
    "The SQLite Agent registry migration ledger does not match this build.",
    "integrity",
    500,
  );
}

function hostMismatchError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_HOST_MISMATCH",
    "The SQLite Agent registry is bound to another host.",
    "configuration",
    503,
  );
}

function closedError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_CLOSED",
    "The SQLite Agent registry is closed.",
    "lifecycle",
    503,
  );
}

function unavailableError(cause?: unknown): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_UNAVAILABLE",
    "The SQLite Agent registry is unavailable.",
    "persistence",
    503,
    true,
    cause,
  );
}

function writeError(cause?: unknown): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_WRITE_FAILED",
    "The SQLite Agent registry transaction did not commit.",
    "persistence",
    503,
    true,
    cause,
  );
}

function corrupt(message: string, cause?: unknown): Error & { code: string; category: string; statusCode: number } {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    {
      name: "GovernanceAgentRegistryCorrupt",
      code: "AGENT_REGISTRY_SQLITE_CORRUPT",
      category: "integrity",
      statusCode: 500,
    },
  );
}
