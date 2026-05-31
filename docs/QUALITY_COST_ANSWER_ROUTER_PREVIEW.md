# Phase 276A Provider-Agnostic Quality-Cost Answer Router Preview

## Purpose

Phase 276A defines a provider-agnostic answer router preview. The goal is to choose the lowest necessary cost path that can still satisfy the user request with a good experience, evidence awareness, and safety boundaries.

This phase does not call MiMo, does not call any paid API, and does not call any model.

## Current status

The current upstream baseline is:

- 268A Token Cost Guard passed.
- 269A MiMo paid API safe smoke passed.
- 270A Token Saving Benchmark passed.
- 271A MiMo Model ID Discovery passed.
- 272A Token Estimator Calibration passed with low confidence.
- 273A RAG Source Selection Benchmark passed.
- 274A Unified System Capability Benchmark passed.
- 275A Response Cache Persistence Hardening is used when its evidence is present and passed; otherwise cache-only routing is marked dependency-limited.

The system remains not-production-ready. MiMo working model id is `mimo-v2.5-pro`, but MiMo is not the default route and the default NVIDIA `/chat` lane is unchanged.

## Why provider-agnostic routing matters

The router must not lock the project to one premium provider. MiMo is a known working premium candidate, but future OpenAI-compatible, Claude-compatible, OpenRouter-compatible, local, cheap, standard, premium, and expert candidates may all fit different tasks.

Provider-agnostic routing keeps the decision focused on quality, cost, evidence, and risk instead of vendor preference.

## Why anti-model-dependency matters

Many user questions can be answered from local evidence, deterministic rules, selected source packs, or cache records. Calling a model by default wastes tokens and can increase risk.

The router therefore prefers:

1. `rule_only`
2. `cache_only`
3. `rag_local`
4. `cheap_model`
5. `standard_model`
6. `premium_model`
7. `expert_model`
8. `multi_model_review`
9. `require_approval`
10. `block`

## Perfect UX + minimum necessary tokens

The target is best possible answer quality with minimum necessary token cost. This does not mean the current system has perfect UX. It means the routing preview records a policy for balancing user experience, evidence reliability, safety, and token cost.

The router should avoid both extremes: always using the strongest model, and always choosing the cheapest path when quality would suffer.

## Answer path definitions

`rule_only` answers from deterministic local facts, latest evidence summaries, and hard safety boundaries.

`cache_only` serves only deterministic cache hits such as exact or normalized hits after freshness, answer contract, source hash, and safety checks. Intent or semantic soft hits are not cache-only.

`rag_local` uses selected local evidence and source-selection metadata without paid model calls.

`cheap_model` is a preview recommendation for low-risk rewrite, formatting, or short summarization. It is not executed in this phase.

`standard_model` is a preview recommendation for medium-complexity analysis or structured composition. It is not executed in this phase.

`premium_model` is a preview recommendation for high-value complex reasoning. It requires approval and Token Guard preflight.

`expert_model` is a preview recommendation for very high accuracy, professional audit, or critical material. It requires approval and a quality gate.

`multi_model_review` is a preview recommendation for high-risk conclusions needing cross-provider review. It requires approval and is not executed here.

`require_approval` stops before paid or high-cost paths and asks the user for explicit confirmation.

`block` stops unsafe or out-of-bound requests.

## Model tier definitions

The tier labels are `rule_only`, `cache`, `local`, `cheap`, `standard`, `premium`, `expert`, `multi_model`, and `none`.

Tiers describe an answer path recommendation. They do not execute a provider in this phase.

## Provider-agnostic model catalog

The preview catalog is provider-agnostic and not single-provider locked:

- cheap candidates: future cheap OpenAI-compatible, OpenRouter-compatible, and local small model paths.
- standard candidates: future standard OpenAI-compatible, Claude-compatible, and OpenRouter-compatible paths.
- premium candidates: `mimo-v2.5-pro`, future OpenAI premium compatible, future Claude premium compatible, and future OpenRouter premium compatible paths.
- expert candidates: future expert model and future multi-provider expert review paths.

`defaultPremiumProvider` is `null`. MiMo is only one premium candidate.

## Quality-cost routing policy

The policy version is `phase276a-v1`.

The default answer path is `rule_only`. Paid, premium, expert, and multi-model review paths require approval. Cache, RAG, and rule-only paths are preferred before model recommendations.

The policy is preview-only and does not perform real routing execution.

## Answer quality gate preview

The Answer Quality Gate Preview is a local rule check. It considers:

- whether the answer addresses the real question;
- whether latest evidence is required;
- whether evidence references are required;
- whether a Codex command template is required;
- whether a commercialization report structure is required;
- whether a production readiness claim needs correction;
- whether high accuracy is required;
- whether stale evidence could mislead;
- whether a paid model is required;
- whether human confirmation is required.

It does not call an LLM judge.

## Progressive escalation

The router escalates gradually:

`rule_only -> cache_only -> rag_local -> cheap_model -> standard_model -> premium_model -> expert_model -> multi_model_review -> require_approval`

High-cost paths require approval before escalation. Unsafe requests can go directly to `block`.

## How cache / RAG / token guard affect routing

Token Guard can force `block` or `require_approval`.

RAG source selection makes `rag_local` the preferred path for project status, blocker, evidence explanation, route recommendations, and Codex template generation.

