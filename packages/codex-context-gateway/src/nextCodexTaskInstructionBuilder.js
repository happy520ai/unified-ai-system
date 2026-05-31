export function buildNextCodexTaskInstruction() {
  const instruction = [
    "Before starting the task, read .codex-context/current-context-pack.md.",
    "Check .codex-context/context-freshness-report.json and stop if stale=true.",
    "Use .codex-context/relevant-files.json as the default file read scope.",
    "Avoid full repo scans unless a specific out-of-scope read reason is recorded.",
    "Do not read, print, or expose secrets, API keys, tokens, webhooks, or .env contents.",
    "Do not modify /chat, /chat-gateway/execute, provider runtime, Codex config, or Codex base_url.",
    "Load .codex-context/codex-prompt-pack.md before implementing.",
    "Run the planned validation commands and write evidence for the task.",
  ].join("\n");
  return {
    completed: true,
    nextInstructionGenerated: true,
    instruction,
    contextPackFirstInstructionPresent: instruction.includes("current-context-pack.md"),
    staleCheckPresent: instruction.includes("stale=true"),
    relevantFilesPresent: instruction.includes("relevant-files.json"),
    noSecretPresent: instruction.includes("secrets"),
    validationPresent: instruction.includes("validation commands"),
  };
}
