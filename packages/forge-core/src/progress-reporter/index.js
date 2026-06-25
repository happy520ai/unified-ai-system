/**
 * ProgressReporter — tracks real-time progress of goals with metrics, ETA, and event subscriptions.
 *
 * Provides:
 *   - Per-goal task-level progress tracking (started, completed, failed)
 *   - Completion percentage, ETA estimation, throughput calculation
 *   - Current phase detection based on task types in flight
 *   - Structured progress objects and human-readable formatted strings
 *   - Event subscription for task_started, task_completed, goal_completed
 *
 * Usage:
 *   const reporter = new ProgressReporter();
 *   reporter.on('task_completed', ({ goalId, taskId, success }) => { ... });
 *   reporter.startGoal('g-abc', 7, 'Add JWT authentication');
 *   reporter.taskStarted('g-abc', 't-1', 'coder', 'Explore auth module');
 *   reporter.taskCompleted('g-abc', 't-1', true, 12000);
 *   console.log(reporter.formatProgress('g-abc'));
 *
 * @module progress-reporter
 */

import { EventEmitter } from 'node:events';

/**
 * Phase classification order — used to determine the "current phase" label
 * based on the types of tasks currently running or most recently completed.
 */
const PHASE_ORDER = [
  { key: 'exploring',   types: new Set(['explore']) },
  { key: 'planning',    types: new Set(['plan']) },
  { key: 'implementing', types: new Set(['implement', 'refactor']) },
  { key: 'testing',     types: new Set(['test']) },
  { key: 'verifying',   types: new Set(['verify', 'review', 'debug']) },
];

/**
 * @typedef {object} GoalProgressState
 * @property {string} goalId
 * @property {string} goalText
 * @property {number} totalTasks
 * @property {number} completedTasks
 * @property {number} failedTasks
 * @property {number} startedAt — epoch ms when goal tracking began
 * @property {number|null} completedAt — epoch ms when goal finished
 * @property {string} status — 'in_progress' | 'completed' | 'failed'
 * @property {Map<string, { taskId: string, workerType: string, taskName: string, startedAt: number, completedAt: number|null, success: boolean|null, durationMs: number|null }>} tasks
 */

export class ProgressReporter {
  /** @type {EventEmitter} */
  #emitter;

  /** @type {Map<string, GoalProgressState>} */
  #goals = new Map();

  constructor() {
    this.#emitter = new EventEmitter();
    this.#emitter.setMaxListeners(50);
  }

  // ── Event Subscriptions ────────────────────────────────────────────────────

  /**
   * Subscribe to a progress event.
   *
   * Available events:
   *   - 'task_started'    : { goalId, taskId, workerType, taskName }
   *   - 'task_completed'  : { goalId, taskId, success, durationMs }
   *   - 'goal_completed'  : { goalId, status, totalDurationMs, completedTasks, failedTasks, totalTasks }
   *
   * @param {string} event — event name
   * @param {Function} callback — handler
   * @returns {ProgressReporter} — this instance, for chaining
   */
  on(event, callback) {
    this.#emitter.on(event, callback);
    return this;
  }

  /**
   * Subscribe to a progress event, fire once only.
   *
   * @param {string} event
   * @param {Function} callback
   * @returns {ProgressReporter}
   */
  once(event, callback) {
    this.#emitter.once(event, callback);
    return this;
  }

  /**
   * Remove a specific event listener.
   *
   * @param {string} event
   * @param {Function} callback
   * @returns {ProgressReporter}
   */
  off(event, callback) {
    this.#emitter.off(event, callback);
    return this;
  }

