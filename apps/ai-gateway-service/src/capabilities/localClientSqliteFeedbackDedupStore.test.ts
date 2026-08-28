import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_FEEDBACK_AGGREGATE_DELTA_VERSION,
  LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_BOUNDARIES,
  LocalClientSqliteFeedbackDedupStore,
  type LocalClientFeedbackClaimReference,
  type LocalClientFeedbackDedupEvent,
  type LocalClientFeedbackDeliveryClaim,
  type LocalClientSqliteFeedbackDedupStoreOptions,
} from "./localClientSqliteFeedbackDedupStore.ts";

const HOST_ID = "fixture-feedback-host-01";
const NAMESPACE = "fixture-feedback-dedup";
const INTEGRITY_KEY = Buffer.alloc(32, 0x42);

describe("LocalClientSqliteFeedbackDedupStore", () => {
  let root = "";
  let sqlitePath = "";
  let now = 1_900_000_000_000;
  let stores: LocalClientSqliteFeedbackDedupStore[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-feedback-dedup-"));
    sqlitePath = join(root, "feedback.sqlite");
    now = 1_900_000_000_000;
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) await store.close();
    await rm(root, { recursive: true, force: true });
  });

  function createStore(
    overrides: Partial<LocalClientSqliteFeedbackDedupStoreOptions> = {},
  ): LocalClientSqliteFeedbackDedupStore {
    const store = new LocalClientSqliteFeedbackDedupStore({
      sqlitePath,
      hostId: HOST_ID,
      integrityKey: INTEGRITY_KEY,
      namespace: NAMESPACE,
      ttlMs: 1_000,
      leaseTtlMs: 100,
      maxEvents: 4,
      busyTimeoutMs: 1_000,
      now: () => now,
      ...overrides,
    });
    stores.push(store);
    return store;
  }

  function feedback(
    overrides: Partial<LocalClientFeedbackDedupEvent> = {},
  ): LocalClientFeedbackDedupEvent {
    return {
      tenantId: "tenant-sensitive-alpha",
      clientId: "client-sensitive-editor",
      eventId: "event-sensitive-0001",
      taskId: "task-sensitive-0001",
      outcome: "success",
      latencyMs: 125,
      capabilities: ["browser.tabs", "editor.open"],
      observedAt: new Date(now - 10).toISOString(),
      ...overrides,
    };
  }

  it("publishes a redacted WAL/FULL/defensive leased-delivery boundary", async () => {
    const store = createStore();
    expect(store.status).toMatchObject({
      ...LOCAL_CLIENT_SQLITE_FEEDBACK_DEDUP_BOUNDARIES,
      available: true,
      journalMode: "wal",
      synchronous: "full",
      defensive: true,
      deliveryMode: "exclusive-leased-acknowledged",
      rawLeaseTokenPersisted: false,
      monotonicFencing: true,
      aggregateMutationPerformed: false,
      routingDecisionPerformed: false,
      ttlMs: 1_000,
      leaseTtlMs: 100,
    });
    const serialized = JSON.stringify(store.status);
    expect(serialized).not.toContain(sqlitePath);
    expect(serialized).not.toContain(HOST_ID);
    expect(serialized).not.toContain(NAMESPACE);
    expect(serialized).not.toContain(INTEGRITY_KEY.toString("hex"));
    await expect(store.checkHealth()).resolves.toMatchObject({
      activeEvents: 0,
      pendingEvents: 0,
      appliedEvents: 0,
      activeLeases: 0,
    });

    const db = new DatabaseSync(sqlitePath);
    try {
      expect(String((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toLowerCase())
        .toBe("wal");
      expect(Number((db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous)).toBe(2);
    } finally {
      db.close();
    }
  });

  it("keeps simple admit as a non-persisting, non-delivery preview", async () => {
    const store = createStore();
    const preview = await store.admit(feedback());
    expect(preview).toMatchObject({
      success: true,
      preview: true,
      persisted: false,
      deliveryClaimed: false,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_PREVIEWED",
      aggregateDelta: null,
    });
    expect(preview.eventFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    await expect(store.checkHealth()).resolves.toMatchObject({ activeEvents: 0 });
  });

  it("atomically gives one of two instances the aggregate delta", async () => {
    const first = createStore();
    const second = createStore();
    const input = feedback();
    const results = await Promise.all([
      first.admitAndClaim(input),
      second.admitAndClaim({ ...input, capabilities: [...input.capabilities].reverse() }),
    ]);
    const claimed = results.filter(isClaimedDelivery);
    const waiting = results.filter((result) => result.state === "pending");
    expect(claimed).toHaveLength(1);
    expect(waiting).toHaveLength(1);
    expect(claimed[0]!.aggregateDelta).toMatchObject({
      deltaVersion: LOCAL_CLIENT_FEEDBACK_AGGREGATE_DELTA_VERSION,
      apply: true,
      attemptDelta: 1,
      successDelta: 1,
      failureDelta: 0,
      reliabilitySample: 1,
    });
    expect(waiting[0]).toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_IN_PROGRESS",
      aggregateDelta: null,
    });
    expect(waiting[0]!.eventFingerprint).toBe(claimed[0]!.eventFingerprint);
    await expect(first.checkHealth()).resolves.toMatchObject({
      activeEvents: 1,
      pendingEvents: 1,
      activeLeases: 1,
    });
  });

  it("releases after downstream failure and immediately redelivers the same delta", async () => {
    const store = createStore();
    const initial = await store.admitAndClaim(feedback({ outcome: "timeout", latencyMs: 900 }));
    if (!isClaimedDelivery(initial)) throw new Error("fixture did not acquire delivery");
    const initialReference = claimReference(initial);
    await expect(store.releaseClaim(initialReference)).resolves.toMatchObject({
      released: true,
      code: "LOCAL_CLIENT_FEEDBACK_CLAIM_RELEASED",
      fencingToken: initial.lease.fencingToken,
    });

    const reclaimed = await store.admitAndClaim(feedback({ outcome: "timeout", latencyMs: 900 }));
    expect(reclaimed).toMatchObject({
      admitted: false,
      reclaimed: true,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_RECLAIMED",
      aggregateDelta: initial.aggregateDelta,
    });
    if (!isClaimedDelivery(reclaimed)) throw new Error("fixture did not reclaim delivery");
    expect(reclaimed.admissionFingerprint).toBe(initial.admissionFingerprint);
    expect(BigInt(reclaimed.lease.fencingToken)).toBeGreaterThan(BigInt(initial.lease.fencingToken));
    expect(reclaimed.lease.token).not.toBe(initial.lease.token);
    await expect(store.acknowledgeApplied(initialReference)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_CLAIM_STALE",
    });
  });

  it("recovers a crashed claimant after lease expiry and restart", async () => {
    const first = createStore({ leaseTtlMs: 100 });
    const input = feedback();
    const initial = await first.admitAndClaim(input);
    if (!isClaimedDelivery(initial)) throw new Error("fixture did not acquire delivery");
    await first.close();

    const second = createStore({ leaseTtlMs: 100 });
    await expect(second.admitAndClaim(input)).resolves.toMatchObject({
      state: "pending",
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_IN_PROGRESS",
      aggregateDelta: null,
    });
    now += 100;
    const third = createStore({ leaseTtlMs: 100 });
    const results = await Promise.all([
      second.admitAndClaim(input),
      third.admitAndClaim(input),
    ]);
    const claimed = results.filter(isClaimedDelivery);
    expect(claimed).toHaveLength(1);
    expect(results.filter((result) => result.state === "pending")).toHaveLength(1);
    expect(claimed[0]!.aggregateDelta).toEqual(initial.aggregateDelta);
    expect(BigInt(claimed[0]!.lease.fencingToken)).toBeGreaterThan(BigInt(initial.lease.fencingToken));
  });

  it("rejects stale fences and makes acknowledgement idempotent for the owner", async () => {
    const store = createStore();
    const initial = await store.admitAndClaim(feedback());
    if (!isClaimedDelivery(initial)) throw new Error("fixture did not acquire delivery");
    await store.releaseClaim(claimReference(initial));
    const reclaimed = await store.admitAndClaim(feedback());
    if (!isClaimedDelivery(reclaimed)) throw new Error("fixture did not reclaim delivery");

    await expect(store.acknowledgeApplied({
      ...claimReference(reclaimed),
      fencingToken: initial.lease.fencingToken,
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_FEEDBACK_CLAIM_STALE" });
    await expect(store.acknowledgeApplied(claimReference(initial))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_CLAIM_STALE",
    });

    const reference = claimReference(reclaimed);
    await expect(store.acknowledgeApplied(reference)).resolves.toMatchObject({
      acknowledged: true,
      alreadyApplied: false,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_APPLIED",
      fencingToken: reclaimed.lease.fencingToken,
    });
    await expect(store.acknowledgeApplied(reference)).resolves.toMatchObject({
      acknowledged: true,
      alreadyApplied: true,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_ALREADY_APPLIED",
    });
  });

  it("returns applied replay without another aggregate delta", async () => {
    const store = createStore();
    const input = feedback();
    const claimed = await store.admitAndClaim(input);
    if (!isClaimedDelivery(claimed)) throw new Error("fixture did not acquire delivery");
    await store.acknowledgeApplied(claimReference(claimed));
    const replay = await store.admitAndClaim({
      ...input,
      capabilities: [...input.capabilities].reverse(),
    });
    expect(replay).toMatchObject({
      state: "applied",
      admitted: false,
      reclaimed: false,
      replayed: true,
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_APPLIED_REPLAY",
      aggregateDelta: null,
    });
    expect(replay.admissionFingerprint).toBe(claimed.admissionFingerprint);
    await expect(store.checkHealth()).resolves.toMatchObject({
      activeEvents: 1,
      pendingEvents: 0,
      appliedEvents: 1,
      activeLeases: 0,
    });
  });

  it("preserves conflict semantics in pending and applied states", async () => {
    const store = createStore();
    const input = feedback();
    const claimed = await store.admitAndClaim(input);
    if (!isClaimedDelivery(claimed)) throw new Error("fixture did not acquire delivery");
    await expect(store.admitAndClaim({ ...input, latencyMs: 126 })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_CONFLICT",
      category: "conflict",
      statusCode: 409,
    });
    await store.acknowledgeApplied(claimReference(claimed));
    await expect(store.admitAndClaim({ ...input, taskId: "another-task" })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_EVENT_CONFLICT",
    });
    await expect(store.admitAndClaim({ ...input, clientId: "another-client" })).resolves.toMatchObject({
      state: "claimed",
      admitted: true,
    });
  });

  it("persists enough hashed state to reconstruct a delta without raw values", async () => {
    const first = createStore();
    const input = feedback({ outcome: "error", latencyMs: 321 });
    const initial = await first.admitAndClaim(input);
    if (!isClaimedDelivery(initial)) throw new Error("fixture did not acquire delivery");
    const leaseToken = initial.lease.token;
    await first.close();

    now += 100;
    const restarted = createStore();
    const reclaimed = await restarted.admitAndClaim(input);
    expect(reclaimed).toMatchObject({
      state: "claimed",
      reclaimed: true,
      aggregateDelta: initial.aggregateDelta,
    });
    await restarted.close();

    const persistedBytes = await readAllDatabaseBytes(root);
    for (const forbidden of [
      input.tenantId,
      input.clientId,
      input.eventId,
      input.taskId,
      ...input.capabilities,
      leaseToken,
      HOST_ID,
      NAMESPACE,
      INTEGRITY_KEY.toString("hex"),
    ]) expect(persistedBytes).not.toContain(forbidden);

    const db = new DatabaseSync(sqlitePath);
    try {
      const row = db.prepare(`
        SELECT event_key_hmac, content_fingerprint, tenant_hmac, client_hmac,
               event_id_hmac, task_hmac, capabilities_hmac_json,
               lease_token_digest, lease_fencing_token
        FROM local_client_feedback_dedup_events
      `).get() as Record<string, unknown>;
      for (const field of [
        "event_key_hmac",
        "content_fingerprint",
        "tenant_hmac",
        "client_hmac",
        "event_id_hmac",
        "task_hmac",
        "lease_token_digest",
      ]) expect(row[field]).toMatch(/^[a-f0-9]{64}$/u);
      expect(row.lease_fencing_token).toMatch(/^[1-9][0-9]*$/u);
      expect(JSON.parse(String(row.capabilities_hmac_json))).toEqual([
        expect.stringMatching(/^[a-f0-9]{64}$/u),
        expect.stringMatching(/^[a-f0-9]{64}$/u),
      ]);
    } finally {
      db.close();
    }
  });

  it("retains pending delivery beyond tombstone TTL and bounds applied capacity", async () => {
    const store = createStore({ ttlMs: 100, leaseTtlMs: 1_000, maxEvents: 1 });
    const first = feedback();
    const second = feedback({ eventId: "event-sensitive-0002", taskId: "task-sensitive-0002" });
    const claimed = await store.admitAndClaim(first);
    if (!isClaimedDelivery(claimed)) throw new Error("fixture did not acquire delivery");

    now += 100;
    await expect(store.admitAndClaim(first)).resolves.toMatchObject({
      state: "pending",
      aggregateDelta: null,
    });
    await expect(store.admitAndClaim(second)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CAPACITY",
      statusCode: 429,
      retryable: true,
    });

    await store.acknowledgeApplied(claimReference(claimed));
    now += 99;
    await expect(store.admitAndClaim(second)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CAPACITY",
    });
    now += 1;
    await expect(store.admitAndClaim(second)).resolves.toMatchObject({ admitted: true, state: "claimed" });
  });

  it("persists the global clock and monotonic fencing across instances", async () => {
    const first = createStore();
    const second = createStore();
    const input = feedback();
    const claimed = await first.admitAndClaim(input);
    if (!isClaimedDelivery(claimed)) throw new Error("fixture did not acquire delivery");
    await first.releaseClaim(claimReference(claimed));
    now += 10;
    const reclaimed = await second.admitAndClaim(input);
    if (!isClaimedDelivery(reclaimed)) throw new Error("fixture did not reclaim delivery");
    expect(BigInt(reclaimed.lease.fencingToken)).toBeGreaterThan(BigInt(claimed.lease.fencingToken));
    now -= 1;
    await expect(first.releaseClaim(claimReference(reclaimed))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CLOCK_INVALID",
    });
  });

  it("binds persistence to the exact host, namespace, key, and lease configuration", async () => {
    const store = createStore();
    await store.close();
    expect(() => createStore({ hostId: "fixture-feedback-host-02" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_FEEDBACK_DEDUP_HOST_MISMATCH" }),
    );
    expect(() => createStore({ namespace: "another-feedback-namespace" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CONFIGURATION_INVALID" }),
    );
    expect(() => createStore({ integrityKey: Buffer.alloc(32, 0x24) })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_FEEDBACK_DEDUP_KEY_MISMATCH" }),
    );
    expect(() => createStore({ leaseTtlMs: 101 })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CONFIGURATION_INVALID" }),
    );
  });

  it("detects HMAC-protected delivery row tampering", async () => {
    const store = createStore();
    await store.admitAndClaim(feedback());
    await store.close();
    const db = new DatabaseSync(sqlitePath);
    try {
      db.prepare(`
        UPDATE local_client_feedback_dedup_events
        SET lease_fencing_token = '999'
      `).run();
    } finally {
      db.close();
    }
    expect(() => createStore()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_INTEGRITY_INVALID",
    }));
  });

  it("detects metadata HMAC tampering and incompatible schemas", async () => {
    const metadataPath = join(root, "metadata.sqlite");
    const metadataStore = createStore({ sqlitePath: metadataPath });
    await metadataStore.close();
    const metadataDb = new DatabaseSync(metadataPath);
    try {
      metadataDb.prepare(`
        UPDATE local_client_feedback_dedup_metadata
        SET last_fencing_token = '99'
      `).run();
    } finally {
      metadataDb.close();
    }
    expect(() => createStore({ sqlitePath: metadataPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_INTEGRITY_INVALID",
    }));

    const schemaPath = join(root, "schema.sqlite");
    const schemaStore = createStore({ sqlitePath: schemaPath });
    await schemaStore.close();
    const schemaDb = new DatabaseSync(schemaPath);
    try { schemaDb.exec("PRAGMA user_version = 99"); } finally { schemaDb.close(); }
    expect(() => createStore({ sqlitePath: schemaPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_SCHEMA_INCOMPATIBLE",
    }));
  });

  it("strictly rejects raw fields, malformed claims, and use after close", async () => {
    const store = createStore();
    await expect(store.admitAndClaim({ ...feedback(), error: "raw-secret-error" } as never))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_FEEDBACK_EVENT_INVALID" });
    await expect(store.admitAndClaim({ ...feedback(), taskInput: "raw-sensitive-input" } as never))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_FEEDBACK_EVENT_INVALID" });
    await expect(store.admitAndClaim({
      ...feedback(),
      capabilities: ["editor.open", "editor.open"],
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_FEEDBACK_EVENT_INVALID" });
    await expect(store.acknowledgeApplied({} as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_CLAIM_INVALID",
    });

    await store.close();
    await expect(store.admitAndClaim(feedback())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CLOSED",
    });
    expect(INTEGRITY_KEY.equals(Buffer.alloc(32, 0x42))).toBe(true);
  });
});

function isClaimedDelivery(
  result: LocalClientFeedbackDeliveryClaim,
): result is Extract<LocalClientFeedbackDeliveryClaim, { state: "claimed" }> {
  return result.state === "claimed";
}

function claimReference(
  result: Extract<LocalClientFeedbackDeliveryClaim, { state: "claimed" }>,
): LocalClientFeedbackClaimReference {
  return Object.freeze({
    leaseToken: result.lease.token,
    fencingToken: result.lease.fencingToken,
    eventFingerprint: result.eventFingerprint,
    contentFingerprint: result.contentFingerprint,
  });
}

async function readAllDatabaseBytes(root: string): Promise<string> {
  const names = await readdir(root);
  const chunks: Buffer[] = [];
  for (const name of names.filter((candidate) => candidate.startsWith("feedback.sqlite"))) {
    chunks.push(await readFile(join(root, name)));
  }
  return Buffer.concat(chunks).toString("latin1");
}
