import { createHash } from "node:crypto";
import type {
  AgentFamily,
  AgentRegistryRecord,
  AgentStatus,
  AgentTrait,
  RiskLevel,
} from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { AgentRegistryStore } from "./agentRegistryStore.ts";
import {
  POSTGRES_AGENT_REGISTRY_MIGRATION_BOOTSTRAP_SQL,
  POSTGRES_AGENT_REGISTRY_MIGRATION_LOCK,
  POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE,
  POSTGRES_AGENT_REGISTRY_MIGRATIONS,
  POSTGRES_AGENT_REGISTRY_SCHEMA_FINGERPRINT,
  POSTGRES_AGENT_REGISTRY_SCHEMA_STATE_TABLE,
  POSTGRES_AGENT_REGISTRY_SCHEMA_VERSION,
  POSTGRES_AGENT_REGISTRY_TABLE,
} from "./postgresAgentRegistryMigrations.ts";

type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type AgentRegistryPostgresClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
};

export type AgentRegistryPostgresPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  connect(): Promise<AgentRegistryPostgresClient>;
  end(): Promise<void>;
  on?(event: "error", listener: (error: Error) => void): unknown;
};

export interface PostgresAgentRegistryStoreOptions {
  connectionString?: string;
  pool?: AgentRegistryPostgresPool;
  namespace: string;
  poolMax?: number;
  statementTimeoutMs?: number;
  maxRecordBytes?: number;
  now?: () => number;
}

export const POSTGRES_AGENT_REGISTRY_BOUNDARIES = Object.freeze({
  storageMode: "central-postgres" as const,
  durable: true as const,
  transactional: true as const,
  distributedCapable: true as const,
  distributedVerified: false as const,
  tlsConfigurationRequiredFromOuterRuntime: true as const,
  tlsVerifiedByThisAdapter: false as const,
  realPostgresIntegrationVerified: false as const,
  rollbackProtected: false as const,
});

export type PostgresAgentRegistryHealth = Readonly<{
  status: "starting" | "ready" | "degraded" | "closed";
  available: boolean;
  loaded: boolean;
  namespaceExposed: false;
  connectionStringExposed: false;
  schemaVersion: number;
  schemaFingerprint: string;
  migrationCount: number;
  recordCount: number | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
} & typeof POSTGRES_AGENT_REGISTRY_BOUNDARIES>;

export interface PostgresAgentRegistryStore extends AgentRegistryStore {
  getAuthorityBinding(): string;
  checkHealth(): Promise<boolean>;
  getHealth(): PostgresAgentRegistryHealth;
  close(): Promise<void>;
}

type MigrationRow = {
  migration_version: string | number;
  migration_name: string;
  migration_checksum: string;
};

type SchemaStateRow = {
  schema_version: string | number;
  schema_fingerprint: string;
};

type RegistryRow = {
  agent_id: string;
  tenant_id: string;
  owner_user_id: string;
  created_by: string;
  parent_agent_id: string | null;
  generation_depth: string | number;
  status: string;
  policy_hash: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  record_json: unknown;
  record_sha256: string;
};

const DEFAULT_POOL_MAX = 4;
const DEFAULT_STATEMENT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RECORD_BYTES = 256 * 1024;
const MAX_RECORD_BYTES = 1024 * 1024;
const MAX_BATCH_RECORDS = 10_000;
const MUTATION_LOCK_CLASS_ID = 1_431_193_303;
const AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;
const POLICY_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SAFE_NAMESPACE_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/u;
const SAFE_SCOPE_PATTERN = /^[^\u0000-\u001f\u007f]{1,256}$/u;
const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_.:-]{1,256}$/u;
const FREE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
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
const TERMINAL_CHILD_EXCLUSIONS = ["REVOKED", "ARCHIVED"] as const;
const REQUIRED_RECORD_KEYS = [
  "agentId", "name", "purpose", "tenantId", "ownerUserId", "createdBy", "parentAgentId",
  "generationDepth", "classification", "traits", "riskLevel", "requestedTools", "grantedTools",
  "policyHash", "status", "createdAt", "expiresAt",
] as const;
const OPTIONAL_RECORD_KEYS = ["revokedAt"] as const;

const SELECT_FIELDS = `
  agent_id, tenant_id, owner_user_id, created_by, parent_agent_id,
  generation_depth, status, policy_hash, created_at, expires_at,
  revoked_at, record_json, record_sha256
`;

