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
  "apps/ai-gateway-service/evidence/phase645r-external-tool/token-saving-benchmark-recheck-result.json";
const recheck = readJson(evidencePath, {});
const docsText = [
  readText("docs/phase645r-external-tool-token-saving-benchmark-recheck.md"),
  readText("docs/phase645r-external-tool-token-saving-result-summary.md"),
  readText("docs/phase645r-external-tool-execution-report.md"),
].join("\n");

const result = {
  phase: "Phase645R-ExternalTool",
  name: "Token Saving Benchmark Recheck Validation",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  tokenSavingBenchmarkRecheckGenerated: recheck.exists === true && !recheck.parseErrorReason,
  contextPackExists: recheck.data?.contextPackExists === true,
  relevantFilesExists: recheck.data?.relevantFilesExists === true,
  tokenBudgetReportExists: recheck.data?.tokenBudgetReportExists === true,
  staleFalseConfirmed: recheck.data?.staleFalseConfirmed === true,
  fullRepoScanAvoided: recheck.data?.fullRepoScanAvoided === true,
  outputBudgetRequired: recheck.data?.outputBudgetRequired === true,
  estimatedSavingRecorded: recheck.data?.estimatedSavingRecorded === true,
  realBillingClaimed: recheck.data?.realBillingClaimed === true,
  invoiceGenerated: recheck.data?.invoiceGenerated === true,
  docsGenerated:
    exists("docs/phase645r-external-tool-token-saving-benchmark-recheck.md") &&
    exists("docs/phase645r-external-tool-token-saving-result-summary.md") &&
    exists("docs/phase645r-external-tool-execution-report.md"),
  ...safetyBoundary(),
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("token_saving_benchmark_recheck_generated", result.tokenSavingBenchmarkRecheckGenerated),
  check("context_pack_exists", result.contextPackExists),
  check("relevant_files_exists", result.relevantFilesExists),
  check("token_budget_report_exists", result.tokenBudgetReportExists),
  check("stale_false_confirmed", result.staleFalseConfirmed),
  check("full_repo_scan_avoided", result.fullRepoScanAvoided),
  check("output_budget_required", result.outputBudgetRequired),
  check("estimated_saving_recorded", result.estimatedSavingRecorded),
  check("real_billing_claimed_false", result.realBillingClaimed === false),
  check("invoice_generated_false", result.invoiceGenerated === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("docs_generated", result.docsGenerated),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, evidencePath, "phase645r_external_tool_token_saving_recheck_validation_failed");
