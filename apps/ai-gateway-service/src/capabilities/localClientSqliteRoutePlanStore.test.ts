import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hashLocalClientRoutePlanInput,
  type CreateLocalClientRoutePlanRequest,
  type LocalClientRoutePlan,
  type VerifiedLocalClientRoutePlanTarget,
} from "./localClientRoutePlanStore.ts";
import {
  LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES,
  LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION,
  LocalClientSqliteRoutePlanStore,
  type LocalClientSqliteRoutePlanStoreOptions,
} from "./localClientSqliteRoutePlanStore.ts";

const BASE_TIME = Date.parse("2026-08-28T03:00:00.000Z");
const HOST_ID = "fixture-host-01-stable-identity";

describe("local client SQLite route plan store", () => {
  let rootDir: string;
  let sqlitePath: string;
  let now: number;
  const stores: LocalClientSqliteRoutePlanStore[] = [];

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "gateway-route-plans-sqlite-"));
    sqlitePath = join(rootDir, "route-plans.sqlite");
    now = BASE_TIME;
  });

  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.close().catch(() => {})));
    await rm(rootDir, { recursive: true, force: true });
  });

  function createStore(overrides: Partial<LocalClientSqliteRoutePlanStoreOptions> = {}) {
    const store = new LocalClientSqliteRoutePlanStore({
      sqlitePath,
      hostId: HOST_ID,
      ttlMs: 1_000,
      maxEntries: 16,
      maxInputBytes: 4_096,
      busyTimeoutMs: 2_000,
      now: () => now,
      ...overrides,
    });
    stores.push(store);
    return store;
  }

  it("uses WAL durability without persisting raw input and exposes honest single-host boundaries", async () => {
    const secretInput = "raw-input-never-enters-sqlite";
    const input = { z: 2, a: secretInput };
    const store = createStore();
    const plan = await store.create(request({ input }));

    expect(plan.boundaries).toEqual(LOCAL_CLIENT_SQLITE_ROUTE_PLAN_BOUNDARIES);
    expect(plan.inputSha256).toBe(hashLocalClientRoutePlanInput(input, 4_096));
    expect(plan).not.toHaveProperty("input");
    expect(store.status).toMatchObject({
      storageMode: "single-host-sqlite",
      durable: true,
      distributed: false,
      singleHost: true,
      crossHostSupported: false,
      grantsApproval: false,
      providesExternalEffectFence: false,
      journalMode: "wal",
      synchronous: "full",
      schemaVersion: 1,
    });
    const verifiedInput = await store.verifyInput(reference(plan), input);
    expect(verifiedInput).toEqual(input);
    expect(verifiedInput).not.toBe(input);
    expect(Object.isFrozen(verifiedInput)).toBe(true);
    await expect(store.verifyInput(reference(plan), { a: "different", z: 2 })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID",
    });
    const { planId, ...unsigned } = plan;
    expect(planId).toBe(sha256(canonicalJson(unsigned)));

    await store.close();
    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      expect((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toBe("wal");
      expect((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version)
        .toBe(LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_VERSION);
      const row = db.prepare(`
        SELECT plan_json, input_sha256, record_digest FROM local_client_route_plans
      `).get() as Record<string, unknown>;
      expect(String(row.plan_json)).not.toContain(secretInput);
      expect(row.input_sha256).toBe(plan.inputSha256);
      expect(row.record_digest).toMatch(/^[a-f0-9]{64}$/u);
    } finally {
      db.close();
    }
    for (const suffix of ["", "-wal", "-shm"]) {
      const path = `${sqlitePath}${suffix}`;
      if (await exists(path)) expect((await readFile(path)).includes(Buffer.from(secretInput))).toBe(false);
    }
  });

  it("recovers an immutable plan after close and process-style reopen", async () => {
    const first = createStore();
    const created = await first.create(request());
    await first.close();

    const reopened = createStore();
    const recovered = await reopened.get(reference(created));

    expect(recovered).toEqual(created);
    expect(Object.isFrozen(recovered)).toBe(true);
    expect(Object.isFrozen(recovered.boundaries)).toBe(true);
  });

  it("atomically permits exactly one consume across two independent instances", async () => {
    const first = createStore();
    const second = createStore();
    const plan = await first.create(request());

    const outcomes = await Promise.allSettled([
      first.consume(reference(plan)),
      second.consume(reference(plan)),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejection = outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult;
    expect(rejection.reason).toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
      statusCode: 409,
    });
    await expect(first.get(reference(plan))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
    });

    await first.close();
    await second.close();
    const reopened = createStore();
    await expect(reopened.consume(reference(plan))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
    });
  });

  it("keeps consumed tombstones at capacity until exact TTL expiry", async () => {
    const store = createStore({ ttlMs: 100, maxEntries: 1 });
    const first = await store.create(request({ actionId: "first_action" }));
    await store.consume(reference(first));

    await expect(store.create(request({ actionId: "second_action" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_CAPACITY_REACHED",
    });
    now += 100;
    await expect(store.get(reference(first))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED",
      statusCode: 410,
    });
    await expect(store.create(request({ actionId: "second_action" }))).resolves.toMatchObject({
      actionId: "second_action",
    });
  });

  it("fails closed across tenant, subject, and tampered plan references", async () => {
    const store = createStore();
    const plan = await store.create(request());

    await expect(store.get(reference(plan, { tenantId: "tenant-b" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    });
    await expect(store.consume(reference(plan, { subjectId: "subject-b" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    });
    const tamperedId = `${plan.planId.slice(0, -1)}${plan.planId.endsWith("0") ? "1" : "0"}`;
    await expect(store.get(reference(plan, { planId: tamperedId }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    });
    await expect(store.get(reference(plan))).resolves.toEqual(plan);
  });

  it("is deterministic for canonical input and binds revision, input, and policy", async () => {
    const store = createStore();
    const first = await store.create(request({ input: { z: 2, a: [true, null, 1] } }));
    const reordered = await store.create(request({ input: { a: [true, null, 1], z: 2 } }));
    const revision = await store.create(request({ target: target({ revision: 8 }) }));
    const input = await store.create(request({ input: { different: true } }));
    const policy = await store.create(request({ policyVersion: "policy-v2" }));

    expect(reordered.planId).toBe(first.planId);
    expect(revision.planId).not.toBe(first.planId);
    expect(input.planId).not.toBe(first.planId);
    expect(policy.planId).not.toBe(first.planId);
  });

  it("detects persisted row tampering during reopen and does not return the record", async () => {
    const store = createStore();
    const plan = await store.create(request());
    await store.close();
    const db = new DatabaseSync(sqlitePath);
    try {
      db.prepare(`
        UPDATE local_client_route_plans SET tenant_id = 'tenant-tampered' WHERE plan_id = ?
      `).run(plan.planId);
    } finally {
      db.close();
    }

    expect(() => createStore()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_INTEGRITY_INVALID",
    }));
  });

  it("detects malformed canonical plan JSON during reopen", async () => {
    const store = createStore();
    const plan = await store.create(request());
    await store.close();
    const db = new DatabaseSync(sqlitePath);
    try {
      db.prepare("UPDATE local_client_route_plans SET plan_json = '{' WHERE plan_id = ?").run(plan.planId);
    } finally {
      db.close();
    }

    expect(() => createStore()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_INTEGRITY_INVALID",
    }));
  });

  it("refuses a different host binding or persistence configuration", async () => {
    const store = createStore();
    await store.create(request());

    expect(() => createStore({ hostId: "fixture-host-02-different-identity" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_HOST_MISMATCH" }),
    );
    expect(() => createStore({ ttlMs: 2_000 })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CONFIGURATION_INVALID" }),
    );
  });

  it("uses persisted global clock state to reject rollback from another instance", async () => {
    const first = createStore();
    await first.create(request());
    now += 10;
    const second = createStore();
    await second.get(reference(await first.create(request({ actionId: "clock_anchor" }))));
    now -= 1;

    await expect(first.create(request({ actionId: "rolled_back" }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ROUTE_PLAN_CLOCK_INVALID",
    });
  });

  it("rejects incompatible schema versions, in-memory paths, and use after close", async () => {
    expect(() => new LocalClientSqliteRoutePlanStore({
      sqlitePath: ":memory:",
      hostId: HOST_ID,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CONFIGURATION_INVALID",
    }));

    const store = createStore();
    await store.create(request());
    await store.close();
    await expect(store.get({ tenantId: "tenant-a", subjectId: "subject-a", planId: "a".repeat(64) }))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_CLOSED" });

    const db = new DatabaseSync(sqlitePath);
    try { db.exec("PRAGMA user_version = 99"); } finally { db.close(); }
    expect(() => createStore()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_SQLITE_ROUTE_PLAN_SCHEMA_INCOMPATIBLE",
    }));
  });
});

function target(overrides: Partial<VerifiedLocalClientRoutePlanTarget> = {}): VerifiedLocalClientRoutePlanTarget {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: "verified.local-client",
    revision: 7,
    state: "verified",
    trustDecision: "verified",
    adapter: { id: "test.local-client-adapter", type: "test", version: "1.2.3" },
    capabilityIds: ["local_inspection"],
    ...overrides,
  };
}

function request(overrides: Partial<CreateLocalClientRoutePlanRequest> = {}): CreateLocalClientRoutePlanRequest {
  return {
    tenantId: "tenant-a",
    subjectId: "subject-a",
    target: target(),
    capabilityId: "local_inspection",
    actionId: "inspect",
    input: { label: "preview", sequence: 7 },
    policyVersion: "policy-v1",
    ...overrides,
  };
}

function reference(plan: LocalClientRoutePlan, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: plan.tenantId,
    subjectId: plan.subjectId,
    planId: plan.planId,
    ...overrides,
  };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}
