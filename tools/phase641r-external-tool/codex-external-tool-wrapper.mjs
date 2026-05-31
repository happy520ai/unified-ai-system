import {
  check,
  finalize,
  loadContextState,
  runPhase632Preflight,
  safetyBoundary,
} from "./external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase641r-external-tool/codex-external-tool-cli-wrapper-result.json";

const preflight = runPhase632Preflight();
const context = loadContextState();

const result = {
  phase: "Phase641R-ExternalTool",
  name: "Codex External Tool CLI Wrapper",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  mode: "preflight-plan-dry-run",
  cliWrapperGenerated: true,
  phase632PreflightRequired: true,
  phase632PreflightPassed: preflight.passed,
  templateRequired: true,
  templateExists: context.templateExists,
  contextPackRequired: true,
  contextPackExists: context.contextPackExists,
  relevantFilesRequired: true,
  relevantFilesExists: context.relevantFilesExists,
  relevantFilesCount: context.relevantFilesCount,
  tokenBudgetRequired: true,
  tokenBudgetReportExists: context.tokenBudgetReportExists,
  tokenBudgetRespected: context.tokenBudgetRespected,
  tokenBudgetStatus: context.tokenBudgetRespected ? "respected" : "missing_or_not_respected",
  staleFalseRequired: true,
  stale: context.stale,
  staleFalse: context.staleFalse,
  fullRepoScanForbidden: true,
  outputBudgetRequired: true,
  defaultDryRunOnly: true,
  filesModifiedByWrapper: false,
  nextCommandSuggestion: "cmd /c pnpm run codex:external-tool:preflight",
  ...safetyBoundary(),
  evidencePath,
};

const checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("template_exists", result.templateExists),
  check("context_pack_exists", result.contextPackExists),
  check("relevant_files_exists", result.relevantFilesExists),
  check("token_budget_report_exists", result.tokenBudgetReportExists),
  check("token_budget_respected", result.tokenBudgetRespected),
  check("stale_false", result.staleFalse),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase641r_external_tool_cli_wrapper_failed");
