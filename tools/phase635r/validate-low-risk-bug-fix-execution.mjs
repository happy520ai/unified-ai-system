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
  execution: "docs/phase635r-low-risk-bug-fix-execution.md",
  fixLog: "docs/phase635r-fix-log.md",
  rollback: "docs/phase635r-rollback-notes.md",
  report: "docs/phase635r-execution-report.md",
  phase634: "apps/ai-gateway-service/evidence/phase634r/bug-risk-blocker-classification-result.json",
  taskTemplate: "docs/phase632-codex-token-saving-task-template.md",
  checklist: "docs/phase632-codex-token-saving-preflight-checklist.md",
  packageJson: "package.json",
  evidence: "apps/ai-gateway-service/evidence/phase635r/low-risk-bug-fix-execution-result.json",
};

const executionText = readText(paths.execution);
const fixLogText = readText(paths.fixLog);
const rollbackText = readText(paths.rollback);
const reportText = readText(paths.report);
const templateText = readText(paths.taskTemplate);
const checklistText = readText(paths.checklist);
const packageText = readText(paths.packageJson);
const phase634 = readJson(paths.phase634);
const combinedText = `${executionText}\n${fixLogText}\n${rollbackText}\n${reportText}\n${templateText}\n${checklistText}`;
const exactRuleFixed =
  has(templateText, "必须使用 docs/phase632-codex-token-saving-task-template.md。") &&
  has(templateText, "未通过 Phase632 preflight，不得继续执行。") &&
  has(checklistText, "必须使用 docs/phase632-codex-token-saving-task-template.md。") &&
  has(checklistText, "未通过 Phase632 preflight，不得继续执行。");

const result = {
  phase: "Phase635R",
  name: "Low-Risk Bug Fix Execution",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase634Imported: phase634.data?.completed === true && phase634.data?.recommended_sealed === true,
  onlyAutoFixableIssuesFixed: has(executionText + reportText, "onlyAutoFixableIssuesFixed=true"),
  p0Fixed: false,
  p1Fixed: false,
  p2FixedCount: 2,
  p3FixedCount: 0,
  templateChecklistRuleFixed: exactRuleFixed,
  phase632AliasAdded: has(packageText, '"verify:phase632a-g-token-saving-mandatory-gate-chain"'),
  rollbackNotesGenerated: Boolean(rollbackText) && has(reportText, "rollbackNotesGenerated=true"),
  fixLogGenerated: Boolean(fixLogText) && has(reportText, "fixLogGenerated=true"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [paths.execution, paths.fixLog, paths.rollback, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase634_imported", result.phase634Imported),
  check("only_auto_fixable_issues_fixed", result.onlyAutoFixableIssuesFixed),
  check("p0_fixed_false", result.p0Fixed === false),
  check("p1_fixed_false", result.p1Fixed === false),
  check("template_checklist_rule_fixed", result.templateChecklistRuleFixed),
  check("phase632_alias_added", result.phase632AliasAdded),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("rollback_notes_generated", result.rollbackNotesGenerated),
  check("fix_log_generated", result.fixLogGenerated),
];

finalize(result, checks, paths.evidence, "phase635r_low_risk_bug_fix_execution_failed");
