import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_BOUNDARIES,
  LocalClientSqliteExecutionFeedbackOutbox,
  type LocalClientExecutionFeedbackClaimBatchResult,
  type LocalClientExecutionFeedbackClaimReference,
  type LocalClientSqliteExecutionFeedbackOutboxOptions,
  type LocalClientVerifiedReceiptFeedbackEnvelope,
} from "./localClientSqliteExecutionFeedbackOutbox.ts";

const HOST_ID = "fixture-host-execution-feedback-01";
const KEY_BYTES = Buffer.alloc(32, 0x5a);

describe("LocalClientSqliteExecutionFeedbackOutbox", () => {
  let root = "";
  let sqlitePath = "";
  let now = 1_800_000_000_000;
  let stores: LocalClientSqliteExecutionFeedbackOutbox[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-feedback-outbox-"));
    sqlitePath = join(root, "feedback-outbox.sqlite");
    now = 1_800_000_000_000;
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) await store.close();
    await rm(root, { recursive: true, force: true });
  });

  function createStore(
    overrides: Partial<LocalClientSqliteExecutionFeedbackOutboxOptions> = {},
  ): LocalClientSqliteExecutionFeedbackOutbox {
    const key = Buffer.from(KEY_BYTES);
    const store = new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath,
      hostId: HOST_ID,
      namespace: "fixture-execution-feedback",
      integrityKey: key,
      deliveredTtlMs: 1_000,
      leaseTtlMs: 100,
      maxEvents: 8,
      maxBatchSize: 4,
      busyTimeoutMs: 1_000,
      now: () => now,
      ...overrides,
    });
    expect(key.equals(Buffer.alloc(32))).toBe(true);
    stores.push(store);
    return store;
  }

  it("publishes a redacted single-host WAL/FULL boundary and consumes the dedicated key", async () => {
    const key = Buffer.from(KEY_BYTES);
    const store = new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath,
      hostId: HOST_ID,
      namespace: "fixture-execution-feedback",
      integrityKey: key,
      deliveredTtlMs: 1_000,
      leaseTtlMs: 100,
      maxEvents: 8,
      maxBatchSize: 4,
      busyTimeoutMs: 1_000,
      now: () => now,
    });
    stores.push(store);

    expect(key.equals(Buffer.alloc(32))).toBe(true);
    const defensiveApiAvailable = typeof (DatabaseSync.prototype as unknown as {
      enableDefensive?: unknown;
    }).enableDefensive === "function";
    expect(store.status).toMatchObject({
      ...LOCAL_CLIENT_SQLITE_EXECUTION_FEEDBACK_OUTBOX_BOUNDARIES,
      available: true,
      durable: true,
      distributed: false,
      singleHost: true,
      pendingTtlApplied: false,
      deliveredRetention: "logical-ttl-with-bounded-purge",
      physicalDeletion: "best-effort-secure-delete-wal-dependent",
      capacityPolicy: "fail-closed",
      activeEventSetIntegrity: "hmac-member-xor-plus-count",
      rollbackResistant: false,
      monotonicWithinDatabaseHistory: true,
      journalMode: "wal",
      synchronous: "full",
      secureDelete: true,
      defensive: defensiveApiAvailable,
      defensiveApiAvailable,
      defensiveEnabled: defensiveApiAvailable,
    });
    expect(JSON.stringify(store.status)).not.toContain(sqlitePath);
    expect(JSON.stringify(store.status)).not.toContain(HOST_ID);
    await expect(store.checkHealth()).resolves.toMatchObject({
      totalEvents: 0,
      pendingEvents: 0,
      deliveredEvents: 0,
    });

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

  it("enables and verifies SQLite secure_delete on every store connection", () => {
    const execSpy = vi.spyOn(DatabaseSync.prototype, "exec");
    const prepareSpy = vi.spyOn(DatabaseSync.prototype, "prepare");
    try {
      const store = createStore({ sqlitePath: join(root, "secure-delete.sqlite") });
      expect(store.status.secureDelete).toBe(true);
      expect(execSpy.mock.calls.some(([sql]) => sql === "PRAGMA secure_delete = ON")).toBe(true);
      expect(prepareSpy.mock.calls.some(([sql]) => sql === "PRAGMA secure_delete")).toBe(true);
    } finally {
      execSpy.mockRestore();
      prepareSpy.mockRestore();
    }
  });

  it("keeps required persistence protections available when the optional defensive API is absent", async () => {
    const prototype = DatabaseSync.prototype as unknown as {
      enableDefensive?: (enabled: boolean) => void;
    };
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "enableDefensive");
    if (descriptor) {
      Object.defineProperty(prototype, "enableDefensive", {
        ...descriptor,
        value: undefined,
      });
    }
    try {
      const store = createStore({ sqlitePath: join(root, "without-defensive-api.sqlite") });
      expect(store.status).toMatchObject({
        available: true,
        defensiveMode: "runtime-detected-optional-hardening",
        defensive: false,
        defensiveApiAvailable: false,
        defensiveEnabled: false,
        journalMode: "wal",
        synchronous: "full",
        secureDelete: true,
      });
      await expect(store.checkHealth()).resolves.toMatchObject({ available: true });
    } finally {
      if (descriptor) Object.defineProperty(prototype, "enableDefensive", descriptor);
    }
  });

  it("idempotently enqueues one stable event and rejects content conflicts", async () => {
    const store = createStore();
    const first = await store.enqueue(envelope({ capabilities: ["tools.write", "chat.complete"] }));
    expect(first).toMatchObject({
      queued: true,
      replayed: false,
      state: "pending",
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_QUEUED",
    });
    const replay = await store.enqueue(envelope({ capabilities: ["chat.complete", "tools.write"] }));
    expect(replay).toMatchObject({
      queued: false,
      replayed: true,
      state: "pending",
      eventFingerprint: first.eventFingerprint,
      contentFingerprint: first.contentFingerprint,
    });
    await expect(store.enqueue(envelope({ latencyMs: 43 }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_EVENT_CONFLICT",
    });
    await expect(store.checkHealth()).resolves.toMatchObject({ totalEvents: 1, pendingEvents: 1 });
  });

  it("scopes stable event identity to the tenant", async () => {
    const store = createStore();
    const first = await store.enqueue(envelope({ eventId: "tenant-scoped-event", tenantId: "tenant-a" }));
    const second = await store.enqueue(envelope({ eventId: "tenant-scoped-event", tenantId: "tenant-b" }));
    expect(second).toMatchObject({ queued: true, replayed: false });
    expect(second.eventFingerprint).not.toBe(first.eventFingerprint);
    await expect(store.enqueue(envelope({
      eventId: "tenant-scoped-event",
      tenantId: "tenant-a",
      latencyMs: 99,
    }))).rejects.toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_EVENT_CONFLICT" });
    await expect(store.checkHealth()).resolves.toMatchObject({ totalEvents: 2, pendingEvents: 2 });
  });

  it("strictly rejects receipt, body, secret, failure status, and malformed envelopes", async () => {
    const store = createStore();
    for (const extra of ["receipt", "body", "secret", "error", "request"] as const) {
      await expect(store.enqueue({ ...envelope(), [extra]: "must-not-enter-outbox" } as never))
        .rejects.toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENVELOPE_INVALID" });
    }
    await expect(store.enqueue({ ...envelope(), status: "failure" } as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENVELOPE_INVALID",
    });
    await expect(store.enqueue({ ...envelope(), capabilities: [] })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENVELOPE_INVALID",
    });
    await expect(store.enqueue({ ...envelope(), capabilities: ["chat.complete", "chat.complete"] }))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_ENVELOPE_INVALID" });
    await expect(store.checkHealth()).resolves.toMatchObject({ totalEvents: 0 });
  });

  it("claims a bounded exclusive batch and acknowledges it atomically", async () => {
    const store = createStore();
    await store.enqueue(envelope({ eventId: "receipt-event-01", clientId: "client-01" }));
    await store.enqueue(envelope({ eventId: "receipt-event-02", clientId: "client-02" }));

    const claimed = await store.claimBatch({ limit: 2 });
    expect(claimed).toMatchObject({
      claimed: true,
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_CLAIMED",
    });
    expect(claimed.deliveries).toHaveLength(2);
    expect(claimed.deliveries.map((delivery) => delivery.envelope.clientId).sort())
      .toEqual(["client-01", "client-02"]);
    expect(claimed.deliveries.every((delivery) => delivery.envelope.status === "success")).toBe(true);
    await expect(store.claimBatch({ limit: 2 })).resolves.toMatchObject({ claimed: false, lease: null });

    const reference = claimReference(claimed);
    await expect(store.acknowledgeDelivered({
      ...reference,
      eventFingerprints: [reference.eventFingerprints[0]!],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_STALE" });
    const acknowledged = await store.acknowledgeDelivered(reference);
    expect(acknowledged).toMatchObject({
      acknowledged: true,
      alreadyDelivered: false,
      fencingToken: reference.fencingToken,
    });
    await expect(store.acknowledgeDelivered(reference)).resolves.toMatchObject({
      alreadyDelivered: true,
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_BATCH_ALREADY_DELIVERED",
    });
    await expect(store.checkHealth()).resolves.toMatchObject({
      pendingEvents: 0,
      deliveredEvents: 2,
    });
  });

  it("gives concurrent instances disjoint leases", async () => {
    const first = createStore();
    const second = createStore();
    for (let index = 1; index <= 4; index += 1) {
      await first.enqueue(envelope({ eventId: `concurrent-event-${index}` }));
    }
    const [left, right] = await Promise.all([
      first.claimBatch({ limit: 2 }),
      second.claimBatch({ limit: 2 }),
    ]);
    expect(left.claimed).toBe(true);
    expect(right.claimed).toBe(true);
    const leftIds = new Set(left.deliveries.map((delivery) => delivery.eventFingerprint));
    const rightIds = new Set(right.deliveries.map((delivery) => delivery.eventFingerprint));
    expect([...leftIds].filter((id) => rightIds.has(id))).toEqual([]);
    expect(left.lease?.fencingToken).not.toBe(right.lease?.fencingToken);
    await expect(first.checkHealth()).resolves.toMatchObject({ leasedEvents: 4, pendingEvents: 4 });
  });

  it("releases a batch for immediate redelivery with a strictly newer fence", async () => {
    const store = createStore();
    await store.enqueue(envelope());
    const first = await store.claimBatch({ limit: 1 });
    const firstReference = claimReference(first);
    await expect(store.releaseClaim(firstReference)).resolves.toMatchObject({ released: true });

    const second = await store.claimBatch({ limit: 1 });
    const secondReference = claimReference(second);
    expect(BigInt(secondReference.fencingToken)).toBeGreaterThan(BigInt(firstReference.fencingToken));
    expect(second.deliveries[0]?.claimCount).toBe(2);
    await expect(store.acknowledgeDelivered(firstReference)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_STALE",
    });
  });

  it("reclaims an expired lease after restart and rejects the stale owner", async () => {
    const first = createStore();
    await first.enqueue(envelope());
    const initial = await first.claimBatch({ limit: 1 });
    const staleReference = claimReference(initial);
    await first.close();

    now += 100;
    const restarted = createStore();
    const reclaimed = await restarted.claimBatch({ limit: 1 });
    const activeReference = claimReference(reclaimed);
    expect(BigInt(activeReference.fencingToken)).toBeGreaterThan(BigInt(staleReference.fencingToken));
    expect(reclaimed.deliveries[0]?.claimCount).toBe(2);
    await expect(restarted.acknowledgeDelivered(staleReference)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_CLAIM_STALE",
    });
    await expect(restarted.acknowledgeDelivered(activeReference)).resolves.toMatchObject({
      alreadyDelivered: false,
    });
  });

  it("never applies TTL to pending rows and fails closed at capacity", async () => {
    const store = createStore({
      deliveredTtlMs: 50,
      leaseTtlMs: 20,
      maxEvents: 1,
      maxBatchSize: 1,
    });
    await store.enqueue(envelope({ eventId: "pending-forever" }));
    now += 10_000;
    await expect(store.enqueue(envelope({ eventId: "capacity-blocked" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CAPACITY",
      retryable: true,
    });
    await expect(store.checkHealth()).resolves.toMatchObject({ totalEvents: 1, pendingEvents: 1 });

    const claimed = await store.claimBatch({ limit: 1 });
    await store.acknowledgeDelivered(claimReference(claimed));
    now += 50;
    await expect(store.enqueue(envelope({ eventId: "after-delivered-ttl", observedAt: new Date(now).toISOString() })))
      .resolves.toMatchObject({ queued: true });
    await expect(store.checkHealth()).resolves.toMatchObject({ totalEvents: 1, pendingEvents: 1 });
  });

  it("persists envelopes and monotonic fencing across clean restarts without raw lease tokens", async () => {
    const first = createStore();
    await first.enqueue(envelope({
      eventId: "durable-event",
      tenantId: "tenant-durable",
      subjectId: "subject-durable",
    }));
    const initial = await first.claimBatch({ limit: 1 });
    const initialReference = claimReference(initial);
    await first.releaseClaim(initialReference);
    await first.close();

    const restarted = createStore();
    const reclaimed = await restarted.claimBatch({ limit: 1 });
    expect(reclaimed.deliveries[0]?.envelope).toMatchObject({
      eventId: "durable-event",
      tenantId: "tenant-durable",
      subjectId: "subject-durable",
    });
    expect(BigInt(claimReference(reclaimed).fencingToken))
      .toBeGreaterThan(BigInt(initialReference.fencingToken));

    const bytes = (await readFile(sqlitePath)).toString("latin1");
    expect(bytes).not.toContain(initialReference.leaseToken);
    expect(bytes).not.toContain("receipt-body-must-never-persist");
  });

  it("binds the database to its host, namespace, key, and exact limits", async () => {
    const store = createStore();
    await store.close();
    expect(() => createStore({ hostId: "fixture-host-execution-feedback-02" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_HOST_MISMATCH" }),
    );
    expect(() => createStore({ namespace: "different-feedback-namespace" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE_MISMATCH" }),
    );
    const wrongKey = Buffer.alloc(32, 0x6b);
    expect(() => createStore({ integrityKey: wrongKey })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_KEY_MISMATCH" }),
    );
    expect(wrongKey.equals(Buffer.alloc(32))).toBe(true);
    expect(() => createStore({ maxEvents: 9 })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CONFIGURATION_INVALID" }),
    );
  });

  it("detects row and metadata HMAC tampering before reuse", async () => {
    const rowPath = join(root, "row.sqlite");
    const rowStore = createStore({ sqlitePath: rowPath });
    await rowStore.enqueue(envelope());
    await rowStore.close();
    const rowDb = new DatabaseSync(rowPath);
    try {
      rowDb.prepare(`
        UPDATE local_client_execution_feedback_outbox SET latency_ms = latency_ms + 1
      `).run();
    } finally {
      rowDb.close();
    }
    expect(() => createStore({ sqlitePath: rowPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    }));

    const metadataPath = join(root, "metadata.sqlite");
    const metadataStore = createStore({ sqlitePath: metadataPath });
    await metadataStore.close();
    const metadataDb = new DatabaseSync(metadataPath);
    try {
      metadataDb.prepare(`
        UPDATE local_client_execution_feedback_outbox_metadata
        SET last_fencing_token = '99'
      `).run();
    } finally {
      metadataDb.close();
    }
    expect(() => createStore({ sqlitePath: metadataPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    }));
  });

  it("detects deletion of an otherwise authenticated pending row", async () => {
    const deletionPath = join(root, "deleted-row.sqlite");
    const store = createStore({ sqlitePath: deletionPath });
    await store.enqueue(envelope({ eventId: "deleted-authenticated-event" }));
    await store.close();

    const db = new DatabaseSync(deletionPath);
    try {
      db.prepare("DELETE FROM local_client_execution_feedback_outbox").run();
    } finally {
      db.close();
    }
    expect(() => createStore({ sqlitePath: deletionPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    }));
  });

  it("marks live availability false after a runtime integrity failure", async () => {
    const runtimePath = join(root, "runtime-deleted-row.sqlite");
    const store = createStore({ sqlitePath: runtimePath });
    await store.enqueue(envelope({ eventId: "runtime-deleted-event" }));
    const db = new DatabaseSync(runtimePath);
    try {
      db.prepare("DELETE FROM local_client_execution_feedback_outbox").run();
    } finally {
      db.close();
    }

    await expect(store.checkHealth()).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    });
    expect(store.status.available).toBe(false);
  });

  it("detects replacement with an older individually valid row", async () => {
    const replacementPath = join(root, "replaced-row.sqlite");
    const store = createStore({ sqlitePath: replacementPath });
    await store.enqueue(envelope({ eventId: "replace-with-valid-old-row" }));
    const snapshotDb = new DatabaseSync(replacementPath);
    let oldLease: Record<string, string | number>;
    try {
      oldLease = snapshotDb.prepare(`
        SELECT lease_token_hmac, lease_fencing_token, lease_claimed_at_ms,
               lease_expires_at_ms, claim_count, row_hmac
        FROM local_client_execution_feedback_outbox
      `).get() as Record<string, string | number>;
    } finally {
      snapshotDb.close();
    }
    await store.claimBatch({ limit: 1 });
    await store.close();

    const db = new DatabaseSync(replacementPath);
    try {
      db.prepare(`
        UPDATE local_client_execution_feedback_outbox
        SET lease_token_hmac = ?, lease_fencing_token = ?, lease_claimed_at_ms = ?,
            lease_expires_at_ms = ?, claim_count = ?, row_hmac = ?
      `).run(
        oldLease.lease_token_hmac,
        oldLease.lease_fencing_token,
        oldLease.lease_claimed_at_ms,
        oldLease.lease_expires_at_ms,
        oldLease.claim_count,
        oldLease.row_hmac,
      );
    } finally {
      db.close();
    }
    expect(() => createStore({ sqlitePath: replacementPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    }));
  });

  it("rejects unexpected triggers before they can mutate the authenticated event set", async () => {
    const triggerPath = join(root, "trigger.sqlite");
    const store = createStore({ sqlitePath: triggerPath });
    await store.enqueue(envelope({ eventId: "trigger-seed" }));
    await store.close();
    const db = new DatabaseSync(triggerPath);
    try {
      db.exec(`
        CREATE TRIGGER delete_feedback_peer
        AFTER INSERT ON local_client_execution_feedback_outbox
        BEGIN
          DELETE FROM local_client_execution_feedback_outbox
          WHERE event_key_hmac != NEW.event_key_hmac;
        END
      `);
    } finally {
      db.close();
    }
    expect(() => createStore({ sqlitePath: triggerPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_INTEGRITY_INVALID",
    }));
  });

  it("purges delivered rows in bounded batches", async () => {
    const store = createStore({
      sqlitePath: join(root, "bounded-purge.sqlite"),
      deliveredTtlMs: 10,
      leaseTtlMs: 100,
      maxEvents: 65,
      maxBatchSize: 65,
    });
    for (let index = 0; index < 65; index += 1) {
      await store.enqueue(envelope({ eventId: `bounded-purge-${String(index).padStart(2, "0")}` }));
    }
    const claimed = await store.claimBatch({ limit: 65 });
    await store.acknowledgeDelivered(claimReference(claimed));
    now += 10;
    await expect(store.checkHealth()).resolves.toMatchObject({
      purgeBatchSize: 64,
      totalEvents: 1,
    });
    await expect(store.checkHealth()).resolves.toMatchObject({ totalEvents: 0 });
  });

  it("persists the global clock and fails closed on cross-instance rollback", async () => {
    const first = createStore();
    const second = createStore();
    await first.enqueue(envelope());
    now += 10;
    await second.checkHealth();
    now -= 1;
    await expect(first.claimBatch({ limit: 1 })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOCK_INVALID",
    });
  });

  it("rejects incompatible schemas, unsafe paths, unknown options, and use after close", async () => {
    const schemaPath = join(root, "schema.sqlite");
    const store = createStore({ sqlitePath: schemaPath });
    await store.close();
    const db = new DatabaseSync(schemaPath);
    try { db.exec("PRAGMA user_version = 99"); } finally { db.close(); }
    expect(() => createStore({ sqlitePath: schemaPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SCHEMA_INCOMPATIBLE",
    }));

    expect(() => new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath: ":memory:",
      hostId: HOST_ID,
      integrityKey: Buffer.from(KEY_BYTES),
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CONFIGURATION_INVALID",
    }));
    const rejectedKey = Buffer.from(KEY_BYTES);
    expect(() => new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath: join(root, "unknown.sqlite"),
      hostId: HOST_ID,
      integrityKey: rejectedKey,
      unknown: true,
    } as LocalClientSqliteExecutionFeedbackOutboxOptions)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CONFIGURATION_INVALID",
    }));
    expect(rejectedKey.equals(Buffer.alloc(32))).toBe(true);
    await expect(access(join(root, "unknown.sqlite"))).rejects.toBeTruthy();

    const closed = createStore({ sqlitePath: join(root, "closed.sqlite") });
    await closed.close();
    expect(closed.status).toMatchObject({ available: false, closed: true, closeFailed: false });
    await expect(closed.enqueue(envelope())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOSED",
    });
  });

  it("reports a failed close honestly and permits a close-only retry", async () => {
    const store = createStore({ sqlitePath: join(root, "close-retry.sqlite") });
    const closeSpy = vi.spyOn(DatabaseSync.prototype, "close")
      .mockImplementationOnce(() => { throw new Error("synthetic close failure"); });
    try {
      await expect(store.close()).rejects.toMatchObject({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_UNAVAILABLE",
      });
      expect(store.status).toMatchObject({ available: false, closed: false, closeFailed: true });
      await expect(store.enqueue(envelope())).rejects.toMatchObject({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_UNAVAILABLE",
      });
      await expect(store.close()).resolves.toBeUndefined();
      expect(store.status).toMatchObject({ available: false, closed: true, closeFailed: false });
    } finally {
      closeSpy.mockRestore();
    }
  });
});

function envelope(
  overrides: Partial<LocalClientVerifiedReceiptFeedbackEnvelope> = {},
): LocalClientVerifiedReceiptFeedbackEnvelope {
  return {
    eventId: "receipt-event-01",
    tenantId: "tenant-a",
    subjectId: "subject-a",
    clientId: "client-a",
    taskId: "task-a",
    capabilities: ["chat.complete"],
    status: "success",
    latencyMs: 42,
    observedAt: new Date(1_800_000_000_000).toISOString(),
    ...overrides,
  };
}

function claimReference(
  result: LocalClientExecutionFeedbackClaimBatchResult,
): LocalClientExecutionFeedbackClaimReference {
  if (!result.claimed || !result.lease) throw new Error("fixture batch was not claimed");
  return {
    leaseToken: result.lease.leaseToken,
    fencingToken: result.lease.fencingToken,
    eventFingerprints: result.lease.eventFingerprints,
  };
}
