export function buildThreeModeTelemetryPanelState(payload = {}) {
  const data = payload.data || payload;
  const audit = data.auditTrace || {};
  return {
    currentMode: data.mode || audit.mode || "unknown",
    providerCallsMade: audit.providerCallsMade === true,
    nonNvidiaProviderCallsMade: audit.nonNvidiaProviderCallsMade === true,
    fallbackUsed: data.fallbackUsed === true || audit.fallbackUsed === true,
    latencyMs: Number(payload.meta?.durationMs || audit.durationMs || 0),
    participantCallCount: Number(audit.participantCallCount || 0),
    supervisorCallCount: Number(audit.supervisorCallCount || 0),
    policyStatus: audit.policyDecision?.policyStatus || "unknown",
    credentialStatus: audit.credentialRefOnly === true ? "credentialRefOnly" : "not_applicable",
  };
}
