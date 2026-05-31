# RAG Source Selection Benchmark

## Purpose

Phase 273A builds a local RAG source selection benchmark for the current
unified-ai-system project. Its goal is to compare naive full-context source
packs with smaller selected context packs, measure estimated token savings,
and detect stale evidence risk before any future paid model call.

This is a local source selection benchmark. It does not ask a model to answer
the benchmark questions, and it does not prove final answer quality.

## Current status

- phase: 273A
- mode: local-source-selection-only
- paidApiCallCount: 0
- externalApiCalled: false
- mimoApiCalled: false
- defaultNvidiaChatLaneChanged: false
- mimoSetAsDefault: false

Phase 268A, 269A, 270A, 271A, and 272A evidence remains the required current
source base. MiMo working model id remains `mimo-v2.5-pro`, but MiMo is still
not the default provider.

## Why source selection matters after 272A

Phase 272A showed that MiMo input token estimation is still conservative work
in progress. The calibration uses only two tiny smoke samples; 272A calibration confidence remains low.

That makes source selection important before any future paid API path:

- avoid sending full project docs when only latest evidence is needed;
- prefer latest passed evidence over stale failed states;
- keep token packs small enough for cache and budget guard policies;
- require explicit selection reasons so humans can review what would be sent.

## Benchmark cases

The benchmark covers eight local-only cases:

1. Current project status.
2. Current blocker.
3. Whether MiMo v2.5 Pro is usable.
4. Whether token saving is currently useful.
5. Why full project docs should not be sent to MiMo.
6. Next step selection.
7. Phase 269A stale failed-state interference.
8. Minimal context for generating the next Codex task.

Each case records `naiveSources`, `selectedSources`, `requiredSources`,
`forbiddenOrStaleSources`, estimated token counts, required source recall,
freshness status, warnings, and a recommended context pack.

## Source selection rules

The initial rule set is deliberately simple and auditable:

- newer phase evidence wins over older summary docs;
- evidence JSON and evidence Markdown outrank broad documentation;
- token-saving questions prioritize 270A and 272A;
- MiMo usability questions prioritize 269A and 271A;
- blocker questions prioritize latest passed or repaired evidence;
- next-step questions prioritize the newest phase conclusion and current
  benchmark summary;
- selected context is capped to a small set of sources per case;
- `legacy/`, `.env`, API key files, and secret-like files are not source
  candidates.

## Freshness guard

The freshness guard checks whether selected sources include the latest relevant
evidence for the query. A case is fresh when required source recall is complete,
latest evidence is selected, and no stale source is selected.

The guard is rule-based. It is not vector retrieval, embedding search, rerank,
or GraphRAG.

## Stale evidence handling

The main stale-risk case is Phase 269A. The original MiMo smoke failed because
the model id was unsupported. Phase 271A discovered `mimo-v2.5-pro` and repaired
that blocker, and the refreshed 269A evidence is passed.

For questions like "269A failed?", source selection may include 269A evidence,
but it must also include 271A repair evidence so the current state is not
misreported as failed.

## Required source recall

Required source recall measures whether each case selected the evidence needed
to answer the question safely.

The target for this phase is full required-source recall across the sample
cases. If any required source is missing, the case must warn or fail.

## Token saving result

The benchmark estimates:

- naive full-context token count;
- selected context token count;
- estimated tokens saved;
- savings ratio;
- total selected-token reduction across cases.

These numbers are estimator outputs only. They are useful for comparing source
pack sizes, but they are not real billing records.

## Gaps

- This is not production vector RAG.
- There is no embedding model or reranker.
- Freshness guard is still rule-based.
- There is no persistent response cache yet.
- Source ranking has not been validated against real answer quality.
- There is no real MiMo answer-quality comparison in this phase.
- The selected context pack is auditable, but it has not been sent to an LLM.

## Recommended next routes

Recommended order:

1. Phase 274A Cache Persistence / response cache persistence.
2. Improve source freshness rules for repaired evidence.
3. Add stricter source-pack diff review.
4. Later, evaluate a small embedding or rerank trial.
5. Later, compare selected source packs against real answer quality with an
   explicitly approved tiny paid calibration.

Phase 274A is the safest next phase because repeated questions can avoid paid
model calls entirely when query, source hash, model tier, and guard version are
unchanged.

## What this does not do

- does not call MiMo
- does not call any paid API
- does not create a production RAG system
- does not perform embedding retrieval
- does not perform reranking
- does not run GraphRAG
- does not validate answers with a real LLM
- does not send project context to any external provider
- does not change default NVIDIA /chat
- does not set MiMo as default

In short: this is not production RAG.

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
node --check apps/ai-gateway-service/src/rag/sourceSelectionBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/runRagSourceSelectionBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifyRagSourceSelectionBenchmark.js
cmd /c pnpm run benchmark:rag-source-selection
cmd /c pnpm run verify:phase273a-rag-source-selection-benchmark
```

Regression commands should also keep Phase 268A through Phase 272A verified.
