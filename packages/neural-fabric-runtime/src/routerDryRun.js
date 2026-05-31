export function runWorkforceRouterDryRun(input = {}) {
  const candidates = input.candidates || [
    { routeId: "mock.research.selector", score: 0.72, reason: "matches evidence review" },
    { routeId: "mock.safety.selector", score: 0.91, reason: "safety boundary must be checked first" },
    { routeId: "mock.writer.selector", score: 0.44, reason: "not a final answer generator in this phase" },
  ];
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const selected = sorted[0];

  return Object.freeze({
    phase: "Phase1307A",
    phaseKey: "phase1307a",
    name: "Router-op Dry-run for Workforce Fabric",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    branch: "Workforce Execution Fabric branch/router/selector",
    routerOnly: true,
    selectorDryRun: true,
    selectedRouteId: selected.routeId,
    selectedReason: selected.reason,
    candidates: sorted,
    finalAnswerGenerated: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    mainChainIntegrated: false,
    safety: {
      providerCallsMade: false,
      secretRead: false,
      secretValueExposed: false,
      realTrainingEnabled: false,
      mainChainIntegrated: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      workspaceCleanClaimed: false,
    },
  });
}
