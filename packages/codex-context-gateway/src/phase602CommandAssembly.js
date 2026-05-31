export function buildPhase602CommandAssembly() {
  const promptPath = "docs/phase602-one-shot-prompt.md";
  return {
    completed: true,
    commandAssembled: true,
    sessionOverrideUsed: true,
    configScope: "session_override",
    baseUrlSource: "env:CODEX_CONTEXT_GATEWAY_RELAY_BASE_URL",
    promptPath,
    commandPreview: `codex -c openai_base_url="$CODEX_CONTEXT_GATEWAY_RELAY_BASE_URL" "$(cat ${promptPath})"`,
    commandHash: "phase602-command-preview-redacted",
    realConfigWritePerformed: false,
    rawBaseUrlValueExposed: false,
    commandNotExecutedYet: true,
  };
}
