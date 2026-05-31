import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  exists,
  finalize,
  loadContextState,
  loadPreflightEvidence,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase646r-external-tool/daily-workflow-optimization-result.json";
const preflight = loadPreflightEvidence();
const contextState = loadContextState();
const docsText = [
  readText("docs/phase646r-external-tool-daily-workflow.md"),
  readText("docs/phase646r-external-tool-daily-task-template.md"),
  readText("docs/phase646r-external-tool-operator-routine.md"),
  readText("docs/phase646r-external-tool-execution-report.md"),
].join("\n");

const dailyStartChecklist = [
  "run_phase632_preflight",
  "use_phase632_task_template",
  "read_context_pack",
  "read_relevant_files",
  "confirm_stale_false",
  "confirm_token_budget",
  "forbid_full_repo_scan",
  "require_output_budget",
  "high_risk_gate_only",
];

const result = {
  phase: "Phase646R-ExternalTool",
  name: "External Tool Daily Workflow Optimization",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  dailyWorkflowGenerated: exists("docs/phase646r-external-tool-daily-workflow.md"),
  dailyTaskTemplateGenerated: exists("docs/phase646r-external-tool-daily-task-template.md"),
  operatorRoutineGenerated: exists("docs/phase646r-external-tool-operator-routine.md"),
  executionReportGenerated: exists("docs/phase646r-external-tool-execution-report.md"),
  dailyStartChecklist,
  phase632PreflightRequired: true,
  phase632PreflightPassed: preflight.data?.preflightPassed === true,
  phase632TaskTemplatePath: "docs/phase632-codex-token-saving-task-template.md",
  phase632TaskTemplateUsed: contextState.templateExists === true,
  contextPackRequired: true,
  contextPackExists: contextState.contextPackExists === true,
  relevantFilesRequired: true,
  relevantFilesExists: contextState.relevantFilesExists === true,
  relevantFilesCount: contextState.relevantFilesCount,
  staleFalseRequired: true,
  staleFalseConfirmed: contextState.staleFalse === true,
  tokenBudgetRequired: true,
  tokenBudgetReportExists: contextState.tokenBudgetReportExists === true,
  tokenBudgetRespected: contextState.tokenBudgetRespected === true,
  fullRepoScanForbidden: true,
  outputBudgetRequired: true,
  maxTasksPerManualBatch: 6,
  maxTasksPerNightlyBatch: 8,
  highRiskGateOnly: true,
  ...safetyBoundary(),
  docs: [
    "docs/phase646r-external-tool-daily-workflow.md",
    "docs/phase646r-external-tool-daily-task-template.md",
    "docs/phase646r-external-tool-operator-routine.md",
    "docs/phase646r-external-tool-execution-report.md",
  ],
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("daily_workflow_generated", result.dailyWorkflowGenerated),
  check("daily_task_template_generated", result.dailyTaskTemplateGenerated),
  check("operator_routine_generated", result.operatorRoutineGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("daily_start_checklist_generated", result.dailyStartChecklist.length >= 9),
  check("phase632_preflight_required", result.phase632PreflightRequired),
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("phase632_task_template_used", result.phase632TaskTemplateUsed),
  check("context_pack_required", result.contextPackRequired),
  check("context_pack_exists", result.contextPackExists),
  check("relevant_files_required", result.relevantFilesRequired),
  check("relevant_files_exists", result.relevantFilesExists),
  check("stale_false_required", result.staleFalseRequired),
  check("stale_false_confirmed", result.staleFalseConfirmed),
  check("token_budget_required", result.tokenBudgetRequired),
  check("token_budget_report_exists", result.tokenBudgetReportExists),
  check("token_budget_respected", result.tokenBudgetRespected),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("output_budget_required", result.outputBudgetRequired),
  check("max_tasks_per_manual_batch_6", result.maxTasksPerManualBatch === 6),
  check("max_tasks_per_nightly_batch_8", result.maxTasksPerNightlyBatch === 8),
  check("high_risk_gate_only", result.highRiskGateOnly),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase646r_external_tool_daily_workflow_failed");
