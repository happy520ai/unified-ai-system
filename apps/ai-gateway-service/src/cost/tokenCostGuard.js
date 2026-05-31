import { createTokenBudgetPolicy, estimateCostUsd, resolveModelTier } from "./tokenBudgetPolicy.js";
import { createTokenCachePolicy } from "./tokenCachePolicy.js";
import { readLatestMimoTokenCalibrationProfile } from "./tokenEstimatorCalibration.js";
import { estimateTextTokens, estimateTokens } from "./tokenEstimator.js";
import { createResponseCacheKey } from "../cache/responseCacheKey.js";
import { createResponseCachePolicy } from "../cache/responseCachePolicy.js";

export function checkTokenCostGuard(input = {}, options = {}) {
  const policy = options.policy ?? createTokenBudgetPolicy();
  const modelTier = resolveModelTier(input.modelTier, policy);
  const requestType = input.requestType ?? "chat-preview";
  const rawContextText = typeof input.rawContextText === "string" ? input.rawContextText : "";
  const selectedContextText = collectSelectedSourceText(input.selectedSources);
  const effectiveContextText = selectedContextText || rawContextText;
  const messages = normalizeMessages(input.messages);
  const estimatorInput = {
    messages,
    text: effectiveContextText,
    maxOutputTokens: input.maxOutputTokens,
  };
  const tokenEstimate = estimateTokens(estimatorInput);
  const calibrationPreview = readLatestMimoTokenCalibrationProfile({
    provider: input.provider,
    model: input.model,
  });
  const rawContextTokens = estimateTextTokens(rawContextText);
  const selectedContextTokens = estimateTextTokens(effectiveContextText);
  const estimatedTokensSaved = Math.max(0, rawContextTokens - selectedContextTokens);
  const cost = estimateCostUsd({
    inputTokens: tokenEstimate.estimatedInputTokens,
    outputTokens: tokenEstimate.estimatedOutputTokens,
    modelTier,
    policy,
  });
  const cache = createTokenCachePolicy({
    requestType,
    messages,
    rawContextText,
    selectedSources: input.selectedSources,
    model: input.model ?? "default-model",
    systemPromptVersion: input.systemPromptVersion,
  });
  const responseCachePolicy = createResponseCachePolicy();
  const responseCache = createResponseCacheKey({
    query: input.userQuery ?? extractLastUserMessage(messages) ?? rawContextText,
    selectedSources: input.selectedSources,
    selectedSourcesHash: input.selectedSourcesHash,
    provider: input.provider ?? "local",
    model: input.model ?? "default-model",
    modelTier,
    promptVersion: input.promptVersion ?? input.systemPromptVersion ?? "prompt-preview-v1",
    guardVersion: input.guardVersion ?? "phase268a-v1",
    sourceSelectionVersion: input.sourceSelectionVersion ?? "phase273a-v1",
    outputSchemaVersion: input.outputSchemaVersion ?? "preview-answer-v1",
  }, { policy: responseCachePolicy });
  const decisionContext = decide({
    policy,
    inputTokens: tokenEstimate.estimatedInputTokens,
    outputTokens: tokenEstimate.estimatedOutputTokens,
    totalCostUsd: cost.totalCostUsd,
    dailyEstimatedSpendUsd: options.dailyEstimatedSpendUsd,
    userApprovedHighCost: input.userApprovedHighCost,
  });
  const recommendedActions = recommendActions({
    decision: decisionContext.decision,
    rawContextTokens,
    selectedContextTokens,
    outputTokens: tokenEstimate.estimatedOutputTokens,
    modelTier,
    cacheEligible: cache.cacheEligible,
    policy,
  });

  return {
    enabled: policy.enabled,
    mode: "preview-only",
    decision: decisionContext.decision,
    reasons: decisionContext.reasons,
    policy: {
      defaultCurrency: policy.defaultCurrency,
      defaultModelTier: policy.defaultModelTier,
      perRequestMaxInputTokens: policy.perRequestMaxInputTokens,
      perRequestMaxOutputTokens: policy.perRequestMaxOutputTokens,
      perRequestMaxEstimatedCostUsd: policy.perRequestMaxEstimatedCostUsd,
      dailyMaxEstimatedCostUsd: policy.dailyMaxEstimatedCostUsd,
      requireApprovalAboveUsd: policy.requireApprovalAboveUsd,
      hardBlockAboveUsd: policy.hardBlockAboveUsd,
    },
    estimate: {
      inputTokens: tokenEstimate.estimatedInputTokens,
      outputTokens: tokenEstimate.estimatedOutputTokens,
      totalTokens: tokenEstimate.estimatedTotalTokens,
      inputCostUsd: cost.inputCostUsd,
      outputCostUsd: cost.outputCostUsd,
      totalCostUsd: cost.totalCostUsd,
      currency: cost.currency,
      modelTier,
      method: tokenEstimate.method,
      confidence: tokenEstimate.confidence,
    },
    calibrationPreview,
    savings: {
      rawContextTokens,
      selectedContextTokens,
      estimatedTokensSaved,
      estimatedSavingsRatio: rawContextTokens > 0 ? Number((estimatedTokensSaved / rawContextTokens).toFixed(4)) : 0,
    },
    cache: {
      cacheKey: cache.cacheKey,
      cacheEligible: cache.cacheEligible,
      servedFromCache: false,
      reason: cache.reason,
      cachePersistenceAvailable: responseCachePolicy.enabled,
      cachePolicyVersion: responseCachePolicy.cacheVersion,
      cacheHardeningPreview: true,
      cacheMode: responseCachePolicy.mode,
      semanticModelEnabled: responseCachePolicy.semanticModelEnabled,
      semanticJudgeAvailable: responseCachePolicy.semanticJudgeAvailable,
      semanticDecisionUsedAsFinalAuthority: responseCachePolicy.semanticDecisionUsedAsFinalAuthority,
      responseCacheKey: responseCache.cacheKey,
      responseCacheEligible: responseCache.cacheEligible,
      responseCacheEligibilityReason: responseCache.cacheEligibilityReason,
      intentSignature: responseCache.intentSignature,
      paraphraseGroupId: responseCache.paraphraseGroupId,
      queryLanguage: responseCache.queryLanguage,
      selectedSourcesHash: responseCache.selectedSourcesHash,
      latestEvidenceHash: responseCache.latestEvidenceHash,
      answerContractHash: responseCache.answerContractHash,
    },
    recommendedActions,
    safety: {
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
      defaultNvidiaChatLaneChanged: false,
    },
  };
}

