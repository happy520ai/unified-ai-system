export const OWNER_REVIEW_PACKET_SCHEMA_VERSION = "phase1237.taiji-beidou-owner-review-packet.v1";

export function buildOwnerReviewPacket() {
  return {
    schemaVersion: OWNER_REVIEW_PACKET_SCHEMA_VERSION,
    phase: "Phase1237",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerReviewPacketGenerated: true,
    candidateSummaryGenerated: true,
    riskSummaryGenerated: true,
    manualReviewChecklistGenerated: true,
    approvalDecisionTemplateGenerated: true,
    candidateSummary: {
      candidateId: "taiji-beidou-main-chain-candidate",
      status: "behind_flag_default_off",
      mainChainCandidateIntegrated: true,
      mainChainDefaultEnabled: false,
      flagGated: true,
      rollbackReady: true,
    },
    riskSummary: [
      "Default enable remains blocked.",
      "Provider and secret access remain disallowed.",
      "Owner approval is required before any limited enable phase.",
    ],
    manualReviewChecklist: [
      "Confirm no default route behavior changed.",
      "Review rollback and emergency disable plan.",
      "Review evidence completeness ledger.",
      "Decide whether Phase1246-1255 should be authorized.",
    ],
    approvalDecisionTemplate: {
      ownerApprovedForLimitedEnable: false,
      limitedEnableAllowed: false,
      providerCallAllowed: false,
      secretReadAllowed: false,
      deploymentAllowed: false,
    },
  };
}
