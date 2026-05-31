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
  audit: "docs/phase633r-full-system-audit-baseline.md",
  scope: "docs/phase633r-audit-scope.md",
  report: "docs/phase633r-execution-report.md",
  preflight: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
  evidence: "apps/ai-gateway-service/evidence/phase633r/full-system-audit-baseline-result.json",
};

const auditText = readText(paths.audit);
const scopeText = readText(paths.scope);
const reportText = readText(paths.report);
const preflight = readJson(paths.preflight);
const combinedText = `${auditText}\n${scopeText}\n${reportText}`;

const result = {
  phase: "Phase633R",
  name: "Full System Audit Baseline",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  auditScopeGenerated: Boolean(scopeText),
  auditBaselineGenerated: Boolean(auditText),
  executionReportGenerated: Boolean(reportText),
  phase632PreflightPassed: preflight.data?.preflightPassed === true && preflight.data?.staleFalse === true,
  contextPackUsed: has(scopeText + reportText, "contextPackUsed=true"),
  relevantFilesUsed: has(scopeText + reportText, "relevantFilesUsed=true"),
  fullRepoScanForbidden: has(scopeText + reportText, "fullRepoScanForbidden=true"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [paths.audit, paths.scope, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("audit_scope_generated", result.auditScopeGenerated),
  check("audit_baseline_generated", result.auditBaselineGenerated),
  check("execution_report_generated", result.executionReportGenerated),
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("context_pack_used", result.contextPackUsed),
  check("relevant_files_used", result.relevantFilesUsed),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase633r_full_system_audit_baseline_failed");
