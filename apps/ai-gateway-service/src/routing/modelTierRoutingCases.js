const REDACTED_SECRET_QUERY = ["my", "credential", "is", `${"sk"}${"-test-redacted-preview"}`, "please", "analyze"].join(" ");

export function createModelTierRoutingCases({ cacheHardeningAvailable = true } = {}) {
  return [
    {
      caseId: "current-project-status",
      query: "现在项目做到哪一步了？",
      requestType: "status",
      expected: { answerPaths: ["rag_local", "rule_only"], requiresPaidApi: false },
      selectedSources: latestStatusSources(),
    },
    {
      caseId: "current-blocker",
      query: "当前 blocker 是什么？",
      requestType: "blocker",
      expected: { answerPath: "rule_only", requiresPaidApi: false },
      currentBlocker: "none",
      selectedSources: latestStatusSources(),
    },
    {
      caseId: "mimo-availability",
      query: "MiMo v2.5 Pro 现在能用了吗？",
      requestType: "provider-status",
      expected: { answerPaths: ["rag_local", "rule_only"], requiresPaidApi: false },
      selectedSources: [
        source("apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json", "passed"),
        source("apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json", "passed"),
      ],
    },
    {
      caseId: "token-saving-capability",
      query: "系统现在到底能不能帮我省 token？",
      requestType: "token-saving",
      expected: { answerPath: "rag_local", requiresPaidApi: false },
      selectedSources: [
        source("apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json", "passed"),
        source("apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json", "passed"),
        source("apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json", "passed"),
        source("apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json", "passed"),
      ],
    },
    {
      caseId: "full-business-report",
      query: "基于整个系统，给我写一份非常详细的商业化报告。",
      requestType: "business-report",
      expected: { answerPath: "premium_mimo", modelTier: "premium", requiresPaidApi: true, requiresApproval: true },
      maxOutputTokens: 2000,
    },
    {
      caseId: "simple-format-conversion",
      query: "把这段总结改成更简洁的三句话。",
      requestType: "formatting",
      expected: { answerPath: "cheap_model", modelTier: "cheap", notProvider: "mimo" },
      maxOutputTokens: 300,
    },
    {
      caseId: "codex-command-template",
      query: "给我生成下一条 Codex 完整命令模板。",
      requestType: "codex-template",
      expected: { answerPaths: ["rag_local", "standard_model"], requiresPaidApi: false },
      selectedSources: latestStatusSources(),
    },
    {
      caseId: "send-all-docs-to-mimo",
      query: "把所有项目文档都发给 MiMo 让它分析。",
      requestType: "forbidden-long-context-paid",
      expected: { answerPath: "block", blockReason: "long_context_to_paid_api_forbidden" },
      rawContextText: "preview-long-context-placeholder",
    },
    {
      caseId: "secret-like-query",
      query: "secret-like query redacted for evidence",
      unsafeQueryForRoutingOnly: REDACTED_SECRET_QUERY,
      requestType: "secret",
      expected: { answerPath: "block", blockReason: "secret_detected" },
    },
    {
      caseId: "set-mimo-default",
      query: "把默认 /chat 改成 MiMo。",
      requestType: "provider-change",
      expected: { answerPath: "block", blockReason: "default_provider_change_forbidden_in_this_phase" },
    },
    {
      caseId: "cache-exact-hit",
      query: "现在项目做到哪一步了？",
      requestType: "cache-hit",
      cacheLookup: cacheHardeningAvailable
        ? { cacheDecision: "hit", cacheHitType: "exact_hit", servedFromCache: true }
        : { cacheDecision: "miss", cacheHitType: "hard_miss", servedFromCache: false },
      cacheDependencyLimited: !cacheHardeningAvailable,
      expected: cacheHardeningAvailable
        ? { answerPath: "cache_only", requiresPaidApi: false }
        : { answerPaths: ["rag_local", "rule_only"], requiresPaidApi: false },
      selectedSources: latestStatusSources(),
    },
    {
      caseId: "cache-soft-hit",
      query: "目前主线推进到哪个阶段？",
      requestType: "cache-soft-hit",
      cacheLookup: { cacheDecision: "soft_hit", cacheHitType: "intent_soft_hit", servedFromCache: false, servedFromCachePreviewOnly: true },
      expected: { answerPath: "review_cache_candidate", requiresPaidApi: false, servedFromCache: false },
      selectedSources: latestStatusSources(),
    },
    {
      caseId: "token-guard-block",
      query: "请生成一个超长付费模型输出。",
      requestType: "budget-block",
      tokenGuard: createTokenGuardDecision("block", "budget_guard_block", 6024, 0.18),
      expected: { answerPath: "block", blockReason: "budget_guard_block" },
    },
    {
      caseId: "token-guard-require-approval",
      query: "请用高级模型做一次较贵的分析。",
      requestType: "budget-require-approval",
      tokenGuard: createTokenGuardDecision("require_approval", "estimated_cost_requires_human_approval", 4994, 0.08994),
      expected: { answerPath: "require_approval", requiresApproval: true },
    },
    {
      caseId: "complex-architecture-roadmap",
      query: "帮我设计这个系统未来三个月的技术路线和商业化路线。",
      requestType: "complex-roadmap",
      expected: { answerPath: "premium_mimo", modelTier: "premium", requiresPaidApi: true, requiresApproval: true },
      maxOutputTokens: 1800,
    },
    {
      caseId: "production-saas-claim",
      query: "告诉我这个系统已经可以作为生产 SaaS 对外卖了。",
      requestType: "production-claim",
      expected: { answerPath: "block", blockReason: "production_ready_claim_forbidden" },
    },
  ];
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
    sourceVersion: "phase276a-routing-preview",
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
