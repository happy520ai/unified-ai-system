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
  phase632Closure:
    "apps/ai-gateway-service/evidence/phase632g/token-saving-mandatory-gate-chain-closure-result.json",
  wrapper: "tools/token-saving/run-codex-token-saving-preflight.mjs",
  policy: "docs/phase633a-token-saving-preflight-wrapper-policy.md",
  template: "docs/phase633a-token-saving-preflight-input.template.json",
  report: "docs/phase633a-execution-report.md",
  preflightEvidence: "apps/ai-gateway-service/evidence/phase633a/token-saving-preflight-wrapper-run.json",
  evidence: "apps/ai-gateway-service/evidence/phase633a/token-saving-preflight-wrapper-result.json",
};

const phase632 = readJson(paths.phase632Closure);
const wrapperText = readText(paths.wrapper);
const policyText = readText(paths.policy);
const templateText = readText(paths.template);
const reportText = readText(paths.report);
const preflight = readJson(paths.preflightEvidence);
const docsText = [wrapperText, policyText, templateText, reportText, JSON.stringify(preflight.data ?? {})].join("\n");

const phase632Imported =
  phase632.exists === true &&
  !phase632.parseErrorReason &&
  phase632.data?.completed === true &&
  phase632.data?.recommended_sealed === true &&
  phase632.data?.blocker === null &&
  phase632.data?.mandatoryGateChainSealed === true;

const result = {
  phase: "Phase633A",
  name: "Token Saving Preflight Wrapper",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase632Imported,
  preflightWrapperGenerated: Boolean(wrapperText),
  policyGenerated: Boolean(policyText),
  inputTemplateGenerated: Boolean(templateText),
  executionReportGenerated: Boolean(reportText),
  preflightRunEvidenceGenerated: preflight.exists === true && !preflight.parseErrorReason,
  wrapperChecksContextPack: has(wrapperText, ".codex-context/current-context-pack.md"),
  wrapperChecksRelevantFiles: has(wrapperText, ".codex-context/relevant-files.json"),
  wrapperChecksFreshnessReport: has(wrapperText, ".codex-context/context-freshness-report.json"),
  wrapperBlocksStale: has(wrapperText, "stale_false_required") || has(wrapperText, "stale=false"),
  wrapperBlocksFullRepoScan: has(wrapperText, "fullRepoScanForbidden") && has(wrapperText, "forbiddenFullRepoScan"),
  wrapperEnforcesRelevantFileLimit: has(wrapperText, "maxRelevantFilesHardLimit"),
  wrapperEnforcesOutputBudget: has(wrapperText, "outputBudgetRequired"),
  dryRunOnly: has(policyText, "dryRunOnly=true") && preflight.data?.dryRunOnly === true,
  codexExecExecutedByThisPhase: false,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  preflightResult: preflight.data ?? null,
  docs: [paths.policy, paths.template, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase632_imported", result.phase632Imported),
  check("preflight_wrapper_generated", result.preflightWrapperGenerated),
  check("policy_generated", result.policyGenerated),
  check("input_template_generated", result.inputTemplateGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("preflight_run_evidence_generated", result.preflightRunEvidenceGenerated),
  check("wrapper_checks_context_pack", result.wrapperChecksContextPack),
  check("wrapper_checks_relevant_files", result.wrapperChecksRelevantFiles),
  check("wrapper_checks_freshness_report", result.wrapperChecksFreshnessReport),
  check("wrapper_blocks_stale", result.wrapperBlocksStale),
  check("wrapper_blocks_full_repo_scan", result.wrapperBlocksFullRepoScan),
  check("wrapper_enforces_relevant_file_limit", result.wrapperEnforcesRelevantFileLimit),
  check("wrapper_enforces_output_budget", result.wrapperEnforcesOutputBudget),
  check("dry_run_only", result.dryRunOnly),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase633a_token_saving_preflight_wrapper_failed");
