import { randomUUID } from "node:crypto";
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
import { createTaskClaimTokenManager } from "./taskClaimToken.js";

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
    this.claimManager = options.claimManager ?? createTaskClaimTokenManager({
      ttlMs: this.claimTtlMs,
      maxClaims: MAX_QUEUE_SIZE * 2,
      clock: options.clock,
    });
    this._persistChain = Promise.resolve();
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.queueFile, "utf8");
      const data = JSON.parse(raw);
      this.queue = (Array.isArray(data.queue) ? data.queue : []).map((task) => ({
        ...task,
        planId: task.planId || task.payload?.planId || "standalone",
        dependsOnRoleIds: Array.isArray(task.dependsOnRoleIds) ? task.dependsOnRoleIds : [],
        claim: null,
      }));
      this.completedTasks = Array.isArray(data.completedTasks) ? data.completedTasks : [];
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
          dependsOnRoleIds: Array.isArray(persistedTask.dependsOnRoleIds) ? persistedTask.dependsOnRoleIds : [],
          status: TASK_STATUS.QUEUED,
          assignedTo: null,
          startedAt: null,
          updatedAt: new Date().toISOString(),
          claim: null,
          recoveryCount: Number(persistedTask.recoveryCount || 0) + 1,
          recoveredReason: "process_restart_invalidated_local_claim",
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
    if (task.claim) await this.claimManager.revokeTask({ planId: task.planId, taskId: task.taskId }, task.error);
    return cloneTask(task);
  }

  async renewTaskClaim(taskId, ownership = {}, extendMs) {
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

  async requeueTask(taskId) {
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
    };
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

  async persist() {
    if (this.completedTasks.length > MAX_COMPLETED_TASKS) this.completedTasks = this.completedTasks.slice(-MAX_COMPLETED_TASKS);
    const serialized = JSON.stringify({
      version: "2.0.0",
      updatedAt: new Date().toISOString(),
      queue: this.queue,
      activeTasks: [...this.activeTasks.values()],
      completedTasks: this.completedTasks,
      agentAssignments: Object.fromEntries(this.agentAssignments),
      auditLog: this._auditLog.slice(-500),
    }, null, 2);
    const operation = this._persistChain.then(async () => {
      await fs.mkdir(this.dataDir, { recursive: true });
      const temporaryPath = `${this.queueFile}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporaryPath, serialized, { encoding: "utf8", mode: 0o600 });
        await fs.rename(temporaryPath, this.queueFile);
      } finally {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
      }
    });
    this._persistChain = operation.catch(() => {});
    return operation;
  }

  close() {
    this.claimManager.close?.();
  }

  async _claimAtIndex(taskIndex, agentId, options, shouldPersist) {
    const task = this.queue[taskIndex];
    if (!task) return null;
    const issued = await this.claimManager.issue({
      planId: task.planId,
      taskId: task.taskId,
      agentId,
      ttlMs: options.ttlMs ?? this.claimTtlMs,
    });
    if (!issued?.success) throw queueError(issued?.code ?? "TASK_CLAIM_FAILED", issued?.reason ?? "Task claim failed.");
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
    if (!validation?.valid) throw queueError("TASK_CLAIM_INVALID", validation?.reason ?? "The task claim is invalid.", 403);
    return validation;
  }

  _claimContext(task) {
    return {
      planId: task.planId,
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
