const DEFAULT_QUEUE_LIMIT = 100;

export function createPolicyProposalQueue({ proposals = [], limit = DEFAULT_QUEUE_LIMIT } = {}) {
  const queue = proposals.slice(0, limit).map((proposal) => ({
    ...proposal,
    queued: true,
    approvalRequired: true,
    autoApply: false,
  }));
  return {
    queue,
    size: queue.length,
    limit,
    manualReviewRequired: queue.length > 0,
  };
}

export function createPolicyProposal({ proposalId, sourceFeedbackWindow, sampleSize = 0, proposedWeightChanges = {}, reviewerNotes = "" } = {}) {
  return {
    proposalId,
    sourceFeedbackWindow,
    sampleSize,
    affectedTaskTypes: ["classification", "model_selection"],
    proposedWeightChanges,
    riskAssessment: sampleSize < 10 ? "insufficient_sample_size" : "manual_review_required",
    expectedImpact: "dry_run_only_until_approved",
    approvalRequired: true,
    autoApply: false,
    rollbackPlan: "restore previous scoring policy and rerun Phase329C and Phase330C checks",
    reviewerNotes,
  };
}
