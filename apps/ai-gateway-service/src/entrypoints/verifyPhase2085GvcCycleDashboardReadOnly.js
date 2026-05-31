import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConsolePage } from "../ui/consolePage.js";
import { buildGvcRunnerDashboardSnapshot } from "../ui/components/GvcRunnerDashboardPanel.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase2085-gvc-cycle-dashboard-readonly");
const checks = [];

function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail: String(detail || "") });
}

const componentPath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/components/GvcRunnerDashboardPanel.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const componentSource = readText(componentPath);
const rootPackage = readJson(rootPackagePath) ?? {};
const servicePackage = readJson(servicePackagePath) ?? {};
const html = createConsolePage();
const snapshot = buildGvcRunnerDashboardSnapshot();
const cycle = snapshot.cycleStatus || {};

expect(componentSource.includes("data-phase2085-gvc-cycle-dashboard-readonly"), "component_phase2085_marker");
expect(componentSource.includes("currentCycleState"), "component_current_cycle_state");
expect(componentSource.includes("freshnessGateStatus"), "component_freshness_status");
expect(componentSource.includes("plannerRefreshExecuted"), "component_planner_refresh");
expect(componentSource.includes("lastBatchMutationCount"), "component_batch_mutation_count");
expect(componentSource.includes("lastNoOpCount"), "component_noop_count");
expect(componentSource.includes("lastRollbackFailedCount"), "component_rollback_failed_count");
expect(componentSource.includes("duplicateTasksBlocked"), "component_duplicate_blocked");
expect(componentSource.includes("lowValueTasksBlocked"), "component_low_value_blocked");
expect(!componentSource.includes("writeFile"), "component_no_write_file");
expect(!componentSource.includes("spawnSync("), "component_no_spawn");

expect(html.includes('data-phase2085-gvc-cycle-dashboard-readonly="true"'), "html_phase2085_marker");
expect(html.includes("currentCycleState"), "html_current_cycle_state");
expect(html.includes("freshnessGateStatus"), "html_freshness_status");
expect(html.includes("plannerRefreshExecuted"), "html_planner_refresh");
expect(html.includes("lastBatchMutationCount"), "html_batch_mutation_count");
expect(html.includes("nextRecommendedCycleAction"), "html_next_action");
expect(!/data-gvc-cycle-execute|start cycle|run cycle|provider button|deploy button/i.test(html), "html_no_real_execution_buttons");

expect(typeof cycle.currentCycleState === "string", "snapshot_current_cycle_state_string", cycle.currentCycleState);
expect(typeof cycle.freshnessGateStatus === "string", "snapshot_freshness_status_string", cycle.freshnessGateStatus);
expect(typeof cycle.plannerRefreshExecuted === "boolean", "snapshot_planner_refresh_boolean", cycle.plannerRefreshExecuted);
expect(Number.isFinite(cycle.lastBatchMutationCount), "snapshot_batch_mutation_number", cycle.lastBatchMutationCount);
expect(Number.isFinite(cycle.lastNoOpCount), "snapshot_noop_number", cycle.lastNoOpCount);
expect(Number.isFinite(cycle.lastRollbackFailedCount), "snapshot_rollback_failed_number", cycle.lastRollbackFailedCount);
expect(Number.isFinite(cycle.duplicateTasksBlocked), "snapshot_duplicate_number", cycle.duplicateTasksBlocked);
expect(Number.isFinite(cycle.lowValueTasksBlocked), "snapshot_low_value_number", cycle.lowValueTasksBlocked);
expect(snapshot.providerCallsMade === false, "snapshot_provider_false");
expect(snapshot.secretRead === false, "snapshot_secret_false");
expect(snapshot.deployExecuted === false, "snapshot_deploy_false");
expect(snapshot.chatGatewayExecuteModified === false, "snapshot_chat_gateway_false");
expect(snapshot.executionActionsExposed === false, "snapshot_no_execution_actions");

expect(rootPackage.scripts?.["verify:phase2085-gvc-cycle-dashboard-readonly"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase2085-gvc-cycle-dashboard-readonly", "root_verify_script");
expect(servicePackage.scripts?.["verify:phase2085-gvc-cycle-dashboard-readonly"] === "node ./src/entrypoints/verifyPhase2085GvcCycleDashboardReadOnly.js", "service_verify_script");

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2085-GVC-Cycle-Dashboard-ReadOnly",
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
  dashboardReadonlyReady: failed.length === 0,
  currentCycleState: cycle.currentCycleState,
  freshnessGateStatus: cycle.freshnessGateStatus,
  plannerRefreshExecuted: cycle.plannerRefreshExecuted,
  lastBatchMutationCount: cycle.lastBatchMutationCount,
  lastNoOpCount: cycle.lastNoOpCount,
  lastRollbackFailedCount: cycle.lastRollbackFailedCount,
  duplicateTasksBlocked: cycle.duplicateTasksBlocked,
  lowValueTasksBlocked: cycle.lowValueTasksBlocked,
  nextRecommendedCycleAction: cycle.nextRecommendedCycleAction,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  checks,
};

mkdirSync(evidenceDir, { recursive: true });
writeFileSync(resolve(evidenceDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
writeFileSync(resolve(repoRoot, "docs/phase2085-gvc-cycle-dashboard-readonly.md"), [
  "# Phase2085-GVC-Cycle-Dashboard-ReadOnly",
  "",
  `- status: ${result.status}`,
  `- currentCycleState: ${result.currentCycleState}`,
  `- freshnessGateStatus: ${result.freshnessGateStatus}`,
  `- plannerRefreshExecuted: ${result.plannerRefreshExecuted}`,
  `- lastBatchMutationCount: ${result.lastBatchMutationCount}`,
  `- lastNoOpCount: ${result.lastNoOpCount}`,
  `- lastRollbackFailedCount: ${result.lastRollbackFailedCount}`,
  `- duplicateTasksBlocked: ${result.duplicateTasksBlocked}`,
  `- lowValueTasksBlocked: ${result.lowValueTasksBlocked}`,
  "- readOnly: true",
  "- executionButtonsAdded: false",
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({ status: result.status, blocker: result.blocker, currentCycleState: result.currentCycleState }, null, 2));
if (failed.length > 0) process.exitCode = 1;

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readText(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}
