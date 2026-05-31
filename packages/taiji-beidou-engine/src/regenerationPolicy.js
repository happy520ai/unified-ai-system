export function buildRegenerationPolicy(manifests) {
  return {
    policyVersion: "phase651-666-regeneration-v1",
    runtimeAutoEnabled: false,
    selfApprovalAllowed: false,
    repairCandidates: manifests
      .filter((manifest) => manifest.status === "blocked" || manifest.status === "approval_required")
      .map((manifest) => ({
        capabilityId: manifest.capabilityId,
        action: "prepare_repair_candidate_only",
        requiresHumanApproval: true,
      })),
  };
}
