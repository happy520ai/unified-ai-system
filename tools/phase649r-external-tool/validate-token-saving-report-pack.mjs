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
  "apps/ai-gateway-service/evidence/phase649r-external-tool/token-saving-report-pack-result.json";
const summary = readJson("docs/phase649r-external-tool-token-saving-summary.json", {});
const phase645 = readJson("apps/ai-gateway-service/evidence/phase645r-external-tool/token-saving-benchmark-recheck-result.json", {});
const docsText = [
  readText("docs/phase649r-external-tool-token-saving-report.md"),
  readText("docs/phase649r-external-tool-token-saving-limits.md"),
  readText("docs/phase649r-external-tool-execution-report.md"),
  JSON.stringify(summary.data ?? {}),
].join("\n");

const result = {
  phase: "Phase649R-ExternalTool",
  name: "External Tool Token Saving Report Pack",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  tokenSavingReportGenerated: exists("docs/phase649r-external-tool-token-saving-report.md"),
  tokenSavingSummaryGenerated: summary.exists === true && !summary.parseErrorReason,
  tokenSavingLimitsGenerated: exists("docs/phase649r-external-tool-token-saving-limits.md"),
  executionReportGenerated: exists("docs/phase649r-external-tool-execution-report.md"),
  phase596HistoricalEstimateReferenced: summary.data?.phase596HistoricalEstimateReferenced === true,
  phase632PreflightRequired: summary.data?.phase632PreflightRequired === true,
  phase645RecheckReferenced: summary.data?.phase645RecheckReferenced === true && phase645.exists === true,
  estimatedSavingOnly: summary.data?.estimatedSavingOnly === true,
  realBillingClaimed: summary.data?.realBillingClaimed === true,
  invoiceGenerated: summary.data?.invoiceGenerated === true,
  contextPackSavingsDocumented: docsText.includes("Context pack"),
  relevantFilesSavingsDocumented: docsText.includes("Relevant files"),
  staleGateSavingsDocumented: docsText.includes("Stale gate"),
  tokenBudgetSavingsDocumented: docsText.includes("Token budget"),
  outputBudgetSavingsDocumented: docsText.includes("Output budget"),
  phase645EstimatedSavingPercent: Number(phase645.data?.estimatedSavingPercent ?? 0),
  ...safetyBoundary(),
  docs: [
    "docs/phase649r-external-tool-token-saving-report.md",
    "docs/phase649r-external-tool-token-saving-summary.json",
    "docs/phase649r-external-tool-token-saving-limits.md",
    "docs/phase649r-external-tool-execution-report.md",
  ],
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("token_saving_report_generated", result.tokenSavingReportGenerated),
  check("token_saving_summary_generated", result.tokenSavingSummaryGenerated),
  check("token_saving_limits_generated", result.tokenSavingLimitsGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("phase596_historical_estimate_referenced", result.phase596HistoricalEstimateReferenced),
  check("phase632_preflight_required", result.phase632PreflightRequired),
  check("phase645_recheck_referenced", result.phase645RecheckReferenced),
  check("context_pack_savings_documented", result.contextPackSavingsDocumented),
  check("relevant_files_savings_documented", result.relevantFilesSavingsDocumented),
  check("stale_gate_savings_documented", result.staleGateSavingsDocumented),
  check("token_budget_savings_documented", result.tokenBudgetSavingsDocumented),
  check("output_budget_savings_documented", result.outputBudgetSavingsDocumented),
  check("estimated_saving_only_true", result.estimatedSavingOnly),
  check("real_billing_claimed_false", result.realBillingClaimed === false),
  check("invoice_generated_false", result.invoiceGenerated === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase649r_external_tool_token_saving_report_failed");
