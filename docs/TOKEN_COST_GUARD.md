# Token Cost Guard

## Purpose

Phase 268A adds a local, preview-only Token Cost Guard for future paid API usage. The goal is to estimate token volume, estimate USD cost, choose a budget decision, recommend context reduction, generate a deterministic cache key, and record a local preview ledger before any future paid provider integration.

This is a protection layer, not a provider integration.

## Why this protects paid API usage

Paid APIs become expensive when long context, repeated requests, high-output caps, or premium models are sent without a preflight. This guard moves the cost decision before the provider boundary:

- estimate input tokens and output tokens before a call
- estimate cost from a local model tier table
- return `allow`, `require_approval`, or `block`
- recommend local retrieval, context trimming, lower model tiers, output caps, and cache reuse
- record preview-only ledger entries for budget visibility

## Current status: preview-only

Current status is preview-only.

- `externalApiCalled=false`
- `paidApiCalled=false`
- `apiKeyRead=false`
- `defaultNvidiaChatLaneChanged=false`
- no real provider call
- no paid API call
- no API key read
- no default NVIDIA `/chat` lane change

Phase 268A only builds the local guard baseline. It does not prove real paid API savings, because no paid API is called.

## What it does

- Estimates tokens with `method="approximate-no-provider-call"`.
- Estimates input cost, output cost, and total cost in USD.
- Applies a local budget policy.
- Supports `local`, `cheap`, `standard`, and `premium` model tier pricing.
- Generates a deterministic cache key from request type, normalized query, selected source hash, model, system prompt version, and guard version.
- Computes a preview savings estimate when selected sources are smaller than raw context.
- Returns recommended actions such as `reduce_context`, `use_knowledge_retrieval_first`, `lower_model_tier`, `cap_output_tokens`, and `use_cache`.
- Records preview ledger rows with `externalApiCalled=false` and `paidApiCalled=false`.

## What it does not do

- It does not call a paid API.
- It does not call any real provider.
- It does not read, print, or store API keys.
- It does not change the default NVIDIA `/chat` lane.
- It does not route `/chat` through the guard automatically.
- It does not run Codex CLI.
- It does not run real Codex exec.
- It does not connect a workflow runner.
- It does not create a worktree.
- It does not auto commit, auto push, or open PRs.
- It is not production-ready billing control.

## API endpoints

All endpoints are preview-only and local to the gateway service.

### `GET /cost/health`

Returns guard health and safety markers:

```json
{
  "success": true,
  "enabled": true,
  "mode": "preview-only",
  "externalApiCalled": false,
  "paidApiCalled": false
}
```

### `POST /cost/estimate`

Accepts `messages`, `rawContextText`, `selectedSources`, `maxOutputTokens`, `model`, and `modelTier`. Returns token estimate, cost estimate, savings estimate, cache metadata, and safety flags. It does not write the ledger and does not call a provider.

### `POST /cost/guard/check`

Runs the full guard decision and appends a preview ledger row. The result contains:

- `decision`: `allow`, `require_approval`, or `block`
- `estimate`: tokens and estimated USD cost
- `savings`: raw context tokens, selected context tokens, estimated tokens saved, and savings ratio
- `cache`: cache key, eligibility, and `servedFromCache=false`
- `recommendedActions`
- `safety`

### `GET /cost/summary`

Reads the preview ledger summary:

```json
{
  "totalEstimateCount": 0,
  "allowedCount": 0,
  "requireApprovalCount": 0,
  "blockedCount": 0,
  "estimatedTotalCostUsd": 0,
  "estimatedTokensSaved": 0,
  "cacheEligibleCount": 0,
  "paidApiCalled": false
}
```

## Budget policy

The policy is local and can read only `TOKEN_GUARD_*` environment variables. It must not read provider API keys.

Supported values:

