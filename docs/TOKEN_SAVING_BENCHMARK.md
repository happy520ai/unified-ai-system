# Token Saving Benchmark

## Purpose

Phase 270A creates a local, estimate-only Token Saving Benchmark for the paid API cost-control path. It compares naive full-context prompts with narrower Knowledge/RAG selected-context prompts, cache-hit simulation, model tier routing, output caps, and budget guard decisions.

This phase does not call MiMo, does not change the default NVIDIA `/chat` lane, and does not prove real paid API savings. It creates a repeatable baseline for deciding where token-saving work should go next.

## Current status

The benchmark is preview-only and estimate-only. It relies on the Phase 268A Token Cost Guard estimator and budget policy. Phase 269A MiMo smoke evidence is read only for optional usage comparison; Phase 270A itself keeps `paidApiCallCount=0`.

## Benchmark cases

The benchmark covers eight local sample cases:

- project status query
- current blocker query
- Codex next task generation
- MiMo paid smoke small-request estimate
- repeated question cache simulation
- long context budget interception
- model tier routing
- output length control

Each case records naive estimated input tokens, optimized estimated input tokens, estimated tokens saved, savings ratio, decision, recommended actions, and cache eligibility when applicable.

## Current token-saving capability

The system can already estimate tokens before a request, estimate tier-based cost, generate cache keys, return `allow` / `require_approval` / `block`, recommend context reduction, recommend output caps, and separate simple local/rule-only work from paid-model candidates.

This is useful before paid API integration because it makes cost visible at the request-planning layer instead of after a provider bill appears.

## What this benchmark cannot prove yet

The benchmark cannot prove production billing accuracy, real MiMo savings, or real RAG retrieval quality. The estimator is approximate, source selection is represented by local snippets, cache hits are simulated, and model tier routing is a recommendation rather than enforced production routing.

Because Phase 269A failed with a model-id mismatch and did not return usage, estimated tokens cannot yet be calibrated against successful MiMo usage.

## Most wasteful requests

The most wasteful pattern is sending broad project documentation, README, AGENTS, architecture reports, handoff records, and evidence bundles for questions that only need the latest phase evidence or a small policy snippet.

The benchmark treats status, blocker, and next-task questions as high-savings candidates because they often need only latest evidence, the architecture/readthrough reports, Action Queue, Decision Dashboard, and safety boundaries.

## Best local-only scenarios

These should stay local or rule-only whenever possible:

- checking whether a file exists
- checking whether `legacy/` was modified
- checking whether `PROJECT_CONTEXT.md` exists
- reading latest evidence status
- formatting known safety boundaries
- deciding whether a repeated question can use a cache key

These do not need MiMo v2.5 Pro by default.

## Scenarios that need paid API

Paid API may be useful when the user asks for synthesis that exceeds static rules, such as nuanced architecture tradeoff review, difficult design comparison, or high-quality summary writing after local source selection has already reduced the context.

Even then, the request should pass through Token Cost Guard first and should use a capped output length.

## Scenarios that should use MiMo v2.5 Pro

MiMo v2.5 Pro should be reserved for high-value reasoning tasks after:

- the context has been narrowed by Knowledge/RAG source selection
- the output cap is explicit
- cache lookup has missed
- the budget decision is `allow` or a human approves `require_approval`
- the provider/model id is confirmed by a successful tiny smoke

It should not be used for rule-only checks, repeated cached questions, or broad raw project context dumps.

## Scenarios that should require approval

Require approval when estimated cost exceeds the approval threshold, when premium tier is requested for a non-critical task, when the answer requires a long output, or when the selected context is still broad enough that the local guard recommends more reduction.

Approval is a human cost decision, not a default provider switch.

## Scenarios that should block

Block requests that exceed hard budget, exceed per-request input/output limits, attempt to send long project context to paid API, request large output without a reason, or try to route normal `/chat` traffic to MiMo by default.

Block also applies when an API key would need to be printed, when provider configuration is ambiguous, or when a request would bypass local evidence and safety boundaries.

## Token/cost control interpretation

The benchmark intentionally compares multiple savings mechanisms:

- selected context reduces input tokens
- cache hit simulation removes repeated API tokens
- model tier routing reduces cost even when token count is similar
- output caps reduce completion tokens
- budget guard blocks or requires approval before a paid call

The output is a planning baseline, not production billing proof.

## Route A

Route A: keep improving the local token guard and benchmark before more paid calls.

This is the safest route because it improves estimator quality, UI visibility, benchmark coverage, and evidence without provider cost or model-switch risk.

## Route B

Route B: do an extremely small MiMo usage calibration.

This is useful only after the model-id blocker is resolved. It should use at most three tiny prompts, no project context, output caps at or below 32 tokens, and usage numbers only.

## Route C

Route C: improve RAG source selection.

This is likely the highest token-saving opportunity because most waste comes from sending too much context. Better source ranking can make selected context shorter and more accurate before any paid API call.

## Route D

Route D: add cache persistence.

The current benchmark simulates cache hits and stable cache keys. Persisting responses for the same normalized query, source hash, model, system prompt version, and guard version would prevent repeated paid calls for repeated status/blocker/action questions.

## Route E

Route E: add model tier routing.

The system should separate `rule_only`, `cheap`, `standard`, and `premium`. Simple status checks must not default to premium. MiMo should handle only the high-value tasks that justify a paid provider.

## Recommended route

The conservative recommendation is Route A + Route C + Route D first, then Route B for tiny usage calibration, and Route E as policy hardening after the benchmark data is stable.

Do not start with broad MiMo calls. Do not use project-wide context as the calibration payload.

## Next five optimizations

1. Add a source-selection benchmark that scores selected snippets against the user question.
2. Persist cache entries for repeated questions with stable source hashes.
3. Add UI drill-down for per-case token savings and budget decisions.
4. Resolve the MiMo model-id blocker, then run no more than three tiny usage calibration prompts.
5. Turn model tier recommendations into an explicit preview router policy.

## Safety boundaries

- no MiMo default provider switch
- no default NVIDIA `/chat` lane change
- no paid API call in Phase 270A
- no long project context sent to paid API
- no large output test
- no pressure test
- no plaintext API key in docs or evidence
- no full environment output
- no Codex CLI
- no real Codex exec
- no workflow runner
- no worktree creation
- no auto commit/push
- no production-ready claim

## Evidence output

Benchmark evidence is written to:

- `apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json`
- `apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.md`

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/entrypoints/runTokenSavingBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifyTokenSavingBenchmark.js
cmd /c pnpm run benchmark:token-saving
cmd /c pnpm run verify:phase270a-token-saving-benchmark
```
