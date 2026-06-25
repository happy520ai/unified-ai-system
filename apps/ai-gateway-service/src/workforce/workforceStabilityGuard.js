// =============================================================================
// workforceStabilityGuard.js — 执行稳定性守卫
// 超时处理、死锁检测、资源限制、Webhook 回调
// =============================================================================

import { randomUUID } from "node:crypto";

/**
 * 创建 Workforce 稳定性守卫
 * @param {Object} options
 * @returns {Object}
 */
export function createWorkforceStabilityGuard(options = {}) {
  const config = {
    executionTimeoutMs: options.executionTimeoutMs ?? 10 * 60 * 1000,   // 10 分钟
    deadlockCheckIntervalMs: options.deadlockCheckIntervalMs ?? 30_000, // 30 秒
    maxConcurrentExecutions: options.maxConcurrentExecutions ?? 5,
    maxMemoryBytes: options.maxMemoryBytes ?? 512 * 1024 * 1024,        // 512MB
    webhookTimeoutMs: options.webhookTimeoutMs ?? 10_000,
    resultRetentionDays: options.resultRetentionDays ?? 30,
  };

  // 活跃执行追踪
  const activeExecutions = new Map();  // executionId -> { planId, startedAt, timer, agentId }
  const executionResults = [];         // 最近执行结果（环形缓冲区）
  const MAX_RESULTS = 1000;
  const webhookQueue = [];             // Webhook 待发送队列

  /**
   * 开始追踪一个执行
   * @param {string} planId
   * @param {string} agentId
   * @returns {Object} { executionId, timer }
   */
  function startExecution(planId, agentId) {
    // 并发限制检查
    if (activeExecutions.size >= config.maxConcurrentExecutions) {
      return { error: "max_concurrent_exceeded", active: activeExecutions.size };
    }

    const executionId = randomUUID();
    const startedAt = Date.now();

    // 设置超时计时器
    const timer = setTimeout(() => {
      const exec = activeExecutions.get(executionId);
      if (exec) {
        activeExecutions.delete(executionId);
        recordResult({
          executionId,
          planId,
          agentId,
          status: "timeout",
          startedAt,
          endedAt: Date.now(),
          reason: `Execution exceeded ${config.executionTimeoutMs}ms timeout`,
        });
      }
    }, config.executionTimeoutMs);

    activeExecutions.set(executionId, { planId, agentId, startedAt, timer });

    return { executionId, startedAt };
  }

  /**
   * 完成一个执行
   * @param {string} executionId
   * @param {Object} result
   */
  function completeExecution(executionId, result = {}) {
    const exec = activeExecutions.get(executionId);
    if (!exec) return;

    clearTimeout(exec.timer);
    activeExecutions.delete(executionId);

    recordResult({
      executionId,
      planId: exec.planId,
      agentId: exec.agentId,
      status: result.success ? "completed" : "failed",
      startedAt: exec.startedAt,
      endedAt: Date.now(),
      durationMs: Date.now() - exec.startedAt,
      output: result.output,
      error: result.error,
    });
  }

  /**
   * 记录执行结果
   */
  function recordResult(result) {
    executionResults.push(result);
    if (executionResults.length > MAX_RESULTS) {
      executionResults.shift();
    }

    // 加入 Webhook 队列
    if (result.status === "completed" || result.status === "failed" || result.status === "timeout") {
      webhookQueue.push({
        event: `execution.${result.status}`,
        data: result,
        queuedAt: Date.now(),
      });
    }
  }

  /**
   * 检测死锁 — 查找长时间运行的执行
   * @returns {Array} 可能死锁的执行列表
   */
  function detectDeadlocks() {
    const now = Date.now();
    const deadlocks = [];

    for (const [executionId, exec] of activeExecutions) {
      const duration = now - exec.startedAt;
      if (duration > config.executionTimeoutMs * 0.8) {
        deadlocks.push({
          executionId,
          planId: exec.planId,
          agentId: exec.agentId,
          durationMs: duration,
          threshold: config.executionTimeoutMs,
        });
      }
    }

    return deadlocks;
  }

  /**
   * 检查资源使用
   * @returns {Object}
   */
  function checkResources() {
    const mem = process.memoryUsage();
    const memoryOk = mem.heapUsed < config.maxMemoryBytes;

    return {
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        maxBytes: config.maxMemoryBytes,
        ok: memoryOk,
        utilization: mem.heapUsed / config.maxMemoryBytes,
      },
      concurrency: {
        active: activeExecutions.size,
        max: config.maxConcurrentExecutions,
        ok: activeExecutions.size < config.maxConcurrentExecutions,
        utilization: activeExecutions.size / config.maxConcurrentExecutions,
      },
    };
  }

  /**
   * 获取执行历史
   * @param {Object} filter - { planId, status, limit }
   * @returns {Array}
   */
  function getHistory(filter = {}) {
    let results = [...executionResults];

    if (filter.planId) {
      results = results.filter((r) => r.planId === filter.planId);
    }
    if (filter.status) {
      results = results.filter((r) => r.status === filter.status);
    }

    results.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0));
    return results.slice(0, filter.limit ?? 50);
  }

  /**
   * 获取执行统计
   * @returns {Object}
   */
  function getStats() {
    const total = executionResults.length;
    const completed = executionResults.filter((r) => r.status === "completed").length;
    const failed = executionResults.filter((r) => r.status === "failed").length;
    const timedOut = executionResults.filter((r) => r.status === "timeout").length;
    const durations = executionResults
      .filter((r) => r.durationMs)
      .map((r) => r.durationMs)
      .sort((a, b) => a - b);

    return {
      total,
      completed,
      failed,
      timedOut,
      active: activeExecutions.size,
      successRate: total > 0 ? completed / total : 0,
      avgDurationMs: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p50DurationMs: durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0,
      p95DurationMs: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
    };
  }

  /**
   * 取出 Webhook 队列中的待发送事件
   * @param {number} limit
   * @returns {Array}
   */
  function drainWebhookQueue(limit = 10) {
    return webhookQueue.splice(0, limit);
  }

  /**
   * 获取守卫健康状态
   * @returns {Object}
   */
  function getHealth() {
    const resources = checkResources();
    let status = "healthy";
    if (!resources.memory.ok) status = "critical";
    else if (!resources.concurrency.ok) status = "warning";
    else if (resources.memory.utilization > 0.7) status = "warning";

    return { status, ...resources, activeExecutions: activeExecutions.size };
  }

  // 定期死锁检测
  const deadlockTimer = setInterval(() => {
    const deadlocks = detectDeadlocks();
    for (const d of deadlocks) {
      // 强制超时
      const exec = activeExecutions.get(d.executionId);
      if (exec) {
        clearTimeout(exec.timer);
        activeExecutions.delete(d.executionId);
        recordResult({
          executionId: d.executionId,
          planId: d.planId,
          agentId: d.agentId,
          status: "timeout",
          startedAt: exec.startedAt,
          endedAt: Date.now(),
          durationMs: Date.now() - exec.startedAt,
          reason: "deadlock_detected",
        });
      }
    }
  }, config.deadlockCheckIntervalMs);
  deadlockTimer.unref();

  return {
    startExecution,
    completeExecution,
    detectDeadlocks,
    checkResources,
    getHistory,
    getStats,
    drainWebhookQueue,
    getHealth,
    config,
  };
}
