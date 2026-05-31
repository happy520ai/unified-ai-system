import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildGuardedRuntimePolicyPreview({ candidates = {} } = {}) {
  return {
    phase: "Phase978",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    guardedRuntimePolicyPreviewReady: true,
    whatWouldChange: [
      "Use stricter God dual reviewer marker contract in future approved runtime policy.",
      "Apply reliability penalties for marker_missing and structure_missing.",
      "Keep Tianshu planner/executor guarded until more evidence exists.",
    ],
    risks: ["Small sample size", "Marker contract may overfit", "Runtime rollout requires separate approval"],
    rollback: "Disable preview policy and restore previous scoring weights.",
    verifier: "Future verifier must prove no default /chat or /chat-gateway/execute mutation unless approved.",
    approvalRequired: true,
    candidateSummaryReady: candidates.routePolicyTuningCandidatePackReady === true,
    routePolicyAppliedToRuntime: false,
    ...safetyFields(),
  };
}
