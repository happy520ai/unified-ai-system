import fs from "fs/promises";
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
  runAutoAssignment,
  computeSLACompliance,
  computeStats,
} from "./taskQueueHelpers.js";

/**
 * Task Queue Manager for Agent Workforce
 *
 * Manages P1-P5 priority tasks, agent assignment, execution tracking,
 * SLA compliance, and automatic task distribution.
 *
 * All state is persisted under `.data/workforce/`.
 */

export { PRIORITY_LEVELS, TASK_STATUS };

export class TaskQueueManager {
  constructor() {
    /** @type {object[]} Tasks waiting to be claimed */
    this.queue = [];
    /** @type {Map<string, object>} taskId -> active task */
    this.activeTasks = new Map();
    /** @type {object[]} Completed / failed tasks */
    this.completedTasks = [];
    /** @type {Map<string, object[]>} agentId -> assigned taskIds */
    this.agentAssignments = new Map();
    /** @type {object[]} Audit log entries */
    this._auditLog = [];
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Initialise the queue manager and restore persisted state.
   */
  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const raw = await fs.readFile(QUEUE_FILE, "utf-8");
      const data = JSON.parse(raw);

      this.queue = Array.isArray(data.queue) ? data.queue : [];
      this.completedTasks = Array.isArray(data.completedTasks) ? data.completedTasks : [];
      this._auditLog = Array.isArray(data.auditLog) ? data.auditLog : [];

      this.activeTasks = new Map();
      for (const task of data.activeTasks ?? []) {
        this.activeTasks.set(task.taskId, task);
      }

      this.agentAssignments = new Map();
      for (const [agentId, tasks] of Object.entries(data.agentAssignments ?? {})) {
        this.agentAssignments.set(agentId, tasks);
      }
    } catch {
      // First run – no persisted state
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Core queue Operations                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Add a new task to the queue.
   *
   * @param {object} task
   * @param {string} task.title        Human-readable title
   * @param {string} task.description  Detailed description
   * @param {string} [task.priority]   P1-P5 (default P3)
   * @param {string} [task.type]       Task category (e.g. "code", "review", "deploy")
   * @param {object} [task.payload]    Arbitrary execution payload
   * @param {string[]} [task.requiredSkills]  Skills needed by the agent
   * @param {string} [task.requestedBy]      Originator identifier
   * @returns {Promise<object>}        The enqueued task record
   */
  async enqueue(task) {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error(`Queue is full (max ${MAX_QUEUE_SIZE} tasks). Complete or cancel existing tasks first.`);
    }

    const record = buildTaskRecord(task);
    const priorityMeta = PRIORITY_LEVELS[record.priority];

    const insertIndex = findPriorityInsertIndex(this.queue, priorityMeta);
    if (insertIndex === -1) {
      this.queue.push(record);
    } else {
      this.queue.splice(insertIndex, 0, record);
    }

    this._audit(record.taskId, "enqueued", { priority: record.priority });
    await this.persist();

    return { ...record };
  }

  /**
   * Claim the next available task for an agent.
   *
   * Tasks are assigned in priority order.  If the agent has reached the
   * maximum concurrent task limit (default 5), the claim is rejected.
   *
   * @param {string} agentId
   * @param {object} [options]
   * @param {number} [options.maxConcurrent=5]
   * @returns {Promise<object|null>}  Claimed task or null
   */
  async claimTask(agentId, options = {}) {
    if (!agentId) throw new Error("agentId is required to claim a task.");

    const maxConcurrent = options.maxConcurrent ?? 5;
    const currentLoad = this._getActiveCountForAgent(agentId);

    if (currentLoad >= maxConcurrent) {
      return null;
    }

    const taskIndex = this.queue.findIndex((task) => task.status === TASK_STATUS.QUEUED);
    if (taskIndex === -1) return null;

    const task = this.queue.splice(taskIndex, 1)[0];
    task.status = TASK_STATUS.ASSIGNED;
    task.assignedTo = agentId;
    task.startedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();

    this.activeTasks.set(task.taskId, task);

    const agentTasks = this.agentAssignments.get(agentId) ?? [];
    agentTasks.push({ taskId: task.taskId, assignedAt: task.startedAt });
    this.agentAssignments.set(agentId, agentTasks);

    this._audit(task.taskId, "claimed", { agentId });
    await this.persist();

    return { ...task };
  }

