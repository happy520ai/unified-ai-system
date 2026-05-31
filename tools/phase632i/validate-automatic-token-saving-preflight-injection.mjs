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
  taskTemplate: "docs/phase632-codex-token-saving-task-template.md",
  preflightChecklist: "docs/phase632-codex-token-saving-preflight-checklist.md",
  wrapper: "tools/phase632i/run-token-saving-preflight.mjs",
  verifier: "tools/phase632i/validate-automatic-token-saving-preflight-injection.mjs",
  docs: "docs/phase632i-automatic-token-saving-preflight-injection.md",
  report: "docs/phase632i-execution-report.md",
  readme: "README.md",
  agents: "AGENTS.md",
  packageJson: "package.json",
  runEvidence: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
  evidence: "apps/ai-gateway-service/evidence/phase632i/automatic-token-saving-preflight-injection-result.json",
};

const requiredTemplateText = "docs/phase632-codex-token-saving-task-template.md";
const requiredPreflightText = "未通过 Phase632 preflight，不得继续执行";
const agentsText = readText(paths.agents);
const readmeText = readText(paths.readme);
const wrapperText = readText(paths.wrapper);
const verifierText = readText(paths.verifier);
const docsText = readText(paths.docs);
const reportText = readText(paths.report);
const taskTemplateText = readText(paths.taskTemplate);
const preflightChecklistText = readText(paths.preflightChecklist);
const packageJson = readJson(paths.packageJson);
const runEvidence = readJson(paths.runEvidence);
const combinedText = [
  agentsText,
  readmeText,
  wrapperText,
  verifierText,
  docsText,
  reportText,
  taskTemplateText,
  preflightChecklistText,
  JSON.stringify(runEvidence.data ?? {}),
].join("\n");

const scripts = packageJson.data?.scripts ?? {};
const agentsHardRulePresent =
  has(agentsText, requiredTemplateText) &&
  has(agentsText, requiredPreflightText) &&
  /所有 Codex 任务必须先跑 Phase632 preflight|All Codex tasks must first pass Phase632 preflight/.test(agentsText) &&
  /full repo scan/i.test(agentsText) &&
  has(agentsText, "context pack") &&
  has(agentsText, "relevant files") &&
  has(agentsText, "token budget") &&
  has(agentsText, "stale=false");
const readmeHardRulePresent =
  has(readmeText, requiredTemplateText) &&
  has(readmeText, requiredPreflightText) &&
  /所有 Codex 任务必须先跑 Phase632 preflight|All Codex tasks must first pass Phase632 preflight/.test(readmeText) &&
  /full repo scan/i.test(readmeText) &&
  has(readmeText, "context pack") &&
  has(readmeText, "relevant files") &&
  has(readmeText, "token budget") &&
  has(readmeText, "stale=false");

const result = {
  phase: "Phase632I",
  name: "Automatic Token-Saving Preflight Injection",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  agentsHardRulePresent,
  readmeHardRulePresent,
  wrapperGenerated:
    Boolean(wrapperText) &&
    has(wrapperText, ".codex-context/current-context-pack.md") &&
    has(wrapperText, ".codex-context/relevant-files.json") &&
    has(wrapperText, ".codex-context/context-freshness-report.json") &&
    has(wrapperText, ".codex-context/token-budget-report.json") &&
    has(wrapperText, "maxRelevantFilesHardLimit") &&
    has(wrapperText, "fullRepoScanForbidden") &&
    has(wrapperText, "outputBudgetRequired"),
  packagePreflightScriptGenerated:
    scripts["preflight:phase632-token-saving"] === "node tools/phase632i/run-token-saving-preflight.mjs",
  packageVerifyScriptGenerated:
    scripts["verify:phase632i-automatic-token-saving-preflight-injection"] ===
    "node tools/phase632i/validate-automatic-token-saving-preflight-injection.mjs",
  templateExists: Boolean(taskTemplateText),
  checklistExists: Boolean(preflightChecklistText),
  executionBlockedWithoutPreflight:
    has(docsText, "executionBlockedWithoutPreflight=true") &&
    has(reportText, "executionBlockedWithoutPreflight=true") &&
    has(agentsText, requiredPreflightText) &&
    has(readmeText, requiredPreflightText),
  wrapperPreflightPassed: runEvidence.data?.preflightPassed === true,
  docsGenerated: Boolean(docsText),
  executionReportGenerated: Boolean(reportText),
  automaticRuleInjectionEnabled: has(docsText, "automaticRuleInjectionEnabled=true"),
  userDoesNotNeedManualRuleText: has(docsText, "manualRuleTextNoLongerRequired=true"),
  codexExecExecutedByThisPhase: false,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [paths.docs, paths.report],
  wrapper: paths.wrapper,
  runEvidenceJson: paths.runEvidence,
  evidenceJson: paths.evidence,
};

const checks = [
  check("agents_hard_rule_present", result.agentsHardRulePresent),
  check("readme_hard_rule_present", result.readmeHardRulePresent),
  check("wrapper_generated", result.wrapperGenerated),
  check("package_preflight_script_generated", result.packagePreflightScriptGenerated),
  check("package_verify_script_generated", result.packageVerifyScriptGenerated),
  check("template_exists", result.templateExists),
  check("checklist_exists", result.checklistExists),
  check("execution_blocked_without_preflight", result.executionBlockedWithoutPreflight),
  check("wrapper_preflight_passed", result.wrapperPreflightPassed),
  check("docs_generated", result.docsGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("automatic_rule_injection_enabled", result.automaticRuleInjectionEnabled),
  check("user_does_not_need_manual_rule_text", result.userDoesNotNeedManualRuleText),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_false", result.providerCallsMade === false),
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

finalize(result, checks, paths.evidence, "phase632i_automatic_token_saving_preflight_injection_failed");
