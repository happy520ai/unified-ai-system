import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runRealTaskWorkforceDryRun } from "../../apps/ai-gateway-service/src/workforce-preview/workforcePreviewService.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase576f");
const resultPath = resolve(evidenceDir, "real-task-workforce-dry-run-no-provider-result.json");

const dryRun = runRealTaskWorkforceDryRun();
const result = {
  phase: "Phase576F",
  name: "Real Task Workforce Dry-Run Without Provider Call",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  realTaskDryRunExecuted: dryRun.realTaskDryRunExecuted,
  taskUnderstandingExists: Boolean(dryRun.taskUnderstanding?.taskType),
  selectedPyramidPathExists: Array.isArray(dryRun.selectedPyramidPath) && dryRun.selectedPyramidPath.length > 0,
  candidateEmployeesCount: dryRun.candidateEmployees.length,
  activeEmployeesCount: dryRun.activeEmployees.length,
  rejectedEmployeesRecorded: Array.isArray(dryRun.rejectedEmployees) && dryRun.rejectedEmployees.length > 0,
  fanoutPolicyApplied: dryRun.fanoutPolicy.maxCandidateEmployees <= 5 && dryRun.fanoutPolicy.maxActiveEmployees <= 3,
  brainBindingPreviewExists: Array.isArray(dryRun.brainBindingPreview) && dryRun.brainBindingPreview.length === dryRun.activeEmployees.length,
  providerCallsMade: dryRun.providerCallsMade,
  rawSecretAccessed: dryRun.rawSecretAccessed,
  secretValueExposed: dryRun.secretValueExposed,
  deployExecuted: dryRun.deployExecuted,
  billingExecuted: dryRun.billingExecuted,
  invoiceGenerated: dryRun.invoiceGenerated,
  evidenceTimelineExists: Array.isArray(dryRun.evidenceTimeline) && dryRun.evidenceTimeline.length >= 5,
  finalRecommendedPlanExists: Array.isArray(dryRun.finalRecommendedPlan) && dryRun.finalRecommendedPlan.length >= 3,
  serviceFilesExist: exists("apps/ai-gateway-service/src/workforce-preview/workforcePreviewService.js") &&
    exists("apps/ai-gateway-service/src/workforce-preview/workforcePreviewEvidence.js") &&
    exists("apps/ai-gateway-service/src/entrypoints/verifyPhase576fWorkforceDryRun.js"),
  dryRun,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
};

const checksPassed =
  result.realTaskDryRunExecuted &&
  result.taskUnderstandingExists &&
  result.selectedPyramidPathExists &&
  result.candidateEmployeesCount <= 5 &&
  result.activeEmployeesCount <= 3 &&
  result.rejectedEmployeesRecorded &&
  result.fanoutPolicyApplied &&
  result.brainBindingPreviewExists &&
  result.providerCallsMade === false &&
  result.rawSecretAccessed === false &&
  result.secretValueExposed === false &&
  result.deployExecuted === false &&
  result.billingExecuted === false &&
  result.invoiceGenerated === false &&
  result.evidenceTimelineExists &&
  result.finalRecommendedPlanExists &&
  result.serviceFilesExist;

result.completed = checksPassed;
result.recommended_sealed = checksPassed;
result.blocker = checksPassed ? null : "phase576f_real_task_workforce_dry_run_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}