- `TOKEN_GUARD_ENABLED=true`
- `TOKEN_GUARD_PER_REQUEST_MAX_USD=0.10`
- `TOKEN_GUARD_REQUIRE_APPROVAL_USD=0.03`
- `TOKEN_GUARD_DAILY_MAX_USD=3.00`
- `TOKEN_GUARD_DEFAULT_MODEL_TIER=cheap`
- `TOKEN_GUARD_PER_REQUEST_MAX_INPUT_TOKENS`
- `TOKEN_GUARD_PER_REQUEST_MAX_OUTPUT_TOKENS`
- `TOKEN_GUARD_HARD_BLOCK_USD`

Default fields:

- `perRequestMaxInputTokens`
- `perRequestMaxOutputTokens`
- `perRequestMaxEstimatedCostUsd`
- `dailyMaxEstimatedCostUsd`
- `requireApprovalAboveUsd`
- `hardBlockAboveUsd`
- `defaultCurrency="USD"`

## Token estimation

The estimator has no external dependency and does not use a provider tokenizer. It combines character density, UTF-8 byte density, CJK character count, and Latin word count to produce a conservative preview estimate.

The estimator returns:

- `estimatedInputTokens`
- `estimatedOutputTokens`
- `estimatedTotalTokens`
- `method="approximate-no-provider-call"`
- `confidence="conservative-preview"`

## Context trimming strategy

The guard compares raw context tokens with selected source tokens. If selected source context is smaller than raw context, it reports estimated tokens saved and a savings ratio.

Recommended actions may include:

- `reduce_context`
- `use_knowledge_retrieval_first`
- `local_retrieval_first`
- `split_request`

## Model tier strategy

The preview model tiers are:

- `local`: zero-cost local-only planning or retrieval path
- `cheap`: default future paid API target for ordinary requests
- `standard`: higher quality but budget-sensitive target
- `premium`: highest estimated cost and strongest approval/block pressure

The current guard does not switch models automatically. It only returns a budget-aware recommendation.

## Cache strategy

The cache key includes:

- request type
- normalized user query
- selected sources hash
- model
- system prompt version
- guard version

Phase 268A does not cache model responses. It only produces a deterministic cache key and eligibility flag so future integration can avoid repeat paid calls.

## Ledger / summary

The preview ledger records estimate rows only. Each row includes:

- timestamp
- request type
- provider
- model
- model tier
- estimated input tokens
- estimated output tokens
- estimated cost USD
- decision
- `servedFromCache=false`
- `externalApiCalled=false`
- `paidApiCalled=false`

The default ledger path is `apps/ai-gateway-service/evidence/token-cost-guard-ledger.jsonl`.

## Safety boundaries

Phase 268A preserves these boundaries:

- preview-only
- `externalApiCalled=false`
- `paidApiCalled=false`
- `apiKeyRead=false`
- `defaultNvidiaChatLaneChanged=false`
- no paid API call
- no real provider call
- no API key read
- no default NVIDIA `/chat` lane change
- no Codex CLI
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push/PR
- no release automation
- no production-ready claim

## Verification commands

Run:

```powershell
node --check apps/ai-gateway-service/src/cost/tokenEstimator.js
node --check apps/ai-gateway-service/src/cost/tokenBudgetPolicy.js
node --check apps/ai-gateway-service/src/cost/tokenCostGuard.js
node --check apps/ai-gateway-service/src/cost/tokenCachePolicy.js
node --check apps/ai-gateway-service/src/cost/tokenCostLedger.js
node --check apps/ai-gateway-service/src/entrypoints/verifyTokenCostGuard.js
cmd /c pnpm run verify:phase268a-token-cost-guard
```

The verifier checks allow, require_approval, and block samples; docs, UI, scripts, evidence, safety fields, cache key generation, and savings estimate.

## Future integration path

Recommended future path:

1. Keep `/chat` unchanged until the guard has more manual trial evidence.
2. Add a dry-run metadata attachment to selected future provider flows.
3. Add an explicit approval UI for `require_approval`.
4. Add a response cache only after cache invalidation rules are documented.
5. Add real provider smoke only under a separate approved phase.
6. Keep paid provider calls blocked unless a future user-approved phase enables them.
