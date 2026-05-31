export function buildModelHealthScores(models = [], routeHistory = []) {
  const failureByModel = new Map();
  for (const route of routeHistory) {
    const modelId = route.selectedModelId || route.selected?.primaryModelId;
    if (!modelId) continue;
    const current = failureByModel.get(modelId) || { pass: 0, fail: 0 };
    if (route.responseClassification === "pass") current.pass += 1;
    if (route.responseClassification && route.responseClassification !== "pass") current.fail += 1;
    failureByModel.set(modelId, current);
  }
  return models.map((model) => {
    const stats = failureByModel.get(model.modelId) || { pass: 0, fail: 0 };
    const base = model.runtimeEligible ? 80 : 35;
    const score = Math.max(0, Math.min(100, base + stats.pass * 2 - stats.fail * 6));
    return {
      modelId: model.modelId,
      providerId: model.providerId,
      healthScore: score,
      staleEvidence: !model.lastVerifiedAt,
      retirementCandidate: score < 40 || model.deprecated === true || model.blocked === true || model.highRisk === true,
      reasonCodes: [
        model.runtimeEligible ? "runtime_eligible" : "not_runtime_eligible",
        stats.fail > 0 ? "route_failures_present" : "no_route_failure_observed",
      ],
    };
  });
}
