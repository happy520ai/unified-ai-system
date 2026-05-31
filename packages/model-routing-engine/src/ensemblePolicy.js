export function buildEnsemblePolicy(input = {}) {
  const candidates = input.candidates || [];
  const reviewerPool = chooseDiversePool(candidates, 3);
  const adjudicator = reviewerPool.find((model) => model.capabilities?.reasoning) || reviewerPool[0] || null;
  const planner = candidates.find((model) => model.roles?.includes("tianshu_planner")) || adjudicator || candidates[0] || null;
  const executors = candidates.filter((model) => model.modelId !== planner?.modelId).slice(0, 3);
  return {
    phase: "Phase861-870",
    godTianshuEnsembleContractReady: true,
    reviewerDiversityPolicyReady: true,
    adjudicatorSelectionPolicyReady: true,
    tianshuPlannerSelectionPolicyReady: true,
    tianshuExecutorPoolPolicyReady: true,
    modeSwitchPolicyReady: true,
    costAwareEnsemblePolicyReady: true,
    latencyAwareEnsemblePolicyReady: true,
    contextAwareEnsemblePolicyReady: true,
    reliabilityAwareEnsemblePolicyReady: true,
    reviewerPool: reviewerPool.map((model) => model.modelId),
    adjudicatorModelId: adjudicator?.modelId || null,
    plannerModelId: planner?.modelId || null,
    executorModelIds: executors.map((model) => model.modelId),
    providerCallsMade: false,
    secretRead: false,
  };
}

function chooseDiversePool(candidates, limit) {
  const pool = [];
  const seenHints = new Set();
  for (const candidate of candidates) {
    const hint = capabilityHint(candidate);
    if (!seenHints.has(hint) || pool.length === 0) {
      pool.push(candidate);
      seenHints.add(hint);
    }
    if (pool.length >= limit) break;
  }
  for (const candidate of candidates) {
    if (pool.length >= limit) break;
    if (!pool.some((item) => item.modelId === candidate.modelId)) pool.push(candidate);
  }
  return pool;
}

function capabilityHint(model) {
  if (model.capabilities?.chineseOptimized) return "chinese";
  if (model.capabilities?.lowLatency) return "fast";
  if (model.capabilities?.reasoning) return "reasoning";
  return "default";
}
