export function reauditPhase821900RouteEvidence(input = {}) {
  const finalEvidence = input.finalEvidence || {};
  const proof = input.proof || {};
  const previousProviderCallsMade = finalEvidence.providerCallsMade === true;
  const previousTotalProviderRequests = Number(finalEvidence.totalProviderRequests || 0);
  const reauditedExternalProviderApiCallConfirmed = proof.externalProviderApiCallConfirmed === true;
  const reauditedAuthenticityClassification = proof.authenticityClassification || "authenticity_unknown";
  return {
    phase: "Phase906",
    phase821900Reaudited: true,
    previousProviderCallsMade,
    previousTotalProviderRequests,
    reauditedExternalProviderApiCallConfirmed,
    reauditedAuthenticityClassification,
    correctionRequired: previousProviderCallsMade && !reauditedExternalProviderApiCallConfirmed,
    correctedProviderCallsMadeForExternalApi: reauditedExternalProviderApiCallConfirmed,
    routeEvidenceStillUsefulForLocalExecutor: previousTotalProviderRequests > 0,
  };
}
