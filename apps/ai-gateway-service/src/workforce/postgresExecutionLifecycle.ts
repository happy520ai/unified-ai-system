import { createHash } from "node:crypto";

import type {
  WorkforceClaimPostgresClient as PostgresClient,
  WorkforceClaimPostgresPool as PostgresPool,
} from "./postgresTaskClaimLease.ts";
import { createLogRedactor } from "./logRedactor.js";

export const POSTGRES_EXECUTION_STATUS = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  FORCE_STOPPED: "force_stopped",
});

type ExecutionStatus = typeof POSTGRES_EXECUTION_STATUS[keyof typeof POSTGRES_EXECUTION_STATUS];
type LifecycleState = Record<string, any> & {
  status: ExecutionStatus;
  currentAgentId: string | null;
  completedAgents: Array<Record<string, unknown>>;
  pendingAgents: string[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  transitions: Array<Record<string, unknown>>;
  cancelRequested: boolean;
  pauseRequested: boolean;
  forceStopRequested: boolean;
  metadata: Record<string, unknown>;
};

type LifecycleRow = {
  execution_digest: string;
  execution_fingerprint: string;
  status: ExecutionStatus;
  state_json: string;
  state_sha256: string;
  state_bytes: string | number;
  version: string | number;
  database_now?: string | Date;
};

export type PostgresExecutionLifecycleOptions = {
  pool: PostgresPool;
  namespace: string;
  retentionMs: number;
  maxExecutions: number;
  maxStateBytes: number;
  maxTransitions: number;
  maxCompletedAgents: number;
  now?: () => number;
};

const TABLE = "public.ai_gateway_workforce_execution_runs";
const INIT_LOCK_NAMESPACE = 1_431_193_308;
const INIT_LOCK_KEY = 1_768_841_208;
const CAPACITY_LOCK_NAMESPACE = 1_431_193_309;
const MAX_EXECUTION_ID_LENGTH = 512;
const MAX_AGENT_ID_LENGTH = 256;
const redactor = createLogRedactor() as {
  redactString(value: string): string;
  redactObject(value: unknown): unknown;
};

const VALID_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["paused", "completed", "failed", "cancelled", "force_stopped"],
  paused: ["running", "cancelled", "force_stopped"],
  completed: [],
  failed: ["pending"],
  cancelled: ["pending"],
  force_stopped: ["pending"],
};

const INITIALIZE_SQL = `/* workforce-control-lifecycle:init */
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    namespace TEXT NOT NULL,
    execution_digest CHAR(64) NOT NULL,
    execution_fingerprint CHAR(16) NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
      'pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'force_stopped'
    )),
    state_json TEXT NOT NULL,
    state_sha256 CHAR(64) NOT NULL,
    state_bytes INTEGER NOT NULL CHECK (state_bytes > 0),
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (namespace, execution_digest)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_run_status_idx
    ON ${TABLE} (namespace, status, updated_at);
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_run_expiry_idx
    ON ${TABLE} (namespace, expires_at);
`;

const SELECT_FIELDS = `
  execution_digest, execution_fingerprint, status,
  state_json, state_sha256, state_bytes, version
`;

