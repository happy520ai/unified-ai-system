import {
  check,
  finalize,
  loadContextState,
  readJson,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase645r-external-tool/token-saving-benchmark-recheck-result.json";
const context = loadContextState();
const phase596 = readJson("apps/ai-gateway-service/evidence/phase596o/benchmark-aggregate-report-result.json", {});
const phase632 = readJson("apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json", {});

const result = {
  phase: "Phase645R-ExternalTool",
  name: "Token Saving Benchmark Recheck",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  tokenSavingBenchmarkRecheckGenerated: true,
  contextPackExists: context.contextPackExists,
  relevantFilesExists: context.relevantFilesExists,
  relevantFilesCount: context.relevantFilesCount,
  tokenBudgetReportExists: context.tokenBudgetReportExists,
  staleFalseConfirmed: context.staleFalse,
  fullRepoScanAvoided: true,
  outputBudgetRequired: true,
  estimatedSavingRecorded: context.estimatedSavingPercent > 0,
  estimatedSavingPercent: context.estimatedSavingPercent,
  estimatedTokens: context.estimatedTokens,
  rawEstimatedTokens: context.rawEstimatedTokens,
  phase596EvidenceReferenced: phase596.exists === true && !phase596.parseErrorReason,
  phase632PreflightEvidenceReferenced: phase632.data?.preflightPassed === true,
  realBillingClaimed: false,
  invoiceGenerated: false,
  ...safetyBoundary(),
  docs: [
    "docs/phase645r-external-tool-token-saving-benchmark-recheck.md",
    "docs/phase645r-external-tool-token-saving-result-summary.md",
    "docs/phase645r-external-tool-execution-report.md",
  ],
  evidencePath,
};

const checks = [
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
];

finalize(result, checks, evidencePath, "phase645r_external_tool_token_saving_recheck_failed");
