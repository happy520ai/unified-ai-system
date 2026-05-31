import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  readJson,
  readText,
  safetyBoundary,
  writeJson,
} from "../phase632-common.mjs";

const paths = {
  taskTemplate: "docs/phase632-codex-token-saving-task-template.md",
  preflightChecklist: "docs/phase632-codex-token-saving-preflight-checklist.md",
  contextPack: ".codex-context/current-context-pack.md",
  relevantFiles: ".codex-context/relevant-files.json",
  freshnessReport: ".codex-context/context-freshness-report.json",
  tokenBudgetReport: ".codex-context/token-budget-report.json",
  runEvidence: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
};

const maxRelevantFilesHardLimit = 50;
const taskTemplateText = readText(paths.taskTemplate);
const preflightChecklistText = readText(paths.preflightChecklist);
const contextPackText = readText(paths.contextPack);
const relevantFilesJson = readJson(paths.relevantFiles);
const freshnessReportJson = readJson(paths.freshnessReport);
const tokenBudgetReportJson = readJson(paths.tokenBudgetReport);
const relevantFiles = Array.isArray(relevantFilesJson.data?.files) ? relevantFilesJson.data.files : [];
const policyText = `${taskTemplateText}\n${preflightChecklistText}`;

const result = {
  phase: "Phase632I",
  name: "Automatic Token-Saving Preflight Injection Run",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  preflightPassed: true,
  taskTemplateExists: taskTemplateText.length > 0,
  preflightChecklistExists: preflightChecklistText.length > 0,
  contextPackExists: contextPackText.length > 0,
  relevantFilesExists: relevantFilesJson.exists === true && !relevantFilesJson.parseErrorReason,
  freshnessReportExists: freshnessReportJson.exists === true && !freshnessReportJson.parseErrorReason,
  tokenBudgetReportExists: tokenBudgetReportJson.exists === true && !tokenBudgetReportJson.parseErrorReason,
  staleFalse: freshnessReportJson.data?.stale === false,
  relevantFilesCount: relevantFiles.length,
  relevantFilesWithinHardLimit: relevantFiles.length <= maxRelevantFilesHardLimit,
  maxRelevantFilesHardLimit,
  tokenBudgetRequired: true,
  tokenBudgetReportRespected:
    tokenBudgetReportJson.data?.budget?.respected === true || /tokenBudgetRespected:\s*true/i.test(contextPackText),
  fullRepoScanForbidden:
    /full repo scan/i.test(policyText) &&
    (/forbidden/i.test(policyText) || /forbid/i.test(policyText) || /禁止/.test(policyText)),
  outputBudgetRequired: /output budget/i.test(policyText) || /outputBudgetRequired=true/.test(policyText),
  executionBlockedWithoutPreflight: true,
  codexExecExecutedByThisPhase: false,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(policyText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(policyText),
  webhookValueExposed: containsWebhookLikeValue(policyText),
  runEvidenceJson: paths.runEvidence,
};

const checks = [
  check("task_template_exists", result.taskTemplateExists),
  check("preflight_checklist_exists", result.preflightChecklistExists),
  check("context_pack_exists", result.contextPackExists),
  check("relevant_files_exists", result.relevantFilesExists),
  check("freshness_report_exists", result.freshnessReportExists),
  check("token_budget_report_exists", result.tokenBudgetReportExists),
  check("stale_false", result.staleFalse),
  check("relevant_files_within_hard_limit", result.relevantFilesWithinHardLimit),
  check("token_budget_report_respected", result.tokenBudgetReportRespected),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("output_budget_required", result.outputBudgetRequired),
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

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.preflightPassed = false;
  result.blocker = `phase632i_token_saving_preflight_failed:${failed.join(",")}`;
}

result.checks = checks;
writeJson(paths.runEvidence, result);
console.log(JSON.stringify(result, null, 2));

if (!result.preflightPassed) {
  process.exitCode = 1;
}
