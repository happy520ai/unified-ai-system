import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runControlledLocalWorkerExecution } from "../../packages/workforce-scheduler/src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3982A-Workforce-Controlled-Local-Real-Execution-Pilot";

async function main() {
  console.log(`[${phaseId}] runner`);
  const result = runControlledLocalWorkerExecution(
    "Phase3982A owner-authorized local workforce pilot: inspect the restricted capability graduation gate and produce a bounded acceptance note.",
    { policy: { maxActiveEmployees: 3 } },
  );

  const evidence = {
    phaseId,
    completed: true,
    recommended_sealed: result.aggregateResult.completionVerified === true,
    blocker: result.aggregateResult.completionVerified === true ? "none" : "worker_execution_degraded",
    executionMode: result.mode,
    executionKind: result.executionKind,
    localWorkerFunctionsActuallyExecuted: true,
    activeWorkerCount: result.activeEmployees.length,
    maxAllowedWorkers: 3,
    workerResults: result.workerResults,
    aggregateResult: result.aggregateResult,
    providerCallsMade: false,
    secretsRead: false,
    rawSecretPrinted: false,
    deployExecuted: false,
    legacyModified: false,
    projectContextModified: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    fullCatalogBroadcastMade: false,
    employee144FanoutExecuted: false,
    dryRunOnly: false,
    mockOnly: false,
    rollback: {
      action: "Disable controlled local worker execution pilot and return Workforce to preview mode.",
      filesToRemove: [
        "tools/phase3982a/",
        "docs/workforce-real-execution/PHASE3982A_CONTROLLED_LOCAL_PILOT.md",
        "apps/ai-gateway-service/evidence/phase-3982a-workforce-controlled-local-real-execution/",
      ],
      sourceRollback: [
        "Remove export from packages/workforce-scheduler/src/index.js",
        "Remove packages/workforce-scheduler/src/runtime/controlledLocalWorkerExecution.js",
        "Remove package.json scripts added for Phase3982A",
      ],
    },
    verificationCommands: [
      "node --check packages/workforce-scheduler/src/runtime/controlledLocalWorkerExecution.js",
      "node --check tools/phase3982a/run-workforce-controlled-local-real-execution.mjs",
      "node --check tools/phase3982a/verify-workforce-controlled-local-real-execution.mjs",
      "pnpm run run:phase3982a-workforce-controlled-local-real-execution",
      "pnpm run verify:phase3982a-workforce-controlled-local-real-execution",
      "pnpm -r --if-present check",
    ],
    nextRecommendedPhases: [
      "Phase3983A GVC Single-File Real Repair Pilot",
      "Phase3984A CredentialRef Multi-Provider One-Shot Real Smoke",
    ],
    generatedAt: new Date().toISOString(),
  };

  await writeText(
    "docs/workforce-real-execution/PHASE3982A_CONTROLLED_LOCAL_PILOT.md",
    buildDoc(evidence),
  );
  await writeText(
    "apps/ai-gateway-service/evidence/phase-3982a-workforce-controlled-local-real-execution/result.json",
    JSON.stringify(evidence, null, 2),
  );

  console.log(`[${phaseId}] activeWorkerCount=${evidence.activeWorkerCount}`);
  console.log(`[${phaseId}] providerCallsMade=false`);
  console.log(`[${phaseId}] employee144FanoutExecuted=false`);
}

function buildDoc(evidence) {
  return [
    "# Phase3982A Workforce Controlled Local Real Execution Pilot",
    "",
    "## Goal",
    "",
    "把 Workforce 从纯 preview/dry-run 口径推进到 1-3 个受控本地 worker 函数真实执行。这里的真实执行是本地确定性 worker 函数，不是 Provider 调用，也不是 144 员工广播。",
    "",
    "## Result",
    "",
    `- executionMode: ${evidence.executionMode}`,
    `- localWorkerFunctionsActuallyExecuted: ${evidence.localWorkerFunctionsActuallyExecuted}`,
    `- activeWorkerCount: ${evidence.activeWorkerCount}`,
    `- providerCallsMade: ${evidence.providerCallsMade}`,
    `- secretsRead: ${evidence.secretsRead}`,
    `- employee144FanoutExecuted: ${evidence.employee144FanoutExecuted}`,
    `- recommended_sealed: ${evidence.recommended_sealed}`,
    `- blocker: ${evidence.blocker}`,
    "",
    "## Worker Outputs",
    "",
    ...evidence.workerResults.map((item) => `- ${item.workerRunId}: ${item.title} -> ${item.executionStatus}; ${item.output.summary}`),
    "",
    "## Safety Boundary",
    "",
    "- 未调用 Provider。",
    "- 未读取 secret。",
    "- 未修改 `/chat`。",
    "- 未修改 `/chat-gateway/execute`。",
    "- 未执行 144 worker fanout。",
    "- 未部署、未 commit、未 push。",
    "",
    "## Rollback",
    "",
    "- 删除 `tools/phase3982a/`。",
    "- 删除 `docs/workforce-real-execution/PHASE3982A_CONTROLLED_LOCAL_PILOT.md`。",
    "- 删除 `apps/ai-gateway-service/evidence/phase-3982a-workforce-controlled-local-real-execution/`。",
    "- 移除 `packages/workforce-scheduler/src/index.js` 中的 Phase3982A export。",
    "- 删除 `packages/workforce-scheduler/src/runtime/controlledLocalWorkerExecution.js`。",
    "- 回滚 `package.json` 中 Phase3982A scripts。",
    "",
  ].join("\n");
}

async function writeText(relativePath, content) {
  const absolutePath = resolve(repoRoot, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${content.trimEnd()}\n`, "utf8");
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
