import { describe, expect, it, vi } from "vitest";

import { createWorkforceRoutes } from "../http/workforceRoutes.js";

const PLAN_DIGEST = "a".repeat(64);

function governedRouteFixture(overrides: Record<string, any> = {}) {
  const controller = new AbortController();
  const runRelease = vi.fn(() => overrides.events?.push("run-release"));
  const toolRelease = vi.fn(() => overrides.events?.push("tool-release"));
  const policy = overrides.policy ?? {
    policyHash: "policy-hash",
    limits: { maxSteps: 20, maxWorkforceRoles: 8, maxRuntimeSeconds: 60 },
  };
  const authorizeAgentExecution = overrides.authorizeAgentExecution ?? vi.fn(async () => ({
    record: { agentId: "agt_root_1", parentAgentId: null, generationDepth: 0, status: "ACTIVE" },
    policy,
    executionLease: {
      signal: controller.signal,
      fingerprint: "run-fingerprint",
      assertActive: vi.fn(async () => true),
      release: runRelease,
    },
  }));
  const reserveUsage = vi.fn(async () => ({ allowed: true }));
  const service = {
    authorizeAgentExecution,
    getUsage: vi.fn(async () => ({ toolCalls: 0, steps: 3, records: 0 })),
    reserveUsage,
  };
  const enforce = overrides.enforce ?? vi.fn(async () => ({
    outcome: "allow",
    executionLease: { release: toolRelease },
  }));
  const enforceResult = overrides.enforceResult ?? vi.fn(async ({ result }) => {
    overrides.events?.push("result-enforced");
    return { verdict: "allow", result };
  });
  const workforceExecutor = {
    describeExecution: vi.fn(async () => ({
      planId: "plan-1",
      planDigest: PLAN_DIGEST,
      autonomyMode: "controlled-execution",
      requiredScopes: ["workforce:execute"],
    })),
    execute: overrides.execute ?? vi.fn(async () => ({ success: true, executionStatus: "completed" })),
  };
  const writeJson = vi.fn();
  const writeErrorResponse = vi.fn();
  const routes = createWorkforceRoutes({
    agentGovernance: { service, toolProxy: { enforce, enforceResult } },
    workforceExecutor,
    workforceService: {},
    workflowService: {},
  }, {
    readCapabilityJson: vi.fn(),
    writeJson,
    writeServiceLog: vi.fn(),
    writeErrorResponse,
    createOkEnvelope: (value: unknown) => value,
    createErrorEnvelope: vi.fn(),
  });
  const handler = (routes.handlers.get("POST /workforce/execute") as any).handler;
  const request = {
    enterpriseIdentity: {
      tenantId: "tenant-server",
      userId: "user-server",
      role: "developer",
      permissions: ["workflow:run"],
    },
  };
  return {
    controller,
    enforce,
    enforceResult,
    handler,
    request,
    reserveUsage,
    runRelease,
    toolRelease,
    workforceExecutor,
    writeErrorResponse,
    writeJson,
    authorizeAgentExecution,
  };
}

async function invoke(fixture: ReturnType<typeof governedRouteFixture>, body: Record<string, unknown>) {
  await fixture.handler(fixture.request, {}, { startedAt: new Date(), body });
}

