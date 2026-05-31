import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildRoutePolicyTuningCandidatePack() {
  return {
    phase: "Phase977",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    routePolicyTuningCandidatePackReady: true,
    candidates: {
      normalThreshold: { qualityMin: 70, reliabilityMin: 0.8 },
      godDualReviewerMarkerContract: {
        requiredMarker: "GOD_DUAL_REVIEWER_RERUN_OK",
        requiredFields: ["reviewerA", "reviewerB", "synthesis", "finalAnswer", "marker"],
      },
      tianshuPlannerExecutorSelection: "prefer verified selectable NVIDIA chat models; planner and executor must stay evidence-bound",
      fallbackPriority: ["same-provider-eligible-model", "lower-cost-eligible-model", "manual-review-required"],
      reliabilityPenalty: { markerMissing: 40, providerError: 100, timeout: 80 },
      costPressureThreshold: { warningUsd: 0.2, stopUsd: 1.0 },
      latencyPressureThreshold: { warningMs: 15000, stopMs: 60000 },
    },
    appliedToRuntime: false,
    ...safetyFields(),
  };
}
