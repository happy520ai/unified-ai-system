import { describe, it, expect } from "vitest";
import { createPriorityProviderSelectionPolicy } from "./providerSelectionPolicy.js";
import { createProviderHealthScorer } from "../providers/providerHealthScorer.js";

describe("provider-selection-policy", () => {
  it("creates policy with default mode", () => {
    const policy = createPriorityProviderSelectionPolicy();
    expect(policy.name).toBe("registry-default");
    expect(policy.mode).toBe("registry-default");
  });

  it("creates policy with fixed mode", () => {
    const policy = createPriorityProviderSelectionPolicy({ mode: "fixed" });
    expect(policy.name).toBe("fixed-default");
  });

  it("creates policy with health-weighted mode", () => {
    const healthScorer = createProviderHealthScorer();
    const policy = createPriorityProviderSelectionPolicy({
      mode: "health-weighted",
      healthScorer,
    });
    expect(policy.name).toBe("health-weighted");
    expect(policy.mode).toBe("health-weighted");
  });

  it("selects highest priority candidate", () => {
    const policy = createPriorityProviderSelectionPolicy();
    const candidates = [
      { target: { providerId: "low", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
      { target: { providerId: "high", modelId: "m2" }, providerPriority: 100, modelPriority: 100 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    expect(result.selected.target.providerId).toBe("low");
  });

  it("selects healthier provider in health-weighted mode", () => {
    const healthScorer = createProviderHealthScorer();
    // Simulate: provider-a has failures, provider-b is clean
    healthScorer.recordFailure("provider-a", "timeout");
    healthScorer.recordFailure("provider-a", "timeout");
    healthScorer.recordSuccess("provider-b", 500);

    const policy = createPriorityProviderSelectionPolicy({
      mode: "health-weighted",
      healthScorer,
    });
    const candidates = [
      { target: { providerId: "provider-a", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
      { target: { providerId: "provider-b", modelId: "m2" }, providerPriority: 100, modelPriority: 100 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    // provider-b has higher health score despite lower priority
    expect(result.selected.target.providerId).toBe("provider-b");
  });

  it("falls back to priority when health scores are equal", () => {
    const healthScorer = createProviderHealthScorer();
    // No data recorded — both return default score (50)
    const policy = createPriorityProviderSelectionPolicy({
      mode: "health-weighted",
      healthScorer,
    });
    const candidates = [
      { target: { providerId: "low-priority", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
      { target: { providerId: "high-priority", modelId: "m2" }, providerPriority: 100, modelPriority: 100 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    expect(result.selected.target.providerId).toBe("low-priority");
  });

  it("includes health scores in metadata for health-weighted mode", () => {
    const healthScorer = createProviderHealthScorer();
    healthScorer.recordSuccess("provider-a", 300);

    const policy = createPriorityProviderSelectionPolicy({
      mode: "health-weighted",
      healthScorer,
    });
    const candidates = [
      { target: { providerId: "provider-a", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    expect(result.metadata.healthScores).toBeDefined();
    expect(result.metadata.healthScores["provider-a"]).toBeDefined();
  });

  it("does not emit fallback_execution_disabled warning in health-weighted mode", () => {
    const healthScorer = createProviderHealthScorer();
    const policy = createPriorityProviderSelectionPolicy({
      mode: "health-weighted",
      healthScorer,
    });
    const candidates = [
      { target: { providerId: "a", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
      { target: { providerId: "b", modelId: "m2" }, providerPriority: 20, modelPriority: 20 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    const codes = result.warnings.map((w) => w.code);
    expect(codes).not.toContain("fallback_execution_disabled");
  });

  it("uses weighted random selection when useLoadBalancer is true", () => {
    const healthScorer = createProviderHealthScorer();
    // Give provider-a a much higher score
    healthScorer.recordSuccess("provider-a", 100);
    healthScorer.recordSuccess("provider-a", 100);
    healthScorer.recordFailure("provider-b", "error");

    let randomIndex = 0;
    const policy = createPriorityProviderSelectionPolicy({
      mode: "health-weighted",
      healthScorer,
      useLoadBalancer: true,
      random: () => ((randomIndex++ % 100) + 0.5) / 100,
    });
    const candidates = [
      { target: { providerId: "provider-a", modelId: "m1" }, providerPriority: 100, modelPriority: 100 },
      { target: { providerId: "provider-b", modelId: "m2" }, providerPriority: 10, modelPriority: 10 },
    ];
    // Run multiple times — provider-a should win the majority (weight ratio ~2:1 → ~67%)
    let aCount = 0;
    for (let i = 0; i < 100; i++) {
      const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
      if (result.selected.target.providerId === "provider-a") aCount++;
    }
    // provider-a has higher health score, should win >55% of the time (above 50/50 baseline)
    expect(aCount).toBeGreaterThan(55);
  });

  it("throws when no candidates match", () => {
    const policy = createPriorityProviderSelectionPolicy();
    expect(() => policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates: [] })).toThrow();
  });
});
