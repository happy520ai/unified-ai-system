export function evaluateTianshuFeedbackEvent(event = {}) {
  const blockers = [];
  if (JSON.stringify(event).match(/secretValue|apiKey|token/i)) blockers.push("SENSITIVE_FIELD_FORBIDDEN");
  if (!event.eventId || !event.requestId) blockers.push("EVENT_ID_OR_REQUEST_ID_MISSING");
  if (event.mode !== "tianshu") blockers.push("MODE_NOT_TIANSHU");
  return {
    accepted: blockers.length === 0,
    blockers,
    redacted: true,
    manualReviewRequired: true,
    autoApply: false,
    approvalRequired: true,
  };
}

export function feedbackGovernanceWorkflow() {
  return [
    "feedback_collection",
    "redaction",
    "validation",
    "aggregation",
    "manual_review_queue",
    "policy_proposal",
    "policy_dry_run",
    "approval_gate",
    "policy_activation",
    "rollback",
  ];
}
