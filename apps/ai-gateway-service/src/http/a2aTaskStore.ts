import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  Task,
  TaskState,
  type ListTasksRequest,
  type ListTasksResponse,
  type Task as A2ATask,
} from "@a2a-js/sdk";
import type { ServerCallContext, TaskStore } from "@a2a-js/sdk/server";
import {
  createPostgresA2ATaskStore,
  type A2AExecutionFenceBinding,
  type A2ATaskStorePostgresPool,
} from "./postgresA2ATaskStore.ts";
import {
  createA2AExecutionScopeId,
  deriveA2AExecutionLeaseNamespace,
  type A2AExecutionLease,
  type A2AExecutionScope,
} from "./a2aExecutionLease.ts";
import type { TaskClaimIssueGuard } from "../workforce/postgresTaskClaimLease.ts";

type RuntimeEnv = Record<string, string | undefined>;
type StoreMode = "memory" | "sqlite" | "postgres";

type TaskRow = {
  task_id: string;
  status_timestamp: string;
  task_json: string;
};

type Cursor = {
  v: 1;
  scope: string;
  timestamp: string;
  taskId: string;
};

export interface A2ATaskStoreStatus {
  readonly mode: StoreMode;
  readonly durable: boolean;
  readonly distributed: boolean;
  readonly required: boolean;
  readonly centralRequired: boolean;
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly maxEntriesPerOwner: number;
  readonly maxTaskBytes: number;
  readonly maxHistoryMessages: number;
  readonly maxArtifacts: number;
  readonly atomicTerminalFence: boolean;
  readonly terminalCommitGraceMs: number;
}

