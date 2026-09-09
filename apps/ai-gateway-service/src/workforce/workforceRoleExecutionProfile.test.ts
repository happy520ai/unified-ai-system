import { describe, expect, it } from "vitest";
import { freezeWorkforceRoleExecutionProfile, readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { createWorkforceExecutionDescriptor } from "./workforceExecutionAuthorization.ts";
import { createRuntimeEmployeeSelector } from "@unified-ai-system/workforce-scheduler";
import { createWorkforceSelectionFeedback, isTrustedWorkforceSelectionFeedback, readFrozenWorkforceSelectionReview } from "./workforceSelectionReview.ts";
import { createLogRedactor } from "./logRedactor.js";

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

  it("freezes a complete selection review and binds catalog, qualification and targets into approval", () => {
    const create = (revision = "r1", evidence = "e") => {
      const candidates = ["ceo", "pm"].map(roleId => ({ employeeId: "emp-" + roleId, status: "enabled", roleIds: [roleId],
        taskTypes: ["feature-development"], providerId: "fake", modelId: "fixture-model", priority: 0,
        limits: { maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 } }));
      const selectionReview = createRuntimeEmployeeSelector({ version: 1, catalogId: "accepted-fixture", catalogRevision: revision,
        maxCandidates: 5, maxSelectedRoles: 3, maxConcurrentRoles: 1, maxTotalRequests: 2, candidates,
        qualifications: candidates.map(item => ({ qualificationId: "q-" + item.employeeId, employeeId: item.employeeId,
          providerId: item.providerId, modelId: item.modelId, roleIds: item.roleIds, taskTypes: item.taskTypes, status: "accepted",
          origin: "synthetic", executionMode: "fake", evidenceHash: "sha256:" + evidence.repeat(64), validUntil: "2099-01-01T00:00:00.000Z" })),
      }).select({ taskType: "feature-development", roleIds: ["ceo", "pm"], executionMode: "fake" });
      const roleExecution = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required",
        profileId: "selection-" + selectionReview.selectionHash.slice(7), maxTotalRequests: 2, maxConcurrentRoles: 1,
        bindings: selectionReview.assignments.map(item => item.binding) });
      return { roleExecution, selectionReview };
    };
    const selected = create(); const plan = { ...DESCRIPTOR_INPUT.plan, selectedRoles: ["ceo", "pm"] };
    const descriptor = createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT, plan, ...selected });
    expect(descriptor.selectionReview).toEqual(selected.selectionReview);
    expect(Object.isFrozen(descriptor.selectionReview?.assignments[0].qualification)).toBe(true);
    expect(createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT, plan, ...create("r2") }).planDigest).not.toBe(descriptor.planDigest);
    expect(createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT, plan, ...create("r1", "f") }).planDigest).not.toBe(descriptor.planDigest);
    expect(createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT, plan, roleExecution: selected.roleExecution }).planDigest).not.toBe(descriptor.planDigest);
    for (const field of ["catalogHash", "selectionHash"]) {
      expect(() => readFrozenWorkforceSelectionReview({ ...selected.selectionReview, [field]: "sha256:" + "0".repeat(64) }, selected.roleExecution)).toThrow();
    }
    expect(() => createWorkforceExecutionDescriptor({ ...DESCRIPTOR_INPUT, ...selected })).toThrow();
    const changed = structuredClone(selected.selectionReview) as any;
    changed.assignments[0].qualification.validUntil = "2098-01-01T00:00:00.000Z";
    expect(() => readFrozenWorkforceSelectionReview(changed, selected.roleExecution)).toThrow();
    const receipt = { version: 1 as const, level: "gateway-provider-operation" as const, status: "blocked" as const,
      executionMode: "fake" as const, gatewayRequestId: null, providerId: "fake", modelId: "fixture-model", providerCallAttempted: false,
      inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null, errorCode: "FIXTURE_BLOCKED" };
    const input = { selection: selected.selectionReview, profile: selected.roleExecution, executionId: "wf-scope-" + "a".repeat(64),
      roleId: "ceo", employeeId: "emp-ceo", taskId: "task-fixture", receipt };
    const feedback = createWorkforceSelectionFeedback(input);
    const redactor = createLogRedactor() as { redactObject(value: unknown): any; redactString(value: string): string };
    expect(isTrustedWorkforceSelectionFeedback(feedback)).toBe(true);
    expect(Object.isFrozen(feedback) && Object.isFrozen(feedback.receipt)).toBe(true);
    expect(redactor.redactObject({ feedback }).feedback).toEqual(feedback);
    const forged = { ...structuredClone(feedback), source: "sk-synthetic-private-source-value", request: "Bearer synthetic-private-request-value" };
    expect(isTrustedWorkforceSelectionFeedback(forged)).toBe(false);
    expect(redactor.redactObject(forged).selectionHash).not.toBe(feedback.selectionHash);
    expect(JSON.stringify(redactor.redactObject(forged))).not.toContain("synthetic-private");
    expect(redactor.redactString("a".repeat(64))).not.toBe("a".repeat(64));
    expect(() => createWorkforceSelectionFeedback({ ...input, source: "untrusted original content" } as any)).toThrow();
    expect(() => createWorkforceSelectionFeedback({ ...input, receipt: { ...receipt, request: "untrusted original content" } } as any)).toThrow();
    expect(() => createWorkforceSelectionFeedback({ ...input, taskId: "sk-synthetic-private-source-value" })).toThrow();
    let hashReads = 0;
    const unstableProfile = { ...selected.roleExecution };
    Object.defineProperty(unstableProfile, "profileHash", { enumerable: true, get() {
      return ++hashReads === 1 ? selected.roleExecution.profileHash : "sk-synthetic-private-source-value";
    } });
    expect(() => createWorkforceSelectionFeedback({ ...input, profile: unstableProfile, contribution: null })).toThrow();
    expect(hashReads).toBe(0);
  });
});