export function createPostgresExecutionLifecycle(rawOptions: PostgresExecutionLifecycleOptions) {
  const options = normalizeOptions(rawOptions);
  let readyPromise: Promise<PostgresPool> | null = null;
  let available = false;
  let reason: string | null = "initializing";
  let activeExecutions = 0;
  let statsUpdatedAt: number | null = null;
  let totalFailures = 0;
  let lastFailureCode: string | null = null;

  void getReadyPool().catch(() => undefined);

  return {
    EXECUTION_STATUS: POSTGRES_EXECUTION_STATUS,

    getInfo() {
      return {
        module: "postgresExecutionLifecycle",
        version: "1.0.0",
        mode: "postgres-central",
        durable: true,
        distributed: true,
        activeExecutions,
        maxExecutions: options.maxExecutions,
        maxStateBytes: options.maxStateBytes,
        retentionMs: options.retentionMs,
        statusValues: Object.values(POSTGRES_EXECUTION_STATUS),
        rawExecutionIdStored: false,
      };
    },

    getHealth() {
      return healthSnapshot();
    },

    async checkHealth() {
      try {
        const pool = await getReadyPool();
        await refreshStats(pool);
      } catch (error) {
        markFailure(error);
      }
      return healthSnapshot();
    },

    async initialize(executionIdInput: unknown, metadataInput: Record<string, unknown> = {}) {
      const executionId = normalizeExecutionId(executionIdInput);
      const identity = executionIdentity(executionId);
      let client: PostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await client.query(
          "/* workforce-control-lifecycle:capacity-lock */ SELECT pg_advisory_xact_lock($1, hashtext($2))",
          [CAPACITY_LOCK_NAMESPACE, options.namespace],
        );
        await purgeExpired(client);
        const existing = await client.query(`/* workforce-control-lifecycle:existing */
          SELECT 1 FROM ${TABLE}
          WHERE namespace = $1 AND execution_digest = $2
          FOR UPDATE
        `, [options.namespace, identity.digest]);
        if (existing.rows[0]) {
          throw lifecycleError(
            "WORKFORCE_LIFECYCLE_ALREADY_EXISTS",
            "This execution lifecycle already exists.",
            409,
          );
        }
        const count = await client.query<{ count: string | number }>(`
          /* workforce-control-lifecycle:capacity */
          SELECT COUNT(*)::bigint AS count FROM ${TABLE}
          WHERE namespace = $1
        `, [options.namespace]);
        if (Number(count.rows[0]?.count ?? 0) >= options.maxExecutions) {
          throw lifecycleError(
            "WORKFORCE_LIFECYCLE_CAPACITY_REACHED",
            "The bounded central lifecycle store has reached capacity.",
            503,
          );
        }
        const nowResult = await client.query<{ database_now: string | Date }>(
          "/* workforce-control-lifecycle:clock */ SELECT clock_timestamp() AS database_now",
        );
        const timestamp = toIso(nowResult.rows[0].database_now);
        const state: LifecycleState = {
          status: "pending",
          currentAgentId: null,
          completedAgents: [],
          pendingAgents: [],
          startedAt: null,
          completedAt: null,
          createdAt: timestamp,
          transitions: [{ from: null, to: "pending", at: timestamp, reason: "执行生命周期已初始化" }],
          cancelRequested: false,
          pauseRequested: false,
          forceStopRequested: false,
          metadata: sanitizeMetadata(metadataInput),
        };
        const encoded = encodeState(state, options.maxStateBytes);
        await client.query(`/* workforce-control-lifecycle:insert */
          INSERT INTO ${TABLE} (
            namespace, execution_digest, execution_fingerprint, status,
            state_json, state_sha256, state_bytes, version, expires_at
          ) VALUES (
            $1, $2, $3, 'pending', $4, $5, $6, 1,
            clock_timestamp() + ($7::bigint * interval '1 millisecond')
          )
        `, [
          options.namespace,
          identity.digest,
          identity.fingerprint,
          encoded.json,
          encoded.sha256,
          encoded.bytes,
          options.retentionMs,
        ]);
        await client.query("COMMIT");
        markReady();
        return { success: true, planId: executionId, status: "pending", message: "执行生命周期已初始化" };
      } catch (error) {
        await rollback(client);
        throw normalizeStoreError(error, "The central execution lifecycle could not be initialized.");
      } finally {
        client?.release();
      }
    },

    async start(executionId: unknown) {
      return mutate(executionId, (state, timestamp) => {
        validateTransition(state, "running");
        transition(state, "running", "执行已启动", timestamp, options.maxTransitions);
        state.startedAt = timestamp;
        return { success: true, status: "running", startedAt: timestamp };
      });
    },

    async cancel(executionId: unknown, reasonInput: unknown = "") {
      const cancellationReason = redactor.redactString(String(reasonInput || "用户请求取消")).slice(0, 512);
      return mutate(executionId, (state, timestamp) => {
        validateTransition(state, "cancelled");
        if (state.status === "running") {
          state.cancelRequested = true;
          state.cancelReason = cancellationReason;
          state.cancelRequestedAt = timestamp;
          return {
            success: true,
            status: state.status,
            cancelRequested: true,
            message: "取消请求已设置，将在当前 Agent 完成后停止",
          };
        }
        transition(state, "cancelled", cancellationReason, timestamp, options.maxTransitions);
        state.completedAt = timestamp;
        state.cancelRequested = false;
        return { success: true, status: "cancelled", message: "执行已取消" };
      });
    },

    async pause(executionId: unknown, reasonInput: unknown = "") {
      const pauseReason = redactor.redactString(String(reasonInput || "用户请求暂停")).slice(0, 512);
      return mutate(executionId, (state, timestamp) => {
        validateTransition(state, "paused");
        if (state.status !== "running") {
          return { success: false, reason: `当前状态 ${state.status} 不支持暂停` };
        }
        state.pauseRequested = true;
        state.pauseReason = pauseReason;
        state.pauseRequestedAt = timestamp;
        return {
          success: true,
          status: state.status,
          pauseRequested: true,
          message: "暂停请求已设置，将在当前 Agent 完成后暂停",
        };
      });
    },

    async resume(executionId: unknown) {
      return mutate(executionId, (state, timestamp) => {
        validateTransition(state, "running");
        if (state.status !== "paused") {
          return { success: false, reason: `当前状态 ${state.status} 不支持恢复（仅 paused 状态可恢复）` };
        }
        transition(state, "running", "执行已从暂停状态恢复", timestamp, options.maxTransitions);
        state.pauseRequested = false;
        state.pauseReason = null;
        return { success: true, status: "running", message: "执行已恢复" };
      });
    },

    async onAgentCompleted(executionId: unknown, agentIdInput: unknown, resultInput: unknown = {}) {
      const agentId = normalizeAgentId(agentIdInput);
      return mutate(executionId, (state, timestamp) => {
        if (state.completedAgents.length >= options.maxCompletedAgents) {
          throw lifecycleError(
            "WORKFORCE_LIFECYCLE_AGENT_CAPACITY",
            "The bounded completed-agent history has reached capacity.",
            503,
          );
        }
        state.completedAgents.push({
          agentId,
          completedAt: timestamp,
          result: redactor.redactObject(resultInput),
        });
        state.currentAgentId = null;
        if (state.cancelRequested) {
          transition(state, "cancelled", `Agent ${agentId} 完成后执行已取消`, timestamp, options.maxTransitions);
          state.completedAt = timestamp;
          state.cancelRequested = false;
          return { success: true, action: "cancelled", status: "cancelled", message: "执行已取消" };
        }
        if (state.pauseRequested) {
          transition(state, "paused", `Agent ${agentId} 完成后执行已暂停`, timestamp, options.maxTransitions);
          state.pauseRequested = false;
          return { success: true, action: "paused", status: "paused", message: "执行已暂停" };
        }
        return { success: true, action: "continue", status: state.status, message: "继续执行下一个 Agent" };
      });
    },

    async complete(executionId: unknown, finalStatusInput?: unknown, summaryInput: unknown = {}) {
      const targetStatus = normalizeTerminalStatus(finalStatusInput ?? "completed");
      return mutate(executionId, (state, timestamp) => {
        validateTransition(state, targetStatus);
        transition(state, targetStatus, `执行已结束: ${targetStatus}`, timestamp, options.maxTransitions);
        state.completedAt = timestamp;
        state.summary = redactor.redactObject(summaryInput);
        return {
          success: true,
          status: targetStatus,
          completedAt: timestamp,
          completedAgents: state.completedAgents.length,
        };
      });
    },

    async forceStop(executionId: unknown, reasonInput: unknown = "") {
      const forceReason = redactor.redactString(String(reasonInput || "执行已强制终止")).slice(0, 512);
      return mutate(executionId, (state, timestamp) => {
        validateTransition(state, "force_stopped");
        transition(state, "force_stopped", forceReason, timestamp, options.maxTransitions);
        state.completedAt = timestamp;
        state.forceStopRequested = true;
        state.cancelRequested = false;
        state.pauseRequested = false;
        return { success: true, status: "force_stopped", message: "执行已强制终止" };
      });
    },

    async getStatus(executionIdInput: unknown) {
      const executionId = normalizeExecutionId(executionIdInput);
      const identity = executionIdentity(executionId);
      try {
        const pool = await getReadyPool();
        const result = await pool.query<LifecycleRow>(`/* workforce-control-lifecycle:get */
          SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
          FROM ${TABLE}
          WHERE namespace = $1 AND execution_digest = $2
            AND expires_at > clock_timestamp()
        `, [options.namespace, identity.digest]);
        markReady();
        if (!result.rows[0]) {
          return { success: false, planId: executionId, reason: "未找到该计划的执行记录" };
        }
        const state = decodeVerifiedState(result.rows[0], options.maxStateBytes);
        return statusProjection(executionId, state, Number(result.rows[0].version));
      } catch (error) {
        throw normalizeStoreError(error, "The central execution lifecycle could not be read.");
      }
    },

    async listActive() {
      try {
        const pool = await getReadyPool();
        const result = await pool.query<LifecycleRow>(`/* workforce-control-lifecycle:list-active */
          SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
          FROM ${TABLE}
          WHERE namespace = $1 AND status IN ('pending', 'running', 'paused')
            AND expires_at > clock_timestamp()
          ORDER BY updated_at ASC
          LIMIT $2
        `, [options.namespace, options.maxExecutions]);
        markReady();
        return {
          success: true,
          count: result.rows.length,
          executions: result.rows.map((row) => {
            const state = decodeVerifiedState(row, options.maxStateBytes);
            return {
              executionFingerprint: row.execution_fingerprint,
              status: state.status,
              currentAgentId: state.currentAgentId,
              completedAgents: state.completedAgents.length,
              startedAt: state.startedAt,
              version: Number(row.version),
            };
          }),
        };
      } catch (error) {
        throw normalizeStoreError(error, "The central active executions could not be listed.");
      }
    },

    async cleanup() {
      try {
        const pool = await getReadyPool();
        const deleted = await pool.query(`/* workforce-control-lifecycle:cleanup */
          DELETE FROM ${TABLE}
          WHERE namespace = $1 AND expires_at <= clock_timestamp()
        `, [options.namespace]);
        await refreshStats(pool);
        return { success: true, removedCount: Number(deleted.rowCount ?? 0), remainingCount: activeExecutions };
      } catch (error) {
        throw normalizeStoreError(error, "The central execution lifecycles could not be cleaned.");
      }
    },
  };

  async function mutate(
    executionIdInput: unknown,
    mutator: (state: LifecycleState, timestamp: string) => Record<string, unknown>,
  ) {
    const executionId = normalizeExecutionId(executionIdInput);
    const identity = executionIdentity(executionId);
    let client: PostgresClient | null = null;
    try {
      const pool = await getReadyPool();
      client = await pool.connect();
      await client.query("BEGIN");
      const selected = await client.query<LifecycleRow>(`/* workforce-control-lifecycle:lock */
        SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
        FROM ${TABLE}
        WHERE namespace = $1 AND execution_digest = $2
          AND expires_at > clock_timestamp()
        FOR UPDATE
      `, [options.namespace, identity.digest]);
      const row = selected.rows[0];
      if (!row) {
        throw lifecycleError("WORKFORCE_LIFECYCLE_NOT_FOUND", "The execution lifecycle was not found.", 404);
      }
      const state = decodeVerifiedState(row, options.maxStateBytes);
      const timestamp = toIso(row.database_now ?? new Date());
      const response = mutator(state, timestamp);
      const encoded = encodeState(state, options.maxStateBytes);
      const updated = await client.query(`/* workforce-control-lifecycle:update */
        UPDATE ${TABLE}
        SET status = $3, state_json = $4, state_sha256 = $5,
            state_bytes = $6, version = version + 1,
            updated_at = clock_timestamp(),
            expires_at = clock_timestamp() + ($7::bigint * interval '1 millisecond')
        WHERE namespace = $1 AND execution_digest = $2 AND version = $8::bigint
      `, [
        options.namespace,
        identity.digest,
        state.status,
        encoded.json,
        encoded.sha256,
        encoded.bytes,
        options.retentionMs,
        String(row.version),
      ]);
      if (Number(updated.rowCount ?? 0) !== 1) {
        throw lifecycleError(
          "WORKFORCE_LIFECYCLE_CONCURRENTLY_CHANGED",
          "The lifecycle changed before the transition could commit.",
          409,
        );
      }
      await client.query("COMMIT");
      markReady();
      return { ...response, planId: executionId };
    } catch (error) {
      await rollback(client);
      throw normalizeStoreError(error, "The central execution lifecycle transition failed.");
    } finally {
      client?.release();
    }
  }

  async function getReadyPool() {
    if (!readyPromise) {
      readyPromise = initializePool(options.pool).then(() => options.pool);
      void readyPromise.catch(() => undefined);
    }
    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      markFailure(error);
      throw error;
    }
  }

  async function initializePool(pool: PostgresPool) {
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query(
        "/* workforce-control-lifecycle:init-lock */ SELECT pg_advisory_lock($1, $2)",
        [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
      );
      locked = true;
      await client.query(INITIALIZE_SQL);
      markReady();
    } finally {
      if (locked) {
        await client.query(
          "/* workforce-control-lifecycle:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
          [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
        ).catch(() => undefined);
      }
      client.release();
    }
  }

  async function purgeExpired(client: PostgresClient) {
    await client.query(`/* workforce-control-lifecycle:purge-expired */
      DELETE FROM ${TABLE}
      WHERE namespace = $1 AND expires_at <= clock_timestamp()
    `, [options.namespace]);
  }

  async function refreshStats(pool: PostgresPool) {
    const result = await pool.query<{ count: string | number }>(`
      /* workforce-control-lifecycle:stats */
      SELECT COUNT(*)::bigint AS count FROM ${TABLE}
      WHERE namespace = $1 AND status IN ('pending', 'running', 'paused')
        AND expires_at > clock_timestamp()
    `, [options.namespace]);
    activeExecutions = Number(result.rows[0]?.count ?? 0);
    statsUpdatedAt = options.now();
    markReady();
  }

  function healthSnapshot() {
    return {
      mode: "postgres-central",
      durable: true,
      distributed: true,
      available,
      reason,
      activeExecutions,
      maxExecutions: options.maxExecutions,
      maxStateBytes: options.maxStateBytes,
      statsUpdatedAt,
      totalFailures,
      lastFailureCode,
      rawExecutionIdStored: false,
    };
  }

  function markReady() {
    available = true;
    reason = null;
  }

  function markFailure(error: unknown) {
    available = false;
    reason = "store_unavailable";
    totalFailures += 1;
    lastFailureCode = typeof (error as any)?.code === "string"
      ? (error as any).code
      : "WORKFORCE_LIFECYCLE_STORE_UNAVAILABLE";
  }

  function normalizeStoreError(error: unknown, message: string): Error {
    if (isLifecycleError(error)) {
      if ((error as any).code === "WORKFORCE_LIFECYCLE_STATE_CORRUPT") markFailure(error);
      return error as Error;
    }
    markFailure(error);
    return lifecycleError("WORKFORCE_LIFECYCLE_STORE_UNAVAILABLE", message, 503);
  }
}

