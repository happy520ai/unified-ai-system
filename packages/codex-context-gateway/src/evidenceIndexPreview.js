import { readJsonFile, redactSensitivePath, resolveRepoRoot, safeArray, sanitizeText } from "./contextPackPreviewReader.js";

export function readEvidenceIndexPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const contextFile = readJsonFile(repoRoot, ".codex-context/current-context-pack.json");
  const phaseEvidence = contextFile.data?.phaseEvidence || {};
  const refs = safeArray(phaseEvidence.latestRefs).slice(0, 20).map((item) => ({
    phaseId: sanitizeText(item.phaseId || ""),
    evidenceId: sanitizeText(item.evidenceId || ""),
    path: redactSensitivePath(item.path || ""),
    bytes: Number(item.bytes || 0),
    completed: item.completed === true,
    recommended_sealed: item.recommended_sealed === true,
    blocker: sanitizeText(item.blocker === null ? "null" : item.blocker || "null"),
  }));
  return {
    completed: contextFile.exists && contextFile.valid,
    evidenceIndexReadable: contextFile.exists && contextFile.valid && Number(phaseEvidence.indexedCount || 0) > 0,
    evidenceRefsVisible: refs.length > 0,
    evidenceRefCount: Number(phaseEvidence.indexedCount || refs.length || 0),
    evidenceRefCountVisible: Number(phaseEvidence.indexedCount || refs.length || 0) > 0,
    recentPhases: refs.map((item) => item.phaseId).filter(Boolean).slice(0, 8),
    recentPhaseEvidenceVisible: refs.length > 0,
    evidenceSummary: refs,
    rawSecretExposed: false,
    errors: contextFile.errors,
  };
}
