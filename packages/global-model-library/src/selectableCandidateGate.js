export function runSelectableCandidateGate({ smokeClassification } = {}) {
  const candidates = (smokeClassification?.classified ?? [])
    .filter((item) => item.classification === "pass")
    .map((item) => ({
      modelId: item.modelId,
      providerId: item.providerId,
      providerFamily: item.providerFamily,
      status: "selectable_candidate",
      selectable: false,
      reason: "smoke_passed_requires_future_phase821_selectable_admission",
    }));
  return {
    phase: "Phase790",
    selectableCandidateModelCount: candidates.length,
    candidates,
    newSelectableModelsAdded: 0,
    selectableModelCountBefore: 17,
    selectableModelCountAfter: 17,
    selectableModelCountUnchanged: true,
    selectableAdmissionRequiresFuturePhase: "Phase821+ Selectable Admission Approval",
    providerCallsMade: false,
    secretRead: false,
  };
}
