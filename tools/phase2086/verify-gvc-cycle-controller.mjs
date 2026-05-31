import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2086-GVC-High-Value-Autonomy-Cycle-Controller-Verification";
const resultPath = "apps/ai-gateway-service/evidence/phase2086-gvc-high-value-autonomy-cycle-controller/verify-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase2086-gvc-high-value-autonomy-cycle-controller/result.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const seal = readJson(sealPath) || {};
const freshness = readJson("apps/ai-gateway-service/evidence/phase2079-gvc-cycle-freshness-gate/result.json") || {};
const branch = readJson("apps/ai-gateway-service/evidence/phase2080-gvc-cycle-branch-decision/result.json") || {};
const planner = readJson("apps/ai-gateway-service/evidence/phase2081-gvc-cycle-planner-refresh/result.json") || {};
const audit = readJson("apps/ai-gateway-service/evidence/phase2084-gvc-cycle-audit/result.json") || {};
const policy = readJson("apps/ai-gateway-service/evidence/phase2085-gvc-cycle-policy/result.json") || {};
const nextActions = readJson("docs/project-brain/next-actions.json") || {};
const actions = Array.isArray(nextActions.actions) ? nextActions.actions : [];
const allowedActions = actions.filter((action) => action.status === "ready" && ["L0", "L1", "L2"].includes(action.riskLevel));
const forbiddenTargets = allowedActions.flatMap((action) => action.touches || []).filter(isForbiddenTarget);
const oldPhaseRepeats = allowedActions.filter((action) => /^phase207[3-8]-/.test(String(action.taskId || "")));
const lowValueRepeats = allowedActions.filter((action) => isRepeatedSummaryTask(action.taskId) || isRepeatedSummaryTask(action.title));

check("package_script_gvc_cycle_registered", packageJson.scripts?.["gvc:cycle"] === "node tools/gvc/run-cycle-controller.mjs");
check("package_script_verify_registered", packageJson.scripts?.["verify:phase2086-gvc-cycle-controller"] === "node tools/phase2086/verify-gvc-cycle-controller.mjs");
check("seal_completed", seal.completed === true && seal.recommendedSealed === true);
check("freshness_gate_written", freshness.phaseId === "Phase2079-GVC-Cycle-Freshness-Gate" && freshness.completed === true);
check("branch_decision_written", branch.phaseId === "Phase2080-GVC-Cycle-Branch-Decision" && ["planner_refresh", "runner_batch"].includes(branch.selectedBranch));
check("planner_or_runner_branch_completed", seal.plannerRefreshExecuted === true || seal.runnerBatchExecuted === true);
check("current_cycle_uses_runner_batch_after_planner_refresh", seal.selectedBranch === "runner_batch" && seal.runnerBatchExecuted === true);
check("audit_passed", audit.completed === true);
check("policy_passed", policy.completed === true);
check("next_actions_cycle_managed", nextActions.phaseId === "Phase2081-GVC-Cycle-Planner-Refresh");
check("high_value_next_actions_written", allowedActions.length >= 5, String(allowedActions.length));
check("has_l0_l1_l2", ["L0", "L1", "L2"].every((risk) => allowedActions.some((action) => action.riskLevel === risk)));
check("no_phase2073_2078_repeat", oldPhaseRepeats.length === 0, oldPhaseRepeats.map((action) => action.taskId).join(", "));
check("no_low_value_summary_tasks", lowValueRepeats.length === 0, lowValueRepeats.map((action) => action.taskId).join(", "));
check("no_forbidden_targets", forbiddenTargets.length === 0, forbiddenTargets.join(", "));
check("provider_false", seal.providerCallsMade === false && freshness.providerCallsMade === false && audit.providerCallsMade === false);
check("secret_false", seal.secretRead === false && freshness.secretRead === false && audit.secretRead === false);
check("deploy_false", seal.deployExecuted === false && freshness.deployExecuted === false && audit.deployExecuted === false);
check("chat_gateway_false", seal.chatGatewayExecuteModified === false && freshness.chatGatewayExecuteModified === false && audit.chatGatewayExecuteModified === false);
check("legacy_project_context_false", seal.legacyModified === false && seal.projectContextModified === false);
check("workspace_clean_not_claimed", seal.workspaceCleanClaimed === false);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  selectedBranch: seal.selectedBranch || null,
  plannerRefreshExecuted: seal.plannerRefreshExecuted === true,
  runnerBatchExecuted: seal.runnerBatchExecuted === true,
  highValueNextActionsWritten: allowedActions.length,
  repeatedPhase2073To2078: oldPhaseRepeats.length > 0,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  checks,
};
writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  selectedBranch: result.selectedBranch,
  highValueNextActionsWritten: result.highValueNextActionsWritten,
}, null, 2));
if (failed.length > 0) process.exit(1);

function isForbiddenTarget(file) {
  const normalized = String(file || "").replaceAll("\\", "/").toLowerCase();
  return normalized === "project_context.md" ||
    normalized.startsWith("legacy/") ||
    normalized === ".env" ||
    normalized.endsWith("/.env") ||
    normalized === "auth.json" ||
    normalized.endsWith("/auth.json") ||
    normalized.includes("chat-gateway/execute") ||
    normalized.includes("/chat/") ||
    normalized.includes("credential") ||
    normalized.includes("provider-runtime") ||
    normalized.includes("billing") ||
    normalized.includes("payment");
}

function isRepeatedSummaryTask(value) {
  return /execution-history-compact-summary|operator-summary|stale-evidence-detector|owner-facing-status-report|autonomous-runner-dry-run-replay/i.test(String(value || ""));
}

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
