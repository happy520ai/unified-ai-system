export function selectTianshuPlannerExecutor(scoredCandidates = []) {
  const runtime = scoredCandidates.filter((candidate) => candidate.runtimeEligible);
  const planner = runtime.find((candidate) => candidate.roles?.includes("tianshu_planner")) || runtime[0] || null;
  const executorModelIds = runtime
    .filter((candidate) => candidate.modelId !== planner?.modelId)
    .slice(0, 3)
    .map((candidate) => candidate.modelId);
  const fallbackModelIds = runtime.slice(0, 5).map((candidate) => candidate.modelId);
  return {
    phase: "Phase808",
    tianshuPlannerExecutorSelectorReady: true,
    plannerModelId: planner?.modelId ?? null,
    executorModelIds,
    fallbackModelIds,
    providerCallsMade: false,
    secretRead: false,
  };
}
