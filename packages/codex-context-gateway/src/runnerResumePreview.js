export function buildRunnerResumePreview() {
  return {
    completed: true,
    resumePreviewDefined: true,
    timeoutFailureEvidenceDefined: true,
    resumeStateFormat: {
      contextHash: "from-current-context-pack",
      lastCompletedGate: "preflight",
      pendingGate: "freshness",
      validationCommands: [],
      dryRunOnly: true,
    },
    timeoutFailureEvidence: {
      completed: false,
      blocker: "runner-timeout-preview",
      providerCallsMade: false,
      realCodexConnectionMade: false,
    },
    existingRunnerBehaviorModified: false,
  };
}
