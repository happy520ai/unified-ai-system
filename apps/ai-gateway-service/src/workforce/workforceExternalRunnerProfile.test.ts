import { describe, expect, it, vi } from "vitest";
import type { WorkforceExternalRunnerProfileInput } from "@unified-ai-system/shared-contracts";
import { createWorkforceExternalRunnerReview, externalRunnerArtifactPolicy, externalRunnerHash,
  freezeWorkforceExternalRunnerProfile, readWorkforceExternalRunnerProfile, readWorkforceExternalRunnerReview,
  readWorkforceExternalRunnerSelector } from "./workforceExternalRunnerProfile.ts";

function draft(): WorkforceExternalRunnerProfileInput {
  return { version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-code", projectId: "owned-project", roleId: "backend-engineer",
    baselineRevision: "a".repeat(40), binary: { path: "E:/Pinned Codex/codex.exe", sha256: "b".repeat(64), version: "0.153.4", platform: "win32" },
    nativeModel: { modelId: "gpt-6-astra", providerId: "openai" }, disabledMcpServers: ["zeta", "alpha"],
    limits: { timeoutMs: 30000, maxInputBytes: 4096, maxMessageBytes: 8192, maxEvents: 64 },
    artifact: { readPaths: ["test/value.test.mjs", "src/value.mjs"], writePaths: ["src/value.mjs"],
      verification: { verificationId: "node-existing-test", command: "node --test test/value.test.mjs",
        immutableTests: [{ path: "test/value.test.mjs", sha256: "c".repeat(64) }], image: "node-image@sha256:" + "d".repeat(64),
        workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } } };
}
function reviewInput(profile = freezeWorkforceExternalRunnerProfile(draft())) {
  return { profile, configuredRepositoryHash: "sha256:" + "e".repeat(64), goal: "Implement the approved source change",
    prompt: "  Read the approved files.\r\nKeep every line.\n\tReturn the complete result.\n", sourceFilesHash: "f".repeat(64) };
}
function expectFrozen(value: unknown): void {
  if (value !== null && typeof value === "object") { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(expectFrozen); }
}

