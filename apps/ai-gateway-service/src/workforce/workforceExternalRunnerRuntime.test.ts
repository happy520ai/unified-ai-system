import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceGit } from "./workforceGit.ts";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { TaskQueueManager } from "./taskQueueManager.js";
import { executeWorkforceDag } from "./workforceDagExecutor.ts";
import { externalRunnerHash, freezeWorkforceExternalRunnerProfile } from "./workforceExternalRunnerProfile.ts";
import { createExternalRunnerMetadata, readExternalRunnerState } from "./workforceExternalRunnerState.ts";
import type { ExternalRunnerState } from "./workforceExternalRunnerState.ts";
import { createWorkforceExternalRunnerFactory, reviewWorkforceExternalRunner, preflightWorkforceExternalRunner,
  runWorkforceExternalRunner, recoverWorkforceExternalRunner, readVerifiedWorkforceExternalRunnerResult } from "./workforceExternalRunnerRuntime.ts";

const native = vi.hoisted(() => ({ create: vi.fn(), configuration: vi.fn(), liveness: vi.fn(), owner: vi.fn(), ownerLiveness: vi.fn() }));
vi.mock("./workforceExternalRunnerProcess.ts", () => ({ createExternalRunnerProcess: native.create,
  assertExternalRunnerProcessConfiguration: native.configuration, readExternalRunnerProcessLiveness: native.liveness,
  readExternalRunnerProcessOwner: native.owner, readExternalRunnerOwnerLiveness: native.ownerLiveness }));
const runFile = promisify(execFile), hash = (text: string) => createHash("sha256").update(text).digest("hex");
const beforeText = "export const value = 1;\n", afterText = "export const value = 2;\n";
const testText = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from '../src/value.mjs';\ntest('independent approved value', () => assert.equal(value, 2));\n";
const patchItem = { id: "patch-original", type: "fileChange", status: "inProgress", changes: [{ path: "src/value.mjs", kind: { type: "update", move_path: null },
  diff: "--- a/src/value.mjs\n+++ b/src/value.mjs\n@@ -1 +1 @@\n-export const value = 1;\n+export const value = 2;\n" }] };
type Mode = "approved" | "text-only" | "unapproved-mutation" | "wrong-permission" | "revoke" | "cancel" | "bad-value" | "close-unknown" | "filesystem-blocked";
const disposals: Array<() => Promise<void>> = [];
let backendRun: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks(); native.configuration.mockResolvedValue(undefined); native.liveness.mockResolvedValue("stopped");
  native.owner.mockResolvedValue({ pid: 8800, created: "134335350000000000" }); native.ownerLiveness.mockResolvedValue("stopped");
  vi.spyOn(ContainerSandboxBackend.prototype, "attest").mockResolvedValue({} as any);
  backendRun = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async (request: any) => {
    expect(request).toMatchObject({ command: "node --test test/value.test.mjs", workspaceMode: "ro", networkAccess: false, env: {} });
    let stdout = "", stderr = "", exitCode = 0;
    try { ({ stdout, stderr } = await runFile(process.execPath, ["--test", "test/value.test.mjs"], { cwd: request.workspace, env: {}, windowsHide: true, timeout: 5000 })); }
    catch (error: any) { stdout = error.stdout ?? ""; stderr = error.stderr ?? ""; exitCode = typeof error.code === "number" ? error.code : 1; }
    return { exitCode, stdout, stderr, killed: false, oomKilled: false, truncated: false, cleanupUncertain: false, backend: "container" } as any;
  });
});
afterEach(async () => { for (const dispose of disposals.splice(0).reverse()) await dispose(); vi.restoreAllMocks(); });

