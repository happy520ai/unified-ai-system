import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createExecutionLifecycle } from "./executionLifecycle.js";
import { createWorkforceExternalRunnerReview, freezeWorkforceExternalRunnerProfile } from "./workforceExternalRunnerProfile.ts";
import { advanceExternalRunnerState, attachExternalRunnerState, createExternalRunnerMetadata, createExternalRunnerState,
  externalRunnerOwner, readExternalRunnerState } from "./workforceExternalRunnerState.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
function fixture() {
  const profile = freezeWorkforceExternalRunnerProfile({ version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-code", projectId: "owned", roleId: "backend-engineer",
    baselineRevision: "a".repeat(40), binary: { path: "E:/Codex Program/codex.exe", sha256: "b".repeat(64), version: "0.153.4", platform: "win32" },
    nativeModel: { modelId: "gpt-5.4", providerId: "openai" }, disabledMcpServers: [], limits: { timeoutMs: 30000, maxInputBytes: 4096, maxMessageBytes: 8192, maxEvents: 64 },
    artifact: { readPaths: ["value.mjs", "value.test.mjs"], writePaths: ["value.mjs"], verification: { verificationId: "test", command: "node --test value.test.mjs",
      immutableTests: [{ path: "value.test.mjs", sha256: "c".repeat(64) }], image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false,
      timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 }, artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const review = createWorkforceExternalRunnerReview({ profile, configuredRepositoryHash: "sha256:" + "e".repeat(64), goal: "Implement the bounded value function", prompt: "Complete approved source input", sourceFilesHash: "f".repeat(64) });
  const metadata = createExternalRunnerMetadata({ review, agentId: "agt_original", planId: "public-plan", planDigest: "1".repeat(64) });
  const identity = { tenantId: "tenant", userId: "owner" }, executionId = "wf-scope-owned", taskId = "task-original";
  const state = createExternalRunnerState({ metadata, identity, executionId, taskId, ownerProcess: { pid: 100, created: "133000000000000000" },
    worktree: { worktreeId: "wt_owned", path: "E:/Owned Workspace", directoryHash: "sha256:" + "2".repeat(64), baselineRevision: profile.baselineRevision, sourceFilesHash: review.sourceFilesHash } });
  const parent = { metadata: { externalRunner: metadata, tenantFingerprint: "idfp_" + externalRunnerOwner("tenant", identity.tenantId).slice(7, 23), subjectFingerprint: "idfp_" + externalRunnerOwner("subject", identity.tenantId, identity.userId).slice(7, 23) }, summary: {} };
  return { metadata, identity, executionId, state, parent };
}
it("only appends a real producer record with the original parent identity and sequence", () => {
  const f = fixture();
  expect(() => attachExternalRunnerState(f.parent, f.executionId, JSON.parse(JSON.stringify(f.state)))).toThrow();
  f.parent.summary = attachExternalRunnerState(f.parent, f.executionId, f.state);
  const next = advanceExternalRunnerState(f.state, f.metadata, { status: "starting", processClosed: false });
  f.parent.summary = attachExternalRunnerState(f.parent, f.executionId, next);
  expect(() => attachExternalRunnerState(f.parent, f.executionId, next)).toThrow();
  expect(() => attachExternalRunnerState({ ...f.parent, metadata: { ...f.parent.metadata, subjectFingerprint: "3".repeat(64) } }, f.executionId, next)).toThrow();
  expect(() => readExternalRunnerState({ ...next, eventsObserved: 8 }, { executionId: f.executionId, metadata: f.metadata })).toThrow();
});
it("cannot replace native thread/turn IDs or restart an uncertain original turn", () => {
  const f = fixture();
  let state = advanceExternalRunnerState(f.state, f.metadata, { status: "starting" });
  state = advanceExternalRunnerState(state, f.metadata, { status: "thread_ready", threadId: "native-thread" });
  state = advanceExternalRunnerState(state, f.metadata, { status: "dispatching" });
  state = advanceExternalRunnerState(state, f.metadata, { status: "running", turnId: "native-turn", nativeStatus: "inProgress" });
  expect(() => advanceExternalRunnerState(state, f.metadata, { turnId: "another-turn" })).toThrow();
  const unknown = advanceExternalRunnerState(state, f.metadata, { status: "unknown", error: { code: "NATIVE_CONNECTION_LOST", outcomeUnknown: true } });
  expect(() => advanceExternalRunnerState(unknown, f.metadata, { status: "starting" })).toThrow();
  expect(() => advanceExternalRunnerState(unknown, f.metadata, { status: "native_completed", nativeStatus: "completed" })).toThrow();
  const original = advanceExternalRunnerState(unknown, f.metadata, { status: "native_completed", nativeStatus: "completed", error: null }, { reconcileOriginal: true });
  expect(original.threadId).toBe(state.threadId); expect(original.turnId).toBe(state.turnId);
  expect(() => advanceExternalRunnerState(original, f.metadata, { status: "verified" })).toThrow();
});
it("requires durable approval and completion hashes before any verified native result", () => {
  const f = fixture();
  let state = f.state;
  for (const patch of [{ status: "starting", processIdentity: { kind: "windows-job", hostPid: 101, childPid: 102, hostCreated: "133000000000000001", childCreated: "133000000000000002" } },
    { status: "thread_ready", threadId: "thread" }, { status: "dispatching" }, { status: "native_completed", turnId: "turn", nativeStatus: "completed" },
    { status: "verifying", artifact: { diffSha256: "a".repeat(64), filesChanged: [], sourceFilesHash: "b".repeat(64) }, verification: { passed: true } }] as const) {
    state = advanceExternalRunnerState(state, f.metadata, patch);
  }
  expect(() => advanceExternalRunnerState(state, f.metadata, { status: "verified" })).toThrow();
  state = advanceExternalRunnerState(state, f.metadata, { fileApprovals: [{ itemId: "patch", changesHash: "sha256:" + "c".repeat(64),
    beforeFilesHash: f.metadata.review.sourceFilesHash, completedFilesHash: null }] });
  expect(() => advanceExternalRunnerState(state, f.metadata, { status: "verified" })).toThrow();
  state = advanceExternalRunnerState(state, f.metadata, { fileApprovals: state.fileApprovals.map(entry => ({ ...entry, completedFilesHash: "b".repeat(64) })) });
  expect(advanceExternalRunnerState(state, f.metadata, { status: "verified" }).status).toBe("verified");
  expect(() => advanceExternalRunnerState(state, f.metadata, { fileApprovals: [] })).toThrow();
  expect(() => advanceExternalRunnerState(state, f.metadata, { fileApprovals: state.fileApprovals.map(entry => ({ ...entry, completedFilesHash: "d".repeat(64) })) })).toThrow();
});
it("rejects an unreviewed initial source, parallel unfinished approvals and broken file hash chains", () => {
  const f = fixture(), approval = { itemId: "patch", changesHash: "sha256:" + "c".repeat(64), beforeFilesHash: f.metadata.review.sourceFilesHash, completedFilesHash: null };
  expect(() => advanceExternalRunnerState(f.state, f.metadata, { fileApprovals: [{ ...approval, beforeFilesHash: "d".repeat(64) }] })).toThrow();
  const state = advanceExternalRunnerState(f.state, f.metadata, { fileApprovals: [approval] });
  expect(() => advanceExternalRunnerState(state, f.metadata, { fileApprovals: [approval, { ...approval, itemId: "second" }] })).toThrow();
  const completed = advanceExternalRunnerState(state, f.metadata, { fileApprovals: [{ ...approval, completedFilesHash: "d".repeat(64) }] });
  expect(() => advanceExternalRunnerState(completed, f.metadata, { fileApprovals: [...completed.fileApprovals, { ...approval, itemId: "second" }] })).toThrow();
});
it("preserves the original native record across parent completion, restart and explicit reconciliation", async () => {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "native-lifecycle-state-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(parent); await rm(root, { recursive: true, force: true }); });
  const f = fixture(), lifecycle = createExecutionLifecycle({ lifecycleDir: root });
  await lifecycle.initialize(f.executionId, f.parent.metadata); await lifecycle.start(f.executionId);
  await lifecycle.recordExternalRunnerState(f.executionId, f.state);
  let state = f.state;
  for (const patch of [{ status: "starting" }, { status: "thread_ready", threadId: "native-thread" }, { status: "dispatching" }, { status: "running", turnId: "native-turn", nativeStatus: "inProgress" },
    { status: "unknown", error: { code: "NATIVE_CONNECTION_LOST", outcomeUnknown: true } }] as const) {
    state = advanceExternalRunnerState(state, f.metadata, patch); await lifecycle.recordExternalRunnerState(f.executionId, state);
  }
  await lifecycle.complete(f.executionId, "failed", { externalRunnerState: { status: "verified" } });
  const reopened = createExecutionLifecycle({ lifecycleDir: root }), original = await reopened.getStatus(f.executionId) as any;
  expect(original.status).toBe("failed"); expect(original.externalRunner.state).toEqual(state);
  const reconciled = advanceExternalRunnerState(original.externalRunner.state, f.metadata, { status: "native_completed", nativeStatus: "completed", error: null }, { reconcileOriginal: true });
  await reopened.recordExternalRunnerState(f.executionId, reconciled);
  const result = await reopened.getStatus(f.executionId) as any;
  expect(result.status).toBe("failed"); expect(result.externalRunner.state.status).toBe("native_completed");
  expect(result.externalRunner.state.threadId).toBe("native-thread"); expect(result.externalRunner.state.turnId).toBe("native-turn");
});
