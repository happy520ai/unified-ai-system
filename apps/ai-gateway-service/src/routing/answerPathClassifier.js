import { createModelTierRoutingPolicy } from "./modelTierPolicy.js";

const DEFAULT_PREMIUM_REASON = "high_value_complex_task_requires_premium_preview_and_approval";

export function classifyAnswerPath(input = {}, policy = createModelTierRoutingPolicy()) {
  const query = String(input.query ?? "");
  const normalizedQuery = String(input.normalizedQuery ?? "").toLowerCase();
  const intentSignature = input.intentSignature ?? "unknown_intent";
  const providerAgnosticMode = Boolean(input.providerAgnostic) || policy.routerType === "provider-agnostic-quality-cost";
  const requestType = String(input.requestType ?? "routing-preview");
  const cacheDecision = input.cacheDecision ?? input.cacheLookup?.cacheDecision ?? "none";
  const cacheHitType = input.cacheHitType ?? input.cacheLookup?.cacheHitType ?? "none";
  const tokenGuardDecision = input.costGuardDecision ?? input.tokenGuard?.decision ?? "allow";
  const containsSecret = Boolean(input.containsSecret ?? input.sanitizerResult?.containsSecret);
  const requestedAction = String(input.requestedAction ?? "");
  const textForPolicy = [query, normalizedQuery, requestType, requestedAction].join(" ").toLowerCase();

  if (policy.blockSecretLikeRequests && containsSecret) {
    return createDecision({
      answerPath: "block",
      modelTier: "none",
      providerRecommendation: "none",
      shouldBlock: true,
      blockReason: "secret_detected",
      routingReason: "Secret-like text is rejected before cache, RAG, or model routing.",
      confidence: "high",
      reasonCodes: ["secret_detected", "no_model_call"],
    });
  }

  const policyBlockReason = detectPolicyBlock(textForPolicy);
  if (policyBlockReason) {
    return createDecision({
      answerPath: "block",
      modelTier: "none",
      providerRecommendation: "none",
      shouldBlock: true,
      blockReason: policyBlockReason,
      routingReason: createPolicyBlockReason(policyBlockReason),
      confidence: "high",
      reasonCodes: [policyBlockReason, "policy_boundary_enforced"],
    });
  }

  if (tokenGuardDecision === "block") {
    return createDecision({
      answerPath: "block",
      modelTier: "none",
      providerRecommendation: "none",
      shouldBlock: true,
      blockReason: "budget_guard_block",
      routingReason: "Token Cost Guard returned block, so no model path is recommended.",
      confidence: "high",
      reasonCodes: ["token_guard_block", "no_model_call"],
      tokenGuardDecision,
    });
  }

  if (tokenGuardDecision === "require_approval") {
    return createDecision({
      answerPath: "require_approval",
      modelTier: "premium",
      providerRecommendation: providerAgnosticMode ? "multi-provider-preview" : policy.premiumProvider,
      modelRecommendation: providerAgnosticMode ? "approval-gated-provider-agnostic-paid-path" : policy.premiumModel,
      requiresPaidApi: true,
      requiresApproval: true,
      routingReason: "Token Cost Guard requires human approval before any paid or premium path.",
      confidence: "high",
      reasonCodes: ["token_guard_requires_approval", "paid_api_not_called"],
      tokenGuardDecision,
    });
  }

  if (isStrongCacheHit(cacheDecision, cacheHitType)) {
    return createDecision({
      answerPath: "cache_only",
      modelTier: "cache",
      providerRecommendation: "none",
      routingReason: "Cache hardening reported an exact or normalized deterministic hit.",
      confidence: "high",
      reasonCodes: ["cache_strong_hit", "no_model_call"],
      cacheDecision,
      cacheHitType,
      servedFromCache: true,
    });
  }

  if (isSoftCacheHit(cacheDecision, cacheHitType)) {
    return createDecision({
      answerPath: "review_cache_candidate",
      modelTier: "cache",
      providerRecommendation: "none",
      routingReason: "Intent or semantic soft hit is preview-only and cannot be served as a final cache hit.",
      confidence: "medium",
      reasonCodes: ["soft_cache_candidate_review_only", "no_model_call"],
      cacheDecision,
      cacheHitType,
      servedFromCache: false,
      servedFromCachePreviewOnly: true,
    });
  }

  if (intentSignature === "current_blocker") {
    return createDecision({
      answerPath: "rule_only",
      modelTier: "rule_only",
      providerRecommendation: "none",
      routingReason: "Current blocker is available from latest local evidence.",
      confidence: "high",
      reasonCodes: ["latest_evidence_enough", "rule_only_first"],
    });
  }

  if (["project_current_status", "mimo_availability", "token_saving_capability", "next_step_recommendation"].includes(intentSignature)) {
    return createDecision({
      answerPath: "rag_local",
      modelTier: "local",
      providerRecommendation: "local",
      routingReason: "Latest evidence and selected source packs are enough for a local RAG answer.",
      confidence: "high",
      reasonCodes: ["rag_selected_context_enough", "paid_api_not_needed"],
      sourceSelectionUsed: true,
    });
  }

  if (intentSignature === "codex_task_generation" || isCodexTemplateRequest(textForPolicy)) {
    return createDecision({
      answerPath: "standard_model",
      modelTier: "standard",
      providerRecommendation: "nvidia",
      modelRecommendation: "standard-preview-model",
      routingReason: "A Codex command template needs structured composition, but the preview does not require MiMo.",
      confidence: "medium",
      reasonCodes: ["standard_model_preview_recommendation", "mimo_not_needed"],
      sourceSelectionUsed: true,
    });
  }

  if (isCheapFormattingRequest(textForPolicy)) {
    return createDecision({
      answerPath: "cheap_model",
      modelTier: "cheap",
      providerRecommendation: "local",
      modelRecommendation: "cheap-preview-model",
      routingReason: "Low-risk wording or formatting work should not use MiMo premium by default.",
      confidence: "high",
      reasonCodes: ["cheap_language_cleanup", "mimo_not_needed"],
    });
  }

  if (providerAgnosticMode && isMultiModelReviewCandidate(textForPolicy)) {
    return createDecision({
      answerPath: "multi_model_review",
      modelTier: "multi_model",
      providerRecommendation: "multi-provider-preview",
      modelRecommendation: "multi-provider-review-preview",
      providerAgnostic: true,
      premiumCandidates: policy.premiumCandidates,
      requiresPaidApi: true,
      requiresApproval: true,
      qualityGateRequired: true,
      routingReason: "High-risk or explicitly cross-validated conclusion should use multi-model review only after approval.",
      confidence: "medium",
      reasonCodes: ["multi_model_review_preview_recommendation", "requires_human_approval", "model_not_called"],
    });
  }

  if (providerAgnosticMode && isExpertCandidate(textForPolicy)) {
    return createDecision({
      answerPath: "expert_model",
      modelTier: "expert",
      providerRecommendation: "multi-provider-preview",
      modelRecommendation: "provider-agnostic-expert-candidate",
      providerAgnostic: true,
      premiumCandidates: policy.premiumCandidates,
      requiresPaidApi: true,
      requiresApproval: true,
      qualityGateRequired: true,
      routingReason: "Near-perfect or professional-grade accuracy request needs an expert preview path and approval.",
      confidence: "medium",
      reasonCodes: ["expert_model_preview_recommendation", "quality_gate_required", "requires_human_approval", "model_not_called"],
    });
  }

  if (isPremiumCandidate(textForPolicy, intentSignature)) {
    return createDecision({
      answerPath: providerAgnosticMode ? "premium_model" : "premium_mimo",
      modelTier: "premium",
      providerRecommendation: providerAgnosticMode ? "multi-provider-preview" : policy.premiumProvider,
      modelRecommendation: providerAgnosticMode ? "provider-agnostic-premium-candidate" : policy.premiumModel,
      providerAgnostic: providerAgnosticMode,
      premiumCandidates: policy.premiumCandidates,
      requiresPaidApi: true,
      requiresApproval: true,
      qualityGateRequired: providerAgnosticMode,
      routingReason: DEFAULT_PREMIUM_REASON,
      confidence: "medium",
      reasonCodes: ["premium_mimo_preview_recommendation", "requires_human_approval", "paid_api_not_called"],
    });
  }

  return createDecision({
    answerPath: "rag_local",
    modelTier: "local",
    providerRecommendation: "local",
    routingReason: "Default preview route prefers local evidence and selected context before any model.",
    confidence: "medium",
    reasonCodes: ["anti_model_dependency_default", "rag_before_model"],
    sourceSelectionUsed: true,
  });
}

