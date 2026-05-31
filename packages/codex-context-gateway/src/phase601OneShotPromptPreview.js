export function buildPhase601OneShotPromptPreview() {
  const prompt = [
    "Use .codex-context/current-context-pack.md first.",
    "Confirm context-freshness-report.json stale=false.",
    "Use relevant-files.json as the read boundary.",
    "Load codex-prompt-pack.md.",
    "Return a short evidence summary only; do not edit files.",
  ].join(" ");
  return {
    completed: true,
    oneShotPromptPreviewGenerated: true,
    prompt,
    promptIsMinimal: true,
    noSecretInstructionPresent: !/secret|api key|webhook/i.test(prompt),
    noDeployInstructionPresent: !/deploy|release|tag|artifact/i.test(prompt),
    noChatChangeInstructionPresent: !/\/chat|\/chat-gateway\/execute/i.test(prompt),
    providerCallsRequested: false,
  };
}
