export const REAL_PROVIDER_RUNTIME_EMERGENCY_DISABLE_REF = "TAIJI_BEIDOU_REAL_PROVIDER_RUNTIME_ENABLED=false";

export function buildProviderRuntimeFailureDrill() {
  const cases = [
    ["missing-approval", "missing_approval", "blocked"],
    ["non-nvidia-provider", "non_nvidia_provider_blocked", "blocked"],
    ["raw-secret-detected", "raw_secret_detected", "blocked"],
    ["missing-rollback", "missing_rollback", "blocked"],
    ["max-requests-exceeded", "max_requests_exceeded", "blocked"],
    ["timeout-simulated", "timeout_simulated", "failed"],
    ["budget-exceeded", "budget_exceeded", "blocked"],
    ["marker-missing", "provider_response_received_but_marker_missing", "failed"],
    ["recursive-spawn-attempt", "recursive_spawn_attempt", "blocked"],
    ["emergency-disable-active", "emergency_disable_active", "blocked"],
  ];

  return cases.map(([id, reason, status]) => ({
    caseId: id,
    providerId: id === "non-nvidia-provider" ? "openai" : "nvidia",
    executionStatus: status,
    blockedReason: reason,
    completed: false,
    passed: false,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    emergencyDisableAvailable: true,
    emergencyDisableRef: REAL_PROVIDER_RUNTIME_EMERGENCY_DISABLE_REF,
  }));
}
