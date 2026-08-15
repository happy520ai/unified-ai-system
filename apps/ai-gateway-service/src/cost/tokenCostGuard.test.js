import { describe, expect, it } from "vitest";
import { enforceTokenCostGuard } from "./tokenCostGuard.js";
import { createTokenBudgetPolicy } from "./tokenBudgetPolicy.js";

describe("enforceTokenCostGuard", () => {
  it("allows a request within budget", () => {
    const result = enforceTokenCostGuard({
      messages: [{ role: "user", content: "hello" }],
      maxOutputTokens: 100,
    });
    expect(result.allowed).toBe(true);
    expect(result.decision).toBe("allow");
  });

  it("blocks a request exceeding the per-request output token limit", () => {
    const result = enforceTokenCostGuard({
      messages: [{ role: "user", content: "hello" }],
      maxOutputTokens: 99999, // exceeds the 4096 default
    });
    expect(result.allowed).toBe(false);
    expect(result.decision).toBe("block");
    expect(result.reasons).toContain("output_tokens_exceed_per_request_limit");
  });

  it("requires approval when cost is above the approval threshold", () => {
    const policy = createTokenBudgetPolicy({}, {
      requireApprovalAboveUsd: 0.000001, // almost anything triggers approval
      hardBlockAboveUsd: 1, // keep block out of the picture
    });
    const result = enforceTokenCostGuard({
      messages: [{ role: "user", content: "hello world" }],
      maxOutputTokens: 50,
    }, { policy });
    expect(result.decision).toBe("require_approval");
    expect(result.allowed).toBe(false);
  });

  it("allows a high-cost request once approved", () => {
    const policy = createTokenBudgetPolicy({}, {
      requireApprovalAboveUsd: 0.000001,
      hardBlockAboveUsd: 1,
    });
    const result = enforceTokenCostGuard({
      messages: [{ role: "user", content: "hello world" }],
      maxOutputTokens: 50,
      userApprovedHighCost: true,
    }, { policy });
    // approval resolves the decision straight to "allow"
    expect(result.decision).toBe("allow");
    expect(result.allowed).toBe(true);
  });

  it("does not let inline images bypass the input-token budget", () => {
    const policy = createTokenBudgetPolicy({}, { perRequestMaxInputTokens: 100 });
    const result = enforceTokenCostGuard({
      messages: [{ role: "user", content: [
        { type: "text", text: "Describe" },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" } },
      ] }],
      maxOutputTokens: 10,
    }, { policy });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("input_tokens_exceed_per_request_limit");
    expect(result.estimate.imageCount).toBe(1);
  });
});
