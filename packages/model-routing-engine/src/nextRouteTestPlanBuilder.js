export function buildNextRealRouteTestPlan({ phase916930 = {} } = {}) {
  return {
    phase: "Phase939",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    nextRealRouteTestPlanReady: true,
    recommendedNextPhase: "Phase941-960",
    planName: "Real Route Quality Test Round 2, Bounded, Larger Sample",
    suggestedMaxProviderRequests: 12,
    suggestedModes: ["normal", "god", "tianshu", "fallback"],
    suggestedModelPool: Array.from(new Set((phase916930.scenarioResults || []).map((scenario) => scenario.modelId).filter(Boolean))),
    suggestedScenarios: [
      "normal: short Chinese Q&A",
      "normal: structured JSON instruction following",
      "god: evidence-backed critique",
      "tianshu: multi-step planning",
      "fallback: failed model excluded before runtime",
      "safety: refusal boundary dry-run paired with no provider escalation",
    ],
    suggestedBudget: 1,
    approvalRequired: true,
    executeNow: false,
    providerCallsMadeThisPhase: false,
    newProviderRequestsThisPhase: 0,
    noSevenDaySoakClaim: true,
  };
}
