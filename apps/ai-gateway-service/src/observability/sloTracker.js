// =============================================================================
// sloTracker.js — SLO (Service Level Objective) 跟踪器
// 跟踪延迟 P50/P95/P99、错误率、吞吐量
// =============================================================================

/**
 * 创建 SLO 跟踪器
 * @param {Object} options - { windowSizeMs, buckets }
 * @returns {Object} { record, getSnapshot, getLatencyPercentiles, getErrorRate }
 */
export function createSloTracker(options = {}) {
  const windowSizeMs = options.windowSizeMs ?? 5 * 60 * 1000; // 默认 5 分钟窗口
  const latencyBuckets = options.buckets ?? [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  // 请求记录（环形缓冲区）
  const requests = [];
  const MAX_RECORDS = 10000;

  /**
   * 记录一个请求
   * @param {Object} record - { latencyMs, statusCode, method, path }
   */
  function record({ latencyMs, statusCode, method = "GET", path = "/" }) {
    const now = Date.now();
    requests.push({
      timestamp: now,
      latencyMs,
      statusCode,
      method,
      path,
      isError: statusCode >= 500,
    });

    // 清理过期记录
    const cutoff = now - windowSizeMs;
    while (requests.length > 0 && requests[0].timestamp < cutoff) {
      requests.shift();
    }

    // 限制记录数量
    if (requests.length > MAX_RECORDS) {
      requests.splice(0, requests.length - MAX_RECORDS);
    }
  }

  /**
   * 获取延迟百分位数
   * @returns {Object} { p50, p95, p99, min, max, avg }
   */
  function getLatencyPercentiles() {
    if (requests.length === 0) {
      return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
    }

    const latencies = requests.map((r) => r.latencyMs).sort((a, b) => a - b);
    const len = latencies.length;

    return {
      p50: latencies[Math.floor(len * 0.5)],
      p95: latencies[Math.floor(len * 0.95)],
      p99: latencies[Math.floor(len * 0.99)],
      min: latencies[0],
      max: latencies[len - 1],
      avg: Math.round(latencies.reduce((sum, l) => sum + l, 0) / len),
    };
  }

  /**
   * 获取错误率
   * @returns {Object} { total, errors, errorRate, successRate }
   */
  function getErrorRate() {
    const total = requests.length;
    if (total === 0) {
      return { total: 0, errors: 0, errorRate: 0, successRate: 1 };
    }

    const errors = requests.filter((r) => r.isError).length;
    return {
      total,
      errors,
      errorRate: errors / total,
      successRate: (total - errors) / total,
    };
  }

  /**
   * 获取吞吐量（每秒请求数）
   * @returns {number} RPS
   */
  function getThroughput() {
    if (requests.length === 0) return 0;
    const durationMs = Date.now() - requests[0].timestamp;
    if (durationMs === 0) return 0;
    return (requests.length / durationMs) * 1000;
  }

  /**
   * 获取延迟直方图
   * @returns {Array<{bucket: string, count: number}>}
   */
  function getLatencyHistogram() {
    const histogram = latencyBuckets.map((bucket) => ({
      bucket: `<=${bucket}ms`,
      count: 0,
    }));
    histogram.push({ bucket: `>${latencyBuckets[latencyBuckets.length - 1]}ms`, count: 0 });

    for (const req of requests) {
      let placed = false;
      for (let i = 0; i < latencyBuckets.length; i++) {
        if (req.latencyMs <= latencyBuckets[i]) {
          histogram[i].count++;
          placed = true;
          break;
        }
      }
      if (!placed) {
        histogram[histogram.length - 1].count++;
      }
    }

    return histogram;
  }

  /**
   * 获取完整快照
   * @returns {Object}
   */
  function getSnapshot() {
    const latency = getLatencyPercentiles();
    const errorRate = getErrorRate();
    const throughput = getThroughput();
    const histogram = getLatencyHistogram();

    // SLO 达标判断
    const sloCompliance = {
      latencyP99: latency.p99 < 10000, // P99 < 10s
      errorRate: errorRate.errorRate < 0.05, // 错误率 < 5%
      availability: errorRate.successRate > 0.95, // 可用性 > 95%
    };
    const sloMet = Object.values(sloCompliance).every(Boolean);

    return {
      windowSizeMs,
      requestCount: requests.length,
      latency,
      errorRate,
      throughput: Math.round(throughput * 100) / 100,
      histogram,
      sloCompliance,
      sloMet,
      timestamp: Date.now(),
    };
  }

  return { record, getSnapshot, getLatencyPercentiles, getErrorRate, getThroughput, getLatencyHistogram };
}
