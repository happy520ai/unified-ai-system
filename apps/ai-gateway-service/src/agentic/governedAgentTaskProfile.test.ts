import { describe, expect, it, vi } from "vitest";
import { externalRunnerHash } from "../workforce/workforceExternalRunnerProfile.ts";
import { nodeTestMinimumOutputBytes } from "../workforce/workforceNodeTestVerification.ts";
import { createGovernedAgentTaskReview, freezeGovernedAgentTaskProfile, governedAgentTaskArtifactPolicy,
  parseGovernedAgentTaskPlan, readGovernedAgentTaskPlan, readGovernedAgentTaskProfile, readGovernedAgentTaskReview,
  readGovernedAgentTaskSelector, freezeGovernedAgentTaskVerificationResult, renderGovernedAgentTaskNodeTestCommand } from "./governedAgentTaskProfile.ts";
import type { GovernedAgentTaskProfileInput, GovernedAgentTaskReview } from "./governedAgentTaskProfile.ts";

function draft(): GovernedAgentTaskProfileInput {
  return { version: 1, mode: "governed-agent-long-task", profileId: "bounded-code", projectId: "owned-project", baselineRevision: "a".repeat(40),
    model: { providerId: "local-fake-provider", modelId: "local-fake-model", maxInputTokens: 8192, maxOutputTokens: 4096 },
    limits: { maxPlanSteps: 8, maxIterations: 6, maxModelCalls: 7, maxTotalTokens: 32768, maxRepairAttempts: 2, chunkTimeoutMs: 30000, maxInputBytes: 4096 },
    verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1,
      requiredChecks: [{ file: "test/two.test.mjs", name: "second required check" }, { file: "test/one.test.mjs", name: "first required check" }] },
    artifact: { readPaths: ["test/two.test.mjs", "src/two.mjs", "test/one.test.mjs", "src/one.mjs"], writePaths: ["src/two.mjs", "src/one.mjs"],
      verification: { verificationId: "immutable-tests", command: "node --test 'test/one.test.mjs' 'test/two.test.mjs'",
        immutableTests: [{ path: "test/two.test.mjs", sha256: "b".repeat(64) }, { path: "test/one.test.mjs", sha256: "c".repeat(64) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 2, maxFileBytes: 8192, maxDiffBytes: 16384 } } };
}
function reviewInput(profile = freezeGovernedAgentTaskProfile(draft())) {
  return { profile, configuredRepositoryHash: "sha256:" + "e".repeat(64), goal: "  Implement both bounded files.\r\nKeep this complete goal.\n",
    prompt: "  Full original source prompt.\r\n\t保留全部内容。\nFinal original line.\n", sourceFilesHash: "f".repeat(64) };
}
function proposed(review: GovernedAgentTaskReview) {
  return { version: 1, reviewHash: review.reviewHash, steps: [
    { id: "inspect-source", kind: "inspect", title: "Read both source files", paths: ["src/one.mjs", "src/two.mjs"] },
    { id: "implement-first", kind: "implement", title: "Implement the first source", paths: ["src/one.mjs"] },
    { id: "implement-second", kind: "implement", title: "Implement the second source", paths: ["src/two.mjs"] },
    { id: "verify-all", kind: "verify", title: "Run the fixed independent tests", paths: ["test/two.test.mjs", "test/one.test.mjs"] },
  ] };
}
function frozen(value: unknown): void {
  if (value && typeof value === "object") { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen); }
}

