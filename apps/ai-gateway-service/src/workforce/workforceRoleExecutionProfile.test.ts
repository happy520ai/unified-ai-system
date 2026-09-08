import { describe, expect, it } from "vitest";
import { freezeWorkforceRoleExecutionProfile, readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { createWorkforceExecutionDescriptor } from "./workforceExecutionAuthorization.ts";

function draft() {
  return {
    version: 1, mode: "gateway-llm-required", profileId: "workforce-fixture-v1",
    maxTotalRequests: 2, maxConcurrentRoles: 2,
    bindings: ["backend-engineer", "code-reviewer"].map((roleId) => ({
      roleId, employeeId: `employee-${roleId}`, providerId: "fake", modelId: "fixture-model",
      maxRequests: 1, maxInputTokens: 8192, maxOutputTokens: 2048, timeoutMs: 30000,
    })),
  };
}

const DESCRIPTOR_INPUT = {
  input: { planId: "plan-ewf01-fixture", tenantId: "tenant-fixture" },
  plan: { goal: "Generate a bounded contribution", selectedRoles: ["backend-engineer", "code-reviewer"],
    selectedTemplate: "research-design-study" },
  autonomyMode: "controlled-execution",
};

describe("frozen Workforce role execution profile", () => {
  it("canonicalizes binding order, retains full review data, and freezes every mutable level", () => {
    const input = draft();
    const serializedBefore = JSON.stringify(input);
    const profile = freezeWorkforceRoleExecutionProfile(input);
    expect(profile.profileHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(freezeWorkforceRoleExecutionProfile({ ...draft(), bindings: [...draft().bindings].reverse() }).profileHash)
      .toBe(profile.profileHash);
    expect(profile.bindings[0]).toMatchObject({ providerId: "fake", modelId: "fixture-model", maxRequests: 1 });
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.bindings)).toBe(true);
    expect(profile.bindings.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(input)).toBe(serializedBefore);
    expect(readFrozenWorkforceRoleExecutionProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });

  it.each([0, -1, 0.5, NaN, Infinity, "2048"])("rejects invalid output limit %s", (value) => {
    const input = draft();
    expect(() => freezeWorkforceRoleExecutionProfile({ ...input,
      bindings: [{ ...input.bindings[0], maxOutputTokens: value }, input.bindings[1]],
    })).toThrow("Workforce role execution profile");
  });

  it("rejects unknown identity/credential fields and duplicate role bindings", () => {
    const input = draft();
    expect(() => freezeWorkforceRoleExecutionProfile({ ...input, agentRunId: "agr_untrusted" })).toThrow();
    expect(() => freezeWorkforceRoleExecutionProfile({ ...input,
      bindings: [{ ...input.bindings[0], apiKey: "synthetic-private-value" }, input.bindings[1]],
    })).toThrow();
    expect(() => freezeWorkforceRoleExecutionProfile({ ...input, bindings: [input.bindings[0], input.bindings[0]] })).toThrow();
    expect(() => freezeWorkforceRoleExecutionProfile({ ...input, maxConcurrentRoles: 3 })).toThrow();
    expect(() => freezeWorkforceRoleExecutionProfile({ ...input, maxTotalRequests: 3 })).toThrow();
  });

  it("requires a matching full profile rather than accepting a hash-only or modified review", () => {
    const profile = freezeWorkforceRoleExecutionProfile(draft());
    expect(() => readFrozenWorkforceRoleExecutionProfile({ profileHash: profile.profileHash })).toThrow();
    expect(() => readFrozenWorkforceRoleExecutionProfile({ ...profile,
      bindings: [{ ...profile.bindings[0], modelId: "replacement-model" }, profile.bindings[1]],
    })).toThrow();
    expect(() => readFrozenWorkforceRoleExecutionProfile({ ...profile, profileHash: `sha256:${"0".repeat(64)}` })).toThrow();
  });

  it("preserves the recorded v1 template digest and ignores client-supplied profile lookalikes", () => {
    const descriptor = createWorkforceExecutionDescriptor(DESCRIPTOR_INPUT);
    // Captured from the unmodified production helper at base commit 404647d9.
    expect(descriptor.planDigest).toBe("fd1895d60e00815634f4c179b1b36aea16bb37bec9428a0945e52aa281c4963d");
    expect(descriptor).not.toHaveProperty("roleExecution");
    expect(createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT,
      input: { ...DESCRIPTOR_INPUT.input, roleExecution: freezeWorkforceRoleExecutionProfile(draft()) },
    })).toEqual(descriptor);
  });

  it("binds the explicit server profile into a distinct descriptor digest", () => {
    const profile = freezeWorkforceRoleExecutionProfile(draft());
    const descriptor = createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT, roleExecution: profile });
    expect(descriptor.planDigest).not.toBe(createWorkforceExecutionDescriptor(DESCRIPTOR_INPUT).planDigest);
    expect(descriptor.roleExecution).toEqual(profile);
    const changed = draft();
    changed.bindings[0].maxOutputTokens = 4096;
    expect(createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT,
      roleExecution: freezeWorkforceRoleExecutionProfile(changed),
    }).planDigest).not.toBe(descriptor.planDigest);
  });
});
