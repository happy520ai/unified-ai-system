export function createDefaultPerUserModePolicy({ userId = "anonymous" } = {}) {
  return {
    userId,
    allowedModes: ["normal", "god", "tianshu"],
    disabledModes: [],
    maxGodParticipants: 3,
    allowTianshuGodEscalation: true,
    allowNonNvidiaProviderCalls: false,
    allowedProviders: ["nvidia"],
    blockedProviders: ["openai", "claude", "openrouter", "mimo"],
    allowedModels: [],
    blockedModels: [],
    dailyRequestLimit: 50,
    monthlyRequestLimit: 500,
    dailyBudgetLimit: 5,
    monthlyBudgetLimit: 50,
    maxSingleRequestEstimatedCost: 0.5,
    maxLatencyMs: 120000,
    requireCredentialRef: true,
    requireAuditTrace: true,
    runtimeStatus: "guarded_default_policy",
  };
}

export function mergePerUserModePolicy(basePolicy, overridePolicy = {}) {
  return {
    ...basePolicy,
    ...overridePolicy,
    allowedModes: Array.isArray(overridePolicy.allowedModes) ? overridePolicy.allowedModes : basePolicy.allowedModes,
    disabledModes: Array.isArray(overridePolicy.disabledModes) ? overridePolicy.disabledModes : basePolicy.disabledModes,
    allowedProviders: Array.isArray(overridePolicy.allowedProviders) ? overridePolicy.allowedProviders : basePolicy.allowedProviders,
    blockedProviders: Array.isArray(overridePolicy.blockedProviders) ? overridePolicy.blockedProviders : basePolicy.blockedProviders,
    allowedModels: Array.isArray(overridePolicy.allowedModels) ? overridePolicy.allowedModels : basePolicy.allowedModels,
    blockedModels: Array.isArray(overridePolicy.blockedModels) ? overridePolicy.blockedModels : basePolicy.blockedModels,
  };
}
