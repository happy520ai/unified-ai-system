export function buildReweightingPolicy(manifests) {
  return {
    policyVersion: "phase651-666-reweighting-v1",
    runtimeAutoEnabled: false,
    weightUpdates: manifests.map((manifest) => ({
      capabilityId: manifest.capabilityId,
      previousWeight: manifest.synapse.weight,
      proposedWeight: Number(Math.min(0.8, Math.max(0.2, manifest.synapse.weight)).toFixed(2)),
      appliesToRuntime: false,
      requiresApproval: true,
    })),
  };
}
