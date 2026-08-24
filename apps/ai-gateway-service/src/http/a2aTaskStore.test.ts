import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Task,
  TaskState,
  type ListTasksRequest,
  type Task as A2ATask,
} from "@a2a-js/sdk";
import { ServerCallContext } from "@a2a-js/sdk/server";
import { describe, expect, it } from "vitest";
import { createA2ATaskStore } from "./a2aTaskStore.ts";

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
  contextId = "context-1",
  timestamp = "2026-08-24T00:00:00.000Z",
  state = TaskState.TASK_STATE_COMPLETED,
  withArtifact = false,
  metadata = {},
}: {
  id: string;
  contextId?: string;
  timestamp?: string;
  state?: TaskState;
  withArtifact?: boolean;
  metadata?: Record<string, unknown>;
}): A2ATask {
  return Task.fromJSON({
    id,
    contextId,
    status: { state, timestamp },
    artifacts: withArtifact
      ? [{ artifactId: `artifact-${id}`, name: "result", parts: [] }]
      : [],
    history: [],
    metadata,
  });
}

function listRequest(overrides: Partial<ListTasksRequest> = {}): ListTasksRequest {
  return {
    tenant: "client-supplied-tenant-is-ignored",
    contextId: "",
    status: TaskState.TASK_STATE_UNSPECIFIED,
    pageSize: 50,
    pageToken: "",
    statusTimestampAfter: undefined,
    includeArtifacts: false,
    ...overrides,
  };
}

