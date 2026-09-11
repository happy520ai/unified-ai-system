import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskQueueManager } from "./taskQueueManager.js";
import { createTaskContinuation, readTaskContinuation, advanceTaskContinuation, MAX_RETAINED_QUEUE_BYTES } from "./taskQueueContinuation.ts";
import type { TaskContinuation, TaskContinuationInput } from "./taskQueueContinuation.ts";

const identity = { tenantId: "tenant-a", userId: "owner-a", agentId: "agt_retained" };
const pending = { id: "iteration_1", kind: "iteration" as const, inputHash: "sha256:" + "c".repeat(64) };
const resources: Array<{ root: string; queues: TaskQueueManager[] }> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const fixture of resources.splice(0).reverse()) {
    for (const queue of fixture.queues.reverse()) await queue.close();
    expect(await realpath(fixture.root)).toBe(fixture.root);
    expect(dirname(fixture.root)).toBe(await realpath(tmpdir()));
    await rm(fixture.root, { recursive: true, force: false });
  }
});
function initial(): TaskContinuation {
  return createTaskContinuation({ version: 1, revision: 0, bindingHash: "sha256:" + "a".repeat(64), inputHash: "sha256:" + "b".repeat(64),
    phase: "prepared", pendingOperation: null, counters: { iterations: 0, modelCalls: 0, reservedTokens: 0, repairAttempts: 0 }, state: { goal: "Change one approved file" } });
}
function next(previous: TaskContinuation, changes: Partial<TaskContinuationInput>): TaskContinuation {
  const { hash: _hash, ...body } = previous;
  return createTaskContinuation({ ...body, revision: previous.revision + 1, ...changes });
}
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "retained-task-queue-"));
  const record = { root, queues: [] as TaskQueueManager[] }; resources.push(record);
  const dataDir = join(root, "queue"); await mkdir(dataDir);
  const open = async (retainedTasks = true) => {
    const queue = new TaskQueueManager({ dataDir, env: {}, retainedTasks }); record.queues.push(queue); await queue.init(); return queue;
  };
  const queue = await open();
  const task = await queue.enqueueRetainedTask({ title: "Original task", planId: "original-plan" }, identity, initial());
  return { root, dataDir, queue, task, open, path: join(dataDir, "task-queue.json") };
}

