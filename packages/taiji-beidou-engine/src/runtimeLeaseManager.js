export function createRuntimeLease(capabilityId, overrides = {}) {
  return {
    leaseId: `lease-${capabilityId}-${overrides.sequence ?? 1}`,
    capabilityId,
    ttlSeconds: 300,
    maxRequests: 3,
    maxTokenBudget: 4000,
    maxRuntimeMs: 30000,
    spawnDepth: 1,
    parentGatewayId: "taiji-beidou-auto-runtime-v0",
    killSwitchRef: "TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED",
    ...overrides,
  };
}

export function validateRuntimeLease(lease = {}) {
  const failures = [];
  if (!lease.leaseId) failures.push("lease_id_required");
  if (lease.ttlSeconds !== 300) failures.push("ttl_seconds_must_be_300");
  if (lease.maxRequests !== 3) failures.push("max_requests_must_be_3");
  if (lease.maxTokenBudget !== 4000) failures.push("max_token_budget_must_be_4000");
  if (lease.maxRuntimeMs !== 30000) failures.push("max_runtime_ms_must_be_30000");
  if (lease.spawnDepth !== 1) failures.push("spawn_depth_must_be_1");
  if (!lease.killSwitchRef) failures.push("kill_switch_ref_required");
  return {
    valid: failures.length === 0,
    failures,
  };
}
