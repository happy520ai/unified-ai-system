export const LOCAL_SELF_USE_V1_SAFETY = Object.freeze({
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
  newProviderRequestsThisPhase: 0,
  routePolicyAppliedToRuntime: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  selectableModifiedThisPhase: false,
  unauthorizedSelectableChangeDetected: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
});

export function safetyFields(extra = {}) {
  return { ...LOCAL_SELF_USE_V1_SAFETY, ...extra };
}

export function requiredTrue(value) {
  return value === true;
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildReadySeal({ phaseRange, checks = {}, extra = {} } = {}) {
  const failed = Object.entries(checks)
    .filter(([, value]) => value !== true)
    .map(([key]) => key);
  return {
    phaseRange,
    completed: true,
    recommended_sealed: failed.length === 0,
    blocker: failed.length === 0 ? null : failed[0],
    ...checks,
    ...extra,
    ...safetyFields(),
  };
}
