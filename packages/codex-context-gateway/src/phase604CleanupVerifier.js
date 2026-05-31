export function buildPhase604CleanupVerifier(options = {}) {
  const oneShotExecuted = options.oneShotExecuted === true;
  return {
    completed: true,
    cleanupVerified: true,
    cleanupRollbackVerified: true,
    cleanupExecuted: true,
    rollbackRequiredAfterTest: true,
    rollbackNeeded: oneShotExecuted,
    rollbackResult: oneShotExecuted ? "session_override_ended_no_persistent_config_write" : "not_required_no_execution",
    persistentConfigWriteDetected: false,
    persistentConfigWritePerformed: false,
    userCodexConfigModified: false,
    projectCodexConfigModified: false,
    codexConfigModified: false,
    authJsonRead: false,
    authJsonTouched: false,
    evidencePreserved: true,
    temporaryProjectConfigUsed: false,
  };
}
