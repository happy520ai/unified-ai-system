import { normalizeScoringWeights } from "./tianshuScoringPolicy.js";

export function scoreTianshuCandidates({ candidates = [], task = {}, policy, priorSignals = {}, userPreference = {} } = {}) {
  const weights = normalizeScoringWeights(policy);
  return candidates
    .filter((candidate) => candidate.failedHighRisk !== true && candidate.quotaBudgetBlocked !== true)
    .map((candidate) => {
      const scoringBreakdown = {
        capabilityMatch: candidate.capabilities?.includes(task.type) ? 1 : 0.5,
        historicalSuccessRate: Number(priorSignals.successRate ?? 0.8),
        latencyScore: scoreInverse(candidate.latencyMs, 60000),
        costScore: scoreInverse(candidate.estimatedCost, 0.1),
        contextFit: task.longContext ? Number(candidate.contextScore ?? 0.5) : 0.8,
        outputFormatFit: 0.7,
        safetyFit: candidate.safetyAllowed === false ? 0 : 1,
        userPreferenceFit: userPreference.preferredModelId === candidate.modelId ? 1 : 0.5,
        providerAvailability: candidate.providerAvailable === false ? 0 : 1,
        quotaBudgetFit: candidate.quotaBudgetBlocked === true ? 0 : 1,
        fallbackReliability: Number(candidate.fallbackReliability ?? 0.8),
      };
      const score = Object.entries(scoringBreakdown).reduce((sum, [key, value]) => sum + Number(value || 0) * Number(weights[key] || 0), 0);
      return {
        ...candidate,
        score: round(score),
        scoringBreakdown,
      };
    })
    .sort((left, right) => right.score - left.score);
}

function scoreInverse(value, limit) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0.8;
  return Math.max(0, Math.min(1, 1 - number / limit));
}

function round(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}
