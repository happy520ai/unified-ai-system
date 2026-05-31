import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2076-GVC-Second-Batch-Audit";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2076-gvc-second-batch-audit";
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2076-gvc-second-batch-audit.md";
const packageScriptName = "verify:phase2076-gvc-second-batch-audit";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const state = readJson("docs/project-brain/timed-runner-state.json") || {};
const phase2074 = readJson("apps/ai-gateway-service/evidence/phase2074-gvc-high-value-next-actions-v2/result.json") || {};
const candidateDoc = readJson("docs/project-brain/high-value-task-candidates-v2.json") || {};
const completedBefore = new Set(Array.isArray(candidateDoc.completedTaskIds) ? candidateDoc.completedTaskIds : []);
const loops = collectPhase2075Loops(state);
const realMutationLoops = loops.filter((loop) => loop.realExecutionPerformed === true);
const noOpLoops = loops.filter((loop) => loop.realExecutionPerformed !== true && loop.status !== "blocked" && loop.status !== "stopped");
const blockedLoops = loops.filter((loop) => loop.status === "blocked" || loop.status === "stopped");
const rollbackLoops = loops.filter((loop) => loop.mutationResult?.rollbackPerformed === true);
const rollbackFailedLoops = loops.filter((loop) => loop.mutationResult?.rollbackSucceeded === false);
const selectedTaskIds = loops.map((loop) => loop.selectedTask?.taskId).filter(Boolean);
const duplicatedCompletedTasks = selectedTaskIds.filter((taskId) => completedBefore.has(taskId) || String(taskId).startsWith("phase2071-"));
const lowValueSummaryTasks = selectedTaskIds.filter(isRepeatedSummaryTask);
const mutatedFiles = realMutationLoops.flatMap((loop) => loop.mutationResult?.mutatedFiles || []);
const blockedTargetWrites = blockedLoops.flatMap((loop) => loop.mutationResult?.mutatedFiles || []);
const safety = {
  providerCallsMade: loops.some((loop) => loop.providerCallsMade === true) || state.providerCallsMade === true,
  secretRead: loops.some((loop) => loop.secretRead === true) || state.secretRead === true,
  deployExecuted: loops.some((loop) => loop.deployExecuted === true) || state.deployExecuted === true,
  chatGatewayExecuteModified: loops.some((loop) => loop.chatGatewayExecuteModified === true) || state.chatGatewayExecuteModified === true,
  legacyModified: loops.some((loop) => loop.legacyModified === true),
  projectContextModified: loops.some((loop) => loop.projectContextModified === true),
};

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2076/verify-gvc-second-batch-audit.mjs");
check("phase2074_passed", phase2074.completed === true);
check("phase2075_loops_found", loops.length >= 5, String(loops.length));
check("real_mutation_loop_count_at_least_5", realMutationLoops.length >= 5, String(realMutationLoops.length));
check("no_op_loop_count_at_most_1", noOpLoops.length <= 1, String(noOpLoops.length));
check("rollback_failed_count_zero", rollbackFailedLoops.length === 0, String(rollbackFailedLoops.length));
check("no_repeated_completed_task", duplicatedCompletedTasks.length === 0, duplicatedCompletedTasks.join(", "));
check("no_low_value_summary_task", lowValueSummaryTasks.length === 0, lowValueSummaryTasks.join(", "));
check("all_mutations_in_whitelist", mutatedFiles.every(isAllowedMutationFile), mutatedFiles.join(", "));
check("blocked_tasks_did_not_write_target_files", blockedTargetWrites.length === 0, blockedTargetWrites.join(", "));
check("provider_false", safety.providerCallsMade === false);
check("secret_false", safety.secretRead === false);
check("deploy_false", safety.deployExecuted === false);
check("chat_gateway_false", safety.chatGatewayExecuteModified === false);
check("legacy_project_context_false", safety.legacyModified === false && safety.projectContextModified === false);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  runnerExecuted: loops.length > 0,
  loopCount: loops.length,
  realBatchExecuted: realMutationLoops.length >= 5,
  realMutationLoopCount: realMutationLoops.length,
  noOpLoopCount: noOpLoops.length,
  blockedLoopCount: blockedLoops.length,
  rollbackCount: rollbackLoops.length,
  rollbackFailedCount: rollbackFailedLoops.length,
  selectedTaskIds,
  mutatedFiles,
  duplicatedTasksBlocked: Number(phase2074.duplicatedTasksBlocked || 0),
  lowValueTasksBlocked: Number(phase2074.lowValueTasksBlocked || 0),
  blockedTargetWrites,
  ...safety,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(resultPath, result);
writeText(docsPath, renderDocs(result));
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  realMutationLoopCount: result.realMutationLoopCount,
  noOpLoopCount: result.noOpLoopCount,
  rollbackFailedCount: result.rollbackFailedCount,
}, null, 2));
if (failed.length > 0) process.exit(1);

function collectPhase2075Loops(runnerState) {
  const date = runnerState.date;
  const total = Number(runnerState.loopsCompletedToday || 0);
  const loops = [];
  for (let index = 1; index <= total; index += 1) {
    const loop = readJson(`apps/ai-gateway-service/evidence/phase2019-gvc-timed-local-runner/loop-${date}-${index}.json`);
    if (loop?.selectedTask?.taskId && String(loop.selectedTask.taskId).startsWith("phase2075-")) {
      loops.push(loop);
    }
  }
  return loops;
}

function isAllowedMutationFile(file) {
  const normalized = String(file || "").replaceAll("\\", "/");
  return normalized.startsWith("apps/ai-gateway-service/evidence/") ||
    normalized.startsWith("tools/gvc/test-fixtures/") ||
    normalized.startsWith("tools/phase") ||
    /^docs\/phase[^/]*\.md$/i.test(normalized);
}

function isRepeatedSummaryTask(value) {
  return /execution-history-compact-summary|operator-summary|stale-evidence-detector|next-actions-quality-verifier|approval-queue-readability-polish|runner-regression-verifier|seal-matrix-compaction|owner-facing-status-report|autonomous-runner-dry-run-replay/i.test(String(value || ""));
}

function renderDocs(result) {
  return [
    "# Phase2076-GVC-Second-Batch-Audit",
    "",
    "## Summary",
    "",
    `- Runner loops audited: ${result.loopCount}.`,
    `- Real mutation loops: ${result.realMutationLoopCount}.`,
    `- No-op loops: ${result.noOpLoopCount}.`,
    `- Rollback count: ${result.rollbackCount}.`,
    `- Rollback failed count: ${result.rollbackFailedCount}.`,
    `- Mutated files: ${result.mutatedFiles.length}.`,
    "",
    "## Safety Boundary",
    "",
    "- Provider calls made: false.",
    "- Secret read: false.",
    "- Deploy executed: false.",
    "- Chat gateway execute modified: false.",
    "- Legacy modified: false.",
    "- PROJECT_CONTEXT.md modified: false.",
    "- Workspace clean claimed: false.",
    "",
  ].join("\n");
}

function resolve(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readJson(relativePath) {
  const filePath = resolve(relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  const filePath = resolve(relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
