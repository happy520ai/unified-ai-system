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
  finalReport: "docs/phase637r-final-system-report.md",
  executive: "docs/phase637r-executive-summary.md",
  architecture: "docs/phase637r-architecture-summary.md",
  boundary: "docs/phase637r-current-capability-boundary.md",
  knownLimits: "docs/phase637r-known-limits-and-blockers.md",
  bugFix: "docs/phase637r-bug-fix-summary.md",
  roadmap: "docs/phase637r-next-roadmap.md",
  report: "docs/phase637r-execution-report.md",
  phase636: "apps/ai-gateway-service/evidence/phase636r/regression-verification-evidence-review-result.json",
  evidence: "apps/ai-gateway-service/evidence/phase637r/final-system-report-result.json",
  bundle: "apps/ai-gateway-service/evidence/phase633r-637r/full-system-audit-bugfix-report-bundle.json",
};

const finalText = readText(paths.finalReport);
const executiveText = readText(paths.executive);
const architectureText = readText(paths.architecture);
const boundaryText = readText(paths.boundary);
const knownLimitsText = readText(paths.knownLimits);
const bugFixText = readText(paths.bugFix);
const roadmapText = readText(paths.roadmap);
const reportText = readText(paths.report);
const phase636 = readJson(paths.phase636);
const combinedText = [finalText, executiveText, architectureText, boundaryText, knownLimitsText, bugFixText, roadmapText, reportText].join("\n");

const result = {
  phase: "Phase637R",
  name: "Final System Report",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase636Imported: phase636.data?.completed === true && phase636.data?.recommended_sealed === true,
  finalSystemReportGenerated: Boolean(finalText),
  executiveSummaryGenerated: Boolean(executiveText),
  architectureSummaryGenerated: Boolean(architectureText),
  capabilityBoundaryGenerated: Boolean(boundaryText),
  knownLimitsGenerated: Boolean(knownLimitsText),
  bugFixSummaryGenerated: Boolean(bugFixText),
  nextRoadmapGenerated: Boolean(roadmapText),
  productionReadyClaimed: !has(combinedText, "productionReady=false"),
  releaseReadyClaimed: !has(combinedText, "releaseReady=false"),
  chatIntegrated: !has(combinedText, "defaultChatIntegrated=false"),
  chatGatewayExecuteIntegrated: !has(combinedText, "chatGatewayExecuteIntegrated=false"),
  providerRuntimeModified: !has(combinedText, "providerRuntimeMainChainModified=false"),
  workspaceCleanClaimed: !has(combinedText, "workspaceCleanClaimed=false"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  openSourceDryRunPreviewRecommended: true,
  productionIntegrationRecommended: false,
  releaseRecommended: false,
  docs: [
    paths.finalReport,
    paths.executive,
    paths.architecture,
    paths.boundary,
    paths.knownLimits,
    paths.bugFix,
    paths.roadmap,
    paths.report,
  ],
  evidenceJson: paths.evidence,
  aggregateBundleJson: paths.bundle,
};

const checks = [
  check("phase636_imported", result.phase636Imported),
  check("final_system_report_generated", result.finalSystemReportGenerated),
  check("executive_summary_generated", result.executiveSummaryGenerated),
  check("architecture_summary_generated", result.architectureSummaryGenerated),
  check("capability_boundary_generated", result.capabilityBoundaryGenerated),
  check("known_limits_generated", result.knownLimitsGenerated),
  check("bug_fix_summary_generated", result.bugFixSummaryGenerated),
  check("next_roadmap_generated", result.nextRoadmapGenerated),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("chat_integrated_false", result.chatIntegrated === false),
  check("chat_gateway_execute_integrated_false", result.chatGatewayExecuteIntegrated === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
];

finalize(result, checks, paths.evidence, "phase637r_final_system_report_failed");
