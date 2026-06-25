/**
 * Smart Model Router — analyzes task complexity and recommends model tier.
 *
 * Usage:
 *   const recommendation = recommendModel(goal, { availableModels, preferences });
 *   // returns { tier, modelId, providerId, reason, complexity }
 */

// Complexity tiers
const TIERS = {
  FAST: "fast",         // Simple lookups, single-file edits, quick questions
  STANDARD: "standard", // Multi-file changes, moderate complexity
  POWER: "power",       // Architecture decisions, multi-step reasoning, large refactors
};

// Complexity scoring heuristics
function analyzeComplexity(goal) {
  if (!goal || typeof goal !== "string") {
    return { score: 0.5, tier: TIERS.STANDARD, signals: [] };
  }

  const signals = [];
  let score = 0.3; // baseline

  // Length heuristic: longer goals tend to be more complex
  const wordCount = goal.split(/\s+/).length;
  if (wordCount > 100) {
    score += 0.15;
    signals.push("long_goal(100+ words)");
  } else if (wordCount > 50) {
    score += 0.08;
    signals.push("medium_goal(50+ words)");
  } else if (wordCount < 15) {
    score -= 0.1;
    signals.push("short_goal(<15 words)");
  }

  // Multi-step indicators
  const multiStepPatterns = [
    /\b(all|every|each)\b.*\b(files?|modules?|functions?)\b/i,
    /\brefactor\b/i,
    /\bacross\b.*\b(project|codebase|repo)\b/i,
    /\bimplement\b.*\b(system|architecture|framework)\b/i,
    /\bdesign\b.*\b(pattern|architecture)\b/i,
    /\b(migrate|convert)\b.*\b(from|to)\b/i,
    /\b(test|verify|validate)\b.*\b(all|every|comprehensive)\b/i,
    /\bdebug\b.*\b(complex|intermittent|race)\b/i,
  ];

  for (const pattern of multiStepPatterns) {
    if (pattern.test(goal)) {
      score += 0.1;
      signals.push(`multi_step:${pattern.source}`);
    }
  }

  // Simple task indicators
  const simplePatterns = [
    /\b(fix|change|update|rename)\b.*\b(one|single|this|that)\b/i,
    /\b(add|remove|delete)\b.*\b(comment|import|line)\b/i,
    /\b(read|show|find|search|grep)\b/i,
    /\b(what|where|how)\b.*\b(is|does|do)\b/i,
    /\b(format|lint|style)\b/i,
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(goal)) {
      score -= 0.08;
      signals.push(`simple:${pattern.source}`);
    }
  }

  // File count hints
  const fileCountMatch = goal.match(/(\d+)\s*files?/i);
  if (fileCountMatch) {
    const count = parseInt(fileCountMatch[1], 10);
    if (count > 5) {
      score += 0.15;
      signals.push(`many_files(${count})`);
    } else if (count > 2) {
      score += 0.08;
      signals.push(`several_files(${count})`);
    }
  }

  // Round/phase indicators (multi-round tasks)
  const roundMatch = goal.match(/(\d+)\s*(rounds?|phases?|steps?|stages?)/i);
  if (roundMatch) {
    const rounds = parseInt(roundMatch[1], 10);
    if (rounds > 2) {
      score += 0.12;
      signals.push(`multi_round(${rounds})`);
    }
  }

  // Clamp score to [0, 1]
  score = Math.max(0, Math.min(1, score));

  // Determine tier
  let tier;
  if (score < 0.3) {
    tier = TIERS.FAST;
  } else if (score < 0.65) {
    tier = TIERS.STANDARD;
  } else {
    tier = TIERS.POWER;
  }

  return { score: Math.round(score * 1000) / 1000, tier, signals };
}

/**
 * Recommend a model based on task complexity and available models.
 *
 * @param {string} goal - The task goal
 * @param {object} [options]
 * @param {Array<{providerId: string, modelId: string, tier?: string}>} [options.availableModels]
 * @param {object} [options.preferences] - { preferFast: boolean, maxCostTier: string }
 * @returns {{ tier: string, complexity: object, recommendedModel: object|null, reason: string }}
 */
function recommendModel(goal, options = {}) {
  const complexity = analyzeComplexity(goal);
  const { availableModels = [], preferences = {} } = options;

  // If no models provided, return tier recommendation only
  if (availableModels.length === 0) {
    return {
      tier: complexity.tier,
      complexity,
      recommendedModel: null,
      reason: `Task classified as ${complexity.tier} (score: ${complexity.score}). No models available for selection.`,
    };
  }

  // Tag models with tiers if not already tagged
  const taggedModels = availableModels.map(m => ({
    ...m,
    tier: m.tier || inferModelTier(m.modelId),
  }));

  // Filter by max cost tier if specified
  let candidates = taggedModels;
  if (preferences.maxCostTier) {
    const tierOrder = [TIERS.FAST, TIERS.STANDARD, TIERS.POWER];
    const maxIdx = tierOrder.indexOf(preferences.maxCostTier);
    if (maxIdx >= 0) {
      candidates = taggedModels.filter(m => tierOrder.indexOf(m.tier) <= maxIdx);
    }
  }

  // Find best match for the complexity tier
  let recommended = candidates.find(m => m.tier === complexity.tier);

  // Fallback: try adjacent tiers
  if (!recommended) {
    const tierOrder = [TIERS.FAST, TIERS.STANDARD, TIERS.POWER];
    const targetIdx = tierOrder.indexOf(complexity.tier);
    // Try one tier up, then one tier down
    recommended = candidates.find(m => m.tier === tierOrder[Math.min(targetIdx + 1, 2)])
      || candidates.find(m => m.tier === tierOrder[Math.max(targetIdx - 1, 0)])
      || candidates[0];
  }

  return {
    tier: complexity.tier,
    complexity,
    recommendedModel: recommended || null,
    reason: `Task classified as ${complexity.tier} (score: ${complexity.score}, signals: ${complexity.signals.join(", ")}). Recommended: ${recommended ? `${recommended.providerId}/${recommended.modelId}` : "none"}.`,
  };
}

/**
 * Infer model tier from model ID string.
 */
function inferModelTier(modelId) {
  if (!modelId) return TIERS.STANDARD;
  const id = modelId.toLowerCase();

  // Fast/cheap models
  if (/\b(8b|7b|3b|1b|mini|nano|flash|fast|small|lite|haiku)\b/.test(id)) {
    return TIERS.FAST;
  }

  // Power models
  if (/\b(70b|72b|405b|pro|max|ultra|opus|sonnet|deepseek|reasoning|o1|o3|r1)\b/.test(id)) {
    return TIERS.POWER;
  }

  return TIERS.STANDARD;
}

export { analyzeComplexity, recommendModel, inferModelTier, TIERS };