function createDecision(fields = {}) {
  return {
    answerPath: fields.answerPath ?? "rule_only",
    modelTier: fields.modelTier ?? "rule_only",
    providerRecommendation: fields.providerRecommendation ?? "none",
    modelRecommendation: fields.modelRecommendation ?? null,
    providerAgnostic: fields.providerAgnostic ?? false,
    premiumCandidates: fields.premiumCandidates ?? [],
    requiresPaidApi: fields.requiresPaidApi ?? false,
    requiresApproval: fields.requiresApproval ?? false,
    shouldBlock: fields.shouldBlock ?? false,
    blockReason: fields.blockReason ?? null,
    routingReason: fields.routingReason ?? "",
    confidence: fields.confidence ?? "medium",
    qualityGateRequired: fields.qualityGateRequired ?? false,
    qualityTarget: fields.qualityTarget ?? null,
    progressiveEscalation: fields.progressiveEscalation ?? null,
    requiredPreflight: fields.requiredPreflight ?? createRequiredPreflight(fields),
    fallbackPath: fields.fallbackPath ?? createFallbackPath(fields.answerPath),
    reasonCodes: fields.reasonCodes ?? [],
    recommendedActions: fields.recommendedActions ?? createRecommendedActions(fields),
    cacheDecision: fields.cacheDecision ?? "none",
    cacheHitType: fields.cacheHitType ?? "none",
    tokenGuardDecision: fields.tokenGuardDecision ?? "allow",
    sourceSelectionUsed: fields.sourceSelectionUsed ?? false,
    servedFromCache: fields.servedFromCache ?? false,
    servedFromCachePreviewOnly: fields.servedFromCachePreviewOnly ?? false,
    audit: {
      finalDecisionBy: "deterministic_rules",
      externalApiCalled: false,
      paidApiCallCount: 0,
      mimoApiCalled: false,
      modelActuallyCalled: false,
      defaultNvidiaChatLaneChanged: false,
      mimoSetAsDefault: false,
    },
  };
}

