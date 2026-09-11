// @test-isolation process
// Controller integration only: native execution, executable/container attestation and verified-result branding are synthetic boundaries.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createExecutionApprovalGate } from "./executionApprovalGate.js";
import { createExecutionLifecycle } from "./executionLifecycle.js";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforceGit } from "./workforceGit.ts";
import { assertOwnedWorkforceWorktree, createWorktreeIsolation } from "./worktreeIsolation.js";
import { assertWorkforceCodeTaskFence } from "./workforceDagExecutor.ts";
import { captureApprovedCodeFiles, createCodeDeliveryArtifact } from "./workforceCodeDeliveryArtifacts.ts";
import { externalRunnerArtifactPolicy, externalRunnerHash } from "./workforceExternalRunnerProfile.ts";
import { advanceExternalRunnerState, createExternalRunnerMetadata, createExternalRunnerState } from "./workforceExternalRunnerState.ts";
import type { ExternalRunnerMetadata, ExternalRunnerState } from "./workforceExternalRunnerState.ts";
import type { WorkforceExternalRunnerProfileInput } from "@unified-ai-system/shared-contracts";
import * as nativeRuntime from "./workforceExternalRunnerRuntime.ts";
import * as nativeProcess from "./workforceExternalRunnerProcess.ts";

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.restoreAllMocks(); });
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const originalSource = "export const value = 1;\n", changedSource = "export const value = 2;\n";
type Outcome = "verified" | "unknown" | "missing-final-persist";
type Task = Parameters<typeof nativeRuntime.runWorkforceExternalRunner>[2];
async function fixture(outcome: Outcome = "verified", coexistWithRoleSelection = false) {
  const base = resolve("apps/ai-gateway-service/evidence/product-final");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, "t064-controlled-"));
  cleanup.push(async () => { expect(await realpath(root)).toBe(resolve(root)); expect(resolve(root).startsWith(base + sep)).toBe(true); await rm(root, { recursive: true, force: true }); });
  const repo = join(root, "repo"), scratch = join(root, "scratch"), executionDir = join(root, "execution");
  await mkdir(join(repo, "src"), { recursive: true }); await mkdir(join(repo, "test")); await mkdir(scratch);
  const immutable = "import assert from 'node:assert/strict'; import { value } from '../src/value.mjs'; assert.equal(value, 2);\n";
  await writeFile(join(repo, "src/value.mjs"), originalSource); await writeFile(join(repo, "test/value.test.mjs"), immutable);
  const git = createWorkforceGit(repo);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  await git.run(["add", "--", "src/value.mjs", "test/value.test.mjs"]);
  await git.run(["-c", "user.name=Native Controller Fixture", "-c", "user.email=native-fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Generated controller fixture baseline"]);
  const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
  const profile: WorkforceExternalRunnerProfileInput = { version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-fixture", projectId: "fixture-project", roleId: "backend-engineer", baselineRevision,
    binary: { path: "E:/Synthetic Native/codex.exe", sha256: "a".repeat(64), version: "0.153.4", platform: "win32" }, nativeModel: { modelId: "expected-native-model", providerId: "expected-native-provider" },
    disabledMcpServers: [], limits: { timeoutMs: 30000, maxInputBytes: 65536, maxMessageBytes: 8192, maxEvents: 64 },
    artifact: { readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
      verification: { verificationId: "fixed-test", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: sha(immutable) }],
        image: "node@sha256:" + "b".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } };
  const identity = { tenantId: "native-tenant", userId: "native-owner", role: "admin", permissions: ["*"] }, context = { agentId: "agt_native_fixture", tenantId: identity.tenantId, userId: identity.userId };
  const policy: any = { agentId: context.agentId, policyHash: "sha256:" + "c".repeat(64), expiresAt: "2099-01-01T00:00:00.000Z",
    grantedTools: ["file_read", "file_write", "file_edit", "workforce_verify_snapshot", "workforce_execute"],
    toolDecisions: { file_read: "allow", file_write: "allow", file_edit: "allow", workforce_verify_snapshot: "allow", workforce_execute: "allow" },
    permissions: { canWrite: true, canExecuteCode: true }, requirements: {}, scope: {}, limits: { maxSteps: 64, maxToolCalls: 64, maxWorkforceRoles: 16, maxRuntimeSeconds: 60 } };
  const toolProxy = createAgentGovernanceToolProxy({ service: { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }),
    loadVerifiedPolicy: async () => ({ policy }), emitAudit: async () => {}, reserveUsage: async () => ({ allowed: true }) } as any });
  vi.spyOn(nativeProcess, "assertExternalRunnerProcessConfiguration").mockResolvedValue(undefined);
  vi.spyOn(ContainerSandboxBackend.prototype, "attest").mockResolvedValue({} as never);
  const nativeFactory = nativeRuntime.createWorkforceExternalRunnerFactory({ repoRoot: repo, enginePath: join(root, "synthetic-container-engine"), scratchRoot: scratch,
    windowsHost: { path: join(root, "workforce-native-job-host.exe"), sha256: "d".repeat(64) } });
  const approvalGate = createExecutionApprovalGate({ storePath: join(executionDir, "approvals.json") }), lifecycle = createExecutionLifecycle({ lifecycleDir: executionDir });
  const approve = vi.spyOn(approvalGate, "approve"), consume = vi.spyOn(approvalGate, "consume");
  const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") }), created: string[] = [];
  const createOriginal = manager.create.bind(manager);
  const create = vi.spyOn(manager, "create").mockImplementation(async options => { const result = await createOriginal(options); if (result.success && result.worktree) created.push(result.worktree.worktreeId); return result; });
  const remove = vi.spyOn(manager, "remove");
  cleanup.push(async () => { for (const worktreeId of created) await manager.remove(worktreeId); });
  const env = { NODE_ENV: "test", WORKFORCE_EXECUTION_ENABLED: "true", WORKFORCE_EXECUTION_TIMEOUT_MS: "30000", WORKFORCE_MAX_CONCURRENT: "1", AI_GATEWAY_WORKFORCE_CONTROL_POLL_MS: "100" };
  const roleSelection = { catalogHash: "sha256:" + "e".repeat(64), executionMode: "fake", resolve: vi.fn(() => { throw new Error("Fixture ordinary role selection reached"); }) };
  const executor = createControlledExecutor({ repoRoot: repo, executionDir, env, externalRunnerFactory: nativeFactory, externalRunnerProfiles: [profile],
    ...(coexistWithRoleSelection ? { roleSelection } : {}),
    approvalGate, executionLifecycle: lifecycle, worktreeIsolation: manager, evidenceCapture: createTaskEvidenceCapture({ evidenceDir: join(executionDir, "evidence") }),
    workspaceGuard: { check: async () => ({ clean: true }) }, securityCheckpoint: { preExecutionCheck: async () => ({ result: "pass" }), postExecutionCheck: async () => ({ result: "pass" }) },
    tierGovernor: { getCurrentTier: async () => ({ autonomyMode: "sandbox-merge-auto" }), getInfo: () => ({}) }, sandboxMerger: { getInfo: () => ({}) } } as any);
  cleanup.push(async () => { await executor.close(); });
  const controller = new AbortController(), lease = { signal: controller.signal, assertActive: vi.fn(async () => true) };
  const governance = { context, policy, executionLease: lease, remainingSteps: 64, reserveStep: vi.fn(async () => ({ allowed: true })) };
  const input = { goal: "Implement a bounded value function", planId: "native-plan", tenantId: identity.tenantId, userId: identity.userId, agentId: context.agentId,
    autonomyMode: "controlled-execution", externalRunner: { profileId: profile.profileId } };
  const server = { identity, context, policy, usage: { toolCalls: 0, steps: 0, records: 0 }, signal: controller.signal, deadlineAt: Date.now() + 60000, toolProxy };
  const issued = new WeakMap<object, { state: ExternalRunnerState; metadata: ExternalRunnerMetadata }>();
  const observations: { state: ExternalRunnerState; metadata: ExternalRunnerMetadata; before: Awaited<ReturnType<typeof captureApprovedCodeFiles>> }[] = [];
  async function verified(initial: ExternalRunnerState, metadata: ExternalRunnerMetadata, before: Awaited<ReturnType<typeof captureApprovedCodeFiles>>, persist: Task["persist"], saveFinal = true) {
    let state = initial;
    const advance = async (patch: Parameters<typeof advanceExternalRunnerState>[2], reconcileOriginal = false) => { state = advanceExternalRunnerState(state, metadata, patch, { reconcileOriginal }); await persist(state); };
    await advance({ status: "native_completed", nativeStatus: "completed", processClosed: true, error: null }, initial.status === "unknown");
    await advance({ status: "verifying" });
    const after = await captureApprovedCodeFiles(state.worktree.path, externalRunnerArtifactPolicy(metadata.review.profile));
    const artifact = createCodeDeliveryArtifact(before, after, externalRunnerArtifactPolicy(metadata.review.profile));
    state = advanceExternalRunnerState(state, metadata, { status: "verified", artifact, verification: { passed: true, evidence: "synthetic-controller-boundary" },
      fileApprovals: [{ itemId: "synthetic-patch", changesHash: externalRunnerHash(artifact.filesChanged), beforeFilesHash: metadata.review.sourceFilesHash, completedFilesHash: artifact.sourceFilesHash }] });
    if (saveFinal) await persist(state);
    const result = Object.freeze({ status: "verified", operationId: state.operationId, profileHash: metadata.review.profile.profileHash, threadId: state.threadId, turnId: state.turnId,
      nativeStatus: "completed", artifact, verification: state.verification, processClosed: true, nativeTurnsDispatched: 1, nativeModelRequestCount: null, gatewayProviderCalls: 0, nativeUsage: null, outcomeUnknown: false, recoveryRequired: false });
    issued.set(result, { state, metadata }); return result;
  }
  const run = vi.spyOn(nativeRuntime, "runWorkforceExternalRunner").mockImplementation(async (_factory, _token, task) => {
    const descriptor = await executor.describeExecution(input), metadata = createExternalRunnerMetadata({ review: descriptor.externalRunner!, agentId: context.agentId, planId: input.planId, planDigest: descriptor.planDigest });
    await assertWorkforceCodeTaskFence(task.taskFence, { executionId: task.executionId, taskId: task.taskId, roleId: profile.roleId,
      agentId: context.agentId, agentRunId: task.agentRunId, agentFence: task.agentFence });
    const owned = await assertOwnedWorkforceWorktree(task.manager, task.worktreeId, { planId: task.executionId, baselineRevision });
    const before = await captureApprovedCodeFiles(owned.path, externalRunnerArtifactPolicy(metadata.review.profile));
    let state = createExternalRunnerState({ executionId: task.executionId, taskId: task.taskId, metadata, identity, ownerProcess: { pid: 11110, created: "999" },
      worktree: { worktreeId: task.worktreeId, path: owned.path, directoryHash: externalRunnerHash([owned.path]), baselineRevision, sourceFilesHash: before.filesHash } });
    await task.persist(state);
    for (const patch of [{ status: "starting", processClosed: false, processIdentity: { kind: "windows-job", hostPid: 11111, childPid: 11112, hostCreated: "1000", childCreated: "1001" } },
      { status: "thread_ready", threadId: "synthetic-native-thread" }, { status: "dispatching" }, { status: "running", turnId: "synthetic-native-turn", nativeStatus: "inProgress" }] as const) {
      state = advanceExternalRunnerState(state, metadata, patch); await task.persist(state);
    }
    await writeFile(join(owned.path, "src/value.mjs"), changedSource);
    if (outcome === "unknown") {
      state = advanceExternalRunnerState(state, metadata, { status: "unknown", nativeStatus: "unknown", error: { code: "SYNTHETIC_NATIVE_DISCONNECT", outcomeUnknown: true } }); await task.persist(state);
      observations.push({ state, metadata, before });
      const error = Object.assign(new Error("Synthetic native outcome unknown"), { code: "WORKFORCE_EXTERNAL_RUNNER_OUTCOME_UNKNOWN",
        details: { outcomeUnknown: true, recoveryRequired: true, projectFileWrites: null, processClosed: false, operationId: state.operationId } });
      task.abort(error); throw error;
    }
    return verified(state, metadata, before, task.persist, outcome !== "missing-final-persist");
  });
  const readVerified = vi.spyOn(nativeRuntime, "readVerifiedWorkforceExternalRunnerResult").mockImplementation((result, expected) => {
    const record = result && typeof result === "object" ? issued.get(result) : undefined;
    if (!record || record.state.executionId !== expected.executionId || record.state.taskId !== expected.taskId || record.state.agentId !== expected.agentId) throw new Error("Synthetic native result binding failed");
    return record;
  });
  const recover = vi.spyOn(nativeRuntime, "recoverWorkforceExternalRunner").mockImplementation(async (_factory, request) => {
    const original = observations.find(record => record.state.operationId === request.state.operationId);
    expect(original).toBeDefined(); expect(request.metadata).toEqual(original!.metadata); expect(request.state.threadId).toBe(original!.state.threadId); expect(request.state.turnId).toBe(original!.state.turnId);
    return verified(request.state, request.metadata, original!.before, request.persist) as never;
  });
  const admit = () => executor.prepareExternalRunnerAdmission(input, server);
  const authorize = async () => { const externalRunnerPreflight = await admit(); const approval = await executor.approveExecution(input, identity.userId, ["workforce:execute"], { externalRunnerPreflight, context, policy });
    expect(approval).toMatchObject({ success: true, status: "approved", approval: { status: "approved", planDigest: approval.execution.planDigest, userId: identity.userId } });
    return { externalRunnerPreflight, externalRunnerToolProxy: toolProxy, agentGovernance: governance, identity, signal: controller.signal }; };
  return { root, repo, executionDir, executor, input, server, admit, authorize, profile, identity, approvalGate, lifecycle, approve, consume, manager, create, remove, run, readVerified, recover, governance, roleSelection };
}

