export function createPolicyApprovalState({ proposalId, state = "manual_review_required", reviewerIdRef = "reviewer_anon", dryRunResult = null, rejectionReason = null } = {}) {
  return {
    proposalId,
    state,
    reviewerIdRef,
    approvalTimestamp: state.includes("approved") ? new Date().toISOString() : null,
    rejectionReason,
    dryRunResult,
    activationAllowed: false,
    auditTrace: {
      approvalRequired: true,
      autoApply: false,
      activationBlockedByDefault: true,
    },
  };
}

export function transitionPolicyApprovalState(currentState, nextState) {
  const blockedActivationStates = new Set(["approved_for_activation", "activated"]);
  if (blockedActivationStates.has(nextState)) {
    return {
      ...currentState,
      state: "activation_blocked",
      activationAllowed: false,
      rejectionReason: "Phase331C does not allow policy activation",
    };
  }
  return {
    ...currentState,
    state: nextState,
    activationAllowed: false,
  };
}
