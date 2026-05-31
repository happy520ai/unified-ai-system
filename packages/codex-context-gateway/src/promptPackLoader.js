import { readTextFile, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";

export function loadPromptPack(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const file = readTextFile(repoRoot, ".codex-context/codex-prompt-pack.md");
  const text = sanitizeText(file.text || "");
  const preview = {
    completed: file.exists,
    promptPackReadable: file.exists,
    title: extractTitle(text),
    taskSummary: extractSection(text, "Task"),
    taskSummaryLoaded: /##\s+Task/i.test(text),
    boundaries: extractSection(text, "Boundaries"),
    boundaryLoaded: /##\s+Boundaries/i.test(text),
    relevantFiles: extractSection(text, "Relevant Files"),
    relevantFilesLoaded: /##\s+Relevant Files/i.test(text),
    validationCommands: extractSection(text, "Verification Commands"),
    validationCommandsLoaded: /##\s+Verification Commands/i.test(text),
    rawSecretExposed: false,
    webhookValueExposed: false,
    textPreview: text.slice(0, 2600),
    errors: file.errors,
  };
  const serialized = JSON.stringify(preview);
  preview.rawSecretExposed = /sk-[A-Za-z0-9_-]{16,}|nvapi-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i.test(serialized);
  preview.webhookValueExposed = /https:\/\/[^"\s]*webhook|https:\/\/hooks\./i.test(serialized);
  return preview;
}

function extractTitle(text) {
  return sanitizeText(text.split(/\r?\n/).find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "") || "Codex Prompt Pack");
}

function extractSection(text, heading) {
  const pattern = new RegExp(`##\\s+${heading}[\\s\\S]*?(?=\\n##\\s+|$)`, "i");
  const match = text.match(pattern);
  return sanitizeText(match ? match[0].trim() : "");
}
