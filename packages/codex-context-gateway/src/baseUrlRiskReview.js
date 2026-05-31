export function buildBaseUrlRiskReview() {
  const risks = [
    "wrong base_url",
    "bad relay response",
    "account pool rate limit",
    "cache miss",
    "stale context",
    "token over budget",
    "secret leakage",
    "provider billing",
    "config drift",
    "difficult rollback",
  ];
  return {
    completed: true,
    riskReviewGenerated: true,
    risks,
    wrongBaseUrlRiskCovered: risks.includes("wrong base_url"),
    cacheMissRiskCovered: risks.includes("cache miss"),
    staleContextRiskCovered: risks.includes("stale context"),
    secretLeakRiskCovered: risks.includes("secret leakage"),
    billingRiskCovered: risks.includes("provider billing"),
    rollbackRiskCovered: risks.includes("difficult rollback"),
  };
}
