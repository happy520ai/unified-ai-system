export function buildTianshuReviewerStateTransitionPreview({ currentState = "manual_review_required", action = "approve_for_dry_run" } = {}) {
  const transitions = {
    approve_for_dry_run: "approved_for_dry_run",
    reject: "rejected",
    request_changes: "changes_requested",
    mark_needs_more_samples: "needs_more_samples",
    rollback_required: "rollback_required",
  };
  return {
    stateTransitionPreviewVisible: true,
    currentState,
    action,
    nextState: transitions[action] || currentState,
    activationAllowed: false,
  };
}
