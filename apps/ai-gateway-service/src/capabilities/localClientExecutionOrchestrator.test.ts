import { describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
  LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
  type LocalClientAdapterDescriptor,
  type LocalClientAdapterReceipt,
} from "./localClientAdapterRegistry.ts";
import {
  LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES,
  LOCAL_CLIENT_ROUTE_PLAN_VERSION,
  type LocalClientRoutePlan,
} from "./localClientRoutePlanStore.ts";
import {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  type LocalClientDispatchIntent,
  type LocalClientDurableExecutionReceipt,
  type LocalClientReceiptReconciliationIdentity,
} from "./localClientExecutionReceiptReconciliation.ts";
import {
  LOCAL_CLIENT_EXECUTION_ORCHESTRATOR_BOUNDARIES,
  buildLocalClientExecutionScopes,
  createLocalClientEffectPayloadFingerprint,
  createLocalClientExecutionOrchestrator,
  type LocalClientExecutionOrchestratorDependencies,
  type LocalClientExecutionRequest,
} from "./localClientExecutionOrchestrator.ts";

const NOW = Date.parse("2026-08-28T08:00:00.000Z");
const PLAN_ID = "a".repeat(64);
const EFFECT_KEY_HASH = "b".repeat(64);
const FENCE_FINGERPRINT = "c".repeat(64);
const RESERVATION_FINGERPRINT = "d".repeat(16);

function routePlan(overrides: Partial<LocalClientRoutePlan> = {}): LocalClientRoutePlan {
  return Object.freeze({
    planVersion: LOCAL_CLIENT_ROUTE_PLAN_VERSION,
    planId: PLAN_ID,
    tenantId: "tenant-a",
    subjectId: "subject-a",
    clientId: "verified.local-client",
    clientRevision: 7,
    clientState: "verified",
    clientTrustDecision: "verified",
    adapterId: "test.governed-adapter",
    adapterType: "governed-test",
    adapterVersion: "1.2.3",
    capabilityId: "local_inspection",
    actionId: "inspect",
    inputSha256: "e".repeat(64),
    policyVersion: "local-client-policy-v3",
    createdAt: new Date(NOW - 1_000).toISOString(),
    expiresAt: new Date(NOW + 60_000).toISOString(),
    boundaries: LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES,
    ...overrides,
  });
}

function adapterDescriptor(overrides: Partial<LocalClientAdapterDescriptor> = {}): LocalClientAdapterDescriptor {
  return Object.freeze({
    descriptorVersion: LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
    id: "test.governed-adapter",
    type: "governed-test",
    version: "1.2.3",
    actions: Object.freeze([{
      actionId: "inspect",
      capabilityId: "local_inspection",
      inputSchema: Object.freeze({
        schemaId: "test.local-client.inspect.v1",
        schemaVersion: 1 as const,
        fields: Object.freeze([
          Object.freeze({ name: "label", valueType: "string" as const, required: true }),
          Object.freeze({ name: "planFingerprint", valueType: "string" as const, required: true }),
        ]),
        additionalProperties: false as const,
      }),
    }]),
    ...overrides,
  });
}

function completedReceipt(overrides: Partial<LocalClientAdapterReceipt> = {}): LocalClientAdapterReceipt {
  return Object.freeze({
    receiptVersion: LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
    receiptId: "receipt:governed:0001",
    executionId: "lc-exec-orchestrator-fixture-0001",
    adapterId: "test.governed-adapter",
    adapterType: "governed-test",
    adapterVersion: "1.2.3",
    clientId: "verified.local-client",
    capabilityId: "local_inspection",
    actionId: "inspect",
    executionMode: "governed",
    externalEffectPerformed: true,
    status: "completed",
    ...overrides,
    planFingerprint: overrides.planFingerprint === undefined ? PLAN_ID : overrides.planFingerprint,
  });
}

function fixtureDispatchIntent(
  input: LocalClientReceiptReconciliationIdentity,
): LocalClientDispatchIntent {
  return Object.freeze({
    protocolVersion: LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
    intentId: `lcdi_${"1".repeat(64)}`,
    executionId: input.executionId,
    executionBindingHmac: "2".repeat(64),
    tenantBindingHmac: "3".repeat(64),
    subjectBindingHmac: "4".repeat(64),
    clientBindingHmac: "5".repeat(64),
    routeBindingHmac: "6".repeat(64),
    identityBindingHmac: "7".repeat(64),
    planFingerprint: input.planFingerprint,
    inputSha256: input.inputSha256,
    dispatchFencingToken: "1",
    issuedAtMs: NOW,
    expiresAtMs: NOW + 60_000,
    signature: "8".repeat(64),
  });
}

