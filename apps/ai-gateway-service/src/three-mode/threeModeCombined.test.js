import { describe, it, expect } from "vitest";
import { defaultTianshuScoringPolicy, normalizeScoringWeights } from "./tianshuScoringPolicy.js";
import { THREE_MODE_ERROR_CODES, ThreeModeRuntimeError, toThreeModeError } from "./threeModeErrors.js";

describe("tianshu-scoring-policy", () => {
  it("defaultTianshuScoringPolicy returns policy with weights", () => {
    const policy = defaultTianshuScoringPolicy();
    expect(policy.phase).toBe("Phase329C");
    expect(policy.schemaName).toBe("tianshu-adaptive-scoring-policy");
    expect(policy.weights).toBeDefined();
    expect(policy.weights.capabilityMatch).toBe(0.3);
    expect(policy.weights.historicalSuccessRate).toBe(0.15);
    expect(policy.constraints).toBeDefined();
  });

  it("default weights sum to less than or equal to 1.0", () => {
    const policy = defaultTianshuScoringPolicy();
    const sum = Object.values(policy.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeLessThanOrEqual(1.0);
  });

  it("default constraints are safe", () => {
    const policy = defaultTianshuScoringPolicy();
    expect(policy.constraints.noFailedHighRiskModels).toBe(true);
    expect(policy.constraints.credentialRefRequired).toBe(true);
    expect(policy.constraints.secretValueAllowed).toBe(false);
  });

  it("normalizeScoringWeights normalizes weights to sum 1.0", () => {
    const normalized = normalizeScoringWeights({
      weights: { a: 1, b: 1, c: 2 },
    });
    const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
    expect(normalized.a).toBeCloseTo(0.25, 4);
    expect(normalized.b).toBeCloseTo(0.25, 4);
    expect(normalized.c).toBeCloseTo(0.5, 4);
  });

  it("normalizeScoringWeights handles empty weights", () => {
    const normalized = normalizeScoringWeights({});
    expect(Object.keys(normalized)).toHaveLength(0);
  });

  it("normalizeScoringWeights handles zero values", () => {
    const normalized = normalizeScoringWeights({
      weights: { a: 0, b: 0 },
    });
    expect(normalized.a).toBe(0);
    expect(normalized.b).toBe(0);
  });
});

describe("three-mode-errors", () => {
  it("exports frozen error codes", () => {
    expect(Object.isFrozen(THREE_MODE_ERROR_CODES)).toBe(true);
    expect(THREE_MODE_ERROR_CODES.MODE_NOT_ENABLED).toBe("MODE_NOT_ENABLED");
    expect(THREE_MODE_ERROR_CODES.SECRET_VALUE_FORBIDDEN).toBe("SECRET_VALUE_FORBIDDEN");
  });

  it("ThreeModeRuntimeError is an Error subclass", () => {
    const error = new ThreeModeRuntimeError("TEST_CODE", "test message", { key: "val" }, false);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ThreeModeRuntimeError");
    expect(error.code).toBe("TEST_CODE");
    expect(error.message).toBe("test message");
    expect(error.details).toEqual({ key: "val" });
    expect(error.recoverable).toBe(false);
  });

  it("ThreeModeRuntimeError defaults to recoverable=true", () => {
    const error = new ThreeModeRuntimeError("CODE", "msg");
    expect(error.recoverable).toBe(true);
    expect(error.details).toEqual({});
  });

  it("toThreeModeError passes through ThreeModeRuntimeError", () => {
    const original = new ThreeModeRuntimeError("MY_CODE", "my message", { x: 1 }, false);
    const result = toThreeModeError(original);
    expect(result.code).toBe("MY_CODE");
    expect(result.message).toBe("my message");
    expect(result.recoverable).toBe(false);
    expect(result.details).toEqual({ x: 1 });
  });

  it("toThreeModeError wraps generic Error", () => {
    const result = toThreeModeError(new Error("generic error"));
    expect(result.code).toBe(THREE_MODE_ERROR_CODES.THREE_MODE_RUNTIME_ERROR);
    expect(result.message).toBe("generic error");
    expect(result.recoverable).toBe(true);
  });

  it("toThreeModeError wraps non-Error values", () => {
    const result = toThreeModeError("string error");
    expect(result.code).toBe(THREE_MODE_ERROR_CODES.THREE_MODE_RUNTIME_ERROR);
    expect(result.message).toBe("string error");
  });
});