  // ── Goal Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Begin tracking progress for a goal.
   *
   * @param {string} goalId — the goal identifier
   * @param {number} totalTasks — total number of tasks in the goal DAG
   * @param {string} goalText — human-readable goal description
   */
  startGoal(goalId, totalTasks, goalText) {
    this.#goals.set(goalId, {
      goalId,
      goalText: goalText || '',
      totalTasks,
      completedTasks: 0,
      failedTasks: 0,
      startedAt: Date.now(),
      completedAt: null,
      status: 'in_progress',
      tasks: new Map(),
    });
  }

  /**
   * Record that a task has started executing.
   *
   * @param {string} goalId
   * @param {string} taskId
   * @param {string} workerType — the agent role (coder, tester, verifier, etc.)
   * @param {string} [taskName] — human-readable task name
   */
  taskStarted(goalId, taskId, workerType, taskName) {
    const goal = this.#goals.get(goalId);
    if (!goal) return;

    goal.tasks.set(taskId, {
      taskId,
      workerType: workerType || 'unknown',
      taskName: taskName || taskId,
      startedAt: Date.now(),
      completedAt: null,
      success: null,
      durationMs: null,
    });

    this.#emitter.emit('task_started', {
      goalId,
      taskId,
      workerType,
      taskName: taskName || taskId,
    });
  }

  /**
   * Record that a task has completed.
   *
   * @param {string} goalId
   * @param {string} taskId
   * @param {boolean} success — whether the task succeeded
   * @param {number} durationMs — execution duration in milliseconds
   */
  taskCompleted(goalId, taskId, success, durationMs) {
    const goal = this.#goals.get(goalId);
    if (!goal) return;

    const task = goal.tasks.get(taskId);
    if (task) {
      task.completedAt = Date.now();
      task.success = success;
      task.durationMs = durationMs ?? (task.completedAt - task.startedAt);
    }

    if (success) {
      goal.completedTasks++;
    } else {
      goal.failedTasks++;
    }

    this.#emitter.emit('task_completed', {
      goalId,
      taskId,
      success,
      durationMs: durationMs ?? task?.durationMs ?? 0,
    });
  }

  /**
   * Record that the entire goal has completed.
   *
   * @param {string} goalId
   * @param {string} status — 'completed' | 'failed' | 'budget_exceeded' | 'cancelled'
   * @param {number} [totalDurationMs] — total goal duration (defaults to now - startedAt)
   */
  goalCompleted(goalId, status, totalDurationMs) {
    const goal = this.#goals.get(goalId);
    if (!goal) return;

    goal.status = status;
    goal.completedAt = Date.now();
    const duration = totalDurationMs ?? (goal.completedAt - goal.startedAt);

    this.#emitter.emit('goal_completed', {
      goalId,
      status,
      totalDurationMs: duration,
      completedTasks: goal.completedTasks,
      failedTasks: goal.failedTasks,
      totalTasks: goal.totalTasks,
    });
  }

  // ── Progress Queries ────────────────────────────────────────────────────────

  /**
   * Get structured progress data for a goal.
   *
   * @param {string} goalId
   * @returns {{ goalId: string, goalText: string, status: string, totalTasks: number, completedTasks: number, failedTasks: number, pendingTasks: number, percentComplete: number, etaMs: number|null, currentPhase: string, throughputPerMinute: number, elapsedMs: number, tasks: Array<object> }|null}
   */
  getProgress(goalId) {
    const goal = this.#goals.get(goalId);
    if (!goal) return null;

    const now = Date.now();
    const elapsedMs = now - goal.startedAt;
    const totalDone = goal.completedTasks + goal.failedTasks;
    const pendingTasks = goal.totalTasks - totalDone;
    const percentComplete = goal.totalTasks > 0
      ? Math.round((goal.completedTasks / goal.totalTasks) * 100)
      : 0;

    // ETA: average successful task duration * remaining tasks
    let etaMs = null;
    if (goal.completedTasks > 0 && pendingTasks > 0 && goal.status === 'in_progress') {
      const successDurations = [...goal.tasks.values()]
        .filter(t => t.success && t.durationMs != null)
        .map(t => t.durationMs);
      if (successDurations.length > 0) {
        const avgDuration = successDurations.reduce((a, b) => a + b, 0) / successDurations.length;
        etaMs = Math.round(avgDuration * pendingTasks);
      }
    }

    // Current phase: determined by the most advanced phase among active/completed tasks
    const currentPhase = this.#detectPhase(goal);

    // Throughput: completed tasks per minute
    const elapsedMinutes = elapsedMs / 60_000;
    const throughputPerMinute = elapsedMinutes > 0
      ? parseFloat((goal.completedTasks / elapsedMinutes).toFixed(2))
      : 0;

    return {
      goalId: goal.goalId,
      goalText: goal.goalText,
      status: goal.status,
      totalTasks: goal.totalTasks,
      completedTasks: goal.completedTasks,
      failedTasks: goal.failedTasks,
      pendingTasks,
      percentComplete,
      etaMs,
      currentPhase,
      throughputPerMinute,
      elapsedMs,
      tasks: [...goal.tasks.values()].map(t => ({
        taskId: t.taskId,
        workerType: t.workerType,
        taskName: t.taskName,
        success: t.success,
        durationMs: t.durationMs,
        running: t.completedAt === null && t.startedAt > 0,
      })),
    };
  }

  /**
   * Format progress as a human-readable single-line string.
   *
   * Example: "⠋ [3/7] Implementing auth module (42%) — ETA: 2m 30s"
   *
   * @param {string} goalId
   * @returns {string}
   */
  formatProgress(goalId) {
    const progress = this.getProgress(goalId);
    if (!progress) return `[${goalId}] No progress data`;

    const { completedTasks, totalTasks, percentComplete, currentPhase, etaMs, status, goalText } = progress;

    // Phase label: capitalize first letter
    const phaseLabel = currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1);

    // Short goal description
    const shortText = goalText.length > 30 ? goalText.slice(0, 27) + '...' : goalText;

    // Spinner frame based on elapsed time
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const frameIdx = Math.floor(Date.now() / 200) % spinnerFrames.length;
    const frame = status === 'in_progress' ? spinnerFrames[frameIdx] : (status === 'completed' ? '✓' : '✗');

    // ETA string
    let etaStr = '';
    if (status === 'in_progress' && etaMs != null) {
      etaStr = ` — ETA: ${this.#formatDuration(etaMs)}`;
    }

    return `${frame} [${completedTasks}/${totalTasks}] ${phaseLabel} ${shortText} (${percentComplete}%)${etaStr}`;
  }

  /**
   * Format a final summary with all stats for a completed goal.
   *
   * @param {string} goalId
   * @returns {string}
   */
  formatSummary(goalId) {
    const progress = this.getProgress(goalId);
    if (!progress) return `[${goalId}] No progress data`;

    const {
      goalText, status, totalTasks, completedTasks, failedTasks,
      pendingTasks, percentComplete, elapsedMs, throughputPerMinute,
      tasks,
    } = progress;

    const lines = [];
    const statusIcon = status === 'completed' ? '✓' : status === 'failed' ? '✗' : '⊘';

    lines.push(`${statusIcon} Goal: ${goalText}`);
    lines.push(`  Status:    ${status}`);
    lines.push(`  Tasks:     ${completedTasks}/${totalTasks} completed, ${failedTasks} failed, ${pendingTasks} pending`);
    lines.push(`  Progress:  ${percentComplete}%`);
    lines.push(`  Duration:  ${this.#formatDuration(elapsedMs)}`);
    lines.push(`  Throughput: ${throughputPerMinute} tasks/min`);

    if (tasks.length > 0) {
      lines.push('');
      lines.push('  Task Breakdown:');
      for (const t of tasks) {
        const icon = t.success === true ? '✓' : t.success === false ? '✗' : '⏳';
        const dur = t.durationMs != null ? ` (${this.#formatDuration(t.durationMs)})` : '';
        lines.push(`    ${icon} [${t.workerType}] ${t.taskName}${dur}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get all tracked goal IDs.
   *
   * @returns {string[]}
   */
  getTrackedGoalIds() {
    return [...this.#goals.keys()];
  }

  /**
   * Remove tracking data for a goal.
   *
   * @param {string} goalId
   */
  removeGoal(goalId) {
    this.#goals.delete(goalId);
  }

  /**
   * Clear all tracked progress data.
   */
  clear() {
    this.#goals.clear();
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  /**
   * Detect the current phase based on task types in flight or recently completed.
   *
   * @param {GoalProgressState} goal
   * @returns {string}
   */
  #detectPhase(goal) {
    // Check currently running tasks first (most relevant)
    const runningTasks = [...goal.tasks.values()].filter(t => t.completedAt === null);
    if (runningTasks.length > 0) {
      for (const phase of PHASE_ORDER) {
        if (runningTasks.some(t => phase.types.has(t.workerType))) {
          return phase.key;
        }
      }
    }

    // Fall back to most recently completed task type
    const completedTasks = [...goal.tasks.values()]
      .filter(t => t.completedAt !== null)
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    if (completedTasks.length > 0) {
      for (const phase of PHASE_ORDER) {
        if (completedTasks.some(t => phase.types.has(t.workerType))) {
          return phase.key;
        }
      }
    }

    return 'exploring';
  }

  /**
   * Format a duration in milliseconds as a human-readable string.
   *
   * @param {number} ms
   * @returns {string}
   */
  #formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
  }
}