function decide({ policy, inputTokens, outputTokens, totalCostUsd, dailyEstimatedSpendUsd = 0, userApprovedHighCost }) {
  if (!policy.enabled) {
    return {
      decision: "allow",
      reasons: ["token_guard_disabled_preview_policy"],
    };
  }

  const blockReasons = [];
  const approvalReasons = [];

  if (inputTokens > policy.perRequestMaxInputTokens) {
    blockReasons.push("input_tokens_exceed_per_request_limit");
  }

  if (outputTokens > policy.perRequestMaxOutputTokens) {
    blockReasons.push("output_tokens_exceed_per_request_limit");
  }

  if (totalCostUsd > policy.perRequestMaxEstimatedCostUsd || totalCostUsd >= policy.hardBlockAboveUsd) {
    blockReasons.push("estimated_cost_exceeds_hard_or_per_request_limit");
  }

  if (dailyEstimatedSpendUsd + totalCostUsd > policy.dailyMaxEstimatedCostUsd) {
    blockReasons.push("estimated_daily_budget_exceeded");
  }

  if (blockReasons.length) {
    return {
      decision: "block",
      reasons: blockReasons,
    };
  }

  if (totalCostUsd >= policy.requireApprovalAboveUsd && !userApprovedHighCost) {
    approvalReasons.push("estimated_cost_requires_human_approval");
  }

  if (approvalReasons.length) {
    return {
      decision: "require_approval",
      reasons: approvalReasons,
    };
  }

  return {
    decision: "allow",
    reasons: [userApprovedHighCost ? "human_approval_recorded_preview_only" : "within_preview_budget"],
  };
}

function recommendActions({ decision, rawContextTokens, selectedContextTokens, outputTokens, modelTier, cacheEligible, policy }) {
  const actions = [];

  if (cacheEligible) {
    actions.push("use_cache");
  }

  if (rawContextTokens > 0 && selectedContextTokens < rawContextTokens) {
    actions.push("local_retrieval_first");
  }

  if (rawContextTokens > policy.perRequestMaxInputTokens * 0.55 || selectedContextTokens > policy.perRequestMaxInputTokens * 0.5) {
    actions.push("reduce_context");
    actions.push("use_knowledge_retrieval_first");
  }

  if (outputTokens > Math.min(1024, policy.perRequestMaxOutputTokens * 0.5)) {
    actions.push("cap_output_tokens");
  }

  if (["standard", "premium"].includes(modelTier) && decision !== "allow") {
    actions.push("lower_model_tier");
  }

  if (decision === "block") {
    actions.push("split_request");
  }

  return [...new Set(actions)];
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && typeof message.content === "string")
    .map((message) => ({
      role: typeof message.role === "string" ? message.role : "user",
      content: message.content,
    }));
}

function collectSelectedSourceText(selectedSources) {
  if (!Array.isArray(selectedSources) || selectedSources.length === 0) {
    return "";
  }

  return selectedSources
    .map((source) => {
      if (typeof source === "string") return source;
      if (!source || typeof source !== "object") return "";
      return [source.title, source.snippet, source.content, source.text].filter((value) => typeof value === "string").join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function extractLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";

  return [...messages]
    .reverse()
    .find((message) => message?.role !== "assistant" && typeof message?.content === "string")
    ?.content ?? "";
}
