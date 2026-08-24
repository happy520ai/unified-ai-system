import { createHash } from "node:crypto";
import {
  Task,
  TaskState,
  type ListTasksRequest,
  type ListTasksResponse,
  type Task as A2ATask,
} from "@a2a-js/sdk";
import type { ServerCallContext, TaskStore } from "@a2a-js/sdk/server";

type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};

export type A2ATaskStorePostgresClient = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  release(): void;
};

export type A2ATaskStorePostgresPool = {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
  connect(): Promise<A2ATaskStorePostgresClient>;
  end(): Promise<void>;
  on?(event: "error", listener: (error: Error) => void): unknown;
};

export type PostgresA2ATaskStoreOptions = {
  connectionString?: string;
  pool?: A2ATaskStorePostgresPool;
  namespace: string;
  ttlMs: number;
  maxEntries: number;
  maxEntriesPerOwner: number;
  maxTaskBytes: number;
  maxHistoryMessages: number;
  maxArtifacts: number;
  poolMax: number;
  statementTimeoutMs: number;
  now?: () => number;
};

type Cursor = {
  v: 1;
  scope: string;
  timestamp: string;
  taskId: string;
};

type TaskRow = {
  task_id: string;
  status_timestamp_ms: string | number;
  task_json: string;
  task_sha256: string;
};

type NormalizedTask = {
  tenant: string;
  owner: string;
  taskId: string;
  contextId: string;
  state: number;
  statusTimestamp: string;
  statusTimestampMs: number;
  taskJson: string;
  taskSha256: string;
  taskBytes: number;
};

const TASKS_TABLE = "public.ai_gateway_a2a_tasks";
const NAMESPACE_COUNTS_TABLE = "public.ai_gateway_a2a_task_namespace_counts";
const SCOPE_COUNTS_TABLE = "public.ai_gateway_a2a_task_scope_counts";
const INIT_LOCK_NAMESPACE = 1_431_193_301;
const INIT_LOCK_KEY = 1_431_193_302;
const TASK_LOCK_NAMESPACE = 1_431_193_303;

const INITIALIZE_SQL = `/* a2a-task-store:init */
  CREATE TABLE IF NOT EXISTS ${TASKS_TABLE} (
    namespace TEXT NOT NULL,
    tenant TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    context_id TEXT NOT NULL,
    state SMALLINT NOT NULL CHECK (state >= 0 AND state <= 8),
    status_timestamp TIMESTAMPTZ NOT NULL,
    task_json TEXT NOT NULL,
    task_sha256 CHAR(64) NOT NULL CHECK (task_sha256 ~ '^[a-f0-9]{64}$'),
    task_bytes INTEGER NOT NULL CHECK (task_bytes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (namespace, tenant, owner_id, task_id)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_a2a_scope_order_idx
    ON ${TASKS_TABLE} (
      namespace, tenant, owner_id, status_timestamp DESC, task_id DESC
    );
  CREATE INDEX IF NOT EXISTS ai_gateway_a2a_expiry_idx
    ON ${TASKS_TABLE} (namespace, expires_at);
  CREATE TABLE IF NOT EXISTS ${NAMESPACE_COUNTS_TABLE} (
    namespace TEXT PRIMARY KEY,
    row_count BIGINT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );
  CREATE TABLE IF NOT EXISTS ${SCOPE_COUNTS_TABLE} (
    namespace TEXT NOT NULL,
    tenant TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    row_count BIGINT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (namespace, tenant, owner_id)
  );
  INSERT INTO ${NAMESPACE_COUNTS_TABLE} (namespace, row_count, updated_at)
  SELECT namespace, COUNT(*)::bigint, clock_timestamp()
  FROM ${TASKS_TABLE}
  GROUP BY namespace
  ON CONFLICT (namespace) DO NOTHING;
  INSERT INTO ${SCOPE_COUNTS_TABLE} (
    namespace, tenant, owner_id, row_count, updated_at
  )
  SELECT namespace, tenant, owner_id, COUNT(*)::bigint, clock_timestamp()
  FROM ${TASKS_TABLE}
  GROUP BY namespace, tenant, owner_id
  ON CONFLICT (namespace, tenant, owner_id) DO NOTHING;
`;

