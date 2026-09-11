import { createHash } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createAgentApprovalStore } from "../agent-governance/agentApprovalStore.ts";
import { createWorkforceExecutionDescriptor } from "./workforceExecutionAuthorization.ts";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";

const helper = () => import("./workforceCodeDeliveryProfile.ts");
const hash = (value: unknown) => "sha256:" + createHash("sha256").update(stableStringify(value)).digest("hex");
const roles = () => freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required",
  profileId: "role-fixture", maxTotalRequests: 4, maxConcurrentRoles: 1, bindings: [
    { roleId: "backend-engineer", employeeId: "backend", providerId: "fake", modelId: "fake",
      maxRequests: 3, maxInputTokens: 100000, maxOutputTokens: 16384, timeoutMs: 30000 },
    { roleId: "code-reviewer", employeeId: "reviewer", providerId: "fake", modelId: "fake",
      maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 },
  ] });
function draft(): any {
  return { version: 1, mode: "forge-owned-worktree-artifact", profileId: "code-fixture", projectId: "owned-project",
    baselineRevision: "a".repeat(40), roleId: "backend-engineer",
    readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
    verification: { verificationId: "node-existing-test", command: "node --test test/value.test.mjs",
      immutableTests: [{ path: "test/value.test.mjs", sha256: "b".repeat(64) }],
      image: "node-fixture@sha256:" + "c".repeat(64), workspaceMode: "ro", networkAccess: false,
      timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
    artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } };
}
const descriptorInput = { input: { planId: "code-plan", tenantId: "tenant-fixture" },
  plan: { goal: "Implement the approved source change", selectedRoles: ["backend-engineer", "code-reviewer"], selectedTemplate: "feature-development" },
  autonomyMode: "controlled-execution" };

