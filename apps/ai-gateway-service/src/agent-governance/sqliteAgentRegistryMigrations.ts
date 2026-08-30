import { createHash } from "node:crypto";

export type SqliteAgentRegistryMigration = Readonly<{
  version: number;
  name: string;
  sql: string;
  checksum: string;
}>;

const DEFINITIONS = [
  {
    version: 1,
    name: "create-agent-registry",
    sql: `
      CREATE TABLE agent_registry_metadata (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        schema_version INTEGER NOT NULL CHECK (schema_version > 0),
        host_binding_sha256 TEXT NOT NULL CHECK (length(host_binding_sha256) = 64),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata_checksum TEXT NOT NULL CHECK (length(metadata_checksum) = 64)
      ) STRICT;

      CREATE TABLE agent_registry_records (
        agent_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        parent_agent_id TEXT,
        generation_depth INTEGER NOT NULL CHECK (generation_depth >= 0),
        status TEXT NOT NULL CHECK (
          status IN ('DRAFT', 'VALIDATED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'REVOKED', 'FAILED', 'ARCHIVED')
        ),
        policy_hash TEXT NOT NULL CHECK (length(policy_hash) = 71),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        record_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (parent_agent_id IS NULL OR parent_agent_id <> agent_id),
        CHECK (
          (parent_agent_id IS NULL AND generation_depth = 0)
          OR (parent_agent_id IS NOT NULL AND generation_depth > 0)
        ),
        FOREIGN KEY (parent_agent_id)
          REFERENCES agent_registry_records(agent_id)
          ON UPDATE RESTRICT
          ON DELETE RESTRICT
          DEFERRABLE INITIALLY DEFERRED
      ) STRICT;
    `,
  },
  {
    version: 2,
    name: "add-agent-registry-scope-indexes",
    sql: `
      CREATE INDEX agent_registry_tenant_created_idx
        ON agent_registry_records (tenant_id, created_at DESC, agent_id);
      CREATE INDEX agent_registry_parent_status_idx
        ON agent_registry_records (parent_agent_id, status, agent_id)
        WHERE parent_agent_id IS NOT NULL;
      CREATE INDEX agent_registry_status_expiry_idx
        ON agent_registry_records (status, expires_at, agent_id);
    `,
  },
] as const;

export const SQLITE_AGENT_REGISTRY_SCHEMA_VERSION = DEFINITIONS.length;

export const SQLITE_AGENT_REGISTRY_MIGRATIONS: readonly SqliteAgentRegistryMigration[] = Object.freeze(
  DEFINITIONS.map((definition) => Object.freeze({
    ...definition,
    sql: definition.sql.trim(),
    checksum: createHash("sha256").update(definition.sql.trim(), "utf8").digest("hex"),
  })),
);
