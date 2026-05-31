export function buildRollbackPlan() {
  const steps = [
    "restore previous Codex config from captured backup",
    "disable relay routing flag",
    "disable account pool references",
    "invalidate stale context and require pack refresh",
    "preserve evidence and audit files",
    "forbid git reset --hard unless explicitly authorized",
  ];
  return {
    completed: true,
    rollbackPlanGenerated: true,
    restorePreviousConfigDefined: true,
    disableRelayDefined: true,
    disableAccountPoolDefined: true,
    invalidateStaleContextDefined: true,
    preserveEvidenceDefined: true,
    destructiveRollbackForbidden: true,
    rollbackPlanRef: "rollbackPlanRef:phase597-controlled-base-url-design",
    steps,
  };
}