describe("native external runner profile and review", () => {
  it("normalizes immutable policy without changing input or claiming native execution was Forge", () => {
    const input = draft(), before = structuredClone(input), profile = freezeWorkforceExternalRunnerProfile(input);
    expect(input).toEqual(before); expect(profile.binary.path).toBe("E:\\Pinned Codex\\codex.exe");
    expect(profile.disabledMcpServers).toEqual(["alpha", "zeta"]); expect(profile.artifact.readPaths).toEqual(["src/value.mjs", "test/value.test.mjs"]);
    expect(profile.nativeModel).toEqual(before.nativeModel); expectFrozen(profile);
    const { profileHash, ...body } = profile; expect(profileHash).toBe(externalRunnerHash(body));
    expect(readWorkforceExternalRunnerProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
    const policy = externalRunnerArtifactPolicy(profile);
    expect(policy).toMatchObject({ mode: "forge-owned-worktree-artifact", profileId: profile.profileId, projectId: profile.projectId,
      roleId: profile.roleId, baselineRevision: profile.baselineRevision, ...profile.artifact });
    expect(profile.mode).toBe("codex-app-server-owned-worktree");
    expect(Object.hasOwn(profile.artifact, "mode")).toBe(false);
    expect(freezeWorkforceExternalRunnerProfile({ ...before, disabledMcpServers: ["alpha", "zeta"] })).toEqual(profile);
  });

  it("binds each supported executable platform, exact version, binary hash and native model metadata", () => {
    const source = draft(), original = freezeWorkforceExternalRunnerProfile(source);
    for (const platform of ["linux", "darwin"] as const) {
      const profile = freezeWorkforceExternalRunnerProfile({ ...source, binary: { ...source.binary, platform, path: "/opt/codex/bin/codex" } });
      expect(profile.binary.platform).toBe(platform); expect(profile.binary.path).toBe("/opt/codex/bin/codex");
      expect(profile.profileHash).not.toBe(original.profileHash);
    }
    const variants = [{ ...source, nativeModel: { ...source.nativeModel, modelId: "different-native-model" } },
      { ...source, binary: { ...source.binary, sha256: "0".repeat(64) } }];
    for (const value of variants) expect(freezeWorkforceExternalRunnerProfile(value).profileHash).not.toBe(original.profileHash);
    for (const binary of [{ ...source.binary, version: "0.154.0" }, { ...source.binary, path: "./codex.exe" },
      { ...source.binary, path: "E:/tools/../codex.exe" }, { ...source.binary, path: "E:/tools/other.exe" },
      { ...source.binary, path: "\\\\server\\share\\codex.exe" }, { ...source.binary, sha256: "sha256:" + "a".repeat(64) },
      { ...source.binary, platform: "linux", path: "/opt/codex.exe" }]) expect(() => freezeWorkforceExternalRunnerProfile({ ...source, binary })).toThrow();
  });

  it("rejects arbitrary launch settings and enforces exact finite limits and server sets", () => {
    const source = draft();
    for (const extra of [{ argv: ["exec"] }, { env: { HOME: "elsewhere" } }, { command: "unapproved" }, { config: {} }]) {
      expect(() => freezeWorkforceExternalRunnerProfile({ ...source, ...extra })).toThrow();
      expect(() => freezeWorkforceExternalRunnerProfile({ ...source, binary: { ...source.binary, ...extra } })).toThrow();
    }
    for (const limits of [{ ...source.limits, timeoutMs: 4999 }, { ...source.limits, timeoutMs: 600001 },
      { ...source.limits, maxInputBytes: 524289 }, { ...source.limits, maxMessageBytes: "8192" }, { ...source.limits, maxEvents: 15 },
      { ...source.limits, maxEvents: 2049 }, { ...source.limits, unknown: false }]) expect(() => freezeWorkforceExternalRunnerProfile({ ...source, limits })).toThrow();
    for (const disabledMcpServers of [["same", "same"], ["unsafe/server"], Array.from({ length: 65 }, (_, i) => "server-" + i)]) {
      expect(() => freezeWorkforceExternalRunnerProfile({ ...source, disabledMcpServers })).toThrow();
    }
    expect(freezeWorkforceExternalRunnerProfile({ ...source, disabledMcpServers: [] }).disabledMcpServers).toEqual([]);
  });

  it("retains existing protected-path, immutable-test and container verification restrictions", () => {
    const source = draft();
    for (const path of [".env", ".mcp.json", ".git/config", "evidence/result.json", "../escape.mjs", "src/**"]) {
      expect(() => freezeWorkforceExternalRunnerProfile({ ...source, artifact: { ...source.artifact,
        readPaths: [path, "test/value.test.mjs"], writePaths: [path] } })).toThrow();
    }
    for (const artifact of [{ ...source.artifact, writePaths: ["test/value.test.mjs"] },
      { ...source.artifact, verification: { ...source.artifact.verification, immutableTests: [] } },
      { ...source.artifact, verification: { ...source.artifact.verification, networkAccess: true } },
      { ...source.artifact, verification: { ...source.artifact.verification, image: "mutable-image:latest" } }]) {
      expect(() => freezeWorkforceExternalRunnerProfile({ ...source, artifact })).toThrow();
    }
  });

  it("rejects accessors, symbols, cycles and executable coercion without invoking them", () => {
    const source = draft(), invoked = vi.fn(() => "win32"), accessor = { ...source };
    Object.defineProperty(accessor, "profileId", { enumerable: true, get: invoked });
    const cycle = { ...source, artifact: {} }; cycle.artifact = cycle;
    const getterVerification = Object.defineProperty({ ...source.artifact.verification }, "command", { enumerable: true, get: invoked });
    for (const value of [accessor, cycle, { ...source, [Symbol("extra")]: true },
      { ...source, binary: { ...source.binary, platform: { toString: invoked } } },
      { ...source, artifact: { ...source.artifact, verification: getterVerification } }]) expect(() => freezeWorkforceExternalRunnerProfile(value)).toThrow();
    for (const value of [accessor, cycle, { [Symbol("extra")]: true }, { value: undefined }, { number: Infinity }, Array(2), "x".repeat(1048577)]) {
      expect(() => externalRunnerHash(value)).toThrow();
    }
    expect(invoked).not.toHaveBeenCalled();
  });

  it("accepts only the externalRunner profile selector and does not evaluate request getters", () => {
    expect(readWorkforceExternalRunnerSelector({ goal: "ordinary" })).toBeUndefined();
    expect(readWorkforceExternalRunnerSelector({ externalRunner: { profileId: "native-code" } })).toBe("native-code");
    const getter = vi.fn(), input = Object.defineProperty({}, "externalRunner", { enumerable: true, get: getter });
    for (const value of [input, { externalRunner: { profileId: "native-code", binary: {} } },
      { externalRunner: { profileId: "../native" } }, { externalRunner: null }]) {
      expect(() => readWorkforceExternalRunnerSelector(value)).toThrowError(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_REQUEST_INVALID" }));
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it("keeps the complete prompt and hashes every original review field", () => {
    const input = reviewInput(), review = createWorkforceExternalRunnerReview(input);
    expect(review.prompt).toBe(input.prompt); expect(review.goal).toBe(input.goal); expectFrozen(review);
    const { reviewHash, ...body } = review; expect(reviewHash).toBe(externalRunnerHash(body));
    expect(readWorkforceExternalRunnerReview(JSON.parse(JSON.stringify(review)))).toEqual(review);
    for (const change of [{ prompt: input.prompt + "One more line." }, { goal: "A different goal" }, { sourceFilesHash: "0".repeat(64) },
      { configuredRepositoryHash: "sha256:" + "0".repeat(64) }]) {
      expect(createWorkforceExternalRunnerReview({ ...input, ...change }).reviewHash).not.toBe(reviewHash);
      expect(() => readWorkforceExternalRunnerReview({ ...review, ...change })).toThrow();
    }
    expect(() => readWorkforceExternalRunnerProfile({ ...input.profile, nativeModel: { modelId: "changed", providerId: "openai" } })).toThrow();
    expect(() => readWorkforceExternalRunnerProfile({ profileHash: input.profile.profileHash })).toThrow();
    expect(() => readWorkforceExternalRunnerReview({ ...review, reviewHash: "sha256:" + "0".repeat(64) })).toThrow();
  });

  it("rejects secret-like, control-bearing, invalid UTF-8 and oversized prompts without truncation", () => {
    const input = reviewInput(), limit = input.profile.limits.maxInputBytes;
    expect(createWorkforceExternalRunnerReview({ ...input, prompt: "x".repeat(limit) }).prompt.length).toBe(limit);
    for (const prompt of ["x".repeat(limit + 1), "中".repeat(Math.ceil(limit / 3)), "password=private-value", "text\u0000end", "text\u202eend", "lone\ud800"] ) {
      expect(() => createWorkforceExternalRunnerReview({ ...input, prompt })).toThrowError(expect.objectContaining({ code: "WORKFORCE_EXTERNAL_RUNNER_REVIEW_INVALID" }));
    }
    expect(() => createWorkforceExternalRunnerReview({ ...input, goal: "x".repeat(4001) })).toThrow();
    expect(() => createWorkforceExternalRunnerReview({ ...input, sourceFilesHash: "sha256:" + "0".repeat(64) })).toThrow();
  });
});