describe("native runner controlled-executor integration", () => {
  it("selects the explicit native mode without changing the server's ordinary role selection", async () => {
    const f = await fixture("verified", true);
    const descriptor = await f.executor.describeExecution(f.input);
    expect(descriptor.externalRunner).toBeDefined(); expect(descriptor.roleExecution).toBeUndefined(); expect(descriptor.selectionReview).toBeUndefined();
    const result = await f.executor.execute(f.input, await f.authorize());
    expect(result.success).toBe(true); expect(f.run).toHaveBeenCalledOnce(); expect(f.roleSelection.resolve).not.toHaveBeenCalled();
    expect(f.executor.getInfo().selection).toMatchObject({ catalogHash: f.roleSelection.catalogHash });
    const { externalRunner: _native, ...ordinary } = f.input;
    await expect(f.executor.describeExecution(ordinary)).rejects.toThrow("Fixture ordinary role selection reached");
    expect(f.roleSelection.resolve).toHaveBeenCalledOnce();
  }, 30000);
  it("builds the complete server review, preserves plan roles, and rejects mixed execution modes", async () => {
    const f = await fixture(), descriptor = await f.executor.describeExecution(f.input), original = createWorkforcePlan(f.input);
    expect(descriptor.externalRunner?.prompt).toContain(originalSource.trim()); expect(descriptor.externalRunner?.prompt).toContain("test/value.test.mjs");
    expect(descriptor.externalRunner?.profile.profileId).toBe(f.profile.profileId);
    expect((await f.executor.describeExecution({ ...f.input, selectedRoles: ["backend-engineer"] })).planDigest).toBe(descriptor.planDigest);
    for (const conflict of [{ workflowHandoff: {} }, { consensusReview: {} }, { roleExecution: {} }]) await expect(f.executor.describeExecution({ ...f.input, ...conflict })).rejects.toThrow();
    await expect(f.executor.describeExecution({ ...f.input, autonomyMode: "sandbox-merge" })).rejects.toThrow();
    await expect(f.executor.describeExecution({ ...f.input, externalRunner: { profileHash: descriptor.externalRunner!.profile.profileHash } })).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_REQUEST_INVALID" });
    expect(original.taskBreakdown.filter((task: any) => task.roleId === "backend-engineer")).toHaveLength(1);
    expect(f.approve).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
  }, 30000);

  it("requires real preflight and rejects changed source before approval or native dispatch", async () => {
    const f = await fixture();
    await expect(f.executor.approveExecution(f.input, f.identity.userId, ["workforce:execute"])).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PREFLIGHT_REQUIRED" });
    const externalRunnerPreflight = await f.admit();
    await writeFile(join(f.repo, "src/value.mjs"), "export const value = 9;\n");
    await expect(f.executor.approveExecution(f.input, f.identity.userId, ["workforce:execute"], { externalRunnerPreflight, context: f.server.context, policy: f.server.policy })).rejects.toThrow();
    expect(f.approve).not.toHaveBeenCalled(); expect(f.consume).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
    await writeFile(join(f.repo, "src/value.mjs"), originalSource);
    const authorized = await f.authorize();
    await writeFile(join(f.repo, "src/value.mjs"), "export const value = 10;\n");
    await expect(f.executor.execute(f.input, authorized)).rejects.toThrow();
    expect(f.approve).toHaveBeenCalledOnce(); expect(f.consume).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
  }, 30000);

  it("runs the native boundary once for the backend role and requires persisted result readback before completion", async () => {
    const f = await fixture(), result = await f.executor.execute(f.input, await f.authorize());
    expect(result).toMatchObject({ success: true, executionStatus: "completed", worktree: { created: true, cleanedUp: true },
      externalRunner: { state: { status: "verified", threadId: "synthetic-native-thread", turnId: "synthetic-native-turn" } } });
    expect(f.run).toHaveBeenCalledOnce(); expect(f.readVerified).toHaveBeenCalledOnce();
    const roles = createWorkforcePlan(f.input).taskBreakdown.map((task: any) => task.roleId).sort();
    expect(Object.keys(result.roleResults).sort()).toEqual(roles);
    expect(Object.entries(result.roleResults).filter(([, value]) => (value as any).externalRunner).map(([role]) => role)).toEqual(["backend-engineer"]);
    const reopened = createExecutionLifecycle({ lifecycleDir: f.executionDir }), saved: any = await reopened.getStatus(result.executionId);
    expect(saved.externalRunner.state).toEqual(result.externalRunner.state);
    expect(saved.externalRunner.metadata.review).toEqual(result.externalRunner.metadata.review);
    expect(await readFile(join(f.repo, "src/value.mjs"), "utf8")).toBe(originalSource);
    expect(f.governance.reserveStep).toHaveBeenCalledTimes(roles.length);
  }, 30000);

  it("refuses a synthetic verified result whose final state was never persisted", async () => {
    const f = await fixture("missing-final-persist"), result = await f.executor.execute(f.input, await f.authorize());
    expect(result).toMatchObject({ success: false, executionStatus: "failed", recoveryRequired: true, worktree: { created: true, cleanedUp: false }, externalRunner: { state: { status: "verifying" } } });
    expect(f.run).toHaveBeenCalledOnce(); expect(f.readVerified).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
  }, 30000);

  it("retains an unknown owned worktree and recovers only the original authenticated binding", async () => {
    const f = await fixture("unknown"), result = await f.executor.execute(f.input, await f.authorize());
    expect(result).toMatchObject({ success: false, executionStatus: "failed", recoveryRequired: true, worktree: { created: true, cleanedUp: false },
      externalRunner: { state: { status: "unknown", processClosed: false, error: { outcomeUnknown: true } } } });
    expect(f.remove).not.toHaveBeenCalled(); expect(await readFile(join(result.externalRunner.state.worktree.path, "src/value.mjs"), "utf8")).toBe(changedSource);
    const status = await f.executor.getStatus(result.executionId, f.identity);
    expect(status.externalRunner.state.stateHash).toBe(result.externalRunner.state.stateHash);
    for (const identity of [{ ...f.identity, userId: "other" }, { ...f.identity, tenantId: "other" }]) await expect(f.executor.getStatus(result.executionId, identity)).rejects.toMatchObject({ code: "WORKFORCE_EXECUTION_FORBIDDEN" });
    const request = { executionId: result.executionId, operationId: result.externalRunner.state.operationId, agentId: f.server.context.agentId };
    for (const changed of [{ operationId: "wrong-operation" }, { agentId: "agt_other" }]) await expect(f.executor.recoverExternalRunner({ ...request, ...changed }, f.identity, f.server)).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_MISMATCH" });
    expect(f.recover).not.toHaveBeenCalled();
    const restored = await f.executor.recoverExternalRunner(request, f.identity, { ...f.server, assertActive: async () => {} });
    expect(restored).toMatchObject({ status: "verified", parentExecutionStatus: "failed", parentExecutionResumed: false, employeeRolesRerun: false });
    expect((await f.executor.getStatus(result.executionId, f.identity)).externalRunner.state).toMatchObject({ status: "verified", operationId: request.operationId,
      threadId: result.externalRunner.state.threadId, turnId: result.externalRunner.state.turnId });
    expect(f.run).toHaveBeenCalledOnce(); expect(f.recover).toHaveBeenCalledOnce(); expect(f.create).toHaveBeenCalledOnce(); expect(f.remove).not.toHaveBeenCalled();
  }, 30000);
});
