import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { computeArgumentsHash } from "@unified-ai-system/policy-engine";
import { GatewayService } from "../core/gatewayService.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createAgentApprovalStore } from "../agent-governance/agentApprovalStore.ts";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createGovernanceStateFileBinding } from "../agent-governance/governanceStateAnchor.ts";
import { TaskQueueManager } from "../workforce/taskQueueManager.js";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import { createGovernedAgentTaskWorkspace } from "./governedAgentTaskWorkspace.ts";
import { freezeGovernedAgentTaskProfile } from "./governedAgentTaskProfile.ts";
import { createGovernedAgentTaskRuntime } from "./governedAgentTaskRuntime.ts";

type Resource = { root: string; queue?: TaskQueueManager; controllers: AbortController[]; pending: Set<Promise<unknown>> };
const resources: Resource[] = [];
const CHUNK_TIMEOUT_MS = 30000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
// Synthetic backend evidence for runtime orchestration; the pinned runner is not executed by this mock.
function syntheticNodeTestReceipt(options: any, passed: boolean, diagnostic: string) {
  expect(typeof options.stdin).toBe("string");
  const input = JSON.parse(options.stdin);
  const report = { version: 1, nonce: input.nonce, contractHash: input.contractHash, runnerHash: input.runnerHash, snapshotHash: input.snapshotHash,
    complete: true, success: passed, counts: { tests: 1, passed: Number(passed), failed: Number(!passed), cancelled: 0, skipped: 0, todo: 0, suites: 0, topLevel: 1 },
    executedPassed: Number(passed), requiredChecks: input.contract.requiredChecks.map((check: any) => ({ ...check, status: passed ? "passed" : "failed" })) };
  const payload = Buffer.from(JSON.stringify(report)).toString("base64");
  const mac = createHmac("sha256", Buffer.from(input.key, "hex")).update(payload).digest("hex");
  return `${diagnostic}\nUAI_NODE_TEST_RECEIPT_V1:${payload}:${mac}`;
}
afterEach(async () => {
  try {
    for (const resource of resources.splice(0).reverse()) {
      for (const controller of resource.controllers) controller.abort(Error("Owned runtime fixture teardown"));
      await Promise.allSettled([...resource.pending]);
      await resource.queue?.close();
      expect(await realpath(resource.root)).toBe(resource.root); expect(dirname(resource.root)).toBe(await realpath(tmpdir()));
      await rm(resource.root, { recursive: true, force: false });
    }
  } finally { vi.restoreAllMocks(); }
});
const tool = (id: string, name: string, args: Record<string, unknown>) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
function response(text: string, calls?: ReturnType<typeof tool>[]) {
  return { text, message: { role: "assistant", content: text, ...(calls ? { tool_calls: calls } : {}) },
    ...(calls ? { toolCalls: calls.map(call => ({ id: call.id, name: call.function.name, arguments: JSON.parse(call.function.arguments) })) } : {}),
    usage: { inputTokens: 101, outputTokens: 29, totalTokens: 130 }, executionStatus: "success", latencyMs: 0,
    raw: { finishReason: calls ? "tool_calls" : "stop", workforceObservation: { contentPresent: true,
      usageReported: { inputTokens: true, outputTokens: true, totalTokens: true } } }, warnings: [] };
}
async function fixture(repair = true) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "agent-task-runtime-"));
  const resource: Resource = { root, controllers: [], pending: new Set() }; resources.push(resource);
  const repoRoot = join(root, "repo"), worktreeRoot = join(root, "worktrees"), scratchRoot = join(root, "scratch"), dataDir = join(root, "state");
  await Promise.all([mkdir(repoRoot), mkdir(scratchRoot), mkdir(dataDir)]);
  const testText = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from './source.mjs';\ntest('value is two', () => assert.equal(value, 2));\n";
  await writeFile(join(repoRoot, "source.mjs"), "export const value = 1;\n"); await writeFile(join(repoRoot, "test.mjs"), testText);
  const git = createWorkforceGit(repoRoot);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]); await git.run(["add", "source.mjs", "test.mjs"]);
  await git.run(["-c", "user.name=Runtime Fixture", "-c", "user.email=runtime@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Fixture"]);
  const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
  const profile = freezeGovernedAgentTaskProfile({ version: 1, mode: "governed-agent-long-task", profileId: "runtime", projectId: "project", baselineRevision,
    model: { providerId: "fixture", modelId: "fixture-model", maxInputTokens: 16384, maxOutputTokens: 2048 },
    limits: { maxPlanSteps: 3, maxIterations: 7, maxModelCalls: 8, maxTotalTokens: 147456, maxRepairAttempts: repair ? 1 : 0, chunkTimeoutMs: CHUNK_TIMEOUT_MS, maxInputBytes: 65536 },
    verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1, requiredChecks: [{ file: "test.mjs", name: "value is two" }] },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "fixed-test", command: "node --test 'test.mjs'", immutableTests: [{ path: "test.mjs", sha256: digest(testText) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const workspaceConfig = { repoRoot, worktreeRoot, scratchRoot, enginePath: resolve("fixture-engine"), profile };
  const workspace = createGovernedAgentTaskWorkspace(workspaceConfig), secret = "fixture-only-task-authority-" + randomUUID();
  const approvals = createAgentApprovalStore({ storePath: join(dataDir, "approvals.json"), secret });
  const queueFile = join(dataDir, "agent-long-tasks.json");
  const signed = createGovernanceStateFileBinding({ filePath: queueFile, secret, kind: "json", validateLegacy() { throw Error("No unsigned task state"); } });
  const queue = new TaskQueueManager({ dataDir, queueFile, retainedTasks: true, retainedStateBinding: signed, env: {} }); resource.queue = queue; await queue.init();
  const grantedTools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
  const policy: any = { agentId: "agt_original", policyHash: "sha256:" + "f".repeat(64), expiresAt: "2099-01-01T00:00:00Z",
    grantedTools, toolDecisions: Object.fromEntries(grantedTools.map(name => [name, "allow"])),
    permissions: { canWrite: true, canExecuteCode: true }, limits: { maxSteps: 12, maxToolCalls: 20 }, requirements: {}, scope: {} };
  let active = true, steps = 0, toolCalls = 0, leases = 0;
  const check = vi.fn(async () => { if (!active) throw Object.assign(Error("Revoked"), { code: "AGENT_NOT_ACTIVE" }); return true as const; });
  const service: any = {
    authorizeAgentExecution: vi.fn(async () => { await check(); leases++;
      return { record: { ownerUserId: "owner" }, policy, executionLease: { signal: new AbortController().signal, fingerprint: "fixture",
        assertActive: check, release() { leases--; } } }; }),
    getAgent: async () => ({ ownerUserId: "owner", status: active ? "ACTIVE" : "REVOKED" }), expireAgents: async () => {},
    loadVerifiedPolicy: async () => active ? { policy } : null,
    reserveUsage: vi.fn(async (_agent: string, limits: any, delta: any) => {
      if (steps + (delta.steps ?? 0) > limits.maxSteps || toolCalls + (delta.toolCalls ?? 0) > limits.maxToolCalls) return { allowed: false };
      steps += delta.steps ?? 0; toolCalls += delta.toolCalls ?? 0; return { allowed: true };
    }),
    releaseUsage: async () => {}, emitAudit: vi.fn(async () => {}), acquireToolExecutionLease: async () => ({ release() {} }),
    createApproval: (agentId: string, toolName: string, args: unknown, tenantId: string, review: any, reason: string) => approvals.create({ agentId, toolName, arguments: args, tenantId, review, reason }),
    findApprovedArguments: (input: any) => approvals.findApproved({ ...input, argumentsHash: computeArgumentsHash(input.args) }).then(value => value ? { approvalId: value.id } : null),
    consumeApprovedArguments: vi.fn((input: any) => approvals.consumeApproved({ ...input, argumentsHash: computeArgumentsHash(input.args) }).then(value => value ? { approvalId: value.id, args: value.args, review: value.review } : null)),
    verifyConsumedArguments: vi.fn((input: any) => approvals.verifyConsumed({ ...input, argumentsHash: computeArgumentsHash(input.args) })),
  };
  const provider = createFakeProvider({ providerId: "fixture", modelId: "fixture-model", providerType: "fake", enabled: true, capabilities: ["chat"] } as any);
  let codingCalls = 0;
  const generate = vi.spyOn(provider, "generate").mockImplementation(async (input: any) => {
    if (!input.request.tools?.length) {
      const data = JSON.parse(input.request.messages[1].content);
      return response(JSON.stringify({ version: 1, reviewHash: data.review.reviewHash, steps: [
        { id: "read", kind: "inspect", title: "Read complete source", paths: ["source.mjs"] },
        { id: "write", kind: "implement", title: "Implement value two", paths: ["source.mjs"] },
        { id: "verify", kind: "verify", title: "Verify immutable tests", paths: ["test.mjs"] },
      ] }));
    }
    codingCalls++;
    if (codingCalls === 1) return response("", [tool("read-original", "file_read", { file_path: "source.mjs" })]);
    if (codingCalls === 2) return response("", [tool("write-candidate", "file_write", { file_path: "source.mjs", content: "export const value = 3;\n" })]);
    if (codingCalls === 4) return response("", [tool("repair-candidate", "file_edit", { file_path: "source.mjs", old_string: "3", new_string: "2" })]);
    return response("Implementation candidate is ready for independent verification.");
  });
  const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] }); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry, runtimeConfig: { providerMode: "fake", enabledProviders: ["fixture"] },
    requestLogger: { log: async () => undefined }, enterpriseAudit: { recordAudit: async () => undefined } });
  const verify = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async (input: any) => {
    expect(input.workspaceMode).toBe("ro"); expect(input.networkAccess).toBe(false);
    expect(input.command.endsWith("exec node /scratch/uai-node-check.mjs")).toBe(true);
    expect(JSON.parse(input.stdin).contract).toEqual(profile.verificationResult);
    expect(await readFile(join(input.workspace, "test.mjs"), "utf8")).toBe(testText);
    const passed = (await readFile(join(input.workspace, "source.mjs"), "utf8")).includes("value = 2");
    return { backend: "container", exitCode: passed ? 0 : 1, killed: false, oomKilled: false, truncated: false, cleanupUncertain: false,
      stdout: syntheticNodeTestReceipt(input, passed, passed ? "fixed tests passed" : "first test failed: expected two"), stderr: "", durationMs: 1 } as any;
  });
  const implementation = createGovernedAgentTaskRuntime({ queue, workspace, governance: service, toolProxy: createAgentGovernanceToolProxy({ service }), gatewayService: gateway as any, providerRegistry: registry });
  const runtime = { ...implementation, run(...args: Parameters<typeof implementation.run>) {
    const work = implementation.run(...args); resource.pending.add(work);
    void work.then(() => resource.pending.delete(work), () => resource.pending.delete(work)); return work;
  } };
  const identity = (route: string) => {
    const controller = new AbortController(); resource.controllers.push(controller);
    return { agentId: "agt_original", tenantId: "tenant", userId: "owner", role: "operator", permissions: ["*"],
      execution: { signal: controller.signal, timeoutMs: CHUNK_TIMEOUT_MS, deadlineAt: Date.now() + CHUNK_TIMEOUT_MS, providerDispatchRoute: route } };
  };
  const task = await runtime.prepare(identity("/v1/agents/agt_original/tasks"), { goal: "Set value to two", prompt: "Change only the approved source and verify the immutable test." });
  const request = (action: string) => identity(`/v1/agents/agt_original/tasks/${task.taskId}/${action}`);
  const planned = await runtime.plan(task.taskId, request("plan"), task.revision);
  const confirm = async () => {
    await approvals.decide(planned.approvalId!, "approve", "owner");
    const current = await runtime.read(task.taskId, request("status"));
    return runtime.confirm(task.taskId, request("confirm"), { revision: current.revision, reviewHash: planned.review.reviewHash,
      planHash: planned.plan!.planHash, approvalId: planned.approvalId! });
  };
  return { root, queue, runtime, workspace, workspaceConfig, service, policy, approvals, task, planned, confirm, request, generate, verify, repoRoot, worktreeRoot,
    revoke: () => { active = false; }, counts: () => ({ leases, steps, toolCalls, codingCalls }) };
}

