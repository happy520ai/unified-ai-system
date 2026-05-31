import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  exists,
  finalize,
  readJson,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase643r-external-tool/nightly-safe-runner-reliability-result.json";
const reliability = readJson(evidencePath, {});
const docsText = [
  readText("docs/phase643r-external-tool-nightly-safe-runner-reliability.md"),
  readText("docs/phase643r-external-tool-execution-report.md"),
].join("\n");

const result = {
  phase: "Phase643R-ExternalTool",
  name: "Nightly Safe Runner Reliability Validation",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  nightlyReliabilityCheckGenerated: reliability.exists === true && !reliability.parseErrorReason,
  phase632PreflightPassed: reliability.data?.phase632PreflightPassed === true,
  fallbackCmdExists: reliability.data?.fallbackCmdExists === true,
  fallbackPs1Exists: reliability.data?.fallbackPs1Exists === true,
  taskQueueExists: reliability.data?.taskQueueExists === true,
  highRiskGateOnly: reliability.data?.highRiskGateOnly === true,
  daemonStarted: reliability.data?.daemonStarted === true,
  infiniteLoopStarted: reliability.data?.infiniteLoopStarted === true,
  windowsTaskRegisteredByThisPhase: reliability.data?.windowsTaskRegisteredByThisPhase === true,
  nightlyRunnerExecutedByThisPhase: reliability.data?.nightlyRunnerExecutedByThisPhase === true,
  safeValidationOnly: reliability.data?.safeValidationOnly === true,
  docsGenerated:
    exists("docs/phase643r-external-tool-nightly-safe-runner-reliability.md") &&
    exists("docs/phase643r-external-tool-execution-report.md"),
  ...safetyBoundary(),
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("nightly_reliability_check_generated", result.nightlyReliabilityCheckGenerated),
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("fallback_cmd_exists", result.fallbackCmdExists),
  check("fallback_ps1_exists", result.fallbackPs1Exists),
  check("task_queue_exists", result.taskQueueExists),
  check("high_risk_gate_only", result.highRiskGateOnly),
  check("daemon_started_false", result.daemonStarted === false),
  check("infinite_loop_started_false", result.infiniteLoopStarted === false),
  check("windows_task_registered_by_this_phase_false", result.windowsTaskRegisteredByThisPhase === false),
  check("nightly_runner_executed_false_or_safe_validation_only", result.nightlyRunnerExecutedByThisPhase === false || result.safeValidationOnly === true),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("docs_generated", result.docsGenerated),
];

finalize(result, checks, evidencePath, "phase643r_external_tool_nightly_reliability_validation_failed");
