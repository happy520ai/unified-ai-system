import { createHash } from "node:crypto";

export type PostgresAgentRegistryMigration = Readonly<{
  version: number;
  name: string;
  sql: string;
  checksum: string;
}>;

export const POSTGRES_AGENT_REGISTRY_TABLE = "public.ai_gateway_agent_governance_agents";
export const POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE =
  "public.ai_gateway_agent_governance_schema_migrations";
export const POSTGRES_AGENT_REGISTRY_SCHEMA_STATE_TABLE =
  "public.ai_gateway_agent_governance_schema_state";
export const POSTGRES_AGENT_REGISTRY_MIGRATION_LOCK = Object.freeze({
  classId: 1_431_193_303,
  objectId: 1_768_841_421,
});

/**
 * Product DDL is global, therefore the migration ledger and schema fingerprint
 * are global too. Runtime namespaces isolate data only; they cannot certify
 * divergent versions of one shared table/function/trigger schema.
 */
export const POSTGRES_AGENT_REGISTRY_MIGRATION_BOOTSTRAP_SQL = `
  /* agent-registry:migration-bootstrap */
  CREATE TABLE IF NOT EXISTS ${POSTGRES_AGENT_REGISTRY_MIGRATION_TABLE} (
    migration_version INTEGER NOT NULL CHECK (migration_version > 0),
    migration_name TEXT NOT NULL CHECK (length(migration_name) BETWEEN 1 AND 128),
    migration_checksum CHAR(64) NOT NULL CHECK (migration_checksum ~ '^[a-f0-9]{64}$'),
    applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (migration_version),
    UNIQUE (migration_name)
  );
  CREATE TABLE IF NOT EXISTS ${POSTGRES_AGENT_REGISTRY_SCHEMA_STATE_TABLE} (
    singleton BOOLEAN PRIMARY KEY CHECK (singleton = TRUE),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    schema_fingerprint CHAR(64) NOT NULL CHECK (schema_fingerprint ~ '^[a-f0-9]{64}$'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );
`.trim();

