export function applyHomeostasisPolicy(manifest, overrides = {}) {
  return {
    capabilityId: manifest.capabilityId,
    ttlSeconds: Number(overrides.ttlSeconds ?? manifest.runtime.ttlSeconds ?? 300),
    maxRequests: Number(overrides.maxRequests ?? manifest.runtime.maxRequests ?? 3),
    maxTokenBudget: Number(overrides.maxTokenBudget ?? manifest.runtime.maxTokenBudget ?? 4000),
    maxSpawnDepth: 1,
    recursiveSpawnBlocked: true,
    runtimeAutoEnabled: false,
    leaseRequired: true,
    budgetStatus: "within_dry_run_limits",
  };
}

export function applyHomeostasisPolicies(manifests) {
  return manifests.map((manifest) => applyHomeostasisPolicy(manifest));
}
