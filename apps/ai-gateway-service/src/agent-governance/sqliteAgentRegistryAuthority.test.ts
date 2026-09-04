import { copyFile, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { AgentRegistryRecord } from "@unified-ai-system/shared-contracts";
import { afterEach, describe, expect, it } from "vitest";
import { SQLITE_AGENT_REGISTRY_MIGRATIONS } from "./sqliteAgentRegistryMigrations.ts";
import {
  createSqliteAgentRegistryStore,
  type SqliteAgentRegistryStore,
  type SqliteAgentRegistryStoreOptions,
  verifySqliteAgentRegistryAuthoritySnapshot,
} from "./sqliteAgentRegistryStore.ts";

const roots: string[] = [];
const NOW = "2026-08-30T00:00:00.000Z";
const HMAC_SECRET = "sqlite-authority-focused-test-secret-2026-08-30";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50,
  })));
});

describe("SQLite Agent registry authority checkpoint", () => {
  it("restarts with the same verified authority without exposing installation identity", async () => {
    const fixture = await createFixture();
    const binding = fixture.store.getAuthorityBinding();
    await fixture.store.upsert(record("agt_restart"));
    expect(fixture.store.getHealth()).toMatchObject({
      status: "ready",
      checkpointVerified: true,
      authorityRevision: 1,
      authorityInstallationExposed: false,
      recoveryStatus: "exact",
      databaseSnapshotRollbackProtected: true,
      wholeDirectoryRollbackProtected: false,
    });
    await fixture.store.close();

    const reopened = createStore(fixture.dbPath);
    expect(reopened.getAuthorityBinding()).toBe(binding);
    expect(reopened.getAuthorityProtocol()).toBe("sqlite-checkpoint-v1");
    expect(reopened.getHealth()).toMatchObject({
      status: "ready",
      checkpointVerified: true,
      authorityRevision: 1,
      recoveryStatus: "exact",
    });
    expect(await reopened.getUnscoped("agt_restart")).toEqual(record("agt_restart"));
    const checkpoint = JSON.parse(await readFile(fixture.checkpointPath, "utf8")) as Record<string, unknown>;
    expect(checkpoint).not.toHaveProperty("hmacSecret");
    expect(checkpoint).toMatchObject({
      version: "sqlite-agent-registry-checkpoint-v1",
      backendId: "sqlite-agent-registry-v1",
      revision: 1,
      recordCount: 1,
    });
    await reopened.close();

    const databaseBefore = await readFile(fixture.dbPath);
    const checkpointBefore = await readFile(fixture.checkpointPath);
    expect(verifySqliteAgentRegistryAuthoritySnapshot({
      sqlitePath: fixture.dbPath,
      checkpointPath: fixture.checkpointPath,
      hostId: "host-a",
      hmacSecret: HMAC_SECRET,
    })).toMatchObject({
      authorityProtocol: "sqlite-checkpoint-v1",
      authorityBinding: binding,
      revision: 1,
      recordCount: 1,
      recordsDigestSha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      checkpointVerified: true,
      pathExposed: false,
      authorityInstallationExposed: false,
    });
    expect(await readFile(fixture.dbPath)).toEqual(databaseBefore);
    expect(await readFile(fixture.checkpointPath)).toEqual(checkpointBefore);
  });

  it("recovers an empty authority bootstrap interrupted after the DB commit", async () => {
    const root = await newRoot("sqlite-authority-bootstrap-crash-");
    const dbPath = join(root, "agent-registry.sqlite");
    expect(() => createStore(dbPath, {
      faultInjector(stage) {
        if (stage === "after-authority-bootstrap-db") throw new Error("simulated bootstrap crash");
      },
    })).toThrowError(expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_UNAVAILABLE" }));

    const recovered = createStore(dbPath);
    expect(recovered.getHealth()).toMatchObject({
      checkpointVerified: true,
      authorityRevision: 0,
      recoveryStatus: "rolled-forward",
    });
    await recovered.close();
  });

  it("rolls a verified checkpoint forward after a write commits but checkpoint publication crashes", async () => {
    const fixture = await createFixture({
      faultInjector(stage) {
        if (stage === "after-db-commit") throw new Error("simulated post-commit crash");
      },
    });
    await expect(fixture.store.upsert(record("agt_db_committed"))).rejects.toMatchObject({
      code: "AGENT_REGISTRY_SQLITE_WRITE_FAILED",
    });
    await fixture.store.close();

    const staleCheckpoint = await readFile(fixture.checkpointPath);
    expect(() => verifySqliteAgentRegistryAuthoritySnapshot({
      sqlitePath: fixture.dbPath,
      checkpointPath: fixture.checkpointPath,
      hostId: "host-a",
      hmacSecret: HMAC_SECRET,
    })).toThrowError(expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_ROLLBACK_DETECTED" }));
    expect(await readFile(fixture.checkpointPath)).toEqual(staleCheckpoint);

    const recovered = createStore(fixture.dbPath);
    expect(recovered.getHealth()).toMatchObject({
      checkpointVerified: true,
      authorityRevision: 1,
      recoveryStatus: "rolled-forward",
    });
    expect(await recovered.getUnscoped("agt_db_committed")).toEqual(record("agt_db_committed"));
    await recovered.close();
  });

  it("rolls an older signed checkpoint through a continuous multi-event DB suffix", async () => {
    const fixture = await createFixture();
    const genesisCheckpoint = join(fixture.root, "genesis-checkpoint.json");
    await copyFile(fixture.checkpointPath, genesisCheckpoint);
    await fixture.store.upsert(record("agt_suffix_one"));
    await fixture.store.upsert(record("agt_suffix_two"));
    await fixture.store.close();
    await copyFile(genesisCheckpoint, fixture.checkpointPath);

    const recovered = createStore(fixture.dbPath);
    expect(recovered.getHealth()).toMatchObject({
      checkpointVerified: true,
      authorityRevision: 2,
      recordCount: 2,
      recoveryStatus: "rolled-forward",
    });
    expect((await recovered.listAll()).map(({ agentId }) => agentId).sort())
      .toEqual(["agt_suffix_one", "agt_suffix_two"]);
    await recovered.close();
  });

  it("does not duplicate a committed event when the caller crashes after checkpoint publication", async () => {
    const fixture = await createFixture({
      faultInjector(stage) {
        if (stage === "after-checkpoint") throw new Error("simulated post-checkpoint crash");
      },
    });
    await expect(fixture.store.upsert(record("agt_checkpoint_committed"))).rejects.toMatchObject({
      code: "AGENT_REGISTRY_SQLITE_WRITE_FAILED",
    });
    await fixture.store.close();

    const recovered = createStore(fixture.dbPath);
    expect(recovered.getHealth()).toMatchObject({ authorityRevision: 1, recoveryStatus: "exact" });
    const raw = new DatabaseSync(fixture.dbPath, { readOnly: true });
    try {
      expect((raw.prepare("SELECT COUNT(*) AS count FROM agent_registry_authority_events").get() as any).count)
        .toBe(1);
    } finally {
      raw.close();
    }
    await recovered.close();
  });

  it("rejects a DB-only rollback when the signed checkpoint is newer", async () => {
    const fixture = await createFixture();
    await fixture.store.close();
    const oldSnapshot = join(fixture.root, "old-snapshot.sqlite");
    await copyFile(fixture.dbPath, oldSnapshot);

    const writer = createStore(fixture.dbPath);
    await writer.upsert(record("agt_newer_than_snapshot"));
    await writer.close();
    await copyFile(oldSnapshot, fixture.dbPath);

    expect(() => createStore(fixture.dbPath)).toThrowError(expect.objectContaining({
      code: "AGENT_REGISTRY_SQLITE_ROLLBACK_DETECTED",
    }));
  });

  it("rejects a valid checkpoint transplanted from another installation", async () => {
    const root = await newRoot("sqlite-authority-transplant-");
    const firstDir = join(root, "first");
    const secondDir = join(root, "second");
    await Promise.all([mkdir(firstDir), mkdir(secondDir)]);
    const firstPath = join(firstDir, "agent-registry.sqlite");
    const secondPath = join(secondDir, "agent-registry.sqlite");
    const first = createStore(firstPath);
    const second = createStore(secondPath);
    await Promise.all([first.close(), second.close()]);

    await copyFile(checkpointPath(firstPath), checkpointPath(secondPath));
    expect(() => createStore(secondPath)).toThrowError(expect.objectContaining({
      code: "AGENT_REGISTRY_SQLITE_CHECKPOINT_INVALID",
    }));
  });

  it("requires explicit authorization for a complete directory move and rebinds once", async () => {
    const root = await newRoot("sqlite-authority-directory-move-");
    const oldDir = join(root, "old");
    const nextDir = join(root, "next");
    await mkdir(oldDir);
    const oldPath = join(oldDir, "agent-registry.sqlite");
    const original = createStore(oldPath);
    const originalBinding = original.getAuthorityBinding();
    await original.upsert(record("agt_moved"));
    await original.close();
    await rename(oldDir, nextDir);
    const nextPath = join(nextDir, "agent-registry.sqlite");

    expect(() => createStore(nextPath)).toThrowError(expect.objectContaining({
      code: "AGENT_REGISTRY_SQLITE_DIRECTORY_MIGRATION_REQUIRED",
    }));
    const migrated = createStore(nextPath, { allowDirectoryMigrationFromPath: oldPath });
    expect(migrated.getAuthorityBinding()).not.toBe(originalBinding);
    expect(migrated.getHealth()).toMatchObject({
      checkpointVerified: true,
      authorityRevision: 2,
      recoveryStatus: "directory-migrated",
    });
    expect(await migrated.getUnscoped("agt_moved")).toEqual(record("agt_moved"));
    await migrated.close();

    const restarted = createStore(nextPath);
    expect(restarted.getHealth()).toMatchObject({ authorityRevision: 2, recoveryStatus: "exact" });
    await restarted.close();
  });

  it("does not treat a copied live authority as a complete directory migration", async () => {
    const root = await newRoot("sqlite-authority-directory-clone-");
    const oldDir = join(root, "old");
    const cloneDir = join(root, "clone");
    await mkdir(oldDir);
    const oldPath = join(oldDir, "agent-registry.sqlite");
    const original = createStore(oldPath);
    await original.upsert(record("agt_not_cloned"));
    await original.close();
    await cp(oldDir, cloneDir, { recursive: true });
    const clonePath = join(cloneDir, "agent-registry.sqlite");

    expect(() => createStore(clonePath, { allowDirectoryMigrationFromPath: oldPath }))
      .toThrowError(expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_DIRECTORY_MIGRATION_REQUIRED" }));
    const stillOriginal = createStore(oldPath);
    expect(await stillOriginal.getUnscoped("agt_not_cloned")).toEqual(record("agt_not_cloned"));
    await stillOriginal.close();
  });

  it("recovers a directory move interrupted between its DB commit and checkpoint publication", async () => {
    const root = await newRoot("sqlite-authority-directory-crash-");
    const oldDir = join(root, "old");
    const nextDir = join(root, "next");
    await mkdir(oldDir);
    const oldPath = join(oldDir, "agent-registry.sqlite");
    const original = createStore(oldPath);
    await original.upsert(record("agt_move_crash"));
    await original.close();
    await rename(oldDir, nextDir);
    const nextPath = join(nextDir, "agent-registry.sqlite");

    expect(() => createStore(nextPath, {
      allowDirectoryMigrationFromPath: oldPath,
      faultInjector(stage) {
        if (stage === "after-db-commit") throw new Error("simulated directory move crash");
      },
    })).toThrowError(expect.objectContaining({ code: "AGENT_REGISTRY_SQLITE_UNAVAILABLE" }));

    const recovered = createStore(nextPath, { allowDirectoryMigrationFromPath: oldPath });
    expect(recovered.getHealth()).toMatchObject({ authorityRevision: 2, recoveryStatus: "rolled-forward" });
    expect(await recovered.getUnscoped("agt_move_crash")).toEqual(record("agt_move_crash"));
    await recovered.close();
  });

  it("never mints a trust root over legacy rows in-place", async () => {
    const root = await newRoot("sqlite-authority-legacy-");
    const dbPath = join(root, "agent-registry.sqlite");
    createLegacyDatabaseWithRecord(dbPath, record("agt_legacy"));

    expect(() => createStore(dbPath)).toThrowError(expect.objectContaining({
      code: "AGENT_REGISTRY_SQLITE_LEGACY_AUTHORITY_MIGRATION_REQUIRED",
    }));
    expect(() => createStore(dbPath)).toThrowError(expect.objectContaining({
      code: "AGENT_REGISTRY_SQLITE_LEGACY_AUTHORITY_MIGRATION_REQUIRED",
    }));
    const raw = new DatabaseSync(dbPath, { readOnly: true });
    try {
      expect((raw.prepare("SELECT record_hmac FROM agent_registry_records").get() as any).record_hmac).toBeNull();
      expect((raw.prepare("SELECT COUNT(*) AS count FROM agent_registry_authority").get() as any).count).toBe(0);
    } finally {
      raw.close();
    }
  });

  it("rejects an authenticated authority whose event chain was altered", async () => {
    const fixture = await createFixture();
    await fixture.store.upsert(record("agt_event_chain"));
    await fixture.store.close();
    const db = new DatabaseSync(fixture.dbPath);
    try {
      db.prepare("UPDATE agent_registry_authority_events SET batch_hash = ? WHERE revision = 1")
        .run("0".repeat(64));
    } finally {
      db.close();
    }
    expect(() => createStore(fixture.dbPath)).toThrowError(expect.objectContaining({
      code: "AGENT_REGISTRY_SQLITE_CORRUPT",
    }));
  });
});

async function createFixture(
  options: Partial<Omit<SqliteAgentRegistryStoreOptions, "sqlitePath" | "hostId" | "hmacSecret">> = {},
): Promise<{ root: string; dbPath: string; checkpointPath: string; store: SqliteAgentRegistryStore }> {
  const root = await newRoot("sqlite-authority-");
  const dbPath = join(root, "agent-registry.sqlite");
  return { root, dbPath, checkpointPath: checkpointPath(dbPath), store: createStore(dbPath, options) };
}

async function newRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function checkpointPath(dbPath: string): string {
  return join(dirname(dbPath), "agent-registry.checkpoint.json");
}

function createStore(
  dbPath: string,
  options: Partial<Omit<SqliteAgentRegistryStoreOptions, "sqlitePath" | "hostId" | "hmacSecret">> = {},
): SqliteAgentRegistryStore {
  return createSqliteAgentRegistryStore({
    sqlitePath: dbPath,
    hostId: "host-a",
    hmacSecret: HMAC_SECRET,
    now: () => NOW,
    ...options,
  });
}

function createLegacyDatabaseWithRecord(dbPath: string, value: AgentRegistryRecord): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY CHECK (version > 0),
        name TEXT NOT NULL,
        checksum TEXT NOT NULL CHECK (length(checksum) = 64),
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    for (const migration of SQLITE_AGENT_REGISTRY_MIGRATIONS.slice(0, 2)) {
      db.exec(migration.sql);
      db.prepare(`
        INSERT INTO schema_migrations (version, name, checksum, applied_at)
        VALUES (?, ?, ?, ?)
      `).run(migration.version, migration.name, migration.checksum, NOW);
    }
    db.exec("PRAGMA user_version = 2");
    db.prepare(`
      INSERT INTO agent_registry_records (
        agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
        status, policy_hash, created_at, expires_at, record_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.agentId,
      value.tenantId,
      value.ownerUserId,
      value.parentAgentId,
      value.generationDepth,
      value.status,
      value.policyHash,
      value.createdAt,
      value.expiresAt,
      JSON.stringify(value),
      NOW,
    );
  } finally {
    db.close();
  }
}

function record(agentId: string): AgentRegistryRecord {
  return {
    agentId,
    name: agentId,
    purpose: "SQLite authority fixture",
    tenantId: "tenant-a",
    ownerUserId: "owner-a",
    createdBy: "owner-a",
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
  };
}