const PURGE_EXPIRED_SQL = `/* a2a-task-store:purge-expired */
  WITH deleted AS (
    DELETE FROM ${TASKS_TABLE}
    WHERE namespace = $1 AND expires_at <= clock_timestamp()
    RETURNING tenant, owner_id
  ),
  scope_totals AS (
    SELECT tenant, owner_id, COUNT(*)::bigint AS deleted_count
    FROM deleted
    GROUP BY tenant, owner_id
  ),
  scope_updates AS (
    UPDATE ${SCOPE_COUNTS_TABLE} AS counts
    SET row_count = GREATEST(0, counts.row_count - totals.deleted_count),
        updated_at = clock_timestamp()
    FROM scope_totals AS totals
    WHERE counts.namespace = $1
      AND counts.tenant = totals.tenant
      AND counts.owner_id = totals.owner_id
    RETURNING counts.tenant
  )
  UPDATE ${NAMESPACE_COUNTS_TABLE}
  SET row_count = GREATEST(
        0,
        row_count - (SELECT COUNT(*)::bigint FROM deleted)
      ),
      updated_at = clock_timestamp()
  WHERE namespace = $1
`;

export function createPostgresA2ATaskStore(rawOptions: PostgresA2ATaskStoreOptions) {
  const options = normalizeOptions(rawOptions);
  const ownsPool = !rawOptions.pool;
  const poolPromise = rawOptions.pool
    ? Promise.resolve(rawOptions.pool)
    : loadPool(options);
  let readyPromise: Promise<A2ATaskStorePostgresPool> | null = null;
  let closed = false;
  let available = false;
  let reason: string | null = "initializing";
  let totalFailures = 0;
  let lastFailureCode: string | null = null;

  void poolPromise.then((pool) => {
    pool.on?.("error", () => {
      available = false;
      reason = "store_unavailable";
    });
  }).catch(() => {
    available = false;
    reason = "store_unavailable";
  });
  void getReadyPool().catch(() => undefined);

  const store: TaskStore = {
    async save(task: A2ATask, context: ServerCallContext): Promise<void> {
      const normalized = normalizeTask(task, context, options);
      let client: A2ATaskStorePostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
          "/* a2a-task-store:task-lock */ SELECT pg_advisory_xact_lock($1, hashtext($2))",
          [TASK_LOCK_NAMESPACE, createTaskLockScope(options.namespace, normalized)],
        );
        await client.query(PURGE_EXPIRED_SQL, [options.namespace]);
        await ensureCounterRows(client, options.namespace, normalized);
        const existing = await client.query<{
          status_timestamp_ms: string | number;
          task_sha256: string;
        }>(`/* a2a-task-store:existing */
          SELECT
            floor(EXTRACT(EPOCH FROM status_timestamp) * 1000)::bigint
              AS status_timestamp_ms,
            task_sha256
          FROM ${TASKS_TABLE}
          WHERE namespace = $1 AND tenant = $2 AND owner_id = $3 AND task_id = $4
          FOR UPDATE
        `, [
          options.namespace,
          normalized.tenant,
          normalized.owner,
          normalized.taskId,
        ]);
        const existingRow = existing.rows[0];
        if (existingRow) {
          const existingTimestampMs = Number(existingRow.status_timestamp_ms);
          if (normalized.statusTimestampMs < existingTimestampMs) {
            throw taskStoreError(
              "A2A_TASK_STORE_STALE_WRITE",
              "The A2A task update is older than the persisted task state.",
            );
          }
          await client.query(`/* a2a-task-store:update */
            UPDATE ${TASKS_TABLE}
            SET context_id = $5,
                state = $6,
                status_timestamp = $7::timestamptz,
                task_json = $8,
                task_sha256 = $9,
                task_bytes = $10,
                updated_at = clock_timestamp(),
                expires_at = clock_timestamp()
                  + ($11::bigint * interval '1 millisecond')
            WHERE namespace = $1 AND tenant = $2 AND owner_id = $3 AND task_id = $4
          `, taskValues(options, normalized));
        } else {
          const namespaceCount = await client.query<{ row_count: string | number }>(`
            /* a2a-task-store:namespace-count */
            SELECT row_count FROM ${NAMESPACE_COUNTS_TABLE}
            WHERE namespace = $1
            FOR UPDATE
          `, [options.namespace]);
          const scopeCount = await client.query<{ row_count: string | number }>(`
            /* a2a-task-store:scope-count */
            SELECT row_count FROM ${SCOPE_COUNTS_TABLE}
            WHERE namespace = $1 AND tenant = $2 AND owner_id = $3
            FOR UPDATE
          `, [options.namespace, normalized.tenant, normalized.owner]);
          if (Number(namespaceCount.rows[0]?.row_count ?? 0) >= options.maxEntries) {
            throw taskStoreError(
              "A2A_TASK_STORE_CAPACITY_REACHED",
              "The bounded A2A task store has reached its global capacity.",
            );
          }
          if (Number(scopeCount.rows[0]?.row_count ?? 0) >= options.maxEntriesPerOwner) {
            throw taskStoreError(
              "A2A_TASK_STORE_OWNER_CAPACITY_REACHED",
              "The bounded A2A task store has reached this owner's capacity.",
            );
          }
          await client.query(`/* a2a-task-store:insert */
            INSERT INTO ${TASKS_TABLE} (
              namespace, tenant, owner_id, task_id, context_id, state,
              status_timestamp, task_json, task_sha256, task_bytes, expires_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10,
              clock_timestamp() + ($11::bigint * interval '1 millisecond')
            )
          `, taskValues(options, normalized));
          await client.query(`/* a2a-task-store:namespace-increment */
            UPDATE ${NAMESPACE_COUNTS_TABLE}
            SET row_count = row_count + 1, updated_at = clock_timestamp()
            WHERE namespace = $1
          `, [options.namespace]);
          await client.query(`/* a2a-task-store:scope-increment */
            UPDATE ${SCOPE_COUNTS_TABLE}
            SET row_count = row_count + 1, updated_at = clock_timestamp()
            WHERE namespace = $1 AND tenant = $2 AND owner_id = $3
          `, [options.namespace, normalized.tenant, normalized.owner]);
        }
        await client.query("COMMIT");
        markReady();
      } catch (error) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the normalized task-store error.
          }
        }
        if (isA2ATaskStoreError(error)) {
          if (shouldDegradeStoreHealth(error.code)) markFailure(error);
          throw error;
        }
        markFailure(error);
        throw taskStoreError(
          "A2A_TASK_STORE_UNAVAILABLE",
          "The central A2A task store could not commit the requested operation.",
        );
      } finally {
        client?.release();
      }
    },

    async load(
      taskIdInput: string,
      context: ServerCallContext,
    ): Promise<A2ATask | undefined> {
      assertOpen();
      const scope = readScope(context);
      const taskId = readBoundedText(taskIdInput, "task ID", 256);
      try {
        const pool = await getReadyPool();
        const result = await pool.query<TaskRow>(`/* a2a-task-store:load */
          SELECT
            task_id,
            floor(EXTRACT(EPOCH FROM status_timestamp) * 1000)::bigint
              AS status_timestamp_ms,
            task_json,
            task_sha256
          FROM ${TASKS_TABLE}
          WHERE namespace = $1 AND tenant = $2 AND owner_id = $3 AND task_id = $4
            AND expires_at > clock_timestamp()
        `, [options.namespace, scope.tenant, scope.owner, taskId]);
        markReady();
        return result.rows[0] ? decodeVerifiedTask(result.rows[0]) : undefined;
      } catch (error) {
        return handleReadFailure(error);
      }
    },

    async list(
      params: ListTasksRequest,
      context: ServerCallContext,
    ): Promise<ListTasksResponse> {
      assertOpen();
      const scope = readScope(context);
      const query = normalizeListRequest(params, scope);
      let client: A2ATaskStorePostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        const clauses = [
          "namespace = $1",
          "tenant = $2",
          "owner_id = $3",
          "expires_at > clock_timestamp()",
        ];
        const values: unknown[] = [options.namespace, scope.tenant, scope.owner];
        const add = (clause: string, value: unknown) => {
          values.push(value);
          clauses.push(clause.replaceAll("?", `$${values.length}`));
        };
        if (query.contextId) add("context_id = ?", query.contextId);
        if (query.status !== undefined) add("state = ?", query.status);
        if (query.statusTimestampAfter) {
          add("status_timestamp >= ?::timestamptz", query.statusTimestampAfter);
        }
        const count = await client.query<{ total_size: string | number }>(`
          /* a2a-task-store:list-count */
          SELECT COUNT(*)::bigint AS total_size
          FROM ${TASKS_TABLE}
          WHERE ${clauses.join(" AND ")}
        `, values);
        if (query.cursor) {
          values.push(query.cursor.timestamp, query.cursor.taskId);
          clauses.push(`(
            status_timestamp < $${values.length - 1}::timestamptz
            OR (
              status_timestamp = $${values.length - 1}::timestamptz
              AND task_id < $${values.length}
            )
          )`);
        }
        values.push(query.pageSize + 1);
        const rows = await client.query<TaskRow>(`/* a2a-task-store:list */
          SELECT
            task_id,
            floor(EXTRACT(EPOCH FROM status_timestamp) * 1000)::bigint
              AS status_timestamp_ms,
            task_json,
            task_sha256
          FROM ${TASKS_TABLE}
          WHERE ${clauses.join(" AND ")}
          ORDER BY status_timestamp DESC, task_id DESC
          LIMIT $${values.length}
        `, values);
        await client.query("COMMIT");
        client.release();
        client = null;
        const hasMore = rows.rows.length > query.pageSize;
        const pageRows = hasMore ? rows.rows.slice(0, query.pageSize) : rows.rows;
        const tasks = pageRows.map((row) => {
          const task = decodeVerifiedTask(row);
          if (!query.includeArtifacts) task.artifacts = [];
          return task;
        });
        const lastRow = pageRows.at(-1);
        const nextPageToken = hasMore && lastRow
          ? encodeCursor({
              v: 1,
              scope: query.cursorScope,
              timestamp: new Date(Number(lastRow.status_timestamp_ms)).toISOString(),
              taskId: lastRow.task_id,
            })
          : "";
        markReady();
        return {
          tasks,
          nextPageToken,
          pageSize: query.pageSize,
          totalSize: Number(count.rows[0]?.total_size ?? 0),
        };
      } catch (error) {
        if (client) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the normalized task-store error.
          }
        }
        if (isA2ATaskStoreError(error)) {
          if (shouldDegradeStoreHealth(error.code)) markFailure(error);
          throw error;
        }
        markFailure(error);
        throw taskStoreError(
          "A2A_TASK_STORE_UNAVAILABLE",
          "The central A2A task store could not read the requested tasks.",
        );
      } finally {
        client?.release();
      }
    },
  };

  return {
    store,
    getHealth() {
      return {
        available: !closed && available,
        reason: closed ? "closed" : reason,
        totalFailures,
        lastFailureCode,
      };
    },
    async checkHealth() {
      try {
        const pool = await getReadyPool();
        await pool.query("/* a2a-task-store:active-health */ SELECT 1 AS healthy");
        markReady();
      } catch (error) {
        markFailure(error);
      }
      return this.getHealth();
    },
    async close() {
      if (closed) return;
      closed = true;
      available = false;
      reason = "closed";
      if (!ownsPool) return;
      try {
        if (readyPromise) await readyPromise;
        const pool = await poolPromise;
        await pool.end();
      } catch {
        // Initialization failure leaves no required shutdown work.
      }
    },
  };

  async function getReadyPool(): Promise<A2ATaskStorePostgresPool> {
    assertOpen();
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        const client = await pool.connect();
        let locked = false;
        try {
          await client.query(
            "/* a2a-task-store:init-lock */ SELECT pg_advisory_lock($1, $2)",
            [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
          );
          locked = true;
          await client.query(INITIALIZE_SQL);
        } finally {
          if (locked) {
            try {
              await client.query(
                "/* a2a-task-store:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
                [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
              );
            } catch {
              // Session termination releases the initialization lock.
            }
          }
          client.release();
        }
        await pool.query("/* a2a-task-store:health */ SELECT 1 AS healthy");
        markReady();
        return pool;
      });
      void readyPromise.catch((error) => {
        markFailure(error);
      });
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      throw error;
    }
  }

  function assertOpen() {
    if (closed) {
      throw taskStoreError(
        "A2A_TASK_STORE_CLOSED",
        "The A2A task store is closed.",
      );
    }
  }

  function markReady() {
    available = true;
    reason = null;
    lastFailureCode = null;
  }

  function markFailure(error: unknown) {
    available = false;
    reason = "store_unavailable";
    totalFailures += 1;
    lastFailureCode = isA2ATaskStoreError(error)
      ? error.code
      : "A2A_TASK_STORE_UNAVAILABLE";
  }

  function handleReadFailure(error: unknown): never {
    if (isA2ATaskStoreError(error)) {
      if (shouldDegradeStoreHealth(error.code)) markFailure(error);
      throw error;
    }
    markFailure(error);
    throw taskStoreError(
      "A2A_TASK_STORE_UNAVAILABLE",
      "The central A2A task store could not read the requested task.",
    );
  }
}

