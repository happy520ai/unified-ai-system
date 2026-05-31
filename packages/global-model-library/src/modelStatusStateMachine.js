export const MODEL_STATUS_TRANSITIONS = Object.freeze({
  discovered: ["cataloged", "blocked", "deprecated"],
  cataloged: ["credential_missing", "blocked", "deprecated"],
  credential_missing: ["credential_ready", "blocked", "deprecated"],
  credential_ready: ["smoke_pending", "blocked", "deprecated"],
  smoke_pending: ["smoke_passed", "failed", "high_risk", "blocked", "deprecated"],
  smoke_passed: ["selectable_candidate", "high_risk", "blocked", "deprecated"],
  selectable_candidate: ["selectable", "high_risk", "blocked", "deprecated"],
  selectable: ["high_risk", "blocked", "deprecated"],
  failed: ["credential_ready", "blocked", "deprecated"],
  high_risk: ["blocked", "deprecated"],
  blocked: [],
  deprecated: [],
});

export function buildModelStatusStateMachine() {
  return {
    contractName: "model-status-state-machine",
    version: "phase768.v1",
    transitions: MODEL_STATUS_TRANSITIONS,
    happyPath: [
      "discovered",
      "cataloged",
      "credential_missing",
      "credential_ready",
      "smoke_pending",
      "smoke_passed",
      "selectable_candidate",
      "selectable",
    ],
    failureStates: ["failed", "high_risk", "blocked", "deprecated"],
    dryRunDefaultMaxStatus: "credential_missing",
    selectableRequires: ["smoke_passed", "evidence.smokeRef", "selectable_candidate_review"],
    providerCallsMade: false,
    selectableModified: false,
  };
}

export function canTransitionModelStatus(from, to) {
  return (MODEL_STATUS_TRANSITIONS[from] ?? []).includes(to);
}
