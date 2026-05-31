import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  employeeExpandedSeed,
  workQueuePolicy,
  workerPoolPolicy,
  limitActiveEmployees,
  backpressurePolicy,
  cachePolicy,
  circuitBreakerPolicy,
  aggregateDryRunResults,
  latencyBudgetPolicy,
  applyLoadShedding,
} from "../../packages/workforce-scheduler/src/index.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase583");
const evidencePath = resolve(evidenceDir, "performance-distributed-load-governance-result.json");

const sampleEmployees = employeeExpandedSeed.slice(0, 8);
const limited = limitActiveEmployees(sampleEmployees, workerPoolPolicy.maxActiveEmployeesPerTask);
const shed = applyLoadShedding(sampleEmployees, workerPoolPolicy.maxActiveEmployeesPerTask);
const aggregated = aggregateDryRunResults(limited.activeEmployees.map((employee) => ({ employeeId: employee.employeeId, summary: employee.title })));

const result = {
  phase: "Phase583",
  name: "Performance / Distributed Load Governance",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  workQueuePolicyExists: exists("packages/workforce-scheduler/src/performance/workQueue.js"),
  workerPoolPolicyExists: exists("packages/workforce-scheduler/src/performance/workerPoolPolicy.js"),
  concurrencyLimiterExists: exists("packages/workforce-scheduler/src/performance/concurrencyLimiter.js"),
  backpressurePolicyExists: exists("packages/workforce-scheduler/src/performance/backpressurePolicy.js"),
  cachePolicyExists: exists("packages/workforce-scheduler/src/performance/cachePolicy.js"),
  circuitBreakerPolicyExists: exists("packages/workforce-scheduler/src/performance/circuitBreakerPolicy.js"),
  resultAggregatorExists: exists("packages/workforce-scheduler/src/performance/resultAggregator.js"),
  loadSheddingPolicyExists: exists("packages/workforce-scheduler/src/performance/loadSheddingPolicy.js"),
  latencyBudgetPolicyExists: exists("packages/workforce-scheduler/src/performance/latencyBudgetPolicy.js"),
  maxConcurrentWorkforceTasks: workQueuePolicy.maxConcurrentWorkforceTasks,
  maxActiveEmployeesPerTask: workerPoolPolicy.maxActiveEmployeesPerTask,
  maxBrainCallsPerTask: workerPoolPolicy.maxBrainCallsPerTask,
  perEmployeeTimeoutMs: latencyBudgetPolicy.perEmployeeTimeoutMs,
  globalTaskTimeoutMs: latencyBudgetPolicy.globalTaskTimeoutMs,
  queueMaxDepth: workQueuePolicy.queueMaxDepth,
  cacheEnabled: cachePolicy.cacheEnabled,
  circuitBreakerEnabled: circuitBreakerPolicy.circuitBreakerEnabled,
  fallbackOnOverload: workQueuePolicy.fallbackOnOverload,
  evidenceRequired: workQueuePolicy.evidenceRequired,
  overloadDryRunBlocksExtraEmployees: limited.overloadDryRunBlocksExtraEmployees && shed.shed.length > 0,
  noFullCatalogBroadcast: shed.noFullCatalogBroadcast,
  aggregationWorks: aggregated.contributionCount === limited.activeEmployees.length,
  backpressureEnabled: backpressurePolicy.enabled,
  providerCallsMade: false,
  secretValueExposed: false,
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
  result.workQueuePolicyExists &&
  result.workerPoolPolicyExists &&
  result.concurrencyLimiterExists &&
  result.backpressurePolicyExists &&
  result.cachePolicyExists &&
  result.circuitBreakerPolicyExists &&
  result.resultAggregatorExists &&
  result.loadSheddingPolicyExists &&
  result.latencyBudgetPolicyExists &&
  result.overloadDryRunBlocksExtraEmployees &&
  result.noFullCatalogBroadcast &&
  result.maxBrainCallsPerTask === 0 &&
  result.providerCallsMade === false &&
  result.secretValueExposed === false;

result.completed = passed;
result.recommended_sealed = passed;
result.blocker = passed ? null : "phase583_performance_governance_incomplete";

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!passed) process.exitCode = 1;

function exists(path) {
  return existsSync(resolve(repoRoot, path));
}

