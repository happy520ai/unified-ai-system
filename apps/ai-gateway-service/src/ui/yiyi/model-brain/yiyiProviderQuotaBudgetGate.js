export function evaluateYiyiProviderQuotaBudgetGate(input = {}) {
  const blockedBy = [];
  if (input.credentialRefPresent !== true) blockedBy.push("missing_credential_ref");
  if (input.providerAllowed !== true) blockedBy.push("provider_policy_blocked");
  if (input.modelAllowed !== true) blockedBy.push("model_policy_blocked");
  if (input.allowedForYiyiBrain !== true) blockedBy.push("yiyi_brain_policy_blocked");
  if (input.userConfigured !== true) blockedBy.push("provider_not_configured");
  if (input.quotaOk === false) blockedBy.push("quota_gate_failed");
  if (input.budgetOk === false) blockedBy.push("budget_gate_failed");

  return {
    gateDecision: blockedBy.length === 0 ? "dry_run_allowed" : "blocked",
    blockedBy,
    fallbackBrainMode: blockedBy.length === 0 ? null : "dry_run_mock",
    safeUserMessage: blockedBy.length === 0
      ? "Model brain dry-run is ready. No provider call will be made."
      : "This model route is not ready, so Yiyi will use the local dry-run brain.",
    providerPolicyGate: {
      providerAllowed: input.providerAllowed === true,
      modelAllowed: input.modelAllowed === true,
      yiyiBrainAllowed: input.allowedForYiyiBrain === true,
      userConfigured: input.userConfigured === true,
      tenantAllowed: input.tenantAllowed !== false,
    },
    quotaGate: {
      requestLimit: input.requestLimit || 1,
      dailyCap: input.dailyCap || 10,
      tokenEstimateCap: input.tokenEstimateCap || 800,
      yiyiBrainMaxTurns: input.yiyiBrainMaxTurns || 3,
      quotaOk: input.quotaOk !== false,
    },
    budgetGate: {
      realBillingAllowed: false,
      estimatedCostVisible: true,
      estimatedCostUsd: input.estimatedCostUsd || 0.001,
      hardCapUsd: input.hardCapUsd || 0.05,
      budgetOk: input.budgetOk !== false,
      billingExecuted: false,
      invoiceGenerated: false,
    },
    providerCallsMade: false,
    billingExecuted: false,
    invoiceGenerated: false,
  };
}
