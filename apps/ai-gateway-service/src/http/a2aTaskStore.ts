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

type RuntimeEnv = Record<string, string | undefined>;
type StoreMode = "memory" | "sqlite";

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
  readonly required: boolean;
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly maxEntriesPerOwner: number;
  readonly maxTaskBytes: number;
  readonly maxHistoryMessages: number;
  readonly maxArtifacts: number;
}

export interface A2ATaskStoreHandle {
  readonly store: TaskStore;
  readonly status: A2ATaskStoreStatus;
  getHealth(): A2ATaskStoreStatus & { available: boolean; reason: string | null };
  close(): Promise<void>;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_MAX_ENTRIES_PER_OWNER = 2_000;
const DEFAULT_MAX_TASK_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_HISTORY_MESSAGES = 500;
const DEFAULT_MAX_ARTIFACTS = 100;
const DEFAULT_BUSY_TIMEOUT_MS = 5_000;

export function createA2ATaskStore({
  env = process.env,
  now = Date.now,
}: {
  env?: RuntimeEnv;
  now?: () => number;
} = {}): A2ATaskStoreHandle {
  const mode = resolveStoreMode(env);
  const required = readStrictBoolean(
    env.AI_GATEWAY_A2A_TASK_STORE_REQUIRED,
    "AI_GATEWAY_A2A_TASK_STORE_REQUIRED",
  );
  if (required && mode !== "sqlite") {
    throw taskStoreError(
      "A2A_TASK_STORE_DURABLE_REQUIRED",
      "Required A2A task durability needs the sqlite task-store mode.",
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
  const status = Object.freeze({
    mode,
    durable: mode === "sqlite",
    required,
    ttlMs,
    maxEntries,
    maxEntriesPerOwner,
    maxTaskBytes,
    maxHistoryMessages,
    maxArtifacts,
  });
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
    getHealth() {
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
        SELECT 1 AS present FROM a2a_tasks
        WHERE tenant = ? AND owner = ? AND task_id = ?
      `).get(scope.tenant, scope.owner, taskId) as { present: number } | undefined;
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
  if (configured === "memory" || configured === "sqlite") return configured;
  throw taskStoreError(
    "A2A_TASK_STORE_MODE_INVALID",
    "AI_GATEWAY_A2A_TASK_STORE_MODE must be memory or sqlite.",
  );
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
