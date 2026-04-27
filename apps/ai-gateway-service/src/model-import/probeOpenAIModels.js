import { probeProviderModels } from "./providerProbeRegistry.js";

export function probeOpenAIModels(options = {}) {
  return probeProviderModels({
    ...options,
    candidate: {
      providerId: "openai",
      ...(options.candidate ?? {}),
    },
  });
}
