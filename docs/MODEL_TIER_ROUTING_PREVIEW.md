# Model Tier Routing Preview

## Purpose
Phase 276A adds an Answer Path Router preview for unified-ai-system. The goal is to choose the lowest-cost safe answer path before any model is considered.

## Current status
Phases 268A through 274A are required upstream evidence. Phase 275A cache hardening is used when its evidence is present and passed. MiMo working model id remains `mimo-v2.5-pro`, but MiMo is not the default provider.

## Why anti-model-dependency matters
The system should not default to a large model for every request. It should first ask whether local rules, latest evidence, cache, or RAG selected context are enough. The best path is accurate enough, low cost, auditable, within boundary, and reversible.

## Answer path definitions
- `rule_only`: local rules and evidence answer the request.
- `cache_only`: deterministic exact or normalized cache hit answers the request.
- `rag_local`: local selected source pack is enough.
- `cheap_model`: future low-cost model suggestion for low-risk wording work.
- `standard_model`: future standard model suggestion for medium complexity.
- `premium_mimo`: MiMo premium recommendation for high-value complex tasks.
- `require_approval`: human confirmation required before a paid or high-cost path.
- `block`: request violates budget, secret, context, default-provider, or execution boundary.
- `review_cache_candidate`: soft cache candidate that must not be served as final cache.

## Model tier definitions
- `rule_only`: no model.
- `cache`: deterministic cache result.
- `local`: local evidence or RAG path.
- `cheap`: low-risk formatting or short summary suggestion.
- `standard`: medium complexity preview suggestion.
- `premium`: MiMo premium recommendation only.
- `none`: blocked or not applicable.

## Routing policy
The policy version is `phase276a-v1`. The default answer path is `rule_only`. The premium provider is `mimo`, premium model is `mimo-v2.5-pro`, and `premiumModelDefault=false`.

## How cache / RAG / token guard affect routing
Token Guard can force `block` or `require_approval`. Phase 273A source selection lets status and evidence questions use `rag_local`. Phase 275A cache hardening allows `cache_only` only for exact or normalized deterministic hits. Intent soft hits remain review candidates.

## Why MiMo is premium and non-default
MiMo is reserved for high-value complex reasoning. This phase does not set MiMo as default and does not change the default NVIDIA `/chat` lane.

## When to use rule_only
Use `rule_only` for current blocker, simple phase status, yes/no safety answers, and default-provider boundary checks when local evidence is sufficient.

## When to use cache_only
Use `cache_only` only when cache hardening reports `exact_hit` or `normalized_hit`. Soft hits must not become final cache hits in this phase.

## When to use rag_local
Use `rag_local` for questions that need multiple latest evidence files, such as project status, MiMo availability, token saving capability, and next route explanations.

## When to recommend cheap_model
Recommend `cheap_model` for low-risk wording cleanup, simple formatting, or short summaries. This phase does not call that model.

## When to recommend standard_model
Recommend `standard_model` for structured medium-complexity drafting such as a Codex command template when local evidence is needed but MiMo is not justified. This phase does not call that model.

## When to recommend premium_mimo
Recommend `premium_mimo` for high-value complex architecture, commercial route, or broad decision analysis. Premium MiMo must require approval and must not be called by this preview.

## When to require approval
Use `require_approval` when Token Guard asks for approval, a premium paid path is recommended, or estimated cost or output size needs explicit confirmation.

## When to block
Use `block` for secret-like input, long context to paid models, default provider switching, legacy modification, PROJECT_CONTEXT creation, Codex execution, workflow runner, worktree, auto commit or push, and production readiness overclaims.

## Benchmark cases
The benchmark covers current project status, blocker, MiMo availability, token saving, business report, simple formatting, Codex command template, long-context-to-MiMo, secret-like query, default-provider change, cache exact hit, cache soft hit, Token Guard block, Token Guard approval, complex roadmap, and production readiness claim.

## Token saving impact
The router estimates avoided tokens by choosing rule, cache, RAG, approval, or block paths without making any provider call. These are local estimates, not production billing results.

## What this does not do
This phase does not call MiMo. This phase does not call any paid API. This phase does not call embedding or a semantic model. This phase does not automatically choose and execute a model. This phase is not production routing.

## Safety boundaries
This phase does not read or write real API keys. It writes no plaintext key to docs, evidence, UI, logs, or cache. It does not change NVIDIA `/chat`. It does not set MiMo as default. It does not send project context to any external API.

## Verification commands
```powershell
node --check apps/ai-gateway-service/src/routing/modelTierRouter.js
node --check apps/ai-gateway-service/src/routing/answerPathClassifier.js
node --check apps/ai-gateway-service/src/routing/modelTierPolicy.js
node --check apps/ai-gateway-service/src/routing/modelTierRoutingCases.js
node --check apps/ai-gateway-service/src/routing/modelTierRoutingBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/runModelTierRoutingBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifyModelTierRoutingPreview.js
cmd /c pnpm run benchmark:model-tier-routing
cmd /c pnpm run verify:phase276a-model-tier-routing-preview
```

## Next phase options
The recommended next phase is Phase 277A Paid API Preflight Orchestrator. It should connect cache, RAG, Token Guard, Model Tier, and Approval Gate into one preflight flow while still avoiding paid API expansion.
