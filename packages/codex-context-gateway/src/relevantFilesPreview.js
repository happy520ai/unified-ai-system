import { readJsonFile, redactSensitivePath, resolveRepoRoot, safeArray, sanitizeText } from "./contextPackPreviewReader.js";

export function readRelevantFilesPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const file = readJsonFile(repoRoot, ".codex-context/relevant-files.json");
  const data = file.data || {};
  const files = safeArray(data.files).map((item) => ({
    path: redactSensitivePath(item.path || ""),
    reason: sanitizeText(item.reason || "selected"),
    mode: sanitizeText(item.mode || "summary"),
    category: categorize(item.path || "", item.reason || ""),
  }));
  const grouped = files.reduce((acc, item) => {
    acc[item.category] ||= [];
    acc[item.category].push(item);
    return acc;
  }, {});
  return {
    completed: file.exists && file.valid,
    relevantFilesReadable: file.exists && file.valid,
    relevantFilesVisible: files.length > 0,
    selectionMode: sanitizeText(data.selectionMode || "targeted-not-full-repo"),
    selectionReasonVisible: files.some((item) => Boolean(item.reason)),
    fullRepoScanAvoided: data.selectionMode === "targeted-not-full-repo" || files.every((item) => item.mode !== "full-repo"),
    fullRepoScanAvoidedVisible: true,
    relevantFileCount: files.length,
    relevantFileCountVisible: true,
    files,
    grouped,
    categoryGroupingSupported: Object.keys(grouped).length > 0,
    errors: file.errors,
  };
}

function categorize(path, reason) {
  const value = `${path} ${reason}`.toLowerCase();
  if (value.includes("ui") || value.includes("mission") || value.includes("console")) return "ui";
  if (value.includes("evidence")) return "evidence";
  if (value.includes("tool") || value.includes("validate")) return "verifier";
  if (value.includes("doc") || value.includes("readme") || value.includes("agents")) return "docs";
  if (value.includes("codex-context-gateway")) return "codex-context-gateway";
  return "project";
}