function normalizeOptions(options: PostgresExecutionLifecycleOptions) {
  return {
    ...options,
    namespace: normalizePortableIdentifier(options.namespace),
    retentionMs: boundedInteger(options.retentionMs, 30 * 24 * 60 * 60_000, 60_000, 365 * 24 * 60 * 60_000),
    maxExecutions: boundedInteger(options.maxExecutions, 10_000, 1, 1_000_000),
    maxStateBytes: boundedInteger(options.maxStateBytes, 1024 * 1024, 4_096, 16 * 1024 * 1024),
    maxTransitions: boundedInteger(options.maxTransitions, 1_000, 10, 10_000),
    maxCompletedAgents: boundedInteger(options.maxCompletedAgents, 1_000, 1, 10_000),
    now: options.now ?? Date.now,
  };
}

function encodeState(state: LifecycleState, maxStateBytes: number) {
  const sanitized = redactor.redactObject(state);
  let json: string;
  try {
    json = JSON.stringify(sanitized);
  } catch {
    throw lifecycleError("WORKFORCE_LIFECYCLE_STATE_INVALID", "The lifecycle state is not serializable.", 400);
  }
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes <= 0 || bytes > maxStateBytes) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_TOO_LARGE", "The lifecycle state exceeds its bounded size.", 413);
  }
  return { json, bytes, sha256: digestText(json) };
}

