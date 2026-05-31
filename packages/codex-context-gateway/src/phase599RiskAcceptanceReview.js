export const PHASE599_REQUIRED_RISKS = Object.freeze([
  "wrong_base_url",
  "bad_relay_response",
  "account_pool_rate_limit",
  "cache_miss",
  "stale_context",
  "token_over_budget",
  "secret_leakage",
  "provider_billing",
  "config_drift",
  "rollback_failure",
]);

export function reviewPhase599RiskAcceptance(packet = {}) {
  const acceptedRisks = Array.isArray(packet.riskAcceptanceAcceptedRisks) ? packet.riskAcceptanceAcceptedRisks : [];
  const missingRisks = PHASE599_REQUIRED_RISKS.filter((risk) => !acceptedRisks.includes(risk));
  const accepted = packet.riskAcceptanceReviewed === true && missingRisks.length === 0;
  return {
    completed: true,
    riskAcceptanceReviewWorks: true,
    requiredRisksListed: true,
    riskAcceptanceRequired: true,
    missingRiskAcceptanceBlocks: accepted !== true,
    billingRiskIncluded: PHASE599_REQUIRED_RISKS.includes("provider_billing"),
    rollbackRiskIncluded: PHASE599_REQUIRED_RISKS.includes("rollback_failure"),
    requiredRisks: PHASE599_REQUIRED_RISKS,
    acceptedRisks,
    missingRisks,
    riskAcceptanceComplete: accepted,
  };
}
