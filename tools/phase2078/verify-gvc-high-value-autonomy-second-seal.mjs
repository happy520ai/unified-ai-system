import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2078-GVC-High-Value-Autonomy-Second-Seal";
const docsPath = "docs/phase2078-gvc-high-value-autonomy-second-seal.md";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2078-gvc-high-value-autonomy-second-seal";
const resultPath = `${evidenceDir}/result.json`;
const packageScriptName = "verify:phase2078-gvc-high-value-autonomy-second-seal";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const phase2073 = readJson("apps/ai-gateway-service/evidence/phase2073-gvc-completed-action-dedup-candidate-refresh/result.json") || {};
const phase2074 = readJson("apps/ai-gateway-service/evidence/phase2074-gvc-high-value-next-actions-v2/result.json") || {};
const phase2076 = readJson("apps/ai-gateway-service/evidence/phase2076-gvc-second-batch-audit/result.json") || {};
const phase2077 = readJson("apps/ai-gateway-service/evidence/phase2077-gvc-runner-value-loop-policy/result.json") || {};
const completedPhases = [
  phase2073.completed === true ? "Phase2073" : null,
  phase2074.completed === true ? "Phase2074" : null,
  phase2076.completed === true ? "Phase2076" : null,
  phase2077.completed === true ? "Phase2077" : null,
].filter(Boolean);

const safetyViolation = phase2076.providerCallsMade === true ||
  phase2076.secretRead === true ||
  phase2076.deployExecuted === true ||
  phase2076.chatGatewayExecuteModified === true ||
  phase2076.legacyModified === true ||
  phase2076.projectContextModified === true;

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2078/verify-gvc-high-value-autonomy-second-seal.mjs");
check("phase2073_passed", phase2073.completed === true);
check("phase2074_passed", phase2074.completed === true);
check("phase2076_passed", phase2076.completed === true);
check("phase2077_passed", phase2077.completed === true);
check("new_candidates_at_least_8", Number(phase2073.highValueCandidatesFound || 0) >= 8, String(phase2073.highValueCandidatesFound || 0));
check("high_value_next_actions_at_least_8", Number(phase2074.highValueNextActionsWritten || 0) >= 8, String(phase2074.highValueNextActionsWritten || 0));
check("duplicates_blocked", Number(phase2074.duplicatedTasksBlocked || phase2073.duplicatedTasksBlocked || 0) >= 1);
check("real_batch_executed", phase2076.realBatchExecuted === true);
check("real_mutation_loop_count_at_least_5", Number(phase2076.realMutationLoopCount || 0) >= 5, String(phase2076.realMutationLoopCount || 0));
check("no_op_loop_count_at_most_1", Number(phase2076.noOpLoopCount || 0) <= 1, String(phase2076.noOpLoopCount || 0));
check("rollback_failed_zero", Number(phase2076.rollbackFailedCount || 0) === 0, String(phase2076.rollbackFailedCount || 0));
check("safety_boundary_clear", safetyViolation === false);
check("next_formal_runner_worth_starting", phase2077.currentState?.nextFormalRunnerWorthStarting === true);

const failed = checks.filter((entry) => !entry.pass);
let blocker = failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", ");
if (Number(phase2076.realMutationLoopCount || 0) < 5) blocker = "second_real_batch_not_executed";
if (safetyViolation) blocker = "safety_boundary_violation";

const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  completedPhases,
  newCandidatesFound: Number(phase2073.highValueCandidatesFound || 0),
  duplicatedTasksBlocked: Number(phase2074.duplicatedTasksBlocked || phase2073.duplicatedTasksBlocked || 0),
  lowValueTasksBlocked: Number(phase2074.lowValueTasksBlocked || phase2073.lowValueTasksBlocked || 0),
  highValueNextActionsWritten: Number(phase2074.highValueNextActionsWritten || 0),
  realBatchExecuted: phase2076.realBatchExecuted === true,
  realMutationLoopCount: Number(phase2076.realMutationLoopCount || 0),
  noOpLoopCount: Number(phase2076.noOpLoopCount || 0),
  rollbackCount: Number(phase2076.rollbackCount || 0),
  rollbackFailedCount: Number(phase2076.rollbackFailedCount || 0),
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  nextFormalRunnerWorthStarting: phase2077.currentState?.nextFormalRunnerWorthStarting === true,
  blocker,
  recommendedSealed: failed.length === 0,
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
  recommendedSealed: result.recommendedSealed,
}, null, 2));
if (!result.recommendedSealed) process.exit(1);

function renderDocs(result) {
  return [
    "# Phase2078-GVC-High-Value-Autonomy-Second-Seal",
    "",
    "## Summary",
    "",
    `- Completed phases: ${result.completedPhases.join(", ")}.`,
    `- New candidates found: ${result.newCandidatesFound}.`,
    `- Duplicated tasks blocked: ${result.duplicatedTasksBlocked}.`,
    `- Low-value tasks blocked: ${result.lowValueTasksBlocked}.`,
    `- Real batch executed: ${result.realBatchExecuted}.`,
    `- Real mutation loops: ${result.realMutationLoopCount}.`,
    `- No-op loops: ${result.noOpLoopCount}.`,
    `- Rollback count: ${result.rollbackCount}.`,
    `- Rollback failed count: ${result.rollbackFailedCount}.`,
    "",
    "## Seal Decision",
    "",
    `- Blocker: ${result.blocker}.`,
    `- Recommended sealed: ${result.recommendedSealed}.`,
    `- Next formal runner worth starting: ${result.nextFormalRunnerWorthStarting}.`,
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