function decodeVerifiedState(row: LifecycleRow, maxStateBytes: number): LifecycleState {
  const bytes = Buffer.byteLength(row.state_json, "utf8");
  if (bytes !== Number(row.state_bytes) || bytes <= 0 || bytes > maxStateBytes) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_STATE_CORRUPT", "The lifecycle byte count is invalid.", 503);
  }
  if (digestText(row.state_json) !== row.state_sha256) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_STATE_CORRUPT", "The lifecycle state digest does not match.", 503);
  }
  let state: LifecycleState;
  try {
    state = JSON.parse(row.state_json) as LifecycleState;
  } catch {
    throw lifecycleError("WORKFORCE_LIFECYCLE_STATE_CORRUPT", "The lifecycle state is invalid JSON.", 503);
  }
  if (!state || state.status !== row.status || !Array.isArray(state.transitions) || !Array.isArray(state.completedAgents)) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_STATE_CORRUPT", "The lifecycle row metadata is inconsistent.", 503);
  }
  return state;
}

function validateTransition(state: LifecycleState, targetStatus: ExecutionStatus) {
  const allowed = VALID_TRANSITIONS[state.status] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw lifecycleError(
      "WORKFORCE_LIFECYCLE_TRANSITION_INVALID",
      `Invalid lifecycle transition: ${state.status} -> ${targetStatus}.`,
      409,
    );
  }
}