export interface A2ATaskStoreHandle {
  readonly store: TaskStore;
  readonly status: A2ATaskStoreStatus;
  getHealth(): A2ATaskStoreStatus & { available: boolean; reason: string | null };
  checkHealth(): Promise<A2ATaskStoreStatus & { available: boolean; reason: string | null }>;
  readonly issueGuard?: TaskClaimIssueGuard;
  bindExecutionLease(input: {
    taskId: string;
    scope: A2AExecutionScope;
    lease: A2AExecutionLease;
    finalize(committed: boolean): Promise<void> | void;
  }): void;
  markExecutionFinished(taskId: string, scope: A2AExecutionScope): void;
  cancelTaskAtomically(
    taskId: string,
    context: ServerCallContext,
    cancellationStatus: A2ATask["status"],
  ): Promise<A2ATask | undefined>;
  close(): Promise<void>;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_MAX_ENTRIES_PER_OWNER = 2_000;
const DEFAULT_MAX_TASK_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_HISTORY_MESSAGES = 500;
const DEFAULT_MAX_ARTIFACTS = 100;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const DEFAULT_POSTGRES_POOL_MAX = 4;
const DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS = 5_000;
const DEFAULT_TERMINAL_COMMIT_GRACE_MS = 10_000;
const TERMINAL_TASK_STATES = new Set<number>([
  Number(TaskState.TASK_STATE_COMPLETED),
  Number(TaskState.TASK_STATE_FAILED),
  Number(TaskState.TASK_STATE_CANCELED),
  Number(TaskState.TASK_STATE_REJECTED),
]);

export function createA2ATaskStore({
  env = process.env,
  now = Date.now,
  postgresPool,
  integratedExecutionBoundary = false,
}: {
  env?: RuntimeEnv;
  now?: () => number;
  postgresPool?: A2ATaskStorePostgresPool;
  integratedExecutionBoundary?: boolean;
} = {}): A2ATaskStoreHandle {
  const mode = resolveStoreMode(env);
  const required = readStrictBoolean(
    env.AI_GATEWAY_A2A_TASK_STORE_REQUIRED,
    "AI_GATEWAY_A2A_TASK_STORE_REQUIRED",
  );
  const centralRequired = readStrictBoolean(
    env.AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED,
    "AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED",
  );
  if (required && mode === "memory") {
    throw taskStoreError(
      "A2A_TASK_STORE_DURABLE_REQUIRED",
      "Required A2A task durability needs sqlite or PostgreSQL task storage.",
    );
  }
  if (centralRequired && mode !== "postgres") {
    throw taskStoreError(
      "A2A_TASK_STORE_CENTRAL_REQUIRED",
      "Cross-host A2A task durability requires PostgreSQL task storage.",
    );
  }

  const ttlMs = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_TTL_MS,
    DEFAULT_TTL_MS,
    60_000,
    365 * 24 * 60 * 60 * 1000,
    "AI_GATEWAY_A2A_TASK_TTL_MS",
  );
  const maxEntries = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_MAX_ENTRIES,
    DEFAULT_MAX_ENTRIES,
    1,
    1_000_000,
    "AI_GATEWAY_A2A_TASK_MAX_ENTRIES",
  );
  const maxEntriesPerOwner = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER,
    Math.min(DEFAULT_MAX_ENTRIES_PER_OWNER, maxEntries),
    1,
    maxEntries,
    "AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER",
  );
  const maxTaskBytes = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_MAX_BYTES,
    DEFAULT_MAX_TASK_BYTES,
    1_024,
    32 * 1024 * 1024,
    "AI_GATEWAY_A2A_TASK_MAX_BYTES",
  );
  const maxHistoryMessages = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_MAX_HISTORY_MESSAGES,
    DEFAULT_MAX_HISTORY_MESSAGES,
    1,
    10_000,
    "AI_GATEWAY_A2A_TASK_MAX_HISTORY_MESSAGES",
  );
  const maxArtifacts = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_MAX_ARTIFACTS,
    DEFAULT_MAX_ARTIFACTS,
    1,
    10_000,
    "AI_GATEWAY_A2A_TASK_MAX_ARTIFACTS",
  );
  const atomicTerminalFence = mode === "postgres" && integratedExecutionBoundary;
  const terminalCommitGraceMs = readBoundedInteger(
    env.AI_GATEWAY_A2A_TERMINAL_COMMIT_GRACE_MS,
    DEFAULT_TERMINAL_COMMIT_GRACE_MS,
    1_000,
    60_000,
    "AI_GATEWAY_A2A_TERMINAL_COMMIT_GRACE_MS",
  );
  const status = Object.freeze({
    mode,
    durable: mode !== "memory",
    distributed: mode === "postgres",
    required,
    centralRequired,
    ttlMs,
    maxEntries,
    maxEntriesPerOwner,
    maxTaskBytes,
    maxHistoryMessages,
    maxArtifacts,
    atomicTerminalFence,
    terminalCommitGraceMs,
  });
  if (mode === "postgres") {
    const connectionString = String(
      env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL ?? "",
    ).trim();
    if (!postgresPool) validatePostgresUrl(connectionString);
    const taskNamespace = readPortableIdentifier(
      env.AI_GATEWAY_A2A_TASK_STORE_NAMESPACE ?? "default",
      "AI_GATEWAY_A2A_TASK_STORE_NAMESPACE",
      128,
    );
    type BoundFence = A2AExecutionFenceBinding & {
      key: string;
      timer?: ReturnType<typeof setTimeout>;
      finalized: boolean;
    };
    const boundFences = new Map<string, BoundFence>();
    const consumeBinding = async (binding: A2AExecutionFenceBinding) => {
      const bound = binding as BoundFence;
      if (bound.finalized) return;
      bound.finalized = true;
      if (bound.timer) clearTimeout(bound.timer);
      boundFences.delete(bound.key);
      await bound.finalize(true);
    };
    const terminalFence = atomicTerminalFence
      ? {
          leaseNamespace: deriveA2AExecutionLeaseNamespace(taskNamespace),
          createScopeId: createA2AExecutionScopeId,
          resolveBinding(input: { tenant: string; owner: string; taskId: string }) {
            return boundFences.get(createFenceBindingKey(input));
          },
          consumeBinding,
        }
      : undefined;
    const postgresStore = createPostgresA2ATaskStore({
      connectionString: connectionString || undefined,
      pool: postgresPool,
      namespace: taskNamespace,
      ttlMs,
      maxEntries,
      maxEntriesPerOwner,
      maxTaskBytes,
      maxHistoryMessages,
      maxArtifacts,
      poolMax: readBoundedInteger(
        env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_POOL_MAX,
        DEFAULT_POSTGRES_POOL_MAX,
        1,
        32,
        "AI_GATEWAY_A2A_TASK_STORE_POSTGRES_POOL_MAX",
      ),
      statementTimeoutMs: readBoundedInteger(
        env.AI_GATEWAY_A2A_TASK_STORE_POSTGRES_STATEMENT_TIMEOUT_MS,
        DEFAULT_POSTGRES_STATEMENT_TIMEOUT_MS,
        100,
        30_000,
        "AI_GATEWAY_A2A_TASK_STORE_POSTGRES_STATEMENT_TIMEOUT_MS",
      ),
      now,
      terminalFence,
    });
    return Object.freeze({
      store: postgresStore.store,
      status,
      issueGuard: atomicTerminalFence ? postgresStore.issueGuard : undefined,
      bindExecutionLease(input: {
        taskId: string;
        scope: A2AExecutionScope;
        lease: A2AExecutionLease;
        finalize(committed: boolean): Promise<void> | void;
      }) {
        if (!atomicTerminalFence) return;
        const scope = normalizeExecutionScope(input.scope);
        const taskId = readBoundedText(input.taskId, "task ID", 256);
        const key = createFenceBindingKey({ ...scope, taskId });
        if (
          input.lease.identity.planId !== createA2AExecutionScopeId(scope)
          || input.lease.identity.taskId !== taskId
          || input.lease.identity.fencingToken !== input.lease.fencingToken
        ) {
          throw taskStoreError(
            "A2A_TASK_TERMINAL_FENCE_MISMATCH",
            "The execution fence is not bound to this scoped A2A task.",
          );
        }
        if (boundFences.has(key)) {
          throw taskStoreError(
            "A2A_TASK_TERMINAL_FENCE_ALREADY_BOUND",
            "The scoped A2A task already has a local terminal-fence binding.",
          );
        }
        boundFences.set(key, {
          key,
          proof: input.lease,
          finalize: input.finalize,
          finalized: false,
        });
      },
      markExecutionFinished(taskIdInput: string, scopeInput: A2AExecutionScope) {
        if (!atomicTerminalFence) return;
        const scope = normalizeExecutionScope(scopeInput);
        const taskId = readBoundedText(taskIdInput, "task ID", 256);
        const binding = boundFences.get(createFenceBindingKey({ ...scope, taskId }));
        if (!binding || binding.finalized || binding.timer) return;
        binding.timer = setTimeout(() => {
          if (binding.finalized) return;
          binding.finalized = true;
          boundFences.delete(binding.key);
          void Promise.resolve(binding.finalize(false)).catch(() => undefined);
        }, terminalCommitGraceMs);
        binding.timer.unref?.();
      },
      async cancelTaskAtomically(
        taskId: string,
        context: ServerCallContext,
        cancellationStatus: A2ATask["status"],
      ) {
        if (!atomicTerminalFence) {
          throw taskStoreError(
            "A2A_TASK_ATOMIC_CANCELLATION_UNAVAILABLE",
            "Atomic A2A cancellation is unavailable for this task store.",
          );
        }
        return postgresStore.cancelTaskAtomically(taskId, context, cancellationStatus);
      },
      getHealth() {
        return Object.freeze({ ...status, ...postgresStore.getHealth() });
      },
      async checkHealth() {
        const health = await postgresStore.checkHealth();
        return Object.freeze({ ...status, ...health });
      },
      async close() {
        const pending = [...boundFences.values()];
        boundFences.clear();
        await Promise.allSettled(pending.map(async (binding) => {
          if (binding.timer) clearTimeout(binding.timer);
          if (binding.finalized) return;
          binding.finalized = true;
          await binding.finalize(false);
        }));
        await postgresStore.close();
      },
    });
  }

  const busyTimeoutMs = readBoundedInteger(
    env.AI_GATEWAY_A2A_TASK_SQLITE_BUSY_TIMEOUT_MS,
    DEFAULT_BUSY_TIMEOUT_MS,
    100,
    30_000,
    "AI_GATEWAY_A2A_TASK_SQLITE_BUSY_TIMEOUT_MS",
  );
  const sqlitePath = mode === "memory"
    ? ":memory:"
    : resolveSqlitePath(env.AI_GATEWAY_A2A_TASK_STORE_PATH);
  const store = new SqliteA2ATaskStore({
    sqlitePath,
    now,
    ttlMs,
    maxEntries,
    maxEntriesPerOwner,
    maxTaskBytes,
    maxHistoryMessages,
    maxArtifacts,
    busyTimeoutMs,
  });

  return Object.freeze({
    store,
    status,
    bindExecutionLease() {},
    markExecutionFinished() {},
    async cancelTaskAtomically() {
      throw taskStoreError(
        "A2A_TASK_ATOMIC_CANCELLATION_UNAVAILABLE",
        "Atomic A2A cancellation requires the integrated PostgreSQL execution boundary.",
      );
    },
    getHealth() {
      const health = store.getHealth();
      return Object.freeze({ ...status, ...health });
    },
    async checkHealth() {
      const health = store.getHealth();
      return Object.freeze({ ...status, ...health });
    },
    async close() {
      store.close();
    },
  });
}