async function fixture(mode: Mode = "approved") {
  const root = await mkdtemp(join(await realpath(tmpdir()), "external-runner-runtime-"));
  const repo = join(root, "repo"), scratch = join(root, "scratch");
  await mkdir(join(repo, "src"), { recursive: true }); await mkdir(join(repo, "test")); await mkdir(scratch);
  await writeFile(join(repo, "src/value.mjs"), beforeText); await writeFile(join(repo, "test/value.test.mjs"), testText);
  await writeFile(join(repo, "unapproved.txt"), "fixture outside approved read paths\n");
  const git = createWorkforceGit(repo);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  await git.run(["add", "src/value.mjs", "test/value.test.mjs", "unapproved.txt"]);
  await git.run(["-c", "user.name=Native Runtime Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Owned test baseline"]);
  const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
  const platform = process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux";
  const profile = freezeWorkforceExternalRunnerProfile({ version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-code", projectId: "fixture",
    roleId: "backend-engineer", baselineRevision, binary: { path: join(root, platform === "win32" ? "codex.exe" : "codex"), sha256: "b".repeat(64), version: "0.153.4", platform },
    nativeModel: { modelId: "fixture-native-model", providerId: "openai" }, disabledMcpServers: [],
    limits: { timeoutMs: 30000, maxInputBytes: 16384, maxMessageBytes: 65536, maxEvents: 64 },
    artifact: { readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
      verification: { verificationId: "approved-tests", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: hash(testText) }],
        image: "node@sha256:" + "c".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 8192, maxDiffBytes: 16384 } } });
  const factoryOptions = { repoRoot: repo, scratchRoot: scratch, enginePath: resolve(root, "fixture-engine"), windowsHost: { path: join(root, "workforce-native-job-host.exe"), sha256: "d".repeat(64) } };
  const factory = createWorkforceExternalRunnerFactory(factoryOptions), review = await reviewWorkforceExternalRunner(factory, profile, "Implement the approved value change");
  const identity = { tenantId: "tenant", userId: "owner", role: "admin", permissions: ["*"] };
  const context = { agentId: "agt_native_fixture", tenantId: identity.tenantId, userId: identity.userId };
  const planId = "plan-native", planDigest = "e".repeat(64), planApprovalId = "approval-native", agentRunId = "agr_native_fixture";
  const executionId = "wf-scope-" + hash(identity.tenantId + "\0" + identity.userId + "\0" + planId + "\0" + planApprovalId);
  const tools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
  const policy: any = { agentId: context.agentId, expiresAt: "2099-01-01T00:00:00Z", policyHash: "sha256:" + "f".repeat(64),
    grantedTools: tools, toolDecisions: Object.fromEntries(tools.map(tool => [tool, "allow"])), permissions: { canWrite: true, canExecuteCode: true }, requirements: {}, limits: {}, scope: {} };
  let agentStatus = "ACTIVE", leasesReleased = 0;
  const audit: any[] = [], reservations: any[] = [];
  const service: any = { expireAgents: async () => {}, getAgent: async (id: string, tenant: string) => id === context.agentId && tenant === identity.tenantId ? { status: agentStatus } : null,
    loadVerifiedPolicy: async () => ({ policy }), emitAudit: async (event: unknown) => { audit.push(event); },
    reserveUsage: async (_id: string, _limits: unknown, delta: unknown) => { reservations.push(delta); return { allowed: true }; },
    acquireToolExecutionLease: async () => agentStatus === "ACTIVE" ? { release: async () => { leasesReleased++; } } : null, releaseUsage: async () => {} };
  const proxy = createAgentGovernanceToolProxy({ service });
  const controller = new AbortController(), agentFence = { signal: controller.signal, async assertActive() {
    if (agentStatus !== "ACTIVE") throw Object.assign(new Error("Fixture Agent revoked"), { code: "AGENT_EXECUTION_FENCED" });
    if (controller.signal.aborted) throw controller.signal.reason;
  } };
  const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") });
  const created = await manager.create({ planId: executionId }); expect(created.success).toBe(true); const worktree = created.worktree!;
  const queue = new TaskQueueManager({ dataDir: join(root, "queue"), env: {} }); await queue.init();
  const task = await queue.enqueue({ title: "Owned native implementation", planId: executionId, tenantId: identity.tenantId, ownerId: identity.userId, dependsOnRoleIds: [] });
  disposals.push(async () => {
    await queue.close();
    for (const item of manager.list().worktrees) expect((await manager.remove(item.worktreeId)).success).toBe(true);
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: false });
  });
  const records: ExternalRunnerState[] = [], saved = join(root, "state.json"), metadata = createExternalRunnerMetadata({ review, agentId: context.agentId, planId, planDigest });
  let persistHook: ((state: ExternalRunnerState) => Promise<void>) | undefined;
  const persist = async (state: ExternalRunnerState) => { records.push(state); await writeFile(saved, JSON.stringify(state)); await persistHook?.(state); };
  const methods: string[] = [], decisions: string[] = [], nativeInputs: any[] = [];
  let original: any, readHistory: any, writes = 0, loopError: unknown, processCount = 0, closeUnknown = mode === "close-unknown";
  function transport(input: any) {
    processCount++; nativeInputs.push(input);
    const stdout = new PassThrough(); let inputBuffer = "", closed = false, pendingApproval: ((decision: string) => void) | undefined;
    let done!: (value: any) => void; const completed = new Promise(resolve => { done = resolve; });
    const send = (value: any) => { if (!closed) stdout.write(Buffer.from(JSON.stringify(value) + "\n")); };
    const notify = (method: string, params: any) => send({ method, params });
    async function handle(message: any) {
      if (!message.method) {
        if (message.id === "approval-original") {
          const decision = message.result?.decision;
          if (decision === "accept") expect(records.at(-1)?.fileApprovals).toEqual([{ itemId: patchItem.id,
            changesHash: externalRunnerHash(patchItem.changes), beforeFilesHash: review.sourceFilesHash, completedFilesHash: null }]);
          decisions.push(decision); pendingApproval?.(decision);
        }
        return;
      }
      methods.push(message.method);
      if (message.method === "initialized") return;
      if (message.method === "initialize") {
        expect(message.params.capabilities).toEqual({ experimentalApi: true, requestAttestation: false });
        send({ id: message.id, result: { userAgent: "fixture-native/0.153.4", platformFamily: "fixture", platformOs: "fixture", codexHome: "native-home-marker" } }); return;
      }
      if (message.method === "thread/start") {
        if (mode === "filesystem-blocked") {
          send({ method: "configWarning", params: {}, emittedAtMs: 1789150000000 });
          send({ id: message.id, error: { code: -32603, message: "private-native-context: windows unelevated restricted-token sandbox cannot enforce split filesystem read restrictions directly; refusing to run unsandboxed" } }); return;
        }
        send({ id: message.id, result: { cwd: input.cwd, model: profile.nativeModel.modelId, modelProvider: profile.nativeModel.providerId,
          activePermissionProfile: { id: mode === "wrong-permission" ? "wrong-profile" : message.params.permissions },
          thread: { id: "thread-original", cwd: input.cwd, modelProvider: profile.nativeModel.providerId, turns: [] } } }); return;
      }
      if (message.method === "thread/read") { send({ id: message.id, result: { thread: readHistory ?? { id: "thread-original", cwd: input.cwd, modelProvider: profile.nativeModel.providerId,
        status: { type: "notLoaded" }, turns: [{ ...original, status: "completed", itemsView: "full" }] } } }); return; }
      if (message.method === "turn/interrupt") { send({ id: message.id, result: {} }); return; }
      if (message.method !== "turn/start") throw new Error("Unexpected fixture method");
      expect(records.at(-1)?.status).toBe("dispatching"); expect(records.at(-1)?.processIdentity).not.toBeNull();
      expect(message.params.input).toEqual([{ type: "text", text: review.prompt }]);
      original = { id: "turn-original", status: "inProgress", items: [{ id: "user-original", type: "userMessage", clientId: message.params.clientUserMessageId,
        content: [{ type: "text", text: review.prompt, text_elements: [] }] }] };
      send({ id: message.id, result: { turn: original } }); notify("turn/started", { threadId: "thread-original", turn: original });
      if (!["text-only", "unapproved-mutation"].includes(mode)) {
        notify("item/started", { threadId: "thread-original", turnId: original.id, item: patchItem, startedAtMs: 1000 });
        if (mode === "revoke") agentStatus = "REVOKED";
        if (mode === "cancel") controller.abort(Object.assign(new Error("Fixture cancelled"), { code: "WORKFORCE_EXECUTION_CANCELLED" }));
        const approval = new Promise<string>(resolveDecision => { pendingApproval = resolveDecision; });
        send({ id: "approval-original", method: "item/fileChange/requestApproval", params: { threadId: "thread-original", turnId: original.id, itemId: patchItem.id, startedAtMs: 1000, grantRoot: null } });
        if (await approval === "accept") {
          writes++; await writeFile(join(input.cwd, "src/value.mjs"), mode === "bad-value" ? "export const value = 3;\n" : afterText);
          const item = { ...patchItem, status: "completed" }; original.items.push(item);
          notify("item/completed", { threadId: "thread-original", turnId: original.id, item });
        }
      } else if (mode === "unapproved-mutation") { writes++; await writeFile(join(input.cwd, "src/value.mjs"), afterText); }
      notify("item/agentMessage/delta", { threadId: "thread-original", turnId: original.id, delta: "native-final-only-marker" });
      const counters = { inputTokens: 21, cachedInputTokens: 5, cacheWriteInputTokens: 0, outputTokens: 8, reasoningOutputTokens: 3, totalTokens: 29 };
      notify("thread/tokenUsage/updated", { threadId: "thread-original", turnId: original.id, tokenUsage: { total: counters, last: counters, modelContextWindow: 128000 } });
      notify("turn/completed", { threadId: "thread-original", turn: { ...original, status: "completed", error: null } });
    }
    const stdin = new Writable({ write(chunk, _encoding, callback) {
      inputBuffer += chunk.toString("utf8");
      for (let index; (index = inputBuffer.indexOf("\n")) >= 0;) {
        const line = inputBuffer.slice(0, index); inputBuffer = inputBuffer.slice(index + 1);
        void handle(JSON.parse(line)).catch(error => { loopError = error; stdout.destroy(new Error("Fixture transport failed")); });
      }
      callback();
    } });
    const finish = async () => {
      closed = true; pendingApproval?.("cancel"); stdout.end(); stdin.end();
      const result = { closed: true, quiescent: !closeUnknown, status: closeUnknown ? "unknown" : "exited", exitCode: 0 }; done(result); return result;
    };
    return { stdout, stdin, identity: { kind: "windows-job", hostPid: 9000 + processCount * 2, childPid: 9001 + processCount * 2,
      hostCreated: "134335354337170864", childCreated: "134335354337632843" }, completed, close: finish, cancel: finish };
  }
  native.create.mockImplementation(async input => transport(input));
  const preflightInput = { review, identity, context, policy, usage: { toolCalls: 0, steps: 0, records: 0 }, roleCount: 1, planId, planDigest,
    signal: controller.signal, deadlineAt: Date.now() + 30000, toolProxy: proxy };
  async function run() {
    const token = await preflightWorkforceExternalRunner(factory, preflightInput);
    let result: any, error: any;
    try {
      await executeWorkforceDag({ tasks: [{ queueTaskId: task.taskId, roleId: "backend-engineer", dependsOnRoleIds: [] }], taskQueue: queue,
        context: { executionId, governedAgentId: context.agentId, agentRunId }, agentExecutionFence: agentFence,
        executeRole: async (_role, taskContext) => {
          try { result = await runWorkforceExternalRunner(factory, token, { executionId, taskId: task.taskId, agentRunId, planApprovalId,
            manager, worktreeId: worktree.worktreeId, agentFence,
            taskFence: taskContext.externalEffectFence as Parameters<typeof runWorkforceExternalRunner>[2]["taskFence"], toolProxy: proxy,
            signal: controller.signal, abort: reason => controller.abort(reason), persist }); return result; }
          catch (caught) { error = caught; throw caught; }
        } });
    } catch (caught) { error ??= caught; }
    return { result, error };
  }
  async function recovery(overrides: Record<string, unknown> = {}) {
    const persisted = JSON.parse(await readFile(saved, "utf8"));
    const state = readExternalRunnerState(persisted, { executionId, metadata });
    return recoverWorkforceExternalRunner(createWorkforceExternalRunnerFactory(factoryOptions), { metadata: JSON.parse(JSON.stringify(metadata)), state,
      identity, context, policy, toolProxy: proxy, signal: new AbortController().signal, deadlineAt: Date.now() + 30000,
      assertActive: async () => { if (agentStatus !== "ACTIVE") throw new Error("Fixture revoked"); }, persist, ...overrides } as any);
  }
  return { root, repo, scratch, git, worktree, profile, factory, review, metadata, identity, context, policy, proxy, preflightInput, run, recovery,
    setPersistHook: (hook: (state: ExternalRunnerState) => Promise<void>) => { persistHook = hook; }, abort: () => controller.abort(),
    records, methods, decisions, nativeInputs, audit, reservations, getWrites: () => writes, loopError: () => loopError, getReleased: () => leasesReleased,
    setCloseKnown: () => { closeUnknown = false; }, setHistory: (value: unknown) => { readHistory = value; }, executionId, taskId: task.taskId };
}

