import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  Task,
  TaskState,
  type ListTasksRequest,
  type Task as A2ATask,
} from "@a2a-js/sdk";
import { ServerCallContext } from "@a2a-js/sdk/server";
import { describe, expect, it } from "vitest";
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
}: {
  id: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}): A2ATask {
  return Task.fromJSON({
    id,
    contextId: "context-1",
    status: {
      state: TaskState.TASK_STATE_COMPLETED,
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
      }), alice);
      expect(await first.store.load("task-1", alice)).toMatchObject({
        metadata: { revision: 2 },
      });
      await expect(first.store.save(createTask({
        id: "task-1",
        timestamp: "2026-08-24T00:00:00.000Z",
      }), alice)).rejects.toMatchObject({ code: "A2A_TASK_STORE_STALE_WRITE" });

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
});
