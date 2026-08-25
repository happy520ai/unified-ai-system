import { createHash } from "node:crypto";

import { MAX_QUEUE_SIZE, PRIORITY_LEVELS, TASK_STATUS } from "./taskQueueConstants.js";
import {
  buildTaskRecord,
  computeSLACompliance,
  computeStats,
  normalizePriority,
} from "./taskQueueHelpers.js";
import { createWorkforceTaskClaimManager } from "./workforceTaskClaimManager.ts";
import type {
  WorkforceClaimPostgresClient,
  WorkforceClaimPostgresPool,
} from "./postgresTaskClaimLease.ts";

export type WorkforceQueuePostgresPool = WorkforceClaimPostgresPool;
type WorkforceQueuePostgresClient = WorkforceClaimPostgresClient;
type RuntimeEnv = Record<string, string | undefined>;

type QueueTask = Record<string, any> & {
  taskId: string;
  planId: string;
  claimPlanId: string;
  tenantId: string;
  ownerId: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  claim: Record<string, any> | null;
};

type TaskRow = {
  task_id: string;
  tenant_id: string;
  owner_id: string;
  plan_id: string;
  claim_plan_id: string;
  priority: string;
  priority_rank: string | number;
  status: string;
  assigned_to: string | null;
  fencing_token: string | number | null;
  task_json: string;
  task_sha256: string;
  task_bytes: string | number;
  database_now?: string | Date;
};

type ClaimManager = ReturnType<typeof createWorkforceTaskClaimManager>;

export type PostgresWorkforceTaskQueueOptions = {
  env: RuntimeEnv;
  connectionString?: string;
  pool?: WorkforceQueuePostgresPool;
  claimManager?: Record<string, unknown>;
  namespace: string;
  claimNamespace: string;
  claimTtlMs: number;
  retentionMs: number;
  maxEntries: number;
  maxTaskBytes: number;
  poolMax: number;
  statementTimeoutMs: number;
  now: () => number;
};

const TASKS_TABLE = "public.ai_gateway_workforce_tasks";
const CLAIMS_TABLE = "public.ai_gateway_workforce_task_claims";
const INIT_LOCK_NAMESPACE = 1_431_193_304;
const INIT_LOCK_KEY = 1_768_841_204;
const CAPACITY_LOCK_NAMESPACE = 1_431_193_305;
const MAX_ID_LENGTH = 256;
const MAX_TOKEN_LENGTH = 512;
const MAX_SANITIZE_DEPTH = 32;
const MAX_SANITIZE_NODES = 20_000;

const INITIALIZE_SQL = `/* workforce-queue:init */
  CREATE TABLE IF NOT EXISTS ${TASKS_TABLE} (
    namespace TEXT NOT NULL,
    task_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    claim_plan_id TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4', 'P5')),
    priority_rank SMALLINT NOT NULL CHECK (priority_rank >= 1 AND priority_rank <= 5),
    status TEXT NOT NULL CHECK (status IN (
      'queued', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled'
    )),
    assigned_to TEXT,
    fencing_token BIGINT,
    claim_fingerprint CHAR(16),
    task_json TEXT NOT NULL,
    task_sha256 CHAR(64) NOT NULL CHECK (task_sha256 ~ '^[a-f0-9]{64}$'),
    task_bytes INTEGER NOT NULL CHECK (task_bytes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (namespace, task_id)
  );
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_queue_order_idx
    ON ${TASKS_TABLE} (namespace, status, priority_rank, created_at, task_id);
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_queue_plan_idx
    ON ${TASKS_TABLE} (namespace, tenant_id, owner_id, plan_id, status);
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_queue_agent_idx
    ON ${TASKS_TABLE} (namespace, assigned_to, status);
  CREATE INDEX IF NOT EXISTS ai_gateway_workforce_queue_expiry_idx
    ON ${TASKS_TABLE} (namespace, expires_at);
`;

const SELECT_FIELDS = `
  task_id, tenant_id, owner_id, plan_id, claim_plan_id, priority,
  priority_rank, status, assigned_to, fencing_token,
  task_json, task_sha256, task_bytes
`;

