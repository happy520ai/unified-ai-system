export function buildProviderBetaStatusBadge({ gateStatus = "blocked", governanceStage = "limited_beta" } = {}) {
  return {
    badgeId: "provider-beta-status-badge",
    gateStatus,
    governanceStage,
    betaOnly: true,
    notProduction: true,
    realCallsAllowed: gateStatus === "allowed",
  };
}
