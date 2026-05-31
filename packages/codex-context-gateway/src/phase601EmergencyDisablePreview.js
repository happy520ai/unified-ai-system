export function buildPhase601EmergencyDisablePreview() {
  return {
    completed: true,
    emergencyDisablePreviewGenerated: true,
    emergencySteps: [
      "stop relay by relayRef if later started",
      "block account pool by accountPoolRef",
      "clear session override",
      "force stale context",
      "send operator alert",
      "preserve logs and evidence",
    ],
    emergencyDisableExecuted: false,
    relayStopPreviewIncluded: true,
    accountPoolBlockPreviewIncluded: true,
    staleContextForcePreviewIncluded: true,
    logsEvidencePreserved: true,
  };
}
