export function buildRunnerHeartbeatPreview() {
  return {
    completed: true,
    heartbeatPreviewDefined: true,
    stuckDetectionDefined: true,
    heartbeatFormat: {
      runnerId: "phase594-preview",
      contextHash: "from-current-context-pack",
      lastStep: "preflight|freshness|scope|prompt|validation",
      updatedAt: "ISO-8601",
      dryRunOnly: true,
    },
    stuckDetection: {
      maxSilenceMs: 10 * 60 * 1000,
      action: "write-timeout-failure-evidence",
    },
    existingRunnerBehaviorModified: false,
  };
}
