export const MODEL_TIER_PRICING_USD_PER_1K = {
  local: {
    input: 0,
    output: 0,
  },
  cheap: {
    input: 0.0002,
    output: 0.0008,
  },
  standard: {
    input: 0.002,
    output: 0.006,
  },
  premium: {
    input: 0.01,
    output: 0.03,
  },
};

export function createTokenBudgetPolicy(env = process.env, overrides = {}) {
  const perRequestMaxEstimatedCostUsd = readUsd(env.TOKEN_GUARD_PER_REQUEST_MAX_USD, 0.1);

  return {
    enabled: readBoolean(env.TOKEN_GUARD_ENABLED, true),
    perRequestMaxInputTokens: readInteger(env.TOKEN_GUARD_PER_REQUEST_MAX_INPUT_TOKENS, 16000),
    perRequestMaxOutputTokens: readInteger(env.TOKEN_GUARD_PER_REQUEST_MAX_OUTPUT_TOKENS, 4096),
    perRequestMaxEstimatedCostUsd,
    dailyMaxEstimatedCostUsd: readUsd(env.TOKEN_GUARD_DAILY_MAX_USD, 3),
    requireApprovalAboveUsd: readUsd(env.TOKEN_GUARD_REQUIRE_APPROVAL_USD, 0.03),
    hardBlockAboveUsd: readUsd(env.TOKEN_GUARD_HARD_BLOCK_USD, perRequestMaxEstimatedCostUsd),
    defaultCurrency: "USD",
    defaultModelTier: normalizeModelTier(env.TOKEN_GUARD_DEFAULT_MODEL_TIER, "cheap"),
    modelTierPricingUsdPer1k: MODEL_TIER_PRICING_USD_PER_1K,
    source: "env-token-guard-only-no-api-key-read",
    ...overrides,
  };
}

export function resolveModelTier(modelTier, policy = createTokenBudgetPolicy()) {
  return normalizeModelTier(modelTier, policy.defaultModelTier);
}

export function estimateCostUsd({ inputTokens = 0, outputTokens = 0, modelTier, policy = createTokenBudgetPolicy() } = {}) {
  const tier = resolveModelTier(modelTier, policy);
  const pricing = policy.modelTierPricingUsdPer1k?.[tier] ?? MODEL_TIER_PRICING_USD_PER_1K.cheap;
  const inputCostUsd = roundUsd((Number(inputTokens) / 1000) * pricing.input);
  const outputCostUsd = roundUsd((Number(outputTokens) / 1000) * pricing.output);

  return {
    modelTier: tier,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: roundUsd(inputCostUsd + outputCostUsd),
    currency: policy.defaultCurrency,
    pricingMethod: "static-preview-tier-pricing-no-provider-call",
  };
}

export function roundUsd(value) {
  return Number((Number(value) || 0).toFixed(6));
}

function normalizeModelTier(value, fallback) {
  const tier = String(value || fallback || "cheap").trim().toLowerCase();
  return Object.hasOwn(MODEL_TIER_PRICING_USD_PER_1K, tier) ? tier : "cheap";
}

function readUsd(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function readInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value, fallback) {
  if (typeof value !== "string") return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}