function createRequiredPreflight(fields) {
  if (["premium_mimo", "premium_model", "expert_model", "multi_model_review"].includes(fields.answerPath) || fields.requiresPaidApi) {
    return ["token_guard_allow_or_require_approval", "human_approval_required", "cache_lookup_first", "rag_source_selection_first"];
  }
  if (fields.answerPath === "block") return ["stop_before_model_call"];
  if (fields.answerPath === "review_cache_candidate") return ["deterministic_cache_gate_review"];
  return ["local_evidence_available"];
}

function createFallbackPath(answerPath) {
  if (answerPath === "premium_mimo") return "require_approval";
  if (answerPath === "premium_model") return "standard_model";
  if (answerPath === "expert_model") return "premium_model";
  if (answerPath === "multi_model_review") return "expert_model";
  if (answerPath === "standard_model") return "rag_local";
  if (answerPath === "cheap_model") return "rule_only";
  if (answerPath === "review_cache_candidate") return "rag_local";
  return "rule_only";
}

function createRecommendedActions(fields) {
  if (fields.answerPath === "block") return ["do_not_call_model", "explain_block_reason"];
  if (fields.answerPath === "require_approval" || fields.requiresApproval) return ["request_human_approval", "show_token_guard_summary"];
  if (["premium_mimo", "premium_model", "expert_model", "multi_model_review"].includes(fields.answerPath)) return ["cache_lookup_first", "rag_source_selection_first", "run_quality_gate_preview", "request_human_approval"];
  if (fields.answerPath === "cache_only") return ["serve_cache_hit"];
  if (fields.answerPath === "review_cache_candidate") return ["review_soft_cache_candidate", "fallback_to_rag_local"];
  return ["use_local_evidence_first"];
}

function isStrongCacheHit(cacheDecision, cacheHitType) {
  return cacheDecision === "hit" && ["exact_hit", "normalized_hit"].includes(cacheHitType);
}

function isSoftCacheHit(cacheDecision, cacheHitType) {
  return cacheDecision === "soft_hit" || ["intent_soft_hit", "multilingual_intent_soft_hit", "semantic_soft_hit"].includes(cacheHitType);
}

