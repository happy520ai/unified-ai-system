export function buildCodexInstructionSnippet() {
  const snippet = [
    "Before starting this task:",
    "1. Read `.codex-context/current-context-pack.md`.",
    "2. Check `.codex-context/context-freshness-report.json` and stop if `stale=true`.",
    "3. Read `.codex-context/relevant-files.json` and use it as the default file-read scope.",
    "4. Do not perform a full repo scan unless an explicit reason is recorded.",
    "5. Do not read secrets, raw webhooks, `.env`, credential resolver internals, or API keys.",
    "6. Do not modify `/chat`, `/chat-gateway/execute`, provider runtime, Codex config, or Codex base_url.",
    "7. Follow `.codex-context/codex-prompt-pack.md` and run the validation commands it lists.",
    "8. Treat context pack output as context only, not as a model execution result.",
  ].join("\n");
  return {
    completed: true,
    instructionSnippetGenerated: true,
    snippet,
    readContextPackInstructionPresent: snippet.includes(".codex-context/current-context-pack.md"),
    staleCheckInstructionPresent: snippet.includes("stale=true"),
    relevantFilesInstructionPresent: snippet.includes("relevant-files.json"),
    noSecretInstructionPresent: /Do not read secrets/i.test(snippet),
    noChatChangeInstructionPresent: snippet.includes("/chat") && snippet.includes("/chat-gateway/execute"),
    providerCallsMade: false,
  };
}
