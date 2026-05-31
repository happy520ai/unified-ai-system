export function buildTianshuCapabilityEvidencePreview({ atoms, hashVerification, readout, riskGate }) {
  return {
    phase: "Phase1946P",
    evidencePreviewGenerated: true,
    atomCount: atoms.length,
    atomIdVerified: hashVerification.atomIdVerified,
    atomIdMismatchCount: hashVerification.atomIdMismatchCount,
    selectedAtomTitles: readout.selectedAtoms.map((atom) => atom.title),
    blockedCapabilities: readout.blockedCapabilities,
    providerStabilityBlockerPreserved: readout.providerStabilityBlockerPreserved === true,
    riskGatePassed: riskGate.riskGatePassed === true,
    executionAllowed: false,
    arbitraryCodeExecuted: false,
    providerCallsMade: false,
    rawSecretRead: false,
    secretValueExposed: false,
    chatGatewayExecuteModified: false,
  };
}
