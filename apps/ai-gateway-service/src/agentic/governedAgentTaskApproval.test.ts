import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { computeArgumentsHash } from "@unified-ai-system/policy-engine";
import { createAgentApprovalStore } from "../agent-governance/agentApprovalStore.ts";
import { createGovernanceStateFileBinding } from "../agent-governance/governanceStateAnchor.ts";
import { TaskQueueManager } from "../workforce/taskQueueManager.js";
import { createTaskContinuation } from "../workforce/taskQueueContinuation.ts";
import { createGovernedAgentTaskReview, freezeGovernedAgentTaskProfile, parseGovernedAgentTaskPlan } from "./governedAgentTaskProfile.ts";
import { createGovernedAgentTaskApprovalReview, GOVERNED_AGENT_TASK_TOOL } from "./governedAgentTaskApproval.ts";

const resources: Array<{ root: string; queues: TaskQueueManager[] }> = [];
afterEach(async () => {
  for (const fixture of resources.splice(0).reverse()) {
    for (const queue of fixture.queues.reverse()) await queue.close();
    expect(await realpath(fixture.root)).toBe(fixture.root);
    expect(dirname(fixture.root)).toBe(await realpath(tmpdir()));
    await rm(fixture.root, { recursive: true, force: false });
  }
});
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "agent-task-approval-"));
  const fixture = { root, queues: [] as TaskQueueManager[] }; resources.push(fixture);
  const profile = freezeGovernedAgentTaskProfile({ version: 1, mode: "governed-agent-long-task", profileId: "profile", projectId: "project", baselineRevision: "a".repeat(40),
    model: { providerId: "fake", modelId: "fake", maxInputTokens: 4096, maxOutputTokens: 4096 },
    limits: { maxPlanSteps: 3, maxIterations: 4, maxModelCalls: 5, maxTotalTokens: 40960, maxRepairAttempts: 1, chunkTimeoutMs: 30000, maxInputBytes: 4096 },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "tests", command: "node test.mjs", immutableTests: [{ path: "test.mjs", sha256: "b".repeat(64) }],
        image: "node@sha256:" + "c".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 5000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const review = createGovernedAgentTaskReview({ profile, configuredRepositoryHash: "sha256:" + "d".repeat(64), sourceFilesHash: "e".repeat(64),
    goal: "Implement the exact requested change", prompt: "Complete original prompt.\nLast original line." });
  const plan = parseGovernedAgentTaskPlan(JSON.stringify({ version: 1, reviewHash: review.reviewHash, steps: [
    { id: "read", kind: "inspect", title: "Read source", paths: ["source.mjs"] },
    { id: "write", kind: "implement", title: "Update source", paths: ["source.mjs"] },
    { id: "verify", kind: "verify", title: "Run fixed tests", paths: ["test.mjs"] },
  ] }), review);
  const args = { taskId: randomUUID(), agentRunId: "agr_original", review, plan }, policyHash = "sha256:" + "f".repeat(64);
  const secret = "fixture-only-approval-secret-" + randomUUID();
  const storeOptions = { storePath: join(root, "approvals.json"), secret };
  return { ...fixture, args, policyHash, secret, store: createAgentApprovalStore(storeOptions), storeOptions };
}
describe("governed original-task approval and queue authority", () => {
  it("seals the full plan and reads the same consumed approval after reopening without consuming again", async () => {
    const f = await fixture(), review = createGovernedAgentTaskApprovalReview(f.args, f.policyHash);
    const record = await f.store.create({ agentId: "agt_original", tenantId: "tenant", toolName: GOVERNED_AGENT_TASK_TOOL, arguments: f.args, review });
    expect(record.review.agentTask).toEqual(f.args);
    const binding = { approvalId: record.id, agentId: "agt_original", tenantId: "tenant", toolName: GOVERNED_AGENT_TASK_TOOL,
      argumentsHash: computeArgumentsHash(f.args), policyHash: f.policyHash, executionId: f.args.taskId };
    expect(await f.store.verifyConsumed(binding)).toBeNull();
    await f.store.decide(record.id, "approve", "owner");
    expect(await f.store.consumeApproved(binding)).toMatchObject({ id: record.id, args: f.args });
    const reopened = createAgentApprovalStore(f.storeOptions);
    expect(await reopened.verifyConsumed(binding)).toMatchObject({ args: f.args, review });
    expect(await reopened.verifyConsumed(binding)).toMatchObject({ args: f.args, review });
    expect(await reopened.consumeApproved(binding)).toBeNull();
    for (const patch of [{ tenantId: "other" }, { agentId: "agt_other" }, { executionId: randomUUID() },
      { policyHash: "sha256:" + "0".repeat(64) }, { argumentsHash: computeArgumentsHash({ ...f.args, taskId: randomUUID() }) }]) {
      expect(await reopened.verifyConsumed({ ...binding, ...patch })).toBeNull();
    }
  });
  it("rejects a changed task, truncated prompt, altered plan and an alias tool before approval is recorded", async () => {
    const f = await fixture(), review = createGovernedAgentTaskApprovalReview(f.args, f.policyHash);
    const input = { agentId: "agt_original", tenantId: "tenant", toolName: GOVERNED_AGENT_TASK_TOOL, arguments: f.args, review };
    for (const args of [{ ...f.args, taskId: randomUUID() }, { ...f.args, agentRunId: "agr_replacement" },
      { ...f.args, review: { ...f.args.review, prompt: "Truncated" } },
      { ...f.args, plan: { ...f.args.plan, steps: f.args.plan.steps.slice(1) } }]) {
      await expect(f.store.create({ ...input, arguments: args })).rejects.toThrow();
    }
    await expect(f.store.create({ ...input, toolName: GOVERNED_AGENT_TASK_TOOL + ":alias" })).rejects.toThrow();
    await expect(f.store.create({ ...input, review: { ...review, repository: { displayName: "injected", fingerprint: f.policyHash } } })).rejects.toThrow();
    expect(await f.store.listPending()).toEqual([]);
  });
  it("detects a rehashed but rolled-back retained queue before a new task claim", async () => {
    const f = await fixture(), queueFile = join(f.root, "agent-long-tasks.json");
    const signed = createGovernanceStateFileBinding({ filePath: queueFile, secret: f.secret, kind: "json", validateLegacy() { throw Error("No unsigned task import"); } });
    const queue = new TaskQueueManager({ dataDir: f.root, queueFile, retainedTasks: true, retainedStateBinding: signed, env: {} });
    f.queues.push(queue); await queue.init();
    const identity = { agentId: "agt_original", tenantId: "tenant", userId: "owner" };
    const initial = createTaskContinuation({ version: 1, revision: 0, inputHash: f.args.review.reviewHash, bindingHash: f.policyHash,
      phase: "prepared", pendingOperation: null, counters: { iterations: 0, modelCalls: 0, reservedTokens: 0, repairAttempts: 0 }, state: {} });
    const task = await queue.enqueueRetainedTask({ title: "Original", planId: "original" }, identity, initial);
    const original = await readFile(queueFile, "utf8"), claim = await queue.claimRetainedTask(task.taskId, identity, 0);
    const { hash: _hash, ...body } = initial;
    await queue.checkpointRetainedTask(task.taskId, identity, claim, 0,
      createTaskContinuation({ ...body, revision: 1, phase: "paused", counters: { iterations: 1, modelCalls: 1, reservedTokens: 8192, repairAttempts: 0 } }), true);
    await writeFile(queueFile, original);
    await expect(queue.claimRetainedTask(task.taskId, identity, 1)).rejects.toThrow(/anchor|state|integrity|mismatch/i);
    expect(queue.readRetainedTask(task.taskId, identity).continuation.counters.reservedTokens).toBe(8192);
  });
});
