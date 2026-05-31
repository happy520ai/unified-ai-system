# Response Cache Persistence Hardening

## Purpose

Phase 275A hardens the local response cache preview so repeated questions can be evaluated with deterministic cache rules before any future paid provider call. The goal is auditable local persistence, safe duplicate judgment, secret rejection, freshness checks, intent-level soft-hit candidates, and a disabled semantic judge slot.

## Current status

Current status is local preview hardening. This phase does not call MiMo. This phase does not call any paid API. This phase does not change default NVIDIA /chat. This phase does not set MiMo as default.

## Why cache hardening matters after Phase 274A

Phase 274A produced an evidence-based system capability benchmark and identified cache persistence as the next conservative cost-saving route. Cache hardening matters because repeated local self-use questions should be checked against deterministic context, source version, answer contract, and safety boundaries before spending tokens.

## Duplicate question definition

A duplicate question is not just similar text. In this phase, duplicate means the same intent, same selected source snapshot, same latest evidence state, same answer contract, same prompt and guard versions, same provider/model/tier, same user scope, and a valid TTL.

The cache reuse question is not "do these two strings look similar". It is "can this cached answer still be safely reused now".

## Intent-level cache hit optimization

The long-term core goal is to maximize safe intent-level cache hit rate across paraphrases and multilingual queries. Higher hit rate should come from intentSignature, paraphraseGroupId, and multilingual normalization. Correctness still depends on selectedSourcesHash, latestEvidenceHash, answerContractHash, freshnessGuard, userScope, provider/model/tier, and sanitizer checks.

intent_soft_hit is preview-only. multilingual_intent_soft_hit is preview-only. They are candidates and do not force servedFromCache=true. They cannot bypass the deterministic safety gate.

## Multilingual and paraphrase handling

The local preview normalizer supports lightweight zh, en, ja, mixed, and unknown language labels without translation, embedding, MiMo, paid API, semantic model, or LLM judge. The rule map recognizes a small set of common project-status, blocker, MiMo availability, token-saving, next-step, Codex-task, cache-summary, system-score, paid-API-safety, and production-readiness phrasings.

This is not production multilingual NLP. It is a deterministic preview slot for improving cache-hit candidates while keeping hard safety gates unchanged.

## Cache hit levels

The cache decision levels are no_cache, exact_hit, normalized_hit, intent_soft_hit, multilingual_intent_soft_hit, stale_miss, and hard_miss.

- no_cache rejects dangerous or unverifiable cache use.
- exact_hit may serve from cache when raw query and deterministic context match.
- normalized_hit may serve from cache when normalized text and deterministic context match.
- intent_soft_hit is only a candidate and does not serve from cache.
- multilingual_intent_soft_hit is only a candidate and does not serve from cache.
- stale_miss protects current-state answers when evidence, source selection, ready state, blocker, TTL, or invalidation changes.
- hard_miss protects changes in answer contract, prompt version, output schema, provider, model, tier, user scope, or unknown intent.

## Cache key design

The stable key is based on normalizedQueryHash, intentSignature, paraphraseGroupId, selectedSourcesHash, latestEvidenceHash, answerContractHash, promptVersion, outputSchemaVersion, guardVersion, sourceSelectionVersion, cachePolicyVersion, provider, model, modelTier, and userScope. It uses Node built-in SHA-256. It does not put full long context, API key material, Authorization header, api-key header, or env contents into the key.

exact_hit and normalized_hit use the full cache key. intent_soft_hit and multilingual_intent_soft_hit may look for candidates by intentSignature, paraphraseGroupId, selectedSourcesHash, latestEvidenceHash, and answerContractHash, but they still remain preview-only and cannot directly serve cache.

## Intent signature

responseCacheIntentSignature.js provides deterministic rule signatures for project_current_status, current_blocker, mimo_availability, token_saving_capability, next_step_recommendation, codex_task_generation, cache_summary, system_capability_score, paid_api_safety, and production_readiness.

Unknown intent becomes unknown_intent and cannot become an intent soft hit.

## Answer contract

The answer contract records task type, output format, required sections, language, detail level, citation requirement, command-template requirement, code requirement, table requirement, and final-format request. If the same query asks for a different answer contract, the result is a hard_miss.

## Freshness guard

Current-state queries such as current, latest, today, next, blocker, passed, ready, available, status, now, and equivalent Chinese/Japanese terms require latest evidence checks. latestEvidenceHash covers latest phase, latest evidence status, latest verifier status, current blocker, ready state, and workspace dirty state. When those change, cache must stale_miss.

## Selected source hash

selectedSourcesHash is built from source path, evidence timestamp/status, source version, and source hash. If selected source versions change, cache must stale_miss.

## Latest evidence hash

latestEvidenceHash captures the current evidence snapshot. It is a guard against stale answers such as treating an old failed smoke result as the current state after later repair evidence passed.

