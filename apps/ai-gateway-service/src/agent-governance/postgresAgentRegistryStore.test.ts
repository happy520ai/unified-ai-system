import { createHash } from "node:crypto";
import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { describe, expect, it } from "vitest";
import {
  createPostgresAgentRegistryStore,
  type AgentRegistryPostgresClient,
  type AgentRegistryPostgresPool,
} from "./postgresAgentRegistryStore.ts";
import {
  POSTGRES_AGENT_REGISTRY_MIGRATIONS,
} from "./postgresAgentRegistryMigrations.ts";

type Query = { scope: "client" | "pool"; text: string; values: unknown[] };

function record(
  agentId: string,
  overrides: Partial<AgentRegistryRecord> = {},
): AgentRegistryRecord {
  const parent = overrides.parentAgentId ?? null;
  return {
    agentId,
    name: agentId,
    purpose: `test ${agentId}`,
    tenantId: "tenant_a",
    ownerUserId: "user_a",
    createdBy: "user_a",
    parentAgentId: parent,
    generationDepth: parent ? 1 : 0,
    classification: { family: "analysis", domain: "tests", subclass: "registry" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["file_read", "file_write"],
    grantedTools: parent ? ["file_read"] : ["file_read", "file_write"],
    policyHash: `sha256:${agentId.endsWith("child") ? "b".repeat(64) : "a".repeat(64)}`,
    status: "ACTIVE",
    createdAt: "2026-08-30T00:00:00.000Z",
    expiresAt: parent ? "2026-08-30T00:30:00.000Z" : "2026-08-30T01:00:00.000Z",
    ...overrides,
  };
}

function digest(value: AgentRegistryRecord): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function row(value: AgentRegistryRecord, overrides: Record<string, unknown> = {}) {
  return {
    agent_id: value.agentId,
    tenant_id: value.tenantId,
    owner_user_id: value.ownerUserId,
    created_by: value.createdBy,
    parent_agent_id: value.parentAgentId,
    generation_depth: value.generationDepth,
    status: value.status,
    policy_hash: value.policyHash,
    created_at: value.createdAt,
    expires_at: value.expiresAt,
    revoked_at: value.revokedAt ?? null,
    record_json: structuredClone(value),
    record_sha256: digest(value),
    ...overrides,
  };
}

class MockPool implements AgentRegistryPostgresPool {
  readonly queries: Query[] = [];
  readonly migrationRows = new Map<number, { migration_version: number; migration_name: string; migration_checksum: string }>();
  readonly records = new Map<string, ReturnType<typeof row>>();
  readonly forceUpsertConflict = new Set<string>();
  schemaState: { schema_version: number; schema_fingerprint: string } | null = null;
  endCalls = 0;
  releaseCalls = 0;
  rollbackCount = 0;
  private errorListener: ((error: Error) => void) | null = null;
  private recordSnapshot: Map<string, ReturnType<typeof row>> | null = null;
  private migrationSnapshot: Map<number, { migration_version: number; migration_name: string; migration_checksum: string }> | null = null;
  private schemaStateSnapshot: { schema_version: number; schema_fingerprint: string } | null | undefined;

  on(_event: "error", listener: (error: Error) => void): void {
    this.errorListener = listener;
  }

  emitPoolError(): void {
    this.errorListener?.(new Error("simulated pool error"));
  }

  async connect(): Promise<AgentRegistryPostgresClient> {
    return {
      query: (text, values = []) => this.execute("client", text, values),
      release: () => { this.releaseCalls += 1; },
    };
  }

  query<Row = Record<string, unknown>>(text: string, values: unknown[] = []) {
    return this.execute<Row>("pool", text, values);
  }

  async end(): Promise<void> {
    this.endCalls += 1;
  }

  seed(value: AgentRegistryRecord, overrides: Record<string, unknown> = {}): void {
    this.records.set(value.agentId, row(value, overrides));
  }

  private async execute<Row>(scope: "client" | "pool", text: string, values: unknown[]) {
    this.queries.push({ scope, text, values: [...values] });
    const sql = text.replace(/\s+/gu, " ").trim();
    if (sql === "BEGIN") {
      this.recordSnapshot = new Map(this.records);
      this.migrationSnapshot = new Map(this.migrationRows);
      this.schemaStateSnapshot = this.schemaState ? { ...this.schemaState } : null;
      return result<Row>();
    }
    if (sql === "COMMIT") {
      this.recordSnapshot = null;
      this.migrationSnapshot = null;
      this.schemaStateSnapshot = undefined;
      return result<Row>();
    }
    if (sql === "ROLLBACK") {
      this.rollbackCount += 1;
      if (this.recordSnapshot) {
        this.records.clear();
        for (const [key, value] of this.recordSnapshot) this.records.set(key, value);
      }
      if (this.migrationSnapshot) {
        this.migrationRows.clear();
        for (const [key, value] of this.migrationSnapshot) this.migrationRows.set(key, value);
      }
      if (this.schemaStateSnapshot !== undefined) {
        this.schemaState = this.schemaStateSnapshot ? { ...this.schemaStateSnapshot } : null;
      }
      this.recordSnapshot = null;
      this.migrationSnapshot = null;
      this.schemaStateSnapshot = undefined;
      return result<Row>();
    }
    if (sql.includes("agent-registry:statement-timeout")
      || sql.includes("agent-registry:migration-lock")
      || sql.includes("agent-registry:mutation-lock")
      || sql.includes("agent-registry:migration-bootstrap")
      || sql.includes("agent-registry:migration-001")
      || sql.includes("agent-registry:migration-002")
      || sql.includes("agent-registry:schema-probe")) {
      return result<Row>();
    }
    if (sql.includes("agent-registry:migrations-read")) {
      return result<Row>([...this.migrationRows.values()] as Row[]);
    }
    if (sql.includes("agent-registry:migration-record")) {
      const version = Number(values[0]);
      this.migrationRows.set(version, {
        migration_version: version,
        migration_name: String(values[1]),
        migration_checksum: String(values[2]),
      });
      return result<Row>([], 1);
    }
    if (sql.includes("agent-registry:schema-state-init")) {
      this.schemaState ??= {
        schema_version: Number(values[0]),
        schema_fingerprint: String(values[1]),
      };
      return result<Row>([], 1);
    }
    if (sql.includes("agent-registry:schema-state-read")) {
      return result<Row>(this.schemaState ? [this.schemaState as Row] : []);
    }
    if (sql.includes("agent-registry:load-health") || sql.includes("agent-registry:health")) {
      return result<Row>([{ count: this.records.size } as Row]);
    }
    if (sql.includes("agent-registry:lock-existing")) {
      const stored = this.records.get(String(values[1]));
      return result<Row>(stored ? [stored as Row] : []);
    }
    if (sql.includes("agent-registry:lock-parent")) {
      const stored = this.records.get(String(values[1]));
      return result<Row>(stored ? [stored as Row] : []);
    }
    if (sql.includes("agent-registry:lock-children")) {
      const parentAgentId = String(values[1]);
      return result<Row>([...this.records.values()]
        .filter((item) => item.parent_agent_id === parentAgentId) as Row[]);
    }
    if (sql.includes("agent-registry:upsert")) {
      const agentId = String(values[1]);
      if (this.forceUpsertConflict.has(agentId)) return result<Row>([], 0);
      const parsed = JSON.parse(String(values[12])) as AgentRegistryRecord;
      const stored = row(parsed, { record_sha256: String(values[13]) });
      this.records.set(agentId, stored);
      return result<Row>([stored as Row], 1);
    }
    if (sql.includes("agent-registry:get-scoped")) {
      const stored = this.records.get(String(values[1]));
      return result<Row>(stored && stored.tenant_id === values[2] ? [stored as Row] : []);
    }
    if (sql.includes("agent-registry:get-unscoped")) {
      const stored = this.records.get(String(values[1]));
      return result<Row>(stored ? [stored as Row] : []);
    }
    if (sql.includes("agent-registry:list-tenant")) {
      return result<Row>([...this.records.values()]
        .filter((item) => item.tenant_id === values[1]) as Row[]);
    }
    if (sql.includes("agent-registry:list-parent")) {
      return result<Row>([...this.records.values()]
        .filter((item) => item.parent_agent_id === values[1]) as Row[]);
    }
    if (sql.includes("agent-registry:list-all")) {
      return result<Row>([...this.records.values()] as Row[]);
    }
    if (sql.includes("agent-registry:count-children")) {
      const excluded = new Set(values[2] as string[]);
      const count = [...this.records.values()].filter((item) => (
        item.parent_agent_id === values[1] && !excluded.has(item.status)
      )).length;
      return result<Row>([{ count } as Row]);
    }
    throw new Error(`Unhandled mock SQL: ${sql}`);
  }
}

function result<Row>(rows: Row[] = [], rowCount: number | null = rows.length) {
  return Promise.resolve({ rows, rowCount });
}

describe("PostgreSQL Agent Registry", () => {
  it("accepts bounded free-text classification and purpose from Agent generation", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({ pool, namespace: "free-text-contract" });
    const generated = record("agt_spaced_name", {
      name: "Report Reader",
      purpose: "x".repeat(3_000),
      classification: { family: "analysis", domain: "customer reports", subclass: "Report Reader" },
    });
    await store.upsert(generated);
    await expect(store.get(generated.agentId, generated.tenantId)).resolves.toEqual(generated);
    await store.close();
  });

  it("runs checksummed migrations under a transaction-scoped advisory lock and reports honest health", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({
      pool,
      namespace: "test-registry",
      now: () => Date.parse("2026-08-30T00:00:00.000Z"),
    });

    await store.load();

    const sql = pool.queries.map((query) => query.text).join("\n");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("ai_gateway_agent_governance_schema_migrations");
    expect(sql).toContain("ai_gateway_agent_governance_tenant_created_idx");
    expect(sql).toContain("ai_gateway_agent_governance_parent_status_idx");
    expect(sql).toContain("identity_immutable_trigger");
    expect([...pool.migrationRows.values()].map((item) => item.migration_checksum))
      .toEqual(POSTGRES_AGENT_REGISTRY_MIGRATIONS.map((item) => item.checksum));
    expect(pool.queries.filter((query) => query.text === "BEGIN")).toHaveLength(1);
    expect(pool.queries.filter((query) => query.text === "COMMIT")).toHaveLength(1);
    expect(store.getHealth()).toMatchObject({
      status: "ready",
      available: true,
      distributedCapable: true,
      distributedVerified: false,
      tlsConfigurationRequiredFromOuterRuntime: true,
      tlsVerifiedByThisAdapter: false,
      namespaceExposed: false,
      connectionStringExposed: false,
      recordCount: 0,
      schemaFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(store.getHealth())).not.toContain("test-registry");
    expect(await store.checkHealth()).toBe(true);
    const migrationDdlCount = pool.queries.filter((query) => (
      query.text.includes("agent-registry:migration-001")
      || query.text.includes("agent-registry:migration-002")
    )).length;
    const reopened = createPostgresAgentRegistryStore({ pool, namespace: "other-runtime-namespace" });
    await reopened.load();
    expect(reopened.getAuthorityBinding()).not.toBe(store.getAuthorityBinding());
    expect(pool.queries.filter((query) => (
      query.text.includes("agent-registry:migration-001")
      || query.text.includes("agent-registry:migration-002")
    ))).toHaveLength(migrationDdlCount);
    await reopened.close();
    await store.close();
    expect(pool.endCalls).toBe(0);
    expect(store.getHealth().status).toBe("closed");
  });

  it("implements every registry operation and commits a parent-first batch atomically", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({ pool, namespace: "operations" });
    const parent = record("agt_parent");
    const child = record("agt_child", { parentAgentId: parent.agentId });

    await store.upsertMany([child, parent]);

    const upserts = pool.queries.filter((query) => query.text.includes("agent-registry:upsert"));
    expect(pool.queries.some((query) => query.text.includes("agent-registry:mutation-lock"))).toBe(true);
    expect(upserts.map((query) => JSON.parse(String(query.values[12])).agentId))
      .toEqual([parent.agentId, child.agentId]);
    expect(pool.rollbackCount).toBe(0);
    expect(await store.get(parent.agentId, "tenant_a")).toEqual(parent);
    expect(await store.get(parent.agentId, "tenant_b")).toBeNull();
    expect(await store.getUnscoped(child.agentId)).toEqual(child);
    expect((await store.listByTenant("tenant_a")).map((item) => item.agentId).sort())
      .toEqual([child.agentId, parent.agentId].sort());
    expect(await store.countChildren(parent.agentId)).toBe(1);
    expect(await store.listByParent(parent.agentId)).toEqual([child]);
    expect((await store.listAll()).map((item) => item.agentId).sort())
      .toEqual([child.agentId, parent.agentId].sort());
  });

  it("rolls back identity migration and concurrent ON CONFLICT mismatches", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({ pool, namespace: "identity" });
    const original = record("agt_immutable");
    await store.upsert(original);

    await expect(store.upsert({ ...original, tenantId: "tenant_b" }))
      .rejects.toMatchObject({ code: "AGENT_REGISTRY_IDENTITY_IMMUTABLE" });
    expect(pool.rollbackCount).toBe(1);

    pool.forceUpsertConflict.add(original.agentId);
    await expect(store.upsert({ ...original, status: "REVOKED", revokedAt: "2026-08-30T00:10:00.000Z" }))
      .rejects.toMatchObject({ code: "AGENT_REGISTRY_IDENTITY_IMMUTABLE" });
    expect(pool.rollbackCount).toBe(2);
    expect(await store.getUnscoped(original.agentId)).toEqual(original);
  });

  it("rolls back the complete batch when a later upsert conflicts", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({ pool, namespace: "batch-rollback" });
    const first = record("agt_batch_first");
    const second = record("agt_batch_second");
    pool.forceUpsertConflict.add(second.agentId);

    await expect(store.upsertMany([first, second])).rejects.toMatchObject({
      code: "AGENT_REGISTRY_IDENTITY_IMMUTABLE",
    });

    expect(pool.rollbackCount).toBe(1);
    expect(await store.getUnscoped(first.agentId)).toBeNull();
    expect(await store.getUnscoped(second.agentId)).toBeNull();
  });

  it("rejects missing parents and column/JSON divergence without returning partial records", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({ pool, namespace: "integrity" });
    const orphan = record("agt_orphan_child", { parentAgentId: "agt_missing" });
    await expect(store.upsert(orphan)).rejects.toMatchObject({
      code: "AGENT_REGISTRY_PARENT_BINDING_INVALID",
    });
    expect(pool.rollbackCount).toBe(1);

    const corruptRecord = record("agt_corrupt");
    pool.seed(corruptRecord, { tenant_id: "tenant_b" });
    await expect(store.getUnscoped(corruptRecord.agentId)).rejects.toMatchObject({
      code: "AGENT_REGISTRY_RECORD_CORRUPT",
    });
  });

  it("refuses migration checksum drift and rolls the initialization transaction back", async () => {
    const pool = new MockPool();
    const migration = POSTGRES_AGENT_REGISTRY_MIGRATIONS[0]!;
    pool.migrationRows.set(migration.version, {
      migration_version: migration.version,
      migration_name: migration.name,
      migration_checksum: "0".repeat(64),
    });
    const store = createPostgresAgentRegistryStore({ pool, namespace: "migration-drift" });

    await expect(store.load()).rejects.toMatchObject({
      code: "AGENT_REGISTRY_MIGRATION_CHECKSUM_MISMATCH",
    });
    expect(pool.rollbackCount).toBe(1);
    expect(store.getHealth()).toMatchObject({ status: "degraded", available: false });
  });

  it("refuses a divergent global schema fingerprint for every data namespace", async () => {
    const pool = new MockPool();
    for (const migration of POSTGRES_AGENT_REGISTRY_MIGRATIONS) {
      pool.migrationRows.set(migration.version, {
        migration_version: migration.version,
        migration_name: migration.name,
        migration_checksum: migration.checksum,
      });
    }
    pool.schemaState = { schema_version: 2, schema_fingerprint: "f".repeat(64) };
    const store = createPostgresAgentRegistryStore({ pool, namespace: "schema-fingerprint-drift" });

    await expect(store.load()).rejects.toMatchObject({
      code: "AGENT_REGISTRY_SCHEMA_FINGERPRINT_MISMATCH",
    });
    expect(pool.rollbackCount).toBe(1);
  });

  it("marks pool failure in bounded health without exposing connection or namespace data", async () => {
    const pool = new MockPool();
    const store = createPostgresAgentRegistryStore({ pool, namespace: "secret-namespace" });
    await store.load();
    pool.emitPoolError();
    const health = store.getHealth();
    expect(health).toMatchObject({
      status: "degraded",
      available: false,
      lastErrorCode: "AGENT_REGISTRY_POSTGRES_POOL_ERROR",
    });
    expect(JSON.stringify(health)).not.toContain("secret-namespace");
  });
});
