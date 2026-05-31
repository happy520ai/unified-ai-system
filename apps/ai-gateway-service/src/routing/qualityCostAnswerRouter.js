import { createAnswerContract } from "../cache/responseCacheAnswerContract.js";
import { evaluateResponseCacheFreshness } from "../cache/responseCacheFreshnessGuard.js";
import { createIntentSignature } from "../cache/responseCacheIntentSignature.js";
import { createResponseCacheKey } from "../cache/responseCacheKey.js";
import { normalizeCacheQuery } from "../cache/responseCacheLanguageNormalizer.js";
import { inspectCacheSafety } from "../cache/responseCacheSanitizer.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import { classifyAnswerPath } from "./answerPathClassifier.js";
import { evaluateAnswerQualityGate } from "./answerQualityGatePreview.js";
import { createModelTierRoutingPolicy, createRoutingSafety } from "./modelTierPolicy.js";
import { createProgressiveEscalation } from "./progressiveEscalationPolicy.js";
import { createProviderAgnosticModelCatalog, listPremiumCandidates } from "./providerAgnosticModelCatalog.js";

export function routeQualityCostAnswer(input = {}, options = {}) {
  const catalog = options.catalog ?? createProviderAgnosticModelCatalog();
  const policy = options.policy ?? createModelTierRoutingPolicy({
    routerType: "provider-agnostic-quality-cost",
    providerAgnostic: true,
    singleProviderLocked: false,
    defaultPremiumProvider: null,
    premiumCandidates: listPremiumCandidates(catalog),
  });
  const query = String(input.query ?? "");
  const normalized = normalizeCacheQuery({ query });
  const answerContractResult = input.answerContract?.answerContractHash
    ? {
      answerContract: input.answerContract.answerContract ?? input.answerContract,
      answerContractHash: input.answerContract.answerContractHash,
      outputSchemaVersion: input.answerContract.outputSchemaVersion ?? input.outputSchemaVersion ?? "quality-cost-preview-v1",
    }
    : createAnswerContract({
      ...(input.answerContract ?? {}),
      query,
      outputSchemaVersion: input.outputSchemaVersion ?? "quality-cost-preview-v1",
    });
  const intentResult = createIntentSignature({
    query,
    normalizedQuery: normalized.normalizedQuery,
    queryLanguage: normalized.queryLanguage,
    answerContract: answerContractResult.answerContract,
  });
  const sanitizerResult = inspectCacheSafety({
    query,
    requestPreview: input.requestPreview,
    rawContextText: input.rawContextText,
  });
  const selectedSources = input.selectedSources ?? input.sourceSelection?.selectedSources ?? [];
  const latestEvidenceSnapshot = input.latestEvidenceSnapshot ?? createDefaultLatestEvidenceSnapshot(input);
  const cacheKey = createResponseCacheKey({
    query,
    selectedSources,
    selectedSourcesHash: input.selectedSourcesHash,
    latestEvidenceSnapshot,
    answerContract: answerContractResult.answerContract,
    answerContractHash: answerContractResult.answerContractHash,
    provider: input.provider ?? "local",
    model: input.model ?? "quality-cost-preview-model",
    modelTier: input.modelTier ?? "local",
    promptVersion: input.promptVersion ?? "phase276a-quality-cost-prompt-v1",
    outputSchemaVersion: answerContractResult.outputSchemaVersion,
    guardVersion: input.guardVersion ?? "phase268a-v1",
    sourceSelectionVersion: input.sourceSelectionVersion ?? "phase273a-v1",
    cachePolicyVersion: input.cachePolicyVersion ?? "phase275a-v1",
    userScope: input.userScope ?? "local-single-user",
    intentSignature: intentResult.intentSignature,
    paraphraseGroupId: intentResult.paraphraseGroupId,
    queryLanguage: normalized.queryLanguage,
  });
  const freshness = evaluateResponseCacheFreshness({
    query,
    latestEvidenceSnapshot,
    latestEvidenceHash: cacheKey.latestEvidenceHash,
  });
  const qualityGate = evaluateAnswerQualityGate({
    query,
    intentSignature: intentResult.intentSignature,
    answerContract: answerContractResult.answerContract,
    selectedSources,
    evidenceStatus: latestEvidenceSnapshot.latestEvidenceStatus,
    freshnessStatus: freshness.freshnessValid ? "fresh" : "stale",
    requestedQualityLevel: input.requestedQualityLevel,
    riskLevel: input.riskLevel,
    outputRequirements: input.outputRequirements,
    requiresFreshness: freshness.freshnessRequired,
  });
  const tokenGuard = input.tokenGuard ?? checkTokenCostGuard({
    requestType: input.requestType ?? "quality-cost-routing-preview",
    userQuery: query,
    messages: [{ role: "user", content: query }],
    selectedSources,
    rawContextText: input.rawContextText ?? "",
    maxOutputTokens: input.maxOutputTokens ?? 512,
    provider: input.provider ?? "local",
    model: input.model ?? "quality-cost-preview-model",
    modelTier: input.modelTier ?? "cheap",
    promptVersion: input.promptVersion ?? "phase276a-quality-cost-prompt-v1",
    sourceSelectionVersion: input.sourceSelectionVersion ?? "phase273a-v1",
    outputSchemaVersion: answerContractResult.outputSchemaVersion,
  });
  const cacheLookup = input.cacheLookup ?? {
    cacheDecision: "miss",
    cacheHitType: "hard_miss",
    servedFromCache: false,
    servedFromCachePreviewOnly: false,
  };
  const classification = classifyAnswerPath({
    ...input,
    query,
    normalizedQuery: normalized.normalizedQuery,
    intentSignature: intentResult.intentSignature,
    answerContract: answerContractResult.answerContract,
    cacheDecision: cacheLookup.cacheDecision,
    cacheHitType: cacheLookup.cacheHitType,
    costGuardDecision: tokenGuard.decision,
    tokenGuard,
    containsSecret: sanitizerResult.containsSecret,
    sanitizerResult,
    requestedQualityLevel: input.requestedQualityLevel,
    riskLevel: input.riskLevel,
    providerAgnostic: true,
  }, policy);
  const progressiveEscalation = createProgressiveEscalation({
    currentPath: classification.answerPath,
    shouldBlock: classification.shouldBlock,
    escalationReason: qualityGate.escalationRecommended ? qualityGate.qualityReason : undefined,
  });
  const selectedProvider = classification.providerRecommendation === "none" ? "none" : classification.providerRecommendation;
  const selectedModel = classification.modelRecommendation ?? "none";

  return {
    routingPolicyVersion: policy.routingPolicyVersion,
    routerType: "provider-agnostic-quality-cost",
    providerAgnostic: true,
    singleProviderLocked: false,
    qualityGoal: policy.qualityGoal,
    mode: "local-quality-cost-routing-preview-only",
    answerPath: classification.answerPath,
    modelTier: classification.modelTier,
    selectedProvider,
    selectedModel,
    providerRecommendation: classification.providerRecommendation,
    modelRecommendation: selectedModel,
    premiumCandidates: listPremiumCandidates(catalog),
    defaultPremiumProvider: null,
    providerDefaultChanged: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    requiresPaidApi: classification.requiresPaidApi,
    requiresApproval: classification.requiresApproval,
    shouldBlock: classification.shouldBlock,
    blockReason: classification.blockReason,
    routingReason: classification.routingReason,
    confidence: classification.confidence,
    reasonCodes: classification.reasonCodes,
    recommendedActions: [
      ...classification.recommendedActions,
      ...(qualityGate.qualityGateRequired ? ["run_answer_quality_gate_preview"] : []),
      "use_minimum_necessary_tokens",
    ],
    answerQualityGate: qualityGate,
    progressiveEscalation,
    tokenEstimate: {
      inputTokens: tokenGuard.estimate?.inputTokens ?? 0,
      outputTokens: tokenGuard.estimate?.outputTokens ?? 0,
      totalTokens: tokenGuard.estimate?.totalTokens ?? 0,
      method: tokenGuard.estimate?.method ?? "approximate-no-provider-call",
      confidence: tokenGuard.estimate?.confidence ?? "conservative-preview",
    },
    costEstimate: {
      totalCostUsd: tokenGuard.estimate?.totalCostUsd ?? 0,
      currency: tokenGuard.estimate?.currency ?? "USD",
    },
    cacheDecision: cacheLookup.cacheDecision,
    cacheHitType: cacheLookup.cacheHitType,
    servedFromCache: classification.servedFromCache,
    servedFromCachePreviewOnly: classification.servedFromCachePreviewOnly,
    cacheMetadata: {
      cacheKey: cacheKey.cacheKey,
      cacheEligible: cacheKey.cacheEligible,
      cacheEligibilityReason: cacheKey.cacheEligibilityReason,
      selectedSourcesHash: cacheKey.selectedSourcesHash,
      latestEvidenceHash: cacheKey.latestEvidenceHash,
      answerContractHash: cacheKey.answerContractHash,
      cachePersistenceAvailable: input.cacheHardeningAvailable ?? true,
      cachePolicyVersion: "phase275a-v1",
      strongCacheHitRequired: true,
      softHitServedFromCache: false,
      semanticDecisionUsedAsFinalAuthority: false,
    },
    sourceSelectionSummary: {
      sourceSelectionUsed: classification.sourceSelectionUsed || Boolean(input.sourceSelection?.available),
      sourceSelectionAvailable: input.sourceSelection?.available ?? true,
      selectedSourceCount: selectedSources.length,
      sourceSelectionVersion: input.sourceSelectionVersion ?? "phase273a-v1",
    },
    tokenGuard: {
      tokenGuardUsed: true,
      decision: tokenGuard.decision,
      reasons: tokenGuard.reasons ?? [],
      cache: tokenGuard.cache ?? {},
    },
    intent: {
      intentSignature: intentResult.intentSignature,
      paraphraseGroupId: intentResult.paraphraseGroupId,
      queryLanguage: normalized.queryLanguage,
      intentConfidence: intentResult.intentConfidence,
      semanticModelUsed: false,
    },
    freshness,
    answerContract: {
      answerContractHash: answerContractResult.answerContractHash,
      outputSchemaVersion: answerContractResult.outputSchemaVersion,
      answerContract: answerContractResult.answerContract,
    },
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    modelActuallyCalled: false,
    safety: createRoutingSafety(),
    audit: {
      finalDecisionBy: "deterministic_rules",
      routerType: "provider-agnostic-quality-cost",
      classifier: "answerPathClassifier",
      policyVersion: policy.routingPolicyVersion,
      providerAgnostic: true,
      singleProviderLocked: false,
      paidApiNotCalled: true,
      externalApiCalled: false,
      mimoApiCalled: false,
      modelActuallyCalled: false,
      defaultNvidiaChatLaneChanged: false,
      mimoSetAsDefault: false,
    },
  };
}

function createDefaultLatestEvidenceSnapshot(input = {}) {
  return {
    latestPhase: input.latestPhase ?? "275A",
    latestEvidenceStatus: input.latestEvidenceStatus ?? "passed",
    latestVerifierStatus: input.latestVerifierStatus ?? "passed",
    currentBlocker: input.currentBlocker ?? "none",
    readyState: input.readyState ?? "preview-ready",
    workspaceDirtyState: input.workspaceDirtyState ?? "dirty-or-unknown",
  };
}
