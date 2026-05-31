export function buildThreeModePolicyBadge(payload = {}) {
  const data = payload.data || payload;
  const audit = data.auditTrace || {};
  return {
    quotaStatus: audit.quotaStatus || null,
    budgetStatus: audit.budgetStatus || null,
    policyStatus: audit.policyDecision?.policyStatus || "unknown",
    safetyWarnings: audit.secretValueExposed === true ? ["secretValueExposed"] : [],
  };
}
