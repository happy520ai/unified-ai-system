# Phase 274A Unified System Capability Benchmark

## Benchmark Result

- Status: passed
- Mode: local-evidence-based-benchmark
- Total score: 20 / 100
- Grade: D
- Production readiness: not-production-ready
- Commercial self-use readiness: weak
- Paid API safety readiness: weak
- Paid API calls made in this benchmark: 0
- External API called: false
- MiMo API called: false

## Headline Metrics

- 270A averageSavingsRatio: 0.7445
- 273A averageSavingsRatio: 0
- RAG required source recall: 0
- Latest evidence hit rate: 0
- Stale source selected count: 0
- MiMo working model id: mimo-v2.5-pro
- MiMo usage returned: false
- Token estimator confidence: unknown
- Cache persistence ready: false
- Response cache hit rate: n/a

## Dimension Scores

| Dimension | Score | Max | Main limitation |
| --- | ---: | ---: | --- |
| Token Saving Capability | 2 | 15 | Savings are estimated from local benchmarks, not audited production bills. |
| RAG Source Selection Capability | 3 | 15 | Source selection is rule-based and local. |
| Freshness / Stale Evidence Control | 3 | 10 | Freshness guard is benchmarked with fixed cases, not a full repository-wide temporal reasoner. |
| MiMo Paid Provider Safety | 0 | 10 | MiMo was tested only as an explicit non-default tiny smoke path. |
| Token Estimator Calibration | 0 | 10 | Confidence remains low because only two tiny smoke samples are available. |
| Cost Guard Capability | 0 | 10 | The cost guard is preview-only and does not automatically change the default chat lane. |
| Cache Readiness | 2 | 5 | Cache is local preview persistence only. |
| UI Observability | 0 | 5 | UI panels surface evidence and local status; they do not prove production operations. |
| Regression Stability | 0 | 10 | Workspace is dirty, so this is stability under current local working state, not a clean release baseline. |
| Security / Execution Boundary | 10 | 10 | Boundary safety is evidence-backed for this local preview chain, not a substitute for enterprise security review. |
| Commercial Readiness Gap | 0 | 0 | No multi-user tenant isolation, enterprise key vault, SLA, or audited billing integration is sealed. |
| Next Route Recommendation | 0 | 0 | The route is a local engineering recommendation, not permission to run paid API traffic. |

## Strengths

- Token saving benchmarks show strong local reduction: 270A averageSavingsRatio=0.7445, 273A averageSavingsRatio=0.
- RAG source selection hit required sources with recall=0 and latestEvidenceHitRate=0.
- MiMo v2.5 Pro is verified as an explicit non-default paid provider path with no default NVIDIA /chat switch.
- Token Cost Guard can estimate, budget, require approval, and block before future paid-provider calls.
- Evidence and verifier coverage across 268A-273A is strong for local self-use and paid API preflight.
- Security boundary evidence keeps paid calls, MiMo default switch, Codex CLI, workflow runner, worktree, and auto commit/push disabled for this benchmark.

## Risks

- Workspace is dirty, so operational reporting must not claim a clean release state.
- All token-saving and RAG source-selection gains are local benchmark estimates, not audited production invoices.
- 272A calibration confidence is low because it uses only two tiny MiMo smoke usage samples.
- RAG source selection is rules-based and has no embedding/rerank/real answer-quality validation yet.
- MiMo is safe as a non-default explicit smoke path, but not sealed as production routing or automatic fallback.
- No enterprise ACL sync, multi-tenant isolation, encrypted key vault, or production billing reconciliation is sealed.
- Desktop/Codex execution boundaries remain preview/manual; no unattended development is enabled.
- UI observability is evidence-panel based and still depends on local service/evidence files.
- Provider health does not equal permission to send long context or run paid workloads.
- Commercial readiness remains self-use oriented, not production SaaS readiness.
- Response cache persistence is not sealed in the 268A-273A baseline, so repeat queries may still spend future API tokens.

## Gaps

- No production vector RAG or GraphRAG.
- No real embedding or rerank source selector.
- No production-quality token estimator calibration across long-context workloads.
- No automatic provider routing with approval policy.
- No enterprise key vault or multi-user permission system.
- No audited production cost ledger tied to provider invoices.
- No workflow runner, worktree execution, auto commit, auto push, or PR automation.
- No production response-quality benchmark against real model outputs.
- No clean-release baseline while the workspace remains dirty.
- No production SaaS operations layer, tenant isolation, rate limits, or SLA evidence.
- Response cache persistence should be the next local cost-saving layer before expanding paid API tests.

## Recommended Next Routes

- P0: Phase 275A Response Cache Persistence. Repeat questions are the clearest remaining token-saving opportunity before more paid provider tests.
- P1: Model Tier Routing Preview. Use rule_only / cheap / standard / premium routing so MiMo is reserved for high-value tasks.
- P1: RAG Source Selection Hardening. Improve source ranking beyond fixed rules and verify answer quality against selected context.
- P2: MiMo Usage Calibration Expansion. A few approved tiny requests can calibrate estimator floors without large spend.
- P2: Evidence Dashboard. Expose scorecard, stale-evidence warnings, and safety gates in one review surface.

## Safety

- plainTextApiKeyWritten=false
- apiKeyPrinted=false
- paidApiCallExecuted=false
- externalApiCalled=false
- mimoApiCalled=false
- defaultNvidiaChatLaneChanged=false
- mimoSetAsDefault=false
- longContextSentToPaidApi=false
- largeOutputRequested=false
- stressTestExecuted=false
- codexCliInvoked=false
- codexExecInvoked=false
- workflowRunnerEnabled=false
- worktreeCreated=false
- autoCommit=false
- autoPush=false
