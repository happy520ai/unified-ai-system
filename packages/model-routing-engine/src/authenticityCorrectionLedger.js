export function buildAuthenticityCorrectionLedger(input = {}) {
  const reaudit = input.reaudit || {};
  const proof = input.proof || {};
  const correctionRequired = reaudit.correctionRequired === true;
  return {
    phase: "Phase907",
    correctionLedgerGenerated: true,
    correctionRequired,
    entries: [
      {
        originalClaim: `providerCallsMade=${reaudit.previousProviderCallsMade === true}`,
        correctedInterpretation: reaudit.reauditedAuthenticityClassification || "authenticity_unknown",
        reason: buildReason(proof),
        externalProviderApiCallConfirmed: proof.externalProviderApiCallConfirmed === true,
        recommendedWording: correctionRequired
          ? "Local guarded executor routes ran; external Provider API calls are not confirmed."
          : "External Provider API call evidence satisfies the authenticity proof gate.",
      },
    ],
  };
}

function buildReason(proof = {}) {
  if (proof.mockResponseUsed) return "mock response marker detected";
  if (proof.simulatedResponseUsed) return "simulated response marker detected";
  if (proof.localExecutorOnly) return "local executor route attempt exists, but networkAttemptRecorded is missing";
  if (proof.networkAttemptRecorded !== true) return "networkAttemptRecorded missing";
  if (proof.providerResponseReceived !== true) return "provider response proof missing";
  return "external Provider API proof gate did not confirm all required fields";
}
