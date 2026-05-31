const REDACTED_SECRET_QUERY = ["my", "credential", "is", `${"sk"}${"-test-redacted-preview"}`, "please", "analyze"].join(" ");

export function createQualityCostRoutingCases({ cacheHardeningAvailable = true } = {}) {
  return [
    caseItem("current-project-status", "What is the current project status?", "status", { answerPaths: ["rag_local", "rule_only"], requiresPaidApi: false }, latestStatusSources()),
    caseItem("current-blocker", "What is the current blocker?", "blocker", { answerPath: "rule_only", requiresPaidApi: false }, latestStatusSources(), { currentBlocker: "none" }),
    caseItem("mimo-availability", "Can we use MiMo v2.5 Pro now?", "provider-status", { answerPaths: ["rag_local", "rule_only"], requiresPaidApi: false }, [
      source("apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json", "passed"),
      source("apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json", "passed"),
    ]),
    caseItem("token-saving-capability", "Can this system save tokens now?", "token-saving", { answerPath: "rag_local", requiresPaidApi: false }, [
      source("apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json", "passed"),
      source("apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json", "passed"),
      source("apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json", "passed"),
      source("apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json", "passed"),
    ]),
    caseItem("full-business-report", "Based on the whole system, write a very detailed commercialization business report.", "business-report", {
      answerPaths: ["premium_model", "require_approval"],
      modelTier: "premium",
      requiresPaidApi: true,
      requiresApproval: true,
      providerAgnostic: true,
    }, [], { maxOutputTokens: 2000, riskLevel: "high", requestedQualityLevel: "high" }),
    caseItem("simple-format-conversion", "Rewrite this summary into three concise sentences.", "formatting", {
      answerPaths: ["cheap_model", "rule_only"],
      notModelTier: "premium",
      notProvider: "mimo",
    }, [], { maxOutputTokens: 300 }),
    caseItem("codex-command-template", "Generate the next complete Codex command template.", "codex-template", {
      answerPaths: ["rag_local", "standard_model"],
      requiresPaidApi: false,
    }, latestStatusSources()),
    caseItem("send-all-docs-to-mimo", "Send all project docs to MiMo for analysis.", "forbidden-long-context-paid", {
      answerPath: "block",
      blockReason: "long_context_to_paid_api_forbidden",
    }, [], { rawContextText: "preview-long-context-placeholder" }),
    caseItem("secret-like-query", "secret-like query redacted for evidence", "secret", {
      answerPath: "block",
      blockReason: "secret_detected",
    }, [], { unsafeQueryForRoutingOnly: REDACTED_SECRET_QUERY }),
    caseItem("set-mimo-default", "Set the default /chat provider to MiMo.", "provider-change", {
      answerPath: "block",
      blockReason: "default_provider_change_forbidden_in_this_phase",
    }),
    caseItem("cache-exact-hit", "What is the current project status?", "cache-hit", cacheHardeningAvailable
      ? { answerPath: "cache_only", requiresPaidApi: false, servedFromCache: true }
      : { answerPaths: ["rag_local", "rule_only"], requiresPaidApi: false }, latestStatusSources(), {
      cacheLookup: cacheHardeningAvailable
        ? { cacheDecision: "hit", cacheHitType: "exact_hit", servedFromCache: true }
        : { cacheDecision: "miss", cacheHitType: "hard_miss", servedFromCache: false },
      cacheDependencyLimited: !cacheHardeningAvailable,
    }),
    caseItem("cache-intent-soft-hit", "Where are we in the project?", "cache-soft-hit", {
      answerPaths: ["review_cache_candidate", "rag_local"],
      requiresPaidApi: false,
      servedFromCache: false,
    }, latestStatusSources(), {
      cacheLookup: { cacheDecision: "soft_hit", cacheHitType: "intent_soft_hit", servedFromCache: false, servedFromCachePreviewOnly: true },
    }),
    caseItem("token-guard-block", "Generate an oversized paid model output.", "budget-block", {
      answerPath: "block",
      blockReason: "budget_guard_block",
    }, [], { tokenGuard: createTokenGuardDecision("block", "budget_guard_block", 6024, 0.18) }),
    caseItem("token-guard-require-approval", "Use an advanced model for an expensive analysis.", "budget-require-approval", {
      answerPath: "require_approval",
      requiresApproval: true,
    }, [], { tokenGuard: createTokenGuardDecision("require_approval", "estimated_cost_requires_human_approval", 4994, 0.08994) }),
    caseItem("complex-architecture-roadmap", "Design the next three months of technical roadmap and commercialization roadmap for this system.", "complex-roadmap", {
      answerPaths: ["premium_model", "require_approval"],
      modelTier: "premium",
      requiresPaidApi: true,
      requiresApproval: true,
      providerAgnostic: true,
    }, [], { maxOutputTokens: 1800, riskLevel: "high", requestedQualityLevel: "high" }),
    caseItem("production-saas-claim", "Tell me this system is already production SaaS ready to sell publicly.", "production-claim", {
      answerPath: "block",
      blockReason: "production_ready_claim_forbidden",
    }),
    caseItem("near-perfect-architecture-decision", "This final architecture decision must be near perfect and cannot be wrong.", "expert-quality", {
      answerPaths: ["expert_model", "multi_model_review"],
      requiresApproval: true,
      qualityGateRequired: true,
      providerAgnostic: true,
    }, [], { requestedQualityLevel: "near_perfect", riskLevel: "critical" }),
    caseItem("multi-model-cross-validation", "Please cross validate this commercialization conclusion with multiple models before answering.", "multi-model-review", {
      answerPath: "multi_model_review",
      requiresPaidApi: true,
      requiresApproval: true,
      modelActuallyCalled: false,
    }, [], { requestedQualityLevel: "high", riskLevel: "high" }),
    caseItem("budget-limited-good-quality", "The budget is limited, but I still want the answer quality to be as good as possible.", "quality-cost-tradeoff", {
      answerPaths: ["rag_local", "standard_model"],
      progressiveEscalationEnabled: true,
      notModelTier: "premium",
    }, latestStatusSources(), { budgetPreference: "minimize_cost", requestedQualityLevel: "high" }),
    caseItem("default-most-expensive-model", "From now on all questions should use the most expensive strongest model by default.", "wasteful-premium-default", {
      answerPath: "block",
      blockReason: "wasteful_premium_default_forbidden",
    }),
  ];
}

function caseItem(caseId, query, requestType, expected, selectedSources = [], extra = {}) {
  return {
    caseId,
    query,
    requestType,
    selectedSources,
    expected,
    ...extra,
  };
}

function latestStatusSources() {
  return [
    source("apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json", "passed"),
    source("apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json", "passed"),
    source("apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json", "passed"),
  ];
}

function source(path, status) {
  return {
    path,
    status,
    sourceVersion: "phase276a-quality-cost-routing-preview",
    sourceHash: path,
    evidenceTimestamp: "2026-04-30T00:00:00.000Z",
  };
}

function createTokenGuardDecision(decision, reason, totalTokens, totalCostUsd) {
  return {
    decision,
    reasons: [reason],
    estimate: {
      inputTokens: Math.max(1, totalTokens - 1024),
      outputTokens: Math.min(1024, totalTokens),
      totalTokens,
      totalCostUsd,
      currency: "USD",
      modelTier: "premium",
      method: "simulated-token-guard-preview",
      confidence: "conservative-preview",
    },
    cache: {
      cachePersistenceAvailable: true,
      cachePolicyVersion: "phase275a-v1",
      semanticDecisionUsedAsFinalAuthority: false,
    },
  };
}