describe("governed native runner runtime with real owned Git worktrees", () => {
  it("surfaces the native filesystem support requirement without sending a turn or exposing native error text", async () => {
    const f = await fixture("filesystem-blocked"), { result, error } = await f.run();
    expect(result).toBeUndefined(); expect(error.details).toMatchObject({ causeCode: "WORKFORCE_EXTERNAL_RUNNER_NATIVE_FILESYSTEM_SUPPORT_REQUIRED", outcomeUnknown: false, processClosed: true, projectFileWrites: null });
    expect(f.records.at(-1)?.error?.code).toBe("WORKFORCE_EXTERNAL_RUNNER_NATIVE_FILESYSTEM_SUPPORT_REQUIRED");
    expect(f.methods).toEqual(["initialize", "initialized", "thread/start"]); expect(f.getWrites()).toBe(0); expect(backendRun).not.toHaveBeenCalled();
    expect(JSON.stringify({ records: f.records, error })).not.toContain("private-native-context");
  }, 30000);
  it("verifies one approved original turn only after an actual edit, independent test and process quiescence", async () => {
    const f = await fixture(), { result, error } = await f.run(); expect(error, String(error?.details?.causeCode)).toBeUndefined(); expect(f.loopError()).toBeUndefined();
    expect(result).toMatchObject({ status: "verified", nativeTurnsDispatched: 1, nativeModelRequestCount: null, gatewayProviderCalls: 0, processClosed: true,
      nativeUsage: { source: "native-thread-notification", final: false, turnId: "turn-original", total: { inputTokens: 21, cachedInputTokens: 5, outputTokens: 8, reasoningOutputTokens: 3, totalTokens: 29 } },
      verification: { exitCode: 0, cleanupConfirmed: true } });
    expect(f.decisions).toEqual(["accept"]); expect(f.getWrites()).toBe(1); expect(f.methods.filter(method => method === "turn/start")).toHaveLength(1);
    expect(await readFile(join(f.worktree.path, "src/value.mjs"), "utf8")).toBe(afterText);
    expect(await readFile(join(f.repo, "src/value.mjs"), "utf8")).toBe(beforeText); expect((await f.git.run(["status", "--porcelain=v1"])).stdout).toBe("");
    expect(await readFile(join(f.worktree.path, "test/value.test.mjs"), "utf8")).toBe(testText); expect(backendRun).toHaveBeenCalledOnce();
    expect(f.reservations).toHaveLength(2); expect(f.getReleased()).toBe(2); expect(await readdir(f.scratch)).toEqual([]);
    expect(f.records.at(-1)?.fileApprovals).toEqual([{ itemId: patchItem.id, changesHash: externalRunnerHash(patchItem.changes),
      beforeFilesHash: f.review.sourceFilesHash, completedFilesHash: result.verification.snapshotHash }]);
    expect(readVerifiedWorkforceExternalRunnerResult(result, { executionId: f.executionId, taskId: f.taskId, agentId: f.context.agentId }).state.status).toBe("verified");
    expect(() => readVerifiedWorkforceExternalRunnerResult(JSON.parse(JSON.stringify(result)), { executionId: f.executionId, taskId: f.taskId, agentId: f.context.agentId })).toThrow();
    expect(JSON.stringify(f.records)).not.toMatch(/native-final-only-marker|native-home-marker/u);
  }, 30000);

  it("does not launch a native process when cancellation occurs during the durable start intent", async () => {
    const f = await fixture();
    f.setPersistHook(async state => { if (state.status === "prepared" && state.processClosed === false) f.abort(); });
    const { result, error } = await f.run();
    expect(result).toBeUndefined(); expect(error).toBeDefined(); expect(native.create).not.toHaveBeenCalled();
    expect(f.records.at(-1)).toMatchObject({ status: "cancelled", processClosed: true });
    expect(error.details.projectFileWrites).toBe(false);
  }, 30000);

  it("blocks recovery while the original worker is still independently verifying", async () => {
    const f = await fixture();
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; }), released = new Promise<void>(resolve => { release = resolve; });
    const implementation = backendRun.getMockImplementation()!;
    backendRun.mockImplementationOnce(async (...args: any[]) => { enter(); await released; return implementation(...args); });
    const running = f.run();
    try {
      await entered; expect(f.records.at(-1)?.status).toBe("verifying");
      await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_OWNER_ACTIVE" });
      expect(native.create).toHaveBeenCalledOnce();
    } finally { release(); }
    expect((await running).result?.status).toBe("verified");
  }, 30000);

  it("retains each uncertain observer and never launches another until that observer is confirmed stopped", async () => {
    const f = await fixture("close-unknown"); await f.run();
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_RECOVERY_UNKNOWN" });
    const previous = f.records.at(-1)!;
    expect(previous.recoveryProcesses).toHaveLength(1); expect(previous.recoveryProcesses[0]!.closed).toBe(false);
    const observer = previous.recoveryProcesses[0]!.identity!;
    native.liveness.mockImplementation(async identity => identity.hostPid === observer.hostPid ? "running" : "stopped");
    await expect(f.recovery()).rejects.toMatchObject({ details: { causeCode: "WORKFORCE_EXTERNAL_RUNNER_RECOVERY_OBSERVER_NOT_CONFIRMED_STOPPED" } });
    expect(native.create).toHaveBeenCalledTimes(2); expect(backendRun).not.toHaveBeenCalled();
    native.liveness.mockResolvedValue("stopped"); f.setCloseKnown();
    const recovered = await f.recovery();
    expect(recovered.state.recoveryProcesses).toHaveLength(2); expect(recovered.state.recoveryProcesses.every((entry: any) => entry.closed)).toBe(true);
    expect(recovered.state.processIdentity).toEqual(previous.processIdentity);
    expect(f.methods.filter(method => method === "turn/start")).toHaveLength(1);
  }, 30000);

  it("requires a prior Gateway process to stop before reconciling its original task after restart", async () => {
    const f = await fixture("close-unknown"); await f.run(); f.setCloseKnown();
    native.owner.mockResolvedValue({ pid: 8801, created: "134335351000000000" }); native.ownerLiveness.mockResolvedValue("running");
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_OWNER_NOT_CONFIRMED_STOPPED" });
    expect(native.create).toHaveBeenCalledOnce();
    native.ownerLiveness.mockResolvedValue("stopped");
    expect((await f.recovery()).recoveredOriginal).toBe(true);
    expect(f.records.at(-1)?.ownerProcess?.pid).toBe(8800);
  }, 30000);

  it("does not start new verification while original container cleanup remains unknown", async () => {
    const f = await fixture();
    backendRun.mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "", killed: false, oomKilled: false,
      truncated: false, cleanupUncertain: true, backend: "container" } as any);
    const { error } = await f.run(); expect(error).toBeDefined();
    expect(f.records.at(-1)?.verification).toMatchObject({ passed: false, cleanupUncertain: true });
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_VERIFICATION_CLEANUP_UNKNOWN" });
    expect(native.create).toHaveBeenCalledOnce(); expect(backendRun).toHaveBeenCalledOnce();
  }, 30000);

  it.each(["text-only", "unapproved-mutation"] as const)("does not turn %s or native completion into verified delivery", async mode => {
    const f = await fixture(mode), { result, error } = await f.run(); expect(result).toBeUndefined(); expect(error).toBeDefined();
    expect(f.records.at(-1)).toMatchObject({ status: "failed", processClosed: true, artifact: null, verification: null });
    expect(f.decisions).toEqual([]); expect(backendRun).not.toHaveBeenCalled(); expect(f.methods.filter(method => method === "turn/start")).toHaveLength(1);
  }, 30000);

  it.each(["revoke", "cancel"] as const)("denies the original pending write after %s", async mode => {
    const f = await fixture(mode), { result, error } = await f.run(); expect(result).toBeUndefined(); expect(error).toBeDefined();
    expect(f.getWrites()).toBe(0); expect(f.decisions).not.toContain("accept"); expect(backendRun).not.toHaveBeenCalled();
    expect(await readFile(join(f.worktree.path, "src/value.mjs"), "utf8")).toBe(beforeText);
    expect(f.records.at(-1)?.status).not.toBe("verified");
  }, 30000);

  it("refuses an unconfirmed native permission profile before starting any original turn", async () => {
    const f = await fixture("wrong-permission"), { result, error } = await f.run(); expect(result).toBeUndefined(); expect(error).toBeDefined();
    expect(f.methods).not.toContain("turn/start"); expect(f.getWrites()).toBe(0); expect(backendRun).not.toHaveBeenCalled();
  }, 30000);

  it("runs the immutable test against the changed snapshot and rejects an incorrect implementation", async () => {
    const f = await fixture("bad-value"), { result, error } = await f.run(); expect(result).toBeUndefined(); expect(error).toBeDefined();
    expect(f.getWrites()).toBe(1); expect(backendRun).toHaveBeenCalledOnce(); expect(f.records.at(-1)?.status).not.toBe("verified");
    expect(await readFile(join(f.worktree.path, "test/value.test.mjs"), "utf8")).toBe(testText); expect(await readdir(f.scratch)).toEqual([]);
  }, 30000);

  it("keeps uncertain process closure unknown, then reopens saved original history without another turn", async () => {
    const f = await fixture("close-unknown"), initial = await f.run(); expect(initial.error).toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_OUTCOME_UNKNOWN" });
    expect(f.records.at(-1)).toMatchObject({ status: "unknown", processClosed: false, threadId: "thread-original", turnId: "turn-original" });
    expect(backendRun).not.toHaveBeenCalled(); f.setCloseKnown(); const split = f.methods.length;
    const recovered = await f.recovery(); expect(recovered).toMatchObject({ recoveredOriginal: true, newNativeTurns: 0, state: { status: "verified", processClosed: true } });
    expect(f.methods.slice(split)).toEqual(["initialize", "initialized", "thread/read"]); expect(f.methods.filter(method => method === "turn/start")).toHaveLength(1);
    expect(native.liveness).toHaveBeenCalledOnce(); expect(backendRun).toHaveBeenCalledOnce(); expect(f.getWrites()).toBe(1);
  }, 30000);

  it("rejects cross-owner recovery and a live original process before opening an observer", async () => {
    const f = await fixture("close-unknown"); await f.run(); const calls = native.create.mock.calls.length;
    await expect(f.recovery({ identity: { ...f.identity, userId: "different" }, context: { ...f.context, userId: "different" } })).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_RECOVERY_OWNER_MISMATCH" });
    expect(native.create).toHaveBeenCalledTimes(calls); native.liveness.mockResolvedValue("running");
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_PROCESS_NOT_CONFIRMED_STOPPED" });
    expect(native.create).toHaveBeenCalledTimes(calls); expect(backendRun).not.toHaveBeenCalled();
  }, 30000);

  it("cannot recover an unapproved mutation into verified delivery from completion text alone", async () => {
    const f = await fixture("unapproved-mutation"), initial = await f.run(); expect(initial.result).toBeUndefined();
    expect(f.records.at(-1)?.fileApprovals).toEqual([]); expect(f.getWrites()).toBe(1);
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_RECOVERY_UNKNOWN" });
    expect(f.records.at(-1)).toMatchObject({ status: "unknown", verification: null }); expect(backendRun).not.toHaveBeenCalled();
    expect(f.methods.filter(method => method === "turn/start")).toHaveLength(1);
  }, 30000);

  it("rejects changed baseline and immutable source during original recovery", async () => {
    const f = await fixture("close-unknown"); await f.run(); f.setCloseKnown();
    await writeFile(join(f.worktree.path, "test/value.test.mjs"), "console.log('changed immutable fixture');\n");
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_RECOVERY_UNKNOWN" }); expect(backendRun).not.toHaveBeenCalled();
    await writeFile(join(f.worktree.path, "test/value.test.mjs"), testText);
    const git = createWorkforceGit(f.worktree.path); await git.run(["add", "src/value.mjs"]);
    await git.run(["-c", "user.name=Native Runtime Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Changed owned baseline"]);
    const calls = native.create.mock.calls.length;
    await expect(f.recovery()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_BASELINE_CHANGED" }); expect(native.create).toHaveBeenCalledTimes(calls);
  }, 30000);

  it("rejects unsupported policy before native preflight or process startup", async () => {
    const f = await fixture();
    await expect(preflightWorkforceExternalRunner(f.factory, { ...f.preflightInput, policy: { ...f.policy, permissions: { ...f.policy.permissions, canWrite: false } } }))
      .rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_POLICY_UNSUPPORTED" });
    expect(native.configuration).not.toHaveBeenCalled(); expect(native.create).not.toHaveBeenCalled(); expect(backendRun).not.toHaveBeenCalled();
  });
});
