export function createScoringPolicyReview({ feedbackEvents = [], proposedWeightChanges = {} } = {}) {
  return {
    proposedWeightChanges,
    evidenceWindow: {
      eventCount: feedbackEvents.length,
      source: "phase330c_file_backed_feedback_events",
    },
    sampleSize: feedbackEvents.length,
    riskAssessment: feedbackEvents.length < 10 ? "insufficient_sample_size" : "review_required",
    approvalRequired: true,
    autoApply: false,
    rollbackPolicy: "restore previous scoring policy JSON and rerun Phase329C evaluation",
  };
}
