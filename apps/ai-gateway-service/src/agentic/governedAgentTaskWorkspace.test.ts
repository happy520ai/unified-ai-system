import { createHash, createHmac } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import { createFileEditTool } from "../tools/fileEditTool.js";
import { createFileWriteTool } from "../claude-code-patterns/builtInCoreTools.js";
import { freezeGovernedAgentTaskProfile, parseGovernedAgentTaskPlan } from "./governedAgentTaskProfile.ts";
import { createGovernedAgentTaskWorkspace, isGovernedAgentTaskWorkspace } from "./governedAgentTaskWorkspace.ts";

const roots: string[] = [];
const CHUNK_TIMEOUT_MS = 30000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// Synthetic backend evidence for orchestration tests; this does not execute a container or its tests.
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
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "agent-task-workspace-")); roots.push(root);
  const repoRoot = join(root, "repo"), scratchRoot = join(root, "scratch"), worktreeRoot = join(root, "worktrees");
  await mkdir(repoRoot); await mkdir(scratchRoot);
  const testText = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { value } from './source.mjs';\ntest('value is two', () => assert.equal(value, 2));\n";
  await writeFile(join(repoRoot, "source.mjs"), "export const value = 1;\n");
  await writeFile(join(repoRoot, "test.mjs"), testText); await writeFile(join(repoRoot, "unapproved.txt"), "not in source snapshot");
  const git = createWorkforceGit(repoRoot);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  await git.run(["add", "source.mjs", "test.mjs", "unapproved.txt"]);
  await git.run(["-c", "user.name=Agent Workspace Fixture", "-c", "user.email=workspace@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Fixed fixture"]);
  const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
  const profile = freezeGovernedAgentTaskProfile({ version: 1, mode: "governed-agent-long-task", profileId: "bounded-task", projectId: "fixture", baselineRevision,
    model: { providerId: "fake", modelId: "fake", maxInputTokens: 8192, maxOutputTokens: 4096 },
    limits: { maxPlanSteps: 3, maxIterations: 6, maxModelCalls: 7, maxTotalTokens: 32768, maxRepairAttempts: 2, chunkTimeoutMs: CHUNK_TIMEOUT_MS, maxInputBytes: 4096 },
    verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1, requiredChecks: [{ file: "test.mjs", name: "value is two" }] },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "fixed-test", command: "node --test 'test.mjs'", immutableTests: [{ path: "test.mjs", sha256: hash(testText) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000,
        maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const config = { repoRoot, worktreeRoot, scratchRoot, enginePath: resolve("fixture-engine"), profile };
  const factory = createGovernedAgentTaskWorkspace(config);
  const prepared = await factory.prepareReview({ goal: "Set value to two", prompt: "Complete original safe task\nSecond line." });
  const plan = parseGovernedAgentTaskPlan(JSON.stringify({ version: 1, reviewHash: prepared.review.reviewHash, steps: [
    { id: "read", kind: "inspect", title: "Read source", paths: ["source.mjs"] },
    { id: "write", kind: "implement", title: "Correct source", paths: ["source.mjs"] },
    { id: "verify", kind: "verify", title: "Verify fixed tests", paths: ["test.mjs"] },
  ] }), prepared.review);
  const context = { agentId: "agt_workspace", tenantId: "tenant", userId: "owner" };
  const grantedTools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
  const policy: any = { agentId: context.agentId, policyHash: "sha256:" + "f".repeat(64), expiresAt: "2099-01-01T00:00:00Z",
    grantedTools, toolDecisions: Object.fromEntries(grantedTools.map(tool => [tool, "allow"])),
    permissions: { canWrite: true, canExecuteCode: true }, limits: {}, requirements: {}, scope: {} };
  const service: any = { expireAgents: async () => {}, getAgent: async () => ({ status: "ACTIVE" }),
    loadVerifiedPolicy: vi.fn(async () => ({ policy })), reserveUsage: vi.fn(async () => ({ allowed: true })),
    emitAudit: vi.fn(async () => {}), acquireToolExecutionLease: async () => ({ release: async () => {} }) };
  let stepIndex = 0, repairAttempt = 0;
  const input = { taskId: "task-fixture", review: prepared.review, plan, context, policyHash: policy.policyHash,
    toolProxy: createAgentGovernanceToolProxy({ service }), signal: new AbortController().signal, deadlineAt: Date.now() + 120000,
    assertActive: vi.fn(async () => {}), getStep: () => plan.steps[stepIndex]!, getRepairAttempt: () => repairAttempt };
  const chunk = await factory.forChunk(input);
  return { root, config, repoRoot, scratchRoot, worktreeRoot, factory, prepared, input, chunk, policy, service, git, testText,
    setStep: (index: number) => { stepIndex = index; }, setRepair: (value: number) => { repairAttempt = value; } };
}

// This lifecycle performs real Git setup and multiple serialized file actions;
// allow the existing 30s approved chunk plus fixture setup and cleanup.
it("captures complete exact reviewed source, enforces real current Tool Proxy and confines actual writes to owned worktree", async () => {
  const f = await fixture();
  expect(isGovernedAgentTaskWorkspace(f.factory)).toBe(true); expect(isGovernedAgentTaskWorkspace(JSON.parse(JSON.stringify(f.factory)))).toBe(false);
  expect(f.prepared.sourceFiles.map(file => file.path)).toEqual(["source.mjs", "test.mjs"]);
  expect(JSON.stringify(f.prepared)).not.toContain("not in source snapshot");
  expect(f.prepared.review.prompt).toBe("Complete original safe task\nSecond line.");
  expect(f.chunk.tools.listTools().map((tool: any) => tool.name).sort()).toEqual(["file_edit", "file_read", "file_write"]);
  const replaced = vi.fn(async () => ({ outcome: "allow" })); f.input.toolProxy.enforce = replaced as any;
  await expect(f.chunk.tools.executeTool("file_read", { file_path: "source.mjs", limit: 1 })).resolves.toMatchObject({ status: "success" });
  expect(f.chunk.stepReceipts()).toEqual([]);
  const batch = await Promise.all([f.chunk.tools.executeTool("file_read", { file_path: "source.mjs" }), f.chunk.tools.executeTool("file_read", { file_path: "source.mjs" })]);
  expect(batch).toEqual([expect.objectContaining({ status: "success", content: "export const value = 1;\n" }), expect.objectContaining({ status: "success" })]);
  expect(f.chunk.stepReceipts()[0]).toMatchObject({ stepId: "read", kind: "inspect", fullRead: true, status: "succeeded", repairAttempt: 0, beforeSha256: hash("export const value = 1;\n") });
  f.setStep(1);
  await expect(f.chunk.tools.executeTool("file_read", { file_path: "test.mjs" })).resolves.toMatchObject({ status: "success" });
  await expect(f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 2;\n" })).resolves.toMatchObject({ status: "success" });
  expect(f.chunk.stepReceipts().at(-1)).toMatchObject({ stepId: "write", kind: "implement", fullRead: false, status: "succeeded", afterSha256: hash("export const value = 2;\n") });
  await f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 2;\n" });
  expect(f.chunk.stepReceipts().at(-1)).toMatchObject({ kind: "implement", changed: false, status: "succeeded" });
  expect(await readFile(join(f.repoRoot, "source.mjs"), "utf8")).toBe("export const value = 1;\n");
  expect(await readdir(f.chunk.workingDirectory)).not.toContain("source.mjs.bak");
  expect((await f.chunk.captureCurrent()).changedFiles).toEqual(["source.mjs"]);
  expect(f.service.loadVerifiedPolicy).toHaveBeenCalled(); expect(replaced).not.toHaveBeenCalled();
  expect((await f.git.run(["status", "--porcelain"])).stdout).toBe("");
  await f.chunk.close(); expect(await readdir(f.worktreeRoot)).toHaveLength(1);
}, CHUNK_TIMEOUT_MS + 10000);

it("rejects every unrelated or model-selected action before touching files and rechecks the current step", async () => {
  const f = await fixture(), calls = f.service.loadVerifiedPolicy.mock.calls.length;
  for (const [name, params] of [
    ["shell_exec", { command: "echo prohibited" }], ["subagent_dispatch", { task: "prohibited" }],
    ["file_read", { file_path: "unapproved.txt" }], ["file_read", { file_path: "../source.mjs" }],
    ["file_read", { file_path: join(f.chunk.workingDirectory, "source.mjs") }],
    ["file_write", { file_path: "source.mjs", content: "bad" }],
  ] as const) await expect(f.chunk.tools.executeTool(name, params)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_TOOL_SCOPE_DENIED" });
  expect(f.service.loadVerifiedPolicy).toHaveBeenCalledTimes(calls);
  f.setStep(1);
  await expect(f.chunk.tools.executeTool("file_edit", { file_path: "source.mjs", old_string: "1", new_string: "2", create_backup: true })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_TOOL_SCOPE_DENIED" });
  await expect(f.chunk.tools.executeTool("file_edit", { file_path: "source.mjs", old_string: "1", new_string: "2" })).resolves.toMatchObject({ status: "success" });
  expect(await readFile(join(f.chunk.workingDirectory, "source.mjs"), "utf8")).toBe("export const value = 2;\n");
  expect(await readdir(f.chunk.workingDirectory)).not.toContain("source.mjs.bak");
  f.setStep(2);
  await expect(f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "bad" })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_TOOL_SCOPE_DENIED" });
  expect(f.chunk.tools.listTools()).toHaveLength(3); await f.chunk.close();
});

it("resumes only process-owned receipt and exact current source, rejects a fresh factory and concurrent chunks", async () => {
  const f = await fixture();
  await expect(f.factory.forChunk(f.input)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_BUSY" });
  const current = await f.chunk.captureCurrent(); await f.chunk.close();
  const resumedInput = { ...f.input, workspaceReceipt: JSON.parse(stableStringify(f.chunk.workspaceReceipt)), expectedSourceFilesHash: current.filesHash };
  expect(f.factory.hasOwnership(f.input.taskId, resumedInput.workspaceReceipt)).toBe(true);
  expect(createGovernedAgentTaskWorkspace(f.config).hasOwnership(f.input.taskId, resumedInput.workspaceReceipt)).toBe(false);
  await expect(f.factory.forChunk({ ...resumedInput, context: { ...f.input.context, tenantId: "another-tenant" } }))
    .rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_RESUME_MISMATCH" });
  await expect(createGovernedAgentTaskWorkspace(f.config).forChunk(resumedInput)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_OWNERSHIP_UNKNOWN", outcomeUnknown: true });
  const resumed = await f.factory.forChunk(resumedInput);
  expect(resumed.workingDirectory).toBe(f.chunk.workingDirectory); await resumed.close();
  await writeFile(join(f.chunk.workingDirectory, "source.mjs"), "export const value = 7;\n");
  await expect(f.factory.forChunk(resumedInput)).rejects.toMatchObject({ code: "AGENT_LONG_TASK_WORKSPACE_SOURCE_CHANGED", outcomeUnknown: true });
  expect(f.factory.hasOwnership(f.input.taskId, resumedInput.workspaceReceipt)).toBe(false);
});

it("releases an admitted lease on policy change and fails before any write", async () => {
  const f = await fixture(), release = vi.fn(async () => {}); f.setStep(1);
  f.service.acquireToolExecutionLease = async () => ({ release }); f.policy.policyHash = "sha256:" + "e".repeat(64);
  await expect(f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 2;\n" })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_TOOL_POLICY_CHANGED" });
  expect(release).toHaveBeenCalledOnce(); expect(await readFile(join(f.chunk.workingDirectory, "source.mjs"), "utf8")).toBe("export const value = 1;\n");
  await expect(f.chunk.close()).rejects.toMatchObject({ code: "AGENT_LONG_TASK_TOOL_POLICY_CHANGED" });
});

it("stops at a lost fence before tools and never converts uncertain container termination to a repair receipt", async () => {
  const f = await fixture(); f.input.assertActive.mockRejectedValueOnce(Error("fence lost"));
  await expect(f.chunk.tools.executeTool("file_read", { file_path: "source.mjs" })).rejects.toThrow("fence lost");
  expect(f.service.loadVerifiedPolicy).not.toHaveBeenCalled(); f.setStep(1);
  await f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 0;\n" }); f.setStep(2);
  vi.spyOn(ContainerSandboxBackend.prototype, "run").mockResolvedValue({ exitCode: 137, killed: true, oomKilled: false,
    truncated: false, cleanupUncertain: false, backend: "container", stdout: "partial", stderr: "killed" } as any);
  await expect(f.chunk.verify()).rejects.toMatchObject({ code: "AGENT_LONG_TASK_VERIFICATION_OUTCOME_UNKNOWN", outcomeUnknown: true });
  await expect(f.chunk.close()).rejects.toMatchObject({ outcomeUnknown: true });
  expect(await readdir(f.scratchRoot)).toEqual([]);
});

it("preserves the first mocked verification receipt through repair and binds the corrected snapshot", async () => {
  const f = await fixture(); f.setStep(1);
  await f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 0;\n" }); f.setStep(2);
  const base = { killed: false, oomKilled: false, truncated: false, cleanupUncertain: false, backend: "container" };
  const backend = vi.spyOn(ContainerSandboxBackend.prototype, "run")
    .mockImplementationOnce(async (input: any) => ({ ...base, exitCode: 1, stdout: syntheticNodeTestReceipt(input, false, "first synthetic failure"), stderr: "expected two" } as any))
    .mockImplementationOnce(async (input: any) => ({ ...base, exitCode: 0, stdout: syntheticNodeTestReceipt(input, true, "corrected synthetic success"), stderr: "" } as any));
  const first = await f.chunk.verify();
  expect(first).toMatchObject({ status: "failed", verification: { status: "failed", exitCode: 1, stdout: "first synthetic failure", stderr: "expected two", cleanupConfirmed: true,
    checkResult: { verdict: "failed", executedPassed: 0, requiredChecks: [{ file: "test.mjs", name: "value is two", status: "failed" }] } } });
  const sent = backend.mock.calls[0]![0];
  expect(sent.command.endsWith("exec node /scratch/uai-node-check.mjs")).toBe(true);
  expect(sent.workspaceMode).toBe("ro"); expect(sent.networkAccess).toBe(false); expect(sent.env).toEqual({});
  expect(JSON.parse(sent.stdin!).contract).toEqual(f.config.profile.verificationResult);
  expect(await readdir(f.scratchRoot)).toEqual([]);
  f.setRepair(1); f.setStep(1);
  await f.chunk.tools.executeTool("file_edit", { file_path: "source.mjs", old_string: "0", new_string: "2" });
  expect(f.chunk.stepReceipts().at(-1)).toMatchObject({ repairAttempt: 1, afterSha256: hash("export const value = 2;\n") }); f.setStep(2);
  const corrected = await f.chunk.verify();
  expect(corrected).toMatchObject({ status: "passed", verification: { status: "passed", exitCode: 0,
    checkResult: { verdict: "passed", executedPassed: 1, requiredChecks: [{ file: "test.mjs", name: "value is two", status: "passed" }] } }, failures: [first.verification] });
  expect(first.verification.stdout).toBe("first synthetic failure"); expect(corrected.artifact.filesChanged).toHaveLength(1);
  expect(await readFile(join(f.chunk.workingDirectory, "test.mjs"), "utf8")).toBe(f.testText);
  expect(await readdir(f.scratchRoot)).toEqual([]); await f.chunk.close();
});

it("does not certify redacted reads and reports uncertain result audit after a write", async () => {
  const f = await fixture(); f.policy.scope = { deniedOutputFields: ["content"] };
  const read = await f.chunk.tools.executeTool("file_read", { file_path: "source.mjs" });
  expect(read.content).not.toBe("export const value = 1;\n"); expect(f.chunk.stepReceipts()).toEqual([]);
  f.policy.scope = {}; f.setStep(1); f.policy.requirements = { auditRequired: true };
  f.service.emitAudit.mockImplementation(async (event: any) => { if (event.eventType === "TOOL_FAILED" || event.eventType === "TOOL_COMPLETED") throw Error("audit unavailable"); });
  await expect(f.chunk.tools.executeTool("file_write", { file_path: "source.mjs", content: "export const value = 2;\n" })).rejects.toMatchObject({ outcomeUnknown: true });
  expect(f.chunk.stepReceipts()).toEqual([]);
  await expect(f.chunk.close()).rejects.toMatchObject({ outcomeUnknown: true });
});

it("fails closed on symlink and unapproved file change while ordinary tool helper defaults remain intact", async () => {
  const f = await fixture();
  await writeFile(join(f.chunk.workingDirectory, "unapproved.txt"), "external change");
  await expect(f.chunk.tools.executeTool("file_read", { file_path: "source.mjs" })).rejects.toMatchObject({ code: "AGENT_LONG_TASK_UNAPPROVED_CHANGE", outcomeUnknown: true });
  await f.chunk.close();
  const isolated = join(f.root, "standalone"), sibling = join(f.root, "standalone-sibling"); await mkdir(isolated); await mkdir(sibling);
  await writeFile(join(isolated, "value.txt"), "one"); await writeFile(join(sibling, "value.txt"), "outside");
  const edit: any = createFileEditTool(isolated);
  expect(await edit.execute({ file_path: "value.txt", old_string: "one", new_string: "two" })).toMatchObject({ status: "success" });
  expect(await readFile(join(isolated, "value.txt.bak"), "utf8")).toBe("one");
  expect(await edit.execute({ file_path: join(sibling, "value.txt"), old_string: "outside", new_string: "bad" })).toMatchObject({ code: "PATH_TRAVERSAL_BLOCKED" });
  await symlink(sibling, join(isolated, "escape"), process.platform === "win32" ? "junction" : "dir");
  expect(await edit.execute({ file_path: "escape/value.txt", old_string: "outside", new_string: "bad" })).toMatchObject({ code: "PATH_TRAVERSAL_BLOCKED" });
  const write: any = createFileWriteTool(isolated);
  expect(await write.execute({ file_path: "value.txt", content: "three" })).toMatchObject({ status: "success" });
  expect(await readFile(join(isolated, "value.txt.bak"), "utf8")).toBe("two");
  expect(await readFile(join(sibling, "value.txt"), "utf8")).toBe("outside");
});
