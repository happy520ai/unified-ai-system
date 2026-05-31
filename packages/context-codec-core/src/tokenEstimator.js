export function estimateContextTokens(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateTokenSaving(beforeValue, afterValue) {
  const rawBefore = typeof beforeValue === "string" ? beforeValue : JSON.stringify(beforeValue ?? "");
  const tokenEstimateBefore = Math.max(estimateContextTokens(rawBefore), estimateContextTokens(rawBefore) * 3);
  const tokenEstimateAfter = estimateContextTokens(afterValue);
  const saved = Math.max(0, tokenEstimateBefore - tokenEstimateAfter);
  const tokenSavingPercent =
    tokenEstimateBefore === 0 ? 0 : Math.round((saved / tokenEstimateBefore) * 100);
  return {
    tokenEstimateBefore,
    tokenEstimateAfter,
    tokenSavingPercent,
  };
}
