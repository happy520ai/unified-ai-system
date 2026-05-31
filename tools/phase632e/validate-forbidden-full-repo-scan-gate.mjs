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
  doc: "docs/phase632e-forbidden-full-repo-scan-gate.md",
  evidence: "apps/ai-gateway-service/evidence/phase632e/forbidden-full-repo-scan-gate-result.json",
};

const docText = readText(paths.doc);
const phase631 = loadPhase631Evidence();
const context = loadContextState();

const result = {
  phase: "Phase632E",
  name: "Forbidden Full Repo Scan Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  forbiddenFullRepoScanGateGenerated: Boolean(docText),
  fullRepoScanForbidden: has(docText, "fullRepoScanForbidden=true"),
  unrelatedHistoryForbidden: has(docText, "unrelatedHistoryForbidden=true"),
  stopWhenRelevantFilesInsufficient: has(docText, "stopWhenRelevantFilesInsufficient=true"),
  noAutomaticScopeExpansion: has(docText, "noAutomaticScopeExpansion=true"),
  relevantFilesSelectionMode: context.relevantFilesSelectionMode,
  relevantFilesTargeted: context.relevantFilesSelectionMode === "targeted-not-full-repo",
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docText),
  webhookValueExposed: containsWebhookLikeValue(docText),
  docs: [paths.doc],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("forbidden_full_repo_scan_gate_generated", result.forbiddenFullRepoScanGateGenerated),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("unrelated_history_forbidden", result.unrelatedHistoryForbidden),
  check("stop_when_relevant_files_insufficient", result.stopWhenRelevantFilesInsufficient),
  check("no_automatic_scope_expansion", result.noAutomaticScopeExpansion),
  check("relevant_files_targeted", result.relevantFilesTargeted),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase632e_forbidden_full_repo_scan_gate_failed");
