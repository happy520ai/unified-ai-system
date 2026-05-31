export function auditModeComparison({ phase916930 = {}, scoreAudit = {} } = {}) {
  const scenarios = Array.isArray(phase916930.scenarioResults) ? phase916930.scenarioResults : [];
  const scores = Array.isArray(scoreAudit.perScenarioScores) ? scoreAudit.perScenarioScores : [];
  const summaryByMode = Object.fromEntries(["normal", "god", "tianshu", "fallback"].map((mode) => [
    mode,
    summarizeMode(mode, scenarios, scores),
  ]));

  return {
    phase: "Phase935",
    completed: true,
    recommended_sealed: scenarios.length > 0,
    blocker: scenarios.length > 0 ? null : "mode_comparison_evidence_missing",
    modeComparisonAuditReady: scenarios.length > 0,
    normalModeSummary: summaryByMode.normal,
    godModeSummary: summaryByMode.god,
    tianshuModeSummary: summaryByMode.tianshu,
    fallbackModeSummary: summaryByMode.fallback,
    bestModeByQuality: bestBy(summaryByMode, "averageQualityScore"),
    bestModeByCost: "tie_zero_estimated_cost",
    bestModeByLatency: "insufficient_latency_evidence",
    bestModeByReliability: bestBy(summaryByMode, "passRate"),
    sampleSizeLimited: true,
    recommendationIsPreliminary: true,
    insufficientSampleWarning: true,
  };
}

function summarizeMode(mode, scenarios, scores) {
  const modeScenarios = scenarios.filter((scenario) => scenario.mode === mode);
  const modeScores = scores.filter((item) => item.mode === mode).map((item) => item.score);
  const passCount = modeScenarios.filter((scenario) => scenario.routeTestPassed === true).length;
  return {
    mode,
    requestCount: modeScenarios.length,
    passCount,
    passRate: modeScenarios.length ? passCount / modeScenarios.length : 0,
    averageQualityScore: modeScores.length ? round(modeScores.reduce((sum, score) => sum + score, 0) / modeScores.length) : null,
    estimatedCostUsd: modeScenarios.reduce((sum, scenario) => sum + Number(scenario.estimatedCostUsd || 0), 0),
    latencyEvidencePresent: false,
    reliabilitySignal: modeScenarios.length && passCount === modeScenarios.length ? "all_sampled_routes_passed" : "needs_more_samples",
  };
}

function bestBy(summaryByMode, field) {
  const entries = Object.entries(summaryByMode).filter(([, value]) => Number.isFinite(value[field]));
  if (!entries.length) return "insufficient_evidence";
  const best = entries.reduce((winner, current) => current[1][field] > winner[1][field] ? current : winner);
  return best[0];
}

function round(value) {
  return Math.round(value * 100) / 100;
}
