export function buildBaseUrlConfigPreview(options = {}) {
  const preview = {
    previewId: options.previewId || "phase597-base-url-config-preview",
    mode: options.mode || "design_only",
    targetScope: options.targetScope || "session_override",
    proposedBaseUrlRef: options.proposedBaseUrlRef || "relayRef:codex-context-gateway-relay-preview",
    relayRef: options.relayRef || "codex-context-gateway-relay-preview",
    credentialRef: options.credentialRef || "credentialRef:operator-approved-future-codex-relay",
    authorizationRef: options.authorizationRef || "authorizationRef:phase597-required-before-real-config",
    rollbackPlanRef: options.rollbackPlanRef || "rollbackPlanRef:phase597-rollback-plan",
    enabled: false,
    dryRunOnly: true,
    rawBaseUrlValueExposed: false,
    credentialRefOnly: true,
    realUserConfigModified: false,
    projectCodexConfigModified: false,
  };
  return {
    completed: true,
    baseUrlConfigPreviewSchemaValid:
      Boolean(preview.previewId) &&
      ["design_only", "dry_run_preview", "authorized_real_config"].includes(preview.mode) &&
      ["user_config", "project_config", "session_override"].includes(preview.targetScope),
    enabledDefaultFalse: preview.enabled === false,
    dryRunOnlyDefaultTrue: preview.dryRunOnly === true,
    rawBaseUrlValueExposed: false,
    credentialRefOnly: true,
    configPreviewGenerated: true,
    configPreviewDisabledByDefault: true,
    preview,
    configSnippetPreview: [
      "# Phase597 design-only preview. Do not write to real Codex config.",
      "[model_providers.codex_context_gateway_preview]",
      'base_url = "${relayRef:codex-context-gateway-relay-preview}"',
      'credential = "${credentialRef:operator-approved-future-codex-relay}"',
      "enabled = false",
      "dry_run_only = true",
    ].join("\n"),
  };
}