function fixtureDurableReceipt(
  intent: LocalClientDispatchIntent,
): LocalClientDurableExecutionReceipt {
  return Object.freeze({
    protocolVersion: LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
    receiptId: `lcdr_${"9".repeat(64)}`,
    intentId: intent.intentId,
    executionId: intent.executionId,
    executionBindingHmac: intent.executionBindingHmac,
    tenantBindingHmac: intent.tenantBindingHmac,
    subjectBindingHmac: intent.subjectBindingHmac,
    clientBindingHmac: intent.clientBindingHmac,
    routeBindingHmac: intent.routeBindingHmac,
    identityBindingHmac: intent.identityBindingHmac,
    planFingerprint: intent.planFingerprint,
    inputSha256: intent.inputSha256,
    dispatchFencingToken: intent.dispatchFencingToken,
    completedAtMs: NOW + 4_321,
    executionMode: "governed",
    externalEffectPerformed: true,
    status: "completed",
    signature: "a".repeat(64),
  });
}

function executionRequest(overrides: Partial<LocalClientExecutionRequest> = {}): LocalClientExecutionRequest {
  return {
    tenantId: "tenant-a",
    subjectId: "subject-a",
    planId: PLAN_ID,
    input: { label: "inspect-now" },
    effectKey: { effectKeyHash: EFFECT_KEY_HASH },
    ...overrides,
  };
}

function approvalRecord(
  plan: LocalClientRoutePlan,
  status: "approved" | "consumed",
  overrides: Record<string, unknown> = {},
) {
  return {
    approvalId: "appr_local_client_001",
    planId: plan.planId,
    tenantId: plan.tenantId,
    userId: plan.subjectId,
    planDigest: plan.planId,
    approvedScopes: buildLocalClientExecutionScopes(plan),
    status,
    expiresAt: new Date(NOW + 30_000).toISOString(),
    revoked: false,
    ...overrides,
  };
}

type HarnessOverrides = Partial<LocalClientExecutionOrchestratorDependencies> & {
  plan?: LocalClientRoutePlan;
};