describe("server-owned code delivery profile contract", () => {
  it("keeps a complete immutable profile and canonicalizes path sets without mutating input", async () => {
    const { freezeWorkforceCodeDeliveryProfile, readFrozenWorkforceCodeDeliveryProfile } = await helper();
    const source = draft(), before = structuredClone(source);
    const profile = freezeWorkforceCodeDeliveryProfile(source);
    expect(profile).toEqual({ ...before, profileHash: hash(before) });
    expect(Object.isFrozen(profile)).toBe(true); expect(Object.isFrozen(profile.verification.immutableTests[0])).toBe(true);
    expect(Object.isFrozen(profile.writePaths)).toBe(true);
    expect(readFrozenWorkforceCodeDeliveryProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
    expect(freezeWorkforceCodeDeliveryProfile({ ...draft(), readPaths: [...draft().readPaths].reverse() })).toEqual(profile);
    source.writePaths[0] = "other.mjs"; source.verification.command = "changed";
    expect(profile.writePaths).toEqual(before.writePaths); expect(profile.verification.command).toBe(before.verification.command);
  });

  it.each(["../outside.mjs", "/absolute.mjs", "C:/outside.mjs", "src/file:stream", "src/CON.mjs",
    ".env", ".mcp.json", ".git/config", ".gitattributes", ".forge/state.json", "src/trailing.", "src//empty.mjs", "src/../bad.mjs"])
  ("rejects unsupported or protected exact path %s", async path => {
    const { freezeWorkforceCodeDeliveryProfile } = await helper();
    expect(() => freezeWorkforceCodeDeliveryProfile({ ...draft(), readPaths: [path, "test/value.test.mjs"], writePaths: [path] })).toThrow();
  });

  it("rejects overlapping tests, non-exact scopes, hash-only data and unsafe mutable fields", async () => {
    const { freezeWorkforceCodeDeliveryProfile, readFrozenWorkforceCodeDeliveryProfile } = await helper();
    const profile = freezeWorkforceCodeDeliveryProfile(draft());
    const changes = [
      { ...draft(), readPaths: ["src/**", "test/value.test.mjs"] },
      { ...draft(), writePaths: ["test/value.test.mjs"] },
      { ...draft(), writePaths: ["SRC/value.mjs"] },
      { ...draft(), readPaths: ["src/value.mjs", "src/value.mjs", "test/value.test.mjs"] },
      { ...draft(), root: "/caller" },
      { ...draft(), verification: { ...draft().verification, networkAccess: true } },
      { ...draft(), verification: { ...draft().verification, timeoutMs: "10000" } },
      { ...draft(), artifactLimits: { ...draft().artifactLimits, maxDiffBytes: Infinity } },
      { ...draft(), verification: { ...draft().verification, command: "TOKEN=synthetic-private-material" } },
    ];
    for (const value of changes) expect(() => freezeWorkforceCodeDeliveryProfile(value)).toThrow();
    const getter = { ...draft() }; Object.defineProperty(getter, "profileId", { enumerable: true, get() { throw new Error("must not invoke getter"); } });
    expect(() => freezeWorkforceCodeDeliveryProfile(getter)).toThrow(/profile/i);
    expect(() => readFrozenWorkforceCodeDeliveryProfile({ profileHash: profile.profileHash })).toThrow();
    expect(() => readFrozenWorkforceCodeDeliveryProfile({ ...profile, projectId: "changed" })).toThrow();
  });

  it("rejects duplicate and oversized server registries before constructing execution stores", () => {
    expect(() => createControlledExecutor({ codeDeliveryProfiles: [draft(), draft()] })).toThrow(/unique/);
    expect(() => createControlledExecutor({ codeDeliveryProfiles: Array.from({ length: 17 }, (_, i) => ({ ...draft(), profileId: "code-" + i })) })).toThrow(/sixteen/);
  });

  it("binds repository, complete profile and role budget into v4 while preserving the original descriptors", async () => {
    const { freezeWorkforceCodeDeliveryProfile, createWorkforceCodeDeliveryReview, readWorkforceCodeDeliveryReview } = await helper();
    const roleExecution = roles();
    const make = (source = draft(), rootHash = "sha256:" + "d".repeat(64)) => createWorkforceCodeDeliveryReview({
      profile: freezeWorkforceCodeDeliveryProfile(source), configuredRepositoryHash: rootHash, roleExecution });
    const codeDelivery = make();
    const legacy = createWorkforceExecutionDescriptor({ ...descriptorInput, roleExecution });
    const actual = createWorkforceExecutionDescriptor({ ...descriptorInput, roleExecution, codeDelivery });
    expect(actual.codeDelivery).toEqual(codeDelivery); expect(actual.planDigest).not.toBe(legacy.planDigest);
    expect(createWorkforceExecutionDescriptor({ ...descriptorInput, roleExecution,
      input: { ...descriptorInput.input, codeDelivery: { profile: codeDelivery, ready: true } } })).toEqual(legacy);
    for (const changed of [make({ ...draft(), baselineRevision: "e".repeat(40) }), make({ ...draft(), projectId: "other" }),
      make({ ...draft(), verification: { ...draft().verification, command: "node --test test/other.test.mjs" } }),
      make(draft(), "sha256:" + "f".repeat(64))]) {
      expect(createWorkforceExecutionDescriptor({ ...descriptorInput, roleExecution, codeDelivery: changed }).planDigest).not.toBe(actual.planDigest);
    }
    expect(readWorkforceCodeDeliveryReview(JSON.parse(JSON.stringify(codeDelivery)), roleExecution)).toEqual(codeDelivery);
    expect(() => readWorkforceCodeDeliveryReview({ ...codeDelivery, roleProfileHash: "sha256:" + "0".repeat(64) }, roleExecution)).toThrow();
  });

  it("rejects a role budget that cannot cover analysis, compilation and one worker", async () => {
    const { freezeWorkforceCodeDeliveryProfile, createWorkforceCodeDeliveryReview } = await helper();
    for (const change of ["requests", "total", "output", "role"]) {
      const source: any = structuredClone(roles()); delete source.profileHash;
      if (change === "requests") { source.bindings[0].maxRequests = 2; source.maxTotalRequests = 3; }
      if (change === "total") source.maxTotalRequests = 2;
      if (change === "output") source.bindings[0].maxOutputTokens = 1024;
      if (change === "role") source.bindings[0].roleId = "architect";
      expect(() => createWorkforceCodeDeliveryReview({ profile: freezeWorkforceCodeDeliveryProfile(draft()),
        configuredRepositoryHash: "sha256:" + "d".repeat(64), roleExecution: freezeWorkforceRoleExecutionProfile(source) })).toThrow();
    }
  });

  it("round-trips the complete code review in the real approval store and rejects altered options", async () => {
    const { freezeWorkforceCodeDeliveryProfile, createWorkforceCodeDeliveryReview } = await helper();
    const root = await mkdtemp(join(await realpath(tmpdir()), "code-review-store-"));
    try {
      const roleExecution = roles(), codeDelivery = createWorkforceCodeDeliveryReview({ profile: freezeWorkforceCodeDeliveryProfile(draft()),
        configuredRepositoryHash: "sha256:" + "d".repeat(64), roleExecution });
      const options = { selectedRoleCount: 2, templateSelected: true, roleExecution, codeDelivery };
      const goal = "Review a bounded code delivery profile", planId = "code-review-plan", planDigest = "a".repeat(64);
      const review: any = { schemaVersion: 1, reviewable: true, effectType: "workforce:execute", policyHash: "sha256:" + "7".repeat(64),
        workforce: { goal, goalDigest: hashText(goal), goalBytes: Buffer.byteLength(goal), planId, planDigest: "sha256:" + planDigest,
          autonomyMode: "controlled-execution", requiredScopes: ["workforce:execute"], optionsHash: hash(options), options } };
      const args = { goal, goalDigest: hashText(goal).slice(7), goalBytes: Buffer.byteLength(goal), planId, planDigest,
        options: { autonomyMode: "controlled-execution", requiredScopes: ["workforce:execute"], ...options } };
      const storePath = join(root, "approvals.json"), secret = "code-review-synthetic-approval-material";
      const store = createAgentApprovalStore({ storePath, secret });
      const entry = await store.create({ agentId: "agt_code_review", tenantId: "tenant-fixture", toolName: "workforce_execute", arguments: args, review });
      expect(entry.review.workforce?.options.codeDelivery).toEqual(codeDelivery);
      const reopened = createAgentApprovalStore({ storePath, secret });
      expect((await reopened.listPending())[0]?.review.workforce?.options.codeDelivery).toEqual(codeDelivery);
      for (const change of ["profile", "role", "unknown", "hash"]) {
        const altered = structuredClone(review);
        if (change === "profile") altered.workforce.options.codeDelivery.profile.projectId = "other";
        if (change === "role") altered.workforce.options.codeDelivery.roleProfileHash = "sha256:" + "e".repeat(64);
        if (change === "unknown") altered.workforce.options.codeDelivery.ready = true;
        if (change === "hash") altered.workforce.optionsHash = "sha256:" + "0".repeat(64);
        await expect(store.create({ agentId: "agt_code_review", tenantId: "tenant-fixture", toolName: "workforce_execute", arguments: args, review: altered })).rejects.toThrow();
      }
    } finally {
      expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
      await rm(root, { recursive: true, force: true });
    }
  });
});
function hashText(value: string) { return "sha256:" + createHash("sha256").update(value).digest("hex"); }
