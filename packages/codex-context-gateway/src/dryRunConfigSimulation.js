export function buildDryRunConfigSimulation(options = {}) {
  const preview = options.redactedConfigPreview?.preview || {};
  return {
    completed: true,
    dryRunConfigSimulationSchemaValid: true,
    simulationId: options.simulationId || "phase598-dry-run-config-simulation",
    configScope: options.configScope || preview.targetScope || "session_override",
    proposedBaseUrlRef: preview.proposedBaseUrlRef || "relayRef:phase598-dry-run-preview",
    relayRef: preview.relayRef || "relayRef:phase598-dry-run-preview",
    credentialRef: preview.credentialRef || "credentialRef:phase598-approved-only",
    accountPoolRef: options.accountPoolRef || "accountPoolRef:phase598-simulated-pool",
    rollbackPlanRef: options.rollbackPlanRef || preview.rollbackPlanRef || "rollbackPlanRef:phase598-dry-run-preview",
    enabled: false,
    dryRunOnly: true,
    wouldWriteConfig: false,
    wouldStartRelay: false,
    dryRunConfigSimulationAllowed: true,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    providerCallsMade: false,
    simulationStatus: "dry_run_preview_only",
    summary: [
      "Simulate the future configuration surface only.",
      "Do not write to ~/.codex/config.toml.",
      "Do not write to a project .codex/config.toml.",
      "Do not start a real relay or proxy service.",
      "Do not call a provider.",
    ],
  };
}
