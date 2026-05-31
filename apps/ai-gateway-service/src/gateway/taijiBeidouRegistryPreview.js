import { runTaijiBeidouSelfUseDryRun } from "../../../../packages/taiji-beidou-engine/src/index.js";

export function buildTaijiBeidouRegistryPreview(intakes, options = {}) {
  const result = runTaijiBeidouSelfUseDryRun(intakes, options);
  const previewEntries = [
    ...result.manifests,
    ...result.builtInRegistry.all,
  ].map((manifest) => ({
    capabilityId: manifest.capabilityId,
    displayName: manifest.displayName,
    type: manifest.type,
    status: manifest.status,
    runtimeEnabled: false,
    approvalRequiredForRuntime: manifest.approval.requiredForRuntime,
    maxSpawnDepth: manifest.runtime.maxSpawnDepth,
    weight: manifest.synapse.weight,
  }));

  return {
    phase: "Phase651-666-AIO",
    registryPreviewAvailable: true,
    runtimeAutoEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    codexConfigModified: false,
    entries: previewEntries,
    synapseGraph: result.synapseGraph,
  };
}
