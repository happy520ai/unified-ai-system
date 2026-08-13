import { describe, it, expect } from "vitest";
import { freeModelFirstPolicy, getFreeModelFirstPolicy } from "./freeModelFirstPolicy.js";

describe("free-model-first-policy", () => {
  it("exports a policy with correct defaults", () => {
    expect(freeModelFirstPolicy.enabled).toBe(true);
    expect(freeModelFirstPolicy.defaultPreference).toBe("free-model-first");
    expect(freeModelFirstPolicy.manualApprovalRequiredBeforePaid).toBe(true);
    expect(freeModelFirstPolicy.paidProviderDefaultAllowed).toBe(false);
    expect(freeModelFirstPolicy.fallbackToPaidProviderAutoAllowed).toBe(false);
  });

  it("has non-empty notes array", () => {
    expect(Array.isArray(freeModelFirstPolicy.notes)).toBe(true);
    expect(freeModelFirstPolicy.notes.length).toBeGreaterThan(0);
  });

  it("getFreeModelFirstPolicy returns a deep copy", () => {
    const copy = getFreeModelFirstPolicy();
    expect(copy).toEqual(freeModelFirstPolicy);

    // Mutate the copy
    copy.notes.push("mutated");
    copy.enabled = false;

    // Original should be unaffected
    expect(freeModelFirstPolicy.enabled).toBe(true);
    expect(freeModelFirstPolicy.notes).not.toContain("mutated");
  });

  it("each call to getFreeModelFirstPolicy returns independent copy", () => {
    const copy1 = getFreeModelFirstPolicy();
    const copy2 = getFreeModelFirstPolicy();
    copy1.notes.push("from-copy-1");
    expect(copy2.notes).not.toContain("from-copy-1");
  });
});
