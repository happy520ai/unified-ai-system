import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeGvcBatch } from "./gvc-batch-analysis.mjs";

const repoRoot = process.cwd();
const summary = analyzeGvcBatch({ repoRoot });
const state = readJson("docs/project-brain/timed-runner-state.json") ?? {};
const completedPhases = [
  "Phase2034-GVC-Autonomous-Task-Quality-Gate",
  "Phase2035-GVC-Auto-Next-Actions-Planner",
  "Phase2036-GVC-Real-Batch-Mutation-Plan",
  "Phase2037-GVC-Real-Batch-Mutation-Run",
  "Phase2038-GVC-Batch-Verification-And-Rollback-Audit",
  "Phase2039-GVC-Autonomous-Value-Report",
  "Phase2040-GVC-Runner-Runaway-Guard",
  "Phase2041-GVC-Daily-Cap-Enforcer",
  "Phase2042-GVC-Owner-Autonomous-Daily-Report",
  "Phase2043-GVC-Dashboard-Real-Mutation-Status",
  "Phase2044-GVC-Full-Regression",
  "Phase2045-GVC-Seal-Or-Block",
];
const safetyClear =
  summary.providerCallsMade === false &&
  summary.secretRead === false &&
  summary.deployExecuted === false &&
  summary.chatGatewayExecuteModified === false &&
  summary.legacyModified === false &&
  summary.projectContextModified === false;
const autonomousRunnerUsable =
  summary.realMutationCount > 0 &&
  summary.rollbackFailedCount === 0 &&
  safetyClear &&
  state.autonomousMutationEnabled === true;
const blocker = summary.realMutationCount === 0
  ? "real_autonomous_mutation_not_executed"
  : autonomousRunnerUsable
    ? "none"
    : "autonomous_runner_safety_or_rollback_blocker";
const result = {
  phaseId: "Phase2045-GVC-Seal-Or-Block",
  status: blocker === "none" ? "passed" : "blocked",
  generatedAt: new Date().toISOString(),
  completedPhases,
  realMutationCount: summary.realMutationCount,
  realModifiedFiles: summary.realModifiedFiles,
  rollbackCount: summary.rollbackCount,
  rollbackFailedCount: summary.rollbackFailedCount,
  blockedLowValueTasks: summary.blockedLowValueTasks,
  skippedApprovalRequiredTasks: summary.skippedApprovalRequiredTasks,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  autonomousRunnerUsable,
  blocker,
  recommendedSealed: blocker === "none",
  manualFormalRunnerCommand: "pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=false",
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
};

write("apps/ai-gateway-service/evidence/phase2045-gvc-seal-or-block/seal-or-block-result.json", result);
write("apps/ai-gateway-service/evidence/phase2045-gvc-seal-or-block/seal-or-block-result.md", [
  "# Phase2045 GVC Seal Or Block",
  "",
  `- status: ${result.status}`,
  `- blocker: ${result.blocker}`,
  `- realMutationCount: ${result.realMutationCount}`,
  `- rollbackCount: ${result.rollbackCount}`,
  `- rollbackFailedCount: ${result.rollbackFailedCount}`,
  `- autonomousRunnerUsable: ${result.autonomousRunnerUsable}`,
  `- recommendedSealed: ${result.recommendedSealed}`,
  `- manualFormalRunnerCommand: ${result.manualFormalRunnerCommand}`,
  "",
].join("\n"));

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  realMutationCount: result.realMutationCount,
  rollbackFailedCount: result.rollbackFailedCount,
  recommendedSealed: result.recommendedSealed,
}, null, 2));
if (result.status !== "passed") process.exit(1);

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function write(relativePath, content) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`, "utf8");
}
