import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_BOUNDARIES,
  LocalClientSqliteExecutionClaimStore,
  type LocalClientExecutionClaimIdentity,
  type LocalClientSqliteExecutionClaimStoreOptions,
} from "./localClientSqliteExecutionClaimStore.ts";

const HOST_ID = "fixture-host-01-stable-identity";

describe("LocalClientSqliteExecutionClaimStore", () => {
  let root = "";
  let sqlitePath = "";
  let now = 1_800_000_000_000;
  let stores: LocalClientSqliteExecutionClaimStore[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-execution-claims-"));
    sqlitePath = join(root, "claims.sqlite");
    now = 1_800_000_000_000;
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) await store.close();
    await rm(root, { recursive: true, force: true });
  });

  function createStore(
    overrides: Partial<LocalClientSqliteExecutionClaimStoreOptions> = {},
  ): LocalClientSqliteExecutionClaimStore {
    const store = new LocalClientSqliteExecutionClaimStore({
      sqlitePath,
      hostId: HOST_ID,
      namespace: "fixture-local-client-execution",
      ttlMs: 1_000,
      maxClaims: 4,
      busyTimeoutMs: 1_000,
      now: () => now,
      ...overrides,
    });
    stores.push(store);
    return store;
  }

  it("publishes a redacted durable single-host boundary and healthy WAL/FULL store", async () => {
    const store = createStore();

    expect(store.status).toMatchObject({
      ...LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_BOUNDARIES,
      available: true,
      durable: true,
      distributed: false,
      singleHost: true,
      crossHostSupported: false,
      rawOwnershipTokenPersisted: false,
      rawIdentityPersisted: false,
      journalMode: "wal",
      synchronous: "full",
      clockRollbackPolicy: "fail-closed",
    });
    expect(JSON.stringify(store.status)).not.toContain(sqlitePath);
    expect(JSON.stringify(store.status)).not.toContain(HOST_ID);
    await expect(store.checkHealth()).resolves.toMatchObject({ available: true, activeClaims: 0 });

    const db = new DatabaseSync(sqlitePath);
    try {
      expect(String((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toLowerCase())
        .toBe("wal");
      expect(Number((db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous)).toBe(2);
    } finally {
      db.close();
    }
  });

  it("atomically allows one active claim across two database instances", async () => {
    const first = createStore();
    const second = createStore();

    const results = await Promise.all([
      first.issue(identity()),
      second.issue(identity()),
    ]);
    const issued = results.filter((result) => result.success);
    const rejected = results.filter((result) => !result.success);

    expect(issued).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_ALREADY_HELD",
      retryable: true,
    });
    await expect(first.checkHealth()).resolves.toMatchObject({ activeClaims: 1 });
  });

  it("accepts a bounded per-claim TTL without weakening exact request validation", async () => {
    const store = createStore({ ttlMs: 1_000 });
    const issued = await store.issue({ ...identity(), ttlMs: 50 });
    expect(issued).toMatchObject({ success: true, valid: true });
    if (!issued.success) throw new Error("fixture claim was not issued");
    expect(Date.parse(issued.expiresAt) - Date.parse(issued.record.issuedAt)).toBe(50);
    await expect(store.issue({ ...identity({ executionId: "execution-extra" }), ttlMs: 50, extra: true } as never))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID" });
  });

  it("uses monotonically increasing fences and permits takeover only after expiry", async () => {
    const first = createStore({ ttlMs: 100 });
    const second = createStore({ ttlMs: 100 });
    const initial = await first.issue(identity());
    expect(initial.success).toBe(true);
    if (!initial.success) throw new Error("fixture claim was not issued");

    now += 99;
    await expect(second.issue(identity())).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_ALREADY_HELD",
    });
    now += 1;
    const takeover = await second.issue(identity());
    expect(takeover.success).toBe(true);
    if (!takeover.success) throw new Error("fixture takeover was not issued");

    expect(BigInt(takeover.fencingToken)).toBeGreaterThan(BigInt(initial.fencingToken));
    expect(takeover.record.fenceFingerprint).not.toBe(initial.record.fenceFingerprint);
    await expect(first.validate(initial.token, identity())).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_NOT_FOUND",
    });
  });

  it("recovers ownership after restart without persisting raw tokens or identities", async () => {
    const store = createStore();
    const claimIdentity = identity({
      executionId: "execution-sensitive-value",
      tenantId: "tenant-sensitive-value",
      subjectId: "subject-sensitive-value",
    });
    const issued = await store.issue(claimIdentity);
    expect(issued.success).toBe(true);
    if (!issued.success) throw new Error("fixture claim was not issued");
    await store.close();

    const restarted = createStore();
    await expect(restarted.validate(issued.token, {
      ...claimIdentity,
      fencingToken: issued.fencingToken,
    })).resolves.toMatchObject({
      success: true,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_VALID",
      record: { renewalCount: 0 },
    });
    now += 10;
    await expect(restarted.renew(issued.token, claimIdentity, 500)).resolves.toMatchObject({
      success: true,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_RENEWED",
      renewalCount: 1,
    });
    await restarted.close();

    const databaseBytes = (await readFile(sqlitePath)).toString("latin1");
    expect(databaseBytes).not.toContain(issued.token);
    expect(databaseBytes).not.toContain(claimIdentity.executionId);
    expect(databaseBytes).not.toContain(claimIdentity.tenantId);
    expect(databaseBytes).not.toContain(claimIdentity.subjectId);

    const db = new DatabaseSync(sqlitePath);
    try {
      const persisted = db.prepare(`
        SELECT token_digest, token_fingerprint, execution_sha256,
               tenant_sha256, subject_sha256
        FROM local_client_execution_claims
      `).get() as Record<string, unknown>;
      expect(JSON.stringify(persisted)).not.toContain(issued.token);
      expect(persisted.token_digest).toMatch(/^[a-f0-9]{64}$/u);
      expect(persisted.token_fingerprint).toBe(String(persisted.token_digest).slice(0, 16));
    } finally {
      db.close();
    }
  });

  it("never reuses a fencing token after release and restart", async () => {
    const first = createStore();
    const initial = await first.issue(identity({ executionId: "execution-before-restart" }));
    expect(initial.success).toBe(true);
    if (!initial.success) throw new Error("fixture claim was not issued");
    await first.release(initial.token, {
      ...identity({ executionId: "execution-before-restart" }),
      fencingToken: initial.fencingToken,
    });
    await first.close();

    const restarted = createStore();
    const next = await restarted.issue(identity({ executionId: "execution-after-restart" }));
    expect(next.success).toBe(true);
    if (!next.success) throw new Error("fixture claim was not issued after restart");
    expect(BigInt(next.fencingToken)).toBeGreaterThan(BigInt(initial.fencingToken));
  });

  it("validates bearer ownership, exact identity, and the current fencing token", async () => {
    const store = createStore();
    const claimIdentity = identity();
    const issued = await store.issue(claimIdentity);
    expect(issued.success).toBe(true);
    if (!issued.success) throw new Error("fixture claim was not issued");

    await expect(store.validate("forged-token", claimIdentity)).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_NOT_FOUND",
    });
    await expect(store.validate("", claimIdentity)).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_TOKEN_INVALID",
    });
    await expect(store.validate(issued.token, {
      ...claimIdentity,
      subjectId: "another-subject",
    })).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_IDENTITY_MISMATCH",
    });
    await expect(store.validate(issued.token, {
      ...claimIdentity,
      fencingToken: String(BigInt(issued.fencingToken) + 1n),
    })).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_FENCE_MISMATCH",
    });
    await expect(store.assertActive(issued.token, {
      ...claimIdentity,
      fencingToken: issued.fencingToken,
    })).resolves.toMatchObject({ fenceFingerprint: issued.record.fenceFingerprint });
  });

  it("renews and releases with compare-and-delete ownership semantics", async () => {
    const store = createStore();
    const claimIdentity = identity();
    const issued = await store.issue(claimIdentity);
    expect(issued.success).toBe(true);
    if (!issued.success) throw new Error("fixture claim was not issued");

    now += 100;
    const renewed = await store.renew(issued.token, {
      ...claimIdentity,
      fencingToken: issued.fencingToken,
    }, 500);
    expect(renewed).toMatchObject({
      success: true,
      renewalCount: 1,
      record: { fencingToken: issued.fencingToken },
    });
    const released = await store.release(issued.token, {
      ...claimIdentity,
      fencingToken: issued.fencingToken,
    });
    expect(released).toMatchObject({ success: true, code: "LOCAL_CLIENT_EXECUTION_CLAIM_RELEASED" });
    await expect(store.validate(issued.token, claimIdentity)).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_NOT_FOUND",
    });
  });

  it("enforces bounded capacity and reclaims expired rows", async () => {
    const store = createStore({ ttlMs: 100, maxClaims: 1 });
    await expect(store.issue(identity({ executionId: "execution-1" }))).resolves.toMatchObject({
      success: true,
    });
    await expect(store.issue(identity({ executionId: "execution-2" }))).resolves.toMatchObject({
      success: false,
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_CAPACITY",
    });

    now += 100;
    await expect(store.issue(identity({ executionId: "execution-2" }))).resolves.toMatchObject({
      success: true,
    });
    await expect(store.checkHealth()).resolves.toMatchObject({ activeClaims: 1, maxClaims: 1 });
  });

  it("persists global clock state and fails closed on rollback across instances", async () => {
    const first = createStore();
    const second = createStore();
    const issued = await first.issue(identity());
    expect(issued.success).toBe(true);
    if (!issued.success) throw new Error("fixture claim was not issued");
    now += 10;
    await second.validate(issued.token, identity());
    now -= 1;

    await expect(first.issue(identity({ executionId: "rolled-back-execution" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CLOCK_INVALID",
    });
  });

  it("binds persistence to an exact host and configuration", () => {
    createStore();
    expect(() => createStore({ hostId: "fixture-host-02-different-identity" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_HOST_MISMATCH" }),
    );
    expect(() => createStore({ maxClaims: 5 })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID" }),
    );
    expect(() => createStore({ namespace: "different-namespace" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID" }),
    );
  });

  it("detects claim-row corruption before reopening", async () => {
    const store = createStore();
    const issued = await store.issue(identity());
    expect(issued.success).toBe(true);
    await store.close();

    const db = new DatabaseSync(sqlitePath);
    try {
      db.prepare("UPDATE local_client_execution_claims SET expires_at_ms = expires_at_ms + 1").run();
    } finally {
      db.close();
    }

    expect(() => createStore()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_INTEGRITY_INVALID",
    }));
  });

  it("detects metadata corruption and incompatible schemas", async () => {
    const store = createStore();
    await store.close();
    const db = new DatabaseSync(sqlitePath);
    try {
      db.prepare(`
        UPDATE local_client_execution_claim_metadata
        SET last_fencing_token = '99'
      `).run();
    } finally {
      db.close();
    }
    expect(() => createStore()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_INTEGRITY_INVALID",
    }));

    const secondPath = join(root, "schema.sqlite");
    const schemaStore = createStore({ sqlitePath: secondPath });
    await schemaStore.close();
    const schemaDb = new DatabaseSync(secondPath);
    try { schemaDb.exec("PRAGMA user_version = 99"); } finally { schemaDb.close(); }
    expect(() => createStore({ sqlitePath: secondPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_SCHEMA_INCOMPATIBLE",
    }));
  });

  it("adapts directly to the orchestrator fence port without exposing the bearer token", async () => {
    const store = createStore();
    const controller = new AbortController();
    const claimIdentity = identity();
    const acquireFence = store.acquireFence;
    const fence = await acquireFence({
      executionId: claimIdentity.executionId,
      plan: { planId: claimIdentity.planId },
      identity: { tenantId: claimIdentity.tenantId, subjectId: claimIdentity.subjectId },
      signal: controller.signal,
    });

    expect(fence.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(fence)).not.toContain("token");
    await expect(fence.assertActive("reserve")).resolves.toMatchObject({
      fenceFingerprint: fence.fingerprint,
    });
    await expect(store.acquireFence({
      executionId: claimIdentity.executionId,
      plan: { planId: claimIdentity.planId },
      identity: { tenantId: claimIdentity.tenantId, subjectId: claimIdentity.subjectId },
      signal: controller.signal,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_NOT_ACTIVE",
      reasonCode: "LOCAL_CLIENT_EXECUTION_CLAIM_ALREADY_HELD",
    });
    await fence.release?.();
    await expect(fence.assertActive("commit")).rejects.toMatchObject({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_NOT_ACTIVE",
    });
  });

  it("fails before persistence when acquisition is already aborted and rejects use after close", async () => {
    const store = createStore();
    const controller = new AbortController();
    controller.abort();
    const claimIdentity = identity();

    await expect(store.acquireFence({
      executionId: claimIdentity.executionId,
      plan: { planId: claimIdentity.planId },
      identity: { tenantId: claimIdentity.tenantId, subjectId: claimIdentity.subjectId },
      signal: controller.signal,
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_ABORTED" });
    await expect(store.checkHealth()).resolves.toMatchObject({ activeClaims: 0 });

    await store.close();
    expect(store.status.available).toBe(false);
    await expect(store.issue(claimIdentity)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CLOSED",
    });
  });

  it("rejects unsafe paths and unknown configuration fields", async () => {
    expect(() => new LocalClientSqliteExecutionClaimStore({
      sqlitePath: ":memory:",
      hostId: HOST_ID,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID",
    }));
    expect(() => new LocalClientSqliteExecutionClaimStore({
      sqlitePath: join(root, "unknown.sqlite"),
      hostId: HOST_ID,
      extra: true,
    } as LocalClientSqliteExecutionClaimStoreOptions)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_EXECUTION_CLAIM_CONFIGURATION_INVALID",
    }));
    await expect(access(sqlitePath)).rejects.toBeTruthy();
  });
});

function identity(
  overrides: Partial<LocalClientExecutionClaimIdentity> = {},
): LocalClientExecutionClaimIdentity {
  return {
    executionId: "execution-01",
    planId: "a".repeat(64),
    tenantId: "tenant-a",
    subjectId: "subject-a",
    ...overrides,
  };
}
