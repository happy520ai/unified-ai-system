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
  {
    version: 3,
    name: "add-rollback-protected-registry-authority",
    sql: `
      ALTER TABLE agent_registry_records ADD COLUMN record_hmac TEXT;

      CREATE TABLE agent_registry_authority (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        installation_id TEXT NOT NULL,
        backend_id TEXT NOT NULL,
        path_binding_sha256 TEXT NOT NULL CHECK (length(path_binding_sha256) = 64),
        revision INTEGER NOT NULL CHECK (revision >= 0),
        event_head TEXT NOT NULL,
        projection_xor TEXT NOT NULL CHECK (length(projection_xor) = 64),
        projection_hash TEXT NOT NULL CHECK (length(projection_hash) = 64),
        record_count INTEGER NOT NULL CHECK (record_count >= 0),
        state_hmac TEXT NOT NULL CHECK (length(state_hmac) = 64),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE agent_registry_authority_events (
        revision INTEGER PRIMARY KEY CHECK (revision > 0),
        previous_head TEXT NOT NULL,
        event_hash TEXT NOT NULL CHECK (length(event_hash) = 64),
        event_hmac TEXT NOT NULL CHECK (length(event_hmac) = 64),
        batch_hash TEXT NOT NULL CHECK (length(batch_hash) = 64),
        path_binding_sha256 TEXT NOT NULL CHECK (length(path_binding_sha256) = 64),
        projection_hash TEXT NOT NULL CHECK (length(projection_hash) = 64),
        record_count INTEGER NOT NULL CHECK (record_count >= 0),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TRIGGER agent_registry_record_hmac_required_insert
      BEFORE INSERT ON agent_registry_records
      WHEN NEW.record_hmac IS NULL OR length(NEW.record_hmac) <> 64
      BEGIN
        SELECT RAISE(ABORT, 'agent registry record HMAC required');
      END;

      CREATE TRIGGER agent_registry_record_hmac_required_update
      BEFORE UPDATE ON agent_registry_records
      WHEN NEW.record_hmac IS NULL OR length(NEW.record_hmac) <> 64
      BEGIN
        SELECT RAISE(ABORT, 'agent registry record HMAC required');
      END;
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