function transition(
  state: LifecycleState,
  targetStatus: ExecutionStatus,
  reason: string,
  timestamp: string,
  maxTransitions: number,
) {
  if (state.transitions.length >= maxTransitions) {
    throw lifecycleError(
      "WORKFORCE_LIFECYCLE_TRANSITION_CAPACITY",
      "The bounded lifecycle transition history has reached capacity.",
      503,
    );
  }
  state.transitions.push({ from: state.status, to: targetStatus, at: timestamp, reason });
  state.status = targetStatus;
}

function statusProjection(executionId: string, state: LifecycleState, version: number) {
  return {
    success: true,
    planId: executionId,
    status: state.status,
    currentAgentId: state.currentAgentId,
    completedAgents: state.completedAgents.length,
    cancelRequested: state.cancelRequested,
    pauseRequested: state.pauseRequested,
    forceStopRequested: state.forceStopRequested,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    transitions: state.transitions,
    tenantFingerprint: state.metadata?.tenantFingerprint ?? null,
    subjectFingerprint: state.metadata?.subjectFingerprint ?? null,
    version,
  };
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return redactor.redactObject(value) as Record<string, unknown>;
}

function executionIdentity(executionId: string) {
  const digest = digestText(`workforce-execution/v1\u0000${executionId}`);
  return { digest, fingerprint: digest.slice(0, 16) };
}

