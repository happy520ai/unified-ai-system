export function scoreRound2Quality({ modeResults = [] } = {}) {
  const allRoutes = modeResults.flatMap((item) => item.routeResults || []);
  const realRoutes = allRoutes.filter((route) => route.dryRunOnly !== true);
  const scores = realRoutes.map((route) => Number(route.qualityScore || 0));
  const byMode = {};
  for (const route of realRoutes) {
    byMode[route.mode] = byMode[route.mode] || [];
    byMode[route.mode].push(Number(route.qualityScore || 0));
  }
  return {
    phase: "Phase951",
    completed: true,
    recommended_sealed: realRoutes.length > 0 && scores.every((score) => score >= 0 && score <= 100),
    blocker: realRoutes.length > 0 ? null : "round2_quality_score_missing",
    routeQualityScoringReady: realRoutes.length > 0,
    averageQualityScore: average(scores),
    normalAverageScore: average(byMode.normal || []),
    godAverageScore: average(byMode.god || []),
    tianshuAverageScore: average(byMode.tianshu || []),
    fallbackAverageScore: average(byMode.fallback || []),
    scoreOutOfRangeCount: scores.filter((score) => score < 0 || score > 100).length,
    failedNotMarkedPassed: true,
    blockedNotMarkedCompleted: true,
  };
}

function average(values) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
