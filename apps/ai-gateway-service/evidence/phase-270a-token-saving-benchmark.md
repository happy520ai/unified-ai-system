# Phase 270A Token Saving Benchmark Evidence

- Phase: 270A-token-saving-benchmark
- Status: passed
- Conclusion: token-saving-benchmark-ready
- Generated at: 2026-07-29T08:21:15.679Z
- Mode: estimate-only
- Default NVIDIA /chat lane changed: false
- MiMo set as default: false
- Paid API call count: 0
- Long context sent to paid API: false

## Summary

- caseCount: 8
- averageSavingsRatio: 0.7445
- maxSavingsRatio: 1
- estimatedTotalNaiveTokens: 699866
- estimatedTotalOptimizedTokens: 10095
- estimatedTotalTokensSaved: 689771
- cacheEligibleCount: 8
- blockedCount: 1
- requireApprovalCount: 0
- modelTierDowngradeOpportunities: 3

## Cases

### project-status-query

- mode: estimate-only
- naiveEstimatedInputTokens: 174679
- optimizedEstimatedInputTokens: 2255
- estimatedTokensSaved: 172424
- savingsRatio: 0.9871
- decision: allow
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: "cheap"
- recommendedActions: use_cache, local_retrieval_first, reduce_context, use_knowledge_retrieval_first

### current-blocker-query

- mode: estimate-only
- naiveEstimatedInputTokens: 185585
- optimizedEstimatedInputTokens: 737
- estimatedTokensSaved: 184848
- savingsRatio: 0.996
- decision: allow
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: "cheap"
- recommendedActions: use_cache, local_retrieval_first, reduce_context, use_knowledge_retrieval_first

### codex-next-task-generation

- mode: estimate-only
- naiveEstimatedInputTokens: 185587
- optimizedEstimatedInputTokens: 2253
- estimatedTokensSaved: 183334
- savingsRatio: 0.9879
- decision: allow
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: "standard"
- recommendedActions: use_cache, local_retrieval_first, reduce_context, use_knowledge_retrieval_first

### mimo-paid-smoke-small-request

- mode: estimate-only
- naiveEstimatedInputTokens: 14
- optimizedEstimatedInputTokens: 14
- estimatedTokensSaved: 0
- savingsRatio: 0
- decision: allow
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: "cheap"
- recommendedActions: use_cache

### repeat-question-cache-hit

- mode: estimate-only-cache-simulation
- naiveEstimatedInputTokens: 667
- optimizedEstimatedInputTokens: 0
- estimatedTokensSaved: 1067
- savingsRatio: 1
- decision: allow
- cacheEligible: true
- servedFromCache: true
- modelTierRecommendation: "cheap"
- recommendedActions: use_cache

### long-context-intercept

- mode: estimate-only
- naiveEstimatedInputTokens: 144040
- optimizedEstimatedInputTokens: 52
- estimatedTokensSaved: 146388
- savingsRatio: 0.9956
- decision: block
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: "block_or_require_approval_before_premium"
- recommendedActions: use_cache, reduce_context, use_knowledge_retrieval_first, cap_output_tokens, lower_model_tier, split_request, use_rag_first

### model-tier-routing

- mode: estimate-only
- naiveEstimatedInputTokens: 62
- optimizedEstimatedInputTokens: 62
- estimatedTokensSaved: 10
- savingsRatio: 0.4435
- decision: allow
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: {"rule_only":"local","cheap":"cheap","standard":"standard","premium":"premium","guidance":"Simple status checks must not default to premium; deep architecture review may justify premium."}
- recommendedActions: lower_model_tier, route_rule_only_locally, reserve_premium_for_architecture_review

### output-cap-control

- mode: estimate-only
- naiveEstimatedInputTokens: 1116
- optimizedEstimatedInputTokens: 1116
- estimatedTokensSaved: 1700
- savingsRatio: 0.5456
- decision: allow
- cacheEligible: true
- servedFromCache: false
- modelTierRecommendation: "cheap"
- recommendedActions: cap_output_tokens, use_cache


## Gaps

- Token estimation is approximate and not yet calibrated with successful MiMo usage because Phase 269A did not return usage.
- Knowledge/RAG selected-context quality is simulated with local snippets; there is not yet an automatic source ranking benchmark.
- Cache policy can generate stable keys, but response cache persistence is not implemented in this benchmark.
- Model tier routing is a recommendation, not yet enforced for the default /chat lane.
- Output cap savings are estimate-only; no long output request was sent or billed.
- Budget decisions are local preview guard decisions, not production billing controls.

## Better Plan

- Route A: Local token guard + benchmark first (do-first) - Keeps risk low while improving estimates, cache policy, UI, and evidence.
- Route C: RAG source selection optimization (do-next) - Reduces the largest waste source: sending broad docs when a few evidence snippets are enough.
- Route D: Cache persistence (do-next) - Turns repeated status/blocker/action questions into zero paid-token repeats when source hashes match.
- Route B: Tiny MiMo usage calibration (do-after-a-c-d) - Use at most three tiny requests to calibrate estimated tokens against provider usage.
- Route E: Model tier routing (do-after-benchmark-policy-hardening) - Prevents simple status and rule-only work from reaching premium paid models.

## Safety

- plainTextApiKeyWritten: false
- apiKeyPrinted: false
- defaultNvidiaChatLaneChanged: false
- mimoSetAsDefault: false
- legacyModified: false
- projectContextCreated: false
- codexCliInvoked: false
- codexExecInvoked: false
- workflowRunnerEnabled: false
- worktreeCreated: false
- autoCommit: false
- autoPush: false
- longContextSentToPaidApi: false
- largeOutputRequested: false
