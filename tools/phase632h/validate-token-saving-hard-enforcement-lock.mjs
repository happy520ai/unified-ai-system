import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  taskTemplate: "docs/phase632-codex-token-saving-task-template.md",
  preflightChecklist: "docs/phase632-codex-token-saving-preflight-checklist.md",
  lockDoc: "docs/phase632h-token-saving-hard-enforcement-lock.md",
  report: "docs/phase632h-execution-report.md",
  readme: "README.md",
  agents: "AGENTS.md",
  evidence: "apps/ai-gateway-service/evidence/phase632h/token-saving-hard-enforcement-lock-result.json",
};

const requiredTemplateText = "docs/phase632-codex-token-saving-task-template.md";
const requiredPreflightText = "未通过 Phase632 preflight，不得继续执行";
const readmeText = readText(paths.readme);
const agentsText = readText(paths.agents);
const lockDocText = readText(paths.lockDoc);
const reportText = readText(paths.report);
const taskTemplateText = readText(paths.taskTemplate);
const preflightChecklistText = readText(paths.preflightChecklist);
const docsText = [readmeText, agentsText, lockDocText, reportText, taskTemplateText, preflightChecklistText].join("\n");

const result = {
  phase: "Phase632H",
  name: "Token Saving Hard Enforcement Lock",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  taskTemplateExists: Boolean(taskTemplateText),
  preflightChecklistExists: Boolean(preflightChecklistText),
  agentsContainsTemplateRule: has(agentsText, requiredTemplateText),
  agentsContainsPreflightBlockRule: has(agentsText, requiredPreflightText),
  readmeContainsTemplateRule: has(readmeText, requiredTemplateText),
  readmeContainsPreflightBlockRule: has(readmeText, requiredPreflightText),
  hardEnforcementEnabled: has(lockDocText, "hardEnforcementEnabled=true") && has(reportText, "hardEnforcementEnabled=true"),
  tokenSavingTemplateRequired: has(lockDocText, "tokenSavingTemplateRequired=true"),
  phase632PreflightRequired: has(lockDocText, "phase632PreflightRequired=true"),
  executionBlockedWithoutPreflight: has(lockDocText, "executionBlockedWithoutPreflight=true"),
  fullRepoScanForbidden: has(lockDocText, "fullRepoScanForbidden=true"),
  outputBudgetRequired: has(lockDocText, "outputBudgetRequired=true"),
  allCodexTasksMustUsePreflight: /All future Codex tasks must pass Phase632 preflight|所有 Codex 任务必须先走 Phase632 preflight/.test(lockDocText + readmeText + agentsText),
  mustReadContextPack: has(docsText, ".codex-context/current-context-pack.md"),
  mustReadRelevantFiles: has(docsText, ".codex-context/relevant-files.json"),
  mustCheckTokenBudget: /token budget|tokenBudget/i.test(docsText),
  mustCheckStaleFalse: has(docsText, "stale=false"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  docs: [paths.taskTemplate, paths.preflightChecklist, paths.lockDoc, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("task_template_exists", result.taskTemplateExists),
  check("preflight_checklist_exists", result.preflightChecklistExists),
  check("agents_contains_template_rule", result.agentsContainsTemplateRule),
  check("agents_contains_preflight_block_rule", result.agentsContainsPreflightBlockRule),
  check("readme_contains_template_rule", result.readmeContainsTemplateRule),
  check("readme_contains_preflight_block_rule", result.readmeContainsPreflightBlockRule),
  check("hard_enforcement_enabled", result.hardEnforcementEnabled),
  check("token_saving_template_required", result.tokenSavingTemplateRequired),
  check("phase632_preflight_required", result.phase632PreflightRequired),
  check("execution_blocked_without_preflight", result.executionBlockedWithoutPreflight),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("output_budget_required", result.outputBudgetRequired),
  check("all_codex_tasks_must_use_preflight", result.allCodexTasksMustUsePreflight),
  check("must_read_context_pack", result.mustReadContextPack),
  check("must_read_relevant_files", result.mustReadRelevantFiles),
  check("must_check_token_budget", result.mustCheckTokenBudget),
  check("must_check_stale_false", result.mustCheckStaleFalse),
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

finalize(result, checks, paths.evidence, "phase632h_token_saving_hard_enforcement_lock_failed");
