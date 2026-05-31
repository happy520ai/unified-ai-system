import { createPolicyApprovalState, transitionPolicyApprovalState } from "./tianshuPolicyApprovalState.js";
import { createPolicyProposal, createPolicyProposalQueue } from "./tianshuPolicyProposalQueue.js";

export const TIANSHU_FEEDBACK_APPROVAL_STAGES = [
  "feedback_event_collected",
  "feedback_redacted",
  "feedback_validated",
  "proposal_generated",
  "proposal_queued",
  "manual_review_required",
  "approved_for_dry_run",
  "dry_run_completed",
  "approved_for_activation",
  "activated",
  "rejected",
  "rolled_back",
];

export function runTianshuFeedbackApprovalWorkflow({ feedbackEvents = [] } = {}) {
  const proposal = createPolicyProposal({
    proposalId: "phase331c-proposal-001",
    sourceFeedbackWindow: {
      source: "phase330c_feedback_governance",
      eventCount: feedbackEvents.length,
    },
    sampleSize: feedbackEvents.length,
    proposedWeightChanges: { capabilityMatch: 0.32 },
    reviewerNotes: "Dry-run only. Activation remains blocked.",
  });
  const queue = createPolicyProposalQueue({ proposals: [proposal] });
  const manualReview = createPolicyApprovalState({ proposalId: proposal.proposalId });
  const approvedDryRun = transitionPolicyApprovalState(manualReview, "approved_for_dry_run");
  const dryRunCompleted = {
    ...transitionPolicyApprovalState(approvedDryRun, "dry_run_completed"),
    dryRunResult: {
      passed: true,
      policyActivated: false,
      trainingPerformed: false,
      embeddingBatchPerformed: false,
    },
  };

  return {
    proposal,
    queue,
    approvalState: dryRunCompleted,
    approvalRequired: true,
    autoApply: false,
    manualReviewRequired: true,
    approvedForDryRunMock: true,
    activated: false,
    trainingPerformed: false,
    embeddingBatchPerformed: false,
  };
}
