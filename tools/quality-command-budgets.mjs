// Existing child limits stay fixed; each parent must cover its sequential work.
export const QUALITY_STAGE_TIMEOUT_MS = Object.freeze({
  publicRepo: 180_000,
  publicClone: 300_000,
  supplyChain: 120_000,
  vision: 120_000,
  recoveryDrill: 60_000,
});

const REPORT_MARGIN_MS = 30_000;
export const QUALITY_ARTIFACT_VERIFY_TIMEOUT_MS = 30_000;
export const QUALITY_SCORECARD_TIMEOUT_MS = Object.values(QUALITY_STAGE_TIMEOUT_MS)
  .reduce((total, timeoutMs) => total + timeoutMs, REPORT_MARGIN_MS);
export const QUALITY_CI_TIMEOUT_MS = QUALITY_SCORECARD_TIMEOUT_MS
  + QUALITY_STAGE_TIMEOUT_MS.recoveryDrill
  + QUALITY_ARTIFACT_VERIFY_TIMEOUT_MS
  + REPORT_MARGIN_MS;
