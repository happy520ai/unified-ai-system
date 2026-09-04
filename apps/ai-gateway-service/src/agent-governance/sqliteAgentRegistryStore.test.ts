import { link, mkdir, mkdtemp, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  SQLITE_AGENT_REGISTRY_MIGRATIONS,
  SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
} from "./sqliteAgentRegistryMigrations.ts";
import {
  createSqliteAgentRegistryStore,
  type SqliteAgentRegistryStore,
  type SqliteAgentRegistryStoreOptions,
} from "./sqliteAgentRegistryStore.ts";

const roots: string[] = [];
const NOW = "2026-08-30T00:00:00.000Z";
const HMAC_SECRET = "sqlite-agent-registry-test-secret-2026-08-30";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50,
  })));
});

describe("SQLite Agent registry", () => {
  it("applies checksummed STRICT migrations with hardened single-host PRAGMAs", async () => {
    const fixture = await createFixture();
    const store = fixture.store;
    await store.load();
    expect(store.getAuthorityBinding()).toMatch(/^sqlite-v2:[a-f0-9]{64}$/u);
    expect(store.getAuthorityProtocol()).toBe("sqlite-checkpoint-v1");

    expect(store.getHealth()).toMatchObject({
      status: "ready",
      available: true,
      loaded: true,
      storageMode: "single-host-sqlite",
      durable: true,
      transactional: true,
      distributed: false,
      singleHost: true,
      crossHostSupported: false,
      journalMode: "wal",
      synchronous: "full",
      foreignKeys: true,
      rollbackProtected: true,
      rollbackProtectionScope: "database-file-only-with-same-host-checkpoint",
      cryptographicallyTamperEvident: true,
      databaseSnapshotRollbackProtected: true,
      wholeDirectoryRollbackProtected: false,
      authorityProtocol: "sqlite-checkpoint-v1",
      schemaVersion: SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
      migrationCount: SQLITE_AGENT_REGISTRY_MIGRATIONS.length,
      recordCount: 0,
      busyTimeoutMs: 5_000,
      pathExposed: false,
      checkpointVerified: true,
      authorityRevision: 0,
      authorityInstallationExposed: false,
      recoveryStatus: "initialized",
      lastErrorCode: null,
    });
    await store.close();

    const db = new DatabaseSync(fixture.dbPath, { readOnly: true });
    try {
      expect((db.prepare("PRAGMA journal_mode").get() as any).journal_mode).toBe("wal");
      expect((db.prepare("PRAGMA user_version").get() as any).user_version)
        .toBe(SQLITE_AGENT_REGISTRY_SCHEMA_VERSION);
      const migrations = db.prepare(`
        SELECT version, name, checksum FROM schema_migrations ORDER BY version
      `).all() as Array<{ version: number; name: string; checksum: string }>;
      expect(migrations).toEqual(SQLITE_AGENT_REGISTRY_MIGRATIONS.map(({ version, name, checksum }) => ({
        version,
        name,
        checksum,
      })));
      const strictTables = new Map(
        (db.prepare("PRAGMA table_list").all() as Array<{ name: string; strict: number }>)
          .map((row) => [row.name, row.strict]),
      );
      expect(strictTables.get("schema_migrations")).toBe(1);
      expect(strictTables.get("agent_registry_metadata")).toBe(1);
      expect(strictTables.get("agent_registry_records")).toBe(1);
      expect(strictTables.get("agent_registry_authority")).toBe(1);
      expect(strictTables.get("agent_registry_authority_events")).toBe(1);
      const recordColumns = new Set(
        (db.prepare("PRAGMA table_info('agent_registry_records')").all() as Array<{ name: string }>)
          .map(({ name }) => name),
      );
      expect(recordColumns.has("record_hmac")).toBe(true);
      const indexes = new Set(
        (db.prepare("PRAGMA index_list('agent_registry_records')").all() as Array<{ name: string }>)
          .map(({ name }) => name),
      );
      expect(indexes.has("agent_registry_tenant_created_idx")).toBe(true);
      expect(indexes.has("agent_registry_parent_status_idx")).toBe(true);
      expect(indexes.has("agent_registry_status_expiry_idx")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("implements the complete Registry interface with tenant and lineage isolation", async () => {
    const fixture = await createFixture();
    const parent = record("agt_parent", "tenant-a", {
      requestedTools: ["file_read", "web_search"],
      grantedTools: ["file_read", "web_search"],
      expiresAt: "2026-08-30T04:00:00.000Z",
    });
    const child = record("agt_child", "tenant-a", {
      ownerUserId: parent.ownerUserId,
      createdBy: parent.createdBy,
      parentAgentId: parent.agentId,
      generationDepth: 1,
      requestedTools: ["file_read"],
      grantedTools: ["file_read"],
      expiresAt: "2026-08-30T03:00:00.000Z",
    });
    const revokedChild = record("agt_revoked_child", "tenant-a", {
      ownerUserId: parent.ownerUserId,
      createdBy: parent.createdBy,
      parentAgentId: parent.agentId,
      generationDepth: 1,
      requestedTools: ["web_search"],
      grantedTools: ["web_search"],
      status: "REVOKED",
      revokedAt: "2026-08-30T00:30:00.000Z",
      expiresAt: "2026-08-30T03:00:00.000Z",
    });
    const other = record("agt_other", "tenant-b");

    await fixture.store.upsertMany([child, parent, revokedChild, other]);
    expect(await fixture.store.get(parent.agentId, "tenant-b")).toBeNull();
    expect(await fixture.store.get(parent.agentId, "")).toBeNull();
    expect(await fixture.store.get(parent.agentId, "tenant-a")).toEqual(parent);
    expect((await fixture.store.listByTenant("tenant-a")).map(({ agentId }) => agentId).sort())
      .toEqual([child.agentId, parent.agentId, revokedChild.agentId].sort());
    expect((await fixture.store.listByTenant("tenant-b")).map(({ agentId }) => agentId))
      .toEqual([other.agentId]);
    expect(await fixture.store.countChildren(parent.agentId)).toBe(1);
    expect((await fixture.store.listByParent(parent.agentId)).map(({ agentId }) => agentId))
      .toEqual([child.agentId, revokedChild.agentId]);
    expect((await fixture.store.listAll()).map(({ agentId }) => agentId))
      .toEqual([child.agentId, parent.agentId, revokedChild.agentId, other.agentId]);

    await expect(fixture.store.upsert({
      ...parent,
      requestedTools: ["file_read"],
      grantedTools: ["file_read"],
    })).rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    expect(await fixture.store.get(parent.agentId, "tenant-a")).toEqual(parent);

    const completed = { ...child, status: "COMPLETED" as const };
    await fixture.store.upsert(completed);
    expect(await fixture.store.getUnscoped(child.agentId)).toEqual(completed);
    await fixture.store.close();

    const reopened = createStore(fixture.dbPath, "host-a");
    await reopened.load();
    expect(await reopened.get(child.agentId, "tenant-a")).toEqual(completed);
    expect(reopened.getHealth().recordCount).toBe(4);
    await reopened.close();
    expect(reopened.getHealth()).toMatchObject({ status: "closed", available: false, pathExposed: false });
    await expect(reopened.listAll()).rejects.toMatchObject({ code: "AGENT_REGISTRY_SQLITE_CLOSED" });
  });

  it("rolls back an entire upsertMany batch when SQLite rejects a later row", async () => {
    const fixture = await createFixture();
    await fixture.store.load();
    const raw = new DatabaseSync(fixture.dbPath);
    raw.exec(`
      CREATE TRIGGER force_agent_registry_failure
      BEFORE INSERT ON agent_registry_records
      WHEN NEW.agent_id = 'agt_tx_fail'
      BEGIN
        SELECT RAISE(ABORT, 'forced test failure');
      END;
    `);
    raw.close();

    await expect(fixture.store.upsertMany([
      record("agt_tx_first", "tenant-a"),
      record("agt_tx_fail", "tenant-a"),
    ])).rejects.toMatchObject({ code: "AGENT_REGISTRY_SQLITE_WRITE_FAILED" });
    expect(await fixture.store.getUnscoped("agt_tx_first")).toBeNull();
    expect(await fixture.store.getUnscoped("agt_tx_fail")).toBeNull();

    const cleanup = new DatabaseSync(fixture.dbPath);
    cleanup.exec("DROP TRIGGER force_agent_registry_failure");
    cleanup.close();
    await fixture.store.close();
  });

  it("uses the database as central state across same-host connections", async () => {
    const fixture = await createFixture();
    const second = createStore(fixture.dbPath, "host-a");
    await Promise.all([fixture.store.load(), second.load()]);

    await fixture.store.upsert(record("agt_connection_a", "tenant-a"));
    await second.upsert(record("agt_connection_b", "tenant-b"));
    expect((await fixture.store.listAll()).map(({ agentId }) => agentId).sort()).toEqual([
      "agt_connection_a",
      "agt_connection_b",
    ]);
    expect((await second.listAll()).map(({ agentId }) => agentId).sort()).toEqual([
      "agt_connection_a",
      "agt_connection_b",
    ]);
    expect(fixture.store.getHealth().recordCount).toBe(2);
    await Promise.all([fixture.store.close(), second.close()]);
  });

  it("rejects malformed JSON, cross-tenant parents, tool expansion, and identity relocation", async () => {
    const fixture = await createFixture();
    const freeText = record("agt_free_text", "tenant-a", {
      purpose: "Read the first report line.\nReturn a concise summary.",
      classification: { family: "analysis", domain: "General Analysis", subclass: "Report Reader" },
    });
    await fixture.store.upsert(freeText);
    expect(await fixture.store.get(freeText.agentId, "tenant-a")).toEqual(freeText);
    const parent = record("agt_strict_parent", "tenant-a", {
      requestedTools: ["file_read"],
      grantedTools: ["file_read"],
      expiresAt: "2026-08-30T04:00:00.000Z",
    });
    await fixture.store.upsert(parent);

    await expect(fixture.store.upsert({ ...record("agt_extra", "tenant-a"), extra: true } as any))
      .rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    let getterInvoked = false;
    const accessorRecord = record("agt_accessor", "tenant-a") as any;
    Object.defineProperty(accessorRecord, "name", {
      enumerable: true,
      get() {
        getterInvoked = true;
        return "accessor";
      },
    });
    await expect(fixture.store.upsert(accessorRecord))
      .rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    expect(getterInvoked).toBe(false);
    await expect(fixture.store.upsert(record("agt_missing_parent", "tenant-a", {
      parentAgentId: "agt_absent",
      generationDepth: 1,
    }))).rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    await expect(fixture.store.upsert(record("agt_cross_tenant_child", "tenant-b", {
      parentAgentId: parent.agentId,
      generationDepth: 1,
    }))).rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    await expect(fixture.store.upsert(record("agt_expanding_child", "tenant-a", {
      parentAgentId: parent.agentId,
      generationDepth: 1,
      requestedTools: ["file_read", "web_search"],
      grantedTools: ["file_read"],
    }))).rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    await expect(fixture.store.upsert({ ...parent, tenantId: "tenant-b" }))
      .rejects.toMatchObject({ name: "GovernanceAgentRegistryCorrupt" });
    expect((await fixture.store.listAll()).map(({ agentId }) => agentId)).toEqual([
      freeText.agentId,
      parent.agentId,
    ]);
    await fixture.store.close();
  });

  it("fails closed on host, migration, logical-row, and hard-link mismatches", async () => {
    const hostFixture = await createFixture();
    await hostFixture.store.close();
    expect(() => createStore(hostFixture.dbPath, "host-b")).toThrowError(
      expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_HOST_MISMATCH" }),
    );

    const migrationFixture = await createFixture();
    await migrationFixture.store.close();
    mutateDatabase(migrationFixture.dbPath, `
      UPDATE schema_migrations SET checksum = '${"0".repeat(64)}' WHERE version = 1
    `);
    expect(() => createStore(migrationFixture.dbPath, "host-a")).toThrowError(
      expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_MIGRATION_MISMATCH" }),
    );

    const rowFixture = await createFixture();
    await rowFixture.store.upsert(record("agt_corrupt_json", "tenant-a"));
    await rowFixture.store.close();
    mutateDatabase(rowFixture.dbPath, `
      UPDATE agent_registry_records SET record_json = '{}'
      WHERE agent_id = 'agt_corrupt_json'
    `);
    expect(() => createStore(rowFixture.dbPath, "host-a")).toThrowError(
      expect.objectContaining({ name: "GovernanceAgentRegistryCorrupt" }),
    );

    const linkFixture = await createFixture();
    await linkFixture.store.close();
    await link(linkFixture.dbPath, join(linkFixture.root, "registry-hardlink.sqlite"));
    expect(() => createStore(linkFixture.dbPath, "host-a")).toThrowError(
      expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_CONFIGURATION_INVALID" }),
    );
  });

  it("rejects a linked database parent before creating SQLite or WAL files", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-registry-sqlite-parent-link-"));
    roots.push(root);
    const physical = join(root, "physical");
    const linked = join(root, "linked");
    await mkdir(physical);
    await symlink(physical, linked, process.platform === "win32" ? "junction" : "dir");
    expect(() => createStore(join(linked, "registry.sqlite"), "host-a")).toThrowError(
      expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_CONFIGURATION_INVALID" }),
    );
    expect(await readdir(physical)).toEqual([]);
  });
});

async function createFixture(): Promise<{
  root: string;
  dbPath: string;
  store: SqliteAgentRegistryStore;
}> {
  const root = await mkdtemp(join(tmpdir(), "agent-registry-sqlite-"));
  roots.push(root);
  const dbPath = join(root, "agent-registry.sqlite");
  return { root, dbPath, store: createStore(dbPath, "host-a") };
}

function createStore(
  dbPath: string,
  hostId: string,
  options: Partial<Omit<SqliteAgentRegistryStoreOptions, "sqlitePath" | "hostId" | "hmacSecret">> = {},
): SqliteAgentRegistryStore {
  return createSqliteAgentRegistryStore({
    sqlitePath: dbPath,
    hostId,
    hmacSecret: HMAC_SECRET,
    now: () => NOW,
    ...options,
  });
}

function record(
  agentId: string,
  tenantId: string,
  overrides: Partial<AgentRegistryRecord> = {},
): AgentRegistryRecord {
  return {
    agentId,
    name: agentId,
    purpose: "SQLite Agent registry fixture",
    tenantId,
    ownerUserId: `${tenantId}-owner`,
    createdBy: `${tenantId}-owner`,
    parentAgentId: null,
    generationDepth: 0,
    classification: { family: "analysis", domain: "general", subclass: "reader" },
    traits: ["read_only"],
    riskLevel: "low",
    requestedTools: ["file_read"],
    grantedTools: ["file_read"],
    policyHash: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    createdAt: NOW,
    expiresAt: "2026-08-30T02:00:00.000Z",
    ...overrides,
  };
}

function mutateDatabase(dbPath: string, sql: string): void {
  const db = new DatabaseSync(dbPath);
  try { db.exec(sql); }
  finally { db.close(); }
}
