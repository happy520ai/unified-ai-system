import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  Task,
  TaskState,
  type ListTasksRequest,
  type Task as A2ATask,
} from "@a2a-js/sdk";
import { ServerCallContext } from "@a2a-js/sdk/server";
import { describe, expect, it, vi } from "vitest";
import { createA2AExecutionLeaseManager } from "./a2aExecutionLease.ts";
import { createA2ATaskStore } from "./a2aTaskStore.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

function createContext(tenant: string, owner: string) {
  return new ServerCallContext({
    requestedVersion: "1.0",
    tenant,
    user: {
      get isAuthenticated() {
        return true;
      },
      get userName() {
        return owner;
      },
    },
  });
}

function createTask({
  id,
  timestamp,
  metadata = {},
  state = TaskState.TASK_STATE_COMPLETED,
}: {
  id: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  state?: TaskState;
}): A2ATask {
  return Task.fromJSON({
    id,
    contextId: "context-1",
    status: {
      state,
      timestamp,
    },
    artifacts: [],
    history: [],
    metadata,
  });
}

function listRequest(overrides: Partial<ListTasksRequest> = {}): ListTasksRequest {
  return {
    tenant: "client-tenant-is-ignored",
    contextId: "",
    status: TaskState.TASK_STATE_UNSPECIFIED,
    pageSize: 50,
    pageToken: "",
    statusTimestampAfter: undefined,
    includeArtifacts: false,
    ...overrides,
  };
}

function createHandle(namespace: string) {
  return createA2ATaskStore({
    env: {
      AI_GATEWAY_A2A_TASK_STORE_MODE: "postgres",
      AI_GATEWAY_A2A_TASK_STORE_REQUIRED: "true",
      AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED: "true",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL: connectionString,
      AI_GATEWAY_A2A_TASK_STORE_NAMESPACE: namespace,
      AI_GATEWAY_A2A_TASK_TTL_MS: "60000",
      AI_GATEWAY_A2A_TASK_MAX_ENTRIES: "3",
      AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER: "2",
      AI_GATEWAY_A2A_TASK_MAX_BYTES: "4096",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_STATEMENT_TIMEOUT_MS: "5000",
    },
  });
}

