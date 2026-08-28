import { describe, expect, it, vi } from "vitest";

import {
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  createLocalClientAdapterRegistry,
  type LocalClientAdapter,
} from "./localClientAdapterRegistry.ts";
import {
  createLocalClientExecutionPreview,
  type ResolvedVerifiedLocalClientPreviewTarget,
} from "./localClientExecutionPreview.ts";
import type { LocalClientIdempotentExecutionOutcome } from "./localClientExecutionIdempotencyCoordinator.ts";
import { createLocalClientRoutePlanStore } from "./localClientRoutePlanStore.ts";
import {
  createLocalClientGovernedExecutionApi,
  type LocalClientGovernedExecutionApiDependencies,
} from "./localClientGovernedExecutionApi.ts";

const CLOCK = Date.parse("2026-08-28T00:00:00.000Z");
const TENANT_ID = "tenant-a";
const SUBJECT_ID = "operator-a";
const RAW_INPUT_VALUE = "private-document-reference-17";
const EXECUTION_ID = `lc-exec-${"b".repeat(64)}`;

describe("local-client governed execution API facade", () => {
  it("creates a sanitized server-authoritative preview without returning raw input or identity", async () => {
    const setup = harness();

    const result = await setup.api.preview(previewRequest());

    expect(setup.resolveVerifiedTarget).toHaveBeenCalledWith({
      identity: { tenantId: TENANT_ID, subjectId: SUBJECT_ID },
      clientId: "desktop-agent",
    });
    expect(result).toMatchObject({
      apiVersion: "local-client-governed-execution-api-v2",
      operation: "preview",
      status: "approval-required",
      executionPerformed: false,
      plan: {
        clientId: "desktop-agent",
        adapter: {
          id: "loopback.desktop-agent",
          type: "loopback-hmac",
          version: "1.2.0",
        },
        capabilityId: "document_open",
        actionId: "open_document",
      },
      approval: { required: true },
      boundaries: {
        serverResolvesTarget: true,
        rawInputReturned: false,
        fakeExecutionDenied: true,
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(RAW_INPUT_VALUE);
    expect(serialized).not.toContain(TENANT_ID);
    expect(serialized).not.toContain(SUBJECT_ID);
    expect(result).not.toHaveProperty("input");
  });

  it("rejects request-body attempts to choose an adapter or inject authority", async () => {
    const setup = harness();

    await expect(setup.api.preview({
      ...previewRequest(),
      adapterId: "attacker.adapter",
    } as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID",
      statusCode: 400,
    });
    expect(setup.resolveVerifiedTarget).not.toHaveBeenCalled();
  });

  it("maps fake-adapter preview denial without exposing dependency errors", async () => {
    const setup = harness({
      target: {
        descriptorVersion: "verified-local-client-adapter-target-v1",
        clientId: "desktop-agent",
        revision: 1,
        state: "verified",
        trustDecision: "verified",
        adapter: {
          id: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
          type: "fake",
          version: "1.0.0",
        },
        capabilityIds: ["local_application"],
      },
    });

    await expect(setup.api.preview(previewRequest({
      capabilityId: "local_application",
      actionId: "simulate",
    }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_PREVIEW_FAILED",
      causeCode: "LOCAL_CLIENT_EXECUTION_PREVIEW_FAKE_ADAPTER_DENIED",
      statusCode: 409,
      retryable: false,
    });
  });

  it("re-reads the subject-bound plan and derives exact approval scopes and digest", async () => {
    const setup = harness();
    const preview = await setup.api.preview(previewRequest());

    const result = await setup.api.approve({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
      note: " operator approved ",
    });

    expect(setup.approve).toHaveBeenCalledOnce();
    const approvalInput = setup.approve.mock.calls[0]?.[0];
    expect(approvalInput).toEqual({
      planId: preview.plan.planId,
      tenantId: TENANT_ID,
      userId: SUBJECT_ID,
      planDigest: preview.plan.planId,
      approvedScopes: [
        "local-client:execute",
        "local-client:external-effect",
        `local-client:plan:${preview.plan.planId}`,
      ],
      note: "operator approved",
    });
    expect(result).toMatchObject({
      operation: "approve",
      status: "approved",
      executionPerformed: false,
      approval: {
        planId: preview.plan.planId,
        planDigest: preview.plan.planId,
        scopes: approvalInput.approvedScopes,
      },
      boundaries: {
        planReReadFromTrustedStore: true,
        scopesServerDerived: true,
        digestServerDerived: true,
        noteReturned: false,
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("operator approved");
    expect(serialized).not.toContain(TENANT_ID);
    expect(serialized).not.toContain(SUBJECT_ID);
    expect(serialized).not.toContain(RAW_INPUT_VALUE);
  });

  it("rejects body-supplied scopes, digest, adapter, and action before approval", async () => {
    const setup = harness();
    const preview = await setup.api.preview(previewRequest());
    const base = {
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
    };

    for (const injected of [
      { approvedScopes: ["admin:all"] },
      { planDigest: "f".repeat(64) },
      { adapterId: "attacker.adapter" },
      { actionId: "delete_everything" },
    ]) {
      await expect(setup.api.approve({ ...base, ...injected } as never)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID",
        statusCode: 400,
      });
    }
    expect(setup.approve).not.toHaveBeenCalled();
  });

  it("does not approve a plan through the wrong tenant or subject", async () => {
    const setup = harness();
    const preview = await setup.api.preview(previewRequest());

    await expect(setup.api.approve({
      tenantId: TENANT_ID,
      subjectId: "operator-b",
      planId: preview.plan.planId,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_APPROVAL_FAILED",
      causeCode: "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
      statusCode: 404,
    });
    expect(setup.approve).not.toHaveBeenCalled();
  });

  it.each([
    ["expired", { expiresAt: new Date(CLOCK - 1).toISOString() }],
    ["fake", { adapterType: "fake", adapterId: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID }],
  ])("fails closed for a %s trusted-plan response", async (_name, overrides) => {
    const setup = harness();
    const preview = await setup.api.preview(previewRequest());
    const fullPlan = setup.routePlanStore.get({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
    });
    const api = createApi(setup, {
      routePlanStore: { get: vi.fn(async () => ({ ...fullPlan, ...overrides })) },
    });

    await expect(api.approve({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_PLAN_INVALID",
      statusCode: 409,
    });
    expect(setup.approve).not.toHaveBeenCalled();
  });

  it("fails closed when the approval backend returns a mismatched record", async () => {
    const setup = harness({ approvalOverrides: { approvedScopes: ["admin:all"] } });
    const preview = await setup.api.preview(previewRequest());

    await expect(setup.api.approve({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_APPROVAL_FAILED",
      statusCode: 503,
    });
  });

  it("reads Idempotency-Key and AbortSignal only through the request port", async () => {
    const setup = harness();
    const preview = await setup.api.preview(previewRequest());
    const controller = new AbortController();
    const getHeader = vi.fn(() => "execution-key-001");

    const outcome = await setup.api.execute({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
      input: { documentId: RAW_INPUT_VALUE },
    }, { getHeader, signal: controller.signal });

    expect(outcome).toMatchObject({ accepted: true, status: "completed" });
    expect(getHeader).toHaveBeenCalledOnce();
    expect(getHeader).toHaveBeenCalledWith("idempotency-key");
    expect(setup.idempotentExecute).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: preview.plan.planId,
      input: { documentId: RAW_INPUT_VALUE },
      idempotencyKey: "execution-key-001",
      signal: controller.signal,
    });
  });

  it("rejects body-supplied execution authority before the idempotency layer", async () => {
    const setup = harness();

    await expect(setup.api.execute({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: "a".repeat(64),
      input: {},
      idempotencyKey: "body-key",
      actionId: "forged-action",
    } as never, { getHeader: () => "header-key" })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID",
      statusCode: 400,
    });
    expect(setup.idempotentExecute).not.toHaveBeenCalled();
  });

  it("preserves reconcile-required execution outcomes without retry shortcuts", async () => {
    const unknown: LocalClientIdempotentExecutionOutcome = {
      accepted: false,
      status: "unknown-reconcile-required",
      statusCode: 409,
      code: "LOCAL_CLIENT_EXECUTION_OUTCOME_UNKNOWN",
      message: "reconcile",
      idempotencyStatus: "created",
      replayed: false,
      replayable: false,
      operationInvoked: true,
      retryAllowed: false,
      result: null,
    };
    const setup = harness({ executionOutcome: unknown });

    await expect(setup.api.execute({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: "a".repeat(64),
      input: {},
    }, { getHeader: () => "unknown-key" })).resolves.toEqual(unknown);
    expect(setup.idempotentExecute).toHaveBeenCalledOnce();
  });

  it("maps an unexpected idempotency boundary throw to non-retryable reconciliation", async () => {
    const setup = harness({ idempotencyThrows: true });

    const outcome = await setup.api.execute({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      planId: "a".repeat(64),
      input: {},
    }, { getHeader: () => "unknown-key" });

    expect(outcome).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      statusCode: 503,
      retryAllowed: false,
      operationInvoked: true,
      result: null,
    });
    expect(JSON.stringify(outcome)).not.toContain("backend secret");
  });

  it("keeps status and cancel subject-bound and strips lifecycle details and reasons", async () => {
    const setup = harness();

    const status = await setup.api.status({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
    });
    const cancelled = await setup.api.cancel({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
      reason: " contains private operator context ",
    });

    expect(setup.getStatus).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
    });
    expect(setup.cancel).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
      reason: "contains private operator context",
    });
    expect(status).toEqual({
      apiVersion: "local-client-governed-execution-api-v2",
      operation: "status",
      executionId: EXECUTION_ID,
      status: "running",
      cancelRequested: false,
      pauseRequested: false,
      reconciliationRequired: false,
      retryAllowed: false,
      completedAgents: 0,
      startedAt: "2026-08-28T00:00:00.000Z",
      completedAt: null,
    });
    expect(cancelled).toEqual({
      apiVersion: "local-client-governed-execution-api-v2",
      operation: "cancel",
      executionId: EXECUTION_ID,
      status: "cancel-requested",
      lifecycleStatus: "running",
      cancelRequested: true,
      reasonReturned: false,
    });
    const serialized = JSON.stringify({ status, cancelled });
    expect(serialized).not.toContain("private operator context");
    expect(serialized).not.toContain("sensitive transition reason");
    expect(serialized).not.toContain("backend message");
  });

  it("projects the internal unknown-outcome pause marker as non-retryable reconciliation", async () => {
    const setup = harness();
    const api = createApi(setup, {
      orchestrator: {
        getStatus: vi.fn(async () => ({
          success: true,
          planId: EXECUTION_ID,
          status: "running",
          cancelRequested: false,
          pauseRequested: true,
          completedAgents: 0,
          startedAt: "2026-08-28T00:00:00.000Z",
          completedAt: null,
        })),
        cancel: setup.cancel,
      },
    });

    await expect(api.status({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
    })).resolves.toMatchObject({
      status: "running",
      pauseRequested: true,
      reconciliationRequired: true,
      retryAllowed: false,
    });
  });

  it("maps cross-subject status denial without leaking the dependency message", async () => {
    const setup = harness();

    await expect(setup.api.status({
      tenantId: TENANT_ID,
      subjectId: "operator-b",
      executionId: EXECUTION_ID,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_GOVERNED_API_STATUS_FAILED",
      causeCode: "LOCAL_CLIENT_EXECUTION_FORBIDDEN",
      statusCode: 403,
      retryable: false,
    });
    try {
      await setup.api.status({ tenantId: TENANT_ID, subjectId: "operator-b", executionId: EXECUTION_ID });
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("private authorization details");
    }
  });

  it("rejects malformed control requests before calling the orchestrator", async () => {
    const setup = harness();

    await expect(setup.api.status({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
      includeTransitions: true,
    } as never)).rejects.toMatchObject({ code: "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID" });
    await expect(setup.api.cancel({
      tenantId: TENANT_ID,
      subjectId: SUBJECT_ID,
      executionId: EXECUTION_ID,
      reason: "x".repeat(513),
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID" });
    expect(setup.getStatus).not.toHaveBeenCalled();
    expect(setup.cancel).not.toHaveBeenCalled();
  });

  it("fails closed for incomplete dependencies and options", () => {
    expect(() => createLocalClientGovernedExecutionApi({} as never)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_GOVERNED_API_CONFIG_INVALID",
    }));
    const setup = harness();
    expect(() => createLocalClientGovernedExecutionApi({
      executionPreview: setup.executionPreview,
      routePlanStore: setup.routePlanStore,
      approvalGate: { approve: setup.approve },
      executionIdempotency: { execute: setup.idempotentExecute },
      orchestrator: { getStatus: setup.getStatus, cancel: setup.cancel },
    }, { now: "invalid" as never })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_GOVERNED_API_CONFIG_INVALID",
    }));
  });
});

