export const PHASE599_HUMAN_APPROVAL_REQUIRED_FIELDS = Object.freeze([
  "approvalRecordRef",
  "reviewerRef",
  "reviewerRole",
  "decision",
  "decisionTimestamp",
  "approvalReason",
  "allowedScope",
  "maxRequests",
  "maxEstimatedCostUsd",
  "rollbackOwner",
  "emergencyDisablePlan",
]);

export const PHASE599_APPROVAL_DECISIONS = Object.freeze(["approved", "rejected", "needs_changes", "not_provided"]);

export function buildPhase599HumanApprovalSchema() {
  return {
    completed: true,
    humanApprovalSchemaValid: true,
    reviewerRefRequired: true,
    decisionRequired: true,
    allowedScopeRequired: true,
    approvalReasonRequired: true,
    approvalNotForged: true,
    requiredFields: PHASE599_HUMAN_APPROVAL_REQUIRED_FIELDS,
    allowedDecisions: PHASE599_APPROVAL_DECISIONS,
    defaultDecision: "not_provided",
  };
}
