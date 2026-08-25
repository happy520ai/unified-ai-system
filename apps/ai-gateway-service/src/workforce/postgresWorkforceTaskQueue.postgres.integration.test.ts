import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { TASK_STATUS } from "./taskQueueManager.js";
import { createWorkforceTaskQueueManager } from "./workforceTaskQueueFactory.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

function createQueue(namespace: string, claimTtlMs = 5_000) {
  return createWorkforceTaskQueueManager({
    env: {
      AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE: "postgres",
      AI_GATEWAY_WORKFORCE_QUEUE_CENTRAL_REQUIRED: "true",
      AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: connectionString,
      AI_GATEWAY_WORKFORCE_QUEUE_NAMESPACE: namespace,
      AI_GATEWAY_WORKFORCE_QUEUE_MAX_ENTRIES: "20",
      AI_GATEWAY_WORKFORCE_QUEUE_MAX_TASK_BYTES: "65536",
      AI_GATEWAY_WORKFORCE_QUEUE_RETENTION_MS: "60000",
      AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "postgres",
      AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL: connectionString,
      AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE: namespace,
      AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_POOL_MAX: "2",
    },
    claimTtlMs,
  });
}

function claimPlanId(tenantId: string, ownerId: string, planId: string) {
  return `wf-scope-${createHash("sha256")
    .update(`${tenantId}\u0000${ownerId}\u0000${planId}`, "utf8")
    .digest("hex")}`;
}

function taskInput(tenantId: string, ownerId: string, planId = "shared-plan") {
  return {
    tenantId,
    ownerId,
    planId,
    claimPlanId: claimPlanId(tenantId, ownerId, planId),
    title: "Fenced central task",
    priority: "P1",
    payload: { roleId: "backend-engineer", planId },
  };
}

