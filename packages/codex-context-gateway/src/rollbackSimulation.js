export function buildRollbackSimulation(options = {}) {
  return {
    completed: true,
    rollbackSimulationWorks: true,
    previousConfigSnapshotRef: options.previousConfigSnapshotRef || "configSnapshotRef:phase597-design-preview",
    rollbackPlanRef: options.rollbackPlanRef || "rollbackPlanRef:phase598-dry-run-preview",
    disableRelaySimulated: true,
    disableAccountPoolSimulated: true,
    invalidateStaleContextSimulated: true,
    preserveEvidenceSimulated: true,
    destructiveRollbackForbidden: true,
    steps: [
      "Restore the previous config snapshot reference only.",
      "Disable the relay simulation.",
      "Disable the account pool simulation.",
      "Invalidate stale context before reuse.",
      "Preserve evidence and do not use destructive git reset.",
    ],
  };
}
