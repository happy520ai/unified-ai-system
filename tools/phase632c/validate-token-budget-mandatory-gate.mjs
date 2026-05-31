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
  doc: "docs/phase632c-token-budget-mandatory-gate.md",
  evidence: "apps/ai-gateway-service/evidence/phase632c/token-budget-mandatory-gate-result.json",
};

const docText = readText(paths.doc);
const phase631 = loadPhase631Evidence();
const context = loadContextState();

const result = {
  phase: "Phase632C",
  name: "Token Budget Mandatory Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase631Imported: phase631.imported,
  tokenBudgetMandatoryGateGenerated: Boolean(docText),
  tokenBudgetRequired: has(docText, "tokenBudgetRequired=true"),
  tokenBudgetDeclaredBeforeTask: has(docText, "tokenBudgetDeclaredBeforeTask=true"),
  estimatedTokensRequired: has(docText, "estimatedTokensRequired=true"),
  tokenBudgetRespectedRequired: has(docText, "tokenBudgetRespectedRequired=true"),
  stopWhenBudgetMissing: has(docText, "stopWhenBudgetMissing=true"),
  contextPackTokenBudgetPresent: context.tokenBudgetPresent,
  contextPackTokenBudgetRespected: context.tokenBudgetRespected,
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(docText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docText),
  webhookValueExposed: containsWebhookLikeValue(docText),
  docs: [paths.doc],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase631_imported", result.phase631Imported),
  check("token_budget_mandatory_gate_generated", result.tokenBudgetMandatoryGateGenerated),
  check("token_budget_required", result.tokenBudgetRequired),
  check("token_budget_declared_before_task", result.tokenBudgetDeclaredBeforeTask),
  check("estimated_tokens_required", result.estimatedTokensRequired),
  check("token_budget_respected_required", result.tokenBudgetRespectedRequired),
  check("stop_when_budget_missing", result.stopWhenBudgetMissing),
  check("context_pack_token_budget_present", result.contextPackTokenBudgetPresent),
  check("context_pack_token_budget_respected", result.contextPackTokenBudgetRespected),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase632c_token_budget_mandatory_gate_failed");
