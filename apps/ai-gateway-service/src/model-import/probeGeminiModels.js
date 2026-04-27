import { probeProviderModels } from "./providerProbeRegistry.js";

export function probeGeminiModels(options = {}) {
  return probeProviderModels({
    ...options,
    candidate: {
      providerId: "gemini",
      ...(options.candidate ?? {}),
    },
  });
}