export function createPostgresWorkforceTaskQueue(
  options: PostgresWorkforceTaskQueueOptions,
) {
  const ownsPool = !options.pool;
  const poolPromise = options.pool
    ? Promise.resolve(options.pool)
    : loadPool(options);
  const claimManager = (options.claimManager ?? createWorkforceTaskClaimManager({
    env: options.env,
    ttlMs: options.claimTtlMs,
    maxClaims: options.maxEntries,
    clock: options.now,
  })) as ClaimManager;
  let readyPromise: Promise<WorkforceQueuePostgresPool> | null = null;
  let closed = false;
  let available = false;
  let reason: string | null = "initializing";
  let totalFailures = 0;
  let lastFailureCode: string | null = null;
  let statsUpdatedAt: number | null = null;
  let cachedCounts = emptyCounts();

  void poolPromise.then((pool) => {
    pool.on?.("error", () => markFailure(queueError(
      "WORKFORCE_QUEUE_STORE_UNAVAILABLE",
      "The central Workforce queue pool reported an error.",
      503,
    )));
  }).catch((error) => markFailure(error));
  void getReadyPool().catch(() => undefined);

  return {
    async init() {
      const pool = await getReadyPool();
      await assertClaimStoreAvailable();
      await recoverOrphanedTasks(pool, options, options.maxEntries);
      await refreshStats(pool);
      return this.getQueueStatus();
    },

    async enqueue(task: Record<string, unknown>) {
      const [record] = await this.enqueueMany([task]);
      return record;
    },

    async enqueueMany(tasks: Array<Record<string, unknown>>) {
      if (!Array.isArray(tasks) || tasks.length === 0) return [];
      if (tasks.length > MAX_QUEUE_SIZE) {
        throw queueError("TASK_QUEUE_FULL", `A single enqueue is limited to ${MAX_QUEUE_SIZE} tasks.`, 503);
      }
      const records = tasks.map((task) => normalizeNewTask(buildTaskRecord(task) as QueueTask, options));
      const encoded = records.map((task) => encodeTask(task, options.maxTaskBytes));
      let client: WorkforceQueuePostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await lockNamespaceCapacity(client, options.namespace);
        await purgeExpired(client);
        const count = await client.query<{ count: string | number }>(`
          /* workforce-queue:capacity */
          SELECT COUNT(*)::bigint AS count FROM ${TASKS_TABLE}
          WHERE namespace = $1
        `, [options.namespace]);
        if (Number(count.rows[0]?.count ?? 0) + records.length > options.maxEntries) {
          throw queueError(
            "TASK_QUEUE_FULL",
            `The central queue is full (max ${options.maxEntries} retained tasks).`,
            503,
          );
        }
        for (let index = 0; index < records.length; index += 1) {
          const task = records[index];
          const payload = encoded[index];
          await client.query(`/* workforce-queue:enqueue */
            INSERT INTO ${TASKS_TABLE} (
              namespace, task_id, tenant_id, owner_id, plan_id, claim_plan_id,
              priority, priority_rank, status, assigned_to, fencing_token,
              claim_fingerprint, task_json, task_sha256, task_bytes, expires_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 'queued', NULL, NULL,
              NULL, $9, $10, $11,
              clock_timestamp() + ($12::bigint * interval '1 millisecond')
            )
          `, [
            options.namespace,
            task.taskId,
            task.tenantId,
            task.ownerId,
            task.planId,
            task.claimPlanId,
            task.priority,
            priorityRank(task.priority),
            payload.json,
            payload.sha256,
            payload.bytes,
            options.retentionMs,
          ]);
        }
        await client.query("COMMIT");
        markReady();
        return records.map(clonePersistedTask);
      } catch (error) {
        await rollback(client);
        throw normalizeStoreError(error, "The central Workforce queue could not enqueue tasks.");
      } finally {
        client?.release();
      }
    },

    async claimTask(agentIdInput: unknown, claimOptions: Record<string, any> = {}) {
      const agentId = normalizeId(agentIdInput, "agentId");
      const requestedTaskId = optionalId(claimOptions.taskId, "taskId");
      const requestedPlanId = optionalId(claimOptions.planId, "planId");
      const tenantId = optionalId(claimOptions.tenantId, "tenantId");
      const ownerId = optionalId(claimOptions.ownerId, "ownerId");
      if (!requestedTaskId && (!tenantId || !ownerId)) {
        throw queueError(
          "TASK_SCOPE_REQUIRED",
          "Central queue claims without an exact task ID require a tenant and owner scope.",
          400,
        );
      }
      const maxConcurrent = Math.max(1, Math.min(1_000, Math.floor(Number(claimOptions.maxConcurrent) || 5)));
      const ttlMs = Math.max(10, Math.min(24 * 60 * 60_000, Math.floor(Number(claimOptions.ttlMs) || options.claimTtlMs)));
      await assertClaimStoreAvailable();
      let client: WorkforceQueuePostgresClient | null = null;
      let issued: any = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        await recoverOrphansInTransaction(client, options, 100);
        const selected = await client.query<TaskRow>(`/* workforce-queue:claim-select */
          SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
          FROM ${TASKS_TABLE}
          WHERE namespace = $1 AND status = 'queued'
            AND ($2::text = '' OR task_id = $2)
            AND ($3::text = '' OR plan_id = $3)
            AND ($4::text = '' OR tenant_id = $4)
            AND ($5::text = '' OR owner_id = $5)
          ORDER BY priority_rank ASC, created_at ASC, task_id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `, [
          options.namespace,
          requestedTaskId ?? "",
          requestedPlanId ?? "",
          tenantId ?? "",
          ownerId ?? "",
        ]);
        const row = selected.rows[0];
        if (!row) {
          await client.query("COMMIT");
          markReady();
          return null;
        }
        const task = decodeVerifiedTask(row);
        const active = await client.query<{ count: string | number }>(`
          /* workforce-queue:agent-active-count */
          SELECT COUNT(*)::bigint AS count FROM ${TASKS_TABLE}
          WHERE namespace = $1 AND claim_plan_id = $2 AND assigned_to = $3
            AND status IN ('assigned', 'in_progress')
        `, [options.namespace, task.claimPlanId, agentId]);
        if (Number(active.rows[0]?.count ?? 0) >= maxConcurrent) {
          await client.query("COMMIT");
          markReady();
          return null;
        }
        issued = await claimManager.issue({
          planId: task.claimPlanId,
          taskId: task.taskId,
          agentId,
          ttlMs,
        });
        if (!issued?.success) {
          const unavailable = issued?.code === "TASK_CLAIM_STORE_UNAVAILABLE"
            || issued?.code === "TASK_CLAIM_CAPACITY";
          throw queueError(
            issued?.code ?? "TASK_CLAIM_FAILED",
            issued?.reason ?? "The fenced task claim could not be issued.",
            unavailable ? 503 : 409,
          );
        }
        const timestamp = toIso(row.database_now ?? new Date());
        Object.assign(task, {
          status: TASK_STATUS.ASSIGNED,
          assignedTo: agentId,
          startedAt: timestamp,
          updatedAt: timestamp,
          claim: issued.record,
        });
        await updateTaskRow(client, task, options, null);
        await client.query("COMMIT");
        markReady();
        return { ...clonePersistedTask(task), claimToken: issued.token };
      } catch (error) {
        await rollback(client);
        if (issued?.success && issued?.token) {
          try {
            await claimManager.revoke(issued.token, "queue_claim_commit_failed");
          } catch {
            // The claim expires under the database clock even if cleanup fails.
          }
        }
        throw normalizeStoreError(error, "The central Workforce queue could not claim a task.");
      } finally {
        client?.release();
      }
    },

    async updateTaskStatus(taskId: unknown, status: string, result?: unknown, ownership: Record<string, unknown> = {}) {
      if (status === TASK_STATUS.CANCELLED) return this.cancelTask(taskId, (result as any)?.reason ?? result);
      if (status === TASK_STATUS.COMPLETED) return this.completeTask(taskId, result, ownership);
      if (status === TASK_STATUS.FAILED) return this.failTask(taskId, (result as any)?.error ?? result, ownership);
      if (status !== TASK_STATUS.IN_PROGRESS) {
        throw queueError("TASK_TRANSITION_INVALID", `Unsupported central task transition to ${status}.`);
      }
      return mutateOwnedTask(taskId, ownership, (task, timestamp) => {
        if (task.status !== TASK_STATUS.ASSIGNED) {
          throw queueError("TASK_TRANSITION_INVALID", `Invalid status transition: ${task.status} -> ${status}.`);
        }
        task.status = TASK_STATUS.IN_PROGRESS;
        task.updatedAt = timestamp;
        if (result !== undefined) task.result = result;
      }, false);
    },

    async completeTask(taskId: unknown, result: unknown, ownership: Record<string, unknown> = {}) {
      return mutateOwnedTask(taskId, ownership, (task, timestamp) => {
        task.status = TASK_STATUS.COMPLETED;
        task.completedAt = timestamp;
        task.updatedAt = timestamp;
        task.result = result ?? {};
        task.claim = task.claim ? { ...task.claim, status: "released", releasedAt: timestamp } : null;
      }, true);
    },

    async failTask(taskId: unknown, error: unknown, ownership: Record<string, unknown> = {}) {
      return mutateOwnedTask(taskId, ownership, (task, timestamp) => {
        task.status = TASK_STATUS.FAILED;
        task.completedAt = timestamp;
        task.updatedAt = timestamp;
        task.error = (error instanceof Error ? error.message : String(error ?? "Task failed.")).slice(0, 2_000);
        task.retryCount = Number(task.retryCount ?? 0) + 1;
        task.claim = task.claim ? { ...task.claim, status: "released", releasedAt: timestamp } : null;
      }, true);
    },

    async cancelTask(taskIdInput: unknown, reasonInput: unknown = "cancelled_by_gateway") {
      const taskId = normalizeId(taskIdInput, "taskId");
      const cancelReason = String(reasonInput || "cancelled_by_gateway").slice(0, 512);
      let client: WorkforceQueuePostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        const row = await selectTaskForUpdate(client, options.namespace, taskId);
        if (!row) throw queueError("TASK_NOT_FOUND", `Task not found: ${taskId}`, 404);
        const task = decodeVerifiedTask(row);
        if (isTerminal(task.status)) {
          throw queueError("TASK_TRANSITION_INVALID", "A terminal task cannot be cancelled.");
        }
        const timestamp = toIso(row.database_now ?? new Date());
        if (task.claim) {
          await client.query(`/* workforce-queue:cancel-claim */
            DELETE FROM ${CLAIMS_TABLE}
            WHERE namespace = $1 AND plan_id = $2 AND task_id = $3
          `, [options.claimNamespace, task.claimPlanId, task.taskId]);
        }
        task.status = TASK_STATUS.CANCELLED;
        task.completedAt = timestamp;
        task.updatedAt = timestamp;
        task.error = cancelReason;
        task.claim = task.claim ? { ...task.claim, status: "revoked", revokedAt: timestamp } : null;
        await updateTaskRow(client, task, options, timestamp);
        await client.query("COMMIT");
        markReady();
        return clonePersistedTask(task);
      } catch (error) {
        await rollback(client);
        throw normalizeStoreError(error, "The central Workforce queue could not cancel the task.");
      } finally {
        client?.release();
      }
    },

    async renewTaskClaim(taskIdInput: unknown, ownership: Record<string, unknown> = {}, extendMs?: number) {
      const taskId = normalizeId(taskIdInput, "taskId");
      const task = await loadTask(taskId);
      if (!task || !isActive(task.status)) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
      assertOwnershipShape(task, ownership);
      const renewed = await claimManager.renew(
        ownership.claimToken,
        claimContext(task),
        extendMs,
      );
      if (!renewed?.success) {
        const failure = renewed as { code?: string; reason?: string };
        throw queueError(
          failure.code === "TASK_CLAIM_STORE_UNAVAILABLE" ? failure.code : "TASK_CLAIM_RENEW_FAILED",
          failure.reason ?? "Task claim renewal failed.",
          failure.code === "TASK_CLAIM_STORE_UNAVAILABLE" ? 503 : 409,
        );
      }
      const updated = await mutateOwnedTask(taskId, ownership, (current, timestamp) => {
        current.claim = renewed.record;
        current.updatedAt = timestamp;
      }, false);
      return { success: true, claim: { ...updated.claim } };
    },

    async assertTaskClaimActive(taskIdInput: unknown, ownership: Record<string, any> = {}) {
      const taskId = normalizeId(taskIdInput, "taskId");
      const task = await loadTask(taskId);
      if (!task || !isActive(task.status)) {
        throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
      }
      assertOwnershipShape(task, ownership);
      const validation = await claimManager.validate(ownership.claimToken, claimContext(task));
      if (!validation?.valid) {
        const failure = validation as { code?: string; reason?: string };
        throw queueError(
          failure.code === "TASK_CLAIM_STORE_UNAVAILABLE"
            ? failure.code
            : "TASK_CLAIM_INVALID",
          failure.reason ?? "The task claim is inactive.",
          failure.code === "TASK_CLAIM_STORE_UNAVAILABLE" ? 503 : 409,
        );
      }
      return {
        active: true,
        taskId: task.taskId,
        agentId: task.assignedTo,
        fencingToken: task.claim?.fencingToken,
      };
    },

    async requeueTask(taskIdInput: unknown) {
      const taskId = normalizeId(taskIdInput, "taskId");
      let client: WorkforceQueuePostgresClient | null = null;
      try {
        const pool = await getReadyPool();
        client = await pool.connect();
        await client.query("BEGIN");
        const row = await selectTaskForUpdate(client, options.namespace, taskId);
        if (!row) throw queueError("TASK_FAILED_NOT_FOUND", `Failed task not found: ${taskId}`, 404);
        const task = decodeVerifiedTask(row);
        if (task.status !== TASK_STATUS.FAILED) {
          throw queueError("TASK_FAILED_NOT_FOUND", `Failed task not found: ${taskId}`, 404);
        }
        if (Number(task.retryCount ?? 0) >= Number(task.maxRetries ?? 3)) {
          throw queueError("TASK_RETRIES_EXHAUSTED", `Task ${taskId} has exhausted retries.`);
        }
        const timestamp = toIso(row.database_now ?? new Date());
        Object.assign(task, {
          status: TASK_STATUS.QUEUED,
          assignedTo: null,
          startedAt: null,
          completedAt: null,
          error: null,
          result: null,
          claim: null,
          updatedAt: timestamp,
        });
        await updateTaskRow(client, task, options, null);
        await client.query("COMMIT");
        markReady();
        return clonePersistedTask(task);
      } catch (error) {
        await rollback(client);
        throw normalizeStoreError(error, "The central Workforce queue could not requeue the task.");
      } finally {
        client?.release();
      }
    },

    async autoAssign(assignOptions: Record<string, any> = {}) {
      const tenantId = normalizeId(assignOptions.tenantId, "tenantId");
      const ownerId = normalizeId(assignOptions.ownerId, "ownerId");
      const agentIds = (Array.isArray(assignOptions.agentIds) && assignOptions.agentIds.length > 0
        ? assignOptions.agentIds
        : ["agent-alpha", "agent-beta", "agent-gamma"])
        .map((agentId: unknown) => normalizeId(agentId, "agentId"));
      const maxConcurrent = Math.max(1, Math.min(1_000, Math.floor(Number(assignOptions.maxConcurrentPerAgent) || 5)));
      const assignments: Array<Record<string, unknown>> = [];
      let cursor = 0;
      while (assignments.length < options.maxEntries) {
        let claimed: any = null;
        for (let attempts = 0; attempts < agentIds.length && !claimed; attempts += 1) {
          const agentId = agentIds[cursor % agentIds.length];
          cursor += 1;
          claimed = await this.claimTask(agentId, { tenantId, ownerId, maxConcurrent, ttlMs: assignOptions.ttlMs });
        }
        if (!claimed) break;
        assignments.push({
          taskId: claimed.taskId,
          title: claimed.title,
          priority: claimed.priority,
          agentId: claimed.assignedTo,
          claimToken: claimed.claimToken,
          fencingToken: claimed.claim?.fencingToken,
          expiresAt: claimed.claim?.expiresAt,
        });
      }
      const status = await this.getQueueStatus({ tenantId, ownerId });
      return {
        assigned: assignments.length,
        assignments,
        unassigned: status.totalQueued,
        agentsUsed: new Set(assignments.map((entry) => entry.agentId)).size,
        claimEnforced: true,
      };
    },

    getInfo() {
      return {
        module: "postgresWorkforceTaskQueue",
        version: "1.0.0",
        persistence: "postgres-central-fenced",
        durable: true,
        distributed: true,
        claimEnforced: true,
        atomicTerminalFence: true,
        rawTokenRetained: false,
        namespace: options.namespace,
        retentionMs: options.retentionMs,
        maxEntries: options.maxEntries,
        maxTaskBytes: options.maxTaskBytes,
        claimManager: claimManager.getInfo(),
      };
    },

    async getClaimHealth() {
      return claimManager.checkHealth?.() ?? claimManager.getInfo();
    },

    getQueueHealth() {
      return queueHealth();
    },

    async checkQueueHealth() {
      try {
        const pool = await getReadyPool();
        await refreshStats(pool);
      } catch (error) {
        markFailure(error);
      }
      return queueHealth();
    },

    async getQueueStatus(scope: Record<string, unknown> = {}) {
      const pool = await getReadyPool();
      const filter = normalizeScopeFilter(scope);
      const values: unknown[] = [options.namespace];
      const clauses = ["namespace = $1", ...scopeClauses(filter, values)];
      const rows = await pool.query<{ status: string; priority: string; count: string | number }>(`
        /* workforce-queue:status */
        SELECT status, priority, COUNT(*)::bigint AS count
        FROM ${TASKS_TABLE}
        WHERE ${clauses.join(" AND ")} AND expires_at > clock_timestamp()
        GROUP BY status, priority
      `, values);
      markReady();
      const counts = emptyCounts();
      const byPriority = Object.fromEntries(Object.keys(PRIORITY_LEVELS).map((key) => [key, 0]));
      for (const row of rows.rows) {
        const count = Number(row.count);
        addStatusCount(counts, row.status, count);
        if (row.status === TASK_STATUS.QUEUED && row.priority in byPriority) byPriority[row.priority] += count;
      }
      return {
        ...counts,
        activeClaims: counts.totalActive,
        claimEnforced: true,
        byPriority,
        agents: await countAgents(pool, clauses, values),
        timestamp: new Date(options.now()).toISOString(),
      };
    },

    async getTasksByPriority(priorityInput: unknown, scope: Record<string, unknown> = {}) {
      const priority = normalizePriority(typeof priorityInput === "string" ? priorityInput : undefined);
      const filter = requireScopeFilter(scope);
      const tasks = await listTasks({ ...filter, priority });
      return {
        priority,
        queued: tasks.filter((task) => task.status === TASK_STATUS.QUEUED),
        active: tasks.filter((task) => isActive(task.status)),
        completed: tasks.filter((task) => isTerminal(task.status)),
      };
    },

    async getAgentWorkload(agentIdInput: unknown, scope: Record<string, unknown> = {}) {
      const agentId = normalizeId(agentIdInput, "agentId");
      const filter = requireScopeFilter(scope);
      const tasks = (await listTasks(filter)).filter((task) => task.assignedTo === agentId);
      const active = tasks.filter((task) => isActive(task.status));
      const completed = tasks.filter((task) => task.status === TASK_STATUS.COMPLETED);
      const failed = tasks.filter((task) => task.status === TASK_STATUS.FAILED);
      return {
        agentId,
        activeTasks: active.length,
        completedTasks: completed.length,
        failedTasks: failed.length,
        totalAssigned: tasks.length,
        active,
        recentCompleted: completed.slice(-5),
      };
    },

    async checkSLACompliance(scope: Record<string, unknown> = {}) {
      const filter = requireScopeFilter(scope);
      const tasks = await listTasks(filter);
      const { breaches, atRisk } = computeSLACompliance(
        tasks.filter((task) => task.status === TASK_STATUS.QUEUED),
        tasks.filter((task) => isActive(task.status)),
      );
      return { compliant: breaches.length === 0, breaches, atRisk, checkedAt: new Date(options.now()).toISOString() };
    },

    async getStats(scope: Record<string, unknown> = {}) {
      const filter = normalizeScopeFilter(scope);
      const tasks = await listTasks(filter);
      const queued = tasks.filter((task) => task.status === TASK_STATUS.QUEUED);
      const active = tasks.filter((task) => isActive(task.status));
      const completed = tasks.filter((task) => isTerminal(task.status));
      const agents = new Set(tasks.map((task) => task.assignedTo).filter(Boolean)).size;
      return {
        ...computeStats(queued, active, completed, agents),
        claims: claimManager.getInfo(),
        timestamp: new Date(options.now()).toISOString(),
      };
    },

    async persist() {
      // Every central mutation is already committed transactionally.
    },

    async close() {
      if (closed) return;
      closed = true;
      await claimManager.close?.();
      if (!ownsPool) return;
      try {
        const pool = await poolPromise;
        await pool.end();
      } catch {
        // Initialization failure leaves no required shutdown work.
      }
    },
  };

  async function mutateOwnedTask(
    taskIdInput: unknown,
    ownership: Record<string, any>,
    mutate: (task: QueueTask, timestamp: string) => void,
    terminal: boolean,
  ) {
    const taskId = normalizeId(taskIdInput, "taskId");
    let client: WorkforceQueuePostgresClient | null = null;
    try {
      const pool = await getReadyPool();
      client = await pool.connect();
      await client.query("BEGIN");
      const row = await selectTaskForUpdate(client, options.namespace, taskId);
      if (!row) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
      const task = decodeVerifiedTask(row);
      if (!isActive(task.status)) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
      assertOwnershipShape(task, ownership);
      const tokenDigest = digestToken(ownership.claimToken);
      const claim = await client.query<{ fencing_token: string | number }>(`
        /* workforce-queue:validate-fence */
        SELECT fencing_token FROM ${CLAIMS_TABLE}
        WHERE namespace = $1 AND token_digest = $2
          AND plan_id = $3 AND task_id = $4 AND agent_id = $5
          AND fencing_token = $6::bigint
          AND expires_at > clock_timestamp()
        FOR UPDATE
      `, [
        options.claimNamespace,
        tokenDigest,
        task.claimPlanId,
        task.taskId,
        task.assignedTo,
        String(task.claim?.fencingToken ?? ""),
      ]);
      if (!claim.rows[0]) {
        throw queueError("TASK_CLAIM_INVALID", "The fenced task claim is missing, expired, revoked, or stale.", 403);
      }
      const timestamp = toIso(row.database_now ?? new Date());
      mutate(task, timestamp);
      if (terminal) {
        const deleted = await client.query(`/* workforce-queue:terminal-release */
          DELETE FROM ${CLAIMS_TABLE}
          WHERE namespace = $1 AND token_digest = $2 AND fencing_token = $3::bigint
        `, [options.claimNamespace, tokenDigest, String(claim.rows[0].fencing_token)]);
        if (Number(deleted.rowCount ?? 0) !== 1) {
          throw queueError("TASK_CLAIM_INVALID", "The fenced task claim changed before terminal commit.", 403);
        }
      }
      await updateTaskRow(client, task, options, terminal ? timestamp : null);
      await client.query("COMMIT");
      markReady();
      return clonePersistedTask(task);
    } catch (error) {
      await rollback(client);
      throw normalizeStoreError(error, "The central Workforce queue rejected the fenced task transition.");
    } finally {
      client?.release();
    }
  }

  async function loadTask(taskId: string): Promise<QueueTask | null> {
    try {
      const pool = await getReadyPool();
      const result = await pool.query<TaskRow>(`/* workforce-queue:load */
        SELECT ${SELECT_FIELDS} FROM ${TASKS_TABLE}
        WHERE namespace = $1 AND task_id = $2 AND expires_at > clock_timestamp()
      `, [options.namespace, taskId]);
      markReady();
      return result.rows[0] ? decodeVerifiedTask(result.rows[0]) : null;
    } catch (error) {
      throw normalizeStoreError(error, "The central Workforce queue could not load the task.");
    }
  }

  async function listTasks(filter: Record<string, string>): Promise<QueueTask[]> {
    try {
      const pool = await getReadyPool();
      const values: unknown[] = [options.namespace];
      const clauses = ["namespace = $1", "expires_at > clock_timestamp()", ...scopeClauses(filter, values)];
      if (filter.priority) {
        values.push(filter.priority);
        clauses.push(`priority = $${values.length}`);
      }
      const result = await pool.query<TaskRow>(`/* workforce-queue:list */
        SELECT ${SELECT_FIELDS} FROM ${TASKS_TABLE}
        WHERE ${clauses.join(" AND ")}
        ORDER BY created_at ASC, task_id ASC
        LIMIT ${Math.max(1, options.maxEntries)}
      `, values);
      markReady();
      return result.rows.map(decodeVerifiedTask).map(cloneTask);
    } catch (error) {
      throw normalizeStoreError(error, "The central Workforce queue could not list tasks.");
    }
  }

  async function getReadyPool(): Promise<WorkforceQueuePostgresPool> {
    if (closed) throw queueError("WORKFORCE_QUEUE_CLOSED", "The central Workforce queue is closed.", 503);
    if (!readyPromise) {
      readyPromise = poolPromise.then(async (pool) => {
        const client = await pool.connect();
        let locked = false;
        try {
          await client.query("/* workforce-queue:init-lock */ SELECT pg_advisory_lock($1, $2)", [
            INIT_LOCK_NAMESPACE,
            INIT_LOCK_KEY,
          ]);
          locked = true;
          await client.query(INITIALIZE_SQL);
        } finally {
          if (locked) {
            await client.query(
              "/* workforce-queue:init-unlock */ SELECT pg_advisory_unlock($1, $2)",
              [INIT_LOCK_NAMESPACE, INIT_LOCK_KEY],
            ).catch(() => undefined);
          }
          client.release();
        }
        markReady();
        return pool;
      });
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

  async function assertClaimStoreAvailable() {
    const health = await claimManager.checkHealth();
    if (health?.available !== true || health?.distributed !== true) {
      throw queueError(
        "TASK_CLAIM_STORE_UNAVAILABLE",
        "The PostgreSQL fenced claim store is unavailable.",
        503,
      );
    }
  }

  async function refreshStats(pool: WorkforceQueuePostgresPool) {
    const result = await pool.query<{ status: string; count: string | number }>(`
      /* workforce-queue:health-stats */
      SELECT status, COUNT(*)::bigint AS count FROM ${TASKS_TABLE}
      WHERE namespace = $1 AND expires_at > clock_timestamp()
      GROUP BY status
    `, [options.namespace]);
    cachedCounts = emptyCounts();
    for (const row of result.rows) addStatusCount(cachedCounts, row.status, Number(row.count));
    statsUpdatedAt = options.now();
    markReady();
  }

  function queueHealth() {
    return {
      mode: "postgres-central-fenced",
      durable: true,
      distributed: true,
      available,
      reason,
      atomicTerminalFence: true,
      rawTokenRetained: false,
      totalFailures,
      lastFailureCode,
      statsUpdatedAt,
      maxEntries: options.maxEntries,
      maxTaskBytes: options.maxTaskBytes,
      retentionMs: options.retentionMs,
      ...cachedCounts,
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
      : "WORKFORCE_QUEUE_STORE_UNAVAILABLE";
  }

  function normalizeStoreError(error: unknown, message: string): Error {
    if (isQueueError(error)) {
      if (shouldDegradeHealth((error as any).code)) markFailure(error);
      return error as Error;
    }
    markFailure(error);
    return queueError("WORKFORCE_QUEUE_STORE_UNAVAILABLE", message, 503);
  }

  async function purgeExpired(client: WorkforceQueuePostgresClient) {
    await client.query(`/* workforce-queue:purge-expired */
      DELETE FROM ${TASKS_TABLE}
      WHERE namespace = $1 AND expires_at <= clock_timestamp()
    `, [options.namespace]);
  }
}

async function updateTaskRow(
  client: WorkforceQueuePostgresClient,
  task: QueueTask,
  options: PostgresWorkforceTaskQueueOptions,
  completedAt: string | null,
) {
  const encoded = encodeTask(task, options.maxTaskBytes);
  const result = await client.query(`/* workforce-queue:update */
    UPDATE ${TASKS_TABLE}
    SET status = $3,
        assigned_to = $4,
        fencing_token = $5::bigint,
        claim_fingerprint = $6,
        task_json = $7,
        task_sha256 = $8,
        task_bytes = $9,
        updated_at = clock_timestamp(),
        completed_at = $10::timestamptz,
        expires_at = clock_timestamp() + ($11::bigint * interval '1 millisecond')
    WHERE namespace = $1 AND task_id = $2
  `, [
    options.namespace,
    task.taskId,
    task.status,
    task.assignedTo,
    task.claim?.fencingToken ?? null,
    task.claim?.tokenFingerprint ?? null,
    encoded.json,
    encoded.sha256,
    encoded.bytes,
    completedAt,
    options.retentionMs,
  ]);
  if (Number(result.rowCount ?? 0) !== 1) {
    throw queueError("TASK_NOT_FOUND", `Task not found: ${task.taskId}`, 404);
  }
}

async function recoverOrphanedTasks(
  pool: WorkforceQueuePostgresPool,
  options: PostgresWorkforceTaskQueueOptions,
  limit: number,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const recovered = await recoverOrphansInTransaction(client, options, limit);
    await client.query("COMMIT");
    return recovered;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function recoverOrphansInTransaction(
  client: WorkforceQueuePostgresClient,
  options: PostgresWorkforceTaskQueueOptions,
  limit: number,
) {
  const result = await client.query<TaskRow>(`/* workforce-queue:recover-select */
    SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
    FROM ${TASKS_TABLE} AS tasks
    WHERE tasks.namespace = $1
      AND tasks.expires_at > clock_timestamp()
      AND tasks.status IN ('assigned', 'in_progress')
      AND NOT EXISTS (
        SELECT 1 FROM ${CLAIMS_TABLE} AS claims
        WHERE claims.namespace = $2
          AND claims.plan_id = tasks.claim_plan_id
          AND claims.task_id = tasks.task_id
          AND claims.expires_at > clock_timestamp()
    )
    ORDER BY tasks.updated_at ASC
    LIMIT $3
    FOR UPDATE OF tasks SKIP LOCKED
  `, [
    options.namespace,
    options.claimNamespace,
    Math.max(1, Math.min(1_000_000, limit)),
  ]);
  for (const row of result.rows) {
    const task = decodeVerifiedTask(row);
    const timestamp = toIso(row.database_now ?? new Date());
    Object.assign(task, {
      status: TASK_STATUS.QUEUED,
      assignedTo: null,
      startedAt: null,
      updatedAt: timestamp,
      claim: null,
      recoveryCount: Number(task.recoveryCount ?? 0) + 1,
      recoveredReason: "distributed_claim_missing_or_expired",
    });
    // The caller's transaction owns the row lock; this intentionally avoids a
    // second claim validation window.
    const encoded = encodeTask(task, options.maxTaskBytes);
    await client.query(`/* workforce-queue:recover-update */
      UPDATE ${TASKS_TABLE}
      SET status = 'queued', assigned_to = NULL, fencing_token = NULL,
          claim_fingerprint = NULL, task_json = $3, task_sha256 = $4,
          task_bytes = $5, updated_at = clock_timestamp(),
          expires_at = clock_timestamp() + ($6::bigint * interval '1 millisecond')
      WHERE namespace = $1 AND task_id = $2
    `, [
      options.namespace,
      task.taskId,
      encoded.json,
      encoded.sha256,
      encoded.bytes,
      options.retentionMs,
    ]);
  }
  return result.rows.length;
}

async function selectTaskForUpdate(
  client: WorkforceQueuePostgresClient,
  namespace: string,
  taskId: string,
) {
  const result = await client.query<TaskRow>(`/* workforce-queue:select-for-update */
    SELECT ${SELECT_FIELDS}, clock_timestamp() AS database_now
    FROM ${TASKS_TABLE}
    WHERE namespace = $1 AND task_id = $2 AND expires_at > clock_timestamp()
    FOR UPDATE
  `, [namespace, taskId]);
  return result.rows[0] ?? null;
}

async function countAgents(
  pool: WorkforceQueuePostgresPool,
  clauses: string[],
  values: unknown[],
) {
  const result = await pool.query<{ count: string | number }>(`
    /* workforce-queue:agent-count */
    SELECT COUNT(DISTINCT assigned_to)::bigint AS count FROM ${TASKS_TABLE}
    WHERE ${clauses.join(" AND ")} AND assigned_to IS NOT NULL
      AND expires_at > clock_timestamp()
  `, values);
  return Number(result.rows[0]?.count ?? 0);
}

async function lockNamespaceCapacity(client: WorkforceQueuePostgresClient, namespace: string) {
  await client.query(
    "/* workforce-queue:capacity-lock */ SELECT pg_advisory_xact_lock($1, hashtext($2))",
    [CAPACITY_LOCK_NAMESPACE, namespace],
  );
}

async function rollback(client: WorkforceQueuePostgresClient | null) {
  if (!client) return;
  await client.query("ROLLBACK").catch(() => undefined);
}

async function loadPool(options: PostgresWorkforceTaskQueueOptions): Promise<WorkforceQueuePostgresPool> {
  if (!options.connectionString) {
    throw queueError("WORKFORCE_QUEUE_POSTGRES_URL_REQUIRED", "A PostgreSQL connection string is required.", 503);
  }
  const module = await import("pg") as unknown as {
    Pool: new (configuration: Record<string, unknown>) => WorkforceQueuePostgresPool;
  };
  return new module.Pool({
    connectionString: options.connectionString,
    max: options.poolMax,
    connectionTimeoutMillis: Math.min(10_000, options.statementTimeoutMs),
    idleTimeoutMillis: 30_000,
    statement_timeout: options.statementTimeoutMs,
    application_name: "unified-ai-system-workforce-queue",
    allowExitOnIdle: true,
  });
}

function normalizeNewTask(task: QueueTask, options: PostgresWorkforceTaskQueueOptions): QueueTask {
  task.taskId = normalizeId(task.taskId, "taskId");
  task.planId = normalizeId(task.planId, "planId");
  task.claimPlanId = normalizeId(task.claimPlanId, "claimPlanId");
  task.tenantId = normalizeId(task.tenantId, "tenantId");
  task.ownerId = normalizeId(task.ownerId, "ownerId");
  task.priority = normalizePriority(task.priority);
  task.status = TASK_STATUS.QUEUED;
  task.assignedTo = null;
  task.claim = null;
  encodeTask(task, options.maxTaskBytes);
  return task;
}

function encodeTask(task: QueueTask, maxTaskBytes: number) {
  const sanitized = sanitizePersistedValue(task) as QueueTask;
  let json: string;
  try {
    json = JSON.stringify(sanitized);
  } catch {
    throw queueError("TASK_PAYLOAD_INVALID", "Task state must be JSON-serializable.", 400);
  }
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes <= 0 || bytes > maxTaskBytes) {
    throw queueError("TASK_PAYLOAD_TOO_LARGE", `Task state exceeds the ${maxTaskBytes}-byte limit.`, 413);
  }
  return {
    json,
    bytes,
    sha256: createHash("sha256").update(json, "utf8").digest("hex"),
  };
}

function decodeVerifiedTask(row: TaskRow): QueueTask {
  if (Buffer.byteLength(row.task_json, "utf8") !== Number(row.task_bytes)) {
    throw queueError("WORKFORCE_QUEUE_STATE_CORRUPT", "The persisted Workforce task byte count does not match.", 503);
  }
  const actual = createHash("sha256").update(row.task_json, "utf8").digest("hex");
  if (actual !== row.task_sha256) {
    throw queueError("WORKFORCE_QUEUE_STATE_CORRUPT", "The persisted Workforce task digest does not match.", 503);
  }
  let task: QueueTask;
  try {
    task = JSON.parse(row.task_json) as QueueTask;
  } catch {
    throw queueError("WORKFORCE_QUEUE_STATE_CORRUPT", "The persisted Workforce task is not valid JSON.", 503);
  }
  if (
    task.taskId !== row.task_id
    || task.planId !== row.plan_id
    || task.claimPlanId !== row.claim_plan_id
    || task.tenantId !== row.tenant_id
    || task.ownerId !== row.owner_id
    || task.priority !== row.priority
    || task.status !== row.status
    || (task.assignedTo ?? null) !== (row.assigned_to ?? null)
    || String(task.claim?.fencingToken ?? "") !== String(row.fencing_token ?? "")
  ) {
    throw queueError("WORKFORCE_QUEUE_STATE_CORRUPT", "The persisted Workforce task metadata is inconsistent.", 503);
  }
  return task;
}

function sanitizePersistedValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  let nodes = 0;
  function walk(current: unknown, depth: number): unknown {
    nodes += 1;
    if (nodes > MAX_SANITIZE_NODES || depth > MAX_SANITIZE_DEPTH) {
      throw queueError("TASK_PAYLOAD_INVALID", "Task state exceeds the structural complexity limit.", 400);
    }
    if (current === null || typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw queueError("TASK_PAYLOAD_INVALID", "Task state contains a non-finite number.", 400);
      return current;
    }
    if (typeof current === "undefined") return null;
    if (typeof current !== "object") return String(current);
    if (seen.has(current)) throw queueError("TASK_PAYLOAD_INVALID", "Task state contains a cycle.", 400);
    seen.add(current);
    if (Array.isArray(current)) {
      const output = current.map((entry) => walk(entry, depth + 1));
      seen.delete(current);
      return output;
    }
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(current as Record<string, unknown>)) {
      output[key] = isSensitiveKey(key) ? "[REDACTED]" : walk(entry, depth + 1);
    }
    seen.delete(current);
    return output;
  }
  return walk(value, 0);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/giu, "").toLowerCase();
  return new Set([
    "authorization",
    "apikey",
    "password",
    "secret",
    "token",
    "accesstoken",
    "refreshtoken",
    "claimtoken",
    "taskclaimtoken",
    "privatekey",
  ]).has(normalized);
}

