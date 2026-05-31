import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  exists,
  finalize,
  loadPreflightEvidence,
  readJson,
  readText,
  safetyBoundary,
} from "./external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase641r-external-tool/codex-external-tool-cli-wrapper-result.json";
const wrapperEvidence = readJson(evidencePath, {});
const preflight = loadPreflightEvidence();
const packageJson = readJson("package.json", {});
const scripts = packageJson.data?.scripts ?? {};
const wrapperText = readText("tools/phase641r-external-tool/codex-external-tool-wrapper.mjs");
const docsText = [
  readText("docs/phase641r-external-tool-cli-wrapper.md"),
  readText("docs/phase641r-external-tool-cli-usage.md"),
  readText("docs/phase641r-external-tool-execution-report.md"),
].join("\n");

const result = {
  phase: "Phase641R-ExternalTool",
  name: "Codex External Tool CLI Wrapper Validation",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  cliWrapperGenerated: exists("tools/phase641r-external-tool/codex-external-tool-wrapper.mjs"),
  validatorGenerated: exists("tools/phase641r-external-tool/validate-codex-external-tool-cli-wrapper.mjs"),
  phase632PreflightRequired: true,
  phase632PreflightPassed: preflight.data?.preflightPassed === true,
  templateRequired: wrapperEvidence.data?.templateRequired === true,
  contextPackRequired: wrapperEvidence.data?.contextPackRequired === true,
  relevantFilesRequired: wrapperEvidence.data?.relevantFilesRequired === true,
  tokenBudgetRequired: wrapperEvidence.data?.tokenBudgetRequired === true,
  staleFalseRequired: wrapperEvidence.data?.staleFalseRequired === true,
  wrapperEvidenceGenerated: wrapperEvidence.exists === true && !wrapperEvidence.parseErrorReason,
  defaultDryRunOnly: wrapperEvidence.data?.defaultDryRunOnly !== false,
  wrapperDryRunOnly: wrapperEvidence.data?.defaultDryRunOnly !== false,
  wrapperDoesNotExecuteCodex: !/\bcodex\s+exec\b/i.test(wrapperText),
  packageScriptGenerated:
    scripts["codex:external-tool:preflight"] === "node tools/phase641r-external-tool/codex-external-tool-wrapper.mjs",
  packageVerifyScriptGenerated:
    scripts["verify:phase641r-external-tool-cli-wrapper"] ===
    "node tools/phase641r-external-tool/validate-codex-external-tool-cli-wrapper.mjs",
  ...safetyBoundary(),
  docs: [
    "docs/phase641r-external-tool-cli-wrapper.md",
    "docs/phase641r-external-tool-cli-usage.md",
    "docs/phase641r-external-tool-execution-report.md",
  ],
  evidencePath,
};

result.secretValueExposed = containsSecretLikeValue(docsText);
result.rawBaseUrlValueExposed = containsRawBaseUrlValue(docsText);
result.webhookValueExposed = containsWebhookLikeValue(docsText);

const checks = [
  check("cli_wrapper_generated", result.cliWrapperGenerated),
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("template_required", result.templateRequired),
  check("context_pack_required", result.contextPackRequired),
  check("relevant_files_required", result.relevantFilesRequired),
  check("token_budget_required", result.tokenBudgetRequired),
  check("stale_false_required", result.staleFalseRequired),
  check("wrapper_evidence_generated", result.wrapperEvidenceGenerated),
  check("wrapper_dry_run_only", result.wrapperDryRunOnly),
  check("wrapper_does_not_execute_codex", result.wrapperDoesNotExecuteCodex),
  check("package_script_generated", result.packageScriptGenerated),
  check("package_verify_script_generated", result.packageVerifyScriptGenerated),
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
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, evidencePath, "phase641r_external_tool_cli_wrapper_validation_failed");
