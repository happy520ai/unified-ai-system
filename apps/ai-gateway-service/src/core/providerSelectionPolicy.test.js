import { describe, it, expect } from "vitest";
import { createPriorityProviderSelectionPolicy } from "./providerSelectionPolicy.js";

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

  it("selects highest priority candidate", () => {
    const policy = createPriorityProviderSelectionPolicy();
    const candidates = [
      { target: { providerId: "low", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
      { target: { providerId: "high", modelId: "m2" }, providerPriority: 100, modelPriority: 100 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    expect(result.selected.target.providerId).toBe("low");
  });

  it("throws when no candidates match", () => {
    const policy = createPriorityProviderSelectionPolicy();
    expect(() => policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates: [] })).toThrow();
  });
});
