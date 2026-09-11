import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { WorkflowExecutionCallbacks } from "./durableWorkflowRunStore.ts";

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
    policyHash: `sha256:${"a".repeat(64)}`,
    grantedTools: ["file_write"], toolDecisions: { file_write: "allow" },
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
        assertActive: vi.fn(async () => true),
        release: runRelease,
      },
    })),
    reserveUsage: vi.fn(async () => ({ allowed: true })),
    emitAudit: vi.fn(async () => {}),
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
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const content = "# A controlled report\nThe reviewed local content.\n";
  const material = { workflowId: "workflow-1", inputHash: "b".repeat(64),
    subjectFingerprint: hash(JSON.stringify(["workflow-owner-v1", IDENTITY.tenantId, IDENTITY.userId])),
    tenantPartition: `tenant-${hash(IDENTITY.tenantId).slice(0, 24)}`, requestedName: "report.md",
    target: { fileName: "report.md", rootFingerprint: "c".repeat(64), tenantFingerprint: "d".repeat(64), fingerprint: "e".repeat(64) },
    contentHash: hash(content), contentBytes: Buffer.byteLength(content), content };
  const publish = vi.fn();
  const workflowService = {
    run: vi.fn(async (_request: unknown, _context: unknown, callbacks?: WorkflowExecutionCallbacks) => {
      await callbacks!.beforePublish(material); publish(); return workflowResult;
    }),
  };
  return {
    governance: { service, toolProxy },
    workflowService,
    workflowResult,
    runController,
    runRelease,
    toolRelease,
    material, publish, policy,
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
    expect(harness.governance.toolProxy.enforce).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({ content_sha256: harness.material.contentHash }),
      resourceContext: expect.objectContaining({ approvalReview: expect.objectContaining({ workflow: expect.objectContaining({ content: harness.material.content }) }) }),
    }));
    expect(harness.workflowService.run).toHaveBeenCalledWith(
      expect.not.objectContaining({ agentId: expect.anything() }),
      expect.objectContaining({ tenantId: "tenant-a", signal: expect.anything() }),
      expect.objectContaining({ beforePublish: expect.any(Function), beforeReplay: expect.any(Function) }),
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
    expect(harness.workflowService.run).toHaveBeenCalledOnce();
    expect(harness.publish).not.toHaveBeenCalled();
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

  it("refuses a service that returns a new result without either trusted callback", async () => {
    const harness = createHarness();
    harness.workflowService.run = vi.fn(async () => harness.workflowResult);
    await expect(executeGovernedWorkflowRun({ governance: harness.governance as never, workflowService: harness.workflowService,
      identity: IDENTITY, body: { agentId: "agt_workflow", goal: "report" }, requestContext: {} })).rejects.toMatchObject({ code: "WORKFLOW_GOVERNANCE_CALLBACK_REQUIRED" });
    expect(harness.governance.toolProxy.enforce).not.toHaveBeenCalled();
  });

  it("returns the real pending approval identity without reaching publication", async () => {
    const harness = createHarness();
    harness.governance.toolProxy.enforce.mockResolvedValueOnce({ outcome: "approval_required", code: "TOOL_APPROVAL_REQUIRED", approvalId: "appr_pending" } as never);
    await expect(executeGovernedWorkflowRun({ governance: harness.governance as never, workflowService: harness.workflowService,
      identity: IDENTITY, body: { agentId: "agt_workflow", goal: "report" }, requestContext: {} })).rejects.toMatchObject({
        code: "TOOL_APPROVAL_REQUIRED", statusCode: 409, details: { approvalId: "appr_pending", workflowId: "workflow-1" },
      });
    expect(harness.publish).not.toHaveBeenCalled(); expect(harness.runRelease).toHaveBeenCalledOnce();
  });

  it("rejects a consumed approval whose material differs before invoking the file effect", async () => {
    const harness = createHarness();
    harness.policy.toolDecisions.file_write = "require_approval";
    harness.governance.toolProxy.enforce.mockResolvedValueOnce({ outcome: "allow", policy: harness.policy, executionLease: { release: harness.toolRelease },
      approvalId: "appr_consumed", approvedParams: { file_path: "different.md" }, approvalReview: {} } as never);
    await expect(executeGovernedWorkflowRun({ governance: harness.governance as never, workflowService: harness.workflowService,
      identity: IDENTITY, body: { agentId: "agt_workflow", goal: "report" }, requestContext: {} })).rejects.toMatchObject({ code: "WORKFLOW_APPROVED_MATERIAL_MISMATCH" });
    expect(harness.publish).not.toHaveBeenCalled(); expect(harness.toolRelease).toHaveBeenCalledOnce();
  });

  it.each(["toolRelease", "runRelease"] as const)("does not confirm publication when %s fails", async (lease) => {
    const harness = createHarness(); harness[lease].mockImplementationOnce(() => { throw new Error("Synthetic release failure"); });
    await expect(executeGovernedWorkflowRun({ governance: harness.governance as never, workflowService: harness.workflowService,
      identity: IDENTITY, body: { agentId: "agt_workflow", goal: "report" }, requestContext: {} })).rejects.toMatchObject({
        code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN", outcomeUnknown: true,
      });
    expect(harness.publish).toHaveBeenCalledOnce(); expect(harness.toolRelease).toHaveBeenCalledOnce(); expect(harness.runRelease).toHaveBeenCalledOnce();
  });
});
