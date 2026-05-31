export const selfEvolutionPolicy = Object.freeze({
  evolutionMode: "governed",
  autonomousCodeMutationAllowed: true,
  autonomousProviderCallAllowed: true,
  autonomousSecretReadAllowed: false,
  autonomousDeployAllowed: false,
  autonomousChatRouteChangeAllowed: false,
  autonomousChatGatewayExecuteChangeAllowed: false,
  humanApprovalRequiredForHighRisk: true,
  lowValuePhaseExpansionBlocked: true,
});

export function getSelfEvolutionPolicy() {
  return { ...selfEvolutionPolicy };
}

export function canSelfEvolutionPerform(action) {
  const highRiskActions = new Set([
    "secret_read",
    "deploy",
  ]);

  if (highRiskActions.has(action)) {
    return {
      allowed: false,
      reason: "human_approval_required_for_high_risk",
      policy: getSelfEvolutionPolicy(),
    };
  }

  return {
    allowed: true,
    reason: "autonomous_execution_enabled",
    policy: getSelfEvolutionPolicy(),
  };
}

export const SELF_EVOLUTION_POLICY = Object.freeze({
  "evolutionMode": "governed",
  "autonomousCodeMutationAllowed": true,
  "autonomousProviderCallAllowed": true,
  "autonomousSecretReadAllowed": false,
  "autonomousDeployAllowed": false,
  "autonomousChatRouteChangeAllowed": false,
  "autonomousChatGatewayExecuteChangeAllowed": false,
  "humanApprovalRequiredForHighRisk": true,
  "lowValuePhaseExpansionBlocked": true
});