class SqliteA2ATaskStore implements TaskStore {
  readonly #db: DatabaseSync;
  readonly #now: () => number;
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #maxEntriesPerOwner: number;
  readonly #maxTaskBytes: number;
  readonly #maxHistoryMessages: number;
  readonly #maxArtifacts: number;
  #closed = false;

  constructor(options: {
    sqlitePath: string;
    now: () => number;
    ttlMs: number;
    maxEntries: number;
    maxEntriesPerOwner: number;
    maxTaskBytes: number;
    maxHistoryMessages: number;
    maxArtifacts: number;
    busyTimeoutMs: number;
  }) {
    if (options.sqlitePath !== ":memory:") {
      const directoryPath = dirname(options.sqlitePath);
      mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
      try {
        chmodSync(directoryPath, 0o700);
      } catch {
        // Windows and some mounted secret/data volumes do not expose POSIX modes.
      }
    }
    this.#db = new DatabaseSync(options.sqlitePath);
    this.#now = options.now;
    this.#ttlMs = options.ttlMs;
    this.#maxEntries = options.maxEntries;
    this.#maxEntriesPerOwner = options.maxEntriesPerOwner;
    this.#maxTaskBytes = options.maxTaskBytes;
    this.#maxHistoryMessages = options.maxHistoryMessages;
    this.#maxArtifacts = options.maxArtifacts;

    this.#db.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMs}`);
    if (options.sqlitePath !== ":memory:") {
      this.#db.exec("PRAGMA journal_mode = WAL");
    }
    this.#db.exec("PRAGMA synchronous = FULL");
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS a2a_tasks (
        tenant TEXT NOT NULL,
        owner TEXT NOT NULL,
        task_id TEXT NOT NULL,
        context_id TEXT NOT NULL,
        state INTEGER NOT NULL,
        status_timestamp TEXT NOT NULL,
        task_json TEXT NOT NULL,
        task_bytes INTEGER NOT NULL CHECK (task_bytes > 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (tenant, owner, task_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS a2a_tasks_scope_order_idx
        ON a2a_tasks (tenant, owner, status_timestamp DESC, task_id DESC);
      CREATE INDEX IF NOT EXISTS a2a_tasks_expiry_idx
        ON a2a_tasks (expires_at);
    `);
    if (options.sqlitePath !== ":memory:") {
      try {
        chmodSync(options.sqlitePath, 0o600);
      } catch {
        // The containing directory remains private where POSIX modes exist.
      }
    }
  }

  async save(task: A2ATask, context: ServerCallContext): Promise<void> {
    this.#assertOpen();
    const scope = readScope(context);
    const taskId = readBoundedText(task?.id, "task ID", 256);
    const contextId = readBoundedText(task?.contextId, "context ID", 256);
    if ((task.history?.length ?? 0) > this.#maxHistoryMessages) {
      throw taskStoreError(
        "A2A_TASK_STORE_HISTORY_LIMIT",
        "The A2A task history exceeds the configured persistence limit.",
      );
    }
    if ((task.artifacts?.length ?? 0) > this.#maxArtifacts) {
      throw taskStoreError(
        "A2A_TASK_STORE_ARTIFACT_LIMIT",
        "The A2A task artifact count exceeds the configured persistence limit.",
      );
    }

    const taskJson = encodeTask(task);
    const taskBytes = Buffer.byteLength(taskJson, "utf8");
    if (taskBytes <= 0 || taskBytes > this.#maxTaskBytes) {
      throw taskStoreError(
        "A2A_TASK_STORE_TASK_SIZE_LIMIT",
        "The serialized A2A task exceeds the configured persistence limit.",
      );
    }
    const timestamp = this.#now();
    const statusTimestamp = normalizeStatusTimestamp(task.status?.timestamp, timestamp);
    const state = normalizeTaskState(task.status?.state);

    this.#transaction(() => {
      this.#purgeExpired(timestamp);
      const existing = this.#db.prepare(`
        SELECT state, status_timestamp, task_json FROM a2a_tasks
        WHERE tenant = ? AND owner = ? AND task_id = ?
      `).get(scope.tenant, scope.owner, taskId) as {
        state: number;
        status_timestamp: string;
        task_json: string;
      } | undefined;
      if (existing && isTerminalTaskState(existing.state)) {
        if (isTerminalTaskState(state) && existing.task_json === taskJson) return;
        throw taskStoreError(
          "A2A_TASK_STORE_TERMINAL_IMMUTABLE",
          "A terminal A2A task cannot be changed or reopened.",
        );
      }
      if (existing && Date.parse(statusTimestamp) < Date.parse(existing.status_timestamp)) {
        throw taskStoreError(
          "A2A_TASK_STORE_STALE_WRITE",
          "The A2A task update is older than the persisted task state.",
        );
      }
      if (!existing) {
        const total = Number((this.#db.prepare(
          "SELECT COUNT(*) AS count FROM a2a_tasks",
        ).get() as { count: number }).count);
        if (total >= this.#maxEntries) {
          throw taskStoreError(
            "A2A_TASK_STORE_CAPACITY_REACHED",
            "The bounded A2A task store has reached its global capacity.",
          );
        }
        const ownerTotal = Number((this.#db.prepare(`
          SELECT COUNT(*) AS count FROM a2a_tasks WHERE tenant = ? AND owner = ?
        `).get(scope.tenant, scope.owner) as { count: number }).count);
        if (ownerTotal >= this.#maxEntriesPerOwner) {
          throw taskStoreError(
            "A2A_TASK_STORE_OWNER_CAPACITY_REACHED",
            "The bounded A2A task store has reached this owner's capacity.",
          );
        }
      }

      this.#db.prepare(`
        INSERT INTO a2a_tasks (
          tenant, owner, task_id, context_id, state, status_timestamp,
          task_json, task_bytes, created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (tenant, owner, task_id) DO UPDATE SET
          context_id = excluded.context_id,
          state = excluded.state,
          status_timestamp = excluded.status_timestamp,
          task_json = excluded.task_json,
          task_bytes = excluded.task_bytes,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at
      `).run(
        scope.tenant,
        scope.owner,
        taskId,
        contextId,
        state,
        statusTimestamp,
        taskJson,
        taskBytes,
        timestamp,
        timestamp,
        timestamp + this.#ttlMs,
      );
    });
  }

  async load(taskIdInput: string, context: ServerCallContext): Promise<A2ATask | undefined> {
    this.#assertOpen();
    const scope = readScope(context);
    const taskId = readBoundedText(taskIdInput, "task ID", 256);
    const timestamp = this.#now();
    this.#purgeExpired(timestamp);
    const row = this.#db.prepare(`
      SELECT task_id, status_timestamp, task_json
      FROM a2a_tasks
      WHERE tenant = ? AND owner = ? AND task_id = ? AND expires_at > ?
    `).get(scope.tenant, scope.owner, taskId, timestamp) as TaskRow | undefined;
    return row ? decodeTask(row.task_json) : undefined;
  }

  async list(
    params: ListTasksRequest,
    context: ServerCallContext,
  ): Promise<ListTasksResponse> {
    this.#assertOpen();
    const scope = readScope(context);
    const timestamp = this.#now();
    this.#purgeExpired(timestamp);
    const pageSize = params.pageSize ?? 50;
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw taskStoreError(
        "A2A_TASK_STORE_PAGE_SIZE_INVALID",
        "A2A task pageSize must be an integer between 1 and 100.",
      );
    }

    const contextId = params.contextId
      ? readBoundedText(params.contextId, "context ID", 256)
      : "";
    const status = params.status !== undefined
      && params.status !== TaskState.TASK_STATE_UNSPECIFIED
      ? normalizeTaskState(params.status)
      : undefined;
    const statusTimestampAfter = params.statusTimestampAfter
      ? normalizeFilterTimestamp(params.statusTimestampAfter)
      : "";
    const includeArtifacts = params.includeArtifacts === true;
    const cursorScope = createCursorScope({
      ...scope,
      contextId,
      status,
      statusTimestampAfter,
      includeArtifacts,
      pageSize,
    });
    const cursor = params.pageToken
      ? decodeCursor(params.pageToken, cursorScope)
      : undefined;

    const baseClauses = ["tenant = ?", "owner = ?", "expires_at > ?"];
    const baseValues: Array<string | number> = [scope.tenant, scope.owner, timestamp];
    if (contextId) {
      baseClauses.push("context_id = ?");
      baseValues.push(contextId);
    }
    if (status !== undefined) {
      baseClauses.push("state = ?");
      baseValues.push(status);
    }
    if (statusTimestampAfter) {
      baseClauses.push("status_timestamp >= ?");
      baseValues.push(statusTimestampAfter);
    }

    const whereWithoutCursor = baseClauses.join(" AND ");
    const totalSize = Number((this.#db.prepare(`
      SELECT COUNT(*) AS count FROM a2a_tasks WHERE ${whereWithoutCursor}
    `).get(...baseValues) as { count: number }).count);
    if (cursor) {
      baseClauses.push(
        "(status_timestamp < ? OR (status_timestamp = ? AND task_id < ?))",
      );
      baseValues.push(cursor.timestamp, cursor.timestamp, cursor.taskId);
    }

    const rows = this.#db.prepare(`
      SELECT task_id, status_timestamp, task_json
      FROM a2a_tasks
      WHERE ${baseClauses.join(" AND ")}
      ORDER BY status_timestamp DESC, task_id DESC
      LIMIT ?
    `).all(...baseValues, pageSize + 1) as TaskRow[];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const tasks = pageRows.map((row) => {
      const task = decodeTask(row.task_json);
      if (!includeArtifacts) task.artifacts = [];
      return task;
    });
    const lastRow = pageRows.at(-1);
    const nextPageToken = hasMore && lastRow
      ? encodeCursor({
          v: 1,
          scope: cursorScope,
          timestamp: lastRow.status_timestamp,
          taskId: lastRow.task_id,
        })
      : "";

    return {
      tasks,
      nextPageToken,
      pageSize,
      totalSize,
    };
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    this.#db.close();
  }

  getHealth() {
    if (this.#closed) {
      return { available: false, reason: "closed" };
    }
    try {
      const row = this.#db.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
      return row?.ok === 1
        ? { available: true, reason: null }
        : { available: false, reason: "probe_failed" };
    } catch {
      return { available: false, reason: "store_unavailable" };
    }
  }

  #assertOpen() {
    if (this.#closed) {
      throw taskStoreError(
        "A2A_TASK_STORE_CLOSED",
        "The A2A task store is closed.",
      );
    }
  }

  #purgeExpired(timestamp: number) {
    this.#db.prepare("DELETE FROM a2a_tasks WHERE expires_at <= ?").run(timestamp);
  }

  #transaction<T>(operation: () => T): T {
    let began = false;
    try {
      this.#db.exec("BEGIN IMMEDIATE");
      began = true;
      const result = operation();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      if (began) {
        try {
          this.#db.exec("ROLLBACK");
        } catch {
          // Preserve the original capacity/storage error.
        }
      }
      if (isA2ATaskStoreError(error)) throw error;
      throw taskStoreError(
        "A2A_TASK_STORE_UNAVAILABLE",
        "The A2A task store could not commit the requested operation.",
      );
    }
  }
}

export function isA2ATaskStoreError(
  error: unknown,
): error is Error & { code: string; category: "persistence" } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "persistence"
    && typeof candidate.code === "string"
    && candidate.code.startsWith("A2A_TASK_STORE_");
}

function resolveStoreMode(env: RuntimeEnv): StoreMode {
  const configured = String(env.AI_GATEWAY_A2A_TASK_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (!configured) {
    return readStrictBoolean(env.AI_GATEWAY_MULTI_INSTANCE, "AI_GATEWAY_MULTI_INSTANCE")
      ? "sqlite"
      : "memory";
  }
  if (
    configured === "memory"
    || configured === "sqlite"
    || configured === "postgres"
  ) return configured;
  throw taskStoreError(
    "A2A_TASK_STORE_MODE_INVALID",
    "AI_GATEWAY_A2A_TASK_STORE_MODE must be memory, sqlite, or postgres.",
  );
}

function validatePostgresUrl(value: string) {
  if (!value) {
    throw taskStoreError(
      "A2A_TASK_STORE_POSTGRES_URL_REQUIRED",
      "PostgreSQL A2A task storage requires AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw taskStoreError(
      "A2A_TASK_STORE_POSTGRES_URL_INVALID",
      "The A2A task-store PostgreSQL URL is invalid.",
    );
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw taskStoreError(
      "A2A_TASK_STORE_POSTGRES_URL_INVALID",
      "The A2A task-store URL must use PostgreSQL.",
    );
  }
  if (
    !isLoopbackHostname(parsed.hostname)
    && parsed.searchParams.get("sslmode") !== "verify-full"
  ) {
    throw taskStoreError(
      "A2A_TASK_STORE_POSTGRES_TLS_REQUIRED",
      "A non-loopback A2A task store must use sslmode=verify-full.",
    );
  }
}

function isLoopbackHostname(value: string) {
  const hostname = value.replace(/^\[|\]$/gu, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function readPortableIdentifier(
  value: string | undefined,
  name: string,
  maxLength: number,
) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw taskStoreError(
      "A2A_TASK_STORE_CONFIGURATION_INVALID",
      `${name} must be a portable identifier of at most ${maxLength} characters.`,
    );
  }
  return normalized;
}

function resolveSqlitePath(value: string | undefined): string {
  const configured = String(value ?? "").trim();
  const sqlitePath = resolve(configured || ".data/a2a-tasks.sqlite");
  if (sqlitePath.startsWith("\\\\")) {
    throw taskStoreError(
      "A2A_TASK_STORE_NETWORK_PATH_UNSAFE",
      "SQLite A2A task storage must not use a Windows network path.",
    );
  }
  return sqlitePath;
}

function readScope(context: ServerCallContext) {
  return {
    tenant: readBoundedText(context.tenant || "default", "tenant", 256),
    owner: readBoundedText(context.user?.userName || "unknown", "owner", 256),
  };
}

function normalizeExecutionScope(scope: A2AExecutionScope) {
  return {
    tenant: readBoundedText(scope?.tenant ?? "default", "tenant", 256),
    owner: readBoundedText(scope?.owner ?? "unknown", "owner", 256),
  };
}

function createFenceBindingKey(input: { tenant: string; owner: string; taskId: string }) {
  return createHash("sha256")
    .update(JSON.stringify([input.tenant, input.owner, input.taskId]))
    .digest("hex");
}

function readBoundedText(value: unknown, label: string, maxLength: number): string {
  const normalized = String(value ?? "").trim();
  if (
    !normalized
    || normalized.length > maxLength
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw taskStoreError(
      "A2A_TASK_STORE_SCOPE_INVALID",
      `The A2A ${label} is missing, too long, or contains control characters.`,
    );
  }
  return normalized;
}

function encodeTask(task: A2ATask): string {
  try {
    return JSON.stringify(Task.toJSON(task));
  } catch {
    throw taskStoreError(
      "A2A_TASK_STORE_TASK_INVALID",
      "The A2A task could not be serialized safely.",
    );
  }
}

function decodeTask(taskJson: string): A2ATask {
  try {
    return Task.fromJSON(JSON.parse(taskJson));
  } catch {
    throw taskStoreError(
      "A2A_TASK_STORE_CORRUPT",
      "A persisted A2A task could not be decoded.",
    );
  }
}

function normalizeTaskState(value: unknown): number {
  const state = Number(value ?? TaskState.TASK_STATE_UNSPECIFIED);
  if (!Number.isSafeInteger(state) || state < 0 || state > 8) {
    throw taskStoreError(
      "A2A_TASK_STORE_STATE_INVALID",
      "The A2A task state is invalid.",
    );
  }
  return state;
}

function isTerminalTaskState(state: number) {
  return TERMINAL_TASK_STATES.has(Number(state));
}

function normalizeStatusTimestamp(value: string | undefined, fallbackMs: number): string {
  if (!value) return new Date(fallbackMs).toISOString();
  return normalizeFilterTimestamp(value);
}

function normalizeFilterTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw taskStoreError(
      "A2A_TASK_STORE_TIMESTAMP_INVALID",
      "The A2A task status timestamp must be valid ISO 8601.",
    );
  }
  return new Date(timestamp).toISOString();
}

function createCursorScope(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url");
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string, expectedScope: string): Cursor {
  if (value.length < 4 || value.length > 2_048 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw invalidCursor();
  }
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) throw invalidCursor();
    const cursor = JSON.parse(decoded.toString("utf8")) as Partial<Cursor>;
    if (
      cursor.v !== 1
      || cursor.scope !== expectedScope
      || typeof cursor.timestamp !== "string"
      || normalizeFilterTimestamp(cursor.timestamp) !== cursor.timestamp
      || typeof cursor.taskId !== "string"
    ) {
      throw invalidCursor();
    }
    readBoundedText(cursor.taskId, "cursor task ID", 256);
    return cursor as Cursor;
  } catch {
    throw invalidCursor();
  }
}

function invalidCursor() {
  return taskStoreError(
    "A2A_TASK_STORE_PAGE_TOKEN_INVALID",
    "The A2A task page token is invalid for this scope or filter set.",
  );
}

function readStrictBoolean(value: string | undefined, name: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "false" || normalized === "0") return false;
  if (normalized === "true" || normalized === "1") return true;
  throw taskStoreError(
    "A2A_TASK_STORE_CONFIGURATION_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function readBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (value === undefined || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw taskStoreError(
      "A2A_TASK_STORE_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function taskStoreError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "persistence" as const,
  });
}

export const a2aTaskStoreInternals = Object.freeze({
  decodeCursor,
  encodeCursor,
  resolveStoreMode,
});
