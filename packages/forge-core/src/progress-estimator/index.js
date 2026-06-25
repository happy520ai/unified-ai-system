/**
 * @fileoverview Progress Estimator for the Forge code generation engine.
 * Tracks task completion per goal and calculates estimated time of arrival (ETA)
 * based on observed task durations and failure rates.
 * @module progress-estimator
 */

/** Default assumed task duration when fewer than 2 tasks have been recorded (ms). */
const DEFAULT_TASK_DURATION_MS = 30_000;

/** Completed-task count below which confidence is 'low'. */
const LOW_CONFIDENCE_THRESHOLD = 2;

/** Completed-task count at or above which confidence is 'high'. */
const HIGH_CONFIDENCE_THRESHOLD = 5;

/** Failure rate (failed / finished) above which a buffer is added to the ETA. */
const FAILURE_RATE_BUFFER_THRESHOLD = 0.3;

/** Multiplier applied to the ETA when the failure rate exceeds the threshold. */
const FAILURE_RATE_BUFFER_MULTIPLIER = 1.2;

/**
 * Internal tracking state for a single goal.
 *
 * @typedef {Object} GoalState
 * @property {number} totalTasks
 * @property {number} tasksCompleted
 * @property {number} tasksFailed
 * @property {number} tasksCancelled
 * @property {number} startedAt - Epoch ms when the goal was first registered.
 * @property {Map<string, TaskRecord>} taskCompletions
 */

/**
 * Record stored for every individually tracked task completion.
 *
 * @typedef {Object} TaskRecord
 * @property {string} taskId
 * @property {number} durationMs
 * @property {string} taskType
 * @property {number} completedAt - Epoch ms when the record was created.
 */

/**
 * ETA information returned as part of a goal's progress report.
 *
 * @typedef {Object} ETAInfo
 * @property {number} estimatedSeconds - Whole seconds until estimated completion.
 * @property {string} estimatedCompletionAt - ISO-8601 timestamp of estimated completion.
 * @property {'low'|'medium'|'high'} confidence - Confidence level of the estimate.
 * @property {number} basedOn - Number of completed task records used for the estimate.
 */

/**
 * Full progress snapshot returned by {@link ProgressEstimator#getProgress}.
 *
 * @typedef {Object} GoalProgress
 * @property {string} goalId
 * @property {number} totalTasks
 * @property {number} completed - Successfully completed tasks.
 * @property {number} failed
 * @property {number} cancelled
 * @property {number} remaining - Tasks not yet finished (totalTasks - completed - failed - cancelled).
 * @property {number} percentComplete - Integer 0-100 based on successfully completed tasks.
 * @property {ETAInfo} eta
 * @property {number} avgTaskDurationMs - Rounded average duration of recorded task completions.
 * @property {number} elapsedMs - Milliseconds elapsed since the goal was first registered.
 */

/**
 * High-level status summary returned by {@link ProgressEstimator#getStatus}.
 *
 * @typedef {Object} StatusInfo
 * @property {number} trackedGoals - Number of goals currently being tracked.
 * @property {number} totalTasksCompleted - Sum of completed tasks across all tracked goals.
 */

/**
 * Tracks task completion per goal and calculates ETA for the Forge code generation engine.
 *
 * Goals are registered with {@link ProgressEstimator#trackGoal}, which sets the total task
 * count and current completion counters. Individual task completions can then be recorded
 * with {@link ProgressEstimator#recordTaskCompletion} to supply real timing data that
 * powers the ETA calculation.
 *
 * ETA confidence tiers:
 * - **low** — fewer than 2 recorded completions; uses a default of 30 s per task.
 * - **medium** — 2 to 4 recorded completions; uses the observed average.
 * - **high** — 5 or more recorded completions; uses the observed average.
 *
 * When the failure rate (failed / (completed + failed)) exceeds 30 %, a 20 % buffer is
 * added to the ETA to account for expected retries or instability.
 *
 * @example
 * import { ProgressEstimator } from './progress-estimator/index.js';
 *
 * const estimator = new ProgressEstimator();
 *
 * estimator.trackGoal('gen-api', {
 *   totalTasks: 10,
 *   tasksCompleted: 0,
 *   tasksFailed: 0,
 *   tasksCancelled: 0,
 * });
 *
 * estimator.recordTaskCompletion('gen-api', 'task-1', {
 *   durationMs: 5200,
 *   taskType: 'file-gen',
 * });
 *
 * console.log(estimator.getProgress('gen-api'));
 * console.log(estimator.getStatus());
 */
export class ProgressEstimator {
  /** @type {Map<string, GoalState>} */
  #goals = new Map();

  /** Creates a new, empty ProgressEstimator instance. */
  constructor() {
    // State is lazily populated via trackGoal / recordTaskCompletion.
  }