function normalizeExecutionId(value: unknown) {
  if (typeof value !== "string") {
    throw lifecycleError("WORKFORCE_LIFECYCLE_ID_INVALID", "The execution ID must be a string.", 400);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_EXECUTION_ID_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_ID_INVALID", "The execution ID is invalid.", 400);
  }
  return normalized;
}

function normalizeAgentId(value: unknown) {
  if (typeof value !== "string") {
    throw lifecycleError("WORKFORCE_LIFECYCLE_AGENT_INVALID", "The agent ID must be a string.", 400);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_AGENT_ID_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_AGENT_INVALID", "The agent ID is invalid.", 400);
  }
  return normalized;
}

function normalizeTerminalStatus(value: unknown): ExecutionStatus {
  const status = String(value ?? "").trim() as ExecutionStatus;
  if (!new Set<ExecutionStatus>(["completed", "failed", "cancelled", "force_stopped"]).has(status)) {
    throw lifecycleError("WORKFORCE_LIFECYCLE_STATUS_INVALID", "The terminal lifecycle status is invalid.", 400);
  }
  return status;
}

function normalizePortableIdentifier(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw lifecycleError("WORKFORCE_CONTROL_NAMESPACE_INVALID", "The control namespace is invalid.", 400);
  }
  return normalized;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function digestText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function toIso(value: string | Date) {
  return new Date(value).toISOString();
}

async function rollback(client: PostgresClient | null) {
  if (!client) return;
  await client.query("ROLLBACK").catch(() => undefined);
}

function lifecycleError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code, category: "lifecycle" as const, statusCode });
}

function isLifecycleError(error: unknown) {
  return error instanceof Error
    && typeof (error as any).code === "string"
    && Number.isInteger((error as any).statusCode);
}
