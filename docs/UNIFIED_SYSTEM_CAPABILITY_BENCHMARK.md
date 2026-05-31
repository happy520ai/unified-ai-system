# Unified System Capability Benchmark

## Executive Summary

Phase 274A is a local, evidence-based professional capability benchmark for unified-ai-system. It reads existing evidence from Phase 268A through Phase 273A, plus optional local safety and value-closure evidence, and produces a conservative scorecard for current system capability.

This benchmark made no paid API call, did not call MiMo, did not read or print any API key, did not change the default NVIDIA `/chat` lane, and did not send project context to any external API.

The current system is strong for local self-use, token/cost preflight, RAG source-selection preview, and controlled paid-provider safety review. It remains `not-production-ready`.

## Scorecard

The scorecard is 100-point and evidence-based:

| Dimension | Max |
| --- | ---: |
| Token Saving Capability | 15 |
| RAG Source Selection | 15 |
| Freshness / Stale Evidence Control | 10 |
| MiMo Paid Provider Safety | 10 |
| Token Estimator Calibration | 10 |
| Cost Guard Capability | 10 |
| Cache Readiness | 5 |
| UI Observability | 5 |
| Regression Stability | 10 |
| Security / Execution Boundary | 10 |

Grade rules:

- A: totalScore >= 85. Strong local self-use capability, still `not-production-ready`.
- B: totalScore 70-84. Strong preview baseline with important gaps.
- C: totalScore 55-69. Useful but key capability gaps remain.
- D: totalScore < 55. Do not expand paid API usage.

## Headline Metrics

The machine-readable evidence records the exact current values:

- 270A token saving averageSavingsRatio.
- 273A RAG source-selection averageSavingsRatio.
- RAG required source recall.
- Latest evidence hit rate.
- Stale source selected count.
- MiMo working model id.
- MiMo usageReturned status.
- Token estimator confidence.
- Cache persistence readiness.
- Response cache hit rate when a local preview cache evidence exists.

## Dimension-by-dimension Assessment

Each score is backed by local evidence. Preview-only capability is scored as preview capability, not as production capability. The benchmark does not promote MiMo to default, does not call any provider, and does not grant execution permission.

## Token Saving Capability

Evidence:

- `apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json`
- `apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json`

What is strong:

- 270A compares naive full-context token cost against optimized context, cache, model-tier, output-cap, and budget-guard scenarios.
- 273A shows selected source packs can be much smaller than naive context packs.
- Both phases are local benchmark or estimate-only and record no paid API call.

Limitations:

- Estimated savings are not provider invoice savings.
- The benchmark does not prove final answer quality after context trimming.

## RAG Source Selection Capability

Evidence:

- `apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json`

What is strong:

- Required-source recall and latest evidence hit rate are measured.
- Stale evidence selection is explicitly tracked.
- The benchmark checks that old 269A failure state is covered by newer 271A repair and refreshed 269A evidence.

Limitations:

- This is local source selection only.
- There is no production vector RAG, GraphRAG, embedding rerank, or real answer-quality evaluation in this phase.

## MiMo Paid Provider Safety

Evidence:

- `apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json`
- `apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json`

What is strong:

- MiMo v2.5 Pro working model id is recorded as `mimo-v2.5-pro`.
- Safe tiny smoke evidence exists for an explicit non-default provider path.
- API key presence is masked/present only in the earlier smoke flow.
- Default NVIDIA `/chat` remains unchanged.

Limitations:

- MiMo is not a default route.
- This is not production provider routing, automatic fallback, or multi-provider scheduling.

## Token Estimator Calibration

Evidence:

- `apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json`

What is strong:

- 272A reads existing 269A/271A usage only.
- It produces estimate-vs-actual comparison, safety multiplier, and token floor.
- It made no new paid API call.

Limitations:

- Confidence is low.
- Only two tiny smoke usage samples exist.
- The calibration profile is preview metadata, not production billing accuracy.

## Cache Readiness

Evidence:

- `apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json`
- `apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json`
- `apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json`
- If present locally: `apps/ai-gateway-service/evidence/phase-274a-response-cache-persistence.json`

What is strong:

- Cache key metadata exists in Token Cost Guard.
- 270A and 273A identify cache as a high-value savings route.
- A local preview cache evidence may exist in this workspace and is scored only as preview readiness.

Limitations:

- This benchmark does not turn cache into production multi-user cache.
- It does not prove encrypted storage, tenant isolation, cache migration, or real provider response quality.

## UI Observability

Evidence:

- `apps/ai-gateway-service/src/ui/consolePage.js`

Expected visible panels:

- Token Cost Guard.
- Token Saving Benchmark.
- MiMo Model ID Discovery.
- Token Estimator Calibration.
- RAG Source Selection Benchmark.
- Unified System Capability Benchmark.

