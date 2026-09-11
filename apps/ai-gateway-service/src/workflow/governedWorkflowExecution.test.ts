import { describe, expect, it, vi } from "vitest";

import { executeGovernedWorkflowRun } from "./governedWorkflowExecution.ts";

const IDENTITY = {
  tenantId: "tenant-a",
  userId: "owner-a",
  permissions: ["workflow:run"],
};

function createHarness() {
  const runRelease = vi.fn();
  const toolRelease = vi.fn();
  const runController = new AbortController();
  const policy = {
    policyHash: "sha256:workflow-policy",
    limits: { maxToolCalls: 5 },
    scope: {},
    requirements: {},
    mandatory: {},
  };
  const service = {
    authorizeAgentExecution: vi.fn(async () => ({
      record: { agentId: "agt_workflow", tenantId: "tenant-a", status: "ACTIVE" },
      policy,
      executionLease: {
        signal: runController.signal,
        release: runRelease,
      },
    })),
  };
  const toolProxy = {
    enforce: vi.fn(async (_input: unknown) => ({
      outcome: "allow",
      policy,
      executionLease: { signal: runController.signal, release: toolRelease },
    })),
    enforceResult: vi.fn(async ({ result }: { result: unknown }) => ({
      verdict: "allow",
      code: "RECORD_METER_OK",
      deliveredRecordCount: 0,
      result,
    })),
  };
  const workflowResult = {
    status: "completed",
    workflowId: "workflow-1",
    artifact: { fileName: "report.md", sha256: "a".repeat(64) },
  };
  const workflowService = {
    run: vi.fn(async () => workflowResult),
  };
  return {
    governance: { service, toolProxy },
    workflowService,
    workflowResult,
    runController,
    runRelease,
    toolRelease,
  };
}

describe("governed local workflow execution", () => {
  it("requires agentId before authorization", async () => {
    const harness = createHarness();
    await expect(executeGovernedWorkflowRun({
      governance: harness.governance as never,
      workflowService: harness.workflowService,
      identity: IDENTITY,
      body: { goal: "write a controlled report" },
      requestContext: { tenantId: "tenant-a" },
    })).rejects.toMatchObject({ code: "WORKFLOW_AGENT_ID_REQUIRED", statusCode: 400 });
    expect(harness.governance.service.authorizeAgentExecution).not.toHaveBeenCalled();
    expect(harness.workflowService.run).not.toHaveBeenCalled();
  });

  it("server-binds tenant identity and routes the artifact through file_write governance", async () => {
    const harness = createHarness();
    const result = await executeGovernedWorkflowRun({
      governance: harness.governance as never,
      workflowService: harness.workflowService,
      identity: IDENTITY,
      body: {
        agentId: "agt_workflow",
        goal: "write a controlled report",
        artifactName: "report.md",
        tenantId: "attacker",
      },
      requestContext: { tenantId: "attacker", tenantScopeIdentity: { tenantId: "attacker" } },
      requestId: "workflow-request-1",
    });

    expect(result).toEqual(harness.workflowResult);
    expect(harness.governance.service.authorizeAgentExecution).toHaveBeenCalledWith("agt_workflow", {
      tenantId: "tenant-a",
      userId: "owner-a",
      permissions: ["workflow:run"],
      requestId: "workflow-request-1",
    });
    expect(harness.governance.toolProxy.enforce).toHaveBeenCalledWith(expect.objectContaining({
      toolName: "file_write",
      context: expect.objectContaining({ tenantId: "tenant-a", agentId: "agt_workflow" }),
      params: expect.objectContaining({
        file_path: expect.stringContaining(".data/workflows/tenant-"),
        content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    }));
    expect(JSON.stringify(harness.governance.toolProxy.enforce.mock.calls[0][0])).not.toContain("write a controlled report");
    expect(harness.workflowService.run).toHaveBeenCalledWith(
      expect.not.objectContaining({ agentId: expect.anything() }),
      expect.objectContaining({ tenantId: "tenant-a", signal: expect.anything() }),
    );
    expect(harness.governance.toolProxy.enforceResult).toHaveBeenCalledOnce();
    expect(harness.toolRelease).toHaveBeenCalledOnce();
    expect(harness.runRelease).toHaveBeenCalledOnce();
  });

  it("releases both leases and performs no write when cancellation lands during Tool Proxy admission", async () => {
    const harness = createHarness();
    const controller = new AbortController();
    let resolveAdmission!: (value: unknown) => void;
    harness.governance.toolProxy.enforce = vi.fn(() => new Promise((resolve) => {
      resolveAdmission = resolve;
    })) as never;
    const pending = executeGovernedWorkflowRun({
      governance: harness.governance as never,
      workflowService: harness.workflowService,
      identity: IDENTITY,
      body: { agentId: "agt_workflow", goal: "cancel before write" },
      requestContext: { tenantId: "tenant-a" },
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(harness.governance.toolProxy.enforce).toHaveBeenCalledOnce());
    controller.abort(Object.assign(new Error("client disconnected"), {
      code: "CLIENT_DISCONNECTED",
      statusCode: 499,
    }));
    resolveAdmission({
      outcome: "allow",
      policy: { policyHash: "sha256:workflow-policy" },
      executionLease: { release: harness.toolRelease },
    });

    await expect(pending).rejects.toMatchObject({ code: "CLIENT_DISCONNECTED", statusCode: 499 });
    expect(harness.workflowService.run).not.toHaveBeenCalled();
    expect(harness.toolRelease).toHaveBeenCalledOnce();
    expect(harness.runRelease).toHaveBeenCalledOnce();
  });

  it("marks a published artifact outcome unknown when result governance fails", async () => {
    const harness = createHarness();
    harness.governance.toolProxy.enforceResult.mockRejectedValueOnce(new Error("result store unavailable"));

    await expect(executeGovernedWorkflowRun({
      governance: harness.governance as never,
      workflowService: harness.workflowService,
      identity: IDENTITY,
      body: { agentId: "agt_workflow", goal: "publish then fail result governance" },
      requestContext: { tenantId: "tenant-a" },
    })).rejects.toMatchObject({
      code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN",
      outcomeUnknown: true,
      retryable: false,
      details: expect.objectContaining({
        artifactFileName: "report.md",
        artifactSha256: "a".repeat(64),
      }),
    });
    expect(harness.toolRelease).toHaveBeenCalledOnce();
    expect(harness.runRelease).toHaveBeenCalledOnce();
  });
});
