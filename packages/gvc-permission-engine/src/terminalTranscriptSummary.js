import { classifyShellCommand } from "./shellCommandClassifier.js";

export function summarizeTerminalTranscript({ command, exitCode, stdout = "", stderr = "" } = {}) {
  const classification = classifyShellCommand(command);
  return {
    commandCategory: classification.category,
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    riskFlags: classification.riskFlags,
    summary: buildSummary({ classification, stdout, stderr }),
    rawTranscriptStored: false,
    stdoutStored: false,
    stderrStored: false,
    providerCallsMade: false,
    secretRead: false,
  };
}

function buildSummary({ classification, stdout, stderr }) {
  const stdoutLength = String(stdout || "").length;
  const stderrLength = String(stderr || "").length;
  return `Command classified as ${classification.category}; stdoutBytes=${stdoutLength}; stderrBytes=${stderrLength}; raw transcript intentionally omitted.`;
}
