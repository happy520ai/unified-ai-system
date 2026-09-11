import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  DATA_DIR,
  QUEUE_FILE,
  MAX_QUEUE_SIZE,
  MAX_COMPLETED_TASKS,
  PRIORITY_LEVELS,
  TASK_STATUS,
} from "./taskQueueConstants.js";
import {
  normalizePriority,
  buildTaskRecord,
  findPriorityInsertIndex,
  computeSLACompliance,
  computeStats,
} from "./taskQueueHelpers.js";
import { createWorkforceTaskClaimManager } from "./workforceTaskClaimManager.ts";
import { advanceTaskContinuation, continuationError, continuationJsonCopy, continuationMayClaim,
  interruptedContinuation, MAX_RETAINED_QUEUE_BYTES, MAX_RETAINED_TASKS, readTaskContinuation } from "./taskQueueContinuation.ts";

const retainedOwners = new Map();
const retainedWrite = Symbol("retained queue write");

export { PRIORITY_LEVELS, TASK_STATUS };

function queueError(code, message, statusCode = 409) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function cloneTask(task) {
  return { ...task, claim: task.claim ? { ...task.claim } : null };
}

function normalizeAgentId(agentId) {
  if (typeof agentId !== "string" || !agentId.trim() || agentId.trim().length > 256) {
    throw queueError("TASK_AGENT_INVALID", "agentId is required to claim a task.", 400);
  }
  return agentId.trim();
}

export class TaskQueueManager {
  constructor(options = {}) {
    this.queue = [];
    this.activeTasks = new Map();
    this.completedTasks = [];
    this.agentAssignments = new Map();
    this._auditLog = [];
    this.dataDir = options.dataDir ?? (options.queueFile ? path.dirname(options.queueFile) : DATA_DIR);
    this.queueFile = options.queueFile ?? (options.dataDir ? path.join(options.dataDir, "task-queue.json") : QUEUE_FILE);
    this.claimTtlMs = Number(options.claimTtlMs) || 5 * 60_000;
    this.claimManager = options.claimManager ?? createWorkforceTaskClaimManager({
      env: options.env ?? process.env,
      ttlMs: this.claimTtlMs,
      maxClaims: MAX_QUEUE_SIZE * 2,
      clock: options.clock,
    });
    this._persistChain = Promise.resolve();
    this.retainedTasks = options.retainedTasks === true;
    this.retainedStateBinding = options.retainedStateBinding ?? null;
    if (this.retainedStateBinding && (!this.retainedTasks || typeof this.retainedStateBinding.verify !== "function"
      || typeof this.retainedStateBinding.commit !== "function")) throw continuationError("STATE_BINDING_INVALID");
    this._retainedChain = Promise.resolve();
    this._retainedReady = false;
    this._retainedClosed = false;
  }

