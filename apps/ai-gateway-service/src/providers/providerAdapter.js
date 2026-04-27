export const PROVIDER_ADAPTER_VERSION = "0.1.0";

export const ProviderTypes = {
  FAKE: "fake",
  OPENAI: "openai",
  NVIDIA: "nvidia",
  HTTP_LLM: "http-llm",
};

export function assertProviderAdapter(provider) {
  if (!provider || typeof provider !== "object") {
    throw new Error("Provider adapter must be an object");
  }

  if (!provider.descriptor?.id) {
    throw new Error("Provider adapter descriptor.id is required");
  }

  if (!Array.isArray(provider.descriptor.models)) {
    throw new Error("Provider adapter descriptor.models must be an array");
  }

  if (typeof provider.generate !== "function") {
    throw new Error("Provider adapter generate(input) function is required");
  }
}

export function createProviderDescriptor(modelConfig, overrides = {}) {
  return {
    id: modelConfig.providerId,
    displayName: modelConfig.providerDisplayName ?? modelConfig.providerId,
    kind: overrides.kind ?? "llm",
    models: [
      {
        id: modelConfig.modelId,
        displayName: modelConfig.modelDisplayName ?? modelConfig.modelId,
        capabilities: modelConfig.capabilities,
        costTier: overrides.costTier ?? "low",
        latencyTier: overrides.latencyTier ?? "fast",
        enabled: modelConfig.enabled,
        priority: modelConfig.priority,
        metadata: {
          providerType: modelConfig.providerType,
          dryRun: modelConfig.dryRun ?? false,
          ...(overrides.modelMetadata ?? {}),
        },
      },
    ],
    health: {
      status: overrides.healthStatus ?? "healthy",
      checkedAt: new Date().toISOString(),
    },
    priority: modelConfig.priority,
    metadata: {
      adapterVersion: PROVIDER_ADAPTER_VERSION,
      providerType: modelConfig.providerType,
      dryRun: modelConfig.dryRun ?? false,
      ...(overrides.metadata ?? {}),
    },
  };
}
