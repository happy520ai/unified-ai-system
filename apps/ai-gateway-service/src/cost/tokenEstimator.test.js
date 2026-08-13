import { describe, it, expect } from "vitest";
import { estimateTokens, estimateTextTokens, TOKEN_ESTIMATOR_METHOD } from "./tokenEstimator.js";

describe("token-estimator", () => {
  it("exports the correct method constant", () => {
    expect(TOKEN_ESTIMATOR_METHOD).toBe("approximate-no-provider-call");
  });

  it("estimateTextTokens returns 0 for empty/null/whitespace", () => {
    expect(estimateTextTokens("")).toBe(0);
    expect(estimateTextTokens(null)).toBe(0);
    expect(estimateTextTokens(undefined)).toBe(0);
    expect(estimateTextTokens("   ")).toBe(0);
  });

  it("estimateTextTokens returns at least 1 for non-empty text", () => {
    expect(estimateTextTokens("hi")).toBeGreaterThanOrEqual(1);
  });

  it("estimateTextTokens handles Chinese text", () => {
    const result = estimateTextTokens("你好世界，这是一个测试");
    expect(result).toBeGreaterThan(0);
  });

  it("estimateTextTokens handles mixed Chinese/English", () => {
    const result = estimateTextTokens("Hello 世界, this is a test 测试");
    expect(result).toBeGreaterThan(0);
  });

  it("estimateTokens returns structured result with safety flags", () => {
    const result = estimateTokens({ text: "hello world" });
    expect(result).toHaveProperty("estimatedInputTokens");
    expect(result).toHaveProperty("estimatedOutputTokens");
    expect(result).toHaveProperty("estimatedTotalTokens");
    expect(result.method).toBe(TOKEN_ESTIMATOR_METHOD);
    expect(result.confidence).toBe("conservative-preview");
    expect(result.safety.externalApiCalled).toBe(false);
    expect(result.safety.paidApiCalled).toBe(false);
    expect(result.safety.apiKeyRead).toBe(false);
  });

  it("estimateTokens respects explicit maxOutputTokens", () => {
    const result = estimateTokens({ text: "hello", maxOutputTokens: 500 });
    expect(result.estimatedOutputTokens).toBe(500);
  });

  it("estimateTokens uses 256 fallback for empty input", () => {
    const result = estimateTokens({});
    expect(result.estimatedOutputTokens).toBe(256);
  });

  it("estimateTokens calculates output as 0.35x input when no maxOutputTokens", () => {
    const result = estimateTokens({
      messages: [{ role: "user", content: "a".repeat(1000) }],
    });
    expect(result.estimatedOutputTokens).toBeGreaterThanOrEqual(256);
    expect(result.estimatedOutputTokens).toBeLessThanOrEqual(1024);
  });

  it("estimateTokens clamps output to 256-1024 range", () => {
    const smallResult = estimateTokens({ text: "hi" });
    expect(smallResult.estimatedOutputTokens).toBeGreaterThanOrEqual(256);

    const largeResult = estimateTokens({
      messages: [{ role: "user", content: "a".repeat(100000) }],
    });
    expect(largeResult.estimatedOutputTokens).toBeLessThanOrEqual(1024);
  });

  it("estimateTokens handles negative/invalid maxOutputTokens", () => {
    const result = estimateTokens({ text: "hello", maxOutputTokens: -100 });
    expect(result.estimatedOutputTokens).toBeGreaterThanOrEqual(256);
  });

  it("estimateTokens collects text from messages array", () => {
    const result = estimateTokens({
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello there" },
      ],
    });
    expect(result.estimatedInputTokens).toBeGreaterThan(0);
  });
});