const UPSERT_SQL = `
  /* agent-registry:upsert */
  INSERT INTO ${POSTGRES_AGENT_REGISTRY_TABLE} (
    namespace, agent_id, tenant_id, owner_user_id, created_by,
    parent_agent_id, generation_depth, status, policy_hash,
    created_at, expires_at, revoked_at, record_json, record_sha256,
    updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7::integer, $8, $9,
    $10, $11, $12, $13::jsonb, $14, clock_timestamp()
  )
  ON CONFLICT (namespace, agent_id) DO UPDATE SET
    status = EXCLUDED.status,
    policy_hash = EXCLUDED.policy_hash,
    expires_at = EXCLUDED.expires_at,
    revoked_at = EXCLUDED.revoked_at,
    record_json = EXCLUDED.record_json,
    record_sha256 = EXCLUDED.record_sha256,
    updated_at = clock_timestamp()
  WHERE ${POSTGRES_AGENT_REGISTRY_TABLE}.tenant_id = EXCLUDED.tenant_id
    AND ${POSTGRES_AGENT_REGISTRY_TABLE}.owner_user_id = EXCLUDED.owner_user_id
    AND ${POSTGRES_AGENT_REGISTRY_TABLE}.created_by = EXCLUDED.created_by
    AND ${POSTGRES_AGENT_REGISTRY_TABLE}.parent_agent_id IS NOT DISTINCT FROM EXCLUDED.parent_agent_id
    AND ${POSTGRES_AGENT_REGISTRY_TABLE}.generation_depth = EXCLUDED.generation_depth
    AND ${POSTGRES_AGENT_REGISTRY_TABLE}.created_at = EXCLUDED.created_at
  RETURNING ${SELECT_FIELDS}
`;

