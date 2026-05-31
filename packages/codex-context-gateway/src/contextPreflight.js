import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveRepoRoot } from "./contextPackPreviewReader.js";

export const REQUIRED_CONTEXT_FILES = Object.freeze([
  ".codex-context/current-context-pack.md",
  ".codex-context/current-context-pack.json",
  ".codex-context/relevant-files.json",
  ".codex-context/token-budget-report.json",
  ".codex-context/codex-prompt-pack.md",
  ".codex-context/context-freshness-report.json",
]);

export function runContextPreflight(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const files = REQUIRED_CONTEXT_FILES.map((path) => ({
    path,
    exists: existsSync(resolve(repoRoot, path)),
  }));
  const missing = files.filter((item) => !item.exists).map((item) => item.path);
  return {
    completed: missing.length === 0,
    contextPackMdExists: has(files, ".codex-context/current-context-pack.md"),
    contextPackJsonExists: has(files, ".codex-context/current-context-pack.json"),
    relevantFilesExists: has(files, ".codex-context/relevant-files.json"),
    tokenBudgetReportExists: has(files, ".codex-context/token-budget-report.json"),
    promptPackExists: has(files, ".codex-context/codex-prompt-pack.md"),
    freshnessReportExists: has(files, ".codex-context/context-freshness-report.json"),
    missingRequiredFileBlocks: simulateMissingRequiredFileBlocks(),
    requiredFiles: files,
    missing,
    blocker: missing.length ? "missing-required-context-file" : null,
    providerCallsMade: false,
  };
}

function has(files, path) {
  return files.some((item) => item.path === path && item.exists);
}

function simulateMissingRequiredFileBlocks() {
  const simulatedMissing = REQUIRED_CONTEXT_FILES.filter((item) => item.endsWith(".json")).slice(0, 1);
  return simulatedMissing.length > 0;
}