async function ensureCounterRows(
  client: A2ATaskStorePostgresClient,
  namespace: string,
  task: NormalizedTask,
) {
  await client.query(`/* a2a-task-store:namespace-counter-init */
    INSERT INTO ${NAMESPACE_COUNTS_TABLE} (namespace, row_count, updated_at)
    VALUES ($1, 0, clock_timestamp())
    ON CONFLICT (namespace) DO NOTHING
  `, [namespace]);
  await client.query(`/* a2a-task-store:scope-counter-init */
    INSERT INTO ${SCOPE_COUNTS_TABLE} (
      namespace, tenant, owner_id, row_count, updated_at
    ) VALUES ($1, $2, $3, 0, clock_timestamp())
    ON CONFLICT (namespace, tenant, owner_id) DO NOTHING
  `, [namespace, task.tenant, task.owner]);
}

function normalizeTask(
  task: A2ATask,
  context: ServerCallContext,
  options: ReturnType<typeof normalizeOptions>,
): NormalizedTask {
  const scope = readScope(context);
  const taskId = readBoundedText(task?.id, "task ID", 256);
  const contextId = readBoundedText(task?.contextId, "context ID", 256);
  if ((task.history?.length ?? 0) > options.maxHistoryMessages) {
    throw taskStoreError(
      "A2A_TASK_STORE_HISTORY_LIMIT",
      "The A2A task history exceeds the configured persistence limit.",
    );
  }
  if ((task.artifacts?.length ?? 0) > options.maxArtifacts) {
    throw taskStoreError(
      "A2A_TASK_STORE_ARTIFACT_LIMIT",
      "The A2A task artifact count exceeds the configured persistence limit.",
    );
  }
  const taskJson = encodeTask(task);
  const taskBytes = Buffer.byteLength(taskJson, "utf8");
  if (taskBytes <= 0 || taskBytes > options.maxTaskBytes) {
    throw taskStoreError(
      "A2A_TASK_STORE_TASK_SIZE_LIMIT",
      "The serialized A2A task exceeds the configured persistence limit.",
    );
  }
  const statusTimestamp = normalizeStatusTimestamp(
    task.status?.timestamp,
    options.now(),
  );
  return {
    ...scope,
    taskId,
    contextId,
    state: normalizeTaskState(task.status?.state),
    statusTimestamp,
    statusTimestampMs: Date.parse(statusTimestamp),
    taskJson,
    taskSha256: createHash("sha256").update(taskJson).digest("hex"),
    taskBytes,
  };
}

