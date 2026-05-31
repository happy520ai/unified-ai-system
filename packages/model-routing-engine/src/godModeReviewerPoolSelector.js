export function selectGodModeReviewerPool(scoredCandidates = []) {
  const reviewerPool = scoredCandidates
    .filter((candidate) => candidate.runtimeEligible)
    .filter((candidate) => candidate.roles?.includes("god_reviewer") || candidate.roles?.includes("reasoning"))
    .slice(0, 3);
  const fallbackPool = reviewerPool.length > 0 ? reviewerPool : scoredCandidates.filter((candidate) => candidate.runtimeEligible).slice(0, 3);
  return {
    phase: "Phase807",
    godModeReviewerPoolSelectorReady: true,
    reviewerPool: fallbackPool,
    adjudicatorModelId: fallbackPool[0]?.modelId ?? null,
    providerCallsMade: false,
    secretRead: false,
  };
}