function harness(options: {
  target?: ResolvedVerifiedLocalClientPreviewTarget;
  approvalOverrides?: Record<string, unknown>;
  executionOutcome?: LocalClientIdempotentExecutionOutcome;
  idempotencyThrows?: boolean;
} = {}) {
  const routePlanStore = createLocalClientRoutePlanStore({ ttlMs: 60_000, now: () => CLOCK });
  const adapterRegistry = createLocalClientAdapterRegistry();
  adapterRegistry.register(governedAdapter());
  const resolveVerifiedTarget = vi.fn(async () => options.target ?? verifiedTarget());
  const executionPreview = createLocalClientExecutionPreview({
    routePlanStore,
    adapterRegistry,
    resolveVerifiedTarget,
  }, { policyVersion: "local-client-policy-v2" });
  const approve = vi.fn(async (input: Record<string, any>) => ({
    success: true,
    status: "approved",
    approval: {
      schemaVersion: 4,
      approvalId: "appr_0123456789abcdef",
      planId: input.planId,
      tenantId: input.tenantId,
      userId: input.userId,
      planDigest: input.planDigest,
      approvedScopes: input.approvedScopes,
      note: input.note ?? "",
      status: "approved",
      approvedAt: new Date(CLOCK).toISOString(),
      expiresAt: new Date(CLOCK + 30_000).toISOString(),
      revoked: false,
      ...options.approvalOverrides,
    },
  }));
  const idempotentExecute = vi.fn(async () => {
    if (options.idempotencyThrows) throw new Error("backend secret");
    return options.executionOutcome ?? completedOutcome();
  });
  const getStatus = vi.fn(async (input: { subjectId: string }) => {
    if (input.subjectId !== SUBJECT_ID) {
      throw Object.assign(new Error("private authorization details"), {
        code: "LOCAL_CLIENT_EXECUTION_FORBIDDEN",
        statusCode: 403,
      });
    }
    return {
      success: true,
      planId: EXECUTION_ID,
      status: "running",
      cancelRequested: false,
      pauseRequested: false,
      completedAgents: 0,
      startedAt: "2026-08-28T00:00:00.000Z",
      completedAt: null,
      transitions: [{ reason: "sensitive transition reason" }],
    };
  });
  const cancel = vi.fn(async () => ({
    success: true,
    status: "running",
    cancelRequested: true,
    message: "backend message",
  }));
  const setup = {
    routePlanStore,
    executionPreview,
    resolveVerifiedTarget,
    approve,
    idempotentExecute,
    getStatus,
    cancel,
  };
  return { ...setup, api: createApi(setup) };
}

