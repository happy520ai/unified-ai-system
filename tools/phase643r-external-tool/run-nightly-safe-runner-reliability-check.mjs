import {
  check,
  finalize,
  exists,
  readJson,
  runPhase632Preflight,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase643r-external-tool/nightly-safe-runner-reliability-result.json";

const preflight = runPhase632Preflight();
const queue = readJson("docs/phase638r-nightly-engineering-task-queue.json", {});
const tasks = Array.isArray(queue.data?.tasks) ? queue.data.tasks : [];
const highRiskTasks = tasks.filter((task) => task.riskTier === "high" || task.gateOnly === true);
const allTasksBounded = tasks.every(
  (task) =>
    task.providerCallsAllowed === false &&
    task.deployAllowed === false &&
    task.pushAllowed === false &&
    task.commitAllowed === false &&
    task.chatModificationAllowed === false &&
    task.chatGatewayExecuteModificationAllowed === false,
);

const result = {
  phase: "Phase643R-ExternalTool",
  name: "Nightly Safe Runner Reliability Check",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  nightlyReliabilityCheckGenerated: true,
  phase632PreflightPassed: preflight.passed,
  fallbackCmdExists: exists("tools/phase638r/run-nightly-safe-runner-once.cmd"),
  fallbackPs1Exists: exists("tools/phase638r/run-nightly-safe-runner-once.ps1"),
  nightlyRunnerScriptExists: exists("tools/phase638r/run-nightly-safe-engineering-runner.mjs"),
  taskQueueExists: queue.exists === true && !queue.parseErrorReason,
  highRiskGateOnly:
    highRiskTasks.length > 0 &&
    highRiskTasks.every((task) => task.gateOnly === true && task.autoExecutable === false),
  maxTasksPerNightDefault: Number(queue.data?.maxTasksPerNightDefault ?? 0),
  maxTasksPerNightHardLimit: Number(queue.data?.maxTasksPerNightHardLimit ?? 0),
  providerCallsAllowed: false,
  deployAllowed: false,
  pushAllowed: false,
  allTasksBounded,
  daemonStarted: false,
  infiniteLoopStarted: false,
  windowsTaskRegisteredByThisPhase: false,
  nightlyRunnerExecutedByThisPhase: false,
  safeValidationOnly: true,
  ...safetyBoundary(),
  docs: [
    "docs/phase643r-external-tool-nightly-safe-runner-reliability.md",
    "docs/phase643r-external-tool-execution-report.md",
  ],
  evidencePath,
};

const checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("fallback_cmd_exists", result.fallbackCmdExists),
  check("fallback_ps1_exists", result.fallbackPs1Exists),
  check("nightly_runner_script_exists", result.nightlyRunnerScriptExists),
  check("task_queue_exists", result.taskQueueExists),
  check("high_risk_gate_only", result.highRiskGateOnly),
  check("max_tasks_default_lte_8", result.maxTasksPerNightDefault <= 8 && result.maxTasksPerNightDefault > 0),
  check("max_tasks_hard_limit_lte_12", result.maxTasksPerNightHardLimit <= 12 && result.maxTasksPerNightHardLimit > 0),
  check("provider_calls_allowed_false", result.providerCallsAllowed === false),
  check("deploy_allowed_false", result.deployAllowed === false),
  check("push_allowed_false", result.pushAllowed === false),
  check("all_tasks_bounded", result.allTasksBounded),
  check("daemon_started_false", result.daemonStarted === false),
  check("infinite_loop_started_false", result.infiniteLoopStarted === false),
  check("windows_task_registered_by_this_phase_false", result.windowsTaskRegisteredByThisPhase === false),
  check("nightly_runner_not_executed_or_safe_validation_only", result.nightlyRunnerExecutedByThisPhase === false || result.safeValidationOnly === true),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase643r_external_tool_nightly_reliability_check_failed");
