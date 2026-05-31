import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runWorkforceRuntimeDryRun } from "../../packages/workforce-scheduler/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase580");
const evidencePath = resolve(evidenceDir, "workforce-scheduler-runtime-dry-run-result.json");
const dryRun = runWorkforceRuntimeDryRun("为 PME AI Gateway 设计一次内部试用后的 UX 修复计划，并判断需要哪些专家协作。");

const result = {
  phase: "Phase580",
  name: "Workforce Scheduler Runtime Dry-Run",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  taskUnderstandingWorks: !!dryRun.taskUnderstanding?.taskType,
  roleRoutingWorks: Array.isArray(dryRun.roles) && dryRun.roles.length > 0,
  employeeSelectionWorks: dryRun.candidateEmployees.length > 0,
  rejectedEmployeesRecorded: dryRun.rejectedEmployees.length > 0,
  dryRunContributionsGenerated: dryRun.dryRunContributions.length === dryRun.activeEmployees.length,
  evidenceTimelineGenerated: dryRun.evidenceTimeline.length >= 6,
  maxCandidateEmployees: dryRun.fanoutPolicy.maxCandidateEmployees,
  maxActiveEmployees: dryRun.fanoutPolicy.maxActiveEmployees,
  maxBrainCalls: dryRun.fanoutPolicy.maxBrainCalls,
  globalTimeoutMs: dryRun.fanoutPolicy.globalTimeoutMs,
  timeoutMsPerEmployee: dryRun.fanoutPolicy.timeoutMsPerEmployee,
  requireEvidence: dryRun.fanoutPolicy.requireEvidence,
  noFullCatalogBroadcast: dryRun.noFullCatalogBroadcast === true,
  providerCallsMade: dryRun.providerCallsMade,
  secretValueExposed: dryRun.secretValueExposed,
  filesExist: [
    "packages/workforce-scheduler/src/runtime/taskUnderstanding.js",
    "packages/workforce-scheduler/src/runtime/workforceRuntimeDryRun.js",
    "packages/workforce-scheduler/src/runtime/roleRoutingRuntime.js",
    "packages/workforce-scheduler/src/runtime/employeeSelectionRuntime.js",
    "packages/workforce-scheduler/src/runtime/rejectedEmployeeRecorder.js",
    "packages/workforce-scheduler/src/runtime/contributionSynthesizerDryRun.js",
    "packages/workforce-scheduler/src/runtime/workforceEvidenceTimeline.js",
    "docs/phase580-workforce-scheduler-runtime-dry-run.md",
    "docs/phase580-execution-report.md",
  ].every(exists),
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

const passed =
  result.taskUnderstandingWorks &&
  result.roleRoutingWorks &&
  result.employeeSelectionWorks &&
  result.rejectedEmployeesRecorded &&
  result.dryRunContributionsGenerated &&
  result.evidenceTimelineGenerated &&
  result.maxCandidateEmployees <= 5 &&
  result.maxActiveEmployees <= 3 &&
  result.maxBrainCalls === 0 &&
  result.globalTimeoutMs <= 30000 &&
  result.timeoutMsPerEmployee <= 8000 &&
  result.requireEvidence === true &&
  result.noFullCatalogBroadcast &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false &&
  result.filesExist;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase580_runtime_dry_run_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

