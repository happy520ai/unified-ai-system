import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  createLocalClientVerifiedExecutionFence,
} from "./localClientVerifiedExecutionFence.ts";
import type { ResolvedVerifiedLocalClientExecutionTarget } from "./localClientExecutionOrchestrator.ts";
import type { LocalClientRoutePlan } from "./localClientRoutePlanStore.ts";

const PLAN = Object.freeze({
  planId: "a".repeat(64),
  clientId: "desktop.client",
  clientRevision: 7,
  adapterId: "loopback.adapter",
  adapterType: "loopback_http",
  adapterVersion: "1.0.0",
  capabilityId: "local_application",
} as LocalClientRoutePlan);
const IDENTITY = Object.freeze({ tenantId: "Tenant-A", subjectId: "oidc:user@example.com" });

function identityFingerprint(value: string) {
  return `idfp_${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function target(
  overrides: Partial<ResolvedVerifiedLocalClientExecutionTarget> = {},
): ResolvedVerifiedLocalClientExecutionTarget {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: PLAN.clientId,
    revision: PLAN.clientRevision,
    state: "verified",
    trustDecision: "verified",
    adapter: { id: PLAN.adapterId, type: PLAN.adapterType, version: PLAN.adapterVersion },
    capabilityIds: [PLAN.capabilityId],
    ...overrides,
  };
}

function lifecycle(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    planId: "lc-exec-test",
    status: "running",
    cancelRequested: false,
    pauseRequested: false,
    tenantFingerprint: identityFingerprint(IDENTITY.tenantId),
    subjectFingerprint: identityFingerprint(IDENTITY.subjectId),
    ...overrides,
  };
}

function fixture() {
  const claimAssert = vi.fn(async () => true);
  const claimRelease = vi.fn(async () => undefined);
  const resolveVerifiedTarget = vi.fn(async () => target());
  const getStatus = vi.fn(async () => lifecycle());
  const acquireClaimFence = vi.fn(async () => ({
    fingerprint: "b".repeat(64),
    assertActive: claimAssert,
    release: claimRelease,
  }));
  const acquire = createLocalClientVerifiedExecutionFence({
    acquireClaimFence,
    resolveVerifiedTarget,
    lifecycle: { getStatus },
  });
  return { acquire, acquireClaimFence, claimAssert, claimRelease, resolveVerifiedTarget, getStatus };
}

async function acquired(setup = fixture()) {
  const fence = await setup.acquire({
    executionId: "lc-exec-test",
    plan: PLAN,
    identity: IDENTITY,
    signal: new AbortController().signal,
  });
  return { setup, fence };
}

describe("verified local-client execution fence", () => {
  it("asserts claim, exact verified revision and running lifecycle at reserve and commit", async () => {
    const { setup, fence } = await acquired();
    await expect(fence.assertActive("reserve")).resolves.toBe(true);
    await expect(fence.assertActive("commit")).resolves.toBe(true);
    expect(setup.claimAssert).toHaveBeenNthCalledWith(1, "reserve");
    expect(setup.claimAssert).toHaveBeenNthCalledWith(2, "commit");
    expect(setup.resolveVerifiedTarget).toHaveBeenCalledTimes(2);
    expect(setup.getStatus).toHaveBeenCalledTimes(2);
  });

  it("blocks commit after disable/re-registration changes verified target authority", async () => {
    const setup = fixture();
    setup.resolveVerifiedTarget
      .mockResolvedValueOnce(target())
      .mockResolvedValueOnce(target({ revision: PLAN.clientRevision + 1 }));
    const { fence } = await acquired(setup);
    await expect(fence.assertActive("reserve")).resolves.toBe(true);
    await expect(fence.assertActive("commit")).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_AUTHORITY_INACTIVE",
      statusCode: 409,
    });
  });

  it.each([
    { cancelRequested: true },
    { pauseRequested: true },
    { status: "cancelled" },
  ])("blocks commit when lifecycle authority is no longer running (%j)", async (change) => {
    const setup = fixture();
    setup.getStatus
      .mockResolvedValueOnce(lifecycle())
      .mockResolvedValueOnce(lifecycle(change));
    const { fence } = await acquired(setup);
    await expect(fence.assertActive("reserve")).resolves.toBe(true);
    await expect(fence.assertActive("commit")).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_AUTHORITY_INACTIVE",
    });
  });

  it("releases the underlying claim once and rejects future assertions", async () => {
    const { setup, fence } = await acquired();
    await fence.release?.();
    await fence.release?.();
    expect(setup.claimRelease).toHaveBeenCalledOnce();
    await expect(fence.assertActive("commit")).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_AUTHORITY_INACTIVE",
    });
  });
});
