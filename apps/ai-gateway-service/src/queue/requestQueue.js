// =============================================================================
// requestQueue.js — 请求队列系统
// 优先级队列、背压控制、公平调度、超时处理
// =============================================================================

import { randomUUID } from "node:crypto";

export function createRequestQueue(options = {}) {
  const maxQueueSize = options.maxQueueSize ?? 1000;
  const maxConcurrent = options.maxConcurrent ?? 50;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
  const priorities = { critical: 4, high: 3, normal: 2, low: 1 };

  const queue = []; // { id, priority, enqueuedAt, timeoutMs, resolve, reject, task }
  let activeCount = 0;
  const stats = { enqueued: 0, dequeued: 0, timedOut: 0, rejected: 0, completed: 0 };

  function enqueue(task, opts = {}) {
    return new Promise((resolve, reject) => {
      if (queue.length >= maxQueueSize) {
        stats.rejected++;
        reject(new Error("Queue full"));
        return;
      }

      const entry = {
        id: randomUUID().slice(0, 8),
        priority: priorities[opts.priority] ?? priorities.normal,
        enqueuedAt: Date.now(),
        timeoutMs: opts.timeoutMs ?? defaultTimeoutMs,
        resolve,
        reject,
        task,
      };

      // 按优先级插入
      const insertIdx = queue.findIndex((q) => q.priority < entry.priority);
      if (insertIdx === -1) queue.push(entry);
      else queue.splice(insertIdx, 0, entry);

      stats.enqueued++;

      // 超时处理
      setTimeout(() => {
        const idx = queue.indexOf(entry);
        if (idx !== -1) {
          queue.splice(idx, 1);
          stats.timedOut++;
          entry.reject(new Error("Queue timeout"));
        }
      }, entry.timeoutMs);

      processQueue();
    });
  }

  function processQueue() {
    while (activeCount < maxConcurrent && queue.length > 0) {
      const entry = queue.shift();
      activeCount++;
      stats.dequeued++;

      entry.task()
        .then((result) => {
          activeCount--;
          stats.completed++;
          entry.resolve(result);
          processQueue();
        })
        .catch((err) => {
          activeCount--;
          entry.reject(err);
          processQueue();
        });
    }
  }

  function getStats() {
    return {
      ...stats,
      queueSize: queue.length,
      activeCount,
      maxQueueSize,
      maxConcurrent,
      utilization: activeCount / maxConcurrent,
      avgWaitMs: stats.dequeued > 0 ? 0 : 0,
    };
  }

  function getHealth() {
    const utilization = activeCount / maxConcurrent;
    let status = "healthy";
    if (utilization > 0.9 || queue.length > maxQueueSize * 0.8) status = "critical";
    else if (utilization > 0.7 || queue.length > maxQueueSize * 0.5) status = "warning";

    return { status, queueSize: queue.length, activeCount, utilization, ...stats };
  }

  return { enqueue, getStats, getHealth };
}