describe("retained original task checkpoints", () => {
  it("pauses and reclaims the same task after restart without resetting counters or completed tool results", async () => {
    const f = await fixture(), claim = await f.queue.claimRetainedTask(f.task.taskId, identity, 0);
    const running = next(f.task.continuation, { phase: "running", pendingOperation: pending,
      counters: { iterations: 1, modelCalls: 1, reservedTokens: 100, repairAttempts: 0 } });
    await f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 0, running);
    await writeFile(join(f.root, "effect.txt"), "once");
    const paused = next(running, { phase: "paused", pendingOperation: null,
      state: { messages: [{ role: "assistant", tool_calls: [{ id: "write_1" }] }, { role: "tool", tool_call_id: "write_1", content: "wrote once" }] } });
    await f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 1, paused, true);
    await f.queue.close(); const reopened = await f.open();
    const saved = reopened.readRetainedTask(f.task.taskId, identity);
    expect(saved.continuation).toEqual(paused); expect(saved.taskId).toBe(f.task.taskId);
    const reclaimed = await reopened.claimRetainedTask(f.task.taskId, identity, 2);
    expect(reclaimed.claimToken).not.toBe(claim.claimToken); expect(reclaimed.continuation.counters.modelCalls).toBe(1);
    expect(await readFile(join(f.root, "effect.txt"), "utf8")).toBe("once");
    await expect(reopened.assertRetainedTaskActive(f.task.taskId, identity, claim)).rejects.toMatchObject({ code: "TASK_CLAIM_INVALID" });
  });

  it("keeps a written effect with an unconfirmed receipt unknown after restart and refuses another claim", async () => {
    const f = await fixture(), claim = await f.queue.claimRetainedTask(f.task.taskId, identity, 0);
    const running = next(f.task.continuation, { phase: "running", pendingOperation: pending, counters: { iterations: 1, modelCalls: 1, reservedTokens: 100, repairAttempts: 0 } });
    await f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 0, running);
    await writeFile(join(f.root, "effect.txt"), "once"); await f.queue.close();
    const reopened = await f.open(), saved = reopened.readRetainedTask(f.task.taskId, identity);
    expect(saved.continuation).toMatchObject({ phase: "unknown", pendingOperation: pending, counters: running.counters });
    await expect(reopened.claimRetainedTask(f.task.taskId, identity, saved.continuation.revision)).rejects.toMatchObject({ code: "TASK_CONTINUATION_NOT_RESUMABLE" });
    expect(await readFile(join(f.root, "effect.txt"), "utf8")).toBe("once");
  });

  it("allows one competing claim and one checkpoint at the same expected revision", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([f.queue.claimRetainedTask(f.task.taskId, identity, 0), f.queue.claimRetainedTask(f.task.taskId, identity, 0)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const winner = results.find(result => result.status === "fulfilled"); if (winner?.status !== "fulfilled") throw new Error("No claim");
    const checkpoint = next(f.task.continuation, { phase: "running", pendingOperation: pending });
    const writes = await Promise.allSettled([f.queue.checkpointRetainedTask(f.task.taskId, identity, winner.value, 0, checkpoint), f.queue.checkpointRetainedTask(f.task.taskId, identity, winner.value, 0, checkpoint)]);
    expect(writes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(f.queue.readRetainedTask(f.task.taskId, identity).continuation.revision).toBe(1);
  });

  it("rejects another tenant, owner, or Agent before issuing a claim", async () => {
    const f = await fixture(), issue = vi.spyOn(f.queue.claimManager, "issue");
    for (const foreign of [{ ...identity, tenantId: "other" }, { ...identity, userId: "other" }, { ...identity, agentId: "agt_other" }]) {
      await expect(f.queue.claimRetainedTask(f.task.taskId, foreign, 0)).rejects.toMatchObject({ code: "TASK_CONTINUATION_NOT_FOUND" });
      expect(() => f.queue.readRetainedTask(f.task.taskId, foreign)).toThrow();
    }
    expect(issue).not.toHaveBeenCalled();
  });

  it("does not publish a checkpoint after a failed durable write and preserves the earlier pending effect", async () => {
    const f = await fixture(), claim = await f.queue.claimRetainedTask(f.task.taskId, identity, 0);
    const running = next(f.task.continuation, { phase: "running", pendingOperation: pending });
    await f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 0, running);
    await writeFile(join(f.root, "effect.txt"), "once");
    const rename = vi.spyOn(fs, "rename").mockRejectedValueOnce(Object.assign(new Error("Owned injected write failure"), { code: "EIO" }));
    await expect(f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 1, next(running, { phase: "paused", pendingOperation: null }), true))
      .rejects.toMatchObject({ code: "EIO", persistenceOutcomeUnknown: true });
    expect(() => f.queue.readRetainedTask(f.task.taskId, identity)).toThrow();
    rename.mockRestore(); await f.queue.close(); const reopened = await f.open();
    expect(reopened.readRetainedTask(f.task.taskId, identity).continuation.phase).toBe("unknown");
    expect(await readFile(join(f.root, "effect.txt"), "utf8")).toBe("once");
  });

  it("refuses damaged state and ordinary queue retry or auto-assignment paths", async () => {
    const f = await fixture();
    await expect(f.queue.autoAssign()).rejects.toMatchObject({ code: "TASK_CONTINUATION_RETAINED_API_REQUIRED" });
    await expect(f.queue.requeueTask(f.task.taskId)).rejects.toMatchObject({ code: "TASK_CONTINUATION_RETAINED_API_REQUIRED" });
    await expect(f.queue.cancelTask(f.task.taskId)).rejects.toMatchObject({ code: "TASK_CONTINUATION_RETAINED_API_REQUIRED" });
    await expect(f.queue.persist()).rejects.toMatchObject({ code: "TASK_CONTINUATION_RETAINED_API_REQUIRED" });
    await f.queue.close(); await expect(f.open(false)).rejects.toMatchObject({ code: "TASK_QUEUE_STATE_INVALID" });
    const data = JSON.parse(await readFile(f.path, "utf8")); data.queue[0].continuation.counters.modelCalls = 9;
    await writeFile(f.path, JSON.stringify(data)); await expect(f.open()).rejects.toMatchObject({ code: "TASK_CONTINUATION_INTEGRITY" });
  });

  it("refuses another retained queue writer in this process without changing the original record", async () => {
    const f = await fixture(); await expect(f.open()).rejects.toMatchObject({ code: "TASK_CONTINUATION_WRITER_ACTIVE" });
    expect(f.queue.readRetainedTask(f.task.taskId, identity).continuation).toEqual(f.task.continuation);
    expect(f.queue.getInfo().continuation).toMatchObject({ crossProcessAtomicWriter: false });
  });

  it("validates phases, immutable bindings, monotonic counters, pending operation identity, and terminal immutability", () => {
    const prepared = initial(), running = next(prepared, { phase: "running", pendingOperation: pending,
      counters: { iterations: 1, modelCalls: 1, reservedTokens: 100, repairAttempts: 0 } });
    expect(readTaskContinuation(running)).toEqual(running);
    for (const change of [{ inputHash: "sha256:" + "d".repeat(64) }, { counters: prepared.counters }, { pendingOperation: { ...pending, inputHash: "sha256:" + "e".repeat(64) } }]) {
      expect(() => advanceTaskContinuation(running, next(running, change))).toThrow();
    }
    const completed = next(running, { phase: "completed", pendingOperation: null });
    expect(() => advanceTaskContinuation(completed, next(completed, { phase: "paused" }))).toThrow();
    const { hash: _hash, ...body } = prepared;
    expect(() => createTaskContinuation({ ...body, phase: ["prepared"] } as unknown as TaskContinuationInput)).toThrow();
    expect(() => readTaskContinuation({ ...prepared, hash: "sha256:" + "f".repeat(64) })).toThrow();
  });

  it("rejects a replaced storage directory before another checkpoint can be written", async () => {
    const f = await fixture(), claim = await f.queue.claimRetainedTask(f.task.taskId, identity, 0);
    expect(await realpath(f.dataDir)).toBe(join(f.root, "queue"));
    expect(dirname(f.dataDir + "-original")).toBe(f.root);
    await fs.rename(f.dataDir, f.dataDir + "-original"); await mkdir(f.dataDir);
    await expect(f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 0, next(f.task.continuation, { phase: "running", pendingOperation: pending })))
      .rejects.toMatchObject({ code: "TASK_CONTINUATION_PATH_CHANGED" });
    await expect(readFile(f.path)).rejects.toMatchObject({ code: "ENOENT" });
    const original = JSON.parse(await readFile(join(f.dataDir + "-original", "task-queue.json"), "utf8"));
    expect(original.activeTasks[0].continuation.revision).toBe(0);
  });

  it("persists and restores a complete history larger than one MiB within the loop checkpoint bound", async () => {
    const f = await fixture(), claim = await f.queue.claimRetainedTask(f.task.taskId, identity, 0);
    const history = "approved observed history\n".repeat(50_000);
    expect(Buffer.byteLength(history)).toBeGreaterThan(1024 * 1024);
    const paused = next(f.task.continuation, { phase: "paused", state: { history } });
    await f.queue.checkpointRetainedTask(f.task.taskId, identity, claim, 0, paused, true);
    await f.queue.close(); const reopened = await f.open();
    expect(reopened.readRetainedTask(f.task.taskId, identity).continuation.state.history).toBe(history);
  });

  it("rejects an oversized queue file before opening its contents", async () => {
    const f = await fixture(); await f.queue.close();
    await fs.truncate(f.path, MAX_RETAINED_QUEUE_BYTES + 1);
    const open = vi.spyOn(fs, "open");
    await expect(f.open()).rejects.toMatchObject({ code: "TASK_CONTINUATION_STATE_INVALID" });
    expect(open).not.toHaveBeenCalled();
  });
});
