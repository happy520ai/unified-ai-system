import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2086-GVC-Cycle-Controller-Final-Seal";
const docsPath = "docs/phase2086-gvc-cycle-controller-final-seal.md";
const resultPath = "apps/ai-gateway-service/evidence/phase2086-gvc-cycle-controller-final-seal/result.json";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const cycleSeal = readJson("apps/ai-gateway-service/evidence/phase2086-gvc-high-value-autonomy-cycle-controller/result.json") || {};
const audit = readJson("apps/ai-gateway-service/evidence/phase2083-gvc-cycle-audit/result.json") || {};
const cli = readJson("apps/ai-gateway-service/evidence/phase2084-gvc-cycle-controller-cli/result.json") || {};
const dashboard = readJson("apps/ai-gateway-service/evidence/phase2085-gvc-cycle-dashboard-readonly/result.json") || {};
const phase2078 = readJson("apps/ai-gateway-service/evidence/phase2078-gvc-high-value-autonomy-second-seal/result.json") || {};
const phase2066 = readJson("apps/ai-gateway-service/evidence/phase2066-gvc-full-use-seal/result.json") || {};

check("cycle_controller_ready", cycleSeal.completed === true && cycleSeal.recommendedSealed === true);
check("gvc_cycle_command_ready", packageJson.scripts?.["gvc:cycle"] === "node tools/gvc/run-cycle-controller.mjs" && cli.completed === true);
check("freshness_gate_ready", cycleSeal.freshnessGatePassed === true || audit.freshnessGateStatus === "passed");
check("planner_refresh_ready", cycleSeal.plannerRefreshExecuted === true || audit.plannerRefreshExecuted === true);
check("batch_runner_ready", audit.batchRunnerAudited === true);
check("audit_ready", audit.completed === true);
check("dashboard_readonly_ready", dashboard.completed === true && dashboard.dashboardReadonlyReady === true);
check("phase2078_sealed", phase2078.recommendedSealed === true);
check("phase2066_sealed", phase2066.recommendedSealed === true || phase2066.autonomousRunnerUsable === true);
check("provider_false", cycleSeal.providerCallsMade === false && audit.providerCallsMade === false && dashboard.providerCallsMade === false);
check("secret_false", cycleSeal.secretRead === false && audit.secretRead === false && dashboard.secretRead === false);
check("deploy_false", cycleSeal.deployExecuted === false && audit.deployExecuted === false && dashboard.deployExecuted === false);
check("chat_gateway_false", cycleSeal.chatGatewayExecuteModified === false && audit.chatGatewayExecuteModified === false && dashboard.chatGatewayExecuteModified === false);
check("legacy_project_context_false", cycleSeal.legacyModified === false && cycleSeal.projectContextModified === false && audit.legacyModified === false && audit.projectContextModified === false);
check("workspace_clean_not_claimed", cycleSeal.workspaceCleanClaimed === false);

const failed = checks.filter((entry) => !entry.pass);
const completed = failed.length === 0;
const result = {
  phaseId,
  completed,
  status: completed ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  completedPhases: completed ? ["Phase2083", "Phase2084", "Phase2085", "Phase2086"] : [],
  cycleControllerReady: cycleSeal.completed === true,
  gvcCycleCommandReady: cli.gvcCycleCommandReady === true,
  freshnessGateReady: cycleSeal.freshnessGatePassed === true || audit.freshnessGateStatus === "passed",
  plannerRefreshReady: cycleSeal.plannerRefreshExecuted === true || audit.plannerRefreshExecuted === true,
  batchRunnerReady: audit.batchRunnerAudited === true,
  auditReady: audit.completed === true,
  dashboardReadonlyReady: dashboard.dashboardReadonlyReady === true,
  realMutationLoopCount: Number(audit.realMutationLoopCount || cycleSeal.realMutationLoopCount || 0),
  noOpLoopCount: Number(audit.noOpLoopCount || cycleSeal.noOpLoopCount || 0),
  rollbackCount: Number(audit.rollbackCount || cycleSeal.rollbackCount || 0),
  rollbackFailedCount: Number(audit.rollbackFailedCount || cycleSeal.rollbackFailedCount || 0),
  duplicateTasksBlocked: Number(audit.duplicateTasksBlocked || cycleSeal.duplicateTasksBlocked || 0),
  lowValueTasksBlocked: Number(audit.lowValueTasksBlocked || cycleSeal.lowValueTasksBlocked || 0),
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  gvcInfrastructureComplete: completed,
  blocker: completed ? "none" : failed.map((entry) => entry.id).join(", "),
  recommendedSealed: completed,
  nextMode: "Use gvc:cycle to advance product work. Do not keep expanding GVC infrastructure unless a real blocker appears.",
  checks,
};

writeJson(resultPath, result);
writeText(docsPath, [
  "# Phase2086-GVC-Cycle-Controller-Final-Seal",
  "",
  `- completed: ${result.completed}`,
  `- recommendedSealed: ${result.recommendedSealed}`,
  `- blocker: ${result.blocker}`,
  `- cycleControllerReady: ${result.cycleControllerReady}`,
  `- gvcCycleCommandReady: ${result.gvcCycleCommandReady}`,
  `- freshnessGateReady: ${result.freshnessGateReady}`,
  `- plannerRefreshReady: ${result.plannerRefreshReady}`,
  `- batchRunnerReady: ${result.batchRunnerReady}`,
  `- auditReady: ${result.auditReady}`,
  `- dashboardReadonlyReady: ${result.dashboardReadonlyReady}`,
  `- realMutationLoopCount: ${result.realMutationLoopCount}`,
  `- noOpLoopCount: ${result.noOpLoopCount}`,
  `- rollbackFailedCount: ${result.rollbackFailedCount}`,
  `- duplicateTasksBlocked: ${result.duplicateTasksBlocked}`,
  `- lowValueTasksBlocked: ${result.lowValueTasksBlocked}`,
  `- gvcInfrastructureComplete: ${result.gvcInfrastructureComplete}`,
  `- nextMode: ${result.nextMode}`,
  "",
].join("\n"));

console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  gvcInfrastructureComplete: result.gvcInfrastructureComplete,
  nextMode: result.nextMode,
}, null, 2));
if (!result.recommendedSealed) process.exit(1);

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