function taskValues(
  options: ReturnType<typeof normalizeOptions>,
  task: NormalizedTask,
): unknown[] {
  return [
    options.namespace,
    task.tenant,
    task.owner,
    task.taskId,
    task.contextId,
    task.state,
    task.statusTimestamp,
    task.taskJson,
    task.taskSha256,
    task.taskBytes,
    options.ttlMs,
  ];
}

function normalizeListRequest(
  params: ListTasksRequest,
  scope: { tenant: string; owner: string },
) {
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
  return {
    pageSize,
    contextId,
    status,
    statusTimestampAfter,
    includeArtifacts,
    cursorScope,
    cursor: params.pageToken
      ? decodeCursor(params.pageToken, cursorScope)
      : undefined,
  };
}

function createTaskLockScope(namespace: string, task: NormalizedTask) {
  return JSON.stringify([namespace, task.tenant, task.owner, task.taskId]);
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

function decodeVerifiedTask(row: TaskRow): A2ATask {
  const digest = createHash("sha256").update(row.task_json).digest("hex");
  if (digest !== row.task_sha256) {
    throw taskStoreError(
      "A2A_TASK_STORE_CORRUPT",
      "A persisted A2A task failed its integrity check.",
    );
  }
  try {
    return Task.fromJSON(JSON.parse(row.task_json));
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

function normalizeOptions(raw: PostgresA2ATaskStoreOptions) {
  if (!raw.connectionString && !raw.pool) {
    throw taskStoreError(
      "A2A_TASK_STORE_POSTGRES_URL_REQUIRED",
      "The central A2A task store needs a PostgreSQL URL or injected pool.",
    );
  }
  return {
    ...raw,
    namespace: portableIdentifier(raw.namespace, "namespace", 128),
    ttlMs: boundedInteger(raw.ttlMs, 60_000, 365 * 24 * 60 * 60 * 1_000, "ttlMs"),
    maxEntries: boundedInteger(raw.maxEntries, 1, 1_000_000, "maxEntries"),
    maxEntriesPerOwner: boundedInteger(
      raw.maxEntriesPerOwner,
      1,
      raw.maxEntries,
      "maxEntriesPerOwner",
    ),
    maxTaskBytes: boundedInteger(raw.maxTaskBytes, 1_024, 32 * 1024 * 1024, "maxTaskBytes"),
    maxHistoryMessages: boundedInteger(raw.maxHistoryMessages, 1, 10_000, "maxHistoryMessages"),
    maxArtifacts: boundedInteger(raw.maxArtifacts, 1, 10_000, "maxArtifacts"),
    poolMax: boundedInteger(raw.poolMax, 1, 32, "poolMax"),
    statementTimeoutMs: boundedInteger(
      raw.statementTimeoutMs,
      100,
      30_000,
      "statementTimeoutMs",
    ),
    now: raw.now ?? Date.now,
  };
}

async function loadPool(
  options: ReturnType<typeof normalizeOptions>,
): Promise<A2ATaskStorePostgresPool> {
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => A2ATaskStorePostgresPool;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-system-a2a-task-store",
    allowExitOnIdle: true,
  });
}

function portableIdentifier(value: unknown, label: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw taskStoreError(
      "A2A_TASK_STORE_CONFIGURATION_INVALID",
      `The A2A task-store ${label} is invalid.`,
    );
  }
  return normalized;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw taskStoreError(
      "A2A_TASK_STORE_CONFIGURATION_INVALID",
      `The A2A task-store ${label} is outside its allowed range.`,
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

function isA2ATaskStoreError(
  error: unknown,
): error is Error & { code: string; category: "persistence" } {
  if (!(error instanceof Error)) return false;
  const candidate = error as { code?: unknown; category?: unknown };
  return candidate.category === "persistence"
    && typeof candidate.code === "string"
    && candidate.code.startsWith("A2A_TASK_STORE_");
}

function shouldDegradeStoreHealth(code: string) {
  return code === "A2A_TASK_STORE_UNAVAILABLE"
    || code === "A2A_TASK_STORE_CORRUPT"
    || code === "A2A_TASK_STORE_CLOSED";
}

export const postgresA2ATaskStoreInternals = Object.freeze({
  decodeCursor,
  encodeCursor,
  normalizeListRequest,
});
