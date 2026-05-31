export function checkExternalProviderAuthenticityCarryForward({
  phase916930 = {},
  phase912915 = {},
  phase901910 = {},
} = {}) {
  const checks = {
    phase916930ExternalProviderApiConfirmed: phase916930.externalProviderApiCallConfirmed === true,
    phase916930NetworkAttemptRecorded: phase916930.networkAttemptRecorded === true,
    phase916930ResponseSourceExternal: phase916930.responseSource === "external_provider",
    phase916930RawSecretSafe: phase916930.rawSecretRead === false,
    phase916930SecretSafe: phase916930.secretValueExposed === false,
    phase916930AuthJsonSafe: phase916930.authJsonRead === false,
    phase912915ExternalProviderApiConfirmed: phase912915.externalProviderApiCallConfirmed === true,
    phase901910CorrectionPreserved: phase901910.authenticityClassification === "simulated_response"
      || phase901910.previousPhase821900Classification === "simulated_response"
      || phase901910.correctionRequired === true,
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => passed !== true).map(([key]) => key);
  return {
    phase: "Phase932",
    completed: true,
    recommended_sealed: failedChecks.length === 0,
    blocker: failedChecks.length ? "authenticity_carry_forward_failed" : null,
    authenticityCarryForwardPassed: failedChecks.length === 0,
    sourcePhase: "Phase916-930",
    phase916930ExternalProviderApiConfirmed: checks.phase916930ExternalProviderApiConfirmed,
    networkAttemptRecorded: checks.phase916930NetworkAttemptRecorded,
    responseSource: phase916930.responseSource || "unknown",
    phase912915ExternalProviderApiConfirmed: checks.phase912915ExternalProviderApiConfirmed,
    phase901910CorrectionPreserved: checks.phase901910CorrectionPreserved,
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
    failedChecks,
  };
}
