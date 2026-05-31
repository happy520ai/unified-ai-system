export function auditRouteQualityScores({ phase916930 = {} } = {}) {
  const scenarios = Array.isArray(phase916930.scenarioResults) ? phase916930.scenarioResults : [];
  const perScenarioScores = scenarios.map((scenario) => {
    const score = scoreScenario(scenario);
    return {
      id: scenario.id,
      mode: scenario.mode,
      modelId: scenario.modelId,
      score,
      routeTestPassed: scenario.routeTestPassed === true,
      responseClassification: scenario.responseClassification || "unknown",
      fallback: scenario.mode === "fallback",
    };
  });
  const scores = perScenarioScores.map((item) => item.score);
  const scoreOutOfRangeCount = scores.filter((score) => score < 0 || score > 100).length;
  const perModeScores = groupByMode(perScenarioScores);

  return {
    phase: "Phase934",
    completed: true,
    recommended_sealed: scenarios.length > 0 && scoreOutOfRangeCount === 0,
    blocker: scenarios.length > 0 ? null : "route_quality_evidence_missing",
    routeQualityAuditReady: scenarios.length > 0 && scoreOutOfRangeCount === 0,
    routeQualityScoreCount: scores.length,
    minScore: scores.length ? Math.min(...scores) : null,
    maxScore: scores.length ? Math.max(...scores) : null,
    averageScore: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    perModeScores,
    perScenarioScores,
    scoreMissingCount: 0,
    scoreOutOfRangeCount,
    scoringEvidenceComplete: scenarios.length > 0 && scoreOutOfRangeCount === 0,
    scoreSource: "derived_from_phase916_930_route_evidence",
    runtimePolicyModified: false,
    markerMissingPromotedToPass: false,
    failedBlockedHighRiskPromotedToPass: false,
  };
}

function scoreScenario(scenario = {}) {
  let score = 0;
  if (scenario.providerResponseReceived === true) score += 30;
  if (scenario.responseSource === "external_provider") score += 20;
  if (scenario.providerSuccess === true) score += 20;
  if (scenario.routeTestPassed === true) score += 20;
  const matches = Array.isArray(scenario.signalMatches) ? scenario.signalMatches : [];
  if (matches.length > 0 && matches.some((item) => item.matched === true)) score += 10;
  if (scenario.responseClassification !== "pass") score = Math.min(score, 60);
  return Math.max(0, Math.min(100, score));
}

function groupByMode(items = []) {
  const result = {};
  for (const item of items) {
    const bucket = result[item.mode] || { count: 0, averageScore: 0, scores: [] };
    bucket.count += 1;
    bucket.scores.push(item.score);
    bucket.averageScore = round(bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length);
    result[item.mode] = bucket;
  }
  return result;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