function createApi(
  setup: {
    routePlanStore: LocalClientGovernedExecutionApiDependencies["routePlanStore"];
    executionPreview: LocalClientGovernedExecutionApiDependencies["executionPreview"];
    approve: LocalClientGovernedExecutionApiDependencies["approvalGate"]["approve"];
    idempotentExecute: LocalClientGovernedExecutionApiDependencies["executionIdempotency"]["execute"];
    getStatus: LocalClientGovernedExecutionApiDependencies["orchestrator"]["getStatus"];
    cancel: LocalClientGovernedExecutionApiDependencies["orchestrator"]["cancel"];
  },
  overrides: Partial<LocalClientGovernedExecutionApiDependencies> = {},
) {
  return createLocalClientGovernedExecutionApi({
    executionPreview: setup.executionPreview,
    routePlanStore: setup.routePlanStore,
    approvalGate: { approve: setup.approve },
    executionIdempotency: { execute: setup.idempotentExecute },
    orchestrator: { getStatus: setup.getStatus, cancel: setup.cancel },
    ...overrides,
  }, { now: () => CLOCK });
}

function previewRequest(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    subjectId: SUBJECT_ID,
    clientId: "desktop-agent",
    capabilityId: "document_open",
    actionId: "open_document",
    input: { documentId: RAW_INPUT_VALUE },
    ...overrides,
  };
}

