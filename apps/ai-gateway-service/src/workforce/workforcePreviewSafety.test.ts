import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWorkforceService } from "./workforceService.js";
import { sealWorkforcePreviewSafety } from "./workforcePlanStore-utils.js";

const FALSE_FIELD = /^(?:(?:.*execution|runner|workflowRun|externalRunnerDispatch|autoDispatch|autoRun|autoApply|autoMerge|autoCommit)Enabled|workerExecution|drivesExecution|grantsExecution|approvalPreviewIsExecutionPermission|realAgentExecution|realLlmCalls|agentConcurrency|codeExecution|projectFileWrites|workflowRun|createsWorktrees|runsOhMyCodex)$/i;

function collectCapabilityViolations(value: unknown, path = "$", violations: string[] = []): string[] {
  if (!value || typeof value !== "object") return violations;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectCapabilityViolations(item, `${path}[${index}]`, violations));
    return violations;
  }

  Object.entries(value).forEach(([key, item]) => {
    const itemPath = `${path}.${key}`;
    if (key === "previewOnly" && item !== true) violations.push(itemPath);
    if (FALSE_FIELD.test(key) && item !== false) violations.push(itemPath);
    if (key === "execution" && item === "enabled") violations.push(itemPath);
    collectCapabilityViolations(item, itemPath, violations);
  });
  return violations;
}

function expectSealed(value: unknown): void {
  expect(collectCapabilityViolations(value)).toEqual([]);
  expect(value).toMatchObject({
    workforcePreviewSafety: {
      version: "workforce-preview-safety-v1",
      sealed: true,
      previewOnly: true,
      executionEnabled: false,
      runnerEnabled: false,
      workflowRunEnabled: false,
      externalRunnerDispatchEnabled: false,
      approvalPreviewGrantsExecution: false,
    },
  });
}

describe("workforce preview safety contract", () => {
  it("seals every machine-readable execution capability in generated plans", () => {
    const service = createWorkforceService();
    const plan = service.plan({ goal: "Review an isolated implementation plan" });

    expectSealed(plan);
    expectSealed(plan.exportableJson);
    expect(plan.markdown).not.toContain("Execution enabled: true");
    expect(plan.markdown).not.toContain("Runner enabled: true");
    expect(plan.markdown).not.toContain("Workflow run enabled: true");
    expect(plan.markdown).not.toContain("ready for real execution");
    expect(plan.markdown).toContain("Execution disabled.");
  });

  it("overrides forged capability flags before save, approval, retrieval, and export", async () => {
    const storePath = join(mkdtempSync(join(tmpdir(), "workforce-preview-safety-")), "plans.json");
    const tenantId = "workforce-preview-safety";
    const service = createWorkforceService({ env: { WORKFORCE_PLAN_STORE_PATH: storePath } });
    const plan = service.plan({ goal: "Persist a fail-closed workforce preview" });

    plan.executionReadinessPreflight.executionEnabled = true;
    plan.agentWorkforcePreviewFinalUxSeal.runnerEnabled = true;
    plan.agentWorkforcePreviewFinalUxSeal.workflowRunEnabled = true;
    plan.runnerRequestQueuePreview.queuePolicy.externalRunnerDispatchEnabled = true;
    plan.eventLedgerPreview[0].execution = "enabled";
    plan.safety.previewOnly = false;

    const saved = await service.savePlan({ plan }, tenantId);
    expectSealed(saved.taskPackage);

    const approved = await service.recordPlanApprovalGate(saved.planId, {
      decision: "approved-preview",
      reviewer: "contract-test",
    }, tenantId);
    expect(approved.decision).toBe("approved-preview");
    expectSealed(approved.taskPackage);

    const retrieved = await service.getPlan(saved.planId, tenantId);
    expectSealed(retrieved.taskPackage);
    expectSealed(retrieved.plan);

    const exported = await service.exportPlan(saved.planId, tenantId);
    expectSealed(exported.taskPackage);
    expect(exported.markdown).not.toContain("Execution enabled: true");
    expect(exported.markdown).not.toContain("Runner enabled: true");
    expect(exported.markdown).not.toContain("ready for real execution");
    expect(exported.markdown).toContain("Execution disabled.");
  });

  it("rejects cyclic inputs instead of overflowing or partially sealing them", () => {
    const cyclic: Record<string, unknown> = { goal: "cycle" };
    cyclic.self = cyclic;

    expect(() => sealWorkforcePreviewSafety(cyclic)).toThrowError(
      expect.objectContaining({ code: "WORKFORCE_PREVIEW_SAFETY_CYCLE" }),
    );
  });
});
