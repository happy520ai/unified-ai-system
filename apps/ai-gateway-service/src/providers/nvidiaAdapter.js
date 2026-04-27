import { createHttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";

export function createNvidiaAdapter(modelConfig, options = {}) {
  return createHttpLLMProviderAdapter(
    {
      ...modelConfig,
      providerId: modelConfig.providerId ?? "nvidia",
      providerDisplayName: modelConfig.providerDisplayName ?? "NVIDIA",
      providerType: "nvidia",
      dryRun: modelConfig.dryRun ?? false,
    },
    options,
  );
}
