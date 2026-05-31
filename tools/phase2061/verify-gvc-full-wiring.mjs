import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const phaseId = "Phase2061-GVC-Full-Wiring-Verification";
const evidenceDir = "apps/ai-gateway-service/evidence/phase2061-gvc-full-wiring-verification";
const resultPath = `${evidenceDir}/result.json`;
const docsPath = "docs/phase2061-gvc-full-wiring-verification.md";
const packageScriptName = "verify:phase2061-gvc-full-wiring-verification";
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const packageJson = readJson("package.json") || {};
const currentState = readJson("docs/project-brain/current-state.json");
const goals = readJson("docs/project-brain/goals.json");
const riskPolicy = readJson("docs/project-brain/risk-policy.json");
const nextActions = readJson("docs/project-brain/next-actions.json");
const taskQualityPolicy = readJson("docs/project-brain/task-quality-policy.json");
const timedRunnerState = readJson("docs/project-brain/timed-runner-state.json");
const runnerControl = readJson("docs/project-brain/runner-control.json");
const safePolicy = readJson("docs/project-brain/safe-overnight-policy.json");
const phase2060 = readJson("apps/ai-gateway-service/evidence/phase2060-gvc-timed-runner-real-batch/result.json");
const phase2058 = readJson("apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation/result.json");
const phase2050 = readJson("apps/ai-gateway-service/evidence/phase2050-session-ledger-context-unification/result.json");
const phase2049 = readJson("apps/ai-gateway-service/evidence/phase2049-tool-registry-result-ledger/result.json");
const phase2053 = readJson("apps/ai-gateway-service/evidence/phase2053-terminal-transcript-safety-summary/result.json");
const phase2054 = readJson("apps/ai-gateway-service/evidence/phase2054-agent-loop-memory-snapshot/result.json");
const dashboard2022 = readJson("apps/ai-gateway-service/evidence/phase2022-gvc-runner-dashboard-readonly/runner-dashboard-readonly-result.json");
const dashboard2043 = readJson("apps/ai-gateway-service/evidence/phase2043-gvc-dashboard-real-mutation-status/dashboard-real-mutation-status-result.json");

const projectBrainConnected = Boolean(currentState && goals && riskPolicy && nextActions);
const nextActionsConnected = Array.isArray(nextActions?.actions) && nextActions.actions.length > 0;
const timedRunnerConnected =
  existsSync(resolve("tools/gvc/run-timed-local-runner.mjs")) &&
  existsSync(resolve("docs/project-brain/timed-runner-state.json")) &&
  existsSync(resolve("docs/project-brain/runner-control.json"));
const permissionEngineConnected =
  existsSync(resolve("packages/gvc-permission-engine/src/index.js")) &&
  existsSync(resolve("packages/gvc-permission-engine/src/timedRunnerFinalPermissionGate.js")) &&
  phase2058?.permissionEnforcementLimitedActivation === true;
const finalPermissionGateConnected =
  phase2060?.permissionEngineParticipated === true &&
  Number(phase2060?.finalPermissionGateCount || 0) > 0 &&
  phase2060?.realMutationAuthorityExpanded === false;
const autonomousExecutorConnected =
  existsSync(resolve("tools/gvc/low-risk-autonomous-executor.mjs")) &&
  phase2060?.realMutationLoopCount >= 3;
const rollbackConnected =
  phase2060?.rollbackCount >= 1 &&
  phase2060?.rollbackFailedCount === 0;
const evidenceLedgerConnected =
  existsSync(resolve("apps/ai-gateway-service/evidence/phase2060-gvc-timed-runner-real-batch/result.json")) &&
  existsSync(resolve("apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation/result.json")) &&
  phase2049 !== null;
const dashboardConnected =
  dashboard2022 !== null &&
  dashboard2043 !== null &&
  packageJson.scripts?.["verify:phase2022-gvc-runner-dashboard-readonly"] &&
  packageJson.scripts?.["verify:phase2043-gvc-dashboard-real-mutation-status"];
