import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSafetyCostSources,
  requiredSafetyBlockIds,
  validateSafetyCostSources,
} from "./safetyCostSources.js";

describe("safetyCostSources — build", () => {
  it("builds a synthetic dry-run source bundle", () => {
    const sources = buildSafetyCostSources();
    assert.equal(sources.verificationMode, "synthetic-dry-run");
    assert.equal(sources.trace.syntheticOnly, true);
    assert.ok(sources.providerBoundarySources.length > 0);
    assert.ok(sources.secretBoundarySources.length > 0);
  });

  it("always includes every required safety block id", () => {
    const sources = buildSafetyCostSources();
    const matrixIds = sources.blockedRequestMatrix.map((entry) => entry.id);
    for (const id of requiredSafetyBlockIds) {
      assert.ok(matrixIds.includes(id));
    }
    for (const entry of sources.blockedRequestMatrix) {
      assert.equal(entry.blocked, true);
      assert.equal(entry.providerCalled, false);
    }
  });

  it("merges blocked reasons from the input readout", () => {
    const sources = buildSafetyCostSources({
      readout: { blockedCandidates: [{ reason: "custom_block_reason" }] },
    });
    const ids = sources.safetyNegativeSources.map((s) => s.id);
    assert.ok(ids.includes("custom_block_reason"));
    assert.ok(ids.includes("unauthorized_provider_call"));
  });
});

describe("safetyCostSources — validate", () => {
  it("accepts a valid source bundle", () => {
    const result = validateSafetyCostSources(buildSafetyCostSources());
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it("rejects empty or malformed input", () => {
    const result = validateSafetyCostSources({});
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("schemaVersion_invalid"));
    assert.ok(result.errors.includes("phase_invalid"));
    assert.ok(result.errors.includes("safetyNegativeSources_missing"));
  });

  it("rejects a bundle where syntheticOnly is not true", () => {
    const sources = buildSafetyCostSources();
    const tampered = { ...sources, trace: { syntheticOnly: false } };
    const result = validateSafetyCostSources(tampered);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("syntheticOnly_not_true"));
  });
});
