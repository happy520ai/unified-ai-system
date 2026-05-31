import { sanitizeText } from "./contextPackPreviewReader.js";

export function buildRedactedConfigPreview(options = {}) {
  const preview = {
    previewId: options.previewId || "phase598-redacted-config-preview",
    mode: options.mode || "dry_run_preview",
    targetScope: options.targetScope || "session_override",
    proposedBaseUrlRef: sanitizeText(options.proposedBaseUrlRef || "relayRef:phase598-dry-run-preview"),
    relayRef: sanitizeText(options.relayRef || "relayRef:phase598-dry-run-preview"),
    credentialRef: sanitizeText(options.credentialRef || "credentialRef:phase598-approved-only"),
    authorizationRef: sanitizeText(options.authorizationRef || "authorizationRef:phase598-intake-required"),
    rollbackPlanRef: sanitizeText(options.rollbackPlanRef || "rollbackPlanRef:phase598-dry-run-preview"),
    enabled: false,
    dryRunOnly: true,
  };
  return {
    completed: true,
    redactedConfigPreviewGenerated: true,
    rawBaseUrlValueExposed: false,
    credentialRefOnly: true,
    realUserConfigModified: false,
    projectCodexConfigModified: false,
    configPreviewDisabledByDefault: true,
    preview,
    configSnippetPreview: [
      "# Phase598 dry-run preview only. Do not write to real Codex config.",
      "[model_providers.codex_context_gateway_preview]",
      'base_url = "${relayRef:phase598-dry-run-preview}"',
      'credential = "${credentialRef:phase598-approved-only}"',
      "enabled = false",
      "dry_run_only = true",
    ].join("\n"),
  };
}
