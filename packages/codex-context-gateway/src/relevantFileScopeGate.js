import { readJsonFile, redactSensitivePath, resolveRepoRoot, safeArray, sanitizeText } from "./contextPackPreviewReader.js";

export const BASE_METADATA_FILES = Object.freeze(["package.json", "README.md", "AGENTS.md"]);

export function buildRelevantFileScopeGate(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const file = readJsonFile(repoRoot, ".codex-context/relevant-files.json");
  const data = file.data || {};
  const relevantFiles = safeArray(data.files).map((item) => ({
    path: redactSensitivePath(item.path || ""),
    reason: sanitizeText(item.reason || "selected"),
    mode: sanitizeText(item.mode || "summary"),
  }));
  const allowedPaths = Array.from(new Set([...BASE_METADATA_FILES, ...relevantFiles.map((item) => item.path)]));
  const outOfScopeRead = requestFileRead("apps/ai-gateway-service/src/httpServer.js", allowedPaths, "");
  return {
    completed: file.exists && file.valid && relevantFiles.length > 0 && outOfScopeRead.allowed === false,
    relevantFileScopeLoaded: file.exists && file.valid,
    selectionMode: sanitizeText(data.selectionMode || "targeted-not-full-repo"),
    fullRepoScanAvoided: data.selectionMode === "targeted-not-full-repo" || relevantFiles.every((item) => item.mode !== "full-repo"),
    outOfScopeReadRequiresReason: outOfScopeRead.requiresReason === true,
    relevantFileCount: relevantFiles.length,
    relevantFileCountVisible: true,
    scopeGateWorks: file.exists && file.valid && relevantFiles.length > 0 && outOfScopeRead.allowed === false,
    baseMetadataFiles: BASE_METADATA_FILES,
    allowedPaths,
    relevantFiles,
    errors: file.errors,
  };
}

export function requestFileRead(path, allowedPaths, reason = "") {
  const safePath = redactSensitivePath(path);
  const isAllowed = allowedPaths.includes(safePath);
  if (isAllowed) {
    return { path: safePath, allowed: true, requiresReason: false, reason: sanitizeText(reason || "in-scope") };
  }
  return {
    path: safePath,
    allowed: Boolean(reason),
    requiresReason: !reason,
    reason: sanitizeText(reason),
  };
}
