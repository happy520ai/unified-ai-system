import { randomUUID } from "crypto";
import { PRIORITY_LEVELS, TASK_STATUS } from "./taskQueueConstants.js";

/**
 * Pure helper functions for the Task Queue Manager.
 *
 * All functions in this module are side-effect-free and receive their
 * data through parameters, making them easy to test and reuse.
 */

/* ------------------------------------------------------------------ */
/*  Small utilities                                                    */
/* ------------------------------------------------------------------ */

/**
 * Normalise a priority string to a valid PRIORITY_LEVELS key.
 * @param {string|undefined} priority
 * @returns {string}
 */
export function normalizePriority(priority) {
  const key = String(priority ?? "P3").toUpperCase();
  return PRIORITY_LEVELS[key] ? key : "P3";
}

/**
 * Format milliseconds into a human-readable duration.
 * @param {number} ms
 * @returns {string}
 */
export function humanDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

/**
 * Build a full task record from user-supplied input.
 * @param {object} task  Raw task input
 * @returns {object}     Complete task record ready for the queue
 */
export function buildTaskRecord(task) {
  const priority = normalizePriority(task.priority);
  const priorityMeta = PRIORITY_LEVELS[priority];

  return {
    taskId: randomUUID(),
    title: task.title ?? "Untitled task",
    description: task.description ?? "",
    priority,
    priorityName: priorityMeta.name,
    type: task.type ?? "general",
    payload: task.payload ?? {},
    requiredSkills: Array.isArray(task.requiredSkills) ? task.requiredSkills : [],
    requestedBy: task.requestedBy ?? "system",
    status: TASK_STATUS.QUEUED,
    retryCount: 0,
    maxRetries: task.maxRetries ?? 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaDeadline: Date.now() + priorityMeta.sla,
    assignedTo: null,
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
  };
}

/**
 * Find the insertion index for a task in a priority-sorted queue (P1 first).
 * @param {object[]} queue
 * @param {object}   priorityMeta
 * @returns {number} Index to splice at, or -1 to append.
 */
export function findPriorityInsertIndex(queue, priorityMeta) {
  return queue.findIndex(
    (t) => PRIORITY_LEVELS[t.priority].level > priorityMeta.level
  );
}

/* ------------------------------------------------------------------ */
/*  Auto-assignment engine                                             */
/* ------------------------------------------------------------------ */

/**
 * Pure auto-assignment computation.
 *
 * Given the current queue, active tasks, and agent assignments, determine
 * which tasks should be assigned to which agents.
 *
 * @param {object[]} queue
 * @param {Map<string, object>} activeTasks      taskId -> task
 * @param {Map<string, object[]>} agentAssignments agentId -> [{taskId, assignedAt}]
 * @param {object} [options]
 * @param {string[]} [options.agentIds]
 * @param {number}   [options.maxConcurrentPerAgent=5]
 * @param {function} [options.getActiveCount]     (agentId) => number
 * @returns {object} { assignments, remaining, updatedAgentAssignments }
 */
export function runAutoAssignment(queue, activeTasks, agentAssignments, options = {}) {
  const maxConcurrent = options.maxConcurrentPerAgent ?? 5;
  let agentIds = options.agentIds ?? Array.from(agentAssignments.keys());

  if (agentIds.length === 0) {
    agentIds = ["agent-alpha", "agent-beta", "agent-gamma"];
  }

  const assignments = [];
  const agentLoads = new Map();
  const getActiveCount = options.getActiveCount ?? (() => 0);

  for (const agentId of agentIds) {
    agentLoads.set(agentId, getActiveCount(agentId));
  }

  const remaining = [];

  for (const task of queue) {
    if (task.status !== TASK_STATUS.QUEUED) {
      remaining.push(task);
      continue;
    }

    let bestAgent = null;
    let bestLoad = Infinity;

    for (const agentId of agentIds) {
      const load = agentLoads.get(agentId) ?? 0;
      if (load < maxConcurrent && load < bestLoad) {
        bestAgent = agentId;
        bestLoad = load;
      }
    }

    if (!bestAgent) {
      remaining.push(task);
      continue;
    }

    const now = new Date().toISOString();
    task.status = TASK_STATUS.ASSIGNED;
    task.assignedTo = bestAgent;
    task.startedAt = now;
    task.updatedAt = now;

    activeTasks.set(task.taskId, task);

    const agentTasks = agentAssignments.get(bestAgent) ?? [];
    agentTasks.push({ taskId: task.taskId, assignedAt: now });
    agentAssignments.set(bestAgent, agentTasks);

    agentLoads.set(bestAgent, bestLoad + 1);

    assignments.push({
      taskId: task.taskId,
      title: task.title,
      priority: task.priority,
      agentId: bestAgent,
    });
  }

  return { assignments, remaining, updatedAgentAssignments: agentAssignments };
}

