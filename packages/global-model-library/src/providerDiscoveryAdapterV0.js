export function runProviderDiscoveryAdapterV0({ approvalIntake, readiness } = {}) {
  if (approvalIntake?.approved !== true || readiness?.credentialReady !== true) {
    return {
      phase: "Phase785",
      status: "not_executed_no_approval",
      realDiscoveryExecuted: false,
      providerCallsMade: false,
      discoveredModels: [],
      blockedReason: approvalIntake?.blocker ?? readiness?.failures?.join(";") ?? "approval_missing",
      credentialRefOnly: true,
      secretRead: false,
    };
  }
  return {
    phase: "Phase785",
    status: "blocked_by_gate",
    realDiscoveryExecuted: false,
    providerCallsMade: false,
    discoveredModels: [],
    blockedReason: "real_provider_discovery_adapter_not_enabled_in_this_environment",
    credentialRefOnly: true,
    secretRead: false,
  };
}