describePostgres("real PostgreSQL cross-host A2A task store", () => {
  it("shares bounded tenant tasks across independent pools and detects stale/corrupt state", async () => {
    const namespace = `a2a-${randomUUID()}`;
    const first = createHandle(namespace);
    const second = createHandle(namespace);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    const alice = createContext("tenant-a", "alice");
    const bob = createContext("tenant-a", "bob");
    const otherOwner = createContext("tenant-a", "mallory");
    const otherTenant = createContext("tenant-b", "alice");
    try {
      await first.store.save(createTask({
        id: "task-1",
        timestamp: "2026-08-24T00:00:01.000Z",
        state: TaskState.TASK_STATE_WORKING,
      }), alice);
      await second.store.save(createTask({
        id: "task-2",
        timestamp: "2026-08-24T00:00:02.000Z",
      }), alice);
      await second.store.save(createTask({
        id: "task-3",
        timestamp: "2026-08-24T00:00:03.000Z",
      }), bob);

      expect(await second.store.load("task-1", alice)).toMatchObject({ id: "task-1" });
      expect(await first.store.load("task-2", otherOwner)).toBeUndefined();
      expect(await first.store.load("task-2", otherTenant)).toBeUndefined();

      const firstPage = await first.store.list(listRequest({ pageSize: 1 }), alice);
      expect(firstPage.tasks.map((task) => task.id)).toEqual(["task-2"]);
      expect(firstPage.totalSize).toBe(2);
      expect(firstPage.nextPageToken).not.toBe("");
      const secondPage = await second.store.list(listRequest({
        pageSize: 1,
        pageToken: firstPage.nextPageToken,
      }), alice);
      expect(secondPage.tasks.map((task) => task.id)).toEqual(["task-1"]);

      await second.store.save(createTask({
        id: "task-1",
        timestamp: "2026-08-24T00:00:04.000Z",
        metadata: { revision: 2 },
        state: TaskState.TASK_STATE_WORKING,
      }), alice);
      expect(await first.store.load("task-1", alice)).toMatchObject({
        metadata: { revision: 2 },
      });
      await expect(first.store.save(createTask({
        id: "task-1",
        timestamp: "2026-08-24T00:00:00.000Z",
        state: TaskState.TASK_STATE_WORKING,
      }), alice)).rejects.toMatchObject({ code: "A2A_TASK_STORE_STALE_WRITE" });
      await expect(first.store.save(createTask({
        id: "task-2",
        timestamp: "2026-08-24T00:00:06.000Z",
        metadata: { rewritten: true },
      }), alice)).rejects.toMatchObject({
        code: "A2A_TASK_STORE_TERMINAL_IMMUTABLE",
      });

      await expect(first.store.save(createTask({
        id: "task-4",
        timestamp: "2026-08-24T00:00:05.000Z",
      }), createContext("tenant-a", "carol"))).rejects.toMatchObject({
        code: "A2A_TASK_STORE_CAPACITY_REACHED",
      });
      expect(first.getHealth()).toMatchObject({ available: true, reason: null });

      await inspector.query(`
        UPDATE public.ai_gateway_a2a_tasks
        SET task_json = '{"tampered":true}'
        WHERE namespace = $1 AND tenant = $2 AND owner_id = $3 AND task_id = $4
      `, [namespace, "tenant-a", "bob", "task-3"]);
      await expect(second.store.load("task-3", bob)).rejects.toMatchObject({
        code: "A2A_TASK_STORE_CORRUPT",
      });
      expect(second.getHealth()).toMatchObject({
        available: false,
        reason: "store_unavailable",
        lastFailureCode: "A2A_TASK_STORE_CORRUPT",
      });

      expect(first.status).toMatchObject({
        mode: "postgres",
        durable: true,
        distributed: true,
        centralRequired: true,
      });
      expect(first.getHealth()).not.toHaveProperty("connectionString");
      expect(JSON.stringify(first.getHealth())).not.toContain("gateway_test");
    } finally {
      await inspector.query(
        "DELETE FROM public.ai_gateway_a2a_tasks WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_a2a_task_scope_counts WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_a2a_task_namespace_counts WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);

  it("fences duplicate execution and supports tenant-scoped remote cancellation", async () => {
    const namespace = `a2a-lease-${randomUUID()}`;
    const taskId = randomUUID();
    const env = {
      AI_GATEWAY_A2A_TASK_STORE_MODE: "postgres",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL: connectionString,
      AI_GATEWAY_A2A_TASK_STORE_NAMESPACE: namespace,
      AI_GATEWAY_A2A_EXECUTION_LEASE_TTL_MS: "5000",
      AI_GATEWAY_A2A_EXECUTION_LEASE_HEARTBEAT_MS: "1000",
      AI_GATEWAY_A2A_EXECUTION_LEASE_MAX_ENTRIES: "10",
    };
    const first = createA2AExecutionLeaseManager({ env, instanceId: "gateway-a" });
    const second = createA2AExecutionLeaseManager({ env, instanceId: "gateway-b" });
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    const alice = { tenant: "tenant-a", owner: "alice" };
    const otherTenant = { tenant: "tenant-b", owner: "alice" };
    try {
      const firstClaim = await first.acquire({ taskId, scope: alice });
      expect(firstClaim.success).toBe(true);
      if (!firstClaim.success) throw new Error(firstClaim.reason);

      await expect(second.acquire({ taskId, scope: alice })).resolves.toMatchObject({
        success: false,
        code: "A2A_EXECUTION_ALREADY_ACTIVE",
      });
      const isolatedClaim = await second.acquire({ taskId, scope: otherTenant });
      expect(isolatedClaim.success).toBe(true);
      if (!isolatedClaim.success) throw new Error(isolatedClaim.reason);

      const persisted = await inspector.query<{
        token_digest: string;
        token_fingerprint: string;
        plan_id: string;
        task_id: string;
      }>(`
        SELECT token_digest, token_fingerprint, plan_id, task_id
        FROM public.ai_gateway_workforce_task_claims
        WHERE task_id = $1
      `, [taskId]);
      expect(persisted.rows).toHaveLength(2);
      const persistedText = JSON.stringify(persisted.rows);
      expect(persistedText).not.toContain(firstClaim.lease.token);
      expect(persistedText).not.toContain(isolatedClaim.lease.token);
      expect(persistedText).not.toContain("tenant-a");
      expect(persistedText).not.toContain("tenant-b");
      expect(persistedText).not.toContain("alice");

      await expect(second.revokeForTask({
        taskId,
        scope: alice,
        reason: "remote cancellation",
      })).resolves.toMatchObject({ success: true });
      await expect(first.validate(firstClaim.lease)).resolves.toMatchObject({
        success: false,
        code: "A2A_EXECUTION_LEASE_LOST",
      });

      const replacement = await second.acquire({ taskId, scope: alice });
      expect(replacement.success).toBe(true);
      if (!replacement.success) throw new Error(replacement.reason);
      expect(BigInt(replacement.lease.fencingToken))
        .toBeGreaterThan(BigInt(firstClaim.lease.fencingToken));
      await second.release(replacement.lease);
      await second.release(isolatedClaim.lease);

      const healthText = JSON.stringify(second.getHealth());
      expect(healthText).not.toContain(connectionString ?? "gateway_test");
      expect(healthText).not.toContain(firstClaim.lease.token);
    } finally {
      await inspector.query(
        "DELETE FROM public.ai_gateway_workforce_task_claims WHERE task_id = $1",
        [taskId],
      ).catch(() => undefined);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);

  it("atomically consumes execution fences for terminal commits and remote cancellation", async () => {
    const namespace = `a2a-atomic-${randomUUID()}`;
    const env = {
      AI_GATEWAY_A2A_TASK_STORE_MODE: "postgres",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL: connectionString,
      AI_GATEWAY_A2A_TASK_STORE_NAMESPACE: namespace,
      AI_GATEWAY_A2A_TASK_TTL_MS: "60000",
      AI_GATEWAY_A2A_TASK_MAX_ENTRIES: "10",
      AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER: "10",
      AI_GATEWAY_A2A_TASK_MAX_BYTES: "4096",
      AI_GATEWAY_A2A_EXECUTION_LEASE_TTL_MS: "5000",
      AI_GATEWAY_A2A_EXECUTION_LEASE_HEARTBEAT_MS: "1000",
      AI_GATEWAY_A2A_TERMINAL_COMMIT_GRACE_MS: "1000",
    };
    const handle = createA2ATaskStore({ env, integratedExecutionBoundary: true });
    const manager = createA2AExecutionLeaseManager({
      env,
      instanceId: "atomic-gateway",
      issueGuard: handle.issueGuard,
    });
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    const context = createContext("tenant-a", "alice");
    const scope = { tenant: "tenant-a", owner: "alice" };
    const completedTaskId = randomUUID();
    const cancelledTaskId = randomUUID();
    const staleTaskId = randomUUID();
    try {
      await expect(handle.checkHealth()).resolves.toMatchObject({
        available: true,
        atomicTerminalFence: true,
      });
      expect(manager.status.atomicTerminalFence).toBe(true);

      await handle.store.save(createTask({
        id: completedTaskId,
        timestamp: "2026-08-24T00:00:01.000Z",
        state: TaskState.TASK_STATE_WORKING,
      }), context);
      const completionLease = await manager.acquire({ taskId: completedTaskId, scope });
      expect(completionLease.success).toBe(true);
      if (!completionLease.success) throw new Error(completionLease.reason);
      const completionFinalized = vi.fn(async () => undefined);
      handle.bindExecutionLease({
        taskId: completedTaskId,
        scope,
        lease: completionLease.lease,
        finalize: completionFinalized,
      });
      await handle.store.save(createTask({
        id: completedTaskId,
        timestamp: "2026-08-24T00:00:02.000Z",
        state: TaskState.TASK_STATE_COMPLETED,
      }), context);
      expect(completionFinalized).toHaveBeenCalledWith(true);
      await expect(manager.validate(completionLease.lease)).resolves.toMatchObject({
        success: false,
        code: "A2A_EXECUTION_LEASE_LOST",
      });
      await expect(manager.acquire({ taskId: completedTaskId, scope })).resolves.toMatchObject({
        success: false,
        code: "A2A_EXECUTION_TASK_TERMINAL",
        retryable: false,
      });

      await handle.store.save(createTask({
        id: cancelledTaskId,
        timestamp: "2026-08-24T00:00:03.000Z",
        state: TaskState.TASK_STATE_WORKING,
      }), context);
      const cancellationLease = await manager.acquire({ taskId: cancelledTaskId, scope });
      expect(cancellationLease.success).toBe(true);
      if (!cancellationLease.success) throw new Error(cancellationLease.reason);
      const cancellationFinalized = vi.fn(async () => undefined);
      handle.bindExecutionLease({
        taskId: cancelledTaskId,
        scope,
        lease: cancellationLease.lease,
        finalize: cancellationFinalized,
      });
      const cancelled = await handle.cancelTaskAtomically(cancelledTaskId, context, {
        state: TaskState.TASK_STATE_CANCELED,
        message: undefined,
        timestamp: "2026-08-24T00:00:04.000Z",
      });
      expect(cancelled).toMatchObject({
        id: cancelledTaskId,
        status: { state: TaskState.TASK_STATE_CANCELED },
      });
      expect(cancellationFinalized).toHaveBeenCalledWith(true);
      await expect(manager.acquire({ taskId: cancelledTaskId, scope })).resolves.toMatchObject({
        success: false,
        code: "A2A_EXECUTION_TASK_TERMINAL",
      });

      await handle.store.save(createTask({
        id: staleTaskId,
        timestamp: "2026-08-24T00:00:05.000Z",
        state: TaskState.TASK_STATE_WORKING,
      }), context);
      const staleLease = await manager.acquire({ taskId: staleTaskId, scope });
      expect(staleLease.success).toBe(true);
      if (!staleLease.success) throw new Error(staleLease.reason);
      await manager.revokeForTask({ taskId: staleTaskId, scope, reason: "remote revoke" });
      handle.bindExecutionLease({
        taskId: staleTaskId,
        scope,
        lease: staleLease.lease,
        finalize: vi.fn(async () => undefined),
      });
      await expect(handle.store.save(createTask({
        id: staleTaskId,
        timestamp: "2026-08-24T00:00:06.000Z",
        state: TaskState.TASK_STATE_COMPLETED,
      }), context)).rejects.toMatchObject({
        code: "A2A_TASK_TERMINAL_FENCE_LOST",
      });

      const persistedClaims = await inspector.query<{
        task_id: string;
        token_digest: string;
      }>(`
        SELECT task_id, token_digest
        FROM public.ai_gateway_workforce_task_claims
        WHERE task_id = ANY($1::text[])
      `, [[completedTaskId, cancelledTaskId]]);
      expect(persistedClaims.rows).toHaveLength(0);
      expect(JSON.stringify(await handle.store.load(completedTaskId, context)))
        .not.toContain(completionLease.lease.token);
    } finally {
      await inspector.query(
        "DELETE FROM public.ai_gateway_workforce_task_claims WHERE task_id = ANY($1::text[])",
        [[completedTaskId, cancelledTaskId, staleTaskId]],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_a2a_tasks WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_a2a_task_scope_counts WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_a2a_task_namespace_counts WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await handle.close();
      await manager.close();
      await inspector.end();
    }
  }, 20_000);
});
