const ALLOWED_ACTIONS = ["approve_for_dry_run", "reject", "request_changes", "mark_needs_more_samples", "rollback_required"];
const BLOCKED_ACTIONS = ["activate_without_approval", "auto_apply", "skip_dry_run", "use_sensitive_raw_feedback"];

export function buildTianshuPolicyApprovalActions() {
  return {
    allowedActions: ALLOWED_ACTIONS,
    blockedActions: BLOCKED_ACTIONS,
    dryRunActionVisible: true,
    activateActionBlocked: true,
    activationAllowed: false,
    autoApply: false,
  };
}

export function evaluateReviewerAction(action) {
  if (ALLOWED_ACTIONS.includes(action)) {
    return { action, actionAllowed: true, blockedReason: null, activationAllowed: false, autoApply: false };
  }
  return { action, actionAllowed: false, blockedReason: "ACTION_BLOCKED_BY_PHASE332C_REVIEWER_CONSOLE", activationAllowed: false, autoApply: false };
}