const DEFINITIONS = [
  {
    version: 1,
    name: "create-agent-governance-registry",
    sql: `
      /* agent-registry:migration-001 */
      CREATE TABLE IF NOT EXISTS ${POSTGRES_AGENT_REGISTRY_TABLE} (
        namespace TEXT NOT NULL CHECK (length(namespace) BETWEEN 1 AND 128),
        agent_id TEXT NOT NULL CHECK (agent_id ~ '^agt_[A-Za-z0-9_-]{1,128}$'),
        tenant_id TEXT NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 256),
        owner_user_id TEXT NOT NULL CHECK (length(owner_user_id) BETWEEN 1 AND 256),
        created_by TEXT NOT NULL CHECK (length(created_by) BETWEEN 1 AND 256),
        parent_agent_id TEXT,
        generation_depth INTEGER NOT NULL CHECK (generation_depth >= 0),
        status TEXT NOT NULL CHECK (
          status IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED', 'FAILED', 'ARCHIVED')
        ),
        policy_hash VARCHAR(71) NOT NULL CHECK (policy_hash ~ '^sha256:[a-f0-9]{64}$'),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        record_json JSONB NOT NULL CHECK (jsonb_typeof(record_json) = 'object'),
        record_sha256 CHAR(64) NOT NULL CHECK (record_sha256 ~ '^[a-f0-9]{64}$'),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY (namespace, agent_id),
        UNIQUE (namespace, tenant_id, agent_id),
        CHECK (parent_agent_id IS NULL OR parent_agent_id <> agent_id),
        CHECK (
          (parent_agent_id IS NULL AND generation_depth = 0)
          OR (parent_agent_id IS NOT NULL AND generation_depth > 0)
        ),
        CHECK (record_json ?& ARRAY[
          'agentId', 'name', 'purpose', 'tenantId', 'ownerUserId', 'createdBy',
          'parentAgentId', 'generationDepth', 'classification', 'traits',
          'riskLevel', 'requestedTools', 'grantedTools', 'policyHash', 'status',
          'createdAt', 'expiresAt'
        ]),
        CHECK ((record_json - ARRAY[
          'agentId', 'name', 'purpose', 'tenantId', 'ownerUserId', 'createdBy',
          'parentAgentId', 'generationDepth', 'classification', 'traits',
          'riskLevel', 'requestedTools', 'grantedTools', 'policyHash', 'status',
          'createdAt', 'expiresAt', 'revokedAt'
        ]::text[]) = '{}'::jsonb),
        CHECK (record_json ->> 'agentId' = agent_id),
        CHECK (record_json ->> 'tenantId' = tenant_id),
        CHECK (record_json ->> 'ownerUserId' = owner_user_id),
        CHECK (record_json ->> 'createdBy' = created_by),
        CHECK ((record_json ->> 'parentAgentId') IS NOT DISTINCT FROM parent_agent_id),
        CHECK ((record_json ->> 'generationDepth')::integer = generation_depth),
        CHECK (record_json ->> 'status' = status),
        CHECK (record_json ->> 'policyHash' = policy_hash),
        CHECK (record_json ->> 'createdAt' = created_at),
        CHECK (record_json ->> 'expiresAt' = expires_at),
        CHECK ((record_json ->> 'revokedAt') IS NOT DISTINCT FROM revoked_at),
        FOREIGN KEY (namespace, tenant_id, parent_agent_id)
          REFERENCES ${POSTGRES_AGENT_REGISTRY_TABLE} (namespace, tenant_id, agent_id)
          ON UPDATE RESTRICT
          ON DELETE RESTRICT
          DEFERRABLE INITIALLY DEFERRED
      );

      CREATE OR REPLACE FUNCTION public.ai_gateway_agent_governance_identity_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.namespace IS DISTINCT FROM NEW.namespace
          OR OLD.agent_id IS DISTINCT FROM NEW.agent_id
          OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
          OR OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id
          OR OLD.created_by IS DISTINCT FROM NEW.created_by
          OR OLD.parent_agent_id IS DISTINCT FROM NEW.parent_agent_id
          OR OLD.generation_depth IS DISTINCT FROM NEW.generation_depth
          OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
          RAISE EXCEPTION 'Agent registry identity and lineage are immutable'
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS ai_gateway_agent_governance_identity_immutable_trigger
        ON ${POSTGRES_AGENT_REGISTRY_TABLE};
      CREATE TRIGGER ai_gateway_agent_governance_identity_immutable_trigger
      BEFORE UPDATE ON ${POSTGRES_AGENT_REGISTRY_TABLE}
      FOR EACH ROW EXECUTE FUNCTION public.ai_gateway_agent_governance_identity_immutable();
    `,
  },
  {
    version: 2,
    name: "add-agent-governance-registry-indexes",
    sql: `
      /* agent-registry:migration-002 */
      CREATE INDEX IF NOT EXISTS ai_gateway_agent_governance_tenant_created_idx
        ON ${POSTGRES_AGENT_REGISTRY_TABLE}
        (namespace, tenant_id, created_at DESC, agent_id ASC);
      CREATE INDEX IF NOT EXISTS ai_gateway_agent_governance_parent_status_idx
        ON ${POSTGRES_AGENT_REGISTRY_TABLE}
        (namespace, parent_agent_id, status, agent_id)
        WHERE parent_agent_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS ai_gateway_agent_governance_status_expiry_idx
        ON ${POSTGRES_AGENT_REGISTRY_TABLE}
        (namespace, status, expires_at, agent_id);
    `,
  },
] as const;

export const POSTGRES_AGENT_REGISTRY_SCHEMA_VERSION = DEFINITIONS.length;

export const POSTGRES_AGENT_REGISTRY_MIGRATIONS: readonly PostgresAgentRegistryMigration[] = Object.freeze(
  DEFINITIONS.map((definition) => {
    const sql = definition.sql.trim();
    return Object.freeze({
      ...definition,
      sql,
      checksum: createHash("sha256").update(sql, "utf8").digest("hex"),
    });
  }),
);

export const POSTGRES_AGENT_REGISTRY_SCHEMA_FINGERPRINT = createHash("sha256")
  .update(JSON.stringify(POSTGRES_AGENT_REGISTRY_MIGRATIONS.map((migration) => ({
    version: migration.version,
    name: migration.name,
    checksum: migration.checksum,
  }))), "utf8")
  .digest("hex");
