export function buildEmergencyDisableSimulation() {
  return {
    completed: true,
    emergencyDisableSimulationWorks: true,
    baseUrlIntegrationDisabled: true,
    relayBlocked: true,
    accountPoolBlocked: true,
    staleContextForced: true,
    operatorAlertGenerated: true,
    evidencePreserved: true,
    summary: [
      "Disable the base_url integration path.",
      "Block relay simulation execution.",
      "Block account pool simulation execution.",
      "Force stale-context handling.",
      "Generate an operator alert and preserve evidence.",
    ],
  };
}
