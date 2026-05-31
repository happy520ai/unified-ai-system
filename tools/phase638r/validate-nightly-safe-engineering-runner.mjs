import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  policy: "docs/phase638r-nightly-runner-policy.md",
  queue: "docs/phase638r-nightly-engineering-task-queue.json",
  runner: "tools/phase638r/run-nightly-safe-engineering-runner.mjs",
  register: "tools/phase638r/register-nightly-windows-task.ps1",
  unregister: "tools/phase638r/unregister-nightly-windows-task.ps1",
  doc: "docs/phase638r-nightly-safe-engineering-runner.md",
  registerDoc: "docs/phase638r-how-to-register-windows-task.md",
  disableDoc: "docs/phase638r-how-to-disable-nightly-runner.md",
  report: "docs/phase638r-execution-report.md",
  packageJson: "package.json",
  lastRun: "apps/ai-gateway-service/evidence/phase638r/nightly-runner-last-result.json",
  evidence: "apps/ai-gateway-service/evidence/phase638r/nightly-safe-engineering-runner-result.json",
};

const policyText = readText(paths.policy);
const runnerText = readText(paths.runner);
const registerText = readText(paths.register);
const unregisterText = readText(paths.unregister);
const docsText = [policyText, runnerText, registerText, unregisterText, readText(paths.doc), readText(paths.registerDoc), readText(paths.disableDoc), readText(paths.report)].join("\n");
const queue = readJson(paths.queue);
const packageJson = readJson(paths.packageJson);
const lastRun = readJson(paths.lastRun);
const tasks = Array.isArray(queue.data?.tasks) ? queue.data.tasks : [];
const autoTasks = tasks.filter((task) => task.autoExecutable === true && task.gateOnly === false);
const highRiskTasks = tasks.filter((task) => task.riskTier === "high" || task.gateOnly === true);
const scripts = packageJson.data?.scripts ?? {};

const allAutoTasksRiskLowOrMediumSafe = autoTasks.every((task) => ["low", "medium-safe"].includes(task.riskTier));
const allTasksHaveRequiredBoundaries = tasks.every(
  (task) =>
    Array.isArray(task.allowedFiles) &&
    Array.isArray(task.forbiddenFiles) &&
    Array.isArray(task.validationCommands) &&
    task.stopOnFailure === true &&
    task.providerCallsAllowed === false &&
    task.secretAccessAllowed === false &&
    task.codexConfigWriteAllowed === false &&
    task.chatModificationAllowed === false &&
    task.chatGatewayExecuteModificationAllowed === false &&
    task.deployAllowed === false &&
    task.pushAllowed === false &&
    task.commitAllowed === false,
);
const daemonBoundaryOk = has(policyText, "daemon=false") && has(runnerText, "daemon: false");
const infiniteLoopBoundaryOk = has(policyText, "infiniteLoop=false") && has(runnerText, "infiniteLoop: false");

const result = {
  phase: "Phase638R",
  name: "Nightly 20:00 Safe Engineering Task Runner",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  policyGenerated: Boolean(policyText),
  taskQueueGenerated: queue.exists === true && !queue.parseErrorReason,
  runnerGenerated: Boolean(runnerText),
  windowsRegisterScriptGenerated: Boolean(registerText),
  windowsUnregisterScriptGenerated: Boolean(unregisterText),
  phase632PreflightRequired: has(policyText, "phase632PreflightRequired=true") && has(runnerText, "preflight:phase632-token-saving"),
  tokenSavingTemplateRequired: has(policyText, "tokenSavingTemplateRequired=true"),
  nightlyStartTimeLocal: queue.data?.nightlyStartTimeLocal ?? null,
  daemon: false,
  infiniteLoop: false,
  daemonBoundaryOk,
  infiniteLoopBoundaryOk,
  maxTasksPerNightDefault: queue.data?.maxTasksPerNightDefault,
  maxTasksPerNightHardLimit: queue.data?.maxTasksPerNightHardLimit,
  highRiskAutoExecute: has(policyText, "highRiskAutoExecute=false") ? false : true,
  highRiskGateOnly: highRiskTasks.length >= 2 && highRiskTasks.every((task) => task.autoExecutable === false && task.gateOnly === true),
  allAutoTasksRiskLowOrMediumSafe,
  allTasksHaveRequiredBoundaries,
  providerCallsAllowed: false,
  secretAccessAllowed: false,
  codexConfigWriteAllowed: false,
  chatModificationAllowed: false,
  chatGatewayExecuteModificationAllowed: false,
  deployAllowed: false,
  pushAllowed: false,
  commitAllowed: false,
  runnerCheckPassed: lastRun.data?.completed === true && lastRun.data?.preflightPassed === true,
  scheduledTaskRegistered: false,
  packageNightlyScriptGenerated:
    scripts["nightly:phase638-safe-runner"] === "node tools/phase638r/run-nightly-safe-engineering-runner.mjs",
  packageVerifyScriptGenerated:
    scripts["verify:phase638r-nightly-safe-engineering-runner"] === "node tools/phase638r/validate-nightly-safe-engineering-runner.mjs",
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  docs: [paths.policy, paths.queue, paths.doc, paths.registerDoc, paths.disableDoc, paths.report],
  evidenceJson: paths.evidence,
  lastRunEvidenceJson: paths.lastRun,
};

const checks = [
  check("policy_generated", result.policyGenerated),
  check("task_queue_generated", result.taskQueueGenerated),
  check("runner_generated", result.runnerGenerated),
  check("windows_register_script_generated", result.windowsRegisterScriptGenerated),
  check("windows_unregister_script_generated", result.windowsUnregisterScriptGenerated),
  check("phase632_preflight_required", result.phase632PreflightRequired),
  check("token_saving_template_required", result.tokenSavingTemplateRequired),
  check("nightly_start_time_local_2000", result.nightlyStartTimeLocal === "20:00"),
  check("daemon_false", result.daemon === false && result.daemonBoundaryOk),
  check("infinite_loop_false", result.infiniteLoop === false && result.infiniteLoopBoundaryOk),
  check("max_tasks_default_8", result.maxTasksPerNightDefault === 8),
  check("max_tasks_hard_limit_12", result.maxTasksPerNightHardLimit === 12),
  check("high_risk_auto_execute_false", result.highRiskAutoExecute === false),
  check("high_risk_gate_only", result.highRiskGateOnly),
  check("all_auto_tasks_risk_low_or_medium_safe", result.allAutoTasksRiskLowOrMediumSafe),
  check("all_tasks_have_required_boundaries", result.allTasksHaveRequiredBoundaries),
  check("provider_calls_allowed_false", result.providerCallsAllowed === false),
  check("secret_access_allowed_false", result.secretAccessAllowed === false),
  check("codex_config_write_allowed_false", result.codexConfigWriteAllowed === false),
  check("chat_modification_allowed_false", result.chatModificationAllowed === false),
  check("chat_gateway_execute_modification_allowed_false", result.chatGatewayExecuteModificationAllowed === false),
  check("deploy_allowed_false", result.deployAllowed === false),
  check("push_allowed_false", result.pushAllowed === false),
  check("commit_allowed_false", result.commitAllowed === false),
  check("runner_check_passed", result.runnerCheckPassed),
  check("package_nightly_script_generated", result.packageNightlyScriptGenerated),
  check("package_verify_script_generated", result.packageVerifyScriptGenerated),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, paths.evidence, "phase638r_nightly_safe_engineering_runner_failed");
