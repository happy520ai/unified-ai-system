import { createGlobalModelRecord } from "./globalModelCatalogSchema.js";

export function normalizeDiscoveryResult(discoveryResult = {}) {
  const discoveredModels = Array.isArray(discoveryResult.discoveredModels) ? discoveryResult.discoveredModels : [];
  const normalizedModels = discoveredModels.map((model) => createGlobalModelRecord({
    ...model,
    status: "discovered",
    source: "provider_discovery",
    selectableGate: { reason: "discovered_not_smoke_verified" },
  }));
  return {
    phase: "Phase786",
    normalizedModelCount: normalizedModels.length,
    normalizedModels,
    providerCallsMade: discoveryResult.providerCallsMade === true,
    secretRead: false,
    selectableModified: false,
  };
}
