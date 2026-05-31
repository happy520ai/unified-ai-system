export const phase603CustomProviderOneShotPrompt = [
  "Read .codex-context/current-context-pack.md.",
  "Check .codex-context/context-freshness-report.json and confirm stale=false.",
  "Read .codex-context/relevant-files.json.",
  "Do not edit files.",
  "Do not scan the full repository.",
  "Do not read secrets.",
  "Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK.",
].join(" ");

export const phase603NegativeControlCommandPreview =
  'codex -c model_provider="provider_that_should_not_exist_123" "Reply with one line only: SHOULD_FAIL_IF_MODEL_PROVIDER_OVERRIDE_WORKS."';

export function buildPhase603CustomProviderCommandBundle() {
  const commandPreview = `codex -c model_provider="pme_context_gateway" "${phase603CustomProviderOneShotPrompt}"`;
  return {
    completed: true,
    commandBundlePreviewGenerated: true,
    modelProviderOverrideUsed: true,
    commandExecuted: false,
    authJsonRead: false,
    rawBaseUrlValueExposed: false,
    configScope: "session_override",
    providerId: "pme_context_gateway",
    prompt: phase603CustomProviderOneShotPrompt,
    commandPreview,
    expectedOutput: "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
    negativeControlCommandPreview: phase603NegativeControlCommandPreview,
  };
}
