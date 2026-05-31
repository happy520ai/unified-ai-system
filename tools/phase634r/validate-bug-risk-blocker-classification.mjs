import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  classification: "docs/phase634r-bug-risk-blocker-classification.md",
  ledger: "docs/phase634r-issue-ledger.json",
  candidates: "docs/phase634r-fix-candidate-list.md",
  report: "docs/phase634r-execution-report.md",
  phase633: "apps/ai-gateway-service/evidence/phase633r/full-system-audit-baseline-result.json",
  evidence: "apps/ai-gateway-service/evidence/phase634r/bug-risk-blocker-classification-result.json",
};

const ledger = readJson(paths.ledger);
const issues = Array.isArray(ledger.data?.issues) ? ledger.data.issues : [];
const classificationText = readText(paths.classification);
const candidateText = readText(paths.candidates);
const reportText = readText(paths.report);
const phase633 = readJson(paths.phase633);
const combinedText = `${classificationText}\n${candidateText}\n${reportText}\n${JSON.stringify(ledger.data ?? {})}`;
const p0 = issues.filter((issue) => issue.severity === "P0");
const p1 = issues.filter((issue) => issue.severity === "P1");
const p2 = issues.filter((issue) => issue.severity === "P2");
const p3 = issues.filter((issue) => issue.severity === "P3");
const autoFixIssues = issues.filter((issue) => issue.canAutoFix === true);
const secretIssues = issues.filter((issue) => issue.touchesSecret === true);
const chatIssues = issues.filter((issue) => issue.touchesChat === true || issue.touchesChatGatewayExecute === true);
const providerRuntimeIssues = issues.filter((issue) => issue.touchesProviderRuntime === true);

const requiredFields = [
  "issueId",
  "title",
  "severity",
  "affectedFiles",
  "canAutoFix",
  "reason",
  "proposedFix",
  "validationCommand",
  "rollbackNote",
  "touchesChat",
  "touchesChatGatewayExecute",
  "touchesProviderRuntime",
  "touchesSecret",
  "deployNeeded",
];

const result = {
  phase: "Phase634R",
  name: "Bug Risk Blocker Classification",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase633Imported: phase633.data?.completed === true && phase633.data?.recommended_sealed === true,
  issueLedgerGenerated: ledger.exists === true && !ledger.parseErrorReason && issues.length > 0,
  everyIssueHasSeverity: issues.every((issue) => Boolean(issue.severity)),
  everyIssueHasRequiredFields: issues.every((issue) => requiredFields.every((field) => Object.hasOwn(issue, field))),
  p0NotAutoFixable: p0.every((issue) => issue.canAutoFix === false),
  p1RequiresSeparateApproval: p1.every((issue) => issue.canAutoFix === false),
  p2AutoFixAllowed: p2.every((issue) => issue.canAutoFix === true),
  secretIssuesNotAutoFixed: secretIssues.every((issue) => issue.canAutoFix === false),
  chatIssuesNotAutoFixed: chatIssues.every((issue) => issue.canAutoFix === false),
  providerRuntimeIssuesNotAutoFixed: providerRuntimeIssues.every((issue) => issue.canAutoFix === false),
  p0BlockerCount: p0.length,
  p1RiskCount: p1.length,
  p2AutoFixCandidateCount: p2.length,
  p3CandidateCount: p3.length,
  autoFixIssueIds: autoFixIssues.map((issue) => issue.issueId),
  issues,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: [paths.classification, paths.ledger, paths.candidates, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase633_imported", result.phase633Imported),
  check("issue_ledger_generated", result.issueLedgerGenerated),
  check("every_issue_has_severity", result.everyIssueHasSeverity),
  check("every_issue_has_required_fields", result.everyIssueHasRequiredFields),
  check("p0_not_auto_fixable", result.p0NotAutoFixable),
  check("p1_requires_separate_approval", result.p1RequiresSeparateApproval),
  check("p2_auto_fix_allowed", result.p2AutoFixAllowed),
  check("secret_issues_not_auto_fixed", result.secretIssuesNotAutoFixed),
  check("chat_issues_not_auto_fixed", result.chatIssuesNotAutoFixed),
  check("provider_runtime_issues_not_auto_fixed", result.providerRuntimeIssuesNotAutoFixed),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, paths.evidence, "phase634r_bug_risk_blocker_classification_failed");