describe("pure governed Agent long-task profile", () => {
  it("rejects an undersized complete result budget before execution even when 64 Unicode names fit the input", () => {
    const input = draft(), paths = input.artifact.verification.immutableTests.map(test => test.path);
    const roomy = { ...input, model: { ...input.model, maxInputTokens: 65536 },
      limits: { ...input.limits, maxInputBytes: 131072, maxTotalTokens: 487424 },
      artifact: { ...input.artifact, verification: { ...input.artifact.verification, maxOutputBytes: 65536 } } };
    const requiredChecks = Array.from({ length: 64 }, (_, index) => ({ file: paths[index % paths.length]!, name: "界".repeat(253) + String(index).padStart(2, "0") }));
    const extreme = freezeGovernedAgentTaskVerificationResult({ ...input.verificationResult, requiredChecks }, paths);
    expect(extreme.requiredChecks).toHaveLength(64);
    expect(Buffer.byteLength(JSON.stringify(extreme), "utf8")).toBeLessThan(65536);
    expect(nodeTestMinimumOutputBytes(extreme)).toBeGreaterThan(65536);
    expect(() => freezeGovernedAgentTaskProfile({ ...roomy, verificationResult: extreme }))
      .toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_PROFILE_INVALID" }));
    const moderate = freezeGovernedAgentTaskVerificationResult({ ...input.verificationResult,
      requiredChecks: requiredChecks.map((check, index) => ({ ...check, name: "check-" + index })) }, paths);
    expect(nodeTestMinimumOutputBytes(moderate)).toBeLessThanOrEqual(65536);
    expect(freezeGovernedAgentTaskProfile({ ...roomy, verificationResult: moderate }).verificationResult.requiredChecks).toHaveLength(64);
    expect(nodeTestMinimumOutputBytes(input.verificationResult)).toBeGreaterThan(1024);
    expect(() => freezeGovernedAgentTaskProfile({ ...input, artifact: { ...input.artifact,
      verification: { ...input.artifact.verification, maxOutputBytes: 1024 } } }))
      .toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_PROFILE_INVALID" }));
  });

  it("binds required executed checks into the profile and review and rejects old exit-only profiles", () => {
    const input = draft(), profile = freezeGovernedAgentTaskProfile(input);
    expect(profile.verificationResult.requiredChecks).toEqual([...input.verificationResult.requiredChecks].reverse());
    frozen(profile.verificationResult);
    expect(freezeGovernedAgentTaskVerificationResult(JSON.parse(JSON.stringify(profile.verificationResult)), ["test/two.test.mjs", "test/one.test.mjs"]))
      .toEqual(profile.verificationResult);
    const { verificationResult: _required, ...legacy } = input;
    expect(() => freezeGovernedAgentTaskProfile(legacy)).toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_PROFILE_INVALID" }));
    for (const changed of [{ ...input.verificationResult, minimumPassed: 2 }, { ...input.verificationResult,
      requiredChecks: input.verificationResult.requiredChecks.map(check => ({ ...check, name: check.name + " exact" })) }]) {
      const updated = freezeGovernedAgentTaskProfile({ ...input, verificationResult: changed });
      expect(updated.profileHash).not.toBe(profile.profileHash);
      expect(createGovernedAgentTaskReview(reviewInput(updated)).reviewHash).not.toBe(createGovernedAgentTaskReview(reviewInput(profile)).reviewHash);
      expect(() => readGovernedAgentTaskProfile({ ...profile, verificationResult: changed })).toThrow();
    }
  });

  it("requires bounded unique safe named checks for every immutable file and never calls getters", () => {
    const input = draft(), paths = input.artifact.verification.immutableTests.map(test => test.path), original = input.verificationResult;
    const first = original.requiredChecks[0]!;
    for (const minimumPassed of [0, -1, 10001, 1.5, "1", null, NaN, Infinity]) {
      expect(() => freezeGovernedAgentTaskVerificationResult({ ...original, minimumPassed }, paths)).toThrow();
    }
    expect(freezeGovernedAgentTaskVerificationResult({ ...original, minimumPassed: 10000 }, paths).minimumPassed).toBe(10000);
    for (const requiredChecks of [[], [first], [...original.requiredChecks, first], [{ file: "src/one.mjs", name: "not immutable" }, first],
      Array.from({ length: 65 }, (_, index) => ({ file: paths[index % paths.length], name: "case " + index }))]) {
      expect(() => freezeGovernedAgentTaskVerificationResult({ ...original, requiredChecks }, paths)).toThrow();
    }
    for (const name of ["", " ", "n".repeat(257), "line\ncontrol", "tab\tcontrol", "bad\u202ename", "bad\ud800", "Bearer private-test-fixture-value"]) {
      expect(() => freezeGovernedAgentTaskVerificationResult({ ...original, requiredChecks: [{ ...first, name }, original.requiredChecks[1]] }, paths)).toThrow();
    }
    for (const patch of [{ adapter: "tap-text" }, { version: 2 }, { expectedStdout: "passed" }]) {
      expect(() => freezeGovernedAgentTaskVerificationResult({ ...original, ...patch }, paths)).toThrow();
    }
    const getter = vi.fn();
    expect(() => freezeGovernedAgentTaskVerificationResult({ ...original, requiredChecks: [Object.defineProperty({ ...first }, "name", { enumerable: true, get: getter }), original.requiredChecks[1]] }, paths)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });

  it("accepts only the canonical adapter command with quoted sorted test files", () => {
    const input = draft();
    expect(renderGovernedAgentTaskNodeTestCommand(["test/two.test.mjs", "test/one.test.mjs"])).toBe(input.artifact.verification.command);
    expect(renderGovernedAgentTaskNodeTestCommand(["test/it's 中文.test.mjs"])).toBe("node --test 'test/it'\\''s 中文.test.mjs'");
    for (const command of ["node test/one.test.mjs", "node --test test/one.test.mjs test/two.test.mjs",
      "node --test 'test/two.test.mjs' 'test/one.test.mjs'", input.artifact.verification.command + " --test-name-pattern=absent",
      input.artifact.verification.command + "; echo passed", "echo done"]) {
      expect(() => freezeGovernedAgentTaskProfile({ ...input, artifact: { ...input.artifact, verification: { ...input.artifact.verification, command } } })).toThrow();
    }
  });

  it("normalizes existing artifact policy, freezes independent data and hashes every model/budget field", () => {
    const input = draft(), original = structuredClone(input), profile = freezeGovernedAgentTaskProfile(input);
    expect(input).toEqual(original); frozen(profile);
    expect(profile.artifact.readPaths).toEqual(["src/one.mjs", "src/two.mjs", "test/one.test.mjs", "test/two.test.mjs"]);
    const { profileHash, ...body } = profile; expect(profileHash).toBe(externalRunnerHash(body));
    expect(readGovernedAgentTaskProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
    const policy = governedAgentTaskArtifactPolicy(profile); expect(policy).toMatchObject({ ...profile.artifact, profileId: profile.profileId, projectId: profile.projectId, baselineRevision: profile.baselineRevision });
    expect(profile.mode).toBe("governed-agent-long-task"); expect(profile.artifact).not.toHaveProperty("mode"); expect(profile).not.toHaveProperty("executionAllowed");
    for (const change of [{ model: { ...input.model, modelId: "another-fixed-model" } }, { limits: { ...input.limits, maxTotalTokens: 65536 } },
      { projectId: "another-project" }, { baselineRevision: "b".repeat(40) }]) expect(freezeGovernedAgentTaskProfile({ ...input, ...change }).profileHash).not.toBe(profileHash);
  });

  it("enforces exact integer ranges and reserves at least one planning call and one complete model-call budget", () => {
    const input = draft();
    for (const patch of [{ maxPlanSteps: 2 }, { maxPlanSteps: 17 }, { maxIterations: 0 }, { maxIterations: 101 }, { maxIterations: 100, maxModelCalls: 100 },
      { maxModelCalls: input.limits.maxIterations }, { maxModelCalls: 101 }, { maxModelCalls: 1 }, { maxTotalTokens: 12287 }, { maxTotalTokens: 0 },
      { maxTotalTokens: Infinity }, { maxRepairAttempts: -1 }, { maxRepairAttempts: 4 }, { chunkTimeoutMs: 999 }, { chunkTimeoutMs: 120001 },
      { maxInputBytes: 1023 }, { maxInputBytes: 524289 }, { maxIterations: 1.5 }, { maxPlanSteps: "3" }]) {
      expect(() => freezeGovernedAgentTaskProfile({ ...input, limits: { ...input.limits, ...patch } })).toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_PROFILE_INVALID" }));
    }
    expect(freezeGovernedAgentTaskProfile({ ...input, limits: { ...input.limits, maxPlanSteps: 3, maxIterations: 1, maxModelCalls: 2, maxTotalTokens: 12288,
      maxRepairAttempts: 0, chunkTimeoutMs: 1000, maxInputBytes: 1024 } }).limits.maxTotalTokens).toBe(12288);
    expect(freezeGovernedAgentTaskProfile({ ...input, limits: { ...input.limits, maxPlanSteps: 16, maxIterations: 99, maxModelCalls: 100,
      maxRepairAttempts: 3, chunkTimeoutMs: 120000, maxInputBytes: 524288 } }).limits.maxModelCalls).toBe(100);
    for (const model of [{ ...input.model, maxInputTokens: 0 }, { ...input.model, maxOutputTokens: -1 }, { ...input.model, maxInputTokens: Number.MAX_SAFE_INTEGER },
      { ...input.model, modelId: "not a fixed model" }, { ...input.model, providerId: { toString: () => "unsafe" } }]) expect(() => freezeGovernedAgentTaskProfile({ ...input, model })).toThrow();
  });

  it("retains protected paths, immutable tests, pinned image and networkless verification restrictions", () => {
    const input = draft();
    for (const path of [".env", ".mcp.json", ".git/config", "../escape.mjs", "src/**", "private.key", "state.sqlite"]) {
      expect(() => freezeGovernedAgentTaskProfile({ ...input, artifact: { ...input.artifact, readPaths: [path, "test/one.test.mjs"], writePaths: [path] } })).toThrow();
    }
    for (const verification of [{ ...input.artifact.verification, immutableTests: [] }, { ...input.artifact.verification, networkAccess: true },
      { ...input.artifact.verification, image: "node:latest" }, { ...input.artifact.verification, workspaceMode: "rw" }]) {
      expect(() => freezeGovernedAgentTaskProfile({ ...input, artifact: { ...input.artifact, verification } })).toThrow();
    }
    expect(() => freezeGovernedAgentTaskProfile({ ...input, artifact: { ...input.artifact, writePaths: ["test/one.test.mjs"] } })).toThrow();
    for (const extra of [{ env: {} }, { commands: ["unapproved"] }, { permissions: {} }, { execute: () => true }]) expect(() => freezeGovernedAgentTaskProfile({ ...input, ...extra })).toThrow();
  });

  it("accepts only a raw profileId selector and never invokes getters or coercions", () => {
    expect(readGovernedAgentTaskSelector(undefined)).toBeUndefined(); expect(readGovernedAgentTaskSelector({ profileId: "bounded-code" })).toBe("bounded-code");
    const called = vi.fn(() => "bounded-code"), accessor = Object.defineProperty({}, "profileId", { enumerable: true, get: called });
    for (const value of [null, false, "bounded-code", {}, accessor, { profileId: { toString: called } }, { profileId: "bounded-code", command: "unapproved" },
      { profileId: "../escape" }, { profileId: "bounded-code", paths: [] }]) expect(() => readGovernedAgentTaskSelector(value)).toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_SELECTOR_INVALID" }));
    const input = draft(), getterProfile = Object.defineProperty({ ...input }, "limits", { enumerable: true, get: called });
    expect(() => freezeGovernedAgentTaskProfile(getterProfile)).toThrow();
    expect(() => freezeGovernedAgentTaskProfile({ ...input, [Symbol("extra")]: true })).toThrow(); expect(called).not.toHaveBeenCalled();
  });
});

describe("complete governed long-task review", () => {
  it("preserves all original whitespace/source fingerprints and rejects rehashed-field drift", () => {
    const input = reviewInput(), review = createGovernedAgentTaskReview(input); frozen(review);
    expect(review.goal).toBe(input.goal); expect(review.prompt).toBe(input.prompt); expect(review.sourceFilesHash).toBe(input.sourceFilesHash);
    const { reviewHash, ...body } = review; expect(reviewHash).toBe(externalRunnerHash(body));
    expect(readGovernedAgentTaskReview(JSON.parse(JSON.stringify(review)))).toEqual(review);
    for (const patch of [{ goal: input.goal + "One more condition." }, { prompt: input.prompt + "One more line." },
      { sourceFilesHash: "0".repeat(64) }, { configuredRepositoryHash: "sha256:" + "0".repeat(64) }]) {
      expect(createGovernedAgentTaskReview({ ...input, ...patch }).reviewHash).not.toBe(reviewHash);
      expect(() => readGovernedAgentTaskReview({ ...review, ...patch })).toThrow();
    }
    expect(() => readGovernedAgentTaskProfile({ ...input.profile, model: { ...input.profile.model, modelId: "changed" } })).toThrow();
    expect(() => readGovernedAgentTaskReview({ ...review, command: "unapproved" })).toThrow();
  });

  it("rejects unsafe, oversized and invalid Unicode input instead of truncating or exposing it", () => {
    const input = reviewInput(), limit = input.profile.limits.maxInputBytes;
    expect(createGovernedAgentTaskReview({ ...input, prompt: "x".repeat(limit) }).prompt).toHaveLength(limit);
    for (const [index, prompt] of ["x".repeat(limit + 1), "中".repeat(Math.ceil(limit / 3)), "password=private-fixture", "Bearer fixture-sensitive-material",
      "text\u0000end", "text\u202eend", "text\rbare", "bad\ud800"].entries()) {
      let caught: unknown;
      try { createGovernedAgentTaskReview({ ...input, prompt }); } catch (error) { caught = error; }
      expect(caught, "unsafe review fixture " + index).toMatchObject({ code: "AGENT_LONG_TASK_REVIEW_INVALID" });
      expect((caught as Error).message).not.toContain(prompt);
    }
    const getter = vi.fn();
    expect(() => createGovernedAgentTaskReview(Object.defineProperty({ ...input }, "prompt", { enumerable: true, get: getter }))).toThrow(); expect(getter).not.toHaveBeenCalled();
  });
});

describe("closed model-generated long-task plan", () => {
  it("keeps all steps and path order, covers exact writes/tests, and binds the complete reviewed task", () => {
    const review = createGovernedAgentTaskReview(reviewInput()), input = proposed(review), plan = parseGovernedAgentTaskPlan(JSON.stringify(input), review);
    expect(plan.steps).toEqual(input.steps); frozen(plan);
    const { planHash, ...body } = plan; expect(planHash).toBe(externalRunnerHash(body));
    expect(readGovernedAgentTaskPlan(JSON.parse(JSON.stringify(plan)), review)).toEqual(plan);
    expect(plan).not.toHaveProperty("approved"); expect(plan).not.toHaveProperty("verified"); expect(plan.steps[2]).not.toHaveProperty("success");
    const changedReview = createGovernedAgentTaskReview({ ...reviewInput(), prompt: "Different full prompt" });
    expect(() => readGovernedAgentTaskPlan(plan, changedReview)).toThrow();
    expect(() => readGovernedAgentTaskPlan({ ...plan, steps: [...plan.steps.slice(0, 3), { ...plan.steps[3], title: "Changed verification" }] }, review)).toThrow();
  });

  it("requires all three phases in order, unique IDs and exact complete implementation/test coverage", () => {
    const review = createGovernedAgentTaskReview(reviewInput()), input = proposed(review), steps = input.steps;
    const badSteps = [steps.slice(1), steps.slice(0, -1), [steps[0], steps[3], steps[1], steps[2]],
      [steps[0], steps[1], steps[0], steps[2], steps[3]], [steps[0], steps[1], steps[3]],
      [steps[0], steps[1], steps[2], { ...steps[3], paths: ["test/one.test.mjs"] }],
      [steps[0], { ...steps[1], paths: ["test/one.test.mjs"] }, steps[2], steps[3]],
      [{ ...steps[0], paths: ["src/../src/one.mjs"] }, ...steps.slice(1)],
      [...steps.slice(0, 3), { ...steps[3], paths: ["src/one.mjs"] }],
      [{ ...steps[0], paths: [] }, ...steps.slice(1)], [{ ...steps[0], paths: ["src/one.mjs", "src/one.mjs"] }, ...steps.slice(1)],
      [steps[0], { ...steps[1], id: steps[0]!.id }, steps[2], steps[3]]];
    for (const value of badSteps) expect(() => parseGovernedAgentTaskPlan(JSON.stringify({ ...input, steps: value }), review)).toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_PLAN_INVALID" }));
    const splitInspection = [steps[0], { ...steps[0], id: "inspect-again", paths: ["test/one.test.mjs"] }, ...steps.slice(1)];
    expect(parseGovernedAgentTaskPlan(JSON.stringify({ ...input, steps: splitInspection }), review).steps).toHaveLength(5);
  });

  it("rejects command/permission/success fields, unsafe titles and step counts beyond the reviewed maximum", () => {
    const review = createGovernedAgentTaskReview(reviewInput()), input = proposed(review);
    for (const patch of [{ command: "node unapproved.mjs" }, { permissions: ["write"] }, { success: true }, { kind: "shell" },
      { title: "x".repeat(257) }, { title: "password=private-fixture" }, { title: "two\nlines" }, { id: "x".repeat(65) }]) {
      expect(() => parseGovernedAgentTaskPlan(JSON.stringify({ ...input, steps: [{ ...input.steps[0], ...patch }, ...input.steps.slice(1)] }), review)).toThrow();
    }
    const tooMany = [...Array.from({ length: 6 }, (_, index) => ({ ...input.steps[0], id: "inspect-" + index })), ...input.steps.slice(1)];
    expect(() => parseGovernedAgentTaskPlan(JSON.stringify({ ...input, steps: tooMany }), review)).toThrow();
    expect(() => parseGovernedAgentTaskPlan(JSON.stringify({ ...input, approved: true }), review)).toThrow();
  });

  it("parses the entire strict JSON document, rejecting fences, prose, duplicate keys and malformed data", () => {
    const review = createGovernedAgentTaskReview(reviewInput()), input = proposed(review), json = JSON.stringify(input);
    expect(parseGovernedAgentTaskPlan(" \n" + json + "\n ", review).steps).toHaveLength(4);
    for (const source of ["Here is the plan: " + json, "```json\n" + json + "\n```", json + " trailing", json + json, JSON.stringify(input.steps),
      json.replace('"version":1', '"version":1,"version":1'), json.replace('"id":"inspect-source"', '"id":"discarded","id":"inspect-source"'),
      json.replace('"version":1', '"version":1/*comment*/'), json.replace('"version":1', '"version":1,'), json.slice(0, -1),
      '['.repeat(17) + '0' + ']'.repeat(17), " ".repeat(1048577) + json]) {
      expect(() => parseGovernedAgentTaskPlan(source, review)).toThrowError(expect.objectContaining({ code: "AGENT_LONG_TASK_PLAN_INVALID" }));
    }
    const plan = parseGovernedAgentTaskPlan(json, review), getter = vi.fn();
    const accessor = Object.defineProperty({ ...plan.steps[0] }, "title", { enumerable: true, get: getter });
    expect(() => readGovernedAgentTaskPlan({ ...plan, steps: [accessor, ...plan.steps.slice(1)] }, review)).toThrow(); expect(getter).not.toHaveBeenCalled();
  });
});
