const FAMILY_HINTS = Object.freeze([
  ["openai", /openai|gpt|o3|o4/i],
  ["anthropic", /anthropic|claude/i],
  ["google-gemini", /google|gemini/i],
  ["deepseek", /deepseek|深度求索/i],
  ["qwen", /qwen|通义|千问/i],
  ["moonshot-kimi", /kimi|moonshot|月之暗面/i],
  ["zhipu-glm", /glm|智谱/i],
  ["baidu-qianfan", /baidu|百度|文心|ernie|qianfan/i],
  ["tencent-hunyuan", /tencent|腾讯|混元|hunyuan/i],
  ["minimax", /minimax/i],
  ["mimo", /mimo/i],
  ["openrouter", /openrouter/i],
  ["litellm-compatible", /litellm/i],
  ["ollama-local", /ollama/i],
  ["lm-studio-local", /lm studio/i],
  ["vllm-private", /vllm/i],
  ["siliconflow", /siliconflow|硅基流动/i],
  ["modelscope", /modelscope|魔搭/i],
  ["volcano-ark", /volcano|ark|火山|方舟/i],
]);

export function buildTaijiModelExpansionIntake(input = {}) {
  const requestText = String(input.requestText ?? "我要接入某某 Provider 的模型");
  const providerFamilyGuess = guessProviderFamily(requestText);
  return {
    phase: "Phase779",
    requestText,
    providerFamilyGuess,
    credentialRequirement: {
      userOwnedApiKeyRequired: true,
      credentialRefRequired: true,
      rawSecretAllowed: false,
      secretRead: false,
    },
    riskClassification: {
      riskLevel: providerFamilyGuess === "unknown" ? "manual_review_required" : "medium",
      reason: providerFamilyGuess === "unknown" ? "provider_family_not_identified" : "new_provider_import_requires_future_approval",
    },
    discoveryPlan: [
      "confirm provider family",
      "collect credentialRef id only",
      "dry-run catalog import",
      "deduplicate aliases",
      "prepare future smoke plan",
    ],
    smokePlan: {
      status: "not_scheduled",
      requiresExplicitApproval: true,
      maxRequestsPreview: 1,
      providerCallsMade: false,
    },
    selectableGatePlan: {
      currentPhaseSelectableAllowed: false,
      futureRequirements: ["credential_ready", "smoke_passed", "evidence.smokeRef", "risk_review_passed"],
    },
    rollbackPlan: [
      "remove dry-run catalog artifacts",
      "remove provider family seed if added only for trial",
      "keep current 17 selectable model states unchanged",
    ],
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    selectableModified: false,
  };
}

function guessProviderFamily(text) {
  const hit = FAMILY_HINTS.find(([, pattern]) => pattern.test(text));
  return hit?.[0] ?? "unknown";
}