function detectPolicyBlock(text) {
  if ((text.includes("all project") || text.includes("all docs") || text.includes("\u6240\u6709\u9879\u76ee\u6587\u6863")) && text.includes("mimo")) {
    return "long_context_to_paid_api_forbidden";
  }
  if ((text.includes("default") || text.includes("\u9ed8\u8ba4")) && text.includes("mimo") && (text.includes("/chat") || text.includes("chat"))) {
    return "default_provider_change_forbidden_in_this_phase";
  }
  if (text.includes("legacy/") || text.includes("modify legacy")) return "legacy_modification_forbidden";
  if (text.includes("project_context.md")) return "project_context_creation_forbidden";
  if (text.includes("codex exec") || text.includes("codex cli")) return "codex_execution_forbidden";
  if (text.includes("workflow runner") || text.includes("workflow run")) return "workflow_runner_forbidden";
  if (text.includes("worktree")) return "worktree_creation_forbidden";
  if (text.includes("auto commit") || text.includes("auto push")) return "auto_commit_push_forbidden";
  if ((text.includes("all questions") && text.includes("most expensive")) || text.includes("\u6240\u6709\u95ee\u9898\u90fd\u9ed8\u8ba4\u7528\u6700\u8d35") || text.includes("\u6700\u8d35\u6700\u5f3a\u6a21\u578b")) {
    return "wasteful_premium_default_forbidden";
  }
  if (text.includes("production saas") || text.includes("\u751f\u4ea7 saas") || text.includes("\u5bf9\u5916\u5356")) {
    return "production_ready_claim_forbidden";
  }
  return null;
}

function createPolicyBlockReason(blockReason) {
  const reasons = {
    long_context_to_paid_api_forbidden: "Sending full project context to a paid model is forbidden; use RAG source selection first.",
    default_provider_change_forbidden_in_this_phase: "This phase forbids changing the default NVIDIA /chat lane or setting MiMo as default.",
    legacy_modification_forbidden: "legacy/ is read-only for this phase.",
    project_context_creation_forbidden: "PROJECT_CONTEXT.md must not be created.",
    codex_execution_forbidden: "Codex CLI and real Codex exec are outside this phase boundary.",
    workflow_runner_forbidden: "Workflow runner integration is outside this phase boundary.",
    worktree_creation_forbidden: "Worktree creation is outside this phase boundary.",
    auto_commit_push_forbidden: "Auto commit and auto push are outside this phase boundary.",
    wasteful_premium_default_forbidden: "Defaulting every request to the most expensive model is rejected; use progressive escalation.",
    production_ready_claim_forbidden: "The system remains not-production-ready and cannot be claimed as production SaaS.",
  };
  return reasons[blockReason] ?? "Request violates this phase safety policy.";
}

function isExpertCandidate(text) {
  return includesAny(text, [
    "near perfect",
    "cannot be wrong",
    "must not be wrong",
    "professional audit",
    "expert review",
    "\u63a5\u8fd1\u5b8c\u7f8e",
    "\u4e0d\u80fd\u51fa\u9519",
    "\u4e13\u4e1a\u5ba1\u8ba1",
    "\u6781\u9ad8\u51c6\u786e",
  ]);
}

function isMultiModelReviewCandidate(text) {
  return includesAny(text, [
    "multiple models",
    "multi model",
    "cross validate",
    "cross-validate",
    "\u591a\u4e2a\u6a21\u578b",
    "\u591a\u6a21\u578b",
    "\u4ea4\u53c9\u9a8c\u8bc1",
  ]);
}

function isCodexTemplateRequest(text) {
  return text.includes("codex") && includesAny(text, [
    "command",
    "template",
    "\u547d\u4ee4",
    "\u6a21\u677f",
    "\u6307\u4ee4",
  ]);
}

function isCheapFormattingRequest(text) {
  return includesAny(text, [
    "format",
    "rewrite",
    "summarize",
    "three sentences",
    "concise",
    "\u66f4\u7b80\u6d01",
    "\u4e09\u53e5\u8bdd",
    "\u683c\u5f0f\u8f6c\u6362",
  ]);
}

function isPremiumCandidate(text, intentSignature) {
  if (intentSignature === "system_capability_score") return true;
  return includesAny(text, [
    "business report",
    "commercial",
    "architecture",
    "three months",
    "roadmap",
    "complex",
    "\u5546\u4e1a\u5316\u62a5\u544a",
    "\u975e\u5e38\u8be6\u7ec6",
    "\u6280\u672f\u8def\u7ebf",
    "\u5546\u4e1a\u5316\u8def\u7ebf",
    "\u590d\u6742",
  ]);
}

function includesAny(text, values) {
  return values.some((value) => text.includes(value));
}
