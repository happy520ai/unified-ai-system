import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  extractNumber,
  finalize,
  has,
  loadContextState,
  loadPhase631Evidence,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  doc: "docs/phase632b-relevant-files-mandatory-gate.md",
  evidence: "apps/ai-gateway-service/evidence/phase632b/relevant-files-mandatory-gate-result.json",
};

const docText = readText(paths.doc);
const phase631 = loadPhase631Evidence();
const context = loadContextState();
const maxDefault = extractNumber(docText, "maxRelevantFilesDefault");
const hardLimit = extractNumber(docText, "maxRelevantFilesHardLimit");

const result = {
  phase: "Phase632B",
  name: "Relevant Files Mandatory Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  relevantFilesMandatoryGateGenerated: Boolean(docText),
  relevantFilesRequired: has(docText, "relevantFilesRequired=true"),
  relevantFilesPathRequired: has(docText, "relevantFilesPath=.codex-context/relevant-files.json"),
  selectionModeTargetedRequired: has(docText, "selectionModeRequired=targeted-not-full-repo"),
  maxRelevantFilesDefault: maxDefault,
  maxRelevantFilesHardLimit: hardLimit,
  relevantFilesExists: context.relevantFilesExists,
  relevantFilesCount: context.relevantFilesCount,
  relevantFilesWithinHardLimit: context.relevantFilesCount <= hardLimit,
  fullRepoScanForbidden: has(docText, "fullRepoScanForbidden=true"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docText),
  webhookValueExposed: containsWebhookLikeValue(docText),
  docs: [paths.doc],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("relevant_files_mandatory_gate_generated", result.relevantFilesMandatoryGateGenerated),
  check("relevant_files_required", result.relevantFilesRequired),
  check("relevant_files_path_required", result.relevantFilesPathRequired),
  check("selection_mode_targeted_required", result.selectionModeTargetedRequired),
  check("max_relevant_files_default_20", result.maxRelevantFilesDefault === 20),
  check("max_relevant_files_hard_limit_50", result.maxRelevantFilesHardLimit === 50),
  check("relevant_files_exists", result.relevantFilesExists),
  check("relevant_files_within_hard_limit", result.relevantFilesWithinHardLimit),
  check("full_repo_scan_forbidden", result.fullRepoScanForbidden),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase632b_relevant_files_mandatory_gate_failed");
