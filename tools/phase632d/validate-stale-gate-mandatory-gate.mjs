import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  loadContextState,
  loadPhase631Evidence,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  doc: "docs/phase632d-stale-gate-mandatory-gate.md",
  evidence: "apps/ai-gateway-service/evidence/phase632d/stale-gate-mandatory-gate-result.json",
};

const docText = readText(paths.doc);
const phase631 = loadPhase631Evidence();
const context = loadContextState();

const result = {
  phase: "Phase632D",
  name: "Stale Gate Mandatory Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  staleGateMandatoryGateGenerated: Boolean(docText),
  freshnessReportRequired: has(docText, "freshnessReportRequired=true"),
  staleFalseRequired: has(docText, "staleFalseRequired=true"),
  stopOnStale: has(docText, "stopOnStale=true"),
  rebuildContextRequiredWhenStale: has(docText, "rebuildContextRequiredWhenStale=true"),
  freshnessReportExists: context.freshnessReportExists,
  currentStaleFalse: context.staleFalse,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docText),
  webhookValueExposed: containsWebhookLikeValue(docText),
  docs: [paths.doc],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("stale_gate_mandatory_gate_generated", result.staleGateMandatoryGateGenerated),
  check("freshness_report_required", result.freshnessReportRequired),
  check("stale_false_required", result.staleFalseRequired),
  check("stop_on_stale", result.stopOnStale),
  check("rebuild_context_required_when_stale", result.rebuildContextRequiredWhenStale),
  check("freshness_report_exists", result.freshnessReportExists),
  check("current_stale_false", result.currentStaleFalse),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase632d_stale_gate_mandatory_gate_failed");
