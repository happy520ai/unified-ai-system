export function buildRoutingAuthenticityEvidenceRebind({ phase913 = {}, phase901910 = {} } = {}) {
  const confirmed = phase913.externalProviderApiCallConfirmed === true;
  return {
    phase: "Phase914",
    rebindPerformed: confirmed,
    blocker: confirmed ? null : phase913.blocker || "phase913_external_provider_authenticity_not_confirmed",
    phase901910CorrectionPreserved: true,
    previousPhase821900Classification: phase901910.authenticityClassification || "simulated_response",
    phase913ExternalProviderApiCallConfirmed: confirmed,
    routingEvidenceExternalAuthenticitySupplemented: confirmed,
    originalEvidenceMutated: false,
    newRebindLedgerOnly: true,
    safeWording: "Phase821-900 local guarded route evidence remains simulated/local; Phase913 supplies later external Provider authenticity proof for the same CredentialRef/provider boundary.",
  };
}
