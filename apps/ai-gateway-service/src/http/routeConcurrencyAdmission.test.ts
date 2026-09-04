import { describe, expect, it } from "vitest";
import { createRouteConcurrencyAdmission } from "./routeConcurrencyAdmission.ts";

describe("route concurrency admission", () => {
  it("enforces both global and per-tenant limits and releases idempotently", () => {
    const admission = createRouteConcurrencyAdmission({
      rawConfig: JSON.stringify({
        "/agent-exec/run": { maxGlobal: 3, maxPerTenant: 2 },
      }),
    });
    const first = admission.tryAcquire("/agent-exec/run", "tenant-a");
    const second = admission.tryAcquire("/agent-exec/run", "tenant-a");
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(admission.tryAcquire("/agent-exec/run", "tenant-a")).toMatchObject({
      allowed: false,
      activeTenant: 2,
    });
    const third = admission.tryAcquire("/agent-exec/run", "tenant-b");
    expect(third.allowed).toBe(true);
    expect(admission.tryAcquire("/agent-exec/run", "tenant-c")).toMatchObject({
      allowed: false,
      activeGlobal: 3,
    });
    if (!first.allowed || !second.allowed || !third.allowed) throw new Error("Expected admitted leases.");
    first.release();
    first.release();
    expect(admission.tryAcquire("/agent-exec/run", "tenant-a").allowed).toBe(true);
    second.release();
    third.release();
  });

  it("keeps ordinary routes unbounded and rejects unsafe configuration", () => {
    const admission = createRouteConcurrencyAdmission();
    expect(admission.tryAcquire("/health", "tenant-a").allowed).toBe(true);
    expect(() => createRouteConcurrencyAdmission({
      rawConfig: { "/forge/orchestrate": { maxGlobal: 1, maxPerTenant: 2 } },
    })).toThrow(expect.objectContaining({ code: "ROUTE_CONCURRENCY_CONFIGURATION_INVALID" }));
  });

  it("shares one bounded bucket across trailing-slash route aliases", () => {
    const admission = createRouteConcurrencyAdmission({
      rawConfig: { "/forge/orchestrate": { maxGlobal: 1, maxPerTenant: 1 } },
    });
    const first = admission.tryAcquire("/forge/orchestrate", "tenant-a");
    expect(first.allowed).toBe(true);
    expect(admission.tryAcquire("/forge/orchestrate/", "tenant-a")).toMatchObject({
      allowed: false,
      pattern: "/forge/orchestrate",
      activeGlobal: 1,
    });
    if (!first.allowed) throw new Error("Expected the canonical route to be admitted.");
    first.release();

    expect(() => createRouteConcurrencyAdmission({
      rawConfig: {
        "/forge/orchestrate": { maxGlobal: 1, maxPerTenant: 1 },
        "/forge/orchestrate/": { maxGlobal: 2, maxPerTenant: 1 },
      },
    })).toThrow(expect.objectContaining({ code: "ROUTE_CONCURRENCY_CONFIGURATION_INVALID" }));
  });

  it("shares Agent and policy REST aliases with their compatibility concurrency buckets", () => {
    const admission = createRouteConcurrencyAdmission({
      rawConfig: {
        "/agent-exec/run": { maxGlobal: 1, maxPerTenant: 1 },
        "/v1/policies/activate": { maxGlobal: 1, maxPerTenant: 1 },
      },
    });
    const run = admission.tryAcquire("/v1/agents/agt_demo/run", "tenant-a");
    expect(run).toMatchObject({ allowed: true, pattern: "/agent-exec/run" });
    expect(admission.tryAcquire("/agent-exec/run", "tenant-a")).toMatchObject({
      allowed: false,
      pattern: "/agent-exec/run",
    });
    if (!run.allowed) throw new Error("Expected REST Agent run admission.");
    run.release();

    const activation = admission.tryAcquire("/v1/policies/execution-family/3/activate", "tenant-a");
    expect(activation).toMatchObject({ allowed: true, pattern: "/v1/policies/activate" });
    expect(admission.tryAcquire("/v1/policies/activate", "tenant-a")).toMatchObject({ allowed: false });
    if (!activation.allowed) throw new Error("Expected REST policy activation admission.");
    activation.release();
  });
});