Limitations:

- UI panels are observability surfaces over local evidence.
- They do not prove production operations.

## Regression Stability

Evidence:

- 268A through 273A verifier results.
- `health:phase12a`
- `doctor:phase13a`
- `pnpm -r --if-present check`

The benchmark records regression stability as strong only when the source evidence is passed and the verification commands are run successfully in the current local workspace.

Operational risk:

- The workspace is dirty. This does not directly invalidate local benchmark capability, but it prevents any claim that the workspace is clean.

## Security Boundary

Evidence:

- `apps/ai-gateway-service/evidence/phase-107a-secret-safety.json`
- 268A through 273A safety fields.

Current boundary:

- No paid API call in this benchmark.
- No MiMo API call in this benchmark.
- No default NVIDIA `/chat` change.
- No MiMo default switch.
- No long paid-context call.
- No large output test.
- No stress test.
- No Codex CLI.
- No real Codex exec.
- No workflow runner.
- No worktree.
- No auto commit/push.
- No plaintext API key written.

## Commercial Self-use Readiness

The system is strong for local self-use and controlled paid API preflight:

- It can estimate token cost before future paid calls.
- It can select smaller evidence packs.
- It can detect stale evidence risk.
- It can keep MiMo explicit and non-default.
- It can present evidence in UI panels.

This is not production SaaS readiness.

## Production Readiness Gap

The system is `not-production-ready` because it still lacks:

- Multi-tenant auth and tenant isolation.
- Enterprise key vault.
- Enterprise ACL sync.
- Production vector RAG or GraphRAG.
- Audited provider billing reconciliation.
- Production cache encryption and lifecycle governance.
- Workflow runner and execution isolation.
- SLA, rate limits, audit retention, and release operations.

## Top 10 Risks

1. Workspace is dirty and cannot be described as clean.
2. Token savings are estimate benchmark results, not provider invoice results.
3. Token estimator calibration confidence is low.
4. RAG source selection is rules-based.
5. No real embedding/rerank quality validation is sealed.
6. MiMo is safe only as explicit non-default smoke/provider path.
7. Cache readiness is preview/local and not production multi-user caching.
8. No enterprise secret vault or ACL integration.
9. No workflow runner/worktree execution boundary is enabled.
10. UI observability depends on local evidence files staying fresh.

## Top 10 Next Improvements

1. Seal Response Cache Persistence before expanding paid API usage.
2. Add cache lookup before any future paid provider call.
3. Add sanitizer and invalidation policy for cached responses.
4. Add model-tier routing preview.
5. Expand MiMo calibration with a few explicit tiny approved requests.
6. Add RAG source ranking/rerank experiments without paid long context.
7. Add evidence freshness dashboard.
8. Add selected-context quality evaluation against known answers.
9. Add stronger cost ledger reconciliation.
10. Add clearer UI no-go/go status for paid API paths.

## Recommended Next Route

Recommended next route: Phase 275A Response Cache Persistence.

Reason: repeated questions are the safest next token-saving target. Cache lookup should happen before any future paid provider call, so repeated selected-source prompts can avoid spending tokens. This is safer than continuing paid API smoke expansion.

If a local response-cache preview artifact is already present in the workspace, Phase 275A should harden and seal that path rather than broaden paid API traffic.

## What this benchmark does not prove

- It does not prove production SaaS readiness.
- It does not prove production vector RAG or GraphRAG.
- It does not prove provider invoice savings.
- It does not prove production token estimator accuracy.
- It does not prove long-context MiMo quality.
- It does not prove automatic multi-provider routing.
- It does not grant permission to call paid APIs.
- It does not grant permission to run Codex CLI, workflow runner, worktrees, commit, push, or PR automation.

## Verification Commands

Required commands:

```powershell
node --check apps/ai-gateway-service/src/benchmarks/systemCapabilityBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/runSystemCapabilityBenchmark.js
node --check apps/ai-gateway-service/src/entrypoints/verifySystemCapabilityBenchmark.js
node --check apps/ai-gateway-service/src/ui/consolePage.js
cmd /c pnpm run benchmark:system-capability
cmd /c pnpm run verify:phase274a-system-capability-benchmark
cmd /c pnpm run verify:phase273a-rag-source-selection-benchmark
cmd /c pnpm run verify:phase272a-token-estimator-calibration
cmd /c pnpm run verify:phase271a-mimo-model-id-discovery
cmd /c pnpm run verify:phase270a-token-saving-benchmark
cmd /c pnpm run verify:phase269a-mimo-paid-api-safe-smoke
cmd /c pnpm run verify:phase268a-token-cost-guard
cmd /c pnpm run verify:phase255a-personal-knowledge-value-closure
cmd /c pnpm run verify:phase245a-personal-value-closure
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```
