import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { phase2007To2016Tasks } from "./gvc-batch-task-catalog.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

async function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(packageJson.scripts["run:phase2007-2016-gvc-continuous-allowed-batch"], "missing Phase2007-2016 run script");
  assert(packageJson.scripts["verify:phase2007-2016-gvc-continuous-allowed-batch"], "missing Phase2007-2016 verify script");

  const { runPhase2007To2016Batch } = await import("./run-phase2007-2016-batch.mjs");
  const summary = runPhase2007To2016Batch({ repoRoot });
  assert(summary.status === "passed", "batch status should pass");
  assert(summary.actuallyExecutedTasks.length === 10, "batch must execute exactly 10 allowed dry-run tasks");
  assert(summary.skippedApprovalRequiredTasks.includes("gvc-l3-provider-one-shot-candidate"), "L3 provider candidate must be skipped");
  assert(summary.skippedForbiddenTasks.length === 0, "batch must not include forbidden tasks");
  assert(summary.providerCallsMade === false, "providerCallsMade must be false");
  assert(summary.secretRead === false, "secretRead must be false");
  assert(summary.deployExecuted === false, "deployExecuted must be false");
  assert(summary.chatGatewayExecuteModified === false, "chatGatewayExecuteModified must be false");
  assert(summary.recommendedSealed === true, "batch should recommend sealed");

  for (const task of phase2007To2016Tasks) {
    const evidencePath = path.join(repoRoot, "apps/ai-gateway-service/evidence", task.slug, `${task.slug}-result.json`);
    assert(existsSync(evidencePath), `missing evidence for ${task.phaseId}`);
    const evidence = readJson(evidencePath);
    assert(evidence.phaseId === task.phaseId, `phaseId mismatch for ${task.phaseId}`);
    assert(evidence.riskLevel === "L1", `riskLevel mismatch for ${task.phaseId}`);
    assert(evidence.dryRunOnly === true, `dryRunOnly must be true for ${task.phaseId}`);
    assert(evidence.realExecutionPerformed === false, `realExecutionPerformed must be false for ${task.phaseId}`);
    assert(evidence.providerCallsMade === false, `providerCallsMade must be false for ${task.phaseId}`);
    assert(evidence.secretRead === false, `secretRead must be false for ${task.phaseId}`);
    assert(evidence.chatGatewayExecuteModified === false, `chatGatewayExecuteModified must be false for ${task.phaseId}`);
    assert(evidence.recommendedSealed === true, `recommendedSealed must be true for ${task.phaseId}`);
  }

  console.log("Phase2007-2016 GVC continuous allowed batch verifier passed");
}

main().catch((error) => {
  console.error(`Phase2007-2016 GVC continuous allowed batch verifier failed: ${error.message}`);
  process.exit(1);
});