const taskQualityConnected =
  taskQualityPolicy?.recommendedActions?.allow === "allow" &&
  existsSync(resolve("tools/gvc/score-next-action-quality.mjs")) &&
  existsSync(resolve("tools/gvc/generate-next-actions.mjs"));
const sessionLedgerConnected = phase2050 !== null && existsSync(resolve("tools/phase2050/verify-session-ledger-context-unification.mjs"));
const terminalSafetySummaryConnected = phase2053 !== null && existsSync(resolve("tools/phase2053/verify-terminal-transcript-safety-summary.mjs"));
const agentLoopMemoryConnected = phase2054 !== null && existsSync(resolve("tools/phase2054/verify-agent-loop-memory-snapshot.mjs"));

check("package_script_registered", packageJson.scripts?.[packageScriptName] === "node tools/phase2061/verify-gvc-full-wiring.mjs");
check("docs_file_exists", existsSync(resolve(docsPath)));
check("project_brain_connected", projectBrainConnected);
check("next_actions_connected", nextActionsConnected);
check("task_quality_policy_connected", taskQualityConnected);
check("timed_runner_connected", timedRunnerConnected);
check("runner_control_safe", runnerControl?.noProvider === true && runnerControl?.noSecret === true && runnerControl?.noDeploy === true);
check("timed_runner_state_present", timedRunnerState !== null);
check("safe_policy_present", safePolicy?.enabled === true && safePolicy?.evidenceRequiredEveryLoop === true);
check("permission_engine_connected", permissionEngineConnected);
check("final_permission_gate_connected", finalPermissionGateConnected);
check("autonomous_executor_connected", autonomousExecutorConnected);
check("rollback_connected", rollbackConnected);
check("session_ledger_connected", sessionLedgerConnected);
check("tool_result_ledger_connected", phase2049 !== null);
check("terminal_safety_summary_connected", terminalSafetySummaryConnected);
check("agent_loop_memory_snapshot_connected", agentLoopMemoryConnected);
check("evidence_ledger_connected", evidenceLedgerConnected);
check("dashboard_connected", dashboardConnected);
check("safety_flags_false", [
  phase2060?.providerCallsMade,
  phase2060?.secretRead,
  phase2060?.deployExecuted,
  phase2060?.chatGatewayExecuteModified,
  phase2060?.legacyModified,
  phase2060?.projectContextModified,
].every((value) => value === false));

const failed = checks.filter((entry) => !entry.pass);
const result = {
  phaseId,
  completed: failed.length === 0,
  status: failed.length === 0 ? "passed" : "failed",
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((entry) => entry.id).join(", "),
  generatedAt: new Date().toISOString(),
  projectBrainConnected,
  nextActionsConnected,
  timedRunnerConnected,
  permissionEngineConnected,
  finalPermissionGateConnected,
  autonomousExecutorConnected,
  rollbackConnected,
  evidenceLedgerConnected,
  dashboardConnected,
  taskQualityConnected,
  sessionLedgerConnected,
  toolResultLedgerConnected: phase2049 !== null,
  terminalSafetySummaryConnected,
  agentLoopMemoryConnected,
  allCriticalWiringPassed: failed.length === 0,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  evidenceRefs: {
    phase2060: "apps/ai-gateway-service/evidence/phase2060-gvc-timed-runner-real-batch/result.json",
    phase2058: "apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation/result.json",
    phase2049: "apps/ai-gateway-service/evidence/phase2049-tool-registry-result-ledger/result.json",
    phase2050: "apps/ai-gateway-service/evidence/phase2050-session-ledger-context-unification/result.json",
    phase2053: "apps/ai-gateway-service/evidence/phase2053-terminal-transcript-safety-summary/result.json",
    phase2054: "apps/ai-gateway-service/evidence/phase2054-agent-loop-memory-snapshot/result.json",
  },
  checks,
};

writeJson(resultPath, result);
console.log(JSON.stringify({
  status: result.status,
  blocker: result.blocker,
  allCriticalWiringPassed: result.allCriticalWiringPassed,
}, null, 2));
if (failed.length > 0) process.exit(1);

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
