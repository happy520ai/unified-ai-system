const riskRules = [
  { id: "provider_call", pattern: /provider|openai|claude|openrouter|mimo|nvidia|真实调用|模型调用/i },
  { id: "secret_read", pattern: /secret|api key|apikey|auth\.json|\.env|webhook|base_url|密钥/i },
  { id: "deploy_release", pattern: /deploy|release|tag|artifact|push|commit|部署|发布|提交/i },
  { id: "chat_mutation", pattern: /\/chat|chat 行为|默认聊天/i },
  { id: "execute_mutation", pattern: /\/chat-gateway\/execute|execute/i },
  { id: "codex_config", pattern: /codex config|config\.toml|base_url/i },
  { id: "recursive_spawn", pattern: /recursive|递归|无限|spawn/i },
  { id: "self_approval", pattern: /自我批准|self approval|auto enable|自动上线/i },
];

export function classifyImmuneRisk(specOrText = {}) {
  const text = typeof specOrText === "string"
    ? specOrText
    : [specOrText.intakeText, specOrText.description, specOrText.displayName].filter(Boolean).join(" ");
  const hits = riskRules.filter((rule) => rule.pattern.test(text));
  const highRisk = hits.some((hit) => ["provider_call", "secret_read", "deploy_release", "chat_mutation", "execute_mutation", "codex_config", "recursive_spawn", "self_approval"].includes(hit.id));
  const decision = highRisk ? "approval_required" : "dry_run_allowed";

  return {
    classifierVersion: "phase651-666-immune-risk-v1",
    decision,
    riskTier: highRisk ? "high" : "low",
    blocked: false,
    approvalRequired: highRisk,
    runtimeEnableAllowed: false,
    selfApprovalAllowed: false,
    recursiveSpawnBlocked: true,
    maxSpawnDepth: 1,
    providerRisk: hits.some((hit) => hit.id === "provider_call"),
    secretRisk: hits.some((hit) => hit.id === "secret_read"),
    deployRisk: hits.some((hit) => hit.id === "deploy_release"),
    chatMutationRisk: hits.some((hit) => hit.id === "chat_mutation"),
    chatGatewayExecuteMutationRisk: hits.some((hit) => hit.id === "execute_mutation"),
    codexConfigRisk: hits.some((hit) => hit.id === "codex_config"),
    recursiveSpawnRisk: hits.some((hit) => hit.id === "recursive_spawn"),
    selfApprovalRisk: hits.some((hit) => hit.id === "self_approval"),
    riskSignals: hits.map((hit) => hit.id),
  };
}
