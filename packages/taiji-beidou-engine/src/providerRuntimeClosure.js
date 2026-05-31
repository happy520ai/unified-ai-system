export function buildProviderRuntimeClosure(input = {}) {
  return {
    phaseRange: "Phase675-682",
    guardedRealProviderRuntimeV0Available: true,
    productionReady: false,
    mainChainRuntimeReady: false,
    providerRuntimeDefaultEnabled: false,
    providerIdAllowedList: ["nvidia"],
    approvalFilePresent: input.approvalFilePresent === true,
    authorizationComplete: input.authorizationComplete === true,
    realProviderCallExecuted: input.realProviderCallExecuted === true,
    responseClassification: input.responseClassification || "blocked_by_missing_approval",
  };
}
