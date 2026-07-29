import { createHash } from "node:crypto";
import { createAnswerContract, createStableHash } from "./responseCacheAnswerContract.js";
import { createIntentSignature } from "./responseCacheIntentSignature.js";
import { normalizeCacheQuery } from "./responseCacheLanguageNormalizer.js";
import { createResponseCachePolicy } from "./responseCachePolicy.js";
import { inspectCacheSafety } from "./responseCacheSanitizer.js";

export function createResponseCacheKey(input = {}, options = {}) {
  const policy = options.policy ?? createResponseCachePolicy(input);
  const query = String(input.query ?? input.prompt ?? input.userQuery ?? "");
  const normalized = normalizeCacheQuery({ query });
  const answerContract = input.answerContractHash
    ? { answerContractHash: input.answerContractHash, answerContract: input.answerContract ?? {}, outputSchemaVersion: input.outputSchemaVersion ?? "preview-answer-v1" }
    : createAnswerContract({ ...(input.answerContract ?? {}), query, outputSchemaVersion: input.outputSchemaVersion });
  const intent = createIntentSignature({
    query,
    normalizedQuery: normalized.normalizedQuery,
    queryLanguage: normalized.queryLanguage,
    answerContract: answerContract.answerContract,
  });
  const selectedSourcesHash = input.selectedSourcesHash ?? createStableHash(normalizeSelectedSources(input.selectedSources));
  const latestEvidenceHash = input.latestEvidenceHash ?? createStableHash(input.latestEvidenceSnapshot ?? {});
  const rawQueryHash = sha256(query);
  const normalizedQueryHash = sha256(normalized.normalizedQuery);
  const keyPayload = {
    normalizedQueryHash,
    intentSignature: intent.intentSignature,
    paraphraseGroupId: intent.paraphraseGroupId,
    selectedSourcesHash,
    latestEvidenceHash,
    answerContractHash: answerContract.answerContractHash,
    promptVersion: input.promptVersion ?? "prompt-preview-v1",
    outputSchemaVersion: answerContract.outputSchemaVersion,
    guardVersion: input.guardVersion ?? "phase268a-v1",
    sourceSelectionVersion: input.sourceSelectionVersion ?? "phase273a-v1",
    cachePolicyVersion: input.cachePolicyVersion ?? policy.cachePolicyVersion,
    provider: input.provider ?? input.providerId ?? "local",
    model: input.model ?? input.modelId ?? "preview-model",
    modelTier: input.modelTier ?? "local",
    userScope: input.userScope ?? "local-single-user",
  };
  const safety = inspectCacheSafety(input);
  const cacheEligible = Boolean(policy.enabled && safety.cacheEligible);

  return {
    cacheKey: `response-cache:${createStableHash(keyPayload)}`,
    queryHash: normalizedQueryHash,
    rawQueryHash,
    normalizedQueryHash,
    selectedSourcesHash,
    latestEvidenceHash,
    answerContractHash: answerContract.answerContractHash,
    intentSignature: intent.intentSignature,
    paraphraseGroupId: intent.paraphraseGroupId,
    queryLanguage: normalized.queryLanguage,
    normalizedQuery: normalized.normalizedQuery,
    cacheEligible,
    cacheEligibilityReason: cacheEligible ? "eligible" : safety.rejectionReason ?? "policy_disabled",
  };
}

function normalizeSelectedSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources.map((source) => typeof source === "string" ? { path: source } : {
    path: source.path ?? source.file ?? "unknown",
    version: source.version ?? source.hash ?? source.evidenceTimestamp ?? "preview",
    status: source.status ?? "unknown",
  });
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