## Semantic judge slot

The semantic judge slot is reserved but disabled. semanticModelEnabled=false. semanticJudgeAvailable=false. No embedding, MiMo, paid API, semantic model, or LLM judge is called.

## Why semantic judge is not final authority

Semantic or intent similarity can suggest preview candidates, but semanticDecisionUsedAsFinalAuthority=false. intent_soft_hit and multilingual_intent_soft_hit are preview-only and cannot serve from cache. Final decisions are made by deterministic_rules.

## Cache policy

The policy mode is local-preview-hardening with ttlMs=604800000, maxEntries=500, cachePolicyVersion=phase275a-v1, semanticModelEnabled=false, allowIntentSoftHit=true, allowMultilingualIntentSoftHit=true, and allowSemanticHardHit=false. This is not a production multi-user cache.

## Cache store

The local store writes sanitized JSONL records, an index, a summary, and an audit trail under apps/ai-gateway-service/evidence/response-cache. It is local preview persistence only and is not encrypted, multi-tenant, or enterprise permission isolated.

## Sanitizer and secret rejection

The sanitizer rejects cache writes when query or response-like text appears to contain provider secrets, Authorization header, api-key header, password/token/secret markers, or env file content. The cache record keeps hashes and sanitized previews only.

## Audit trail

Lookup, write, reject, invalidate, expire, and soft_hit events are appended to response-cache-audit-trail.jsonl. Audit events record decision, hit type, duplicate confidence, reason, cache key, intentSignature, queryLanguage, servedFromCache, servedFromCachePreviewOnly, freshness and TTL validity, and paid/external call flags.

## Benchmark cases

The benchmark covers at least 16 local cases: exact_hit, normalized_hit, Chinese intent_soft_hit, English intent_soft_hit, Chinese/English multilingual_intent_soft_hit, Chinese/Japanese multilingual_intent_soft_hit, latest evidence stale_miss, selected source stale_miss, prompt version hard_miss, answer contract hard_miss, model tier hard_miss, no_cache secret rejection, ready state stale_miss, TTL expired stale_miss, invalidated record stale_miss, and unknown_intent hard_miss.

## Token saving result

The benchmark estimates saved API tokens only for deterministic served cache hits. It does not claim real production savings and does not replace provider billing or usage records.

## Limitations

The cache is local preview hardening, not production-ready. It has no multi-user permission isolation, no encrypted-at-rest secret vault, no real provider response quality validation, no cross-version migration, no full LRU compaction, no real embedding semantic cache, and no LLM judge. Rule-based multilingual intent remains preview-only and is not production semantic understanding.

## What this does not do

This phase does not call MiMo. This phase does not call any paid API. This phase does not call embedding. This phase does not call a semantic model. This phase does not call an LLM judge. This phase does not cache API key material. This phase does not cache Authorization header. This phase does not cache api-key header. This phase does not cache env contents. This phase does not cache full unscreened long context. This phase does not change default NVIDIA /chat. This phase does not set MiMo as default. This phase does not provide production multi-user cache, production semantic cache, or safe production multilingual strong reuse.

## Safety boundaries

paidApiCallCount=0, externalApiCalled=false, mimoApiCalled=false, defaultNvidiaChatLaneChanged=false, mimoSetAsDefault=false, semanticModelEnabled=false, semanticDecisionUsedAsFinalAuthority=false, longContextSentToPaidApi=false, codexCliInvoked=false, codexExecInvoked=false, workflowRunnerEnabled=false, worktreeCreated=false, autoCommit=false, and autoPush=false.

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/cache/responseCacheKey.js
node --check apps/ai-gateway-service/src/cache/responseCachePolicy.js
node --check apps/ai-gateway-service/src/cache/responseCacheStore.js
node --check apps/ai-gateway-service/src/cache/responseCacheSanitizer.js
node --check apps/ai-gateway-service/src/cache/responseCacheDuplicateJudge.js
node --check apps/ai-gateway-service/src/cache/responseCacheAnswerContract.js
node --check apps/ai-gateway-service/src/cache/responseCacheFreshnessGuard.js
node --check apps/ai-gateway-service/src/cache/responseCacheAuditTrail.js
node --check apps/ai-gateway-service/src/cache/responseCacheIntentSignature.js
node --check apps/ai-gateway-service/src/cache/responseCacheLanguageNormalizer.js
node --check apps/ai-gateway-service/src/cache/responseCacheBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/runResponseCacheHardeningBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifyResponseCacheHardening.js
cmd /c pnpm run benchmark:response-cache-hardening
cmd /c pnpm run verify:phase275a-response-cache-hardening
```

## Next phase options

The recommended next phase is Phase 276A Model Tier Routing Preview. After deterministic cache hardening, the next conservative cost gate should decide which tasks are rule_only, local, cheap, standard, or premium before any paid provider call.