describe("governed POST /workforce/execute", () => {
  it("preserves the legacy request contract without agentId when governance is disabled", async () => {
    const execute = vi.fn(async (input) => ({ success: true, input }));
    const writeJson = vi.fn();
    const routes = createWorkforceRoutes({
      agentGovernance: null,
      workforceExecutor: { execute },
      workforceService: {},
      workflowService: {},
    }, {
      readCapabilityJson: vi.fn(),
      writeJson,
      writeServiceLog: vi.fn(),
      writeErrorResponse: vi.fn(),
      createOkEnvelope: (value: unknown) => value,
      createErrorEnvelope: vi.fn(),
    });
    const request = {
      enterpriseIdentity: { tenantId: "tenant-server", userId: "user-server" },
    };

    await (routes.handlers.get("POST /workforce/execute") as any).handler(request, {}, {
      startedAt: new Date(),
      body: { goal: "legacy controlled execution" },
    });

    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      goal: "legacy controlled execution",
      tenantId: "tenant-server",
      userId: "user-server",
    }));
    expect(writeJson).toHaveBeenCalledWith({}, 200, expect.objectContaining({ success: true }));
  });

  it("server-binds identity, proxies only digests/options, meters the result and releases both leases", async () => {
    const events: string[] = [];
    const fixture = governedRouteFixture({ events });
    await invoke(fixture, {
      agentId: "agt_root_1",
      goal: "sensitive operator goal",
      userId: "attacker",
      tenantId: "tenant-attacker",
      autonomyMode: "controlled-execution",
    });

    expect(fixture.authorizeAgentExecution).toHaveBeenCalledWith("agt_root_1", expect.objectContaining({
      agentId: "agt_root_1",
      tenantId: "tenant-server",
      userId: "user-server",
      permissions: ["workflow:run"],
    }));
    const proxyCall = fixture.enforce.mock.calls[0][0];
    expect(proxyCall.toolName).toBe("workforce_execute");
    expect(Object.keys(proxyCall.params).sort()).toEqual([
      "goal", "goalBytes", "goalDigest", "options", "planDigest", "planId",
    ]);
    expect(proxyCall.params.planDigest).toBe(PLAN_DIGEST);
    expect(proxyCall.params.goal).toBe("sensitive operator goal");
    expect(proxyCall.resourceContext.approvalReview).toMatchObject({
      reviewable: true,
      effectType: "workforce:execute",
      workforce: {
        goal: "sensitive operator goal",
        planId: "plan-1",
        planDigest: `sha256:${PLAN_DIGEST}`,
        requiredScopes: ["workforce:execute"],
      },
    });
    expect(fixture.workforceExecutor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-server", userId: "user-server" }),
      expect.objectContaining({ agentGovernance: expect.objectContaining({ remainingSteps: 17 }) }),
    );
    expect(fixture.enforceResult).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "workforce_execute",
      descriptor: null,
    }));
    expect(events).toEqual(["result-enforced", "tool-release", "run-release"]);
    expect(fixture.writeJson).toHaveBeenCalledWith({}, 200, expect.objectContaining({ success: true }));
  });

  it("marks a completed Workforce run uncertain when terminal governance fails", async () => {
    const fixture = governedRouteFixture({
      enforceResult: vi.fn(async () => {
        throw Object.assign(new Error("outcome audit unavailable"), {
          code: "GOVERNANCE_AUDIT_REQUIRED",
        });
      }),
      execute: vi.fn(async () => ({
        success: true,
        executionStatus: "completed",
        executionId: "workforce-execution-1",
        planId: "plan-1",
      })),
    });
    await invoke(fixture, { agentId: "agt_root_1", goal: "completed effect" });

    expect(fixture.workforceExecutor.execute).toHaveBeenCalledOnce();
    expect(fixture.writeJson).not.toHaveBeenCalled();
    expect(fixture.writeErrorResponse.mock.calls[0][0].error).toMatchObject({
      code: "WORKFORCE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN",
      statusCode: 503,
      retryable: false,
      details: {
        outcomeUnknown: true,
        retrySafe: false,
        reconciliation: {
          required: true,
          agentId: "agt_root_1",
          planId: "plan-1",
          planDigest: PLAN_DIGEST,
          executionId: "workforce-execution-1",
        },
      },
    });
    expect(fixture.toolRelease).toHaveBeenCalledOnce();
    expect(fixture.runRelease).toHaveBeenCalledOnce();
  });

  it("requires agentId before authorization when governance is enabled", async () => {
    const fixture = governedRouteFixture();
    await invoke(fixture, { goal: "preview" });
    expect(fixture.authorizeAgentExecution).not.toHaveBeenCalled();
    expect(fixture.workforceExecutor.execute).not.toHaveBeenCalled();
    expect(fixture.writeErrorResponse.mock.calls[0][0].error).toMatchObject({
      code: "WORKFORCE_GOVERNANCE_IDENTITY_REQUIRED",
    });
  });

  it("returns HTTP 202 with a reviewable top-level Workforce approval and performs zero execution", async () => {
    const fixture = governedRouteFixture({
      enforce: vi.fn(async () => ({
        outcome: "approval_required",
        code: "TOOL_APPROVAL_REQUIRED",
        approvalId: "appr_workforce_1",
      })),
    });
    await invoke(fixture, { agentId: "agt_root_1", goal: "Review this controlled execution." });

    expect(fixture.workforceExecutor.execute).not.toHaveBeenCalled();
    expect(fixture.writeJson).toHaveBeenCalledWith({}, 202, expect.objectContaining({
      outcome: "approval_required",
      approvalId: "appr_workforce_1",
      planId: "plan-1",
      planDigest: PLAN_DIGEST,
    }));
    expect(fixture.runRelease).toHaveBeenCalledOnce();
  });

  it("rejects an approved envelope that differs from the canonical retry descriptor", async () => {
    const fixture = governedRouteFixture({
      enforce: vi.fn(async (request) => ({
        outcome: "allow",
        policy: { policyHash: "policy-hash", limits: { maxSteps: 20 } },
        executionLease: { release: vi.fn() },
        approvedParams: { ...request.params, goal: "different reviewed goal" },
      })),
    });
    await invoke(fixture, { agentId: "agt_root_1", goal: "Retry goal" });

    expect(fixture.workforceExecutor.execute).not.toHaveBeenCalled();
    expect(fixture.writeErrorResponse.mock.calls[0][0].error).toMatchObject({
      code: "WORKFORCE_APPROVED_PARAMS_INVALID",
      statusCode: 409,
    });
  });

  it.each([
    ["cross-tenant", "AGENT_NOT_FOUND"],
    ["revoked", "AGENT_NOT_ACTIVE"],
  ])("keeps the executor at zero for %s Agent authorization", async (_label, code) => {
    const authorizeAgentExecution = vi.fn(async () => {
      throw Object.assign(new Error("denied"), { code, statusCode: 403 });
    });
    const fixture = governedRouteFixture({ authorizeAgentExecution });
    await invoke(fixture, { agentId: "agt_root_1", goal: "preview" });
    expect(fixture.workforceExecutor.execute).not.toHaveBeenCalled();
    expect(fixture.writeErrorResponse.mock.calls[0][0].error).toMatchObject({ code });
  });

  it("rejects a real child Agent record, releases its run lease, and keeps the executor at zero", async () => {
    const runRelease = vi.fn();
    const authorizeAgentExecution = vi.fn(async () => ({
      record: { agentId: "agt_child_1", parentAgentId: "agt_root_1", generationDepth: 1, status: "ACTIVE" },
      policy: { policyHash: "policy-child", limits: { maxWorkforceRoles: 8 } },
      executionLease: {
        signal: new AbortController().signal,
        assertActive: vi.fn(async () => true),
        release: runRelease,
      },
    }));
    const fixture = governedRouteFixture({ authorizeAgentExecution });
    await invoke(fixture, { agentId: "agt_child_1", goal: "must stay at zero" });
    expect(fixture.workforceExecutor.execute).not.toHaveBeenCalled();
    expect(fixture.enforce).not.toHaveBeenCalled();
    expect(runRelease).toHaveBeenCalledOnce();
    expect(fixture.writeErrorResponse.mock.calls[0][0].error).toMatchObject({
      code: "WORKFORCE_ROOT_AGENT_REQUIRED",
      statusCode: 403,
    });
  });

  it.each([
    ["policy deny", { outcome: "deny", code: "TOOL_DENIED_BY_POLICY", reason: "denied" }],
    ["tool lease failure", { outcome: "allow" }],
  ])("keeps the executor at zero on Tool Proxy %s", async (_label, verdict) => {
    const fixture = governedRouteFixture({ enforce: vi.fn(async () => verdict) });
    await invoke(fixture, { agentId: "agt_root_1", goal: "preview" });
    expect(fixture.workforceExecutor.execute).not.toHaveBeenCalled();
    expect(fixture.runRelease).toHaveBeenCalledOnce();
  });
});
