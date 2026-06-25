import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConsolePage } from "../ui/consolePage.js";
import { buildGvcRunnerDashboardSnapshot } from "../ui/components/GvcRunnerDashboardPanel.js";
import { readJson, readText } from "./entrypointUtils.js"

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase2043-gvc-dashboard-real-mutation-status");
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

expect(componentSource.includes("data-phase2043-gvc-dashboard-real-mutation-status"), "component_phase2043_marker");
expect(componentSource.includes("data-gvc-runner-real-mutation-status"), "component_real_mutation_status_marker");
expect(componentSource.includes("autonomousMutationEnabled"), "component_autonomous_enabled_field");
expect(componentSource.includes("realMutationLoopsToday"), "component_real_loops_field");
expect(componentSource.includes("lastMutationFiles"), "component_last_files_field");
expect(componentSource.includes("lastRollbackStatus"), "component_rollback_field");
expect(componentSource.includes("qualityGateBlockedCount"), "component_quality_blocked_field");
expect(!componentSource.includes("spawnSync("), "component_no_spawn");
expect(!componentSource.includes("writeFile"), "component_no_write_file");

expect(html.includes('data-phase2043-gvc-dashboard-real-mutation-status="true"'), "html_phase2043_marker");
expect(html.includes('data-gvc-runner-real-mutation-status="true"'), "html_real_mutation_status_marker");
expect(html.includes("autonomousMutationEnabled"), "html_autonomous_enabled_visible");
expect(html.includes("realMutationLoopsToday"), "html_real_loops_visible");
expect(html.includes("lastMutationFiles"), "html_last_files_visible");
expect(html.includes("lastRollbackStatus"), "html_rollback_visible");
expect(html.includes("qualityGateBlockedCount"), "html_quality_blocked_visible");
expect(!/data-gvc-runner-real-action|real mutation button|start mutation|run mutation/i.test(html), "html_no_real_execution_button");

expect(snapshot.autonomousMutationEnabled === true, "snapshot_autonomous_mutation_enabled_true", snapshot.autonomousMutationEnabled);
expect(Number.isInteger(snapshot.realMutationLoopsToday) && snapshot.realMutationLoopsToday > 0, "snapshot_real_mutation_loops_positive", snapshot.realMutationLoopsToday);
expect(Array.isArray(snapshot.lastMutationFiles) && snapshot.lastMutationFiles.length > 0, "snapshot_last_mutation_files_present");
expect(typeof snapshot.lastRollbackStatus === "string", "snapshot_last_rollback_status_string", snapshot.lastRollbackStatus);
expect(Number.isInteger(snapshot.qualityGateBlockedCount), "snapshot_quality_blocked_integer", snapshot.qualityGateBlockedCount);
expect(snapshot.providerCallsMade === false, "snapshot_provider_false");
expect(snapshot.secretRead === false, "snapshot_secret_false");
expect(snapshot.deployExecuted === false, "snapshot_deploy_false");
expect(snapshot.chatGatewayExecuteModified === false, "snapshot_chat_gateway_false");
expect(snapshot.executionActionsExposed === false, "snapshot_no_execution_actions");

expect(rootPackage.scripts?.["verify:phase2043-gvc-dashboard-real-mutation-status"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase2043-gvc-dashboard-real-mutation-status", "root_verify_script");
expect(servicePackage.scripts?.["verify:phase2043-gvc-dashboard-real-mutation-status"] === "node ./src/entrypoints/verifyPhase2043GvcDashboardRealMutationStatus.js", "service_verify_script");

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2043-GVC-Dashboard-Real-Mutation-Status",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  readOnlyUi: true,
  autonomousMutationEnabled: snapshot.autonomousMutationEnabled,
  realMutationLoopsToday: snapshot.realMutationLoopsToday,
  lastMutationFiles: snapshot.lastMutationFiles,
  lastRollbackStatus: snapshot.lastRollbackStatus,
  qualityGateBlockedCount: snapshot.qualityGateBlockedCount,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
  checks,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resolve(evidenceDir, "dashboard-real-mutation-status-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(evidenceDir, "dashboard-real-mutation-status-result.md"), [
  "# Phase2043 GVC Dashboard Real Mutation Status",
  "",
  `- status: ${result.status}`,
  `- blocker: ${result.blocker}`,
  `- readOnlyUi: ${result.readOnlyUi}`,
  `- autonomousMutationEnabled: ${result.autonomousMutationEnabled}`,
  `- realMutationLoopsToday: ${result.realMutationLoopsToday}`,
  `- lastRollbackStatus: ${result.lastRollbackStatus}`,
  `- qualityGateBlockedCount: ${result.qualityGateBlockedCount}`,
  "",
].join("\n"), "utf8");

console.log(JSON.stringify({ status: result.status, blocker: result.blocker, realMutationLoopsToday: result.realMutationLoopsToday }, null, 2));
if (failed.length > 0) process.exitCode = 1;


