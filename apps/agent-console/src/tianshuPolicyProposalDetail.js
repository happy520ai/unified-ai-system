export function buildTianshuPolicyProposalDetail(proposal = {}, approvalState = {}) {
  return {
    proposalDetailVisible: true,
    proposalId: proposal.proposalId,
    sourceFeedbackWindow: proposal.sourceFeedbackWindow,
    sampleSize: proposal.sampleSize,
    affectedTaskTypes: proposal.affectedTaskTypes || [],
    proposedWeightChanges: proposal.proposedWeightChanges || {},
    riskAssessment: proposal.riskAssessment,
    expectedImpact: proposal.expectedImpact,
    approvalRequiredVisible: proposal.approvalRequired === true,
    autoApplyFalseVisible: proposal.autoApply === false,
    dryRunResult: approvalState.dryRunResult || null,
    rollbackPlanVisible: Boolean(proposal.rollbackPlan),
    reviewerNotes: proposal.reviewerNotes || "",
    currentState: approvalState.state || "manual_review_required",
  };
}
