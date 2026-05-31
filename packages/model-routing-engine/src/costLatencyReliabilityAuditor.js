export function auditCostLatencyReliability({ phase916930 = {} } = {}) {
  const scenarios = Array.isArray(phase916930.scenarioResults) ? phase916930.scenarioResults : [];
  const latencyValues = scenarios
    .map((scenario) => Number(scenario.durationMs || scenario.latencyMs))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const successCount = scenarios.filter((scenario) => scenario.providerSuccess === true && scenario.routeTestPassed === true).length;
  const failureCount = scenarios.length - successCount;
  const timeoutCount = scenarios.filter((scenario) => String(scenario.providerErrorCode || "").includes("timeout")).length;
  const providerErrorCount = scenarios.filter((scenario) => scenario.providerErrorCode).length;

  return {
    phase: "Phase937",
    completed: true,
    recommended_sealed: scenarios.length > 0 && phase916930.budgetExceeded !== true,
    blocker: scenarios.length > 0 ? null : "cost_latency_reliability_evidence_missing",
    costLatencyReliabilityAuditReady: scenarios.length > 0,
    totalProviderRequests: Number(phase916930.totalProviderRequests || 0),
    estimatedCostUsdTotal: Number(phase916930.estimatedCostUsdTotal || 0),
    budgetExceeded: phase916930.budgetExceeded === true,
    latencyEvidencePresent: latencyValues.length === scenarios.length && scenarios.length > 0,
    latencyAuditBlocked: false,
    latencyAuditWarning: latencyValues.length ? null : "latency metrics not available in current evidence",
    minLatencyMs: latencyValues.length ? Math.min(...latencyValues) : null,
    maxLatencyMs: latencyValues.length ? Math.max(...latencyValues) : null,
    averageLatencyMs: latencyValues.length ? round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null,
    successCount,
    failureCount,
    timeoutCount,
    providerErrorCount,
    reliabilityRate: scenarios.length ? successCount / scenarios.length : 0,
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
