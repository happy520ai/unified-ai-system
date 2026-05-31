export function buildRound2TuningRecommendation({ quality = {}, comparison = {}, fit = {} } = {}) {
  return {
    phase: "Phase954",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    routePolicyTuningRecommendationReady: true,
    routePolicyAppliedToRuntime: false,
    requiresFutureApprovalForTuning: true,
    recommendations: [
      "Keep external provider authenticity as a hard gate before scoring.",
      "Keep failed and blocked models excluded from fallback candidates.",
      "Add latency metrics to the next route evidence schema before latency threshold tuning.",
      "Do not default-enable God or Tianshu from this small sample.",
      "Use Round 2 model fit results as recommendation evidence only, not as selectable mutation input.",
    ],
    inputs: {
      averageQualityScore: quality.averageQualityScore || 0,
      modeComparisonReady: comparison.modeComparisonReady === true,
      modelFitAnalysisReady: fit.modelFitAnalysisReady === true,
    },
  };
}
