export const OWNER_MANUAL_TRIAL_SCRIPT_SCHEMA_VERSION = "phase1238.taiji-beidou-owner-manual-trial-script.v1";

export function buildOwnerManualTrialScript() {
  return {
    schemaVersion: OWNER_MANUAL_TRIAL_SCRIPT_SCHEMA_VERSION,
    phase: "Phase1238",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerManualTrialScriptGenerated: true,
    manualStepsGenerated: true,
    expectedObservationsGenerated: true,
    feedbackFormGenerated: true,
    realOwnerFeedbackCollected: false,
    codexSelfTestCountedAsOwnerFeedback: false,
    humanValidationCompleted: false,
    reviewPackOnly: true,
    manualSteps: [
      "Open the owner review packet.",
      "Check candidate status remains default-off.",
      "Review the no-flag regression evidence.",
      "Review rollback rehearsal output.",
      "Record owner decision in the future Phase1246-1255 approval gate only.",
    ],
    expectedObservations: [
      "Taiji / Beidou appears as a candidate layer only.",
      "No real execute, Provider, or deploy button is present.",
      "Default /chat and /chat-gateway/execute behavior remains unchanged.",
    ],
    feedbackForm: {
      reviewerName: "",
      reviewedAt: "",
      understandsDefaultOff: false,
      understandsNoProviderCall: false,
      understandsLimitedEnableRequiresFutureApproval: false,
      decision: "pending",
      notes: "",
    },
  };
}
