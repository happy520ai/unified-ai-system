import { buildGatewayBrainAdapterPreview } from "@unified-ai-system/employee-brain-adapter";
import { runWorkforceDryRun } from "@unified-ai-system/workforce-scheduler";
import { buildWorkforcePreviewEvidence } from "./workforcePreviewEvidence.js";

export const DEFAULT_WORKFORCE_PREVIEW_TASK = "为 PME AI Gateway 设计一次内部试用后的 UX 修复计划，并判断需要哪些专家协作。";

export function runRealTaskWorkforceDryRun(task = DEFAULT_WORKFORCE_PREVIEW_TASK) {
  const schedulerResult = runWorkforceDryRun(task);
  const brainBindingPreview = schedulerResult.activeEmployees.map((employee) =>
    buildGatewayBrainAdapterPreview({ employee, taskUnderstanding: schedulerResult.taskUnderstanding }),
  );
  const finalRecommendedPlan = [
    "Collect user-owner trial friction from the sample dry-run path.",
    "Prioritize P0/P1 blockers before copy or visual polish.",
    "Assign UX Researcher for comprehension, Product Manager for scope, and AI Gateway Engineer for boundary-safe implementation.",
    "Keep provider call, secret access, deploy, billing, and invoice actions disabled until a later authorization gate.",
  ];
  const evidence = buildWorkforcePreviewEvidence({
    schedulerResult,
    brainBindingPreview,
    finalRecommendedPlan,
  });
  return {
    mode: "dry_run",
    realTaskDryRunExecuted: true,
    taskUnderstanding: schedulerResult.taskUnderstanding,
    selectedPyramidPath: schedulerResult.selectedPyramidPath,
    candidateEmployees: schedulerResult.candidateEmployees,
    activeEmployees: schedulerResult.activeEmployees,
    rejectedEmployees: schedulerResult.rejectedEmployees,
    fanoutPolicy: schedulerResult.fanoutPolicy,
    brainBindingPreview,
    noProviderCallBoundary: evidence.noProviderCallBoundary,
    evidenceTimeline: evidence.evidenceTimeline,
    finalRecommendedPlan,
    evidence,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    billingExecuted: false,
    invoiceGenerated: false,
  };
}