  async init() {
    if (this.retainedTasks) return this._initRetainedTasks();
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.queueFile, "utf8");
      const data = JSON.parse(raw);
      if (data.retainedTasks === true) throw continuationError("MODE_REQUIRED");
      this.queue = (Array.isArray(data.queue) ? data.queue : []).map((task) => ({
        ...task,
        planId: task.planId || task.payload?.planId || "standalone",
        claimPlanId: task.claimPlanId || task.planId || task.payload?.planId || "standalone",
        tenantId: task.tenantId || "default",
        ownerId: task.ownerId || task.requestedBy || "system",
        dependsOnRoleIds: Array.isArray(task.dependsOnRoleIds) ? task.dependsOnRoleIds : [],
        claim: null,
      }));
      this.completedTasks = (Array.isArray(data.completedTasks) ? data.completedTasks : []).map((task) => ({
        ...task,
        planId: task.planId || task.payload?.planId || "standalone",
        claimPlanId: task.claimPlanId || task.planId || task.payload?.planId || "standalone",
        tenantId: task.tenantId || "default",
        ownerId: task.ownerId || task.requestedBy || "system",
      }));
      this._auditLog = Array.isArray(data.auditLog) ? data.auditLog.slice(-2_000) : [];
      this.agentAssignments = new Map();
      for (const [agentId, tasks] of Object.entries(data.agentAssignments ?? {})) {
        this.agentAssignments.set(agentId, Array.isArray(tasks) ? tasks : []);
      }
      const knownTaskIds = new Set(this.queue.map((task) => task.taskId));
      let recoveredCount = 0;
      for (const persistedTask of Array.isArray(data.activeTasks) ? data.activeTasks : []) {
        if (!persistedTask?.taskId || knownTaskIds.has(persistedTask.taskId)) continue;
        const task = {
          ...persistedTask,
          planId: persistedTask.planId || persistedTask.payload?.planId || "standalone",
          claimPlanId: persistedTask.claimPlanId || persistedTask.planId || persistedTask.payload?.planId || "standalone",
          tenantId: persistedTask.tenantId || "default",
          ownerId: persistedTask.ownerId || persistedTask.requestedBy || "system",
          dependsOnRoleIds: Array.isArray(persistedTask.dependsOnRoleIds) ? persistedTask.dependsOnRoleIds : [],
          status: TASK_STATUS.QUEUED,
          assignedTo: null,
          startedAt: null,
          updatedAt: new Date().toISOString(),
          claim: null,
          recoveryCount: Number(persistedTask.recoveryCount || 0) + 1,
          recoveredReason: this.claimManager.getInfo()?.distributed
            ? "process_restart_waits_for_distributed_claim_expiry"
            : "process_restart_invalidated_local_claim",
        };
        this._insertQueued(task);
        knownTaskIds.add(task.taskId);
        this._audit(task.taskId, "claim_recovered", { reason: task.recoveredReason });
        recoveredCount += 1;
      }
      this.activeTasks = new Map();
      if (recoveredCount > 0) await this.persist();
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw queueError("TASK_QUEUE_STATE_INVALID", "Persisted task queue state could not be loaded.", 503);
      }
    }
    return this.getQueueStatus();
  }

  async enqueue(task) {
    const [record] = await this.enqueueMany([task]);
    return record;
  }

  async enqueueMany(tasks) {
    this._assertOrdinaryQueue();
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    if (this.queue.length + tasks.length > MAX_QUEUE_SIZE) {
      throw queueError("TASK_QUEUE_FULL", `Queue is full (max ${MAX_QUEUE_SIZE} tasks).`, 503);
    }
    const records = tasks.map(buildTaskRecord);
    for (const record of records) {
      this._insertQueued(record);
      this._audit(record.taskId, "enqueued", { priority: record.priority, planId: record.planId });
    }
    await this.persist();
    return records.map(cloneTask);
  }

  async claimTask(agentIdInput, options = {}) {
    this._assertOrdinaryQueue();
    const agentId = normalizeAgentId(agentIdInput);
    const maxConcurrent = Math.max(1, Math.floor(Number(options.maxConcurrent) || 5));
    if (this._getActiveCountForAgent(agentId) >= maxConcurrent) return null;
    const requestedTaskId = typeof options.taskId === "string" ? options.taskId.trim() : "";
    const requestedPlanId = typeof options.planId === "string" ? options.planId.trim() : "";
    const taskIndex = this.queue.findIndex((task) => task.status === TASK_STATUS.QUEUED
      && (!requestedTaskId || task.taskId === requestedTaskId)
      && (!requestedPlanId || task.planId === requestedPlanId));
    if (taskIndex === -1) return null;
    return this._claimAtIndex(taskIndex, agentId, options, true);
  }

  async updateTaskStatus(taskId, status, result, ownership = {}) {
    this._assertOrdinaryQueue();
    if (status === TASK_STATUS.CANCELLED) return this.cancelTask(taskId, result?.reason ?? result);
    if (status === TASK_STATUS.COMPLETED) return this.completeTask(taskId, result, ownership);
    if (status === TASK_STATUS.FAILED) return this.failTask(taskId, result?.error ?? result, ownership);
    const task = this.activeTasks.get(taskId);
    if (!task) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
    const allowed = task.status === TASK_STATUS.ASSIGNED ? [TASK_STATUS.IN_PROGRESS] : [];
    if (!allowed.includes(status)) {
      throw queueError("TASK_TRANSITION_INVALID", `Invalid status transition: ${task.status} -> ${status}.`);
    }
    await this._assertClaimOwnership(task, ownership);
    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (result !== undefined) task.result = result;
    this._audit(taskId, "status_updated", { status, tokenFingerprint: task.claim?.tokenFingerprint });
    await this.persist();
    return cloneTask(task);
  }

  async completeTask(taskId, result, ownership = {}) {
    this._assertOrdinaryQueue();
    const task = this.activeTasks.get(taskId);
    if (!task) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
    await this._assertClaimOwnership(task, ownership);
    task.status = TASK_STATUS.COMPLETED;
    task.completedAt = new Date().toISOString();
    task.updatedAt = task.completedAt;
    task.result = result ?? {};
    task.claim = task.claim ? { ...task.claim, status: "released", releasedAt: task.completedAt } : null;
    this.activeTasks.delete(taskId);
    this.completedTasks.push(task);
    this._audit(taskId, "completed", {
      durationMs: task.startedAt ? new Date(task.completedAt) - new Date(task.startedAt) : null,
      fencingToken: task.claim?.fencingToken,
    });
    await this.persist();
    await this.claimManager.release(ownership.claimToken, this._claimContext(task));
    return cloneTask(task);
  }

  async failTask(taskId, error, ownership = {}) {
    this._assertOrdinaryQueue();
    const task = this.activeTasks.get(taskId);
    if (!task) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
    await this._assertClaimOwnership(task, ownership);
    task.status = TASK_STATUS.FAILED;
    task.completedAt = new Date().toISOString();
    task.updatedAt = task.completedAt;
    task.error = (error instanceof Error ? error.message : String(error ?? "Task failed.")).slice(0, 2_000);
    task.retryCount += 1;
    task.claim = task.claim ? { ...task.claim, status: "released", releasedAt: task.completedAt } : null;
    this.activeTasks.delete(taskId);
    this.completedTasks.push(task);
    this._audit(taskId, "failed", { retryCount: task.retryCount, fencingToken: task.claim?.fencingToken });
    await this.persist();
    await this.claimManager.release(ownership.claimToken, this._claimContext(task));
    return cloneTask(task);
  }

  async cancelTask(taskId, reason = "cancelled_by_gateway") {
    this._assertOrdinaryQueue();
    const queuedIndex = this.queue.findIndex((task) => task.taskId === taskId);
    const task = queuedIndex >= 0 ? this.queue.splice(queuedIndex, 1)[0] : this.activeTasks.get(taskId);
    if (!task) throw queueError("TASK_NOT_FOUND", `Task not found: ${taskId}`, 404);
    if (queuedIndex < 0) this.activeTasks.delete(taskId);
    const cancelledAt = new Date().toISOString();
    task.status = TASK_STATUS.CANCELLED;
    task.completedAt = cancelledAt;
    task.updatedAt = cancelledAt;
    task.error = String(reason || "cancelled_by_gateway").slice(0, 512);
    task.claim = task.claim ? { ...task.claim, status: "revoked", revokedAt: cancelledAt } : null;
    this.completedTasks.push(task);
    this._audit(taskId, "cancelled", { reason: task.error });
    await this.persist();
    if (task.claim) await this.claimManager.revokeTask({
      planId: task.claimPlanId || task.planId,
      taskId: task.taskId,
    }, task.error);
    return cloneTask(task);
  }

  async renewTaskClaim(taskId, ownership = {}, extendMs) {
    this._assertOrdinaryQueue();
    const task = this.activeTasks.get(taskId);
    if (!task) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
    await this._assertClaimOwnership(task, ownership);
    const renewed = await this.claimManager.renew(ownership.claimToken, this._claimContext(task), extendMs);
    if (!renewed?.success) throw queueError("TASK_CLAIM_RENEW_FAILED", renewed?.reason ?? "Task claim renewal failed.");
    task.claim = renewed.record;
    this._audit(taskId, "claim_renewed", {
      tokenFingerprint: task.claim.tokenFingerprint,
      fencingToken: task.claim.fencingToken,
    });
    await this.persist();
    return { success: true, claim: { ...task.claim } };
  }

  async assertTaskClaimActive(taskId, ownership = {}) {
    this._assertOrdinaryQueue();
    const task = this.activeTasks.get(taskId);
    if (!task) throw queueError("TASK_NOT_ACTIVE", `Active task not found: ${taskId}`, 404);
    await this._assertClaimOwnership(task, ownership);
    return {
      active: true,
      taskId: task.taskId,
      agentId: task.assignedTo,
      fencingToken: task.claim?.fencingToken,
    };
  }

  async requeueTask(taskId) {
    this._assertOrdinaryQueue();
    const index = this.completedTasks.findIndex((task) => task.taskId === taskId && task.status === TASK_STATUS.FAILED);
    if (index === -1) throw queueError("TASK_FAILED_NOT_FOUND", `Failed task not found: ${taskId}`, 404);
    const task = this.completedTasks[index];
    if (task.retryCount >= task.maxRetries) throw queueError("TASK_RETRIES_EXHAUSTED", `Task ${taskId} has exhausted retries.`);
    this.completedTasks.splice(index, 1);
    Object.assign(task, {
      status: TASK_STATUS.QUEUED,
      assignedTo: null,
      startedAt: null,
      completedAt: null,
      error: null,
      result: null,
      claim: null,
      updatedAt: new Date().toISOString(),
    });
    this._insertQueued(task);
    this._audit(taskId, "requeued", { retryCount: task.retryCount });
    await this.persist();
    return cloneTask(task);
  }

  async autoAssign(options = {}) {
    this._assertOrdinaryQueue();
    const maxConcurrent = Math.max(1, Math.floor(Number(options.maxConcurrentPerAgent) || 5));
    const agentIds = (Array.isArray(options.agentIds) && options.agentIds.length > 0
      ? options.agentIds
      : ["agent-alpha", "agent-beta", "agent-gamma"]).map(normalizeAgentId);
    const assignments = [];
    while (this.queue.some((task) => task.status === TASK_STATUS.QUEUED)) {
      const available = agentIds
        .map((agentId) => ({ agentId, load: this._getActiveCountForAgent(agentId) }))
        .filter((entry) => entry.load < maxConcurrent)
        .sort((left, right) => left.load - right.load || left.agentId.localeCompare(right.agentId));
      if (available.length === 0) break;
      const taskIndex = this.queue.findIndex((task) => task.status === TASK_STATUS.QUEUED);
      const claimed = await this._claimAtIndex(taskIndex, available[0].agentId, { ttlMs: options.ttlMs }, false);
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
    await this.persist();
    return {
      assigned: assignments.length,
      assignments,
      unassigned: this.queue.length,
      agentsUsed: new Set(assignments.map((assignment) => assignment.agentId)).size,
      claimEnforced: true,
    };
  }

  getInfo() {
    return {
      module: "taskQueueManager",
      version: "2.0.0",
      persistence: "atomic-json-local",
      claimEnforced: true,
      claimManager: this.claimManager.getInfo(),
      ...(this.retainedTasks ? { continuation: { enabled: true, maxRetainedTasks: MAX_RETAINED_TASKS,
        importedDataIsAuthority: false, signedFileIntegrity: Boolean(this.retainedStateBinding),
        wholeDirectoryRollbackProtection: false, crossProcessAtomicWriter: false } } : {}),
    };
  }

  async getClaimHealth() {
    if (typeof this.claimManager.checkHealth === "function") {
      return this.claimManager.checkHealth();
    }
    const info = this.claimManager.getInfo();
    return {
      mode: info.mode,
      distributed: info.distributed === true,
      available: true,
      activeClaims: info.activeClaims ?? 0,
      maxClaims: info.maxClaims ?? 0,
      statsUpdatedAt: null,
    };
  }

  getQueueHealth() {
    return {
      mode: "atomic-json-local",
      durable: true,
      distributed: false,
      available: true,
      atomicTerminalFence: false,
      rawTokenRetained: false,
      ...this.getQueueStatus(),
    };
  }

  async checkQueueHealth() {
    return this.getQueueHealth();
  }

  getQueueStatus() {
    const byPriority = {};
    for (const key of Object.keys(PRIORITY_LEVELS)) {
      byPriority[key] = this.queue.filter((task) => task.priority === key).length;
    }
    return {
      totalQueued: this.queue.length,
      totalActive: this.activeTasks.size,
      totalCompleted: this.completedTasks.filter((task) => task.status === TASK_STATUS.COMPLETED).length,
      totalFailed: this.completedTasks.filter((task) => task.status === TASK_STATUS.FAILED).length,
      totalCancelled: this.completedTasks.filter((task) => task.status === TASK_STATUS.CANCELLED).length,
      activeClaims: this.activeTasks.size,
      claimEnforced: true,
      byPriority,
      agents: this.agentAssignments.size,
      timestamp: new Date().toISOString(),
    };
  }

  getTasksByPriority(priority) {
    const key = normalizePriority(priority);
    return {
      priority: key,
      queued: this.queue.filter((task) => task.priority === key).map(cloneTask),
      active: [...this.activeTasks.values()].filter((task) => task.priority === key).map(cloneTask),
      completed: this.completedTasks.filter((task) => task.priority === key).map(cloneTask),
    };
  }

  getAgentWorkload(agentId) {
    const assignments = this.agentAssignments.get(agentId) ?? [];
    const active = [...this.activeTasks.values()].filter((task) => task.assignedTo === agentId);
    const completed = this.completedTasks.filter((task) => task.assignedTo === agentId && task.status === TASK_STATUS.COMPLETED);
    const failed = this.completedTasks.filter((task) => task.assignedTo === agentId && task.status === TASK_STATUS.FAILED);
    return {
      agentId,
      activeTasks: active.length,
      completedTasks: completed.length,
      failedTasks: failed.length,
      totalAssigned: assignments.length,
      active: active.map(cloneTask),
      recentCompleted: completed.slice(-5).map(cloneTask),
    };
  }

  checkSLACompliance() {
    const { breaches, atRisk } = computeSLACompliance(this.queue, this.activeTasks.values());
    return { compliant: breaches.length === 0, breaches, atRisk, checkedAt: new Date().toISOString() };
  }

  getStats() {
    return {
      ...computeStats(this.queue, [...this.activeTasks.values()], this.completedTasks, this.agentAssignments.size),
      claims: this.claimManager.getInfo(),
      sla: this.checkSLACompliance(),
      timestamp: new Date().toISOString(),
    };
  }

  async persist(snapshot, authority) {
    if (this.retainedTasks && authority !== retainedWrite) throw continuationError("RETAINED_API_REQUIRED");
    if (!this.retainedTasks && this.completedTasks.length > MAX_COMPLETED_TASKS) this.completedTasks = this.completedTasks.slice(-MAX_COMPLETED_TASKS);
    const current = snapshot ?? { queue: this.queue, activeTasks: this.activeTasks, completedTasks: this.completedTasks,
      agentAssignments: this.agentAssignments, auditLog: this._auditLog };
    const serialized = JSON.stringify({
      version: "2.0.0",
      ...(this.retainedTasks ? { retainedTasks: true, retainedOwnerPid: process.pid } : {}),
      updatedAt: new Date().toISOString(),
      queue: current.queue,
      activeTasks: [...current.activeTasks.values()],
      completedTasks: current.completedTasks,
      agentAssignments: Object.fromEntries(current.agentAssignments),
      auditLog: current.auditLog.slice(-500),
    }, null, 2);
    if (this.retainedTasks && Buffer.byteLength(serialized) > MAX_RETAINED_QUEUE_BYTES) throw continuationError("CAPACITY", 503);
    const operation = this._persistChain.then(async () => {
      if (this.retainedTasks) await this._assertRetainedStorage();
      else await fs.mkdir(this.dataDir, { recursive: true });
      if (this.retainedStateBinding) {
        await this.retainedStateBinding.commit(serialized);
        await this._assertRetainedStorage();
        return;
      }
      const temporaryPath = `${this.queueFile}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });
        if (this.retainedTasks) await this._assertRetainedStorage();
        await fs.rename(temporaryPath, this.queueFile);
      } finally {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
      }
    });
    this._persistChain = operation.catch(() => {});
    return operation;
  }

  async close() {
    this._retainedClosed = true;
    await this._retainedChain;
    await this._persistChain;
    await this.claimManager.close?.();
    if (this._retainedOwnerKey && retainedOwners.get(this._retainedOwnerKey) === this) retainedOwners.delete(this._retainedOwnerKey);
  }

  _assertOrdinaryQueue() {
    if (this.retainedTasks) throw continuationError("RETAINED_API_REQUIRED");
  }

  _assertRetainedQueue() {
    if (!this.retainedTasks || !this._retainedReady || this._retainedClosed) throw continuationError("UNAVAILABLE", 503);
  }

  async _assertRetainedStorage() {
    const current = await fs.lstat(this.dataDir, { bigint: true });
    if (!this._retainedRootIdentity || current.dev !== this._retainedRootIdentity.dev || current.ino !== this._retainedRootIdentity.ino
      || !current.isDirectory() || current.isSymbolicLink() || await fs.realpath(this.dataDir) !== this.dataDir) throw continuationError("PATH_CHANGED");
    await this.retainedStateBinding?.verify();
  }

  async _initRetainedTasks() {
    if (this._retainedReady) { this._assertRetainedQueue(); return this.getQueueStatus(); }
    if (this._retainedClosed || this.claimManager.getInfo()?.distributed) throw continuationError("SINGLE_WRITER_REQUIRED", 503);
    await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const root = await fs.realpath(this.dataDir);
    const configured = path.resolve(this.queueFile);
    if (await fs.realpath(path.dirname(configured)) !== root) throw continuationError("PATH_REJECTED");
    this.queueFile = path.join(root, path.basename(configured));
    this.dataDir = root;
    this._retainedRootIdentity = await fs.lstat(root, { bigint: true });
    const key = process.platform === "win32" ? this.queueFile.toLowerCase() : this.queueFile;
    if (retainedOwners.has(key)) throw continuationError("WRITER_ACTIVE");
    retainedOwners.set(key, this); this._retainedOwnerKey = key;
    try {
      await this._assertRetainedStorage();
      let data;
      try {
        const info = await fs.lstat(this.queueFile, { bigint: true });
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1n || info.size > BigInt(MAX_RETAINED_QUEUE_BYTES)) throw continuationError("STATE_INVALID");
        const handle = await fs.open(this.queueFile, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
        try {
          const opened = await handle.stat({ bigint: true });
          if (opened.dev !== info.dev || opened.ino !== info.ino || opened.nlink !== 1n || opened.size !== info.size) throw continuationError("STATE_CHANGED");
          const buffer = Buffer.alloc(Number(opened.size) + 1); let count = 0;
          while (count < buffer.length) {
            const read = await handle.read(buffer, count, buffer.length - count, count);
            if (!read.bytesRead) break; count += read.bytesRead;
          }
          const after = await handle.stat({ bigint: true }), current = await fs.lstat(this.queueFile, { bigint: true });
          if (current.dev !== info.dev || current.ino !== info.ino || current.isSymbolicLink() || current.nlink !== 1n
            || after.size !== info.size || after.size !== BigInt(count) || after.mtimeNs !== info.mtimeNs || after.ctimeNs !== info.ctimeNs) throw continuationError("STATE_CHANGED");
          data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, count)));
        } finally { await handle.close(); }
      } catch (error) { if (error?.code !== "ENOENT") throw error; }
      await this._assertRetainedStorage();
      const snapshot = { queue: [], activeTasks: new Map(), completedTasks: [], agentAssignments: new Map(), auditLog: [] };
      if (data) {
        if (data.retainedTasks !== true || !Array.isArray(data.queue) || !Array.isArray(data.activeTasks)
          || !Array.isArray(data.completedTasks) || !Number.isSafeInteger(data.retainedOwnerPid) || data.retainedOwnerPid <= 0) throw continuationError("STATE_INVALID");
        if (data.retainedOwnerPid !== process.pid) {
          try { process.kill(data.retainedOwnerPid, 0); throw continuationError("WRITER_ACTIVE"); }
          catch (error) { if (error?.code !== "ESRCH") throw continuationError("WRITER_NOT_CONFIRMED_STOPPED"); }
        }
        const rows = [...data.queue, ...data.activeTasks, ...data.completedTasks];
        if (rows.length > MAX_RETAINED_TASKS || new Set(rows.map(task => task.taskId)).size !== rows.length) throw continuationError("STATE_INVALID");
        const activeIds = new Set(data.activeTasks.map(task => task.taskId));
        const queuedIds = new Set(data.queue.map(task => task.taskId));
        for (const raw of rows) {
          const task = continuationJsonCopy(raw);
          if (!task.taskId || !task.tenantId || !task.ownerId || !task.planId || !task.retainedAgentId) throw continuationError("STATE_INVALID");
          const saved = readTaskContinuation(task.continuation);
          if (!activeIds.has(task.taskId) && (queuedIds.has(task.taskId) ? !continuationMayClaim(saved)
            : !["completed", "failed", "cancelled", "unknown"].includes(saved.phase))) throw continuationError("STATE_INVALID");
          task.continuation = activeIds.has(task.taskId) ? interruptedContinuation(task.continuation) : readTaskContinuation(task.continuation);
          task.assignedTo = null; task.claim = null;
          const claimable = continuationMayClaim(task.continuation);
          task.status = claimable ? TASK_STATUS.QUEUED : task.continuation.phase === "completed" ? TASK_STATUS.COMPLETED
            : task.continuation.phase === "cancelled" ? TASK_STATUS.CANCELLED : TASK_STATUS.FAILED;
          (claimable ? snapshot.queue : snapshot.completedTasks).push(task);
        }
        snapshot.auditLog = Array.isArray(data.auditLog) ? data.auditLog.slice(-500) : [];
      }
      await this.persist(snapshot, retainedWrite);
      this._installRetainedSnapshot(snapshot); this._retainedReady = true;
      return this.getQueueStatus();
    } catch (error) {
      if (retainedOwners.get(key) === this) retainedOwners.delete(key);
      throw error;
    }
  }

  _installRetainedSnapshot(snapshot) {
    this.queue = snapshot.queue; this.activeTasks = snapshot.activeTasks; this.completedTasks = snapshot.completedTasks;
    this.agentAssignments = snapshot.agentAssignments; this._auditLog = snapshot.auditLog;
  }

  _retainedMutation(mutate) {
    const pending = this._retainedChain.then(async () => {
      this._assertRetainedQueue();
      await this._assertRetainedStorage();
      const snapshot = { queue: [...this.queue], activeTasks: new Map(this.activeTasks), completedTasks: [...this.completedTasks],
        agentAssignments: new Map(this.agentAssignments), auditLog: [...this._auditLog] };
      const result = await mutate(snapshot);
      const copied = continuationJsonCopy(result);
      try { await this.persist(snapshot, retainedWrite); }
      catch (error) {
        if (error?.code === "TASK_CONTINUATION_CAPACITY") throw error;
        this._retainedReady = false; throw Object.assign(error, { persistenceOutcomeUnknown: true });
      }
      this._installRetainedSnapshot(snapshot);
      return copied;
    });
    this._retainedChain = pending.catch(() => {});
    return pending;
  }

  _ownedRetainedTask(snapshot, taskId, identity) {
    const task = snapshot.activeTasks.get(taskId) ?? snapshot.queue.find(item => item.taskId === taskId)
      ?? snapshot.completedTasks.find(item => item.taskId === taskId);
    if (!task || task.tenantId !== identity?.tenantId || task.ownerId !== identity?.userId
      || task.retainedAgentId !== identity?.agentId) throw continuationError("NOT_FOUND", 404);
    readTaskContinuation(task.continuation);
    return task;
  }

  async enqueueRetainedTask(input, identity, continuationInput) {
    return this._retainedMutation(async snapshot => {
      if (![identity?.tenantId, identity?.userId].every(value => typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value)
        || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(identity.agentId ?? "")) throw continuationError("IDENTITY_REQUIRED", 403);
      const continuation = readTaskContinuation(continuationInput);
      if (continuation.revision !== 0 || continuation.phase !== "prepared" || continuation.pendingOperation
        || Object.values(continuation.counters).some(value => value !== 0)) throw continuationError("INITIAL_STATE_INVALID");
      if (snapshot.queue.length + snapshot.activeTasks.size + snapshot.completedTasks.length >= MAX_RETAINED_TASKS) throw continuationError("CAPACITY", 503);
      const task = buildTaskRecord({ ...continuationJsonCopy(input), tenantId: identity.tenantId, ownerId: identity.userId, maxRetries: 0 });
      Object.assign(task, { retainedAgentId: identity.agentId, continuation });
      snapshot.queue.push(task);
      return task;
    });
  }

  readRetainedTask(taskId, identity) {
    this._assertRetainedQueue();
    return continuationJsonCopy(this._ownedRetainedTask(this, taskId, identity));
  }

  /** Server-only recovery index. A reference never carries a claim or execution authority. */
  listRetainedTaskReferences() {
    this._assertRetainedQueue();
    return [...this.queue, ...this.activeTasks.values(), ...this.completedTasks].map(task => Object.freeze({
      taskId: task.taskId, tenantId: task.tenantId, userId: task.ownerId, agentId: task.retainedAgentId,
      profileHash: task.continuation.state?.review?.profile?.profileHash ?? null,
    }));
  }

  async assertRetainedTaskActive(taskId, identity, ownership) {
    this._assertRetainedQueue();
    await this._assertRetainedStorage();
    const task = this._ownedRetainedTask(this, taskId, identity);
    if (this.activeTasks.get(taskId) !== task) throw continuationError("NOT_ACTIVE");
    await this._assertClaimOwnership(task, { ...ownership, agentId: identity.agentId });
    this._assertRetainedQueue();
    if (this.activeTasks.get(taskId) !== task) throw continuationError("CONFLICT");
    return { active: true, taskId, revision: task.continuation.revision };
  }

  async renewRetainedTaskClaim(taskId, identity, ownership) {
    return this._retainedMutation(async snapshot => {
      const current = this._ownedRetainedTask(snapshot, taskId, identity);
      if (snapshot.activeTasks.get(taskId) !== current) throw continuationError("NOT_ACTIVE");
      await this._assertClaimOwnership(current, { ...ownership, agentId: identity.agentId });
      const renewed = await this.claimManager.renew(ownership.claimToken, this._claimContext(current), this.claimTtlMs);
      if (!renewed?.success) throw continuationError("CLAIM_UNAVAILABLE", 503);
      const task = { ...current, claim: { ...renewed.record } }; snapshot.activeTasks.set(taskId, task); return task;
    });
  }

  async claimRetainedTask(taskId, identity, expectedRevision) {
    let issued;
    try {
      return await this._retainedMutation(async snapshot => {
        const current = this._ownedRetainedTask(snapshot, taskId, identity);
        if (current.continuation.revision !== expectedRevision || !snapshot.queue.includes(current)
          || !continuationMayClaim(current.continuation)) throw continuationError("NOT_RESUMABLE");
        issued = await this.claimManager.issue({ planId: current.claimPlanId || current.planId, taskId, agentId: identity.agentId, ttlMs: this.claimTtlMs });
        if (!issued?.success) throw continuationError("CLAIM_UNAVAILABLE", 503);
        const task = { ...current, status: TASK_STATUS.IN_PROGRESS, assignedTo: identity.agentId,
          claim: { ...issued.record }, updatedAt: new Date().toISOString() };
        snapshot.queue.splice(snapshot.queue.indexOf(current), 1); snapshot.activeTasks.set(taskId, task);
        return { ...task, claimToken: issued.token };
      });
    } catch (error) {
      if (issued?.success) {
        try { await this.claimManager.revoke(issued.token, "retained_claim_not_committed"); }
        catch { this._retainedReady = false; Object.assign(error, { claimCleanupUnknown: true }); }
      }
      throw error;
    }
  }

  async checkpointRetainedTask(taskId, identity, ownership, expectedRevision, continuationInput, releaseClaim = false) {
    const result = await this._retainedMutation(async snapshot => {
      const current = this._ownedRetainedTask(snapshot, taskId, identity);
      if (!snapshot.activeTasks.has(taskId) || current.continuation.revision !== expectedRevision) throw continuationError("CONFLICT");
      await this._assertClaimOwnership(current, { ...ownership, agentId: identity.agentId });
      const continuation = advanceTaskContinuation(current.continuation, continuationInput);
      if (releaseClaim && !["prepared", "awaiting_confirmation", "paused", "completed", "failed", "cancelled", "unknown"].includes(continuation.phase)) throw continuationError("RELEASE_UNSAFE");
      const task = { ...current, continuation, updatedAt: new Date().toISOString() };
      if (releaseClaim) {
        snapshot.activeTasks.delete(taskId); task.assignedTo = null; task.claim = null;
        const claimable = continuationMayClaim(continuation);
        task.status = claimable ? TASK_STATUS.QUEUED : continuation.phase === "completed" ? TASK_STATUS.COMPLETED
          : continuation.phase === "cancelled" ? TASK_STATUS.CANCELLED : TASK_STATUS.FAILED;
        (claimable ? snapshot.queue : snapshot.completedTasks).push(task);
      } else snapshot.activeTasks.set(taskId, task);
      return task;
    });
    if (releaseClaim) await this.claimManager.revoke(ownership.claimToken, "retained_checkpoint_released");
    return result;
  }

  async _claimAtIndex(taskIndex, agentId, options, shouldPersist) {
    const task = this.queue[taskIndex];
    if (!task) return null;
    const issued = await this.claimManager.issue({
      planId: task.claimPlanId || task.planId,
      taskId: task.taskId,
      agentId,
      ttlMs: options.ttlMs ?? this.claimTtlMs,
    });
    if (!issued?.success) {
      const unavailable = issued?.code === "TASK_CLAIM_STORE_UNAVAILABLE"
        || issued?.code === "TASK_CLAIM_CAPACITY";
      throw queueError(
        issued?.code ?? "TASK_CLAIM_FAILED",
        issued?.reason ?? "Task claim failed.",
        unavailable ? 503 : 409,
      );
    }
    const currentTaskIndex = this.queue.findIndex((candidate) => candidate === task && candidate.taskId === task.taskId);
    if (currentTaskIndex === -1 || task.status !== TASK_STATUS.QUEUED) {
      await this.claimManager.revoke(issued.token, "queue_claim_race_lost");
      throw queueError("TASK_CLAIM_RACE_LOST", "The task moved before its claim could be committed.");
    }
    this.queue.splice(currentTaskIndex, 1);
    const timestamp = new Date().toISOString();
    Object.assign(task, {
      status: TASK_STATUS.ASSIGNED,
      assignedTo: agentId,
      startedAt: timestamp,
      updatedAt: timestamp,
      claim: issued.record,
    });
    this.activeTasks.set(task.taskId, task);
    const agentTasks = this.agentAssignments.get(agentId) ?? [];
    agentTasks.push({ taskId: task.taskId, assignedAt: timestamp });
    this.agentAssignments.set(agentId, agentTasks);
    this._audit(task.taskId, "claimed", {
      agentId,
      tokenFingerprint: issued.record.tokenFingerprint,
      fencingToken: issued.record.fencingToken,
    });
    if (shouldPersist) await this.persist();
    return { ...cloneTask(task), claimToken: issued.token };
  }

  async _assertClaimOwnership(task, ownership) {
    if (typeof ownership?.claimToken !== "string" || !ownership.claimToken) {
      throw queueError("TASK_CLAIM_REQUIRED", "A task claim token is required.", 403);
    }
    if (ownership.agentId && ownership.agentId !== task.assignedTo) {
      throw queueError("TASK_CLAIM_AGENT_MISMATCH", "The task is assigned to a different agent.", 403);
    }
    const validation = await this.claimManager.validate(ownership.claimToken, this._claimContext(task));
    if (!validation?.valid) {
      if (validation?.code === "TASK_CLAIM_STORE_UNAVAILABLE") {
        throw queueError(validation.code, validation.reason, 503);
      }
      throw queueError("TASK_CLAIM_INVALID", validation?.reason ?? "The task claim is invalid.", 403);
    }
    return validation;
  }

  _claimContext(task) {
    return {
      planId: task.claimPlanId || task.planId,
      taskId: task.taskId,
      agentId: task.assignedTo,
      fencingToken: task.claim?.fencingToken,
    };
  }

  _insertQueued(task) {
    const priority = normalizePriority(task.priority);
    task.priority = priority;
    const insertIndex = findPriorityInsertIndex(this.queue, PRIORITY_LEVELS[priority]);
    if (insertIndex === -1) this.queue.push(task);
    else this.queue.splice(insertIndex, 0, task);
  }

  _getActiveCountForAgent(agentId) {
    let count = 0;
    for (const task of this.activeTasks.values()) if (task.assignedTo === agentId) count += 1;
    return count;
  }

  _audit(taskId, action, details = {}) {
    this._auditLog.push({ taskId, action, ...details, timestamp: new Date().toISOString() });
    if (this._auditLog.length > 2_000) this._auditLog = this._auditLog.slice(-2_000);
  }
}
