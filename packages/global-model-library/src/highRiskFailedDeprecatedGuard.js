export function runHighRiskFailedDeprecatedGuard(records = []) {
  const blocked = records.filter((record) => ["high_risk", "failed", "blocked", "deprecated"].includes(record.status) || record.risk?.highRisk || record.risk?.blocked || record.risk?.deprecated);
  return {
    phase: "Phase793",
    highRiskBlocked: true,
    failedDeprecatedBlocked: true,
    blockedModelCount: blocked.length,
    blocked,
    selectableBlockedForStatuses: ["failed", "high_risk", "blocked", "deprecated"],
    providerCallsMade: false,
    secretRead: false,
    selectableModified: false,
  };
}