function createHarness(overrides: HarnessOverrides = {}) {
  const events: string[] = [];
  const plan = overrides.plan ?? routePlan();
  const { plan: _planOverride, ...dependencyOverrides } = overrides;
  let lifecycleMetadata: Record<string, unknown> = {};
  let lifecycleStatus = "running";
  const descriptor = adapterDescriptor();

  const routePlanStore: LocalClientExecutionOrchestratorDependencies["routePlanStore"] = {
    get: vi.fn(async () => {
      events.push("plan.get");
      return plan;
    }),
    verifyInput: vi.fn(async () => {
      events.push("plan.verifyInput");
      return Object.freeze({ label: "inspect-now" });
    }),
    consume: vi.fn(async () => {
      events.push("plan.consume");
      return plan;
    }),
  };
  const approvalGate: LocalClientExecutionOrchestratorDependencies["approvalGate"] = {
    check: vi.fn(async () => {
      events.push("approval.check");
      return { approved: true, approval: approvalRecord(plan, "approved") };
    }),
    consume: vi.fn(async () => {
      events.push("approval.consume");
      return { approved: true, consumed: true, approval: approvalRecord(plan, "consumed") };
    }),
  };
  const lifecycle: LocalClientExecutionOrchestratorDependencies["lifecycle"] = {
    initialize: vi.fn(async (_executionId, metadata) => {
      events.push("lifecycle.initialize");
      lifecycleMetadata = metadata;
      lifecycleStatus = "pending";
      return { success: true };
    }),
    start: vi.fn(async () => {
      events.push("lifecycle.start");
      lifecycleStatus = "running";
      return { success: true };
    }),
    pause: vi.fn(async (_executionId, reason) => {
      events.push(`lifecycle.pause:${String(reason).includes("local-client-unknown-reconcile-required-v1")}`);
      return {
        success: true,
        status: "running",
        pauseRequested: true,
        message: "reconciliation required",
      };
    }),
    complete: vi.fn(async (_executionId, status, summary) => {
      events.push(`lifecycle.complete:${status}:${String(summary?.outcome ?? "none")}`);
      lifecycleStatus = status;
      return { success: true };
    }),
    cancel: vi.fn(async () => {
      events.push("lifecycle.cancel");
      lifecycleStatus = "cancelled";
      return { success: true, status: "cancelled" };
    }),
    getStatus: vi.fn(async () => ({
      success: true,
      status: lifecycleStatus,
      cancelRequested: false,
      tenantFingerprint: lifecycleMetadata.tenantFingerprint,
      subjectFingerprint: lifecycleMetadata.subjectFingerprint,
    })),
  };
  const externalEffectGate: LocalClientExecutionOrchestratorDependencies["externalEffectGate"] = {
    reserve: vi.fn(async (input) => {
      events.push("effect.reserve");
      await (input.assertFence as (phase: "reserve" | "commit") => Promise<unknown>)("reserve");
      return {
        reservationFingerprint: RESERVATION_FINGERPRINT,
        async commit() {
          events.push("effect.commit");
          await (input.assertFence as (phase: "reserve" | "commit") => Promise<unknown>)("commit");
        },
      };
    }),
  };
  const receiptJournal = {
    prepareDispatch: vi.fn(async () => {
      events.push("receipt.prepare");
      return { prepared: true, replayed: false, record: {} };
    }),
    armDispatch: vi.fn(async (input: LocalClientReceiptReconciliationIdentity) => {
      events.push("receipt.arm");
      return {
        dispatchAllowed: true,
        replayed: false,
        intent: fixtureDispatchIntent(input),
        record: {},
      };
    }),
    resolveArmedAsNotDispatched: vi.fn(async () => {
      events.push("receipt.armed-not-dispatched");
      return {
        resolved: true,
        replayed: false,
        record: { state: "armed-not-dispatched-confirmed" },
      };
    }),
    confirmReceipt: vi.fn(async (receipt: LocalClientDurableExecutionReceipt) => {
      events.push("receipt.confirm");
      return { confirmed: true, replayed: false, receipt, record: {} };
    }),
    markFeedbackStaged: vi.fn(async () => {
      events.push("receipt.feedback-staged");
      return { staged: true, replayed: false, record: {} };
    }),
    markLifecycleFinalized: vi.fn(async () => {
      events.push("receipt.lifecycle-finalized");
      return { finalized: true, replayed: false, record: {} };
    }),
  };
  const adapterRegistry: LocalClientExecutionOrchestratorDependencies["adapterRegistry"] = {
    lookup: vi.fn(() => {
      events.push("adapter.lookup");
      return descriptor;
    }),
    execute: vi.fn(async (request) => {
      events.push("adapter.execute");
      expect(request.input).toEqual({ label: "inspect-now", planFingerprint: plan.planId });
      const reconciliation = request.receiptReconciliation;
      if (!reconciliation) throw new Error("missing receipt reconciliation");
      await reconciliation.confirmReceipt(fixtureDurableReceipt(reconciliation.intent));
      return completedReceipt({ executionId: request.executionId });
    }),
  };
  const resolveVerifiedTarget: LocalClientExecutionOrchestratorDependencies["resolveVerifiedTarget"] = vi.fn(async () => {
    events.push("target.resolve");
    return {
      descriptorVersion: "verified-local-client-adapter-target-v1" as const,
      clientId: plan.clientId,
      revision: plan.clientRevision,
      state: "verified" as const,
      trustDecision: "verified" as const,
      adapter: {
        id: plan.adapterId,
        type: plan.adapterType,
        version: plan.adapterVersion,
      },
      capabilityIds: [plan.capabilityId],
    };
  });
  const acquireFence: LocalClientExecutionOrchestratorDependencies["acquireFence"] = vi.fn(async () => {
    events.push("fence.acquire");
    return {
      fingerprint: FENCE_FINGERPRINT,
      async assertActive(phase: "reserve" | "commit") {
        events.push(`fence.${phase}`);
        return true;
      },
      async release() {
        events.push("fence.release");
      },
    };
  });

  const dependencies: LocalClientExecutionOrchestratorDependencies = {
    routePlanStore,
    approvalGate,
    lifecycle,
    externalEffectGate,
    adapterRegistry,
    resolveVerifiedTarget,
    acquireFence,
    resolveReceiptJournal: vi.fn(() => receiptJournal),
    ...dependencyOverrides,
  };
  const orchestrator = createLocalClientExecutionOrchestrator(dependencies, {
    now: () => NOW,
    lifecyclePollMs: 0,
  });
  return { orchestrator, dependencies, events, plan, descriptor, lifecycle };
}

