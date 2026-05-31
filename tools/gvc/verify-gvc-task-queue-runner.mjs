import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const evidencePath = path.join(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase2001-gvc-task-queue-runner/task-queue-runner-result.json",
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson.scripts && packageJson.scripts[scriptName]);
}

async function main() {
  const packageJson = readJson(path.join(repoRoot, "package.json"));
  assert(hasScript(packageJson, "run:phase2001-gvc-task-queue-runner"), "missing run:phase2001-gvc-task-queue-runner script");
  assert(hasScript(packageJson, "verify:phase2001-gvc-task-queue-runner"), "missing verify:phase2001-gvc-task-queue-runner script");

  assert(existsSync(path.join(repoRoot, "tools/gvc/run-task-queue-dry-run.mjs")), "missing run-task-queue-dry-run.mjs");
  assert(existsSync(path.join(repoRoot, "docs/phase2001-gvc-task-queue-runner.md")), "missing Phase2001 documentation");

  const { runTaskQueueDryRun } = await import("./run-task-queue-dry-run.mjs");
  const result = runTaskQueueDryRun({ repoRoot, maxRiskLevel: "L2" });

  assert(result.status === "passed", "task queue dry-run status must pass");
  assert(result.selectedTaskCount >= 3, "runner should evaluate at least L0/L1/L2 tasks");
  assert(result.allowedTaskCount >= 3, "runner should allow L0/L1/L2 tasks");
  assert(result.approvalRequiredTaskCount >= 1, "runner should keep at least one L3 task approval-gated");
  assert(result.executedTaskCount === 0, "runner must not execute real tasks");
  assert(result.dryRunOnly === true, "runner must be dry-run only");
  assert(result.providerCallsMade === false, "runner must not call providers");
  assert(result.secretRead === false, "runner must not read secrets");
  assert(result.deployReleasePerformed === false, "runner must not deploy or release");
  assert(result.chatModified === false, "runner must not modify /chat");
  assert(result.chatGatewayExecuteModified === false, "runner must not modify /chat-gateway/execute");
  assert(result.legacyModified === false, "runner must not modify legacy");
  assert(result.projectContextModified === false, "runner must not modify PROJECT_CONTEXT.md");
  assert(result.recommendedSealed === true, "runner should recommend seal when checks pass");
  assert(existsSync(evidencePath), "runner did not write evidence");

  const evidence = readJson(evidencePath);
  assert(evidence.phaseId === "Phase2001-GVC-Task-Queue-Runner", "evidence phaseId mismatch");
  assert(evidence.status === "passed", "evidence status mismatch");
  assert(evidence.queueDecisions.some((entry) => entry.riskLevel === "L0" && entry.decision === "allowed"), "missing L0 allowed decision");
  assert(evidence.queueDecisions.some((entry) => entry.riskLevel === "L1" && entry.decision === "allowed"), "missing L1 allowed decision");
  assert(evidence.queueDecisions.some((entry) => entry.riskLevel === "L2" && entry.decision === "allowed"), "missing L2 allowed decision");
  assert(evidence.queueDecisions.some((entry) => entry.riskLevel === "L3" && entry.decision === "approval_required"), "missing L3 approval_required decision");
  assert(evidence.providerCallsMade === false, "evidence providerCallsMade must remain false");
  assert(evidence.secretRead === false, "evidence secretRead must remain false");
  assert(evidence.workspaceCleanClaimed === false, "evidence must not claim workspace clean");

  console.log("Phase2001 GVC task queue runner verifier passed");
}

main().catch((error) => {
  console.error(`Phase2001 GVC task queue runner verifier failed: ${error.message}`);
  process.exit(1);
});
