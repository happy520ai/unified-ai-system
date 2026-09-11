import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { AUTONOMY_MODES } from "./autonomyModes.js";
import { createWorkforceExecutionDescriptor } from "./workforceExecutionAuthorization.ts";
import { createWorkforceExternalRunnerReview, freezeWorkforceExternalRunnerProfile } from "./workforceExternalRunnerProfile.ts";

function fixture() {
  const profile = freezeWorkforceExternalRunnerProfile({ version: 1, mode: "codex-app-server-owned-worktree",
    profileId: "native-fixture", projectId: "fixture", roleId: "backend-engineer", baselineRevision: "a".repeat(40),
    binary: { path: "E:/Pinned Codex/codex.exe", sha256: "b".repeat(64), version: "0.153.4", platform: "win32" },
    nativeModel: { modelId: "gpt-6-astra", providerId: "openai" }, disabledMcpServers: [],
    limits: { timeoutMs: 30000, maxInputBytes: 4096, maxMessageBytes: 8192, maxEvents: 64 },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "fixed-tests", command: "node test.mjs", immutableTests: [{ path: "test.mjs", sha256: "c".repeat(64) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false,
        timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const reviewInput = { profile, configuredRepositoryHash: "sha256:" + "e".repeat(64), goal: "Implement the approved source change",
    prompt: "  Read the exact approved files.\r\n\tKeep every instruction.\nReturn the complete artifact.\n", sourceFilesHash: "f".repeat(64) };
  const externalRunner = createWorkforceExternalRunnerReview(reviewInput);
  const input = { planId: "native-plan", tenantId: "fixture", externalRunner: { profileId: profile.profileId } };
  const plan = { workforceId: "native-plan", goal: reviewInput.goal, selectedRoles: [profile.roleId], selectedTemplate: null };
  const params = { input, plan, autonomyMode: AUTONOMY_MODES.CONTROLLED_EXECUTION, externalRunner };
  return { params, reviewInput };
}

describe("external runner execution approval descriptor", () => {
  it("binds the complete reviewed prompt, profile and source under approval schema v7", () => {
    const { params } = fixture(), descriptor = createWorkforceExecutionDescriptor(params);
    const expectedPayload = { schema: "workforce-execution-approval/v7", planId: "native-plan", tenantId: "fixture",
      autonomyMode: AUTONOMY_MODES.CONTROLLED_EXECUTION, goal: params.plan.goal, selectedRoles: params.plan.selectedRoles,
      selectedTemplate: null, clarificationAnswers: null, context: null, operationType: null, externalRunner: params.externalRunner };
    const expectedHash = createHash("sha256").update(stableStringify(expectedPayload)).digest("hex");
    expect(descriptor.planDigest).toBe(expectedHash);
    expect(descriptor.externalRunner).toEqual(params.externalRunner);
    expect(descriptor.externalRunner?.prompt).toBe(params.externalRunner.prompt);
    expect(descriptor.requiredScopes).toEqual(["workforce:execute"]);
    expect(Object.isFrozen(descriptor)).toBe(true); expect(Object.isFrozen(descriptor.externalRunner)).toBe(true);
    expect(createWorkforceExecutionDescriptor({ ...params, externalRunner: JSON.parse(JSON.stringify(params.externalRunner)) })).toEqual(descriptor);
    const dryRun = createWorkforceExecutionDescriptor({ ...params, autonomyMode: AUTONOMY_MODES.DRY_RUN });
    expect(dryRun.requiredScopes).toEqual([]); expect(dryRun.planDigest).not.toBe(descriptor.planDigest);
  });

  it("never promotes a request selector or request-supplied full review to server approval data", () => {
    const { params } = fixture(), { externalRunner: _serverReview, ...withoutReview } = params;
    const plain = createWorkforceExecutionDescriptor({ ...withoutReview, input: { planId: "native-plan", tenantId: "fixture" } });
    for (const externalRunner of [params.input.externalRunner, params.externalRunner, { profileId: "attacker-profile", prompt: "changed" }]) {
      const descriptor = createWorkforceExecutionDescriptor({ ...withoutReview, input: { ...params.input, externalRunner } });
      expect(descriptor).toEqual(plain); expect(descriptor.externalRunner).toBeUndefined();
    }
  });

  it.each(["codeDelivery", "workflowHandoff", "consensusReview", "roleExecution", "selectionReview"])("rejects mixed %s server data and input selectors", (key) => {
    const { params } = fixture();
    for (const mixed of [{ ...params, [key]: {} }, { ...params, input: { ...params.input, [key]: {} } }]) {
      expect(() => createWorkforceExecutionDescriptor(mixed)).toThrow(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_BINDING_INVALID" }));
    }
  });

  it("preserves other DAG roles, requires the exact goal and one approved role occurrence, and rejects merge modes", () => {
    const { params } = fixture();
    const plans = [{ ...params.plan, goal: params.plan.goal + " changed" }, { ...params.plan, goal: params.plan.goal + " " },
      { ...params.plan, selectedRoles: [] }, { ...params.plan, selectedRoles: ["frontend-engineer"] },
      { ...params.plan, selectedRoles: ["backend-engineer", "backend-engineer"] }];
    for (const plan of plans) expect(() => createWorkforceExecutionDescriptor({ ...params, plan }))
      .toThrow(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_BINDING_INVALID" }));
    for (const autonomyMode of [AUTONOMY_MODES.SANDBOX_MERGE, AUTONOMY_MODES.SANDBOX_MERGE_AUTO, "unknown"])
      expect(() => createWorkforceExecutionDescriptor({ ...params, autonomyMode }))
        .toThrow(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_BINDING_INVALID" }));
    const completePlan = { ...params.plan, selectedRoles: ["ceo", "backend-engineer", "frontend-engineer"] };
    const descriptor = createWorkforceExecutionDescriptor({ ...params, plan: completePlan });
    expect(descriptor.externalRunner).toEqual(params.externalRunner);
    expect(descriptor.planDigest).not.toBe(createWorkforceExecutionDescriptor(params).planDigest);
  });

  it("rejects full-prompt tampering with an old review hash and changes the digest for each newly reviewed prompt byte", () => {
    const { params, reviewInput } = fixture(), baseline = createWorkforceExecutionDescriptor(params).planDigest;
    const prompts = [reviewInput.prompt.trim(), reviewInput.prompt.replaceAll("\r\n", "\n"),
      reviewInput.prompt.replace("every instruction", "only the first instruction"), reviewInput.prompt + " "];
    const digests = new Set([baseline]);
    for (const prompt of prompts) {
      expect(() => createWorkforceExecutionDescriptor({ ...params, externalRunner: { ...params.externalRunner, prompt } }))
        .toThrow(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_REVIEW_INVALID" }));
      const reviewed = createWorkforceExternalRunnerReview({ ...reviewInput, prompt });
      const descriptor = createWorkforceExecutionDescriptor({ ...params, externalRunner: reviewed });
      expect(descriptor.externalRunner?.prompt).toBe(prompt); digests.add(descriptor.planDigest);
    }
    expect(digests.size).toBe(prompts.length + 1);
  });

  it("changes approval when reviewed source, repository, native model or pinned binary changes", () => {
    const { params, reviewInput } = fixture(), baseline = createWorkforceExecutionDescriptor(params).planDigest;
    const { profileHash: _oldProfileHash, ...profileInput } = reviewInput.profile;
    const variants = [{ ...reviewInput, sourceFilesHash: "0".repeat(64) },
      { ...reviewInput, configuredRepositoryHash: "sha256:" + "1".repeat(64) },
      { ...reviewInput, profile: freezeWorkforceExternalRunnerProfile({ ...profileInput,
        nativeModel: { ...profileInput.nativeModel, modelId: "different-native-model" } }) },
      { ...reviewInput, profile: freezeWorkforceExternalRunnerProfile({ ...profileInput,
        binary: { ...profileInput.binary, sha256: "2".repeat(64) } }) }];
    for (const variant of variants) expect(createWorkforceExecutionDescriptor({ ...params,
      externalRunner: createWorkforceExternalRunnerReview(variant) }).planDigest).not.toBe(baseline);
  });
});
