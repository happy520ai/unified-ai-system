import { numberOrZero, hasAnyTrue } from "./benchmarkUtils.js";

export function scoreTokenSaving(tokenSaving, rag) {
  let score = 0;
  if (tokenSaving?.status === "passed" && rag?.status === "passed") score += 10;
  if (numberOrZero(rag?.summary?.averageSavingsRatio) > 0.95) score += 3;
  if (numberOrZero(tokenSaving?.paidApiCallCount) === 0 && rag?.safety?.longContextSentToPaidApi !== true) score += 2;
  return Math.min(score, 15);
}

export function scoreRagSourceSelection(rag) {
  let score = 0;
  if (numberOrZero(rag?.summary?.averageRequiredSourceRecall) >= 1) score += 5;
  if (numberOrZero(rag?.summary?.latestEvidenceHitRate) >= 1) score += 4;
  if (numberOrZero(rag?.summary?.staleSourceSelectedCount) === 0) score += 3;
  if (numberOrZero(rag?.summary?.passCount) >= 8) score += 3;
  return Math.min(score, 15);
}

export function scoreFreshness(rag) {
  let score = 0;
  if (rag?.status === "passed") score += 4;
  if (numberOrZero(rag?.summary?.failCount) === 0) score += 3;
  if (numberOrZero(rag?.summary?.latestEvidenceHitRate) >= 1) score += 3;
  return Math.min(score, 10);
}

export function scoreMimoSafety(mimo269, mimo271) {
  let score = 0;
  if ((mimo271?.configuration?.discoveredWorkingModelId ?? "") === "mimo-v2.5-pro") score += 2;
  if (mimo269?.response?.success === true || mimo271?.smoke?.success === true) score += 2;
  if (mimo269?.response?.usageReturned === true || mimo271?.smoke?.usageReturned === true) score += 1;
  if (mimo269?.mimoSetAsDefault === false && mimo271?.mimoSetAsDefault === false) score += 2;
  if (
    mimo269?.safety?.plainTextApiKeyWritten === false &&
    mimo271?.safety?.plainTextApiKeyWritten === false &&
    mimo269?.request?.longContextSent === false &&
    mimo271?.smoke?.longContextSent === false
  ) {
    score += 3;
  }
  return Math.min(score, 10);
}

export function scoreCalibration(calibration) {
  let score = 0;
  if (numberOrZero(calibration?.sampleCount) >= 2) score += 2;
  if (Array.isArray(calibration?.samples) && calibration.samples.length >= 2) score += 2;
  if (Number.isFinite(Number(calibration?.calibrationProfile?.recommendedInputSafetyMultiplier))) score += 2;
  if (Number.isFinite(Number(calibration?.calibrationProfile?.recommendedMinimumInputTokenFloor))) score += 2;
  if (calibration?.confidence === "low" && calibration?.calibrationCoverage === "smoke-only-limited") score += 1;
  const confidenceCap = calibration?.confidence === "low" ? 8 : 10;
  return Math.min(score, confidenceCap);
}

export function scoreCostGuard(costGuard) {
  let score = 0;
  if (costGuard?.status === "passed") score += 2;
  if (costGuard?.checks?.sampleEstimateAllowCasePassed === true) score += 2;
  if (costGuard?.checks?.sampleHighCostRequireApprovalCasePassed === true) score += 2;
  if (costGuard?.checks?.sampleOverBudgetBlockCasePassed === true) score += 2;
  if (costGuard?.checks?.summaryEndpointOk === true && costGuard?.checks?.safetyFieldsFalse === true) score += 2;
  return Math.min(score, 10);
}

export function scoreCacheReadiness(cache, costGuard, tokenSaving, rag) {
  let score = 0;
  if (costGuard?.checks?.sampleCacheKeyGenerated === true) score += 2;
  if (costGuard?.samples?.allow?.cache?.cacheEligible === true || numberOrZero(tokenSaving?.summary?.cacheEligibleCount) > 0) score += 1;
  if (Array.isArray(tokenSaving?.betterPlan) || Array.isArray(rag?.recommendedNextRoutes)) score += 1;
  if (cache?.status === "passed" && numberOrZero(cache?.summary?.hitCount) > 0) score += 1;
  return Math.min(score, 4);
}

export function scoreSecurityBoundary(sources) {
  const secretSafetyPassed = sources.secretSafety.data?.status === "passed";
  const providerDefaultUnchanged = !hasAnyTrue(sources, "defaultNvidiaChatLaneChanged") && !hasAnyTrue(sources, "mimoSetAsDefault");
  const executionDisabled = Object.values(sources).every(({ data }) => {
    const safety = data?.safety ?? {};
    return safety.codexCliInvoked !== true &&
      safety.codexExecInvoked !== true &&
      safety.workflowRunnerEnabled !== true &&
      safety.worktreeCreated !== true &&
      safety.autoCommit !== true &&
      safety.autoPush !== true;
  });
  const repoBoundarySafe = Object.values(sources).every(({ data }) => {
    const safety = data?.safety ?? {};
    return safety.legacyModified !== true && safety.projectContextCreated !== true;
  });
  const noLongPaidContext = Object.values(sources).every(({ data }) => {
    const safety = data?.safety ?? {};
    return safety.longContextSentToPaidApi !== true && safety.largeOutputRequested !== true && safety.stressTestExecuted !== true;
  });

  return [
    secretSafetyPassed,
    providerDefaultUnchanged,
    executionDisabled,
    repoBoundarySafe,
    noLongPaidContext,
  ].filter(Boolean).length * 2;
}
