import { runRealTaskWorkforceDryRun } from "../workforce-preview/workforcePreviewService.js";

const result = runRealTaskWorkforceDryRun();
console.log(JSON.stringify({
  realTaskDryRunExecuted: result.realTaskDryRunExecuted,
  candidateEmployeesCount: result.candidateEmployees.length,
  activeEmployeesCount: result.activeEmployees.length,
  rejectedEmployeesRecorded: result.rejectedEmployees.length > 0,
  providerCallsMade: result.providerCallsMade,
}, null, 2));

if (!result.realTaskDryRunExecuted || result.providerCallsMade || result.activeEmployees.length > 3) {
  process.exitCode = 1;
}