/* ------------------------------------------------------------------ */
/*  SLA compliance engine                                              */
/* ------------------------------------------------------------------ */

/**
 * Compute SLA breaches and at-risk tasks.
 *
 * @param {object[]} queue
 * @param {Iterable<object>} activeTasks
 * @returns {{ breaches: object[], atRisk: object[] }}
 */
export function computeSLACompliance(queue, activeTasks) {
  const now = Date.now();
  const breaches = [];
  const atRisk = [];

  const check = (task, status, assignedTo) => {
    const remaining = task.slaDeadline - now;
    if (remaining <= 0) {
      const entry = {
        taskId: task.taskId,
        title: task.title,
        priority: task.priority,
        status,
        overdueMs: Math.abs(remaining),
      };
      if (assignedTo !== undefined) entry.assignedTo = assignedTo;
      breaches.push(entry);
    } else if (remaining < PRIORITY_LEVELS[task.priority].sla * 0.2) {
      const entry = {
        taskId: task.taskId,
        title: task.title,
        priority: task.priority,
        status,
        remainingMs: remaining,
      };
      if (assignedTo !== undefined) entry.assignedTo = assignedTo;
      atRisk.push(entry);
    }
  };

  for (const task of queue) check(task, "queued");
  for (const task of activeTasks) check(task, task.status, task.assignedTo);

  return { breaches, atRisk };
}

/* ------------------------------------------------------------------ */
/*  Statistics engine                                                  */
/* ------------------------------------------------------------------ */

/**
 * Compute comprehensive queue statistics.
 *
 * @param {object[]}   queue
 * @param {object[]}   activeTasksArr
 * @param {object[]}   completedTasks
 * @param {number}     agentCount
 * @returns {object}
 */
export function computeStats(queue, activeTasksArr, completedTasks, agentCount) {
  const completed = completedTasks.filter((t) => t.status === TASK_STATUS.COMPLETED);
  const failed = completedTasks.filter((t) => t.status === TASK_STATUS.FAILED);

  const completionTimes = completed
    .filter((t) => t.startedAt && t.completedAt)
    .map((t) => new Date(t.completedAt) - new Date(t.startedAt));
  const avgCompletionMs = completionTimes.length
    ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
    : 0;

  const oneHourAgo = Date.now() - 3_600_000;
  const recentCompleted = completed.filter(
    (t) => t.completedAt && new Date(t.completedAt).getTime() > oneHourAgo
  ).length;

  const priorityBreakdown = {};
  for (const key of Object.keys(PRIORITY_LEVELS)) {
    priorityBreakdown[key] = {
      queued: queue.filter((t) => t.priority === key).length,
      active: activeTasksArr.filter((t) => t.priority === key).length,
      completed: completed.filter((t) => t.priority === key).length,
      failed: failed.filter((t) => t.priority === key).length,
    };
  }

  return {
    queue: {
      pending: queue.length,
      active: activeTasksArr.length,
      completed: completed.length,
      failed: failed.length,
      total: queue.length + activeTasksArr.length + completedTasks.length,
    },
    performance: {
      avgCompletionMs,
      avgCompletionHuman: humanDuration(avgCompletionMs),
      recentThroughput: recentCompleted,
      throughputWindow: "1h",
      successRate: completed.length + failed.length > 0
        ? `${((completed.length / (completed.length + failed.length)) * 100).toFixed(1)  }%`
        : "N/A",
    },
    priorityBreakdown,
    agents: agentCount,
  };
}
