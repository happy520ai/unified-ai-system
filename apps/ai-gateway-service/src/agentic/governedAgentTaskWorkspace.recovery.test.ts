// @test-isolation process
import { createHash, createHmac, randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { expect, it, vi, type TestContext } from "vitest";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import { freezeGovernedAgentTaskProfile, parseGovernedAgentTaskPlan } from "./governedAgentTaskProfile.ts";
import { createGovernedAgentTaskWorkspace } from "./governedAgentTaskWorkspace.ts";
import type { GovernedAgentTaskWorkspaceChunkInput, GovernedAgentTaskWorkspaceRecovery } from "./governedAgentTaskWorkspace.ts";
import { buildAgenticCheckpointBinding, createAgenticCheckpoint } from "./agenticCheckpoint.ts";
import { getOpenAITools } from "./agenticCodingLoop-helpers.js";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { assertOwnedWorkforceWorktree, createWorktreeIsolation, restoreOwnedWorkforceWorktree } from "../workforce/worktreeIsolation.js";

const replacement = vi.hoisted(() => ({ path: null as string | null, failUnder: null as string | null, contentReads: null as string[] | null }));
vi.mock("node:fs/promises", async original => {
  const actual = await original<typeof import("node:fs/promises")>();
  return { ...actual, readFile: async (path: any, options: any) => {
    replacement.contentReads?.push(String(path)); return actual.readFile(path, options);
  }, open: async (path: any, flags: any, mode: any) => {
    replacement.contentReads?.push(String(path)); return actual.open(path, flags, mode);
  }, lstat: async (path: any, options: any) => {
    if (replacement.failUnder && String(path).startsWith(replacement.failUnder) && String(path).endsWith(".git")) throw new Error("Owned identity fixture failure");
    const state = await actual.lstat(path, options);
    if (path === replacement.path) Object.defineProperty(state, "ino", { value: typeof state.ino === "bigint" ? state.ino + 1n : state.ino + 1 });
    return state;
  } };
});

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// Synthetic backend evidence for recovery tests; no container or test process is executed here.
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
const checkpointHash = (value: unknown) => "sha256:" + hash(stableStringify(value));
type Workspace = ReturnType<typeof createGovernedAgentTaskWorkspace>;
type Chunk = Awaited<ReturnType<Workspace["forChunk"]>>;
async function fixture(context: TestContext, aliasWorktreeRoot = false) {
  const base = await realpath(tmpdir()), creating = mkdtemp(join(base, "agent-task-recovery-"));
  const abort = new AbortController(), pending = new Set<Promise<unknown>>(), chunks: Chunk[] = [], calls: any[] = [];
  context.onTestFinished(async () => {
    abort.abort(); while (pending.size) await Promise.allSettled([...pending]);
    await Promise.allSettled(chunks.map(chunk => chunk.close()));
    replacement.path = null; replacement.failUnder = null; replacement.contentReads = null; vi.restoreAllMocks();
    const root = await creating;
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(base);
    expect(root.startsWith(join(base, "agent-task-recovery-"))).toBe(true); await rm(root, { recursive: true, force: false });
  });
  const track = <T>(operation: Promise<T>) => { pending.add(operation); void operation.then(() => pending.delete(operation), () => pending.delete(operation)); return operation; };
  const root = await creating, repoRoot = join(root, "repo"),
    worktreeRoot = join(aliasWorktreeRoot ? join(tmpdir(), basename(root)) : root, "worktrees"), scratchRoot = join(root, "scratch");
  const signal = AbortSignal.any([context.signal, abort.signal]);
  await mkdir(repoRoot); await mkdir(scratchRoot);
  const before = "export const value = 1;\n", testText = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from './source.mjs';\ntest('value is two', () => assert.equal(value, 2));\n";
  await writeFile(join(repoRoot, "source.mjs"), before); await writeFile(join(repoRoot, "test.mjs"), testText);
  const ownedGit = createWorkforceGit(repoRoot);
  const git = (...args: Parameters<typeof ownedGit.run>) => track(ownedGit.run(...args));
  await git(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  await git(["add", "source.mjs", "test.mjs"]);
  await git(["-c", "user.name=Recovery Fixture", "-c", "user.email=recovery@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Owned baseline"]);
  const baselineRevision = (await git(["rev-parse", "HEAD"])).stdout.trim();
  const profile = freezeGovernedAgentTaskProfile({ version: 1, mode: "governed-agent-long-task", profileId: "recovery", projectId: "fixture", baselineRevision,
    model: { providerId: "fake", modelId: "fake", maxInputTokens: 8192, maxOutputTokens: 4096 },
    limits: { maxPlanSteps: 3, maxIterations: 6, maxModelCalls: 7, maxTotalTokens: 32768, maxRepairAttempts: 2, chunkTimeoutMs: 30000, maxInputBytes: 4096 },
    verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1, requiredChecks: [{ file: "test.mjs", name: "value is two" }] },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "fixed", command: "node --test 'test.mjs'", immutableTests: [{ path: "test.mjs", sha256: hash(testText) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const config = { repoRoot, worktreeRoot, scratchRoot, enginePath: resolve("owned-fixture-engine"), profile };
  const factory = createGovernedAgentTaskWorkspace(config), prepared = await track(factory.prepareReview({ goal: "Set value to two", prompt: "Original reviewed task.", signal }));
  const plan = parseGovernedAgentTaskPlan(JSON.stringify({ version: 1, reviewHash: prepared.review.reviewHash, steps: [
    { id: "read", kind: "inspect", title: "Read source", paths: ["source.mjs"] },
    { id: "write", kind: "implement", title: "Update source", paths: ["source.mjs"] },
    { id: "verify", kind: "verify", title: "Verify immutable tests", paths: ["test.mjs"] },
  ] }), prepared.review);
  const identity = { agentId: "agt_recovery", tenantId: "tenant", userId: "owner" };
  const grantedTools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"], policy: any = {
    agentId: identity.agentId, policyHash: "sha256:" + "f".repeat(64), expiresAt: "2099-01-01T00:00:00Z",
    grantedTools, toolDecisions: Object.fromEntries(grantedTools.map(tool => [tool, "allow"])),
    permissions: { canWrite: true, canExecuteCode: true }, scope: {}, requirements: {}, limits: {} };
  const service: any = { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }), loadVerifiedPolicy: vi.fn(async () => ({ policy })),
    reserveUsage: async () => ({ allowed: true }), emitAudit: async () => {}, acquireToolExecutionLease: async () => ({ release: async () => {} }) };
  let stepIndex = 0, repairAttempts = 0;
  const input = { taskId: "original-task", review: prepared.review, plan, context: identity, policyHash: policy.policyHash,
    toolProxy: createAgentGovernanceToolProxy({ service }), signal, deadlineAt: Date.now() + 120000,
    assertActive: vi.fn(async () => signal.throwIfAborted()), getStep: () => plan.steps[stepIndex]!, getRepairAttempt: () => repairAttempts };
  const open = (owner: Workspace, value: GovernedAgentTaskWorkspaceChunkInput = input, options?: GovernedAgentTaskWorkspaceRecovery) => track((async () => {
    const chunk = await owner.forChunk(value, options); chunks.push(chunk); return chunk;
  })());
  const chunk = await open(factory), current = await track(chunk.captureCurrent());
  const original: any = { taskId: input.taskId, agentRunId: "agr_original", review: prepared.review, plan, workspaceReceipt: chunk.workspaceReceipt,
    sourceFilesHash: current.filesHash, stepReceipts: [], verificationAttempts: [], identity, policyHash: policy.policyHash,
    loopCheckpoint: null, checkpointHash: checkpointHash(null), stepIndex: 0,
    counters: { iterations: 0, modelCalls: 1, reservedTokens: 1, repairAttempts: 0 } };
  const call = (name: string, params: any) => track((async () => {
    const result = await chunk.tools.executeTool(name, params); calls.push({ name, params, result }); return result;
  })());
  const seal = async (feedback?: string) => {
    const binding = await buildAgenticCheckpointBinding({ workingDirectory: chunk.workingDirectory, goal: prepared.review.goal,
      providerId: profile.model.providerId, modelId: profile.model.modelId, tools: getOpenAITools(chunk.tools, ["file_read", "file_write", "file_edit"]),
      maxIterations: profile.limits.maxIterations, maxTokensPerTurn: profile.model.maxOutputTokens, tokenBudget: profile.limits.maxTotalTokens,
      configuration: { systemPrompt: "Owned frozen system", initialMessages: [], planningEnabled: false, maxPlanSteps: 10, dynamicBudgetEnabled: false,
        frozenContext: true, maxContextTokens: profile.model.maxInputTokens, maxRepairAttempts: profile.limits.maxRepairAttempts, hooks: { settled: true, finalAnswer: true } } });
    const messages: any[] = [{ role: "system", content: "Owned frozen system" }, { role: "user", content: prepared.review.goal }], results: any[] = [], trace: any[] = [];
    for (const [index, item] of calls.entries()) {
      const id = "original-call-" + index, content = JSON.stringify(item.result);
      messages.push({ role: "assistant", content: "", tool_calls: [{ id, type: "function", function: { name: item.name, arguments: JSON.stringify(item.params) } }] },
        { role: "tool", tool_call_id: id, content });
      results.push({ role: "tool", tool_call_id: id, content, _meta: { toolName: item.name, durationMs: 0, isError: false } });
      trace.push({ type: "tool_results", iteration: index + 1 });
    }
    const iterations = calls.length + (feedback ? 1 : 0);
    if (feedback) {
      messages.push({ role: "assistant", content: "Candidate complete" }, { role: "user", content: feedback });
      trace.push({ type: "repair_feedback", iteration: iterations, repairAttempt: repairAttempts, feedback });
    }
    original.loopCheckpoint = createAgenticCheckpoint(binding, { phase: "settled", savedAt: new Date().toISOString(), state: {
      sessionId: randomUUID(), startedAt: Date.now(), messages, initialMessageCount: 2, allToolResults: results, trace, plan: null, planStepIndex: 0,
      totalUsage: { inputTokens: iterations, outputTokens: iterations, totalTokens: iterations * 2 }, usageObservation: { planning: "not_used", provider: "observed" },
      iteration: iterations, effectiveMaxIterations: profile.limits.maxIterations, status: "running", finalAnswer: "", terminalResult: null,
      repairAttempts, nextAction: "iterate", pendingHook: null } });
    original.checkpointHash = checkpointHash(original.loopCheckpoint); original.sourceFilesHash = (await track(chunk.captureCurrent())).filesHash;
    original.stepReceipts = structuredClone(chunk.stepReceipts()); original.stepIndex = stepIndex;
    original.counters = { iterations, modelCalls: iterations + 1, reservedTokens: 1000 + iterations * 4096, repairAttempts };
  };
  const recover = (value: any = original, inputOverrides: any = {}) => {
    const fresh = createGovernedAgentTaskWorkspace(config);
    return { fresh, run: () => open(fresh, { ...input, workspaceReceipt: value.workspaceReceipt, expectedSourceFilesHash: original.sourceFilesHash, ...inputOverrides },
      { recoverOriginal: async () => structuredClone(value) }) };
  };
  return { root, repoRoot, worktreeRoot, scratchRoot, config, profile, factory, prepared, plan, input, chunk, original, open, track, git, before, testText, call, seal, recover, service,
    setStep: (value: number) => { stepIndex = value; }, setRepair: (value: number) => { repairAttempts = value; } };
}

it("reopens the exact original registered worktree through a server callback without creating another", async context => {
  const f = await fixture(context); await f.track(f.chunk.close());
  const registered = (await f.git(["worktree", "list", "--porcelain"])).stdout;
  const fresh = createGovernedAgentTaskWorkspace(f.config), recoverOriginal = vi.fn(async () => structuredClone(f.original));
  const recovered = await f.open(fresh, { ...f.input, workspaceReceipt: f.original.workspaceReceipt, expectedSourceFilesHash: f.original.sourceFilesHash }, { recoverOriginal });
  expect(recovered.workingDirectory).toBe(f.chunk.workingDirectory); expect(fresh.hasOwnership(f.input.taskId, recovered.workspaceReceipt)).toBe(true);
  expect(await readFile(join(recovered.workingDirectory, "source.mjs"), "utf8")).toBe(f.before);
  expect((await f.git(["worktree", "list", "--porcelain"])).stdout).toBe(registered);
  expect(await readdir(f.worktreeRoot)).toHaveLength(1); expect(recoverOriginal.mock.calls.length).toBeGreaterThanOrEqual(2);
});

it.runIf(process.platform === "win32" && /~[0-9]/u.test(tmpdir()))("recovers the original checkpoint with an actual Windows short-path worktree ancestor", async context => {
  const f = await fixture(context, true);
  expect(await realpath(f.repoRoot)).toBe(f.repoRoot); expect(await realpath(f.scratchRoot)).toBe(f.scratchRoot);
  expect(await realpath(f.worktreeRoot)).not.toBe(f.worktreeRoot); expect((await lstat(f.worktreeRoot)).isSymbolicLink()).toBe(false);
  expect(f.chunk.workingDirectory).toBe(await realpath(resolve(f.worktreeRoot, f.chunk.workspaceReceipt.worktreeId)));
  await f.call("file_read", { file_path: "source.mjs" }); f.setStep(1); await f.seal(); await f.track(f.chunk.close());
  const registered = (await f.git(["worktree", "list", "--porcelain"])).stdout, { fresh, run } = f.recover(), recovered = await run();
  expect(recovered.workingDirectory).toBe(f.chunk.workingDirectory); expect(recovered.workspaceReceipt).toEqual(f.original.workspaceReceipt);
  expect(recovered.stepReceipts()).toEqual(f.original.stepReceipts); expect(fresh.hasOwnership(f.input.taskId, recovered.workspaceReceipt)).toBe(true);
  expect(await readFile(join(recovered.workingDirectory, "source.mjs"), "utf8")).toBe(f.before);
  expect((await f.git(["worktree", "list", "--porcelain"])).stdout).toBe(registered); expect(await readdir(f.worktreeRoot)).toHaveLength(1);
});

it("does not accept receipt JSON or a request-side recovery projection as authority", async context => {
  const f = await fixture(context); await f.track(f.chunk.close());
  const fresh = createGovernedAgentTaskWorkspace(f.config);
  await expect(f.open(fresh, { ...f.input, workspaceReceipt: f.original.workspaceReceipt, expectedSourceFilesHash: f.original.sourceFilesHash,
    ...{ recoverOriginal: f.original } })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_OWNERSHIP_UNKNOWN" });
  expect(fresh.hasOwnership(f.input.taskId, f.original.workspaceReceipt)).toBe(false); expect(await readdir(f.worktreeRoot)).toHaveLength(1);
});

it("retains quarantined ownership metadata when identity capture fails after Git creation", async context => {
  const f = await fixture(context), worktreeRoot = join(f.root, "failed-trees");
  const manager = createWorktreeIsolation({ repoRoot: f.repoRoot, worktreeRoot });
  replacement.failUnder = worktreeRoot;
  try {
    expect((await manager.create({ planId: "interrupted-creation" })).success).toBe(false);
    const records = manager.list().worktrees; expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ planId: "interrupted-creation", status: "unknown" });
    expect(manager.getInfo().activeWorktrees).toBe(0);
    expect(await readFile(join(records[0]!.path, "source.mjs"), "utf8")).toBe(f.before);
    await expect(assertOwnedWorkforceWorktree(manager, records[0]!.worktreeId,
      { planId: "interrupted-creation", baselineRevision: f.profile.baselineRevision })).rejects.toThrow();
    expect(await manager.remove(records[0]!.worktreeId)).toMatchObject({ success: false, code: "WORKTREE_REMOVE_FAILED" });
    expect((await manager.cleanup(0)).totalCleaned).toBe(0); expect(manager.list().worktrees).toHaveLength(1);
    replacement.failUnder = null;
    const locations = { repositoryRoot: f.repoRoot, worktreeRoot, worktreeDirectory: records[0]!.path, gitFile: join(records[0]!.path, ".git") };
    const identities = Object.fromEntries(await Promise.all(Object.entries(locations).map(async ([key, path]) => {
      const stat = await lstat(path, { bigint: true }); return [key, { dev: stat.dev.toString(), ino: stat.ino.toString() }];
    })));
    await expect(restoreOwnedWorkforceWorktree(manager, { worktreeId: records[0]!.worktreeId, planId: "interrupted-creation",
      branch: records[0]!.branch, createdAt: records[0]!.createdAt, baselineRevision: f.profile.baselineRevision, identities }, async () => {})).rejects.toThrow();
    expect(manager.list().worktrees[0]!.status).toBe("unknown");
    expect(manager.getInfo().activeWorktrees).toBe(0);
    expect(await readFile(join(records[0]!.path, "source.mjs"), "utf8")).toBe(f.before);
  } finally { replacement.failUnder = null; }
});

it("restores a nonnull checkpoint, canonical receipt key order and prior step receipts", async context => {
  const f = await fixture(context); await f.call("file_read", { file_path: "source.mjs" }); f.setStep(1); await f.seal(); await f.track(f.chunk.close());
  const original = JSON.parse(stableStringify(f.original)), { fresh, run } = f.recover(original), recovered = await run();
  expect(recovered.workingDirectory).toBe(f.chunk.workingDirectory); expect(recovered.stepReceipts()).toEqual(original.stepReceipts);
  expect(fresh.hasOwnership(f.input.taskId, original.workspaceReceipt)).toBe(true);
  expect(await readFile(join(recovered.workingDirectory, "source.mjs"), "utf8")).toBe(f.before);
});

for (const field of ["tenant", "task", "policy", "hash", "branch", "root-identity", "unknown-checkpoint", "old-receipt"]) {
  it("rejects " + field + " mismatch before reopening an actionable workspace", async context => {
    const f = await fixture(context); await f.track(f.chunk.close()); const broken = structuredClone(f.original);
    if (field === "tenant") broken.identity.tenantId = "different";
    if (field === "task") broken.taskId = "different";
    if (field === "policy") broken.policyHash = "sha256:" + "e".repeat(64);
    if (field === "hash") broken.checkpointHash = "sha256:" + "e".repeat(64);
    if (field === "branch") broken.workspaceReceipt.branch = "codex/agent-task-" + randomUUID();
    if (field === "root-identity") broken.workspaceReceipt.identities.repositoryRoot.ino = (BigInt(broken.workspaceReceipt.identities.repositoryRoot.ino) + 1n).toString();
    if (field === "unknown-checkpoint") { broken.loopCheckpoint = {}; broken.checkpointHash = checkpointHash({}); }
    if (field === "old-receipt") broken.workspaceReceipt.version = 1;
    const { fresh, run } = f.recover(broken);
    await expect(run()).rejects.toThrow(); expect(fresh.hasOwnership(f.input.taskId, broken.workspaceReceipt)).toBe(false);
    expect(await readFile(join(f.chunk.workingDirectory, "source.mjs"), "utf8")).toBe(f.before); expect(await readdir(f.worktreeRoot)).toHaveLength(1);
  });
}

for (const target of ["repository", "root", "worktree", "git-file"]) {
  it("rejects replaced " + target + " identity even when path and contents are unchanged", async context => {
    const f = await fixture(context); await f.track(f.chunk.close());
    replacement.path = target === "repository" ? f.repoRoot : target === "root" ? f.worktreeRoot : target === "worktree" ? f.chunk.workingDirectory : join(f.chunk.workingDirectory, ".git");
    const { fresh, run } = f.recover(), backend = vi.spyOn(ContainerSandboxBackend.prototype, "run");
    f.service.loadVerifiedPolicy.mockClear(); replacement.contentReads = [];
    try {
      await expect(run()).rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_OWNERSHIP_UNKNOWN" });
      expect(fresh.hasOwnership(f.input.taskId, f.original.workspaceReceipt)).toBe(false);
      expect(replacement.contentReads).toEqual([]); expect(f.service.loadVerifiedPolicy).not.toHaveBeenCalled(); expect(backend).not.toHaveBeenCalled();
    } finally { replacement.path = null; replacement.contentReads = null; }
    expect(await readFile(join(f.chunk.workingDirectory, "source.mjs"), "utf8")).toBe(f.before); expect(await readdir(f.worktreeRoot)).toHaveLength(1);
  });
}

it("rejects authoritative projection changes during reconciliation", async context => {
  const f = await fixture(context); await f.track(f.chunk.close()); let calls = 0;
  const fresh = createGovernedAgentTaskWorkspace(f.config);
  await expect(f.open(fresh, { ...f.input, workspaceReceipt: f.original.workspaceReceipt, expectedSourceFilesHash: f.original.sourceFilesHash }, {
    recoverOriginal: async () => { const result = structuredClone(f.original); if (++calls > 1) result.agentRunId = "agr_changed"; return result; },
  })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_RECOVERY_CHANGED" });
  expect(fresh.hasOwnership(f.input.taskId, f.original.workspaceReceipt)).toBe(false);
});

// Two original/recovered chunk lifetimes plus bounded setup/cleanup; product timeouts remain unchanged.
it("rehydrates the original baseline and first failed verifier receipt before a bounded repair", async context => {
  const f = await fixture(context); await f.call("file_read", { file_path: "source.mjs" }); f.setStep(1);
  await f.call("file_write", { file_path: "source.mjs", content: "export const value = 0;\n" }); f.setStep(2);
  const base = { killed: false, oomKilled: false, truncated: false, cleanupUncertain: false, backend: "container" };
  const backend = vi.spyOn(ContainerSandboxBackend.prototype, "run")
    .mockImplementationOnce(async (input: any) => ({ ...base, exitCode: 1, stdout: syntheticNodeTestReceipt(input, false, "original failed check"), stderr: "expected two" } as any))
    .mockImplementationOnce(async (input: any) => ({ ...base, exitCode: 0, stdout: syntheticNodeTestReceipt(input, true, "repaired"), stderr: "" } as any));
  const first = await f.track(f.chunk.verify()); f.original.verificationAttempts = [first];
  f.setRepair(1); f.setStep(1); await f.seal("Repair after the retained failed verification."); await f.track(f.chunk.close());
  const { run } = f.recover(), recovered = await run();
  expect(recovered.stepReceipts()).toEqual(f.original.stepReceipts);
  await f.track(recovered.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 2;\n" })); f.setStep(2);
  const verified = await f.track(recovered.verify());
  expect(first.verification.checkResult).toMatchObject({ verdict: "failed", executedPassed: 0 });
  expect(verified).toMatchObject({ status: "passed", failures: [first.verification], verification: {
    checkResult: { verdict: "passed", executedPassed: 1, requiredChecks: [{ file: "test.mjs", name: "value is two", status: "passed" }] } } });
  expect(verified.artifact.filesChanged[0].beforeSha256).toBe(hash(f.before));
  expect(backend).toHaveBeenCalledTimes(2); expect(first.verification.stdout).toBe("original failed check");
}, 2 * 30_000 + 10_000);