describe("bounded A2A task store", () => {
  it("persists tasks across restart without crossing tenant or owner scope", async () => {
    const directory = await mkdtemp(join(tmpdir(), "a2a-task-store-"));
    const sqlitePath = join(directory, "tasks.sqlite");
    const env = {
      AI_GATEWAY_A2A_TASK_STORE_MODE: "sqlite",
      AI_GATEWAY_A2A_TASK_STORE_REQUIRED: "true",
      AI_GATEWAY_A2A_TASK_STORE_PATH: sqlitePath,
    };
    const alice = createContext("tenant-a", "alice");
    const bob = createContext("tenant-a", "bob");
    const otherTenant = createContext("tenant-b", "alice");

    try {
      const first = createA2ATaskStore({ env });
      await first.store.save(createTask({ id: "task-persisted", withArtifact: true }), alice);
      await first.close();

      const second = createA2ATaskStore({ env });
      expect(await second.store.load("task-persisted", alice)).toMatchObject({
        id: "task-persisted",
        contextId: "context-1",
      });
      expect(await second.store.load("task-persisted", bob)).toBeUndefined();
      expect(await second.store.load("task-persisted", otherTenant)).toBeUndefined();
      await second.close();

      if (process.platform !== "win32") {
        expect((await stat(sqlitePath)).mode & 0o077).toBe(0);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses stable keyset pagination and binds cursors to scope and filters", async () => {
    const handle = createA2ATaskStore({ env: {} });
    const alice = createContext("tenant-a", "alice");
    try {
      await handle.store.save(createTask({
        id: "task-1",
        timestamp: "2026-08-24T00:00:01.000Z",
        withArtifact: true,
      }), alice);
      await handle.store.save(createTask({
        id: "task-2",
        timestamp: "2026-08-24T00:00:02.000Z",
        withArtifact: true,
      }), alice);
      await handle.store.save(createTask({
        id: "task-3",
        timestamp: "2026-08-24T00:00:03.000Z",
        withArtifact: true,
      }), alice);

      const firstPage = await handle.store.list(listRequest({ pageSize: 2 }), alice);
      expect(firstPage.tasks.map((task) => task.id)).toEqual(["task-3", "task-2"]);
      expect(firstPage.tasks.every((task) => task.artifacts.length === 0)).toBe(true);
      expect(firstPage.totalSize).toBe(3);
      expect(firstPage.nextPageToken).not.toBe("");

      const secondPage = await handle.store.list(listRequest({
        pageSize: 2,
        pageToken: firstPage.nextPageToken,
      }), alice);
      expect(secondPage.tasks.map((task) => task.id)).toEqual(["task-1"]);
      expect(secondPage.nextPageToken).toBe("");

      await expect(handle.store.list(listRequest({
        pageSize: 1,
        pageToken: firstPage.nextPageToken,
      }), alice)).rejects.toMatchObject({
        code: "A2A_TASK_STORE_PAGE_TOKEN_INVALID",
      });
      await expect(handle.store.list(listRequest({
        pageSize: 2,
        pageToken: firstPage.nextPageToken,
      }), createContext("tenant-a", "bob"))).rejects.toMatchObject({
        code: "A2A_TASK_STORE_PAGE_TOKEN_INVALID",
      });
    } finally {
      await handle.close();
    }
  });

  it("enforces owner/global capacity, task size, and TTL limits", async () => {
    let now = 1_800_000_000_000;
    const handle = createA2ATaskStore({
      env: {
        AI_GATEWAY_A2A_TASK_TTL_MS: "60000",
        AI_GATEWAY_A2A_TASK_MAX_ENTRIES: "2",
        AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER: "1",
        AI_GATEWAY_A2A_TASK_MAX_BYTES: "1024",
      },
      now: () => now,
    });
    const alice = createContext("tenant-a", "alice");
    const bob = createContext("tenant-a", "bob");
    const carol = createContext("tenant-a", "carol");
    try {
      await handle.store.save(createTask({ id: "task-a" }), alice);
      await expect(handle.store.save(createTask({ id: "task-a-2" }), alice))
        .rejects.toMatchObject({ code: "A2A_TASK_STORE_OWNER_CAPACITY_REACHED" });
      await handle.store.save(createTask({ id: "task-b" }), bob);
      await expect(handle.store.save(createTask({ id: "task-c" }), carol))
        .rejects.toMatchObject({ code: "A2A_TASK_STORE_CAPACITY_REACHED" });
      await expect(handle.store.save(createTask({
        id: "task-large",
        metadata: { value: "x".repeat(2_000) },
      }), bob)).rejects.toMatchObject({
        code: "A2A_TASK_STORE_TASK_SIZE_LIMIT",
      });

      now += 60_001;
      expect(await handle.store.load("task-a", alice)).toBeUndefined();
      await expect(handle.store.save(createTask({ id: "task-c" }), carol)).resolves.toBeUndefined();
    } finally {
      await handle.close();
    }
  });

  it("allows separate SQLite connections to share the same durable scope", async () => {
    const directory = await mkdtemp(join(tmpdir(), "a2a-task-store-shared-"));
    const sqlitePath = join(directory, "tasks.sqlite");
    const env = {
      AI_GATEWAY_A2A_TASK_STORE_MODE: "sqlite",
      AI_GATEWAY_A2A_TASK_STORE_PATH: sqlitePath,
    };
    const alice = createContext("tenant-a", "alice");
    const first = createA2ATaskStore({ env });
    const second = createA2ATaskStore({ env });
    try {
      await first.store.save(createTask({ id: "task-from-first" }), alice);
      await second.store.save(createTask({ id: "task-from-second" }), alice);
      expect(await first.store.load("task-from-second", alice)).toMatchObject({
        id: "task-from-second",
      });
      expect(await second.store.load("task-from-first", alice)).toMatchObject({
        id: "task-from-first",
      });
    } finally {
      await first.close();
      await second.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed when durability is required but memory mode is selected", () => {
    expect(() => createA2ATaskStore({
      env: {
        AI_GATEWAY_A2A_TASK_STORE_MODE: "memory",
        AI_GATEWAY_A2A_TASK_STORE_REQUIRED: "true",
      },
    })).toThrow(expect.objectContaining({
      code: "A2A_TASK_STORE_DURABLE_REQUIRED",
    }));
  });
});
