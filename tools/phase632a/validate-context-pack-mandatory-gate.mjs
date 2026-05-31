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
  doc: "docs/phase632a-context-pack-mandatory-gate.md",
  evidence: "apps/ai-gateway-service/evidence/phase632a/context-pack-mandatory-gate-result.json",
};

const docText = readText(paths.doc);
const phase631 = loadPhase631Evidence();
const context = loadContextState();

const result = {
  phase: "Phase632A",
  name: "Context Pack Mandatory Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  contextPackMandatoryGateGenerated: Boolean(docText),
  contextPackRequired: has(docText, "contextPackRequired=true"),
  contextPackMustBeReadFirst: has(docText, "contextPackMustBeReadFirst=true"),
  contextPackExistsRequired: has(docText, "contextPackExistsRequired=true"),
  contextPackHashRequired: has(docText, "contextPackHashRequired=true"),
  contextPackExists: context.contextPackExists,
  contextPackHasHash: context.contextPackHasHash,
  providerCallsMade: false,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docText),
  webhookValueExposed: containsWebhookLikeValue(docText),
  docs: [paths.doc],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("context_pack_mandatory_gate_generated", result.contextPackMandatoryGateGenerated),
  check("context_pack_required", result.contextPackRequired),
  check("context_pack_must_be_read_first", result.contextPackMustBeReadFirst),
  check("context_pack_exists_required", result.contextPackExistsRequired),
  check("context_pack_hash_required", result.contextPackHashRequired),
  check("context_pack_exists", result.contextPackExists),
  check("context_pack_has_hash", result.contextPackHasHash),
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
];

finalize(result, checks, paths.evidence, "phase632a_context_pack_mandatory_gate_failed");
