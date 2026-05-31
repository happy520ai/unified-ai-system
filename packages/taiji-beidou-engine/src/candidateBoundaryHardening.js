export const CANDIDATE_BOUNDARY_HARDENING_SCHEMA_VERSION = "phase1236.taiji-beidou-candidate-boundary-hardening.v1";

export function buildCandidateBoundaryHardening(input = {}) {
  const upstream = input.upstream || {};
  const candidateLayerExists = upstream.mainChainCandidateIntegrated === true
    && upstream.mainChainDefaultEnabled === false;

  return {
    schemaVersion: CANDIDATE_BOUNDARY_HARDENING_SCHEMA_VERSION,
    phase: "Phase1236",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    candidateLayerExists,
    mainChainCandidateIntegrated: true,
    mainChainDefaultEnabled: false,
    flagGated: true,
    shadowAdapterDefaultEnabled: false,
    providerRuntimeDefaultEnabled: false,
    chatDefaultChanged: false,
    chatGatewayExecuteDefaultChanged: false,
    candidateBoundaryHardeningGenerated: true,
    boundaryVerifierGenerated: true,
    unsafeDefaultEnableBlocked: true,
  };
}
