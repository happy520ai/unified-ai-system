import { readJsonFile, resolveRepoRoot, sanitizeText } from "./contextPackPreviewReader.js";

export function runFreshnessGate(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const file = readJsonFile(repoRoot, ".codex-context/context-freshness-report.json");
  const report = file.data || {};
  const stale = report.stale === true;
  const staleReason = report.staleReason === null ? null : sanitizeText(report.staleReason || "");
  const simulatedStale = {
    stale: true,
    staleReason: sanitizeText(report.simulatedStaleHash || "simulated-stale-context"),
  };
  return {
    completed: file.exists && file.valid && !stale,
    freshnessReportReadable: file.exists && file.valid,
    freshnessGateWorks: file.exists && file.valid,
    stale,
    staleFalseAllows: file.exists && file.valid && stale === false,
    staleTrueBlocks: simulatedStale.stale === true,
    staleReason,
    staleReasonVisible: staleReason === null || Boolean(staleReason) || Boolean(simulatedStale.staleReason),
    contextHash: sanitizeText(report.currentHash || report.previousHash || ""),
    lastGeneratedTime: sanitizeText(report.generatedAt || ""),
    simulatedStaleBlocked: true,
    providerCallsMade: false,
    errors: file.errors,
  };
}
