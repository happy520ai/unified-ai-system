export const SELECTABLE_ADMISSION_APPROVAL_PATH = "model-routing/approvals/phase821_840-selectable-admission.input.json";

export function evaluateSelectableAdmissionGate(input = {}) {
  const before = Number.isFinite(input.selectableModelCountBefore) ? input.selectableModelCountBefore : 17;
  const approval = input.approval || null;
  const requestedModelIds = Array.isArray(approval?.modelIds) ? approval.modelIds : [];
  const approved = approval?.decision === "approved_selectable_admission"
    && approval?.acknowledgements?.smokePassedRequired === true
    && approval?.acknowledgements?.manualSelectableChange === true;
  const added = approved ? requestedModelIds.filter(Boolean) : [];

  return {
    phaseRange: "Phase821-840",
    phase: "Phase821-823",
    selectableAdmissionContractReady: true,
    selectableAdmissionIntakeReady: true,
    selectableGateHardeningReady: true,
    selectableAdmissionApprovalPresent: Boolean(approval),
    selectableAdmissionApproved: approved,
    requestedSelectableModelIds: requestedModelIds,
    admittedSelectableModelIds: [],
    newSelectableModelsAdded: 0,
    selectableModelCountBefore: before,
    selectableModelCountAfter: before,
    unauthorizedSelectableChangeDetected: false,
    admissionBlockedReason: added.length > 0 ? "selectable_state_mutation_disabled_in_phase821_900" : null,
    blockedStatuses: [
      "failed",
      "high_risk",
      "blocked",
      "deprecated",
      "credential_missing",
      "smoke_pending",
      "cataloged_only",
    ],
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    rawSecretRead: false,
  };
}

export function filterRuntimeEligibleModels(models = []) {
  return models.filter((model) => model.runtimeEligible === true
    && model.selectable === true
    && model.smokePassed === true
    && model.blocked !== true
    && model.highRisk !== true
    && model.deprecated !== true
    && model.notRuntimeEligible !== true);
}