describe("retained Agent runtime using actual Gateway, approvals, file tools and a mocked container backend", () => {
  it("requires existing human approval and keeps the original plan usable after an unapproved confirmation request", async () => {
    const f = await fixture();
    await expect(f.runtime.confirm(f.task.taskId, f.request("confirm"), { revision: f.planned.revision,
      reviewHash: f.planned.review.reviewHash, planHash: f.planned.plan!.planHash, approvalId: f.planned.approvalId! })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_APPROVAL_REQUIRED" });
    const waiting = await f.runtime.read(f.task.taskId, f.request("status")); expect(waiting.phase).toBe("awaiting_confirmation");
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.verify).not.toHaveBeenCalled();
    expect((await f.confirm()).phase).toBe("paused"); expect(f.counts().leases).toBe(0);
  });
  it("pauses after a real read then resumes original history, preserves first failed verification and repairs within the same task", async () => {
    const f = await fixture(), confirmed = await f.confirm();
    const paused = await f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 1 });
    expect(paused).toMatchObject({ taskId: f.task.taskId, agentRunId: f.task.agentRunId, phase: "paused", stepIndex: 1, counters: { iterations: 1, modelCalls: 2 } });
    expect(paused.stepReceipts).toHaveLength(1); expect(f.verify).not.toHaveBeenCalled();
    const done = await f.runtime.run(f.task.taskId, f.request("run"), { revision: paused.revision, maxIterations: 10 });
    expect(done).toMatchObject({ taskId: f.task.taskId, agentRunId: f.task.agentRunId, phase: "completed", stepIndex: 3,
      counters: { iterations: 5, modelCalls: 6, repairAttempts: 1 }, pendingOperation: null });
    expect(done.verificationAttempts.map(result => result.status)).toEqual(["failed", "passed"]);
    expect(done.verificationAttempts.map(result => result.verification.checkResult?.verdict)).toEqual(["failed", "passed"]);
    expect(done.verificationAttempts[0]!.verification.stdout).toBe("first test failed: expected two");
    expect(done.stepReceipts.map(receipt => [receipt.stepId, receipt.repairAttempt])).toEqual([["read", 0], ["write", 0], ["write", 1]]);
    expect(f.generate).toHaveBeenCalledTimes(6); expect(f.verify).toHaveBeenCalledTimes(2);
    expect(f.service.consumeApprovedArguments).toHaveBeenCalledOnce(); expect(f.service.verifyConsumedArguments).toHaveBeenCalledTimes(2);
    expect(await readFile(join(f.repoRoot, "source.mjs"), "utf8")).toBe("export const value = 1;\n");
    const saved = f.queue.readRetainedTask(f.task.taskId, f.request("status"));
    expect(saved.continuation.state.loopCheckpoint.state.messages.filter((message: any) => message.role === "tool").map((message: any) => message.tool_call_id))
      .toEqual(["read-original", "write-candidate", "repair-candidate"]);
    expect(f.counts()).toMatchObject({ leases: 0, steps: 5, codingCalls: 5 });
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: done.revision })).rejects.toThrow(); expect(f.generate).toHaveBeenCalledTimes(6);
  }, 2 * CHUNK_TIMEOUT_MS + 10000);
  // One unchanged 30s product chunk, plus bounded Git fixture preparation and teardown.
  it("keeps a proved verification failure terminal when no repair is approved", async () => {
    const f = await fixture(false), confirmed = await f.confirm();
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 10 })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_VERIFICATION_FAILED" });
    const stopped = await f.runtime.read(f.task.taskId, f.request("status"));
    expect(stopped).toMatchObject({ phase: "failed", pendingOperation: null, counters: { repairAttempts: 0, modelCalls: 4 } });
    expect(stopped.verificationAttempts).toHaveLength(1); expect(stopped.verificationAttempts[0]!.status).toBe("failed");
    expect(f.generate).toHaveBeenCalledTimes(4); expect(f.counts().leases).toBe(0);
  }, CHUNK_TIMEOUT_MS + 10000);
  it("retains unknown effects if a completed write cannot be checkpointed and refuses replay", async () => {
    const f = await fixture(), confirmed = await f.confirm();
    const checkpoint = f.queue.checkpointRetainedTask.bind(f.queue);
    vi.spyOn(f.queue, "checkpointRetainedTask").mockImplementation(async (...args: any[]) => {
      const next = args[4], inner = next.state?.loopCheckpoint;
      if (inner?.phase === "settled" && inner.state.allToolResults.some((result: any) => result._meta?.toolName === "file_write")) {
        throw Object.assign(Error("fixture checkpoint persistence failure"), { code: "FIXTURE_CHECKPOINT_FAILED", persistenceOutcomeUnknown: true });
      }
      return checkpoint(...args);
    });
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 10 })).rejects.toThrow();
    const stopped = await f.runtime.read(f.task.taskId, f.request("status"));
    expect(stopped.phase).toBe("unknown"); expect(stopped.pendingOperation).not.toBeNull(); expect(stopped.counters.modelCalls).toBe(3);
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: stopped.revision })).rejects.toThrow();
    expect(f.generate).toHaveBeenCalledTimes(3); expect(f.verify).not.toHaveBeenCalled(); expect(f.counts().leases).toBe(0);
  });
  // This verification also owns one unchanged product chunk and the same fixture lifecycle.
  it("keeps uncertain verification terminal without a self-referencing cleanup error", async () => {
    const f = await fixture(), confirmed = await f.confirm();
    f.verify.mockResolvedValueOnce({ backend: "container", exitCode: 137, killed: true, oomKilled: false,
      truncated: false, cleanupUncertain: false, stdout: "incomplete synthetic execution", stderr: "killed" } as any);
    let rejected: any;
    try { await f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 10 }); }
    catch (error) { rejected = error; }
    expect(rejected instanceof Error).toBe(true);
    expect(rejected.code).toBe("AGENT_LONG_TASK_VERIFICATION_OUTCOME_UNKNOWN");
    expect(rejected.outcomeUnknown).toBe(true);
    expect(rejected.cause === rejected).toBe(false);
    const stopped = await f.runtime.read(f.task.taskId, f.request("status"));
    expect(stopped.phase).toBe("unknown"); expect(stopped.verificationAttempts).toEqual([]);
    expect(stopped.counters.repairAttempts).toBe(0); expect(f.counts().leases).toBe(0);
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: stopped.revision })).rejects.toThrow();
    expect(f.generate).toHaveBeenCalledTimes(4); expect(f.verify).toHaveBeenCalledOnce();
  }, CHUNK_TIMEOUT_MS + 10000);
  it("blocks changed current policy and competing original-task claims without making another model call", async () => {
    const f = await fixture(), confirmed = await f.confirm();
    const results = await Promise.allSettled([f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 1 }),
      f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 1 })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(f.generate).toHaveBeenCalledTimes(2); expect(f.counts().leases).toBe(0);
    const paused = await f.runtime.read(f.task.taskId, f.request("status")); f.revoke();
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: paused.revision })).rejects.toMatchObject({ code: "AGENT_NOT_ACTIVE" });
    expect(f.generate).toHaveBeenCalledTimes(2);
    await expect(f.runtime.read(f.task.taskId, { ...f.request("status"), tenantId: "different" })).rejects.toThrow();
  });
  it("keeps pause and cancel tracking when two requests finish authorization together", async () => {
    const f = await fixture(), confirmed = await f.confirm();
    const authorize = f.service.authorizeAgentExecution.getMockImplementation();
    let admissions = 0, releaseAdmission!: () => void, releaseProvider!: () => void, providerStarted!: () => void;
    const admissionGate = new Promise<void>(resolve => { releaseAdmission = resolve; });
    const providerGate = new Promise<void>(resolve => { releaseProvider = resolve; });
    const started = new Promise<void>(resolve => { providerStarted = resolve; });
    f.service.authorizeAgentExecution.mockImplementation(async (...args: any[]) => {
      const result = await authorize(...args); if (++admissions === 2) releaseAdmission(); await admissionGate; return result;
    });
    f.generate.mockImplementationOnce(async () => { providerStarted(); await providerGate;
      return response("", [tool("read-original", "file_read", { file_path: "source.mjs" })]); });
    let rejected!: () => void; const loser = new Promise<void>(resolve => { rejected = resolve; });
    const calls = [1, 2].map(() => f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 1 })
      .catch(error => { rejected(); return error; }));
    try {
      await Promise.all([started, loser]);
      const running = await f.runtime.read(f.task.taskId, f.request("status"));
      expect(running.controlRequested).toBe("run");
      const requested = await f.runtime.control(f.task.taskId, f.request("pause"), running.revision, "pause");
      expect(requested.controlRequested).toBe("pause");
    } finally { releaseAdmission(); releaseProvider(); await Promise.all(calls); }
    expect(f.counts().leases).toBe(0);
  });
  it("preserves the original persistence failure when the retained queue becomes unavailable", async () => {
    const f = await fixture(), confirmed = await f.confirm(), commit = f.queue.retainedStateBinding.commit.bind(f.queue.retainedStateBinding);
    const original = Object.assign(Error("original fixture persistence failure"), { code: "ORIGINAL_PERSISTENCE_FAILURE" });
    vi.spyOn(f.queue.retainedStateBinding, "commit").mockImplementationOnce(commit).mockRejectedValueOnce(original);
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 1 }))
      .rejects.toMatchObject({ code: "ORIGINAL_PERSISTENCE_FAILURE", persistenceOutcomeUnknown: true });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.verify).not.toHaveBeenCalled(); expect(f.counts().leases).toBe(0);
  });
  it("records a known rejected model result as failed while retaining its budget and excluding unsafe content", async () => {
    const f = await fixture(), confirmed = await f.confirm();
    f.generate.mockResolvedValueOnce(response("password=private-task-response-fixture"));
    await expect(f.runtime.run(f.task.taskId, f.request("run"), { revision: confirmed.revision, maxIterations: 1 }))
      .rejects.toMatchObject({ outcomeUnknown: false });
    const stopped = await f.runtime.read(f.task.taskId, f.request("status"));
    expect(stopped).toMatchObject({ phase: "failed", pendingOperation: null, counters: { modelCalls: 2, reservedTokens: 36864 } });
    expect(stopped.modelReceipts.at(-1)).toMatchObject({ status: "failed", providerCallAttempted: true, totalTokens: 130 });
    expect(stopped.stepReceipts).toEqual([]); expect(JSON.stringify(stopped)).not.toContain("private-task-response-fixture");
    expect(f.verify).not.toHaveBeenCalled(); expect(f.counts().leases).toBe(0);
  });
  it("rejects a denied profile before inspecting the repository or creating another task", async () => {
    const f = await fixture(); f.policy.permissions.canWrite = false;
    await writeFile(join(f.repoRoot, "source.mjs"), "changed by the fixture to make repository inspection fail\n");
    await expect(f.runtime.prepare(f.request("prepare"), { goal: "Another task", prompt: "The denied task must not inspect source." }))
      .rejects.toMatchObject({ code: "AGENT_LONG_TASK_POLICY_UNSUPPORTED" });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.counts().leases).toBe(0);
  });
  it("keeps an original confirmation awaiting approval when consumption explicitly returns no match", async () => {
    const f = await fixture(); await f.approvals.decide(f.planned.approvalId!, "approve", "owner");
    f.service.consumeApprovedArguments.mockResolvedValueOnce(null);
    await expect(f.runtime.confirm(f.task.taskId, f.request("confirm"), { revision: f.planned.revision,
      reviewHash: f.planned.review.reviewHash, planHash: f.planned.plan!.planHash, approvalId: f.planned.approvalId! }))
      .rejects.toMatchObject({ code: "AGENT_LONG_TASK_APPROVAL_REQUIRED", outcomeUnknown: false });
    const current = await f.runtime.read(f.task.taskId, f.request("status"));
    expect(current).toMatchObject({ phase: "awaiting_confirmation", pendingOperation: null, confirmedApprovalId: null });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.counts().leases).toBe(0);
  });
});
