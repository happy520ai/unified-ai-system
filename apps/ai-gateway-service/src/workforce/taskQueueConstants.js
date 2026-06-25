import path from "path";

/**
 * Constants for the Task Queue Manager.
 *
 * Shared between the manager class and pure helper functions.
 */

/** Persistence directory for workforce queue state. */
export const DATA_DIR = path.join(process.cwd(), ".data", "workforce");

/** File path for the persisted queue JSON. */
export const QUEUE_FILE = path.join(DATA_DIR, "task-queue.json");

/** Maximum tasks allowed in the queue to prevent unbounded growth. */
export const MAX_QUEUE_SIZE = 1000;

/** Maximum completed tasks to retain before trimming. */
export const MAX_COMPLETED_TASKS = 2000;

/**
 * Priority levels with SLA deadlines.
 * @enum {object}
 */
export const PRIORITY_LEVELS = {
  P1: { level: 1, name: "critical",   sla: 300_000 },      // 5 min
  P2: { level: 2, name: "high",       sla: 900_000 },      // 15 min
  P3: { level: 3, name: "medium",     sla: 3_600_000 },    // 1 hour
  P4: { level: 4, name: "low",        sla: 86_400_000 },   // 24 hours
  P5: { level: 5, name: "background", sla: 604_800_000 },  // 7 days
};

/** Task lifecycle states. */
export const TASK_STATUS = {
  QUEUED: "queued",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};
