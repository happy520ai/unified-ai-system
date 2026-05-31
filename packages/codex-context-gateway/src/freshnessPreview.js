import { readJsonFile, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";

export function readFreshnessPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const reportFile = readJsonFile(repoRoot, ".codex-context/context-freshness-report.json");
  const report = reportFile.data || {};
  return {
    completed: reportFile.exists && reportFile.valid,
    freshnessReportReadable: reportFile.exists && reportFile.valid,
    staleStatus: report.stale === true,
    staleStatusVisible: typeof report.stale === "boolean",
    contextHash: sanitizeText(report.currentHash || report.previousHash || ""),
    contextHashVisible: Boolean(report.currentHash || report.previousHash),
    generatedAt: sanitizeText(options.generatedAt || ""),
    staleReason: report.staleReason === null ? null : sanitizeText(report.staleReason || ""),
    staleReasonVisibleWhenPresent: report.staleReason === null || Boolean(report.staleReason),
    simulatedStaleHash: sanitizeText(report.simulatedStaleHash || ""),
    simulatedStalePreviewWorks: report.staleContextDetectedWhenExpected === true && report.rebuildRequiredWhenStale === true,
    errors: reportFile.errors,
  };
}
