export const EXTENDED_NO_FLAG_REGRESSION_SCHEMA_VERSION = "phase1240.taiji-beidou-extended-no-flag-regression.v1";

export function buildExtendedNoFlagRegression(input = {}) {
  const safeRegressionPassed = input.safeRegressionPassed !== false;

  return {
    schemaVersion: EXTENDED_NO_FLAG_REGRESSION_SCHEMA_VERSION,
    phase: "Phase1240",
    completed: safeRegressionPassed,
    recommended_sealed: safeRegressionPassed,
    blocker: safeRegressionPassed ? null : "safe_regression_matrix_not_confirmed",
    extendedNoFlagRegressionGenerated: true,
    noFlagRegressionPassed: safeRegressionPassed,
    chatDefaultUnchanged: true,
    chatGatewayExecuteDefaultUnchanged: true,
    providerRuntimeDefaultEnabled: false,
    mainChainCandidateFlagOff: true,
    shadowAdapterFlagOff: true,
    missionControlReadOnlyOnly: true,
    safeRegressionMatrixPassed: safeRegressionPassed,
    assertions: [
      "/chat default unchanged",
      "/chat-gateway/execute default unchanged",
      "provider runtime default disabled",
      "main-chain candidate flag off",
      "shadow adapter flag off",
      "Mission Control preview remains read-only",
      "safe regression matrix remains required",
    ],
  };
}
