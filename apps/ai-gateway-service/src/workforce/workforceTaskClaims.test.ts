import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createTaskClaimLeaseManager } from "./taskClaimLease.ts";
import { TaskQueueManager, TASK_STATUS } from "./taskQueueManager.js";
import { executeWorkforceDag } from "./workforceDagExecutor.ts";
import { createWorkforcePlan } from "./workforcePlanner.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

async function queueFixture(options: Record<string, unknown> = {}) {
  const root = await mkdtemp(join(tmpdir(), "workforce-claims-"));
  cleanupPaths.push(root);
  const queueFile = join(root, "task-queue.json");
  const queue = new TaskQueueManager({ queueFile, ...options });
  await queue.init();
  return { queue, queueFile };
}

describe("fenced task claim lease", () => {
  it("prevents duplicate ownership, binds identity, and never resurrects an expired token", () => {
    let now = Date.parse("2026-08-19T00:00:00.000Z");
    const manager = createTaskClaimLeaseManager({ ttlMs: 50, maxClaims: 4, clock: () => now });
    const first = manager.issue({ planId: "plan-a", taskId: "task-a", agentId: "agent-a" });
    expect(first.success).toBe(true);
    if (!first.success) throw new Error(first.reason);
    expect(first.token).toHaveLength(43);
    expect(manager.issue({ planId: "plan-a", taskId: "task-a", agentId: "agent-b" }))
      .toEqual(expect.objectContaining({ success: false, code: "TASK_ALREADY_CLAIMED" }));
    expect(manager.validate(first.token, { planId: "plan-a", taskId: "task-b", agentId: "agent-a" }))
      .toEqual(expect.objectContaining({ valid: false, code: "TASK_CLAIM_TASK_MISMATCH" }));
    now += 51;
    expect(manager.validate(first.token, { planId: "plan-a", taskId: "task-a", agentId: "agent-a" }))
      .toEqual(expect.objectContaining({ valid: false, code: "TASK_CLAIM_EXPIRED" }));
    expect(manager.renew(first.token)).toEqual(expect.objectContaining({ success: false }));
    const takeover = manager.issue({ planId: "plan-a", taskId: "task-a", agentId: "agent-b" });
    if (!takeover.success) throw new Error(takeover.reason);
    expect(BigInt(takeover.fencingToken)).toBeGreaterThan(BigInt(first.fencingToken));
    expect(manager.getInfo()).toEqual(expect.objectContaining({ rawTokenRetained: false, timerCount: 0, activeClaims: 1 }));
  });
});

describe("claim-enforced task queue", () => {
  it("rejects forged completion and never persists the bearer token", async () => {
    const { queue, queueFile } = await queueFixture();
    const task = await queue.enqueue({ planId: "plan-secure", title: "Secure task", priority: "P1" });
    const claimed = await queue.claimTask("agent-secure", { taskId: task.taskId });
    expect(claimed.claimToken).toBeTruthy();
    expect(await readFile(queueFile, "utf8")).not.toContain(claimed.claimToken);
    await expect(queue.completeTask(task.taskId, {}, {
      claimToken: "forged-token",
      agentId: "agent-secure",
    })).rejects.toMatchObject({ code: "TASK_CLAIM_INVALID" });
    const ownership = { claimToken: claimed.claimToken, agentId: "agent-secure" };
    await queue.updateTaskStatus(task.taskId, TASK_STATUS.IN_PROGRESS, undefined, ownership);
    await expect(queue.completeTask(task.taskId, { ok: true }, ownership))
      .resolves.toEqual(expect.objectContaining({ status: TASK_STATUS.COMPLETED }));
    expect(queue.getQueueStatus()).toEqual(expect.objectContaining({ totalActive: 0, totalCompleted: 1 }));
    expect(await readFile(queueFile, "utf8")).not.toContain(claimed.claimToken);
  });

  it("requeues persisted active tasks because local claims cannot survive restart", async () => {
    const fixture = await queueFixture();
    const task = await fixture.queue.enqueue({ planId: "plan-restart", title: "Recover me" });
    const oldClaim = await fixture.queue.claimTask("agent-old", { taskId: task.taskId });
    const restarted = new TaskQueueManager({ queueFile: fixture.queueFile });
    await restarted.init();
    expect(restarted.getQueueStatus()).toEqual(expect.objectContaining({ totalQueued: 1, totalActive: 0 }));
    const newClaim = await restarted.claimTask("agent-new", { taskId: task.taskId });
    await expect(restarted.completeTask(task.taskId, {}, {
      claimToken: oldClaim.claimToken,
      agentId: "agent-new",
    })).rejects.toMatchObject({ code: "TASK_CLAIM_INVALID" });
    await expect(restarted.completeTask(task.taskId, {}, {
      claimToken: newClaim.claimToken,
      agentId: "agent-new",
    })).resolves.toEqual(expect.objectContaining({ status: TASK_STATUS.COMPLETED }));
  });
});

describe("dependency-aware workforce execution", () => {
  it("uses bounded parallel waves while preserving dependencies and fenced completion", async () => {
    const { queue, queueFile } = await queueFixture();
    const plan = createWorkforcePlan({ goal: "Build a resilient gateway feature" });
    const queued = await queue.enqueueMany(plan.taskBreakdown.map((task: any) => ({
      planId: plan.workforceId,
      title: task.title,
      payload: { roleId: task.roleId, planId: plan.workforceId },
      dependsOnRoleIds: task.dependsOnRoleIds,
    })));
    let active = 0;
    let observedPeak = 0;
    const observedPriorOutputs = new Map<string, string[]>();
    const result = await executeWorkforceDag({
      tasks: queued.map((task) => ({
        queueTaskId: task.taskId,
        roleId: task.payload.roleId,
        dependsOnRoleIds: task.dependsOnRoleIds,
      })),
      taskQueue: queue,
      maxConcurrent: 2,
      executeRole: async (roleId, context) => {
        active += 1;
        observedPeak = Math.max(observedPeak, active);
        observedPriorOutputs.set(roleId, Object.keys(context.priorOutputs as object).sort());
        try {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { roleId, ok: true };
        } finally {
          active -= 1;
        }
      },
    });
    expect(result.executionWaves.map((wave) => wave.roleIds)).toEqual([
      ["ceo"],
      ["pm", "architect"],
      ["frontend-engineer", "backend-engineer"],
      ["qa"],
      ["reviewer"],
    ]);
    expect(result.peakConcurrency).toBe(2);
    expect(observedPeak).toBe(2);
    expect(observedPriorOutputs.get("pm")).toEqual(["ceo"]);
    expect(observedPriorOutputs.get("frontend-engineer")).toEqual(["architect", "ceo", "pm"]);
    expect(queue.getQueueStatus()).toEqual(expect.objectContaining({ totalCompleted: 7, totalActive: 0 }));
    expect(await readFile(queueFile, "utf8")).not.toContain("claimToken");
  });
});
