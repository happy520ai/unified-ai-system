export function defaultTianshuScoringPolicy() {
  return {
    phase: "Phase329C",
    schemaName: "tianshu-adaptive-scoring-policy",
    runtimeStatus: "guarded_runtime_policy",
    weights: {
      capabilityMatch: 0.3,
      historicalSuccessRate: 0.15,
      latencyScore: 0.1,
      costScore: 0.1,
      contextFit: 0.1,
      outputFormatFit: 0.0,
      safetyFit: 0.1,
      userPreferenceFit: 0.05,
      providerAvailability: 0.05,
      quotaBudgetFit: 0.05,
      fallbackReliability: 0.0,
    },
    constraints: {
      noFailedHighRiskModels: true,
      credentialRefRequired: true,
      respectQuotaBudget: true,
      secretValueAllowed: false,
    },
  };
}

export function normalizeScoringWeights(policy) {
  const entries = Object.entries(policy.weights || {});
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0) || 1;
  return Object.fromEntries(entries.map(([key, value]) => [key, Number(value || 0) / total]));
}
