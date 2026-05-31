import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildDisabledRoutePolicyConfigDesign() {
  return {
    phase: "Phase976",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    defaultEnabled: false,
    routePolicyAppliedToRuntime: false,
    requiresFutureApprovalForRuntimePolicyChange: true,
    policyConfig: {
      version: "local-self-use-v1-disabled-preview",
      enabled: false,
      normalModeDefault: "current-runtime-unchanged",
      godModeMarkerContract: "GOD_DUAL_REVIEWER_RERUN_OK",
      tianshuPlannerExecutor: "guarded-preview-only",
      fallbackPolicy: "eligible-nvidia-only-preview",
    },
    sourceEvidence: ["Phase931-940", "Phase941-960", "Phase966-970"],
    ...safetyFields(),
  };
}