describePostgres("real PostgreSQL central Workforce task queue", () => {
  it("shares tenant-scoped task state and atomically commits a fenced terminal result", async () => {
    const namespace = `wfq-${randomUUID()}`;
    const first = createQueue(namespace);
    const second = createQueue(namespace);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      await first.init();
      await second.init();
      const [aliceTask, bobTask] = await first.enqueueMany([
        taskInput("tenant-a", "alice"),
        taskInput("tenant-b", "bob"),
      ]);

      await expect(second.getQueueStatus({ tenantId: "tenant-a", ownerId: "alice" }))
        .resolves.toMatchObject({ totalQueued: 1, totalActive: 0 });
      await expect(second.getQueueStatus({ tenantId: "tenant-b", ownerId: "bob" }))
        .resolves.toMatchObject({ totalQueued: 1, totalActive: 0 });

      const claimed = await second.claimTask("backend-engineer", { taskId: aliceTask.taskId, maxConcurrent: 1 });
      expect(claimed.claimToken).toBeTruthy();
      expect(await first.claimTask("other-agent", { taskId: aliceTask.taskId })).toBeNull();
      const ownership = { claimToken: claimed.claimToken, agentId: "backend-engineer" };
      await second.updateTaskStatus(aliceTask.taskId, TASK_STATUS.IN_PROGRESS, undefined, ownership);
      await expect(second.assertTaskClaimActive(aliceTask.taskId, ownership)).resolves.toMatchObject({
        active: true,
        taskId: aliceTask.taskId,
        agentId: "backend-engineer",
        fencingToken: claimed.claim.fencingToken,
      });
      await second.completeTask(aliceTask.taskId, {
        ok: true,
        nested: { claimToken: claimed.claimToken, apiKey: "must-not-persist" },
      }, ownership);

      const persisted = await inspector.query<{
        task_json: string;
        fencing_token: string;
      }>(`
        SELECT task_json, fencing_token::text
        FROM public.ai_gateway_workforce_tasks
        WHERE namespace = $1 AND task_id = $2
      `, [namespace, aliceTask.taskId]);
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].task_json).not.toContain(claimed.claimToken);
      expect(persisted.rows[0].task_json).not.toContain("must-not-persist");
      expect(JSON.parse(persisted.rows[0].task_json).result.nested).toEqual({
        claimToken: "[REDACTED]",
        apiKey: "[REDACTED]",
      });
      const remainingClaim = await inspector.query(`
        SELECT token_digest FROM public.ai_gateway_workforce_task_claims
        WHERE namespace = $1 AND task_id = $2
      `, [namespace, aliceTask.taskId]);
      expect(remainingClaim.rows).toHaveLength(0);
      expect(BigInt(persisted.rows[0].fencing_token)).toBeGreaterThan(0n);

      await expect(first.getQueueStatus({ tenantId: "tenant-a", ownerId: "alice" }))
        .resolves.toMatchObject({ totalQueued: 0, totalCompleted: 1 });
      await expect(first.getQueueStatus({ tenantId: "tenant-b", ownerId: "bob" }))
        .resolves.toMatchObject({ totalQueued: 1, totalCompleted: 0 });
      expect(bobTask.claimPlanId).not.toBe(aliceTask.claimPlanId);

      const healthText = JSON.stringify(await second.checkQueueHealth());
      expect(healthText).not.toContain(connectionString ?? "gateway_test");
      expect(healthText).not.toContain(claimed.claimToken);
      expect(await second.checkQueueHealth()).toMatchObject({
        available: true,
        distributed: true,
        atomicTerminalFence: true,
      });
    } finally {
      await cleanupNamespace(inspector, namespace);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);

  it("recovers an expired owner, rejects its stale token, and detects persisted corruption", async () => {
    const namespace = `wfq-takeover-${randomUUID()}`;
    const first = createQueue(namespace, 50);
    const second = createQueue(namespace, 50);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      await first.init();
      await second.init();
      const task = await first.enqueue(taskInput("tenant-a", "alice", "takeover-plan"));
      const oldClaim = await first.claimTask("agent-old", { taskId: task.taskId, ttlMs: 50 });
      await first.updateTaskStatus(task.taskId, TASK_STATUS.IN_PROGRESS, undefined, {
        claimToken: oldClaim.claimToken,
        agentId: "agent-old",
      });
      await new Promise((resolve) => setTimeout(resolve, 90));

      await expect(first.assertTaskClaimActive(task.taskId, {
        claimToken: oldClaim.claimToken,
        agentId: "agent-old",
      })).rejects.toMatchObject({ code: "TASK_CLAIM_INVALID" });

      const takeover = await second.claimTask("agent-new", { taskId: task.taskId, ttlMs: 500 });
      expect(BigInt(takeover.claim.fencingToken)).toBeGreaterThan(BigInt(oldClaim.claim.fencingToken));
      await expect(first.completeTask(task.taskId, {}, {
        claimToken: oldClaim.claimToken,
        agentId: "agent-old",
      })).rejects.toMatchObject({ code: "TASK_CLAIM_AGENT_MISMATCH" });
      await second.completeTask(task.taskId, { owner: "new" }, {
        claimToken: takeover.claimToken,
        agentId: "agent-new",
      });

      await inspector.query(`
        UPDATE public.ai_gateway_workforce_tasks
        SET task_json = '{"tampered":true}'
        WHERE namespace = $1 AND task_id = $2
      `, [namespace, task.taskId]);
      await expect(second.getTasksByPriority("P1", { tenantId: "tenant-a", ownerId: "alice" }))
        .rejects.toMatchObject({ code: "WORKFORCE_QUEUE_STATE_CORRUPT" });
      expect(second.getQueueHealth()).toMatchObject({ available: false, lastFailureCode: "WORKFORCE_QUEUE_STATE_CORRUPT" });
    } finally {
      await cleanupNamespace(inspector, namespace);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);
});

async function cleanupNamespace(inspector: Pool, namespace: string) {
  await inspector.query(
    "DELETE FROM public.ai_gateway_workforce_tasks WHERE namespace = $1",
    [namespace],
  ).catch(() => undefined);
  await inspector.query(
    "DELETE FROM public.ai_gateway_workforce_task_claims WHERE namespace = $1",
    [namespace],
  ).catch(() => undefined);
}
