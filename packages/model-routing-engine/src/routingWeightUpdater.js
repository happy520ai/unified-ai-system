export function buildRoutingWeightUpdates(healthScores = []) {
  return healthScores.map((health) => ({
    modelId: health.modelId,
    providerId: health.providerId,
    previousWeight: 1,
    proposedWeight: Number((health.healthScore / 100).toFixed(2)),
    applyAutomatically: false,
    reason: health.retirementCandidate ? "manual_review_required_before_weight_change" : "dry_run_learning_signal",
  }));
}
