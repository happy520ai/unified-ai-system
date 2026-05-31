export function buildPhase601SessionOverrideCommandPreview(options = {}) {
  const readiness = options.readiness || {};
  const relayRef = options.relayRef || "relayRef.codex-context-gateway.guarded-test";
  const redactedBaseUrlRef = `<redacted:${relayRef}>`;
  const oneShotPromptRef = "<one-shot test prompt>";
  return {
    completed: true,
    sessionOverrideCommandPreviewGenerated: true,
    configScope: "session_override",
    redactedBaseUrlRef,
    commandPreview: `codex -c openai_base_url="${redactedBaseUrlRef}" "${oneShotPromptRef}"`,
    exactCommandPreviewReady: readiness.phase600ReadinessSatisfied === true,
    previewBlockedByPhase600: readiness.phase600ReadinessSatisfied !== true,
    realCommandExecuted: false,
    realConfigWritePerformed: false,
    rawBaseUrlValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
  };
}
