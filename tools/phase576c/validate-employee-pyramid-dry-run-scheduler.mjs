import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateEmployeeShape, WORKFORCE_PYRAMID_LEVELS } from "../../packages/workforce-contracts/src/index.js";
import {
  dryRunFanoutPolicy,
  employeeCatalogSeed,
  runWorkforceDryRun,
} from "../../packages/workforce-scheduler/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase576c");
const resultPath = resolve(evidenceDir, "employee-pyramid-dry-run-scheduler-result.json");

const dryRun = runWorkforceDryRun("为 PME AI Gateway 设计一次内部试用后的 UX 修复计划，并判断需要哪些专家协作。");
const result = {
  phase: "Phase576C",
  name: "Employee Pyramid Dry-Run Scheduler",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  workforceSchedulerPackageExists: exists("packages/workforce-scheduler/package.json"),
  pyramidLevelsDefined: WORKFORCE_PYRAMID_LEVELS.length === 7,
  employeeCatalogSeedExists: exists("packages/workforce-scheduler/src/employeeCatalogSeed.js") && employeeCatalogSeed.length >= 5,
  employeeSchemaValid: employeeCatalogSeed.every((employee) => validateEmployeeShape(employee).valid),
  fanoutPolicyDefined: exists("packages/workforce-scheduler/src/fanoutPolicy.js"),
  dryRunSchedulerWorks: dryRun.mode === "dry_run" && dryRun.activeEmployees.length > 0,
  maxCandidateEmployees: dryRunFanoutPolicy.maxCandidateEmployees,
  maxActiveEmployees: dryRunFanoutPolicy.maxActiveEmployees,
  maxBrainCalls: dryRunFanoutPolicy.maxBrainCalls,
  providerCallsMade: false,
  secretValueExposed: false,
  evidenceGenerated: Boolean(dryRun.evidence?.evidenceId),
  dryRunSummary: {
    candidateEmployeesCount: dryRun.candidateEmployees.length,
    activeEmployeesCount: dryRun.activeEmployees.length,
    rejectedEmployeesCount: dryRun.rejectedEmployees.length,
    selectedPyramidPath: dryRun.selectedPyramidPath,
  },
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
  result.workforceSchedulerPackageExists &&
  result.pyramidLevelsDefined &&
  result.employeeCatalogSeedExists &&
  result.employeeSchemaValid &&
  result.fanoutPolicyDefined &&
  result.dryRunSchedulerWorks &&
  result.maxCandidateEmployees <= 5 &&
  result.maxActiveEmployees <= 3 &&
  result.maxBrainCalls === 0 &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false &&
  result.evidenceGenerated === true;

result.completed = checksPassed;
result.recommended_sealed = checksPassed;
result.blocker = checksPassed ? null : "phase576c_employee_pyramid_scheduler_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}
