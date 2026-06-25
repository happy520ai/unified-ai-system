// =============================================================================
// 神经元运行时工具函数 (Neuron Runtime Utilities)
// 从 neuronRuntimeExecutor.js 提取的纯工具函数
// =============================================================================

/**
 * 带超时的 Promise 包装
 * @param {Promise} promise - 原始 Promise
 * @param {number} timeoutMs - 超时毫秒数
 * @param {string} label - 超时标签
 * @returns {Promise}
 */
export function withTimeout(promise, timeoutMs, label = "operation") {
  let timer;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * 获取当前 ISO-8601 时间戳
 * @returns {string}
 */
export function now() {
  return new Date().toISOString();
}

/**
 * 安全的性能计时（毫秒）
 * @param {Function} fn - 异步函数
 * @returns {Promise<{result: *, durationMs: number}>}
 */
export async function timedExecution(fn) {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}
