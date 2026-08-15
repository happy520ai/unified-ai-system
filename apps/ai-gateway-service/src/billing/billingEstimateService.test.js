import { describe, it, expect } from "vitest";
import { buildBillingEstimate } from "./billingEstimateService.js";

describe("billing-estimate-service", () => {
  it("calculates cost from token totals at 0.000002 per token", () => {
    const result = buildBillingEstimate({
      requestId: "req-1",
      providerId: "nvidia",
      modelId: "llama-3",
      estimatedInputTokens: 1000,
      estimatedOutputTokens: 500,
    });
    expect(result.estimatedCost).toBe(0.003); // (1000+500) * 0.000002 = 0.003
    expect(result.currency).toBe("USD");
    expect(result.estimateOnly).toBe(true);
    expect(result.actualBillingConnected).toBe(false);
  });

  it("handles zero tokens", () => {
    const result = buildBillingEstimate({ providerId: "nvidia" });
    expect(result.estimatedCost).toBe(0);
    expect(result.estimatedInputTokens).toBe(0);
    expect(result.estimatedOutputTokens).toBe(0);
  });

  it("handles empty input", () => {
    const result = buildBillingEstimate();
    expect(result.estimatedCost).toBe(0);
    expect(result.currency).toBe("USD");
  });

  it("warns about user-owned provider cost for non-nvidia providers", () => {
    const result = buildBillingEstimate({ providerId: "openai" });
    expect(result.warning).toBe("userOwnedProviderCostMayApply");
  });

  it("warns about internal test cost for nvidia provider", () => {
    const result = buildBillingEstimate({ providerId: "nvidia" });
    expect(result.warning).toBe("internal_test_cost_unknown");
  });

  it("rounds to 5 decimal places", () => {
    const result = buildBillingEstimate({
      estimatedInputTokens: 1,
      estimatedOutputTokens: 1,
    });
    // (1+1) * 0.000002 = 0.000004, rounded to 0.00000
    expect(result.estimatedCost).toBe(0);
  });

  it("passes through identity fields", () => {
    const result = buildBillingEstimate({
      requestId: "req-123",
      userIdRef: "user-456",
      mode: "god",
      providerId: "claude",
      modelId: "claude-4",
    });
    expect(result.requestId).toBe("req-123");
    expect(result.userIdRef).toBe("user-456");
    expect(result.mode).toBe("god");
    expect(result.providerId).toBe("claude");
    expect(result.modelId).toBe("claude-4");
  });

  it("sets costSource to mock_estimate_formula", () => {
    const result = buildBillingEstimate({});
    expect(result.costSource).toBe("mock_estimate_formula");
    expect(result.confidence).toBe("low_to_medium");
  });
});
