export function runSelectableDriftGuard(input = {}) {
  const before = Number.isFinite(input.before) ? input.before : 17;
  const after = Number.isFinite(input.after) ? input.after : before;
  const explicitAdmissionApproved = input.explicitAdmissionApproved === true;
  const changed = before !== after;
  return {
    phase: "Phase894",
    selectableDriftGuardReady: true,
    selectableDriftGuardPassed: !changed || explicitAdmissionApproved,
    selectableModelCountBefore: before,
    selectableModelCountAfter: after,
    unauthorizedSelectableChangeDetected: changed && !explicitAdmissionApproved,
    providerCallsMade: false,
    secretRead: false,
  };
}
