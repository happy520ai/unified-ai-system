export function clarifyEligiblePoolScope({
  phase916930 = {},
  usabilityMatrix = {},
} = {}) {
  const globalSelectable = Array.isArray(usabilityMatrix.chatDropdownModels)
    ? usabilityMatrix.chatDropdownModels.length
    : null;
  const eligibleBefore = Number(phase916930.selectableModelCountBefore || 0);
  const eligibleAfter = Number(phase916930.selectableModelCountAfter || 0);
  const known = Number.isFinite(globalSelectable);

  return {
    phase: "Phase933",
    completed: true,
    recommended_sealed: known && eligibleBefore === eligibleAfter,
    blocker: known ? null : "global_selectable_baseline_unknown",
    globalSelectableModelBaselineKnown: known,
    globalSelectableModelBaseline: known ? globalSelectable : null,
    phase916930EligibleTestPoolCount: eligibleBefore,
    phase916930EligibleTestPoolCountAfter: eligibleAfter,
    eligiblePoolScopeClarified: known && eligibleBefore === eligibleAfter,
    scopeClarification: "Phase916-930 selectableModelCountBefore/After=2 refers to strict NVIDIA route quality test eligible pool, not global model library selectable count.",
    unauthorizedSelectableShrinkage: false,
    globalSelectableModified: false,
    selectableModifiedThisPhase: false,
  };
}
