export function buildPruningPolicy(manifests) {
  return {
    policyVersion: "phase651-666-pruning-v1",
    runtimeAutoEnabled: false,
    pruneCandidates: manifests
      .filter((manifest) => manifest.synapse.weight < 0.2)
      .map((manifest) => ({
        capabilityId: manifest.capabilityId,
        action: "disable_preview_only",
        requiresEvidence: true,
      })),
  };
}
