import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPriorityProviderSelectionPolicy } from "./providerSelectionPolicy.js";

describe("provider-selection-policy", () => {
  it("creates policy with default mode", () => {
    const policy = createPriorityProviderSelectionPolicy();
    assert.equal(policy.name, "registry-default");
    assert.equal(policy.mode, "registry-default");
  });

  it("creates policy with fixed mode", () => {
    const policy = createPriorityProviderSelectionPolicy({ mode: "fixed" });
    assert.equal(policy.name, "fixed-default");
  });

  it("selects highest priority candidate", () => {
    const policy = createPriorityProviderSelectionPolicy();
    const candidates = [
      { target: { providerId: "low", modelId: "m1" }, providerPriority: 10, modelPriority: 10 },
      { target: { providerId: "high", modelId: "m2" }, providerPriority: 100, modelPriority: 100 },
    ];
    const result = policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates });
    assert.equal(result.selected.target.providerId, "low");
  });

  it("throws when no candidates match", () => {
    const policy = createPriorityProviderSelectionPolicy();
    assert.throws(() => policy.select({ request: { messages: [{ role: "user", content: "hi" }] }, candidates: [] }));
  });
});