function governedAdapter(): LocalClientAdapter {
  return {
    descriptor: {
      descriptorVersion: "local-client-adapter-descriptor-v1",
      id: "loopback.desktop-agent",
      type: "loopback-hmac",
      version: "1.2.0",
      actions: [{
        actionId: "open_document",
        capabilityId: "document_open",
        inputSchema: {
          schemaId: "local.desktop.open-document.v1",
          schemaVersion: 1,
          fields: [{ name: "documentId", valueType: "string", required: true }],
          additionalProperties: false,
        },
      }],
    },
    async execute(invocation) {
      return {
        receiptVersion: "local-client-adapter-receipt-v2",
        receiptId: "receipt_governed_api_0001",
        executionId: invocation.executionId,
        adapterId: "loopback.desktop-agent",
        adapterType: "loopback-hmac",
        adapterVersion: "1.2.0",
        clientId: invocation.client.clientId,
        capabilityId: invocation.capabilityId,
        actionId: invocation.actionId,
        planFingerprint: "a".repeat(64),
        executionMode: "governed",
        externalEffectPerformed: true,
        status: "completed",
      };
    },
  };
}

function verifiedTarget(): ResolvedVerifiedLocalClientPreviewTarget {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: "desktop-agent",
    revision: 7,
    state: "verified",
    trustDecision: "verified",
    adapter: {
      id: "loopback.desktop-agent",
      type: "loopback-hmac",
      version: "1.2.0",
    },
    capabilityIds: ["document_open"],
  };
}

