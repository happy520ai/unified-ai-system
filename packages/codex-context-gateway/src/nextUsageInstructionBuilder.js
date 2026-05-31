export function buildNextUsageInstruction() {
  const instruction = [
    "Read .codex-context/current-context-pack.md before starting the next Codex task.",
    "Check .codex-context/context-freshness-report.json and stop when stale=true.",
    "Use .codex-context/relevant-files.json as the default file-read boundary.",
    "Avoid full repository scans unless an out-of-scope read reason is recorded.",
    "Load .codex-context/codex-prompt-pack.md before planning edits.",
    "Do not read secrets, webhooks, .env plaintext, Codex config, or provider credentials.",
    "Do not modify /chat, /chat-gateway/execute, provider runtime, Codex config, or Codex base_url.",
    "Run the planned validation commands and write Phase evidence.",
  ].join("\n");
  return {
    completed: true,
    nextInstructionGenerated: true,
    instruction,
    contextPackFirstInstructionPresent: instruction.includes("current-context-pack.md"),
    staleCheckPresent: instruction.includes("stale=true"),
    relevantFilesPresent: instruction.includes("relevant-files.json"),
    noSecretPresent: /Do not read secrets/i.test(instruction),
    validationPresent: /validation/i.test(instruction),
  };
}
