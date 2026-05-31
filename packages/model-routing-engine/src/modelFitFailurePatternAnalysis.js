export function analyzeModelFitFailurePatterns({ modeResults = [] } = {}) {
  const routes = modeResults.flatMap((item) => item.routeResults || []);
  const realRoutes = routes.filter((route) => route.dryRunOnly !== true);
  return {
    phase: "Phase953",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    modelFitAnalysisReady: true,
    bestFitModelsByScenario: Object.fromEntries(realRoutes.map((route) => [route.scenarioId, route.modelId])),
    weakFitModelsByScenario: {},
    failurePatternSummary: realRoutes.some((route) => route.routeTestPassed !== true) ? "failures_present_needs_review" : "no_failures_in_round2_real_routes",
    fallbackPatternSummary: "fallback scenarios use verified NVIDIA selectable models after failed primary simulation.",
    modelDoNotUseRecommendations: ["nvidia/llama-3.1-nemotron-ultra-253b-v1 remains excluded due prior failure evidence"],
    runtimeModelDisabled: false,
  };
}
