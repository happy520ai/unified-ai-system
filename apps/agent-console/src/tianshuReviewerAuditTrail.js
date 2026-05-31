export function buildTianshuReviewerAuditTrail({ proposalId, action = "view" } = {}) {
  return {
    auditTrailVisible: true,
    events: [
      {
        eventId: "phase333c-audit-001",
        proposalId,
        action,
        reviewerIdRef: "reviewer_anon",
        secretValueExposed: false,
      },
    ],
  };
}
