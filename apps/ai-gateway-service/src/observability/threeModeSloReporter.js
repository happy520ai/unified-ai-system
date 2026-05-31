export function defaultThreeModeSloBaseline() {
  return {
    phase: "Phase329A",
    normalModeP95LatencyTargetMs: 60000,
    godModeP95LatencyTargetMs: 180000,
    tianshuModeP95LatencyTargetMs: 120000,
    normalModeSuccessRateTarget: 0.95,
    godModePartialSuccessAllowed: true,
    tianshuPlannerDecisionCompletenessTarget: 0.95,
    credentialGateFalsePositiveTarget: 0.01,
    secretExposureTarget: 0,
    unauthorizedProviderCallTarget: 0,
  };
}

export function evaluateSloBaseline({ metrics, sloBaseline }) {
  return {
    secretExposureTargetMet: metrics.secretExposureCount <= sloBaseline.secretExposureTarget,
    unauthorizedProviderCallTargetMet: metrics.unauthorizedProviderCallCount <= sloBaseline.unauthorizedProviderCallTarget,
    p95LatencyWithinBroadBaseline: metrics.p95LatencyMs <= sloBaseline.godModeP95LatencyTargetMs,
  };
}
