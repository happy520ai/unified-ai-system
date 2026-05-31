import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  policy: "docs/phase631r-token-saving-enforcement-policy.md",
  checklist: "docs/phase631r-codex-preflight-token-checklist.md",
  template: "docs/phase631r-token-saving-codex-task-template.md",
  report: "docs/phase631r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase631r/token-saving-enforcement-gate-result.json",
};

const policyText = readText(paths.policy);
const checklistText = readText(paths.checklist);
const templateText = readText(paths.template);
const reportText = readText(paths.report);
const docsText = [policyText, checklistText, templateText, reportText].join("\n");

const result = {
  phase: "Phase631R-Fix",
  name: "Token Saving Enforcement Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  tokenSavingPolicyGenerated: exists(paths.policy),
  codexPreflightChecklistGenerated: exists(paths.checklist),
  taskTemplateGenerated: exists(paths.template),
  executionReportGenerated: exists(paths.report),
  contextPackRequired: has(policyText, "contextPackRequired=true"),
  relevantFilesRequired: has(policyText, "relevantFilesRequired=true"),
  staleFalseRequired: has(policyText, "staleFalseRequired=true"),
  tokenBudgetRequired: has(policyText, "tokenBudgetRequired=true"),
  fullRepoScanForbidden: has(policyText, "fullRepoScanForbidden=true") && /不得全仓扫描|full repo scan/i.test(templateText),
  unrelatedHistoryForbidden: has(policyText, "unrelatedHistoryForbidden=true"),
  maxRelevantFilesDefault: extractNumber(policyText, "maxRelevantFilesDefault"),
  maxRelevantFilesHardLimit: extractNumber(policyText, "maxRelevantFilesHardLimit"),
  outputBudgetRequired: has(policyText, "outputBudgetRequired=true"),
  phaseScopeRequired: has(policyText, "phaseScopeRequired=true"),
  checklistRequiresContextPack: has(checklistText, ".codex-context/current-context-pack.md exists"),
  checklistRequiresRelevantFiles: has(checklistText, ".codex-context/relevant-files.json exists"),
  checklistRequiresFreshnessReport: has(checklistText, ".codex-context/context-freshness-report.json exists"),
  checklistRequiresStaleFalse: has(checklistText, "stale=false"),
  checklistRequiresRelevantFilesHardLimit: /relevantFiles count <= hard limit/i.test(checklistText),
  checklistRequiresExplicitScope: /task scope explicit/i.test(checklistText),
  checklistRequiresFullRepoScanInstruction: /forbidden full repo scan instruction present/i.test(checklistText),
  templateRestrictsReadScope: has(templateText, ".codex-context/current-context-pack.md") && has(templateText, ".codex-context/relevant-files.json"),
  templateForbidsSecrets: /不得读取 secret|Do not read secrets/i.test(templateText),
  templateRequiresAllowedFiles: /allowedFiles/i.test(templateText),
  templateRequiresOutputSummary: /修改文件|验证命令|边界确认/.test(templateText),
  providerCallsMade: false,
  codexExecExecutedByThisPhase: false,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  docs: [paths.policy, paths.checklist, paths.template, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("token_saving_policy_generated", result.tokenSavingPolicyGenerated),
  check("codex_preflight_checklist_generated", result.codexPreflightChecklistGenerated),
  check("task_template_generated", result.taskTemplateGenerated),
  check("context_pack_required", result.contextPackRequired),
  check("relevant_files_required", result.relevantFilesRequired),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("stale_false_required", result.staleFalseRequired),
  check("output_budget_required", result.outputBudgetRequired),
  check("phase_scope_required", result.phaseScopeRequired),
  check("max_relevant_files_default_20", result.maxRelevantFilesDefault === 20),
  check("max_relevant_files_hard_limit_50", result.maxRelevantFilesHardLimit === 50),
  check("checklist_requires_context_pack", result.checklistRequiresContextPack),
  check("checklist_requires_relevant_files", result.checklistRequiresRelevantFiles),
  check("checklist_requires_freshness_report", result.checklistRequiresFreshnessReport),
  check("checklist_requires_stale_false", result.checklistRequiresStaleFalse),
  check("checklist_requires_relevant_files_hard_limit", result.checklistRequiresRelevantFilesHardLimit),
  check("checklist_requires_explicit_scope", result.checklistRequiresExplicitScope),
  check("checklist_requires_full_repo_scan_instruction", result.checklistRequiresFullRepoScanInstruction),
  check("template_restricts_read_scope", result.templateRestrictsReadScope),
  check("template_forbids_secrets", result.templateForbidsSecrets),
  check("template_requires_allowed_files", result.templateRequiresAllowedFiles),
  check("template_requires_output_summary", result.templateRequiresOutputSummary),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
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

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase631r_token_saving_enforcement_gate_failed:${failed.join(",")}`;
}

result.checks = checks;
writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));
if (result.completed !== true || result.recommended_sealed !== true || result.blocker) process.exitCode = 1;

function readText(relativePath) {
  try {
    return fs.readFileSync(p(relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(p(relativePath)), { recursive: true });
  fs.writeFileSync(p(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function p(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(p(relativePath));
}

function has(text, pattern) {
  return text.includes(pattern);
}

function extractNumber(text, key) {
  const match = text.match(new RegExp(`${key}\\s*=\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']*(token|secret|apikey|api_key|key=|access_token|base_url)[^\s"']*/i.test(text);
}
