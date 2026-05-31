export function buildPhase602Cleanup(options = {}) {
  return {
    completed: true,
    cleanupExecuted: true,
    cleanupMode: options.oneShotExecuted ? "post_one_shot_cleanup" : "safe_noop_cleanup",
    persistentConfigWriteDetected: false,
    userCodexConfigModified: false,
    projectCodexConfigModified: false,
    sessionOverrideEnded: true,
    evidencePreserved: true,
    rollbackResult: options.oneShotExecuted ? "session_override_completed" : "no_runtime_state_to_rollback",
  };
}
