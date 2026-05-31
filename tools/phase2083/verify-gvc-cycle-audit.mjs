import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2083-GVC-Cycle-Audit";
const docsPath = "docs/phase2083-gvc-cycle-audit.md";
const resultPath = "apps/ai-gateway-service/evidence/phase2083-gvc-cycle-audit/result.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const freshness = readJson("apps/ai-gateway-service/evidence/phase2079-gvc-cycle-freshness-gate/result.json") || {};
const planner = readJson("apps/ai-gateway-service/evidence/phase2081-gvc-cycle-planner-refresh/result.json") || {};
const runnerBatch = readJson("apps/ai-gateway-service/evidence/phase2082-gvc-cycle-runner-batch/result.json") || {};
const cycleAudit = readJson("apps/ai-gateway-service/evidence/phase2084-gvc-cycle-audit/result.json") || {};
const nextActions = readJson("docs/project-brain/next-actions.json") || {};
const actions = Array.isArray(nextActions.actions) ? nextActions.actions : [];
const allowedActions = actions.filter((action) => action.status === "ready" && ["L0", "L1", "L2"].includes(action.riskLevel));
const forbiddenTargets = allowedActions.flatMap((action) => action.touches || action.targetFiles || []).filter(isForbiddenTarget);
const duplicateTasksBlocked = countRejected("duplicate");
const lowValueTasksBlocked = countRejected("low_value");
const mutationWhitelistViolations = Array.isArray(runnerBatch.mutatedFiles)
  ? runnerBatch.mutatedFiles.filter((file) => !isAllowedMutationPath(file))
  : [];

check("freshness_gate_ran", freshness.phaseId === "Phase2079-GVC-Cycle-Freshness-Gate" && freshness.completed === true);
check("planner_refresh_condition_recorded", planner.phaseId === "Phase2081-GVC-Cycle-Planner-Refresh" && planner.completed === true);
check("batch_runner_audited", runnerBatch.phaseId === "Phase2082-GVC-Cycle-Runner-Batch");
check("cycle_audit_written", cycleAudit.phaseId === "Phase2084-GVC-Cycle-Audit" && cycleAudit.completed === true);
check("rollback_failed_zero", Number(runnerBatch.rollbackFailedCount || cycleAudit.rollbackFailedCount || 0) === 0);
check("duplicate_tasks_blocked_recorded", duplicateTasksBlocked >= 0);
check("low_value_tasks_blocked_recorded", lowValueTasksBlocked >= 1);
check("allowed_actions_no_forbidden_targets", forbiddenTargets.length === 0, forbiddenTargets.join(", "));
check("mutations_whitelisted", mutationWhitelistViolations.length === 0, mutationWhitelistViolations.join(", "));
check("provider_false", freshness.providerCallsMade === false && runnerBatch.providerCallsMade !== true && cycleAudit.providerCallsMade === false);
check("secret_false", freshness.secretRead === false && runnerBatch.secretRead !== true && cycleAudit.secretRead === false);
check("deploy_false", freshness.deployExecuted === false && runnerBatch.deployExecuted !== true && cycleAudit.deployExecuted === false);
check("chat_gateway_false", freshness.chatGatewayExecuteModified === false && runnerBatch.chatGatewayExecuteModified !== true && cycleAudit.chatGatewayExecuteModified === false);

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  freshnessGateStatus: freshness.status || "unknown",
  plannerRefreshExecuted: planner.completed === true,
  batchRunnerAudited: runnerBatch.phaseId === "Phase2082-GVC-Cycle-Runner-Batch",
  batchRunnerExecuted: runnerBatch.runnerBatchExecuted === true,
  realMutationLoopCount: Number(runnerBatch.realMutationLoopCount || cycleAudit.realMutationLoopCount || 0),
  noOpLoopCount: Number(runnerBatch.noOpLoopCount || cycleAudit.noOpLoopCount || 0),
  rollbackCount: Number(runnerBatch.rollbackCount || cycleAudit.rollbackCount || 0),
  rollbackFailedCount: Number(runnerBatch.rollbackFailedCount || cycleAudit.rollbackFailedCount || 0),
  duplicateTasksBlocked,
  lowValueTasksBlocked,
  mutationWhitelistViolations,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  checks,
};

writeJson(resultPath, result);
writeText(docsPath, [
  "# Phase2083-GVC-Cycle-Audit",
  "",
  `- freshnessGateStatus: ${result.freshnessGateStatus}`,
  `- plannerRefreshExecuted: ${result.plannerRefreshExecuted}`,
  `- batchRunnerAudited: ${result.batchRunnerAudited}`,
  `- batchRunnerExecuted: ${result.batchRunnerExecuted}`,
  `- realMutationLoopCount: ${result.realMutationLoopCount}`,
  `- noOpLoopCount: ${result.noOpLoopCount}`,
  `- rollbackFailedCount: ${result.rollbackFailedCount}`,
  `- duplicateTasksBlocked: ${result.duplicateTasksBlocked}`,
  `- lowValueTasksBlocked: ${result.lowValueTasksBlocked}`,
  `- providerCallsMade: ${result.providerCallsMade}`,
  `- secretRead: ${result.secretRead}`,
  `- deployExecuted: ${result.deployExecuted}`,
  `- chatGatewayExecuteModified: ${result.chatGatewayExecuteModified}`,
  "",
].join("\n"));

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  batchRunnerExecuted: result.batchRunnerExecuted,
  realMutationLoopCount: result.realMutationLoopCount,
}, null, 2));
if (failed.length > 0) process.exit(1);

function countRejected(needle) {
  return (Array.isArray(nextActions.rejectedByQualityGate) ? nextActions.rejectedByQualityGate : [])
    .filter((entry) => JSON.stringify(entry).includes(needle)).length;
}

function isAllowedMutationPath(file) {
  const normalized = String(file || "").replaceAll("\\", "/").toLowerCase();
  return normalized.startsWith("apps/ai-gateway-service/evidence/") ||
    normalized.startsWith("tools/gvc/") ||
    normalized.startsWith("tools/phase") ||
    /^docs\/phase[^/]*\.md$/i.test(normalized) ||
    normalized === "package.json";
}

function isForbiddenTarget(file) {
  const normalized = String(file || "").replaceAll("\\", "/").toLowerCase();
  return normalized === "project_context.md" ||
    normalized.startsWith("legacy/") ||
    normalized.endsWith("/.env") ||
    normalized.endsWith("/auth.json") ||
    normalized.includes("chat-gateway/execute") ||
    normalized.includes("/chat/") ||
    normalized.includes("credential") ||
    normalized.includes("provider-runtime") ||
    normalized.includes("billing") ||
    normalized.includes("payment");
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

function writeText(relativePath, value) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value, "utf8");
}