export class PostgresAgentRegistryError extends Error {
  readonly code: string;
  readonly category: "configuration" | "persistence" | "integrity" | "lifecycle";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    category: PostgresAgentRegistryError["category"],
    statusCode: number,
    retryable = false,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PostgresAgentRegistryError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function createPostgresAgentRegistryStore(
  rawOptions: PostgresAgentRegistryStoreOptions,
): PostgresAgentRegistryStore {
  const options = normalizeOptions(rawOptions);
  const authorityBinding = `postgres-v1:${createHash("sha256").update(options.namespace, "utf8").digest("hex")}`;
  const ownsPool = !rawOptions.pool;
  const poolPromise = rawOptions.pool
    ? Promise.resolve(rawOptions.pool)
    : loadPool(options);
  let readyPromise: Promise<AgentRegistryPostgresPool> | null = null;
  let closed = false;
  let loaded = false;
  let available = false;
  let recordCount: number | null = null;
  let lastSuccessAt: string | null = null;
  let lastFailureAt: string | null = null;
  let lastErrorCode: string | null = null;

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      available = false;
      lastErrorCode = "AGENT_REGISTRY_POSTGRES_POOL_ERROR";
      lastFailureAt = new Date(options.now()).toISOString();
    });
  }).catch(() => {
    available = false;
  });

  async function getReadyPool(): Promise<AgentRegistryPostgresPool> {
    if (closed) throw closedError();
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        await initializeSchema(pool, options);
        available = true;
        lastSuccessAt = new Date(options.now()).toISOString();
        lastErrorCode = null;
        return pool;
      });
      void readyPromise.catch(() => undefined);
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      markFailure(error);
      throw normalizePostgresError(error, "AGENT_REGISTRY_POSTGRES_INITIALIZE_FAILED");
    }
  }

  async function load(): Promise<void> {
    if (loaded && available) return;
    const pool = await getReadyPool();
    try {
      const result = await pool.query<{ count: string | number }>(`
        /* agent-registry:load-health */
        SELECT COUNT(*)::bigint AS count
        FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
        WHERE namespace = $1
      `, [options.namespace]);
      recordCount = safeCount(result.rows[0]?.count);
      markSuccess();
    } catch (error) {
      markFailure(error);
      throw normalizePostgresError(error, "AGENT_REGISTRY_POSTGRES_UNAVAILABLE");
    }
  }

  async function upsertMany(records: AgentRegistryRecord[]): Promise<void> {
    await load();
    if (!Array.isArray(records)) throw corrupt("Agent registry batch is malformed.");
    if (records.length === 0) return;
    if (records.length > MAX_BATCH_RECORDS) {
      throw new PostgresAgentRegistryError(
        "AGENT_REGISTRY_BATCH_TOO_LARGE",
        "Agent registry batch exceeds the transactional record limit.",
        "persistence",
        413,
      );
    }
    const validated = records.map((record) => validateRecord(record?.agentId, record, options.maxRecordBytes));
    const batch = new Map(validated.map((record) => [record.agentId, record]));
    if (batch.size !== validated.length) throw corrupt("Agent registry batch contains duplicate identities.");
    const ordered = [...validated].sort((left, right) => (
      left.generationDepth - right.generationDepth || left.agentId.localeCompare(right.agentId)
    ));

    const pool = await getReadyPool();
    const client = await pool.connect();
    let began = false;
    try {
      await client.query("BEGIN");
      began = true;
      await setStatementTimeout(client, options.statementTimeoutMs);
      await client.query(
        "/* agent-registry:mutation-lock */ SELECT pg_advisory_xact_lock($1, $2)",
        [MUTATION_LOCK_CLASS_ID, namespaceLockKey(options.namespace)],
      );

      const existingById = new Map<string, AgentRegistryRecord>();
      for (const record of [...ordered].sort((left, right) => left.agentId.localeCompare(right.agentId))) {
        const result = await client.query<RegistryRow>(`
          /* agent-registry:lock-existing */
          SELECT ${SELECT_FIELDS}
          FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
          WHERE namespace = $1 AND agent_id = $2
          FOR UPDATE
        `, [options.namespace, record.agentId]);
        if (result.rows[0]) {
          const existing = decodeRow(result.rows[0], options.maxRecordBytes);
          assertImmutableIdentity(existing, record);
          existingById.set(existing.agentId, existing);
        }
      }

      for (const record of ordered) {
        if (!record.parentAgentId) continue;
        const parent = batch.get(record.parentAgentId)
          ?? await readParentForShare(client, options, record.parentAgentId);
        assertParentBinding(record, parent);
      }
      for (const parent of ordered) {
        const children = await client.query<RegistryRow>(`
          /* agent-registry:lock-children */
          SELECT ${SELECT_FIELDS}
          FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
          WHERE namespace = $1 AND parent_agent_id = $2
          ORDER BY agent_id ASC
          FOR SHARE
        `, [options.namespace, parent.agentId]);
        for (const childRow of children.rows) {
          const persisted = decodeRow(childRow, options.maxRecordBytes);
          assertParentBinding(batch.get(persisted.agentId) ?? persisted, parent);
        }
      }

      for (const record of ordered) {
        const result = await client.query<RegistryRow>(UPSERT_SQL, recordValues(options.namespace, record));
        if (result.rowCount !== 1 || !result.rows[0]) {
          throw immutableError(record.agentId);
        }
        const stored = decodeRow(result.rows[0], options.maxRecordBytes);
        if (stableStringify(stored) !== stableStringify(record)) {
          throw corrupt(`PostgreSQL Agent registry write verification failed for ${record.agentId}.`);
        }
      }
      await client.query("COMMIT");
      began = false;
      recordCount = recordCount === null
        ? null
        : recordCount + ordered.filter((record) => !existingById.has(record.agentId)).length;
      markSuccess();
    } catch (error) {
      if (began) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the authoritative transaction failure.
        }
      }
      markFailure(error);
      throw normalizePostgresError(error, "AGENT_REGISTRY_POSTGRES_WRITE_FAILED");
    } finally {
      client.release();
    }
  }

  async function queryRows(
    tag: string,
    where: string,
    values: unknown[],
    order = "ORDER BY agent_id ASC",
  ): Promise<AgentRegistryRecord[]> {
    await load();
    try {
      const pool = await getReadyPool();
      const result = await pool.query<RegistryRow>(`
        /* agent-registry:${tag} */
        SELECT ${SELECT_FIELDS}
        FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
        WHERE namespace = $1 ${where}
        ${order}
      `, [options.namespace, ...values]);
      const decoded = result.rows.map((row) => decodeRow(row, options.maxRecordBytes));
      markSuccess();
      return decoded;
    } catch (error) {
      markFailure(error);
      throw normalizePostgresError(error, "AGENT_REGISTRY_POSTGRES_READ_FAILED");
    }
  }

  function markSuccess(): void {
    available = true;
    loaded = true;
    lastSuccessAt = new Date(options.now()).toISOString();
    lastErrorCode = null;
  }

  function markFailure(error: unknown): void {
    available = false;
    lastFailureAt = new Date(options.now()).toISOString();
    lastErrorCode = errorCode(error);
  }

  return {
    getAuthorityBinding() {
      return authorityBinding;
    },
    load,
    async upsert(record) {
      await upsertMany([record]);
    },
    upsertMany,
    async get(agentId, tenantId) {
      if (!AGENT_ID_PATTERN.test(String(agentId ?? "")) || !validScope(tenantId)) return null;
      const rows = await queryRows(
        "get-scoped",
        "AND agent_id = $2 AND tenant_id = $3",
        [agentId, tenantId.trim()],
        "LIMIT 1",
      );
      return rows[0] ?? null;
    },
    async getUnscoped(agentId) {
      if (!AGENT_ID_PATTERN.test(String(agentId ?? ""))) return null;
      const rows = await queryRows("get-unscoped", "AND agent_id = $2", [agentId], "LIMIT 1");
      return rows[0] ?? null;
    },
    async listByTenant(tenantId) {
      if (!validScope(tenantId)) return [];
      return queryRows(
        "list-tenant",
        "AND tenant_id = $2",
        [tenantId.trim()],
        "ORDER BY created_at DESC, agent_id ASC",
      );
    },
    async countChildren(parentAgentId) {
      if (!AGENT_ID_PATTERN.test(String(parentAgentId ?? ""))) return 0;
      await load();
      try {
        const pool = await getReadyPool();
        const result = await pool.query<{ count: string | number }>(`
          /* agent-registry:count-children */
          SELECT COUNT(*)::bigint AS count
          FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
          WHERE namespace = $1 AND parent_agent_id = $2
            AND status <> ALL($3::text[])
        `, [options.namespace, parentAgentId, [...TERMINAL_CHILD_EXCLUSIONS]]);
        const count = safeCount(result.rows[0]?.count);
        markSuccess();
        return count;
      } catch (error) {
        markFailure(error);
        throw normalizePostgresError(error, "AGENT_REGISTRY_POSTGRES_READ_FAILED");
      }
    },
    async listByParent(parentAgentId) {
      if (!AGENT_ID_PATTERN.test(String(parentAgentId ?? ""))) return [];
      return queryRows("list-parent", "AND parent_agent_id = $2", [parentAgentId]);
    },
    async listAll() {
      return queryRows("list-all", "", []);
    },
    async checkHealth() {
      if (closed) throw closedError();
      try {
        const pool = await getReadyPool();
        const result = await pool.query<{ count: string | number }>(`
          /* agent-registry:health */
          SELECT COUNT(*)::bigint AS count
          FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
          WHERE namespace = $1
        `, [options.namespace]);
        recordCount = safeCount(result.rows[0]?.count);
        markSuccess();
        return true;
      } catch (error) {
        markFailure(error);
        throw normalizePostgresError(error, "AGENT_REGISTRY_POSTGRES_UNAVAILABLE");
      }
    },
    getHealth() {
      return Object.freeze({
        ...POSTGRES_AGENT_REGISTRY_BOUNDARIES,
        status: closed ? "closed" : available ? "ready" : lastFailureAt ? "degraded" : "starting",
        available: !closed && available,
        loaded,
        namespaceExposed: false,
        connectionStringExposed: false,
        schemaVersion: POSTGRES_AGENT_REGISTRY_SCHEMA_VERSION,
        schemaFingerprint: POSTGRES_AGENT_REGISTRY_SCHEMA_FINGERPRINT,
        migrationCount: POSTGRES_AGENT_REGISTRY_MIGRATIONS.length,
        recordCount,
        lastSuccessAt,
        lastFailureAt,
        lastErrorCode,
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      available = false;
      if (ownsPool) await (await poolPromise).end();
    },
  };
}

async function initializeSchema(
  pool: AgentRegistryPostgresPool,
  options: NormalizedOptions,
): Promise<void> {
  const client = await pool.connect();
  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    await setStatementTimeout(client, options.statementTimeoutMs);
    await client.query(
      "/* agent-registry:migration-lock */ SELECT pg_advisory_xact_lock($1, $2)",
      [POSTGRES_AGENT_REGISTRY_MIGRATION_LOCK.classId, POSTGRES_AGENT_REGISTRY_MIGRATION_LOCK.objectId],
    );
    await client.query(POSTGRES_AGENT_REGISTRY_MIGRATION_BOOTSTRAP_SQL);
    const appliedResult = await client.query<MigrationRow>(`
      /* agent-registry:migrations-read */
      SELECT migration_version, migration_name, migration_checksum
      FROM ${POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE}
      ORDER BY migration_version ASC
      FOR UPDATE
    `);
    const applied = new Map<number, MigrationRow>();
    for (const row of appliedResult.rows) {
      const version = Number(row.migration_version);
      if (!Number.isSafeInteger(version) || version < 1 || applied.has(version)) throw migrationError();
      applied.set(version, row);
    }
    if ([...applied.keys()].some((version) => !POSTGRES_AGENT_REGISTRY_MIGRATIONS.some((item) => item.version === version))) {
      throw new PostgresAgentRegistryError(
        "AGENT_REGISTRY_SCHEMA_NEWER_THAN_RUNTIME",
        "PostgreSQL Agent registry contains an unknown migration version.",
        "configuration",
        500,
      );
    }
    let missingPrefix = false;
    for (const migration of POSTGRES_AGENT_REGISTRY_MIGRATIONS) {
      const existing = applied.get(migration.version);
      if (existing) {
        if (missingPrefix) throw migrationError();
        if (existing.migration_name !== migration.name
          || existing.migration_checksum !== migration.checksum) {
          throw new PostgresAgentRegistryError(
            "AGENT_REGISTRY_MIGRATION_CHECKSUM_MISMATCH",
            `PostgreSQL Agent registry migration ${migration.version} checksum or name diverged.`,
            "integrity",
            500,
          );
        }
        continue;
      }
      missingPrefix = true;
      await client.query(migration.sql);
      const inserted = await client.query(`
        /* agent-registry:migration-record */
        INSERT INTO ${POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE} (
          migration_version, migration_name, migration_checksum
        ) VALUES ($1::integer, $2, $3)
      `, [migration.version, migration.name, migration.checksum]);
      if (inserted.rowCount !== 1) throw migrationError();
    }
    await client.query(`
      /* agent-registry:schema-state-init */
      INSERT INTO ${POSTGRES_AGENT_REGISTRY_SCHEMA_STATE_TABLE} (
        singleton, schema_version, schema_fingerprint, updated_at
      ) VALUES (TRUE, $1::integer, $2, clock_timestamp())
      ON CONFLICT (singleton) DO NOTHING
    `, [POSTGRES_AGENT_REGISTRY_SCHEMA_VERSION, POSTGRES_AGENT_REGISTRY_SCHEMA_FINGERPRINT]);
    const schemaState = await client.query<SchemaStateRow>(`
      /* agent-registry:schema-state-read */
      SELECT schema_version, schema_fingerprint
      FROM ${POSTGRES_AGENT_REGISTRY_SCHEMA_STATE_TABLE}
      WHERE singleton = TRUE
      FOR UPDATE
    `);
    if (Number(schemaState.rows[0]?.schema_version) !== POSTGRES_AGENT_REGISTRY_SCHEMA_VERSION
      || schemaState.rows[0]?.schema_fingerprint !== POSTGRES_AGENT_REGISTRY_SCHEMA_FINGERPRINT) {
      throw new PostgresAgentRegistryError(
        "AGENT_REGISTRY_SCHEMA_FINGERPRINT_MISMATCH",
        "PostgreSQL Agent registry global schema fingerprint diverged.",
        "integrity",
        500,
      );
    }
    await client.query(`
      /* agent-registry:schema-probe */
      SELECT ${SELECT_FIELDS}
      FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
      WHERE false
    `);
    await client.query("COMMIT");
    began = false;
  } catch (error) {
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the schema/migration failure.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

async function readParentForShare(
  client: AgentRegistryPostgresClient,
  options: NormalizedOptions,
  parentAgentId: string,
): Promise<AgentRegistryRecord | null> {
  const result = await client.query<RegistryRow>(`
    /* agent-registry:lock-parent */
    SELECT ${SELECT_FIELDS}
    FROM ${POSTGRES_AGENT_REGISTRY_TABLE}
    WHERE namespace = $1 AND agent_id = $2
    FOR SHARE
  `, [options.namespace, parentAgentId]);
  return result.rows[0] ? decodeRow(result.rows[0], options.maxRecordBytes) : null;
}

function assertParentBinding(child: AgentRegistryRecord, parent: AgentRegistryRecord | null): void {
  if (!parent || child.parentAgentId !== parent.agentId
    || child.tenantId !== parent.tenantId || child.ownerUserId !== parent.ownerUserId
    || child.generationDepth !== parent.generationDepth + 1
    || Date.parse(child.expiresAt) > Date.parse(parent.expiresAt)
    || child.requestedTools.some((tool) => !parent.grantedTools.includes(tool))
    || child.grantedTools.some((tool) => !parent.grantedTools.includes(tool))) {
    throw new PostgresAgentRegistryError(
      "AGENT_REGISTRY_PARENT_BINDING_INVALID",
      `Agent ${child.agentId} does not remain within its immutable parent lineage ceiling.`,
      "lifecycle",
      409,
    );
  }
}

function assertImmutableIdentity(existing: AgentRegistryRecord, next: AgentRegistryRecord): void {
  if (existing.agentId !== next.agentId || existing.tenantId !== next.tenantId
    || existing.ownerUserId !== next.ownerUserId || existing.createdBy !== next.createdBy
    || existing.parentAgentId !== next.parentAgentId
    || existing.generationDepth !== next.generationDepth || existing.createdAt !== next.createdAt) {
    throw immutableError(next.agentId);
  }
  for (const key of ["name", "purpose", "classification", "traits", "riskLevel", "requestedTools"] as const) {
    if (stableStringify(existing[key]) !== stableStringify(next[key])) throw immutableError(next.agentId);
  }
}

function immutableError(agentId: string): PostgresAgentRegistryError {
  return new PostgresAgentRegistryError(
    "AGENT_REGISTRY_IDENTITY_IMMUTABLE",
    `Agent ${agentId} identity or lineage cannot be migrated by upsert.`,
    "lifecycle",
    409,
  );
}

function recordValues(namespace: string, record: AgentRegistryRecord): unknown[] {
  return [
    namespace,
    record.agentId,
    record.tenantId,
    record.ownerUserId,
    record.createdBy,
    record.parentAgentId,
    record.generationDepth,
    record.status,
    record.policyHash,
    record.createdAt,
    record.expiresAt,
    record.revokedAt ?? null,
    JSON.stringify(record),
    recordDigest(record),
  ];
}

function decodeRow(row: RegistryRow, maxRecordBytes: number): AgentRegistryRecord {
  if (!row || typeof row !== "object") throw corrupt("PostgreSQL Agent registry row is malformed.");
  let input: unknown = row.record_json;
  if (typeof input === "string") {
    if (Buffer.byteLength(input, "utf8") > maxRecordBytes) throw corrupt("Agent registry record exceeds its byte limit.");
    try {
      input = JSON.parse(input);
    } catch (error) {
      throw corrupt("PostgreSQL Agent registry JSON is malformed.", error);
    }
  }
  const record = validateRecord(row.agent_id, input, maxRecordBytes);
  const generationDepth = Number(row.generation_depth);
  if (row.agent_id !== record.agentId || row.tenant_id !== record.tenantId
    || row.owner_user_id !== record.ownerUserId || row.created_by !== record.createdBy
    || row.parent_agent_id !== record.parentAgentId || generationDepth !== record.generationDepth
    || row.status !== record.status || row.policy_hash !== record.policyHash
    || row.created_at !== record.createdAt || row.expires_at !== record.expiresAt
    || row.revoked_at !== (record.revokedAt ?? null)
    || !SHA256_PATTERN.test(String(row.record_sha256 ?? ""))
    || row.record_sha256 !== recordDigest(record)) {
    throw corrupt(`PostgreSQL Agent registry columns diverge from record JSON for ${record.agentId}.`);
  }
  return record;
}

function validateRecord(id: unknown, input: unknown, maxRecordBytes: number): AgentRegistryRecord {
  if (!AGENT_ID_PATTERN.test(String(id ?? "")) || !isPlainRecord(input)) {
    throw corrupt("Agent registry record identity is malformed.");
  }
  assertExactKeys(input, REQUIRED_RECORD_KEYS, OPTIONAL_RECORD_KEYS);
  const record = input as unknown as AgentRegistryRecord;
  if (record.agentId !== id || !validScope(record.tenantId) || !validScope(record.ownerUserId)
    || !validScope(record.createdBy) || !validFreeText(record.name, 200)
    || !validFreeText(record.purpose, 4_000)
    || (record.parentAgentId !== null && !AGENT_ID_PATTERN.test(String(record.parentAgentId)))
    || record.parentAgentId === record.agentId || !Number.isSafeInteger(record.generationDepth)
    || record.generationDepth < 0
    || ((record.parentAgentId === null) !== (record.generationDepth === 0))
    || !validClassification(record.classification) || !validEnumArray(record.traits, TRAITS)
    || !RISKS.has(record.riskLevel) || !validToolArray(record.requestedTools)
    || !validToolArray(record.grantedTools)
    || record.grantedTools.some((tool) => !record.requestedTools.includes(tool))
    || !POLICY_HASH_PATTERN.test(String(record.policyHash ?? ""))
    || !STATUSES.has(record.status) || !isCanonicalTimestamp(record.createdAt)
    || !isCanonicalTimestamp(record.expiresAt) || Date.parse(record.expiresAt) < Date.parse(record.createdAt)
    || (record.revokedAt !== undefined && !isCanonicalTimestamp(record.revokedAt))) {
    throw corrupt(`Agent registry record ${String(id)} is malformed.`);
  }
  const canonical = structuredClone(record);
  if (Buffer.byteLength(stableStringify(canonical), "utf8") > maxRecordBytes) {
    throw corrupt(`Agent registry record ${record.agentId} exceeds its byte limit.`);
  }
  return canonical;
}

function validClassification(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  assertExactKeys(value, ["family", "domain", "subclass"], []);
  return FAMILIES.has(value.family as AgentFamily)
    && validClassificationText(value.domain) && validClassificationText(value.subclass);
}

function validClassificationText(value: unknown): value is string {
  return typeof value === "string" && value === value.trim()
    && value.length > 0 && value.length <= 256
    && !FREE_TEXT_CONTROL_PATTERN.test(value);
}

function validToolArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 10_000
    && new Set(value).size === value.length
    && value.every((item) => validSafeToken(item) && !RESERVED_KEYS.has(item));
}

function validEnumArray<T extends string>(value: unknown, values: Set<T>): value is T[] {
  return Array.isArray(value) && new Set(value).size === value.length
    && value.every((item) => typeof item === "string" && values.has(item as T));
}

function validSafeToken(value: unknown): value is string {
  return typeof value === "string" && SAFE_TOKEN_PATTERN.test(value) && !RESERVED_KEYS.has(value);
}

function validScope(value: unknown): value is string {
  return typeof value === "string" && SAFE_SCOPE_PATTERN.test(value.trim()) && value === value.trim();
}

function validFreeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= maximum
    && !FREE_TEXT_CONTROL_PATTERN.test(value);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): void {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  if (required.some((key) => !Object.hasOwn(value, key))
    || keys.some((key) => !allowed.has(key) || RESERVED_KEYS.has(key))) {
    throw corrupt("Agent registry record contains missing or unknown fields.");
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function recordDigest(record: AgentRegistryRecord): string {
  return createHash("sha256").update(stableStringify(record), "utf8").digest("hex");
}

function namespaceLockKey(namespace: string): number {
  return createHash("sha256").update(namespace, "utf8").digest().readInt32BE(0);
}

function safeCount(value: unknown): number {
  const count = Number(value ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) throw corrupt("Agent registry count is malformed.");
  return count;
}

type NormalizedOptions = Required<Pick<
  PostgresAgentRegistryStoreOptions,
  "namespace" | "poolMax" | "statementTimeoutMs" | "maxRecordBytes" | "now"
>> & Pick<PostgresAgentRegistryStoreOptions, "connectionString">;

function normalizeOptions(options: PostgresAgentRegistryStoreOptions): NormalizedOptions {
  if (!options || !SAFE_NAMESPACE_PATTERN.test(String(options.namespace ?? ""))) {
    throw new PostgresAgentRegistryError(
      "AGENT_REGISTRY_POSTGRES_CONFIGURATION_INVALID",
      "PostgreSQL Agent registry requires a bounded namespace.",
      "configuration",
      500,
    );
  }
  if (!options.pool && (typeof options.connectionString !== "string" || options.connectionString.trim() === "")) {
    throw new PostgresAgentRegistryError(
      "AGENT_REGISTRY_POSTGRES_CONFIGURATION_INVALID",
      "PostgreSQL Agent registry requires a connection string or injected pool.",
      "configuration",
      500,
    );
  }
  return {
    namespace: options.namespace,
    connectionString: options.connectionString,
    poolMax: boundedInteger(options.poolMax, DEFAULT_POOL_MAX, 1, 64),
    statementTimeoutMs: boundedInteger(options.statementTimeoutMs, DEFAULT_STATEMENT_TIMEOUT_MS, 100, 60_000),
    maxRecordBytes: boundedInteger(options.maxRecordBytes, DEFAULT_MAX_RECORD_BYTES, 1_024, MAX_RECORD_BYTES),
    now: options.now ?? Date.now,
  };
}

async function setStatementTimeout(
  client: AgentRegistryPostgresClient,
  statementTimeoutMs: number,
): Promise<void> {
  await client.query(
    "/* agent-registry:statement-timeout */ SELECT set_config('statement_timeout', $1, true)",
    [`${statementTimeoutMs}ms`],
  );
}

async function loadPool(options: NormalizedOptions): Promise<AgentRegistryPostgresPool> {
  try {
    const { Pool } = await import("pg");
    // TLS is deliberately not invented here. The outer deployment must supply
    // a verified-TLS connection string/Pool and prove it in real integration.
    return new Pool({
      connectionString: options.connectionString,
      max: options.poolMax,
      connectionTimeoutMillis: options.statementTimeoutMs,
      statement_timeout: options.statementTimeoutMs,
      application_name: "unified-ai-agent-governance-registry",
    }) as unknown as AgentRegistryPostgresPool;
  } catch (error) {
    throw new PostgresAgentRegistryError(
      "AGENT_REGISTRY_POSTGRES_DRIVER_UNAVAILABLE",
      "PostgreSQL Agent registry driver could not be initialized.",
      "configuration",
      500,
      false,
      error,
    );
  }
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function migrationError(cause?: unknown): PostgresAgentRegistryError {
  return new PostgresAgentRegistryError(
    "AGENT_REGISTRY_MIGRATION_INVALID",
    "PostgreSQL Agent registry migration ledger is malformed or incomplete.",
    "integrity",
    500,
    false,
    cause,
  );
}

function corrupt(message: string, cause?: unknown): PostgresAgentRegistryError {
  return new PostgresAgentRegistryError(
    "AGENT_REGISTRY_RECORD_CORRUPT",
    message,
    "integrity",
    500,
    false,
    cause,
  );
}

function closedError(): PostgresAgentRegistryError {
  return new PostgresAgentRegistryError(
    "AGENT_REGISTRY_POSTGRES_CLOSED",
    "PostgreSQL Agent registry is closed.",
    "persistence",
    503,
  );
}

function normalizePostgresError(error: unknown, fallbackCode: string): PostgresAgentRegistryError {
  if (error instanceof PostgresAgentRegistryError) return error;
  const code = error && typeof error === "object" ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "23503") {
    return new PostgresAgentRegistryError(
      "AGENT_REGISTRY_PARENT_BINDING_INVALID",
      "PostgreSQL rejected an Agent parent binding.",
      "lifecycle",
      409,
      false,
      error,
    );
  }
  if (code === "23505" || code === "23514") {
    return new PostgresAgentRegistryError(
      "AGENT_REGISTRY_IDENTITY_IMMUTABLE",
      "PostgreSQL rejected an Agent identity, lineage or record consistency change.",
      "lifecycle",
      409,
      false,
      error,
    );
  }
  const retryable = code === "40001" || code === "40P01" || code.startsWith("08");
  return new PostgresAgentRegistryError(
    fallbackCode,
    "PostgreSQL Agent registry operation failed.",
    "persistence",
    503,
    retryable,
    error,
  );
}

function errorCode(error: unknown): string {
  if (error instanceof PostgresAgentRegistryError) return error.code;
  return "AGENT_REGISTRY_POSTGRES_UNAVAILABLE";
}
