import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPreviewBrainBinding, modelBrainBindingPolicy } from "./modelBrainBindingPolicy.js";
import { brainBindingSchema, validateBrainBindingSchema } from "./brainAdapterContract.js";

describe("employee-brain-adapter — brain binding policy", () => {
  it("defaults to dry-run with no provider calls", () => {
    assert.equal(modelBrainBindingPolicy.defaultMode, "dry_run");
    assert.equal(modelBrainBindingPolicy.providerCallsMade, false);
    assert.equal(modelBrainBindingPolicy.maxRequestsPerTask, 0);
    assert.equal(modelBrainBindingPolicy.maxEstimatedCostUsd, 0);
  });

  it("creates a preview binding with hard zero budgets", () => {
    const binding = createPreviewBrainBinding({ modelRef: "fake-model" });
    assert.equal(binding.mode, "dry_run");
    assert.equal(binding.maxRequestsPerTask, 0);
    assert.equal(binding.maxEstimatedCostUsd, 0);
    assert.equal(binding.approvalRequired, true);
    assert.equal(binding.modelRef, "fake-model");
  });
});

describe("employee-brain-adapter — brain binding schema", () => {
  it("exposes the expected field list and modes", () => {
    assert.ok(brainBindingSchema.fields.includes("mode"));
    assert.ok(brainBindingSchema.fields.includes("maxRequestsPerTask"));
    assert.ok(brainBindingSchema.modes.includes("dry_run"));
  });

  it("validates the default binding as complete", () => {
    const result = validateBrainBindingSchema();
    assert.equal(result.valid, true);
    assert.deepEqual(result.missing, []);
  });
});
