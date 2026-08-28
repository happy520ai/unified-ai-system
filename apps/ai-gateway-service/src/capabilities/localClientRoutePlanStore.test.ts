import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES,
  LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES,
  LOCAL_CLIENT_ROUTE_PLAN_MAX_TTL_MS,
  LOCAL_CLIENT_ROUTE_PLAN_VERSION,
  LocalClientRoutePlanStore,
  type CreateLocalClientRoutePlanRequest,
  type LocalClientRoutePlan,
  type VerifiedLocalClientRoutePlanTarget,
} from "./localClientRoutePlanStore.ts";

const FIXED_NOW = Date.parse("2026-08-28T01:02:03.000Z");

function target(overrides: Partial<VerifiedLocalClientRoutePlanTarget> = {}): VerifiedLocalClientRoutePlanTarget {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: "verified.local-client",
    revision: 7,
    state: "verified",
    trustDecision: "verified",
    adapter: {
      id: "test.local-client-adapter",
      type: "test",
      version: "1.2.3",
    },
    capabilityIds: ["local_inspection", "local_search"],
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
    policyVersion: "local-client-policy-v3",
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

describe("local client route plan store", () => {
  it("creates an immutable hash-only preview plan from versioned canonical JSON", () => {
    const secret = "raw-input-must-not-be-stored-or-echoed";
    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW, ttlMs: 30_000 });
    const plan = store.create(request({ input: { z: 2, a: secret } }));
    const { planId, ...unsignedPlan } = plan;

    expect(plan).toMatchObject({
      planVersion: LOCAL_CLIENT_ROUTE_PLAN_VERSION,
      tenantId: "tenant-a",
      subjectId: "subject-a",
      clientId: "verified.local-client",
      clientRevision: 7,
      clientState: "verified",
      clientTrustDecision: "verified",
      adapterId: "test.local-client-adapter",
      adapterType: "test",
      adapterVersion: "1.2.3",
      capabilityId: "local_inspection",
      actionId: "inspect",
      policyVersion: "local-client-policy-v3",
      createdAt: "2026-08-28T01:02:03.000Z",
      expiresAt: "2026-08-28T01:02:33.000Z",
      boundaries: LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES,
    });
    expect(plan.inputSha256).toBe(createHash("sha256")
      .update(`{"a":${JSON.stringify(secret)},"z":2}`)
      .digest("hex"));
    expect(plan.planId).toBe(createHash("sha256").update(canonicalJson(unsignedPlan)).digest("hex"));
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.boundaries)).toBe(true);
    expect(plan).not.toHaveProperty("input");
    expect(JSON.stringify(plan)).not.toContain(secret);
    expect(store.status).toMatchObject({
      storageMode: "single-process-memory",
      durable: false,
      distributed: false,
      previewOnly: true,
      grantsApproval: false,
      providesExternalEffectFence: false,
      oneTimeConsume: true,
    });
  });

  it("is deterministic for equivalent canonical input and binds every routing decision field", () => {
    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW });
    const first = store.create(request({ input: { z: 2, a: [true, null, 1] } }));
    const reordered = store.create(request({ input: { a: [true, null, 1], z: 2 } }));

    expect(reordered).toBe(first);
    expect(store.create(request({ target: target({ revision: 8 }) })).planId).not.toBe(first.planId);
    expect(store.create(request({ input: { label: "different", sequence: 7 } })).planId).not.toBe(first.planId);
    expect(store.create(request({ policyVersion: "local-client-policy-v4" })).planId).not.toBe(first.planId);
    expect(store.create(request({ actionId: "inspect_v2" })).planId).not.toBe(first.planId);
    expect(store.create(request({
      target: target({
        adapter: { id: "test.local-client-adapter", type: "test", version: "1.2.4" },
      }),
    })).planId).not.toBe(first.planId);
  });

  it("requires the exact tenant and subject and rejects a tampered plan id without consuming it", () => {
    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW });
    const plan = store.create(request());

    expect(store.get(reference(plan))).toBe(plan);
    expect(() => store.get(reference(plan, { tenantId: "tenant-b" }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
      statusCode: 404,
    }));
    expect(() => store.consume(reference(plan, { subjectId: "subject-b" }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    }));
    const tamperedPlanId = `${plan.planId.slice(0, -1)}${plan.planId.endsWith("0") ? "1" : "0"}`;
    expect(() => store.get(reference(plan, { planId: tamperedPlanId }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    }));
    expect(store.consume(reference(plan))).toBe(plan);
  });

  it("rejects mutation and extra caller-supplied plan fields", () => {
    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW });
    const plan = store.create(request());

    expect(() => {
      (plan as { clientId: string }).clientId = "tampered-client";
    }).toThrow(TypeError);
    expect(() => store.get({
      ...reference(plan),
      input: { injected: true },
    } as never)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_REQUEST_INVALID",
    }));
    expect(store.get(reference(plan))).toBe(plan);
  });

  it("consumes a plan exactly once and keeps a tombstone until expiry", () => {
    let now = FIXED_NOW;
    const store = new LocalClientRoutePlanStore({ now: () => now, ttlMs: 1_000 });
    const plan = store.create(request());

    expect(store.consume(reference(plan))).toBe(plan);
    expect(() => store.consume(reference(plan))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
      statusCode: 409,
    }));
    expect(() => store.get(reference(plan))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
    }));
    expect(() => store.create(request())).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
    }));

    now += 1_000;
    expect(() => store.get(reference(plan))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED",
      statusCode: 410,
    }));
  });

  it("expires at the exact TTL boundary and fails closed if its wall clock moves backwards", () => {
    let now = FIXED_NOW;
    const store = new LocalClientRoutePlanStore({ now: () => now, ttlMs: 100 });
    const plan = store.create(request());

    now += 99;
    expect(store.get(reference(plan))).toBe(plan);
    now -= 1;
    expect(() => store.get(reference(plan))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_CLOCK_INVALID",
      statusCode: 503,
    }));

    now = FIXED_NOW + 100;
    expect(() => store.consume(reference(plan))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED",
    }));
  });

  it("rejects at capacity and only reclaims entries after their TTL", () => {
    let now = FIXED_NOW;
    const store = new LocalClientRoutePlanStore({ now: () => now, ttlMs: 10, maxEntries: 2 });
    store.create(request({ actionId: "inspect_one" }));
    store.create(request({ actionId: "inspect_two" }));

    expect(() => store.create(request({ actionId: "inspect_three" }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_CAPACITY_REACHED",
      retryable: true,
      statusCode: 503,
    }));
    now += 10;
    expect(store.create(request({ actionId: "inspect_three" }))).toMatchObject({ actionId: "inspect_three" });
  });

  it("requires a verified revision and an exact declared capability", () => {
    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW });
    const unverified = target({
      state: "declared" as "verified",
      trustDecision: "declared" as "verified",
    });
    expect(() => store.create(request({ target: unverified }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_TARGET_UNVERIFIED",
      statusCode: 403,
    }));
    expect(() => store.create(request({ target: target({ revision: 0 }) }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_REQUEST_INVALID",
    }));
    expect(() => store.create(request({
      target: target({
        adapter: { id: "test.local-client-adapter", type: "test", version: `${"1".repeat(65)}.0.0` },
      }),
    }))).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ROUTE_PLAN_REQUEST_INVALID",
    }));
    expect(() => store.create(request({ capabilityId: "undeclared_capability" }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_CAPABILITY_MISMATCH" }),
    );
  });

  it("bounds configuration, identities, policy strings, and canonical input", () => {
    expect(() => new LocalClientRoutePlanStore({
      ttlMs: LOCAL_CLIENT_ROUTE_PLAN_MAX_TTL_MS + 1,
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_CONFIGURATION_INVALID" }));
    expect(() => new LocalClientRoutePlanStore({
      maxEntries: LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES + 1,
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_CONFIGURATION_INVALID" }));
    expect(() => new LocalClientRoutePlanStore({ unknown: true } as never)).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_CONFIGURATION_INVALID" }),
    );

    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW, maxInputBytes: 32 });
    expect(() => store.create(request({ tenantId: "t".repeat(129) }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_IDENTITY_REQUIRED" }),
    );
    expect(() => store.create(request({ policyVersion: "p".repeat(129) }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_REQUEST_INVALID" }),
    );
    expect(() => store.create(request({ input: { value: "x".repeat(30) } }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_TOO_LARGE", statusCode: 413 }),
    );
    expect(() => store.create(request({ input: { value: Number.NaN } }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID" }),
    );
    expect(() => store.create(request({ input: { value: 1n } }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID" }),
    );
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => store.create(request({ input: cyclic }))).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID" }),
    );
  });

  it("verifies input through the scoped stored plan and returns a frozen canonical clone", () => {
    const store = new LocalClientRoutePlanStore({ now: () => FIXED_NOW });
    const original = { sequence: 7, label: "preview" };
    const plan = store.create(request({ input: original }));
    const scopedReference = {
      tenantId: plan.tenantId,
      subjectId: plan.subjectId,
      planId: plan.planId,
    };

    const verified = store.verifyInput(scopedReference, { label: "preview", sequence: 7 });

    expect(verified).toEqual(original);
    expect(verified).not.toBe(original);
    expect(Object.isFrozen(verified)).toBe(true);
    expect(() => store.verifyInput(scopedReference, { label: "changed", sequence: 7 }))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID" }));
    expect(() => store.verifyInput({ ...scopedReference, subjectId: "subject-b" }, original))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE" }));
    expect(() => store.verifyInput(scopedReference, { nested: { unsafe: true } }))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID" }));
  });
});
