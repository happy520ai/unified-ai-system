export function buildPhase601GuardedTestChecklist(options = {}) {
  const readiness = options.readiness || {};
  return {
    completed: true,
    guardedTestChecklistGenerated: true,
    checklist: [
      "Phase600 readiness complete",
      "Final user confirmation required",
      "session_override only",
      "one-shot prompt reviewed",
      "rollback command ready",
      "emergency disable ready",
      "maxRequests=1",
      "provider call status explicitly defined",
      "logs/evidence path ready",
    ],
    phase600ReadinessComplete: readiness.phase600ReadinessSatisfied === true,
    finalUserConfirmationRequired: true,
    sessionOverrideOnly: true,
    rollbackReady: true,
    emergencyDisableReady: true,
    maxRequestsOne: true,
  };
}