describe("local client execution orchestrator", () => {
  it("runs the exact fail-closed sequence and binds every immutable plan field into the effect fingerprint", async () => {
    const harness = createHarness();
    const result = await harness.orchestrator.execute(executionRequest());

    expect(result).toMatchObject({
      status: "completed",
      planId: PLAN_ID,
      planFingerprint: PLAN_ID,
      reservationFingerprint: RESERVATION_FINGERPRINT,
      externalEffectCommitted: true,
      retryAllowed: false,
    });
    if (result.status !== "completed") throw new Error("expected completed execution");
    expect(harness.events).toEqual([
      "plan.get",
      "plan.verifyInput",
      "target.resolve",
      "adapter.lookup",
      "approval.check",
      "approval.consume",
      "plan.consume",
      "lifecycle.initialize",
      "lifecycle.start",
      "fence.acquire",
      "receipt.prepare",
      "effect.reserve",
      "fence.reserve",
      "receipt.arm",
      "effect.commit",
      "fence.commit",
      "adapter.execute",
      "receipt.confirm",
      "lifecycle.complete:completed:completed",
      "receipt.lifecycle-finalized",
      "fence.release",
    ]);

    const reserveInput = vi.mocked(harness.dependencies.externalEffectGate.reserve).mock.calls[0][0];
    expect(reserveInput).toMatchObject({
      effectKeyHash: EFFECT_KEY_HASH,
      tenantId: "tenant-a",
      route: "/local-clients/execute",
      effectType: "local-client:adapter-execution",
      fenceFingerprint: FENCE_FINGERPRINT,
      fenceRequired: true,
    });
    expect(reserveInput.payloadFingerprint).toBe(createLocalClientEffectPayloadFingerprint({
      plan: harness.plan,
      executionId: result.executionId,
      approvalId: "appr_local_client_001",
    }));
    expect(createLocalClientEffectPayloadFingerprint({
      plan: routePlan({ clientRevision: 8 }),
      executionId: result.executionId,
      approvalId: "appr_local_client_001",
    })).not.toBe(reserveInput.payloadFingerprint);
    expect(createLocalClientEffectPayloadFingerprint({
      plan: routePlan({ actionId: "inspect_v2" }),
      executionId: result.executionId,
      approvalId: "appr_local_client_001",
    })).not.toBe(reserveInput.payloadFingerprint);
    expect(createLocalClientEffectPayloadFingerprint({
      plan: routePlan({ policyVersion: "local-client-policy-v4" }),
      executionId: result.executionId,
      approvalId: "appr_local_client_001",
    })).not.toBe(reserveInput.payloadFingerprint);
    expect(result.feedback).toMatchObject({
      source: "verified-governed-receipt",
      attempted: false,
      persisted: false,
      exactlyOnce: false,
      deliveryStatus: "not-configured",
      errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIGURED",
    });
  });

  it("derives stable exactly-once feedback only after a verified receipt and completed lifecycle", async () => {
    const record = vi.fn(async (_feedback: unknown, _scope: unknown) => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: false,
    }));
    const harness = createHarness({ feedbackSink: { record } });

    const result = await harness.orchestrator.execute(executionRequest());

    expect(result.status).toBe("completed");
    if (result.status !== "completed") throw new Error("expected completed execution");
    expect(record).toHaveBeenCalledTimes(1);
    const [feedback, scope] = record.mock.calls[0]!;
    expect(feedback).toEqual({
      eventId: result.feedback.eventId,
      clientId: "verified.local-client",
      taskId: result.executionId,
      status: "success",
      latencyMs: 4_321,
      requiredCapabilities: ["local_inspection"],
      observedAt: new Date(NOW + 4_321).toISOString(),
    });
    expect(scope).toEqual({ tenantId: "tenant-a", userId: "subject-a" });
    expect(result.feedback).toMatchObject({
      attempted: true,
      persisted: true,
      exactlyOnce: true,
      replayed: false,
      deliveryStatus: "persisted",
      errorCode: null,
    });
    expect(result.feedback.eventId).toMatch(/^lcfb-[a-f0-9]{64}$/u);
    expect(harness.events.indexOf("lifecycle.complete:completed:completed"))
      .toBeLessThan(harness.events.indexOf("fence.release"));

    const secondRecord = vi.fn(async (_feedback: unknown, _scope: unknown) => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: true,
    }));
    const second = await createHarness({ feedbackSink: { record: secondRecord } })
      .orchestrator.execute(executionRequest());
    expect(second.status).toBe("completed");
    if (second.status !== "completed") throw new Error("expected completed execution");
    expect(second.feedback.eventId).toBe(result.feedback.eventId);
    expect(second.feedback.replayed).toBe(true);
  });

  it("durably stages verified feedback before lifecycle completion and reports pending delivery honestly", async () => {
    const events: string[] = [];
    const stage = vi.fn(async () => {
      events.push("feedback.stage");
      return {
        persisted: true as const,
        queued: true,
        replayed: false,
        state: "pending" as const,
      };
    });
    const record = vi.fn(async () => {
      events.push("feedback.record");
      return {
        persisted: true as const,
        exactlyOnce: false,
        replayed: true,
        queued: true,
      };
    });
    const harness = createHarness({ feedbackSink: { stage, record } });
    const originalComplete = harness.dependencies.lifecycle.complete;
    harness.dependencies.lifecycle.complete = vi.fn(async (...args: Parameters<typeof originalComplete>) => {
      events.push(`lifecycle.complete:${args[1]}`);
      return originalComplete(...args);
    });

    const result = await harness.orchestrator.execute(executionRequest());

    expect(result).toMatchObject({
      status: "completed",
      externalEffectCommitted: true,
      retryAllowed: false,
      feedback: {
        attempted: true,
        persisted: true,
        exactlyOnce: false,
        replayed: true,
        deliveryStatus: "queued",
        errorCode: null,
      },
    });
    expect(events).toEqual([
      "feedback.stage",
      "lifecycle.complete:completed",
      "feedback.record",
    ]);
  });

  it("completes the external action when durable feedback staging fails and does not bypass the outbox", async () => {
    const stage = vi.fn(async () => {
      throw Object.assign(new Error("outbox unavailable"), { code: "RAW_SQLITE_ERROR" });
    });
    const record = vi.fn(async () => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: false,
    }));
    const harness = createHarness({ feedbackSink: { stage, record } });

    const result = await harness.orchestrator.execute(executionRequest());

    expect(result).toMatchObject({
      status: "completed",
      externalEffectCommitted: true,
      retryAllowed: false,
      feedback: {
        attempted: true,
        persisted: false,
        exactlyOnce: false,
        deliveryStatus: "failed",
        errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED",
      },
    });
    expect(record).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("RAW_SQLITE_ERROR");
  });

  it("keeps a completed external action completed when automatic feedback persistence fails", async () => {
    const record = vi.fn(async () => {
      throw Object.assign(new Error("sensitive persistence detail"), { code: "RAW_DATABASE_ERROR" });
    });
    const harness = createHarness({ feedbackSink: { record } });

    const result = await harness.orchestrator.execute(executionRequest());

    expect(result).toMatchObject({
      status: "completed",
      externalEffectCommitted: true,
      retryAllowed: false,
      feedback: {
        attempted: true,
        persisted: false,
        exactlyOnce: false,
        deliveryStatus: "failed",
        errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED",
      },
    });
    expect(JSON.stringify(result)).not.toContain("sensitive persistence detail");
    expect(JSON.stringify(result)).not.toContain("RAW_DATABASE_ERROR");
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("rejects plan tenant or subject drift before approval or adapter access", async () => {
    for (const plan of [
      routePlan({ tenantId: "tenant-b" }),
      routePlan({ subjectId: "subject-b" }),
    ]) {
      const harness = createHarness({ plan });
      await expect(harness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
        code: "LOCAL_CLIENT_EXECUTION_PLAN_IDENTITY_MISMATCH",
      });
      expect(harness.dependencies.approvalGate.check).not.toHaveBeenCalled();
      expect(harness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    }
  });

  it("rejects approval digest, subject, exact-scope, and TTL mismatches before consume", async () => {
    const cases = [
      {
        code: "LOCAL_CLIENT_EXECUTION_APPROVAL_MISMATCH",
        record: { planDigest: "f".repeat(64) },
      },
      {
        code: "LOCAL_CLIENT_EXECUTION_APPROVAL_MISMATCH",
        record: { userId: "subject-b" },
      },
      {
        code: "LOCAL_CLIENT_EXECUTION_APPROVAL_SCOPE_MISMATCH",
        record: { approvedScopes: ["local-client:execute"] },
      },
      {
        code: "LOCAL_CLIENT_EXECUTION_APPROVAL_SCOPE_MISMATCH",
        record: { approvedScopes: [...buildLocalClientExecutionScopes(routePlan()), "extra:scope"] },
      },
      {
        code: "LOCAL_CLIENT_EXECUTION_APPROVAL_EXPIRED",
        record: { expiresAt: new Date(NOW).toISOString() },
      },
    ];

    for (const testCase of cases) {
      const plan = routePlan();
      const approvalGate = {
        check: vi.fn(async () => ({
          approved: true,
          approval: approvalRecord(plan, "approved", testCase.record),
        })),
        consume: vi.fn(),
      };
      const harness = createHarness({ plan, approvalGate });
      await expect(harness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
        code: testCase.code,
      });
      expect(approvalGate.consume).not.toHaveBeenCalled();
      expect(harness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    }
  });

  it("revalidates current client revision, adapter version/action, and server-composed input before consuming approval", async () => {
    const staleTargetHarness = createHarness({
      resolveVerifiedTarget: vi.fn(async () => ({
        descriptorVersion: "verified-local-client-adapter-target-v1" as const,
        clientId: "verified.local-client",
        revision: 8,
        state: "verified" as const,
        trustDecision: "verified" as const,
        adapter: { id: "test.governed-adapter", type: "governed-test", version: "1.2.3" },
        capabilityIds: ["local_inspection"],
      })),
    });
    await expect(staleTargetHarness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_TARGET_CHANGED",
    });

    const adapterHarness = createHarness({
      adapterRegistry: {
        lookup: vi.fn(() => adapterDescriptor({ version: "2.0.0" })),
        execute: vi.fn(),
      },
    });
    await expect(adapterHarness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_ADAPTER_CHANGED",
    });

    const inputHarness = createHarness({
      routePlanStore: {
        get: vi.fn(async () => routePlan()),
        consume: vi.fn(async () => routePlan()),
        verifyInput: vi.fn(async () => ({ label: "inspect-now", planFingerprint: "caller-controlled" })),
      },
    });
    await expect(inputHarness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_INPUT_INVALID",
    });

    for (const harness of [staleTargetHarness, adapterHarness, inputHarness]) {
      expect(harness.dependencies.approvalGate.consume).not.toHaveBeenCalled();
      expect(harness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    }
  });

  it("allows only one concurrent execution of the same approved plan and effect key", async () => {
    const plan = routePlan();
    let checks = 0;
    let releaseChecks!: () => void;
    const bothChecked = new Promise<void>((resolve) => {
      releaseChecks = resolve;
    });
    let consumed = false;
    const approvalGate = {
      check: vi.fn(async () => {
        checks += 1;
        if (checks === 2) releaseChecks();
        await bothChecked;
        return { approved: true, approval: approvalRecord(plan, "approved") };
      }),
      consume: vi.fn(async () => {
        if (consumed) return { approved: false, consumed: false, code: "APPROVAL_NOT_FOUND" };
        consumed = true;
        return { approved: true, consumed: true, approval: approvalRecord(plan, "consumed") };
      }),
    };
    const harness = createHarness({ plan, approvalGate });

    const outcomes = await Promise.allSettled([
      harness.orchestrator.execute(executionRequest()),
      harness.orchestrator.execute(executionRequest()),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(harness.dependencies.adapterRegistry.execute).toHaveBeenCalledOnce();
    expect(harness.dependencies.externalEffectGate.reserve).toHaveBeenCalledOnce();
  });

  it("fails before the adapter when a fence becomes inactive or a required store fails", async () => {
    const staleFenceHarness = createHarness({
      acquireFence: vi.fn(async () => ({
        fingerprint: FENCE_FINGERPRINT,
        async assertActive() {
          throw Object.assign(new Error("stale"), { code: "TASK_CLAIM_FENCE_MISMATCH" });
        },
      })),
    });
    await expect(staleFenceHarness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "TASK_CLAIM_FENCE_MISMATCH",
    });
    expect(staleFenceHarness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    expect(staleFenceHarness.events).toContain("lifecycle.complete:failed:failed-before-effect");

    const approvalStoreHarness = createHarness({
      approvalGate: {
        check: vi.fn(async () => {
          throw Object.assign(new Error("down"), { code: "WORKFORCE_APPROVAL_STORE_UNAVAILABLE" });
        }),
        consume: vi.fn(),
      },
    });
    await expect(approvalStoreHarness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "WORKFORCE_APPROVAL_STORE_UNAVAILABLE",
    });
    expect(approvalStoreHarness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();

    const effectStoreHarness = createHarness({
      externalEffectGate: {
        reserve: vi.fn(async () => {
          throw Object.assign(new Error("down"), { code: "EXTERNAL_EFFECT_STORE_UNAVAILABLE" });
        }),
      },
    });
    await expect(effectStoreHarness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_STORE_UNAVAILABLE",
    });
    expect(effectStoreHarness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    expect(effectStoreHarness.events).toContain("lifecycle.complete:failed:failed-before-effect");
  });

  it("terminalizes an armed intent when reservation commit fails before adapter entry", async () => {
    const harness = createHarness({
      externalEffectGate: {
        reserve: vi.fn(async () => ({
          reservationFingerprint: RESERVATION_FINGERPRINT,
          async commit() {
            throw Object.assign(new Error("commit failed"), { code: "EXTERNAL_EFFECT_COMMIT_FAILED" });
          },
        })),
      },
    });

    await expect(harness.orchestrator.execute(executionRequest())).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_COMMIT_FAILED",
    });
    expect(harness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    expect(harness.events).toContain("receipt.armed-not-dispatched");
    expect(harness.events).toContain("lifecycle.complete:failed:failed-before-effect");
    expect(harness.events.indexOf("receipt.armed-not-dispatched")).toBeLessThan(
      harness.events.indexOf("lifecycle.complete:failed:failed-before-effect"),
    );
  });

  it("records cancellation before commit as cancelled without invoking the adapter", async () => {
    const controller = new AbortController();
    const harness = createHarness({
      acquireFence: vi.fn(async () => {
        controller.abort();
        return {
          fingerprint: FENCE_FINGERPRINT,
          async assertActive() { return true; },
        };
      }),
    });

    await expect(harness.orchestrator.execute(executionRequest({ signal: controller.signal }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_ABORTED",
    });
    expect(harness.dependencies.externalEffectGate.reserve).not.toHaveBeenCalled();
    expect(harness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    expect(harness.events).toContain("lifecycle.complete:cancelled:cancelled-before-effect");
  });

  it("returns unknown-reconcile-required without a receipt when cancellation occurs after commit", async () => {
    const controller = new AbortController();
    const base = createHarness();
    const externalEffectGate = {
      reserve: vi.fn(async () => ({
        reservationFingerprint: RESERVATION_FINGERPRINT,
        async commit() {
          controller.abort();
        },
      })),
    };
    const harness = createHarness({ externalEffectGate });

    const result = await harness.orchestrator.execute(executionRequest({ signal: controller.signal }));
    expect(result).toMatchObject({
      status: "unknown-reconcile-required",
      externalEffectCommitted: true,
      retryAllowed: false,
      receipt: null,
      errorCode: "LOCAL_CLIENT_EXECUTION_ABORTED",
      lifecyclePersisted: true,
    });
    expect(harness.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
    expect(harness.events).toContain("receipt.armed-not-dispatched");
    expect(harness.events).toContain("lifecycle.pause:true");
    expect(base.dependencies.adapterRegistry.execute).not.toHaveBeenCalled();
  });

  it("never retries an adapter failure after commit and requires a completed governed receipt", async () => {
    const record = vi.fn(async () => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: false,
    }));
    const failingAdapter = {
      lookup: vi.fn(() => adapterDescriptor()),
      execute: vi.fn(async () => {
        throw Object.assign(new Error("outcome lost"), { code: "LOCAL_ADAPTER_OUTCOME_UNKNOWN" });
      }),
    };
    const failedHarness = createHarness({ adapterRegistry: failingAdapter, feedbackSink: { record } });
    const failed = await failedHarness.orchestrator.execute(executionRequest());
    expect(failed).toMatchObject({
      status: "unknown-reconcile-required",
      receipt: null,
      retryAllowed: false,
      errorCode: "LOCAL_ADAPTER_OUTCOME_UNKNOWN",
    });
    expect(failingAdapter.execute).toHaveBeenCalledOnce();
    expect(failedHarness.events).toContain("lifecycle.pause:true");

    const acceptedAdapter = {
      lookup: vi.fn(() => adapterDescriptor()),
      execute: vi.fn(async (request) => {
        const reconciliation = request.receiptReconciliation!;
        await reconciliation.confirmReceipt(fixtureDurableReceipt(reconciliation.intent));
        return completedReceipt({
          executionId: request.executionId,
          status: "accepted",
        });
      }),
    };
    const acceptedHarness = createHarness({ adapterRegistry: acceptedAdapter, feedbackSink: { record } });
    const accepted = await acceptedHarness.orchestrator.execute(executionRequest());
    expect(accepted).toMatchObject({
      status: "unknown-reconcile-required",
      receipt: null,
      retryAllowed: false,
      errorCode: "LOCAL_CLIENT_EXECUTION_RECEIPT_INVALID",
    });
    expect(acceptedHarness.events).not.toContain("lifecycle.complete:completed:completed");
    expect(record).not.toHaveBeenCalled();

    const mismatchedExecutionAdapter = {
      lookup: vi.fn(() => adapterDescriptor()),
      execute: vi.fn(async (request) => {
        const reconciliation = request.receiptReconciliation!;
        await reconciliation.confirmReceipt(fixtureDurableReceipt(reconciliation.intent));
        return completedReceipt({ executionId: "lc-exec-mismatched-receipt-0001" });
      }),
    };
    const mismatchedHarness = createHarness({ adapterRegistry: mismatchedExecutionAdapter });
    await expect(mismatchedHarness.orchestrator.execute(executionRequest())).resolves.toMatchObject({
      status: "unknown-reconcile-required",
      errorCode: "LOCAL_CLIENT_EXECUTION_RECEIPT_INVALID",
      retryAllowed: false,
    });

    const extraFieldAdapter = {
      lookup: vi.fn(() => adapterDescriptor()),
      execute: vi.fn(async (request) => {
        const reconciliation = request.receiptReconciliation!;
        await reconciliation.confirmReceipt(fixtureDurableReceipt(reconciliation.intent));
        return {
          ...completedReceipt({ executionId: request.executionId }),
          untrustedExtra: true,
        } as unknown as LocalClientAdapterReceipt;
      }),
    };
    const extraFieldHarness = createHarness({ adapterRegistry: extraFieldAdapter });
    await expect(extraFieldHarness.orchestrator.execute(executionRequest())).resolves.toMatchObject({
      status: "unknown-reconcile-required",
      errorCode: "LOCAL_CLIENT_EXECUTION_RECEIPT_INVALID",
      retryAllowed: false,
    });
  });

  it("never regresses lifecycle truth after a durable receipt is confirmed and a later adapter step fails", async () => {
    const record = vi.fn(async () => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: false,
    }));
    const adapterRegistry = {
      lookup: vi.fn(() => adapterDescriptor()),
      execute: vi.fn(async (request) => {
        const reconciliation = request.receiptReconciliation!;
        await reconciliation.confirmReceipt(fixtureDurableReceipt(reconciliation.intent));
        throw Object.assign(new Error("outer adapter response was lost"), {
          code: "LOCAL_ADAPTER_RESPONSE_LOST_AFTER_RECEIPT",
        });
      }),
    };
    const harness = createHarness({ adapterRegistry, feedbackSink: { record } });

    const result = await harness.orchestrator.execute(executionRequest());

    expect(result).toMatchObject({
      status: "unknown-reconcile-required",
      receipt: null,
      retryAllowed: false,
      errorCode: "LOCAL_ADAPTER_RESPONSE_LOST_AFTER_RECEIPT",
      lifecyclePersisted: true,
    });
    expect(harness.events).toContain(
      "lifecycle.complete:completed:completed-receipt-confirmed-recovery-pending",
    );
    expect(harness.events).not.toContain("lifecycle.complete:failed:unknown-reconcile-required");
    expect(record).not.toHaveBeenCalled();
  });

  it("protects persisted status and cancel by tenant and subject fingerprints", async () => {
    const harness = createHarness();
    const completed = await harness.orchestrator.execute(executionRequest());

    await expect(harness.orchestrator.getStatus({
      tenantId: "tenant-b",
      subjectId: "subject-a",
      executionId: completed.executionId,
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_FORBIDDEN" });
    await expect(harness.orchestrator.cancel({
      tenantId: "tenant-a",
      subjectId: "subject-b",
      executionId: completed.executionId,
      reason: "not-owner",
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_FORBIDDEN" });
    expect(harness.lifecycle.cancel).not.toHaveBeenCalled();
  });

  it("rejects body-supplied routing authority and declares outer HTTP idempotency as mandatory", async () => {
    const harness = createHarness();
    await expect(harness.orchestrator.execute({
      ...executionRequest(),
      adapterId: "caller.adapter",
      actionId: "caller-action",
    } as LocalClientExecutionRequest)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID",
    });
    expect(harness.dependencies.routePlanStore.get).not.toHaveBeenCalled();
    expect(LOCAL_CLIENT_EXECUTION_ORCHESTRATOR_BOUNDARIES).toEqual({
      providesHttpIdempotency: false,
      requiresOuterIdempotencyCoordinator: true,
      retriesAfterExternalEffectCommit: false,
      unknownOutcomeRequiresReconciliation: true,
      derivesFeedbackOnlyFromVerifiedCompletionReceipt: true,
      feedbackFailureChangesCompletedExecutionOutcome: false,
    });
  });
});
