export function buildTianshuPolicyProposalList(proposals = []) {
  return {
    proposalListVisible: true,
    proposals: proposals.map((proposal) => ({
      proposalId: proposal.proposalId,
      sampleSize: proposal.sampleSize,
      riskAssessment: proposal.riskAssessment,
      approvalRequired: proposal.approvalRequired === true,
      autoApply: proposal.autoApply === true,
    })),
  };
}
