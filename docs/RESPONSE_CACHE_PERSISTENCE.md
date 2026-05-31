# Response Cache Persistence

## Purpose

Phase 274A adds local response cache persistence for the unified-ai-system
preview cost-saving path. The cache lets repeated benchmark queries reuse a
sanitized local preview response when the query, selected sources, model tier,
model, provider, prompt version, guard version, source selection version, and
output schema version are unchanged.

The goal is to reduce repeated future provider calls before any paid API path
is expanded. This phase does not call MiMo and does not call any paid API.

## Current status

- phase: 274A
- mode: local preview cache persistence
- store type: JSONL local file plus JSON index and summary
- paidApiCallCount: 0
- externalApiCalled: false
- mimoApiCalled: false
- defaultNvidiaChatLaneChanged: false
- mimoSetAsDefault: false

This is a preview-only local cache. It is not a production multi-user cache.

## Why cache persistence matters after 273A

Phase 273A showed that selected minimal source packs can replace naive
full-context packs for many project-status questions. Once source selection is
stable enough to produce small auditable context packs, repeated questions
should be answered from cache before any future provider call is considered.

The intended future order is:

1. normalize query;
2. select sources;
3. build selectedSourcesHash;
4. check response cache;
5. run Token Cost Guard;
6. only then consider an explicit provider call.

## Cache key design

The stable cache key is built from:

- normalized query;
- selectedSourcesHash;
- provider;
- model;
- modelTier;
- promptVersion;
- guardVersion;
- sourceSelectionVersion;
- outputSchemaVersion.

The selectedSourcesHash is based on source path, source version or hash, and
evidence timestamp. Full large context is not placed in the key. API key,
Authorization header, and env values are never placed in the key.

## Cache policy

Default policy:

- enabled: true
- mode: local-preview-persistence
- ttlMs: 604800000
- maxEntries: 500
- maxRecordBytes: 200000
- allowProviders: mimo, nvidia, local
- deny request types: secret, api-key, credential, auth-header
- cacheVersion: phase274a-v1

If a query or response looks like it contains a credential, cacheEligible is
false and no record is written.

## Cache store

The local store writes:

- `apps/ai-gateway-service/evidence/response-cache/response-cache-records.jsonl`
- `apps/ai-gateway-service/evidence/response-cache/response-cache-index.json`
- `apps/ai-gateway-service/evidence/response-cache/response-cache-summary.json`

Records store hashes, selected source hashes, model metadata, sanitized preview
responses, estimated token counts, estimated cost, source evidence paths, and
safety fields. They do not store API secrets, headers, env dumps, or unscreened
full project context.

## Cache lookup/write/invalidate

The cache supports:

- lookup by cacheKey;
- write of sanitized preview records;
- invalidate by cacheKey;
- TTL expiration;
- summary reading;
- listing records for local inspection.

Lookup returns hit only for active non-expired records. Expired and invalidated
records are treated as misses.

## Security and sanitizer

The sanitizer rejects or redacts secret-like text before cache writes. The
policy checks for provider key prefixes, bearer headers, Authorization markers,
api-key markers, and common provider key environment variable names.

This phase does not cache API key. It does not cache Authorization header. It
does not cache env. It does not write real provider credentials to docs,
evidence, UI, or cache files.

## Benchmark cases

The Phase 274A benchmark covers eight local-only cases:

1. repeated project status query hits cache on the second lookup;
2. repeated current blocker query hits cache on the second lookup;
3. repeated MiMo availability query hits cache without calling MiMo;
4. repeated token-saving query hits cache;
5. changed selectedSourcesHash causes a miss;
6. changed promptVersion causes a miss;
7. secret-like query is rejected and skipped;
8. TTL expiration and invalidation cause misses.

## Token saving result

Each hit records estimatedApiTokensSaved and estimatedCostSavedUsd. These are
preview estimates only. They are not provider invoices and do not replace real
cost settlement.

## Limitations

- not a production multi-user cache;
- no tenant isolation;
- no encrypted storage;
- no real provider response cache validation;
- no cross-version cache migration;
- no complete LRU or compaction implementation;
- no real MiMo answer-quality comparison.

## What this does not do

- does not call MiMo
- does not call any paid API
- does not send project context to an external provider
- does not cache API key
- does not cache Authorization header
- does not cache env
- does not become a production multi-user cache
- does not replace billing or cost settlement
- does not change default NVIDIA /chat
- does not set MiMo as default

## Safety boundaries

- paidApiCallCount remains 0.
- externalApiCalled remains false.
- mimoApiCalled remains false.
- no plaintext API key is written.
- no API key is printed.
- default NVIDIA /chat remains unchanged.
- MiMo remains configured but not default.
- no long context is sent to a paid API.
- no large output test is requested.
- no stress test is executed.
- `legacy/` is not modified.
- `PROJECT_CONTEXT.md` is not created.
- no Codex CLI, real Codex exec, workflow runner, worktree, auto commit, or
  auto push is used.

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/cache/responseCacheKey.js
node --check apps/ai-gateway-service/src/cache/responseCacheStore.js
node --check apps/ai-gateway-service/src/cache/responseCachePolicy.js
node --check apps/ai-gateway-service/src/cache/responseCacheBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/runResponseCachePersistenceBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifyResponseCachePersistence.js
cmd /c pnpm run benchmark:response-cache
cmd /c pnpm run verify:phase274a-response-cache-persistence
```

Regression should keep Phase 268A through Phase 273A verified.

## Next phase options

The recommended next route is Phase 275A Model Tier Routing Preview. Cache
persistence reduces repeated calls; model tier routing is the next local
decision layer that can prevent simple tasks from defaulting to expensive
models.
