export function createThreeModeAuditTrace({ requestId, mode }) {
  return {
    requestId,
    mode,
    runtimeStage: "real_runtime_mvp",
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    credentialRefOnly: true,
    selectedParticipants: [],
    rejectedCandidates: [],
    participantCallCount: 0,
    supervisorCallCount: 0,
    fallbackUsed: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: 0,
    steps: [],
  };
}

export function completeAuditTrace(trace, startedAt, extra = {}) {
  return {
    ...trace,
    ...extra,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}

export function addAuditStep(trace, step) {
  trace.steps.push({
    at: new Date().toISOString(),
    ...step,
  });
}
