// =============================================================================
// prometheusExporter.js — Prometheus 指标导出器
// 将内部指标转换为 Prometheus 文本格式
// =============================================================================

/**
 * Prometheus 指标导出器
 * @param {Object} options - { prefix }
 * @returns {Object} { formatMetrics }
 */
export function createPrometheusExporter(options = {}) {
  const prefix = options.prefix ?? "ai_gateway";

  /**
   * 将指标快照转换为 Prometheus 格式
   * @param {Object} snapshot - 指标快照
   * @returns {string} Prometheus 文本格式
   */
  function formatMetrics(snapshot) {
    const lines = [];

    // 请求数量
    lines.push(`# HELP ${prefix}_requests_total Total number of requests`);
    lines.push(`# TYPE ${prefix}_requests_total counter`);
    lines.push(`${prefix}_requests_total ${snapshot.totalRequests ?? 0}`);

    // 活跃连接数
    lines.push(`# HELP ${prefix}_active_connections Active connections`);
    lines.push(`# TYPE ${prefix}_active_connections gauge`);
    lines.push(`${prefix}_active_connections ${snapshot.activeConnections ?? 0}`);

    // 延迟直方图
    lines.push(`# HELP ${prefix}_request_duration_ms Request duration in milliseconds`);
    lines.push(`# TYPE ${prefix}_request_duration_ms summary`);
    if (snapshot.latency) {
      lines.push(`${prefix}_request_duration_ms{quantile="0.5"} ${snapshot.latency.p50 ?? 0}`);
      lines.push(`${prefix}_request_duration_ms{quantile="0.95"} ${snapshot.latency.p95 ?? 0}`);
      lines.push(`${prefix}_request_duration_ms{quantile="0.99"} ${snapshot.latency.p99 ?? 0}`);
    }

    // 错误率
    lines.push(`# HELP ${prefix}_errors_total Total number of errors`);
    lines.push(`# TYPE ${prefix}_errors_total counter`);
    lines.push(`${prefix}_errors_total ${snapshot.totalErrors ?? 0}`);

    // Provider 健康分数
    lines.push(`# HELP ${prefix}_provider_health_score Provider health score (0-100)`);
    lines.push(`# TYPE ${prefix}_provider_health_score gauge`);
    if (snapshot.providerScores) {
      for (const [providerId, score] of Object.entries(snapshot.providerScores)) {
        lines.push(`${prefix}_provider_health_score{provider="${providerId}"} ${score}`);
      }
    }

    // 运行时间
    lines.push(`# HELP ${prefix}_uptime_seconds Service uptime in seconds`);
    lines.push(`# TYPE ${prefix}_uptime_seconds gauge`);
    lines.push(`${prefix}_uptime_seconds ${process.uptime().toFixed(2)}`);

    // 内存使用
    lines.push(`# HELP ${prefix}_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE ${prefix}_memory_usage_bytes gauge`);
    const mem = process.memoryUsage();
    lines.push(`${prefix}_memory_usage_bytes{type="rss"} ${mem.rss}`);
    lines.push(`${prefix}_memory_usage_bytes{type="heapUsed"} ${mem.heapUsed}`);
    lines.push(`${prefix}_memory_usage_bytes{type="heapTotal"} ${mem.heapTotal}`);

    return lines.join("\n") + "\n";
  }

  return { formatMetrics };
}