  /**
   * Registers or updates tracking state for a goal.
   *
   * On first call for a given `goalId` the goal's start timestamp is captured via
   * `Date.now()`. Subsequent calls update the counters while preserving the original
   * start timestamp and any previously recorded task completions.
   *
   * @param {string} goalId - Unique identifier for the goal.
   * @param {Object} state - Current goal counters.
   * @param {number} state.totalTasks - Total number of tasks that make up the goal.
   * @param {number} [state.tasksCompleted=0] - Number of successfully completed tasks.
   * @param {number} [state.tasksFailed=0] - Number of tasks that have failed.
   * @param {number} [state.tasksCancelled=0] - Number of tasks that have been cancelled.
   */
  trackGoal(goalId, { totalTasks, tasksCompleted = 0, tasksFailed = 0, tasksCancelled = 0 } = {}) {
    const existing = this.#goals.get(goalId);

    if (existing) {
      existing.totalTasks = totalTasks;
      existing.tasksCompleted = tasksCompleted;
      existing.tasksFailed = tasksFailed;
      existing.tasksCancelled = tasksCancelled;
    } else {
      this.#goals.set(goalId, {
        totalTasks,
        tasksCompleted,
        tasksFailed,
        tasksCancelled,
        startedAt: Date.now(),
        taskCompletions: new Map(),
      });
    }
  }

  /**
   * Records the completion of an individual task for granular timing analysis.
   *
   * If the goal has not yet been registered via {@link ProgressEstimator#trackGoal}, a
   * minimal goal state is auto-initialised so that timing data is never lost.
   *
   * @param {string} goalId - Identifier of the goal the task belongs to.
   * @param {string} taskId - Unique identifier for the completed task.
   * @param {Object} info - Completion metadata.
   * @param {number} info.durationMs - Wall-clock duration of the task in milliseconds.
   * @param {string} [info.taskType='unknown'] - Type or category of the task.
   */
  recordTaskCompletion(goalId, taskId, { durationMs, taskType = 'unknown' } = {}) {
    let goal = this.#goals.get(goalId);

    if (!goal) {
      // Auto-initialise so timing data is captured even if trackGoal was not called first.
      goal = {
        totalTasks: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksCancelled: 0,
        startedAt: Date.now(),
        taskCompletions: new Map(),
      };
      this.#goals.set(goalId, goal);
    }

    goal.taskCompletions.set(taskId, {
      taskId,
      durationMs,
      taskType,
      completedAt: Date.now(),
    });
  }

  /**
   * Computes and returns the current progress for a specific goal.
   *
   * The ETA is derived from the average duration of individually recorded task
   * completions. When fewer than 2 completions are on record the estimator falls
   * back to a default of 30 seconds per remaining task and reports low confidence.
   *
   * @param {string} goalId - Identifier of the goal to query.
   * @returns {GoalProgress|null} Progress snapshot, or `null` if the goal is not tracked.
   */
  getProgress(goalId) {
    const goal = this.#goals.get(goalId);
    if (!goal) return null;

    const {
      totalTasks,
      tasksCompleted,
      tasksFailed,
      tasksCancelled,
      startedAt,
      taskCompletions,
    } = goal;

    const now = Date.now();
    const elapsedMs = now - startedAt;

    // Remaining tasks are those not yet in any terminal state.
    const remaining = Math.max(0, totalTasks - tasksCompleted - tasksFailed - tasksCancelled);

    // Percent complete reflects successful completions only.
    const percentComplete = totalTasks > 0
      ? Math.min(100, Math.round((tasksCompleted / totalTasks) * 100))
      : 0;

    // Average task duration from individually recorded completions.
    const completionRecords = Array.from(taskCompletions.values());
    const completionCount = completionRecords.length;

    let avgTaskDurationMs = 0;
    if (completionCount > 0) {
      const totalDuration = completionRecords.reduce((sum, r) => sum + r.durationMs, 0);
      avgTaskDurationMs = totalDuration / completionCount;
    }

    // Determine confidence tier and the effective per-task duration used for ETA.
    /** @type {'low'|'medium'|'high'} */
    let confidence;
    let effectiveDurationMs;

    if (completionCount < LOW_CONFIDENCE_THRESHOLD) {
      confidence = 'low';
      effectiveDurationMs = DEFAULT_TASK_DURATION_MS;
    } else if (completionCount < HIGH_CONFIDENCE_THRESHOLD) {
      confidence = 'medium';
      effectiveDurationMs = avgTaskDurationMs;
    } else {
      confidence = 'high';
      effectiveDurationMs = avgTaskDurationMs;
    }

    // Base ETA in seconds.
    let estimatedSeconds = (remaining * effectiveDurationMs) / 1000;

    // Apply a 20 % buffer when the failure rate exceeds 30 %.
    const finishedTasks = tasksCompleted + tasksFailed;
    if (finishedTasks > 0) {
      const failureRate = tasksFailed / finishedTasks;
      if (failureRate > FAILURE_RATE_BUFFER_THRESHOLD) {
        estimatedSeconds *= FAILURE_RATE_BUFFER_MULTIPLIER;
      }
    }

    estimatedSeconds = Math.round(estimatedSeconds);

    const estimatedCompletionAt = new Date(now + estimatedSeconds * 1000).toISOString();

    return {
      goalId,
      totalTasks,
      completed: tasksCompleted,
      failed: tasksFailed,
      cancelled: tasksCancelled,
      remaining,
      percentComplete,
      eta: {
        estimatedSeconds,
        estimatedCompletionAt,
        confidence,
        basedOn: completionCount,
      },
      avgTaskDurationMs: Math.round(avgTaskDurationMs),
      elapsedMs,
    };
  }

  /**
   * Returns progress snapshots for all currently tracked goals.
   *
   * @returns {GoalProgress[]} Array of progress objects, one per tracked goal.
   */
  getAllProgress() {
    return Array.from(this.#goals.keys()).map((goalId) => this.getProgress(goalId));
  }

  /**
   * Removes all tracking state for a goal, freeing associated resources.
   *
   * @param {string} goalId - Identifier of the goal to remove.
   * @returns {boolean} `true` if the goal existed and was removed, `false` otherwise.
   */
  removeGoal(goalId) {
    return this.#goals.delete(goalId);
  }

  /**
   * Returns a high-level status summary across all tracked goals.
   *
   * @returns {StatusInfo} Object with `trackedGoals` count and `totalTasksCompleted`.
   */
  getStatus() {
    let totalTasksCompleted = 0;

    for (const goal of this.#goals.values()) {
      totalTasksCompleted += goal.tasksCompleted;
    }

    return {
      trackedGoals: this.#goals.size,
      totalTasksCompleted,
    };
  }
}

export default ProgressEstimator;
