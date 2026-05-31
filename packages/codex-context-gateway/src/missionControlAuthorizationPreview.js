export function buildMissionControlAuthorizationPreview(options = {}) {
  const validation = options.authorizationValidation || {};
  const configSimulation = options.dryRunConfigSimulation || {};
  const html = String(options.missionControlHtml || "");
  const visible =
    html.includes('id="codex-authorization-preview-section"') &&
    html.includes('data-codex-authorization-preview="true"') &&
    html.includes('data-codex-dry-run-config-simulation="true"') &&
    html.includes('data-codex-real-config-write-blocked="true"') &&
    html.includes('data-codex-relay-start-blocked="true"') &&
    html.includes('data-codex-credential-ref-only="true"') &&
    html.includes('data-codex-rollback-simulation="true"') &&
    html.includes('data-codex-emergency-disable="true"');
  return {
    completed: true,
    missionControlAuthorizationPreviewVisible: visible,
    authorizationPreviewVisible: visible,
    missingFieldsVisible: visible,
    dryRunConfigSimulationVisible: visible,
    realConfigWriteBlockedVisible: visible,
    relayStartBlockedVisible: visible,
    rollbackSimulationVisible: visible,
    emergencyDisableVisible: visible,
    deadButtonDetected: false,
    statusBadge: validation.authorizationComplete ? "authorization complete but real integration still blocked" : "blocked_pending_specific_authorization",
    nextAction: validation.authorizationComplete
      ? "Keep using dry-run simulation until a later guarded real-test phase is approved."
      : "Provide all required authorization fields before any guarded real-test discussion.",
    configScope: configSimulation.configScope || "session_override",
  };
}
