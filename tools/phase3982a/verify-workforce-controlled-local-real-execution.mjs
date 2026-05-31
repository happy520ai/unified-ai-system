import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const phaseId = "Phase3982A-Workforce-Controlled-Local-Real-Execution-Pilot";

async function main() {
  console.log(`[${phaseId}] verifier`);
  const evidence = JSON.parse(await readRequired("apps/ai-gateway-service/evidence/phase-3982a-workforce-controlled-local-real-execution/result.json"));
  const doc = await readRequired("docs/workforce-real-execution/PHASE3982A_CONTROLLED_LOCAL_PILOT.md");
  const source = await readRequired("packages/workforce-scheduler/src/runtime/controlledLocalWorkerExecution.js");
  const index = await readRequired("packages/workforce-scheduler/src/index.js");

  const checks = [
    ["phase id", evidence.phaseId === phaseId],
    ["completed=true", evidence.completed === true],
    ["recommended_sealed=true", evidence.recommended_sealed === true],
    ["local worker functions executed", evidence.localWorkerFunctionsActuallyExecuted === true],
    ["not dry-run only", evidence.dryRunOnly === false],
    ["not mock only", evidence.mockOnly === false],
    ["active workers >= 1", evidence.activeWorkerCount >= 1],
    ["active workers <= 3", evidence.activeWorkerCount <= 3],
    ["worker result count matches", evidence.workerResults.length === evidence.activeWorkerCount],
    ["all workers completed", evidence.workerResults.every((item) => item.executionStatus === "completed" && item.completionVerified === true)],
    ["providerCallsMade=false", evidence.providerCallsMade === false],
    ["secretsRead=false", evidence.secretsRead === false],
    ["rawSecretPrinted=false", evidence.rawSecretPrinted === false],
    ["deployExecuted=false", evidence.deployExecuted === false],
    ["legacyModified=false", evidence.legacyModified === false],
    ["projectContextModified=false", evidence.projectContextModified === false],
    ["chatRouteModified=false", evidence.chatRouteModified === false],
    ["chatGatewayExecuteModified=false", evidence.chatGatewayExecuteModified === false],
    ["no full catalog broadcast", evidence.fullCatalogBroadcastMade === false],
    ["no 144 fanout", evidence.employee144FanoutExecuted === false],
    ["source exports policy", source.includes("controlledLocalWorkerExecutionPolicy")],
    ["index exports source", index.includes("./runtime/controlledLocalWorkerExecution.js")],
    ["doc states no provider", doc.includes("未调用 Provider")],
    ["doc states no 144", doc.includes("未执行 144 worker fanout")],
  ];

  let failed = false;
  for (const [label, ok] of checks) {
    if (!ok) failed = true;
    console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}`);
  }

  if (failed) {
    console.error(`[${phaseId}] FAIL`);
    process.exit(1);
  }

  console.log(`[${phaseId}] PASS`);
}

async function readRequired(relativePath) {
  try {
    return await readFile(resolve(repoRoot, relativePath), "utf8");
  } catch (error) {
    throw new Error(`missing required file ${relativePath}: ${error.message}`);
  }
}

main().catch((error) => {
  console.error(`[${phaseId}] fatal:`, error.message);
  process.exit(1);
});
