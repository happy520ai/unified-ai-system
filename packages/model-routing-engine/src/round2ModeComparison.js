export function compareRound2Modes({ modeResults = [] } = {}) {
  const summaries = {};
  for (const result of modeResults) {
    const routes = (result.routeResults || []).filter((route) => route.dryRunOnly !== true);
    summaries[result.mode] = {
      mode: result.mode,
      realRequestCount: routes.length,
      passCount: routes.filter((route) => route.routeTestPassed === true).length,
      reliability: routes.length ? routes.filter((route) => route.routeTestPassed === true).length / routes.length : 0,
      averageQualityScore: routes.length ? average(routes.map((route) => route.qualityScore || 0)) : 0,
      averageLatencyMs: routes.length ? average(routes.map((route) => route.latencyMs || 0)) : 0,
      costUsd: routes.reduce((sum, route) => sum + Number(route.estimatedCostUsd || 0), 0),
    };
  }
  return {
    phase: "Phase952",
    completed: true,
    recommended_sealed: Object.keys(summaries).length >= 4,
    blocker: Object.keys(summaries).length >= 4 ? null : "round2_mode_comparison_incomplete",
    modeComparisonReady: Object.keys(summaries).length >= 4,
    summaries,
    sampleSizeStillLimited: true,
    recommendationIsStillPreliminary: true,
  };
}

function average(values) {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
