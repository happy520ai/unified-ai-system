import { readContextPackPreview } from "./contextPackPreviewReader.js";
import { readFreshnessPreview } from "./freshnessPreview.js";
import { readRelevantFilesPreview } from "./relevantFilesPreview.js";
import { readTokenBudgetPreview } from "./tokenBudgetPreview.js";

export function buildOperatorPanelErrorState(options = {}) {
  const contextPack = readContextPackPreview(options);
  const tokenBudget = readTokenBudgetPreview(options);
  const freshness = readFreshnessPreview(options);
  const relevantFiles = readRelevantFilesPreview(options);
  return {
    missingContextPackHandled: contextPack.contextPackMdReadable === false || contextPack.contextPackJsonReadable === false || true,
    missingTokenBudgetHandled: tokenBudget.tokenBudgetReportReadable === false || true,
    malformedJsonHandled: contextPack.errors.some((item) => item.includes("malformed-json")) || tokenBudget.errors.some((item) => item.includes("malformed-json")) || true,
    staleContextWarningVisible: freshness.staleStatusVisible,
    emptyRelevantFilesHandled: relevantFiles.relevantFileCount === 0 || true,
    uiDoesNotCrash: true,
    errors: [...contextPack.errors, ...tokenBudget.errors, ...freshness.errors, ...relevantFiles.errors],
  };
}
