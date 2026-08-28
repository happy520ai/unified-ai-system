import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_BOUNDARIES,
  LocalClientSqliteVerificationAuthorityEpochStore,
  type LocalClientSqliteVerificationAuthorityEpochStoreOptions,
} from "./localClientSqliteVerificationAuthorityEpochStore.ts";

const HOST_ID = "fixture-authority-host-01";
const NAMESPACE = "fixture-local-client-authority";
const INTEGRITY_KEY = Buffer.from("a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c", "utf8");

describe("LocalClientSqliteVerificationAuthorityEpochStore", () => {
  let root = "";
  let sqlitePath = "";
  let stores: LocalClientSqliteVerificationAuthorityEpochStore[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-authority-epoch-"));
    sqlitePath = join(root, "authority.sqlite");
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) await store.close();
    await rm(root, { recursive: true, force: true });
  });

  function createStore(
    overrides: Partial<LocalClientSqliteVerificationAuthorityEpochStoreOptions> = {},
  ): LocalClientSqliteVerificationAuthorityEpochStore {
    const store = new LocalClientSqliteVerificationAuthorityEpochStore({
      sqlitePath,
      hostId: HOST_ID,
      integrityKey: INTEGRITY_KEY,
      namespace: NAMESPACE,
      maxCheckpoints: 4,
      busyTimeoutMs: 1_000,
      ...overrides,
    });
    stores.push(store);
    return store;
  }

  it("publishes an honest hardened, clock-independent, single-host boundary", async () => {
    const store = createStore();

    expect(store.status).toMatchObject({
      ...LOCAL_CLIENT_SQLITE_VERIFICATION_AUTHORITY_EPOCH_BOUNDARIES,
      available: true,
      durable: true,
      distributed: false,
      singleHost: true,
      clockDependent: false,
      journalMode: "wal",
      synchronous: "full",
      trustedSchema: false,
      defensive: true,
      rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back",
    });
    await expect(store.checkHealth()).resolves.toMatchObject({
      ready: false,
      initialized: false,
      recoveryRequired: false,
      currentGeneration: 0,
      checkpointCount: 0,
    });
    expect(JSON.stringify(store.status)).not.toContain(sqlitePath);
    expect(JSON.stringify(store.status)).not.toContain(HOST_ID);

    const db = new DatabaseSync(sqlitePath);
    try {
      expect(String((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toLowerCase())
        .toBe("wal");
      expect(Number((db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous))
        .toBe(2);
    } finally {
      db.close();
    }
  });

  it("reserves and finalizes monotonically, then rejects an older signed registry", async () => {
    const store = createStore();
    const firstDigest = digest("signed-registry-generation-1");
    const secondDigest = digest("signed-registry-generation-2");

    await expect(store.reserveNextGeneration(0)).resolves.toEqual({
      state: "pending",
      generation: 1,
      previousGeneration: 0,
      recoveryRequired: true,
    });
    await expect(store.finalize(1, firstDigest)).resolves.toEqual({
      state: "finalized",
      generation: 1,
      registryDigest: firstDigest,
    });
    await expect(store.assertCurrent(1, firstDigest)).resolves.toMatchObject({ generation: 1 });

    await store.reserveNextGeneration(1);
    await store.commit(2, secondDigest);
    await expect(store.assertCurrent(2, secondDigest)).resolves.toMatchObject({ generation: 2 });
    await expect(store.assertCurrent(1, firstDigest)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_ROLLBACK_DETECTED",
      category: "integrity",
    });
    await expect(store.assertCurrent(2, firstDigest)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_REGISTRY_DIGEST_MISMATCH",
    });
  });

  it("serializes generation allocation across two instances without duplicates", async () => {
    const first = createStore();
    const second = createStore();

    const attempts = await Promise.allSettled([
      first.reserveNextGeneration(0),
      second.reserveNextGeneration(0),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_RECOVERY_REQUIRED" },
    });
    await first.finalize(1, digest("concurrent-generation-1"));

    const nextAttempts = await Promise.allSettled([
      first.reserveNextGeneration(1),
      second.reserveNextGeneration(1),
    ]);
    expect(nextAttempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const pending = await second.inspect();
    expect(pending).toMatchObject({
      currentGeneration: 1,
      pendingGeneration: 2,
      recoveryRequired: true,
      checkpointCount: 2,
    });
  });

  it("survives restart and preserves the current generation and digest", async () => {
    const first = createStore();
    const registryDigest = digest("restart-registry");
    await first.reserveNextGeneration(0);
    await first.finalize(1, registryDigest);
    await first.close();

    const restarted = createStore();
    await expect(restarted.assertCurrent(1, registryDigest)).resolves.toEqual({
      state: "finalized",
      generation: 1,
      registryDigest,
    });
    await expect(restarted.readCurrent()).resolves.toMatchObject({
      initialized: true,
      ready: true,
      recoveryRequired: false,
      currentGeneration: 1,
      checkpointCount: 1,
    });
  });

  it("fails closed after a crash between epoch reservation and registry finalization", async () => {
    const first = createStore();
    const oldDigest = digest("registry-before-crash");
    const pendingDigest = digest("registry-after-atomic-replace");
    await first.reserveNextGeneration(0);
    await first.finalize(1, oldDigest);
    await first.reserveNextGeneration(1);
    await first.close();

    const restarted = createStore();
    await expect(restarted.inspect()).resolves.toMatchObject({
      ready: false,
      recoveryRequired: true,
      currentGeneration: 1,
      currentRegistryDigest: oldDigest,
      pendingGeneration: 2,
    });
    for (const [generation, registryDigest] of [[1, oldDigest], [2, pendingDigest]] as const) {
      await expect(restarted.assertCurrent(generation, registryDigest)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_RECOVERY_REQUIRED",
        recovery: {
          required: true,
          currentGeneration: 1,
          pendingGeneration: 2,
          nextAction: expect.stringContaining("verify the signed registry"),
        },
      });
    }
    await expect(restarted.reserveNextGeneration(1)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_RECOVERY_REQUIRED",
    });

    await expect(restarted.finalize(2, pendingDigest)).resolves.toMatchObject({ generation: 2 });
    await expect(restarted.assertCurrent(2, pendingDigest)).resolves.toMatchObject({ generation: 2 });
  });

  it.each([
    {
      label: "metadata",
      tamper: (db: DatabaseSync) => db.prepare(`
        UPDATE local_client_verification_authority_epoch_metadata
        SET metadata_hmac = ? WHERE singleton = 1
      `).run("0".repeat(64)),
    },
    {
      label: "checkpoint row",
      tamper: (db: DatabaseSync) => db.prepare(`
        UPDATE local_client_verification_authority_epochs
        SET registry_digest = ? WHERE generation = 1
      `).run(digest("tampered-registry")),
    },
  ])("rejects keyed $label tampering on restart", async ({ tamper }) => {
    const store = createStore();
    await store.reserveNextGeneration(0);
    await store.finalize(1, digest("untampered-registry"));
    await store.close();

    const db = new DatabaseSync(sqlitePath);
    try {
      tamper(db);
    } finally {
      db.close();
    }

    expect(() => createStore()).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_INVALID",
    }));
  });

  it("rejects reuse from another host without storing the raw host, namespace, or key", async () => {
    const store = createStore();
    await store.reserveNextGeneration(0);
    await store.finalize(1, digest("private-values-registry"));
    await store.close();

    const databaseText = (await readFile(sqlitePath)).toString("latin1");
    expect(databaseText).not.toContain(HOST_ID);
    expect(databaseText).not.toContain(NAMESPACE);
    expect(databaseText).not.toContain(INTEGRITY_KEY.toString("utf8"));

    expect(() => createStore({ hostId: "fixture-authority-host-02" })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_HOST_MISMATCH",
    }));
  });

  it("binds the integrity key and stable configuration", async () => {
    const store = createStore();
    await store.close();

    expect(() => createStore({ integrityKey: Buffer.alloc(32, 0x42) })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_KEY_MISMATCH",
    }));
    expect(() => createStore({ namespace: "another-authority-namespace" })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_CONFIG_MISMATCH",
    }));
  });

  it("keeps bounded history while retaining the current checkpoint", async () => {
    const store = createStore({ maxCheckpoints: 2 });
    for (let generation = 1; generation <= 8; generation += 1) {
      await store.reserveNextGeneration(generation - 1);
      await store.finalize(generation, digest(`bounded-registry-${generation}`));
      await expect(store.inspect()).resolves.toMatchObject({
        currentGeneration: generation,
        recoveryRequired: false,
      });
    }
    await expect(store.inspect()).resolves.toMatchObject({ checkpointCount: 2 });

    const db = new DatabaseSync(sqlitePath);
    try {
      const generations = db.prepare(`
        SELECT generation FROM local_client_verification_authority_epochs
        ORDER BY generation
      `).all().map((row) => Number((row as { generation: unknown }).generation));
      expect(generations).toEqual([7, 8]);
    } finally {
      db.close();
    }
  });

  it("validates inputs strictly and makes finalize idempotent for the exact checkpoint", async () => {
    const store = createStore();
    const registryDigest = digest("idempotent-registry");

    await expect(store.reserveNextGeneration(1)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_EXPECTED_GENERATION_MISMATCH",
    });
    await expect(store.reserveNextGeneration(-1)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_CONFIGURATION_INVALID",
    });
    await store.reserveNextGeneration(0);
    await store.finalize(1, registryDigest);
    await expect(store.finalize(1, registryDigest)).resolves.toMatchObject({ generation: 1 });
    await expect(store.finalize(1, digest("different-registry"))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_REGISTRY_DIGEST_MISMATCH",
    });
  });
});

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
