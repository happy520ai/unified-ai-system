import { describe, it, expect } from "vitest";
import { classifyAnswerPath } from "./answerPathClassifier.js";

describe("answer-path-classifier", () => {
  it("blocks when containsSecret is true", () => {
    const result = classifyAnswerPath({ containsSecret: true });
    expect(result.answerPath).toBe("block");
    expect(result.shouldBlock).toBe(true);
    expect(result.blockReason).toBe("secret_detected");
  });

  it("blocks when token guard decision is block", () => {
    const result = classifyAnswerPath({ costGuardDecision: "block" });
    expect(result.answerPath).toBe("block");
    expect(result.blockReason).toBe("budget_guard_block");
  });

  it("requires approval when token guard requires approval", () => {
    const result = classifyAnswerPath({ costGuardDecision: "require_approval" });
    expect(result.answerPath).toBe("require_approval");
    expect(result.requiresApproval).toBe(true);
    expect(result.requiresPaidApi).toBe(true);
  });

  it("returns cache_only for strong cache hit", () => {
    const result = classifyAnswerPath({
      cacheDecision: "hit",
      cacheHitType: "exact_hit",
    });
    expect(result.answerPath).toBe("cache_only");
    expect(result.servedFromCache).toBe(true);
  });

  it("returns review_cache_candidate for soft cache hit", () => {
    const result = classifyAnswerPath({
      cacheDecision: "soft_hit",
      cacheHitType: "intent_soft_hit",
    });
    expect(result.answerPath).toBe("review_cache_candidate");
    expect(result.servedFromCache).toBe(false);
    expect(result.servedFromCachePreviewOnly).toBe(true);
  });

  it("returns rule_only for current_blocker intent", () => {
    const result = classifyAnswerPath({ intentSignature: "current_blocker" });
    expect(result.answerPath).toBe("rule_only");
    expect(result.modelTier).toBe("rule_only");
  });

  it("returns rag_local for project_current_status intent", () => {
    const result = classifyAnswerPath({ intentSignature: "project_current_status" });
    expect(result.answerPath).toBe("rag_local");
    expect(result.sourceSelectionUsed).toBe(true);
  });

  it("returns cheap_model for formatting requests", () => {
    const result = classifyAnswerPath({ query: "format this text concisely" });
    expect(result.answerPath).toBe("cheap_model");
    expect(result.modelTier).toBe("cheap");
  });

  it("blocks for legacy modification requests", () => {
    const result = classifyAnswerPath({ query: "modify legacy/ code" });
    expect(result.answerPath).toBe("block");
    expect(result.blockReason).toBe("legacy_modification_forbidden");
  });

  it("blocks for auto commit requests", () => {
    const result = classifyAnswerPath({ query: "auto commit and auto push" });
    expect(result.answerPath).toBe("block");
  });

  it("defaults to rag_local for normal queries", () => {
    const result = classifyAnswerPath({ query: "what is python?" });
    expect(result.answerPath).toBe("rag_local");
    expect(result.confidence).toBe("medium");
  });

  it("returns audit metadata with safe defaults", () => {
    const result = classifyAnswerPath({ query: "hello" });
    expect(result.audit.finalDecisionBy).toBe("deterministic_rules");
    expect(result.audit.externalApiCalled).toBe(false);
    expect(result.audit.paidApiCallCount).toBe(0);
    expect(result.audit.modelActuallyCalled).toBe(false);
  });

  it("sets fallbackPath for premium paths", () => {
    const result = classifyAnswerPath({
      query: "complex architecture roadmap",
      intentSignature: "unknown_intent",
    });
    if (result.answerPath === "premium_mimo" || result.answerPath === "premium_model") {
      expect(result.fallbackPath).toBeDefined();
    }
  });
});
