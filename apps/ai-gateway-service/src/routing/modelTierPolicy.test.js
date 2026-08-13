import { describe, it, expect } from "vitest";
import {
  MODEL_TIER_ROUTING_POLICY_VERSION,
  MODEL_TIER_ROUTING_MODE,
  createModelTierRoutingPolicy,
  createRoutingSafety,
  getAnswerPathOrder,
} from "./modelTierPolicy.js";

describe("model-tier-policy", () => {
  it("exports correct version constants", () => {
    expect(MODEL_TIER_ROUTING_POLICY_VERSION).toBe("phase276a-v1");
    expect(MODEL_TIER_ROUTING_MODE).toBe("local-routing-preview-only");
  });

  it("createModelTierRoutingPolicy returns default policy", () => {
    const policy = createModelTierRoutingPolicy();
    expect(policy.routingPolicyVersion).toBe(MODEL_TIER_ROUTING_POLICY_VERSION);
    expect(policy.previewOnly).toBe(true);
    expect(policy.productionRoutingEnabled).toBe(false);
    expect(policy.paidApiCallCount).toBe(0);
    expect(policy.premiumProvider).toBe("mimo");
    expect(policy.premiumModel).toBe("mimo-v2.5-pro");
    expect(policy.defaultChatProvider).toBe("nvidia");
    expect(policy.requireApprovalForPaidApi).toBe(true);
    expect(policy.progressiveEscalationEnabled).toBe(true);
    expect(policy.preferCacheBeforeModel).toBe(true);
    expect(policy.preferRagBeforeModel).toBe(true);
    expect(policy.preferRuleOnlyBeforeModel).toBe(true);
  });

  it("createModelTierRoutingPolicy respects overrides", () => {
    const policy = createModelTierRoutingPolicy({
      paidApiCallCount: 5,
      previewOnly: false,
    });
    expect(policy.paidApiCallCount).toBe(5);
    expect(policy.previewOnly).toBe(false);
    // Untouched fields keep defaults
    expect(policy.productionRoutingEnabled).toBe(false);
  });

  it("createRoutingSafety returns all-false defaults", () => {
    const safety = createRoutingSafety();
    expect(safety.plainTextApiKeyWritten).toBe(false);
    expect(safety.paidApiCallExecuted).toBe(false);
    expect(safety.externalApiCalled).toBe(false);
    expect(safety.mimoApiCalled).toBe(false);
    expect(safety.autoCommit).toBe(false);
    expect(safety.autoPush).toBe(false);
    expect(safety.codexExecInvoked).toBe(false);
    expect(safety.worktreeCreated).toBe(false);
  });

  it("createRoutingSafety respects overrides", () => {
    const safety = createRoutingSafety({
      externalApiCalled: true,
      autoCommit: true,
    });
    expect(safety.externalApiCalled).toBe(true);
    expect(safety.autoCommit).toBe(true);
    expect(safety.paidApiCallExecuted).toBe(false);
  });

  it("getAnswerPathOrder returns 9 paths in correct order", () => {
    const order = getAnswerPathOrder();
    expect(order).toHaveLength(9);
    expect(order[0]).toBe("rule_only");
    expect(order[3]).toBe("cheap_model");
    expect(order[5]).toBe("premium_mimo");
    expect(order[7]).toBe("block");
    expect(order[8]).toBe("review_cache_candidate");
  });

  it("getAnswerPathOrder returns consistent results", () => {
    expect(getAnswerPathOrder()).toEqual(getAnswerPathOrder());
  });
});
