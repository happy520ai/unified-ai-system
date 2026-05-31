export function buildTaijiEvidenceSummary(run) {
  const trials = run.trials || [];
  return {
    phaseRange: "Phase651-666",
    phase: "Phase651-666-AIO",
    selfUseReady: true,
    productionReady: false,
    trialCount: trials.length,
    runtimeAutoEnabled: false,
    allCapabilitiesRequireApprovalForRuntime: trials.every((trial) => trial.manifest?.approval?.requiredForRuntime === true),
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    unsupportedClaimCount: trials.reduce((sum, trial) => sum + Number(trial.verifier?.verifierResult?.unsupportedClaimCount || 0), 0),
    hallucinatedFactCount: trials.reduce((sum, trial) => sum + Number(trial.verifier?.verifierResult?.hallucinatedFactCount || 0), 0),
  };
}
