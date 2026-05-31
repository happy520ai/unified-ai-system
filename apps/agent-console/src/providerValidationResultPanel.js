export function buildProviderValidationResultPanel({ validation = {} } = {}) {
  return {
    panelId: "provider-validation-result-panel",
    credentialGateStatus: validation.code || "not_validated",
    providerGovernanceStatus: validation.allowed ? "allowed" : "blocked",
    realCallBetaStatus: validation.allowed ? "requires_backend_gate" : "blocked",
    costWarning: "userOwnedProviderCostMayApply",
    quotaBudgetWarning: "quotaBudgetPolicyApplies",
  };
}
