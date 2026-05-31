export function buildCredentialRefInjectionAudit({ resolution = {}, dryRun = {} } = {}) {
  const failures = [
    ...(Array.isArray(resolution.failures) ? resolution.failures : []),
    ...(Array.isArray(dryRun.failures) ? dryRun.failures : []),
  ].filter(Boolean);
  const readyForPhase913 = resolution.credentialRefSecureResolutionReady === true
    && dryRun.readyForPhase913 === true
    && dryRun.providerCallExecuted === false
    && dryRun.callerReceivesRawSecret === false
    && dryRun.secretWrittenToEvidence === false
    && dryRun.secretWrittenToLogs === false
    && dryRun.authJsonRead === false;

  return {
    phase: "Phase912",
    credentialRef: resolution.credentialRef || dryRun.credentialRef || "credentialRef:nvidia:default",
    providerId: resolution.providerId || dryRun.providerId || "nvidia",
    credentialRefOnly: true,
    credentialRefSecureResolutionReady: resolution.credentialRefSecureResolutionReady === true,
    isolatedSecretInjectionReady: dryRun.isolatedInjectionBoundaryReady === true,
    callerReceivesRawSecret: false,
    secretInjectedOnlyInsideBoundary: dryRun.secretInjectedOnlyInsideBoundary === true,
    secretWrittenToEvidence: dryRun.secretWrittenToEvidence === true,
    secretWrittenToLogs: dryRun.secretWrittenToLogs === true,
    authJsonRead: false,
    providerCallExecuted: false,
    readyForPhase913,
    blocker: readyForPhase913 ? null : failures[0] || resolution.blocker || dryRun.blocker || "credential_ref_secure_resolution_not_ready",
    failures,
  };
}