Cache hardening enables `cache_only` only for deterministic exact or normalized hits. Intent or semantic soft hits remain review candidates and cannot bypass freshness, evidence, answer contract, or safety gates.

## Why MiMo is only one premium candidate

MiMo is a working premium candidate through `mimo-v2.5-pro`, but it is not the default provider, not the default premium provider, and not the only advanced path. This keeps the router open to future provider choices and avoids unnecessary dependency on one vendor.

## When to use rule_only

Use `rule_only` for current blocker, phase completion status, default provider boundary, simple yes/no status, and correction of unsupported production claims.

## When to use cache_only

Use `cache_only` when Phase 275A cache hardening is available and the cache result is an exact or normalized hit with valid freshness, source hash, answer contract, TTL, and sanitizer checks.

## When to use rag_local

Use `rag_local` when selected local evidence is enough, especially for project state, token saving explanation, MiMo availability explanation, next-route suggestions, and Codex command templates.

## When to recommend cheap_model

Recommend `cheap_model` for low-risk rewrite, formatting, tone cleanup, and short summarization. Do not recommend premium for these tasks.

## When to recommend standard_model

Recommend `standard_model` for medium-complexity composition or analysis where local RAG is helpful but not enough. This is still a preview recommendation.

## When to recommend premium_model

Recommend `premium_model` for high-value complex reasoning, architecture tradeoffs, business reports, and important reviews. It must require approval and must not assume MiMo is the only option.

## When to recommend expert_model

Recommend `expert_model` for very high accuracy, professional audit, final architecture decisions, legal-style summaries, financial-style summaries, security reviews, or requests that explicitly ask for near-perfect accuracy. It must require approval.

## When to recommend multi_model_review

Recommend `multi_model_review` for high-risk critical conclusions where cross-provider review would reduce risk. This phase does not call multiple models.

## When to require approval

Require approval before paid calls, premium models, expert models, multi-model review, high estimated cost, large outputs, or other high-risk paths.

## When to block

Block secret-like requests, long-context-to-paid-model requests, default provider change requests, requests to modify `legacy/`, requests to create `PROJECT_CONTEXT.md`, Codex CLI or real Codex exec requests, workflow runner requests, worktree requests, auto commit or auto push requests, production-ready false claims, and requests to default every question to the most expensive model.

## Benchmark cases

The local benchmark covers 20 cases:

- current project status;
- current blocker;
- MiMo availability;
- token saving capability;
- detailed commercialization report;
- simple format conversion;
- Codex command template;
- full project docs to MiMo block;
- secret-like query block;
- default MiMo provider change block;
- cache exact hit;
- cache intent soft hit;
- Token Guard block;
- Token Guard require approval;
- complex architecture roadmap;
- production SaaS claim correction;
- near-perfect architecture decision;
- multi-model cross validation;
- budget-limited quality tradeoff;
- default most expensive model rejection.

## Token saving impact

The router avoids model calls for rule-only, cache-only, and local RAG paths. It also requires approval before paid, premium, expert, or multi-model review paths. Estimated token avoidance is benchmark metadata only, not production billing proof.

## UX quality impact

The preview improves user experience by selecting a path that is sufficient for the task instead of blindly minimizing cost or blindly maximizing model power. Quality gates and progressive escalation make high-quality answers possible without making the most expensive model the default.

## What this does not do

This phase does not call MiMo.

This phase does not call any paid API.

This phase does not call OpenAI, Claude, OpenRouter, DataEyes, embedding, a semantic model, an LLM judge, or any model.

This phase does not change the default NVIDIA `/chat` lane.

This phase does not set MiMo as default.

This phase does not set any single provider as the default premium provider.

This phase does not prove production routing or production readiness.

This phase does not prove user experience is truly perfect.

## Safety boundaries

- `paidApiCallCount=0`
- `externalApiCalled=false`
- `mimoApiCalled=false`
- `modelActuallyCalled=false`
- `providerAgnostic=true`
- `singleProviderLocked=false`
- `defaultPremiumProvider=null`
- `defaultNvidiaChatLaneChanged=false`
- `mimoSetAsDefault=false`
- no plaintext API key values in docs, evidence, logs, UI, or cache
- no long project context sent to any paid API
- no Codex CLI
- no real Codex exec
- no workflow runner
- no worktree
- no auto commit or auto push
- no `legacy/` modification
- no `PROJECT_CONTEXT.md`

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/routing/qualityCostAnswerRouter.js
node --check apps/ai-gateway-service/src/routing/answerPathClassifier.js
node --check apps/ai-gateway-service/src/routing/modelTierPolicy.js
node --check apps/ai-gateway-service/src/routing/providerAgnosticModelCatalog.js
node --check apps/ai-gateway-service/src/routing/answerQualityGatePreview.js
node --check apps/ai-gateway-service/src/routing/progressiveEscalationPolicy.js
node --check apps/ai-gateway-service/src/routing/qualityCostRoutingCases.js
node --check apps/ai-gateway-service/src/routing/qualityCostRoutingBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/runQualityCostRoutingBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifyQualityCostRoutingPreview.js
cmd /c pnpm run benchmark:quality-cost-routing
cmd /c pnpm run verify:phase276a-quality-cost-routing-preview
```

## Next phase options

Recommended next route: Phase 277A Paid API Preflight Orchestrator.

The next step should wire cache, RAG, Token Guard, Quality-Cost Router, and Approval Gate into one local preflight orchestrator. It should still avoid expanding paid API usage.
