export function buildRoutePolicyTuningDesign({
  scoreAudit = {},
  modeAudit = {},
  fallbackAudit = {},
  costLatencyReliabilityAudit = {},
} = {}) {
  return {
    phase: "Phase938",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    routePolicyTuningPlanReady: true,
    tuningDesignOnly: true,
    appliedToRuntime: false,
    routePolicyAppliedToRuntime: false,
    requiresFutureApproval: true,
    requiresLargerSampleBeforeDefaultEnable: true,
    requiresFutureApprovalForTuning: true,
    recommendations: [
      {
        area: "quality_scoring_weight",
        proposal: "Keep external_provider confirmation and routeTestPassed as hard gates; use derived quality score only as a secondary ranking signal until larger samples exist.",
        runtimeChangeNow: false,
      },
      {
        area: "fallback_priority",
        proposal: "Prefer verified NVIDIA selectable chat models when a failed model is excluded before runtime; keep failed/high-risk/credential-missing models out of fallback candidates.",
        runtimeChangeNow: false,
      },
      {
        area: "mode_threshold",
        proposal: "Do not promote God or Tianshu routing by default from a 5-request sample; require a larger approved round before threshold tuning.",
        runtimeChangeNow: false,
      },
      {
        area: "latency_observability",
        proposal: "Add sanitized latency fields to future route evidence before latency pressure tuning.",
        runtimeChangeNow: false,
      },
    ],
    inputs: {
      averageScore: scoreAudit.averageScore ?? null,
      bestModeByQuality: modeAudit.bestModeByQuality || "insufficient_evidence",
      fallbackEvidenceComplete: fallbackAudit.fallbackEvidenceComplete === true,
      latencyEvidencePresent: costLatencyReliabilityAudit.latencyEvidencePresent === true,
    },
  };
}
