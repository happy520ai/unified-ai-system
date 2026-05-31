import { buildTianshuPolicyApprovalActions, evaluateReviewerAction } from "./tianshuPolicyApprovalActions.js";
import { buildTianshuPolicyDryRunPanel } from "./tianshuPolicyDryRunPanel.js";
import { buildTianshuPolicyProposalDetail } from "./tianshuPolicyProposalDetail.js";
import { buildTianshuPolicyProposalList } from "./tianshuPolicyProposalList.js";

export function buildTianshuFeedbackReviewerConsole({ proposal, approvalState } = {}) {
  const actions = buildTianshuPolicyApprovalActions();
  return {
    reviewerConsoleVisible: true,
    selectedProposalId: proposal?.proposalId,
    proposalList: buildTianshuPolicyProposalList(proposal ? [proposal] : []),
    proposalDetail: buildTianshuPolicyProposalDetail(proposal, approvalState),
    actions,
    dryRunPanel: buildTianshuPolicyDryRunPanel(approvalState?.dryRunResult),
    actionContract: evaluateReviewerAction("activate_without_approval"),
  };
}
