import { readTextFile, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";

export function readPromptPackPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const file = readTextFile(repoRoot, ".codex-context/codex-prompt-pack.md");
  const text = file.text || "";
  const lines = text.split(/\r?\n/);
  const title = sanitizeText(lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "") || "Codex Prompt Pack");
  return {
    completed: file.exists,
    promptPackReadable: file.exists,
    promptPackTitle: title,
    promptPackTitleVisible: Boolean(title),
    taskSummary: extractSection(text, "Task"),
    taskSummaryVisible: /##\s+Task/i.test(text),
    boundarySummary: extractSection(text, "Boundaries"),
    boundaryVisible: /##\s+Boundaries/i.test(text),
    relevantFilesSummary: extractSection(text, "Relevant Files"),
    relevantFilesVisible: /##\s+Relevant Files/i.test(text),
    validationCommands: extractSection(text, "Verification Commands"),
    validationCommandsVisible: /##\s+Verification Commands/i.test(text),
    previewText: sanitizeText(text).slice(0, 2400),
    rawSecretExposed: false,
    webhookValueExposed: false,
    errors: file.errors,
  };
}

function extractSection(text, heading) {
  const pattern = new RegExp(`##\\s+${heading}[\\s\\S]*?(?=\\n##\\s+|$)`, "i");
  const match = text.match(pattern);
  return sanitizeText(match ? match[0].trim() : "");
}
