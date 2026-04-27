import { probeProviderModels } from "./providerProbeRegistry.js";

export function probeNvidiaModels(options = {}) {
  return probeProviderModels({
    ...options,
    candidate: {
      providerId: "nvidia",
      ...(options.candidate ?? {}),
    },
  });
}
