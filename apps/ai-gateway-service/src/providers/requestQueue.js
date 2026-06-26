import { sleep } from "../entrypoints/entrypointUtils.js"
// =============================================================================
// requestQueue.js — Provider 请求队列
// 并发控制、速率限制、重试退避
// =============================================================================

/**
 * 创建 Provider 请求队列
 * @param {Object} options
 * @returns {Object}
 */
export function createRequestQueue(options = {}) {
  const maxConcurrent = options.maxConcurrent ?? 3;  // 最大并发数
  const maxRetries = options.maxRetries ?? 2;         // 最大重试次数
  const baseDelayMs = options.baseDelayMs ?? 1000;    // 基础延迟
  const maxDelayMs = options.maxDelayMs ?? 30000;     // 最大延迟

  let activeCount = 0;
  const queue = [];
  const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0,
    queuedRequests: 0,
    maxQueueDepth: 0,
  };

  /**
   * 执行请求（带并发控制和重试）
   * @param {Function} requestFn - 请求函数
   * @param {Object} context - { providerId, model }
   * @returns {Promise}
   */
  async function execute(requestFn, context = {}) {
    stats.totalRequests++;
    stats.queuedRequests++;
    stats.maxQueueDepth = Math.max(stats.maxQueueDepth, stats.queuedRequests);

    // 等待并发槽位
    await waitForSlot();
    stats.queuedRequests--;

    activeCount++;
    try {
      const result = await executeWithRetry(requestFn, context);
      stats.successfulRequests++;
      return result;
    } catch (error) {
      stats.failedRequests++;
      throw error;
    } finally {
      activeCount--;
      processQueue();
    }
  }

  /**
   * 等待并发槽位
   * @param {number} [timeoutMs=30000] — Max wait time
   */
  function waitForSlot(timeoutMs = 30_000) {
    if (activeCount < maxConcurrent) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = queue.indexOf(resolve);
        if (idx !== -1) queue.splice(idx, 1);
        reject(new Error(`Request queue timeout: no slot available within ${timeoutMs}ms`));
      }, timeoutMs);

      queue.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * 处理队列中的等待请求
   */
  function processQueue() {
    while (queue.length > 0 && activeCount < maxConcurrent) {
      const next = queue.shift();
      next();
    }
  }

  /**
   * 带重试的请求执行
   */
  async function executeWithRetry(requestFn, context) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // 检查是否是速率限制错误
        const isRateLimit = error.status === 429 ||
          error.message?.includes("rate limit") ||
          error.message?.includes("too many requests") ||
          error.code === "RATE_LIMITED";

        // 检查是否是临时错误（可重试）
        const isRetryable = isRateLimit ||
          error.status === 503 ||
          error.status === 504 ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNRESET";

        if (!isRetryable || attempt >= maxRetries) {
          throw error;
        }

        stats.retriedRequests++;

        // 指数退避
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = delay * 0.1 * Math.random(); // 10% 抖动
        await sleep(delay + jitter);
      }
    }
    throw lastError;
  }

  /**
   * 获取队列状态
   */
  function getStatus() {
    return {
      activeCount,
      queueLength: queue.length,
      maxConcurrent,
      ...stats,
      utilization: activeCount / maxConcurrent,
    };
  }

  /**
   * 获取健康状态
   */
  function getHealth() {
    const utilization = activeCount / maxConcurrent;
    let status = "healthy";
    if (utilization > 0.9) status = "critical";
    else if (utilization > 0.7) status = "warning";

    return {
      status,
      activeCount,
      queueLength: queue.length,
      maxConcurrent,
      utilization,
    };
  }

  return { execute, getStatus, getHealth };
}

