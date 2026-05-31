import { PHASE599_APPROVAL_DECISIONS } from "./phase599HumanApprovalSchema.js";

export function reviewPhase599HumanApproval(options = {}) {
  const packet = options.packet || {};
  const authorizationComplete = options.authorizationComplete === true;
  const decision = PHASE599_APPROVAL_DECISIONS.includes(packet.humanApprovalDecision) ? packet.humanApprovalDecision : "not_provided";
  const hasRecord = isRealRef(packet.approvalRecordRef);
  const reviewerProvided = isRealRef(packet.humanApprovalReviewer);
  const timestampProvided = Boolean(packet.humanApprovalTimestamp);
  const placeholderApproval = decision === "approved" && (!hasRecord || !reviewerProvided || !timestampProvided);
  let humanApprovalStatus = "missing";
  if (decision === "rejected") humanApprovalStatus = "rejected";
  if (decision === "needs_changes") humanApprovalStatus = "needs_changes";
  if (decision === "approved" && !placeholderApproval && authorizationComplete) humanApprovalStatus = "approved";

  return {
    completed: true,
    humanApprovalReviewWorks: true,
    missingApprovalBlocks: humanApprovalStatus === "missing",
    placeholderApprovalRejected: placeholderApproval || decision === "not_provided",
    rejectedApprovalBlocks: true,
    approvedRequiresCompleteAuthorization: true,
    approvalForged: false,
    humanApprovalStatus,
    humanApprovalDecision: decision,
    approvalRecordRef: hasRecord ? packet.approvalRecordRef : null,
    realIntegrationAllowed: false,
    guardedRealTestAllowed: false,
    blocker: humanApprovalStatus === "approved" ? null : "human_approval_missing",
  };
}

function isRealRef(value) {
  return typeof value === "string" && value.includes(":") && !value.includes("example") && !value.startsWith("[required");
}
