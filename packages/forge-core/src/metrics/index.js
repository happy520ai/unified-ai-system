/**
 * MetricsCollector — in-memory performance monitoring for Forge.
 *
 * Tracks task durations, success rates, worker-type breakdowns,
 * queue wait times, and time-series throughput.  Provides aggregated
 * snapshots for dashboard visualization and API consumption.
 */
export class MetricsCollector {
  /** Completed/failed task records. */
  #tasks = [];

  /** Goal completion records. */
  #goals = [];

  /** Verification event records. */
  #verifications = [];

  /** Sliding window for time-series data points (ms). */
  #seriesWindowMs;

  /** Max number of task records to retain. */
  #maxRecords;

  /** Track task start times for duration calculation. */
  #taskStartTimes = new Map(); // taskId → { startedAt, workerType, enqueuedAt }

  /**
   * @param {object} [opts]
   * @param {number} [opts.seriesWindowMs=1800000] — time-series sliding window in ms (default 30 min)
   * @param {number} [opts.maxRecords=5000] — max task records to retain
   */
  constructor({ seriesWindowMs = 1_800_000, maxRecords = 5000 } = {}) {
    this.#seriesWindowMs = seriesWindowMs;
    this.#maxRecords = maxRecords;
  }

  // ---------------------------------------------------------------------------
  // Recording methods
  // ---------------------------------------------------------------------------

