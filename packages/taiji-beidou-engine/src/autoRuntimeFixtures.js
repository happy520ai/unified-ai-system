export const runtimeFailureFixtures = Object.freeze([
  { id: "runtime-timeout", blockedReason: "runtime_timeout", executionStatus: "blocked" },
  { id: "budget-exceeded", blockedReason: "token_budget_exceeded", executionStatus: "blocked" },
  { id: "verifier-failed", blockedReason: "verifier_failed", executionStatus: "failed" },
  { id: "unsafe-manifest", blockedReason: "unsafe_manifest", executionStatus: "blocked" },
  { id: "secret-like-output", blockedReason: "secret_like_output", executionStatus: "blocked" },
  { id: "recursive-spawn-attempt", blockedReason: "recursive_spawn_attempt", executionStatus: "blocked" },
  { id: "missing-rollback-plan", blockedReason: "missing_rollback_plan", executionStatus: "blocked" },
]);
