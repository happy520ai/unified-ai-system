import { readJsonFile, redactSensitivePath, resolveRepoRoot, safeArray, sanitizeText } from "./contextPackPreviewReader.js";

export function readDirtySummaryPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const contextFile = readJsonFile(repoRoot, ".codex-context/current-context-pack.json");
  const gitDiff = contextFile.data?.gitDiff || {};
  const changedFiles = safeArray(gitDiff.changedFiles).slice(0, 60).map((item) => ({
    status: sanitizeText(item.status || ""),
    path: redactSensitivePath(item.path || ""),
  }));
  return {
    completed: contextFile.exists && contextFile.valid && gitDiff.completed === true,
    dirtySummaryReadable: contextFile.exists && contextFile.valid && Boolean(gitDiff),
    dirtySummaryVisible: true,
    changedFileCount: Number(gitDiff.changedFileCount || changedFiles.length || 0),
    dirtyFileCountVisible: true,
    changedFiles,
    workspaceCleanClaimed: false,
    sensitiveDiffExposed: false,
    diffContentShown: false,
    statusAvailable: gitDiff.statusAvailable === true,
    mode: sanitizeText(gitDiff.mode || "metadata-only"),
    errors: contextFile.errors,
  };
}