  /**
   * Record that a task has started execution.
   *
   * @param {object} data
   * @param {string} data.taskId
   * @param {string} data.workerType
   * @param {number} [data.enqueuedAt] — epoch ms when the task was enqueued
   */
  recordTaskStart({ taskId, workerType, enqueuedAt }) {
    this.#taskStartTimes.set(taskId, {
      startedAt: Date.now(),
      workerType: workerType || 'unknown',
      enqueuedAt: enqueuedAt || null,
    });
  }

  /**
   * Record a completed task.
   *
   * @param {object} data
   * @param {string} data.taskId
   * @param {string} data.goalId
   * @param {string} [data.workerType]
   * @param {number} [data.durationMs] — explicit duration (preferred over internal timer)
   * @param {string[]} [data.filesModified]
   */
  recordTaskCompleted({ taskId, goalId, workerType, durationMs, filesModified }) {
    const info = this.#taskStartTimes.get(taskId);
    this.#taskStartTimes.delete(taskId);

    const duration = durationMs ?? (info ? Date.now() - info.startedAt : null);
    const wType = workerType || info?.workerType || 'unknown';
    const queueWait = info?.enqueuedAt ? info.startedAt - info.enqueuedAt : null;

    this.#tasks.push({
      taskId,
      goalId,
      status: 'completed',
      workerType: wType,
      durationMs: duration,
      queueWaitMs: queueWait,
      filesModified: filesModified?.length || 0,
      timestamp: Date.now(),
    });

    this.#trimRecords();
  }

  /**
   * Record a failed task.
   *
   * @param {object} data
   * @param {string} data.taskId
   * @param {string} data.goalId
   * @param {string} [data.workerType]
   * @param {number} [data.durationMs]
   * @param {string} [data.error]
   * @param {boolean} [data.retried]
   */
  recordTaskFailed({ taskId, goalId, workerType, durationMs, error, retried }) {
    const info = this.#taskStartTimes.get(taskId);
    this.#taskStartTimes.delete(taskId);

    const duration = durationMs ?? (info ? Date.now() - info.startedAt : null);
    const wType = workerType || info?.workerType || 'unknown';
    const queueWait = info?.enqueuedAt ? info.startedAt - info.enqueuedAt : null;

    this.#tasks.push({
      taskId,
      goalId,
      status: 'failed',
      workerType: wType,
      durationMs: duration,
      queueWaitMs: queueWait,
      error: (error || '').substring(0, 200),
      retried: !!retried,
      timestamp: Date.now(),
    });

    this.#trimRecords();
  }

  /**
   * Record a goal completion event.
   *
   * @param {object} data
   * @param {string} data.goalId
   * @param {string} data.status
   * @param {number} data.completedTasks
   * @param {number} data.failedTasks
   * @param {number} data.totalTasks
   */
  recordGoalCompleted({ goalId, status, completedTasks, failedTasks, totalTasks }) {
    this.#goals.push({
      goalId,
      status,
      completedTasks,
      failedTasks,
      totalTasks,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a verification event.
   *
   * @param {object} data
   * @param {string} data.taskId
   * @param {string} data.event — 'started' | 'passed' | 'failed'
   * @param {number} [data.durationMs]
   * @param {number} [data.failureCount]
   */
  recordVerification({ taskId, event, durationMs, failureCount }) {
    this.#verifications.push({
      taskId,
      event,
      durationMs: durationMs || null,
      failureCount: failureCount || 0,
      timestamp: Date.now(),
    });
  }

  // ---------------------------------------------------------------------------
  // Query methods
  // ---------------------------------------------------------------------------

  /**
   * Get time-series data points within the sliding window.
   *
   * @param {number} [windowMs] — override window size
   * @returns {Array<{ timestamp: number, status: string, workerType: string, durationMs: number|null }>}
   */
  getTimeSeries(windowMs) {
    const cutoff = Date.now() - (windowMs || this.#seriesWindowMs);
    return this.#tasks
      .filter(t => t.timestamp >= cutoff)
      .map(t => ({
        timestamp: t.timestamp,
        status: t.status,
        workerType: t.workerType,
        durationMs: t.durationMs,
      }));
  }

  /**
   * Get full aggregated metrics snapshot.
   *
   * @returns {object}
   */
  getMetrics() {
    return {
      tasks: this.#getTaskStats(),
      goals: this.#getGoalStats(),
      workerTypes: this.#getWorkerTypeStats(),
      queueWait: this.#getQueueWaitStats(),
      verifications: this.#getVerificationStats(),
      throughput: this.#getThroughput(),
      timeSeries: this.getTimeSeries(),
      uptime: process.uptime(),
      timestamp: Date.now(),
    };
  }

  /**
   * Lightweight summary for embedding in status responses.
   */
  getSummary() {
    const m = this.getMetrics();
    return {
      totalTasks: m.tasks.total,
      successRate: m.tasks.successRate,
      avgDurationMs: m.tasks.avgDurationMs,
      p95DurationMs: m.tasks.p95DurationMs,
      throughputPerMin: m.throughput.perMinute,
      goalsCompleted: m.goals.completed,
      goalsFailed: m.goals.failed,
    };
  }

  /** Reset all collected metrics. */
  reset() {
    this.#tasks.length = 0;
    this.#goals.length = 0;
    this.#verifications.length = 0;
    this.#taskStartTimes.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal aggregation helpers
  // ---------------------------------------------------------------------------

  #getTaskStats() {
    const all = this.#tasks;
    const completed = all.filter(t => t.status === 'completed');
    const failed = all.filter(t => t.status === 'failed');
    const total = all.length;

    const durations = completed
      .map(t => t.durationMs)
      .filter(d => d != null && d >= 0)
      .sort((a, b) => a - b);

    return {
      total,
      completed: completed.length,
      failed: failed.length,
      successRate: total > 0 ? completed.length / total : 0,
      avgDurationMs: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
      p50DurationMs: this.#percentile(durations, 50),
      p95DurationMs: this.#percentile(durations, 95),
      p99DurationMs: this.#percentile(durations, 99),
      minDurationMs: durations[0] ?? null,
      maxDurationMs: durations[durations.length - 1] ?? null,
    };
  }

  #getGoalStats() {
    return {
      total: this.#goals.length,
      completed: this.#goals.filter(g => g.status === 'completed').length,
      failed: this.#goals.filter(g => g.status === 'failed').length,
      cancelled: this.#goals.filter(g => g.status === 'cancelled').length,
      avgTasksPerGoal: this.#goals.length > 0
        ? Math.round(this.#goals.reduce((a, g) => a + g.totalTasks, 0) / this.#goals.length)
        : null,
    };
  }

  #getWorkerTypeStats() {
    const types = {};
    for (const t of this.#tasks) {
      const wt = t.workerType || 'unknown';
      if (!types[wt]) {
        types[wt] = { count: 0, completed: 0, failed: 0, totalDurationMs: 0, durations: [] };
      }
      types[wt].count++;
      if (t.status === 'completed') {
        types[wt].completed++;
        if (t.durationMs != null) {
          types[wt].totalDurationMs += t.durationMs;
          types[wt].durations.push(t.durationMs);
        }
      } else {
        types[wt].failed++;
      }
    }

    const result = {};
    for (const [type, s] of Object.entries(types)) {
      const avg = s.completed > 0 ? Math.round(s.totalDurationMs / s.completed) : null;
      result[type] = {
        count: s.count,
        completed: s.completed,
        failed: s.failed,
        avgDurationMs: avg,
        successRate: s.count > 0 ? s.completed / s.count : 0,
      };
    }
    return result;
  }

  #getQueueWaitStats() {
    const waits = this.#tasks
      .map(t => t.queueWaitMs)
      .filter(w => w != null && w >= 0)
      .sort((a, b) => a - b);

    return {
      samples: waits.length,
      avgMs: waits.length > 0 ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
      p50Ms: this.#percentile(waits, 50),
      p95Ms: this.#percentile(waits, 95),
      maxMs: waits[waits.length - 1] ?? null,
    };
  }

  #getVerificationStats() {
    const total = this.#verifications.length;
    const passed = this.#verifications.filter(v => v.event === 'passed').length;
    const failed = this.#verifications.filter(v => v.event === 'failed').length;
    const terminal = passed + failed;
    const durations = this.#verifications
      .map(v => v.durationMs)
      .filter(d => d != null)
      .sort((a, b) => a - b);

    return {
      total,
      passed,
      failed,
      passRate: terminal > 0 ? passed / terminal : 0,
      avgDurationMs: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null,
    };
  }

  #getThroughput() {
    const now = Date.now();
    const m1 = this.#tasks.filter(t => t.timestamp >= now - 60_000).length;
    const m5 = this.#tasks.filter(t => t.timestamp >= now - 300_000).length;
    const m15 = this.#tasks.filter(t => t.timestamp >= now - 900_000).length;

    return {
      perMinute: m1,
      per5Minutes: m5,
      per15Minutes: m15,
      perMinuteRate: m5 > 0 ? +(m5 / 5).toFixed(2) : m1,
    };
  }

  #percentile(sortedArr, p) {
    if (sortedArr.length === 0) return null;
    if (sortedArr.length === 1) return sortedArr[0];
    const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
    return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
  }

  #trimRecords() {
    if (this.#tasks.length > this.#maxRecords) {
      this.#tasks.splice(0, this.#tasks.length - this.#maxRecords);
    }
    // Also trim very old goals and verifications
    if (this.#goals.length > 1000) {
      this.#goals.splice(0, this.#goals.length - 1000);
    }
    if (this.#verifications.length > 2000) {
      this.#verifications.splice(0, this.#verifications.length - 2000);
    }
  }
}
