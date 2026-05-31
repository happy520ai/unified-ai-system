export const PROVIDER_AGNOSTIC_MODEL_CATALOG_VERSION = "phase276a-v1";

export function createProviderAgnosticModelCatalog(overrides = {}) {
  return {
    catalogVersion: PROVIDER_AGNOSTIC_MODEL_CATALOG_VERSION,
    providerAgnostic: true,
    singleProviderLocked: false,
    defaultChatProvider: "nvidia",
    defaultNvidiaChatLaneChanged: false,
    tiers: {
      rule_only: [],
      cache: [],
      local: [],
      cheap: [
        "future-cheap-openai-compatible",
        "future-cheap-openrouter-compatible",
        "future-local-small-model",
      ],
      standard: [
        "future-standard-openai-compatible",
        "future-standard-claude-compatible",
        "future-standard-openrouter-compatible",
      ],
      premium: [
        "mimo-v2.5-pro",
        "future-openai-premium-compatible",
        "future-claude-premium-compatible",
        "future-openrouter-premium-compatible",
      ],
      expert: [
        "future-expert-model",
        "future-multi-provider-expert-review",
      ],
    },
    knownWorkingModels: {
      mimo: "mimo-v2.5-pro",
    },
    defaultPremiumProvider: null,
    premiumModelDefault: false,
    modelActuallyCalled: false,
    externalApiCalled: false,
    paidApiCallCount: 0,
    ...overrides,
  };
}

export function listPremiumCandidates(catalog = createProviderAgnosticModelCatalog()) {
  return [...(catalog.tiers?.premium ?? [])];
}

export function recommendProviderForTier(modelTier, catalog = createProviderAgnosticModelCatalog()) {
  if (["rule_only", "cache"].includes(modelTier)) return "none";
  if (modelTier === "local") return "local";
  if (modelTier === "cheap") return "openai-compatible";
  if (modelTier === "standard") return "openai-compatible";
  if (modelTier === "premium") return "multi-provider-preview";
  if (modelTier === "expert" || modelTier === "multi_model") return "multi-provider-preview";
  return "none";
}