  /**
   * Update an active task's status.
   *
   * @param {string} taskId
   * @param {string} status   One of TASK_STATUS values
   * @param {object} [result] Optional result payload
   * @returns {Promise<object>}
   */
  async updateTaskStatus(taskId, status, result) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Active task not found: ${taskId}`);

    const validTransitions = {
      [TASK_STATUS.ASSIGNED]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED],
      [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED],
    };

    const allowed = validTransitions[task.status] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid status transition: ${task.status} -> ${status}. Allowed: ${allowed.join(", ")}`
      );
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    if (result !== undefined) task.result = result;

    this._audit(taskId, "status_updated", { status });
    await this.persist();

    return { ...task };
  }

  /**
   * Mark a task as completed.
   *
   * @param {string} taskId
   * @param {object} [result]
   * @returns {Promise<object>}
   */
  async completeTask(taskId, result) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Active task not found: ${taskId}`);

    task.status = TASK_STATUS.COMPLETED;
    task.completedAt = new Date().toISOString();
    task.updatedAt = task.completedAt;
    task.result = result ?? {};

    this.activeTasks.delete(taskId);
    this.completedTasks.push(task);

    this._audit(taskId, "completed", {
      duration: new Date(task.completedAt) - new Date(task.startedAt),
    });
    await this.persist();

    return { ...task };
  }

  /**
   * Mark a task as failed.
   *
   * @param {string} taskId
   * @param {string|Error} error
   * @returns {Promise<object>}
   */
  async failTask(taskId, error) {
    const task = this.activeTasks.get(taskId);
    if (!task) throw new Error(`Active task not found: ${taskId}`);

    task.status = TASK_STATUS.FAILED;
    task.completedAt = new Date().toISOString();
    task.updatedAt = task.completedAt;
    task.error = error instanceof Error ? error.message : String(error);
    task.retryCount += 1;

    this.activeTasks.delete(taskId);
    this.completedTasks.push(task);

    this._audit(taskId, "failed", { error: task.error, retryCount: task.retryCount });
    await this.persist();

    return { ...task };
  }

  /**
   * Re-queue a previously failed task if retries remain.
   *
   * @param {string} taskId
   * @returns {Promise<object>}
   */
  async requeueTask(taskId) {
    const idx = this.completedTasks.findIndex(
      (t) => t.taskId === taskId && t.status === TASK_STATUS.FAILED
    );
    if (idx === -1) {
      throw new Error(`Failed task not found: ${taskId}`);
    }

    const task = this.completedTasks[idx];
    if (task.retryCount >= task.maxRetries) {
      throw new Error(
        `Task ${taskId} has exhausted retries (${task.retryCount}/${task.maxRetries}).`
      );
    }

    this.completedTasks.splice(idx, 1);

    task.status = TASK_STATUS.QUEUED;
    task.assignedTo = null;
    task.startedAt = null;
    task.completedAt = null;
    task.error = null;
    task.result = null;
    task.updatedAt = new Date().toISOString();

    const priorityMeta = PRIORITY_LEVELS[task.priority];
    const insertIndex = findPriorityInsertIndex(this.queue, priorityMeta);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    this._audit(taskId, "requeued", { retryCount: task.retryCount });
    await this.persist();

    return { ...task };
  }

  /* ------------------------------------------------------------------ */
  /*  Query & Status                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Get a snapshot of the queue status.
   * @returns {object}
   */
  getQueueStatus() {
    const byPriority = {};
    for (const key of Object.keys(PRIORITY_LEVELS)) {
      byPriority[key] = this.queue.filter((t) => t.priority === key).length;
    }

    return {
      totalQueued: this.queue.length,
      totalActive: this.activeTasks.size,
      totalCompleted: this.completedTasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length,
      totalFailed: this.completedTasks.filter((t) => t.status === TASK_STATUS.FAILED).length,
      byPriority,
      agents: this.agentAssignments.size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all tasks matching a specific priority level.
   * @param {string} priority  P1-P5
   * @returns {object[]}
   */
  getTasksByPriority(priority) {
    const key = normalizePriority(priority);
    const queued = this.queue.filter((t) => t.priority === key);
    const active = Array.from(this.activeTasks.values()).filter((t) => t.priority === key);
    const completed = this.completedTasks.filter((t) => t.priority === key);

    return { priority: key, queued, active, completed };
  }

  /**
   * Get workload details for a specific agent.
   * @param {string} agentId
   * @returns {object}
   */
  getAgentWorkload(agentId) {
    const assignments = this.agentAssignments.get(agentId) ?? [];
    const active = Array.from(this.activeTasks.values()).filter(
      (t) => t.assignedTo === agentId
    );
    const completed = this.completedTasks.filter(
      (t) => t.assignedTo === agentId && t.status === TASK_STATUS.COMPLETED
    );
    const failed = this.completedTasks.filter(
      (t) => t.assignedTo === agentId && t.status === TASK_STATUS.FAILED
    );

    return {
      agentId,
      activeTasks: active.length,
      completedTasks: completed.length,
      failedTasks: failed.length,
      totalAssigned: assignments.length,
      active,
      recentCompleted: completed.slice(-5),
    };
  }

  /**
   * Check SLA compliance for all active and queued tasks.
   * @returns {object}
   */
  checkSLACompliance() {
    const { breaches, atRisk } = computeSLACompliance(
      this.queue,
      this.activeTasks.values()
    );

    return {
      compliant: breaches.length === 0,
      breaches,
      atRisk,
      checkedAt: new Date().toISOString(),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Auto-Assignment                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Automatically assign queued tasks to available agents.
   *
   * An agent is considered available if it has fewer active tasks than
   * `maxConcurrentPerAgent`.  Tasks are assigned in priority order.
   *
   * @param {object} [options]
   * @param {string[]} [options.agentIds]         Explicit list of agents
   * @param {number}   [options.maxConcurrentPerAgent=5]
   * @returns {Promise<object>}
   */
  async autoAssign(options = {}) {
    const { assignments, remaining } = runAutoAssignment(
      this.queue,
      this.activeTasks,
      this.agentAssignments,
      {
        ...options,
        getActiveCount: (agentId) => this._getActiveCountForAgent(agentId),
      }
    );

    for (const a of assignments) {
      this._audit(a.taskId, "auto_assigned", { agentId: a.agentId });
    }

    this.queue = remaining;
    await this.persist();

    return {
      assigned: assignments.length,
      assignments,
      unassigned: remaining.length,
      agentsUsed: new Set(assignments.map((a) => a.agentId)).size,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Statistics                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Get comprehensive queue statistics.
   * @returns {object}
   */
  getStats() {
    const activeTasksArr = Array.from(this.activeTasks.values());
    const base = computeStats(
      this.queue,
      activeTasksArr,
      this.completedTasks,
      this.agentAssignments.size
    );

    return {
      ...base,
      sla: this.checkSLACompliance(),
      timestamp: new Date().toISOString(),
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Persistence                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Persist the entire queue state to disk.
   */
  async persist() {
    if (this.completedTasks.length > MAX_COMPLETED_TASKS) {
      this.completedTasks = this.completedTasks.slice(-MAX_COMPLETED_TASKS);
    }

    const data = {
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      queue: this.queue,
      activeTasks: Array.from(this.activeTasks.values()),
      completedTasks: this.completedTasks,
      agentAssignments: Object.fromEntries(this.agentAssignments),
      auditLog: this._auditLog.slice(-500),
    };

    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmpPath = QUEUE_FILE + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmpPath, QUEUE_FILE);
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Count active tasks assigned to an agent.
   * @param {string} agentId
   * @returns {number}
   */
  _getActiveCountForAgent(agentId) {
    let count = 0;
    for (const task of this.activeTasks.values()) {
      if (task.assignedTo === agentId) count++;
    }
    return count;
  }

  /**
   * Append an audit log entry.
   * @param {string} taskId
   * @param {string} action
   * @param {object} [details]
   */
  _audit(taskId, action, details = {}) {
    this._auditLog.push({
      taskId,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
  }
}