function cloneTask(task: QueueTask): QueueTask {
  return {
    ...task,
    claim: task.claim ? { ...task.claim } : null,
  };
}

function clonePersistedTask(task: QueueTask): QueueTask {
  return cloneTask(sanitizePersistedValue(task) as QueueTask);
}

function assertOwnershipShape(task: QueueTask, ownership: Record<string, any>) {
  if (typeof ownership?.claimToken !== "string" || !ownership.claimToken || ownership.claimToken.length > MAX_TOKEN_LENGTH) {
    throw queueError("TASK_CLAIM_REQUIRED", "A bounded task claim token is required.", 403);
  }
  if (ownership.agentId && ownership.agentId !== task.assignedTo) {
    throw queueError("TASK_CLAIM_AGENT_MISMATCH", "The task is assigned to a different agent.", 403);
  }
}

function claimContext(task: QueueTask) {
  return {
    planId: task.claimPlanId,
    taskId: task.taskId,
    agentId: task.assignedTo ?? undefined,
    fencingToken: task.claim?.fencingToken,
  };
}

function digestToken(token: unknown): string {
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) {
    throw queueError("TASK_CLAIM_REQUIRED", "A bounded task claim token is required.", 403);
  }
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function normalizeId(value: unknown, field: string): string {
  if (typeof value !== "string") throw queueError("TASK_IDENTITY_INVALID", `${field} must be a string.`, 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_ID_LENGTH || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw queueError("TASK_IDENTITY_INVALID", `${field} must be non-empty, bounded, and free of control characters.`, 400);
  }
  return normalized;
}

function optionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return normalizeId(value, field);
}

function normalizeScopeFilter(scope: Record<string, unknown>) {
  return {
    ...(optionalId(scope.tenantId, "tenantId") ? { tenantId: optionalId(scope.tenantId, "tenantId") as string } : {}),
    ...(optionalId(scope.ownerId, "ownerId") ? { ownerId: optionalId(scope.ownerId, "ownerId") as string } : {}),
  };
}

function requireScopeFilter(scope: Record<string, unknown>) {
  const filter = normalizeScopeFilter(scope);
  if (!filter.tenantId || !filter.ownerId) {
    throw queueError("TASK_SCOPE_REQUIRED", "A tenant and owner scope is required for task detail reads.", 400);
  }
  return filter as { tenantId: string; ownerId: string };
}

function scopeClauses(filter: Record<string, string>, values: unknown[]): string[] {
  const clauses: string[] = [];
  if (filter.tenantId) {
    values.push(filter.tenantId);
    clauses.push(`tenant_id = $${values.length}`);
  }
  if (filter.ownerId) {
    values.push(filter.ownerId);
    clauses.push(`owner_id = $${values.length}`);
  }
  return clauses;
}

function priorityRank(priority: string): number {
  const key = normalizePriority(priority) as keyof typeof PRIORITY_LEVELS;
  return Number(PRIORITY_LEVELS[key]?.level ?? 3);
}

