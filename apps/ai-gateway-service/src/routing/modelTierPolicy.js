export const MODEL_TIER_ROUTING_POLICY_VERSION = "phase276a-v1";
export const MODEL_TIER_ROUTING_MODE = "local-routing-preview-only";

export function createModelTierRoutingPolicy(overrides = {}) {
  return {
    routingPolicyVersion: MODEL_TIER_ROUTING_POLICY_VERSION,
    routerType: overrides.routerType ?? "provider-agnostic-quality-cost-compatible-preview",
    defaultAnswerPath: "rule_only",
    qualityGoal: "best_possible_answer_with_minimum_necessary_tokens",
    providerAgnostic: true,
    singleProviderLocked: false,
    premiumProvider: "mimo",
    premiumModel: "mimo-v2.5-pro",
    premiumCandidates: [
      "mimo-v2.5-pro",
      "future-openai-premium-compatible",
      "future-claude-premium-compatible",
      "future-openrouter-premium-compatible",
    ],
    defaultPremiumProvider: null,
    premiumModelDefault: false,
    defaultChatProvider: "nvidia",
    defaultNvidiaChatLaneChanged: false,
    requireApprovalForPaidApi: true,
    requireApprovalForPremiumModel: true,
    requireApprovalForExpertModel: true,
    requireApprovalForMultiModelReview: true,
    blockSecretLikeRequests: true,
    blockLongContextToPaidApi: true,
    preferCacheBeforeModel: true,
    preferRagBeforeModel: true,
    preferRuleOnlyBeforeModel: true,
    progressiveEscalationEnabled: true,
    previewOnly: true,
    productionRoutingEnabled: false,
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    ...overrides,
  };
}

export function createRoutingSafety(overrides = {}) {
  return {
    plainTextApiKeyWritten: false,
    apiKeyPrinted: false,
    paidApiCallExecuted: false,
    externalApiCalled: false,
    mimoApiCalled: false,
    modelActuallyCalled: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    singleProviderLocked: false,
    longContextSentToPaidApi: false,
    largeOutputRequested: false,
    stressTestExecuted: false,
    legacyModified: false,
    projectContextCreated: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    ...overrides,
  };
}

export function getAnswerPathOrder() {
  return [
    "rule_only",
    "cache_only",
    "rag_local",
    "cheap_model",
    "standard_model",
    "premium_mimo",
    "require_approval",
    "block",
    "review_cache_candidate",
  ];
}