function completedOutcome(): LocalClientIdempotentExecutionOutcome {
  return {
    accepted: true,
    status: "completed",
    statusCode: 200,
    idempotencyStatus: "created",
    replayed: false,
    replayable: true,
    operationInvoked: true,
    retryAllowed: false,
    result: {
      status: "completed",
      executionId: EXECUTION_ID,
      planId: "a".repeat(64),
      planFingerprint: "a".repeat(64),
      reservationFingerprint: "c".repeat(64),
      externalEffectCommitted: true,
      retryAllowed: false,
      receipt: {
        receiptVersion: "local-client-adapter-receipt-v2",
        receiptId: "receipt:governed:api:0001",
        executionId: EXECUTION_ID,
        adapterId: "loopback.desktop-agent",
        adapterType: "loopback-hmac",
        adapterVersion: "1.2.0",
        clientId: "desktop-agent",
        capabilityId: "document_open",
        actionId: "open_document",
        planFingerprint: "a".repeat(64),
        executionMode: "governed",
        externalEffectPerformed: true,
        status: "completed",
      },
      feedback: {
        source: "verified-governed-receipt",
        eventId: `lcfb-${"f".repeat(64)}`,
        attempted: true,
        persisted: true,
        exactlyOnce: true,
        replayed: false,
        deliveryStatus: "persisted",
        errorCode: null,
      },
    },
  };
}