function isActive(status: string): boolean {
  return status === TASK_STATUS.ASSIGNED || status === TASK_STATUS.IN_PROGRESS;
}

function isTerminal(status: string): boolean {
  return status === TASK_STATUS.COMPLETED || status === TASK_STATUS.FAILED || status === TASK_STATUS.CANCELLED;
}

function emptyCounts() {
  return { totalQueued: 0, totalActive: 0, totalCompleted: 0, totalFailed: 0, totalCancelled: 0 };
}

function addStatusCount(counts: ReturnType<typeof emptyCounts>, status: string, count: number) {
  if (status === TASK_STATUS.QUEUED) counts.totalQueued += count;
  else if (isActive(status)) counts.totalActive += count;
  else if (status === TASK_STATUS.COMPLETED) counts.totalCompleted += count;
  else if (status === TASK_STATUS.FAILED) counts.totalFailed += count;
  else if (status === TASK_STATUS.CANCELLED) counts.totalCancelled += count;
}

function toIso(value: string | Date): string {
  return new Date(value).toISOString();
}

function queueError(code: string, message: string, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}

function isQueueError(error: unknown): boolean {
  return error instanceof Error
    && typeof (error as any).code === "string"
    && Number.isInteger((error as any).statusCode);
}

function shouldDegradeHealth(code: string): boolean {
  return code === "WORKFORCE_QUEUE_STORE_UNAVAILABLE" || code === "WORKFORCE_QUEUE_STATE_CORRUPT";
}
