import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildPhase941960BlockerClearanceSupplement({ intake = {} } = {}) {
  const canClear = intake.phase941960OriginalBlocker === "round2_real_route_quality_test_failed"
    && intake.phase961965RootCause === "prompt_marker_contract_mismatch"
    && intake.phase966970GodRerunPassed === true
    && intake.phase941960OriginalEvidenceMutated === false;
  return {
    phase: "Phase972",
    completed: true,
    recommended_sealed: canClear,
    blocker: canClear ? null : "phase941960_blocker_clearance_conditions_missing",
    sourcePhase: "Phase941-960",
    sourceBlocker: intake.phase941960OriginalBlocker || "unknown",
    supplementPhase: "Phase966-970",
    phase941960OriginalGodDualReviewerRemainedFailed: true,
    phase966970SupplementalRerunPassed: intake.phase966970GodRerunPassed === true,
    blockerCanBeClearedBySupplement: canClear,
    originalEvidenceMutated: false,
    safeWording: "Phase941-960 original god_dual_reviewer remained failed; Phase966-970 supplemental rerun passed and can clear the blocker by supplement without rewriting old evidence.",
    ...safetyFields(),
  };
}
