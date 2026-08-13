// =============================================================================
// Prometheus metrics formatter for request + internal health signals.
// =============================================================================

/**
 * Prometheus exporter utilities.
 * @param {Object} options - { prefix }
 * @returns {Object} { formatMetrics }
 */
export function createPrometheusExporter(options = {}) {
  const prefix = options.prefix ?? "ai_gateway";

  /**
   * Render a lightweight Prometheus exposition for monitoring dashboards.
   * @param {Object} snapshot - Metric snapshot from request logger and related subsystems.
   * @returns {string} Prometheus exposition text
   */
  function formatMetrics(snapshot) {
    const lines = [];

    // 總請求
    lines.push(`# HELP ${prefix}_requests_total Total number of requests`);
    lines.push(`# TYPE ${prefix}_requests_total counter`);
    lines.push(`${prefix}_requests_total ${snapshot.totalRequests ?? 0}`);

    // 連線數
    lines.push(`# HELP ${prefix}_active_connections Active connections`);
    lines.push(`# TYPE ${prefix}_active_connections gauge`);
    lines.push(`${prefix}_active_connections ${snapshot.activeConnections ?? 0}`);

    // 延遲
    lines.push(`# HELP ${prefix}_request_duration_ms Request duration in milliseconds`);
    lines.push(`# TYPE ${prefix}_request_duration_ms summary`);
    if (snapshot.latency) {
      lines.push(`${prefix}_request_duration_ms{quantile="0.5"} ${snapshot.latency.p50 ?? 0}`);
      lines.push(`${prefix}_request_duration_ms{quantile="0.95"} ${snapshot.latency.p95 ?? 0}`);
      lines.push(`${prefix}_request_duration_ms{quantile="0.99"} ${snapshot.latency.p99 ?? 0}`);
    }

    // 限流統計
    lines.push(`# HELP ${prefix}_rate_limit_active_buckets Active rate limiter buckets`);
    lines.push(`# TYPE ${prefix}_rate_limit_active_buckets gauge`);
    const rateLimiterStats = snapshot.rateLimiter;
    lines.push(`${prefix}_rate_limit_active_buckets{scope="global"} ${rateLimiterStats?.activeBuckets ?? 0}`);
    if (rateLimiterStats?.routes) {
      for (const [route, routeStats] of Object.entries(rateLimiterStats.routes)) {
        const safeRoute = String(route).replace(/[^A-Za-z0-9_./-]/g, "_");
        lines.push(`${prefix}_rate_limit_active_buckets{scope="route",route="${safeRoute}"} ${routeStats?.activeBuckets ?? 0}`);
      }
    }

    // 錯誤總數
    lines.push(`# HELP ${prefix}_errors_total Total number of errors`);
    lines.push(`# TYPE ${prefix}_errors_total counter`);
    lines.push(`${prefix}_errors_total ${snapshot.totalErrors ?? 0}`);

    // 抗壓護欄統計（限流、過載、超時、超大請求）
    const resilience = snapshot.resilience;
    const sanitizeMetricLabel = (value) => String(value).replace(/["\\}\n\r]/g, "_");
    lines.push(`# HELP ${prefix}_gateway_resilience_requests_total Total gateway requests seen`);
    lines.push(`# TYPE ${prefix}_gateway_resilience_requests_total counter`);
    lines.push(`${prefix}_gateway_resilience_requests_total ${resilience?.totalRequests ?? 0}`);
    lines.push(`# HELP ${prefix}_gateway_resilience_events_total Resilience control events`);
    lines.push(`# TYPE ${prefix}_gateway_resilience_events_total counter`);
    lines.push(`${prefix}_gateway_resilience_events_total{type="rate_limit_rejected"} ${resilience?.rateLimitRejected ?? 0}`);
    lines.push(`${prefix}_gateway_resilience_events_total{type="payload_rejected"} ${resilience?.payloadRejected ?? 0}`);
    lines.push(`${prefix}_gateway_resilience_events_total{type="overload_rejected"} ${resilience?.overloadRejected ?? 0}`);
    lines.push(`${prefix}_gateway_resilience_events_total{type="timeout_triggered"} ${resilience?.timeoutTriggered ?? 0}`);
    lines.push(`${prefix}_gateway_resilience_events_total{type="unhandled_errors"} ${resilience?.unhandledErrors ?? 0}`);
    lines.push(`# HELP ${prefix}_gateway_resilience_error_events_total Unhandled errors by normalized code`);
    lines.push(`# TYPE ${prefix}_gateway_resilience_error_events_total counter`);
    const unhandledErrorCodes = resilience?.unhandledErrorCodes;
    if (unhandledErrorCodes && typeof unhandledErrorCodes === "object") {
      for (const [errorCode, count] of Object.entries(unhandledErrorCodes)) {
        lines.push(
          `${prefix}_gateway_resilience_error_events_total{type="unhandled_error",code="${sanitizeMetricLabel(errorCode)}"} ${count}`,
        );
      }
    }
    lines.push(`# HELP ${prefix}_gateway_resilience_in_flight_instant Concurrent in-flight requests`);
    lines.push(`# TYPE ${prefix}_gateway_resilience_in_flight_instant gauge`);
    lines.push(`${prefix}_gateway_resilience_in_flight_instant ${resilience?.currentInFlight ?? 0}`);
    lines.push(`# HELP ${prefix}_gateway_resilience_in_flight_peak Peak in-flight request count`);
    lines.push(`# TYPE ${prefix}_gateway_resilience_in_flight_peak gauge`);
    lines.push(`${prefix}_gateway_resilience_in_flight_peak ${resilience?.maxInFlightObserved ?? 0}`);
    lines.push(`# HELP ${prefix}_gateway_readiness_checks_total Total readiness checks processed`);
    lines.push(`# TYPE ${prefix}_gateway_readiness_checks_total counter`);
    lines.push(`${prefix}_gateway_readiness_checks_total{result="total"} ${resilience?.readinessCheckCount ?? 0}`);
    lines.push(`${prefix}_gateway_readiness_checks_total{result="ready"} ${resilience?.readinessReadyChecks ?? 0}`);
    lines.push(`${prefix}_gateway_readiness_checks_total{result="degraded"} ${resilience?.readinessDegradedChecks ?? 0}`);

    const readinessSnapshotFailures = Array.isArray(snapshot.readinessFailures) ? snapshot.readinessFailures : [];
    const readinessFailureReasons = resilience?.readinessFailureReasons;
    const readinessDegraded = readinessSnapshotFailures.length > 0 ? 1 : 0;
    const readinessReady = readinessSnapshotFailures.length > 0 ? 0 : 1;
    lines.push(`# HELP ${prefix}_gateway_readiness_status Gauge for current readiness state`);
    lines.push(`# TYPE ${prefix}_gateway_readiness_status gauge`);
    lines.push(`${prefix}_gateway_readiness_status{state="ready"} ${readinessReady}`);
    lines.push(`${prefix}_gateway_readiness_status{state="degraded"} ${readinessDegraded}`);
    lines.push(`# HELP ${prefix}_gateway_readiness_failures gauge`);
    lines.push(`# TYPE ${prefix}_gateway_readiness_failures gauge`);
    lines.push(`${prefix}_gateway_readiness_failures ${readinessSnapshotFailures.length}`);
    for (const reason of readinessSnapshotFailures) {
      const sanitizedReason = sanitizeMetricLabel(reason);
      lines.push(`${prefix}_gateway_readiness_failures{reason="${sanitizedReason}"} 1`);
    }
    lines.push(`# HELP ${prefix}_gateway_readiness_events_total Total readiness failure events by reason`);
    lines.push(`# TYPE ${prefix}_gateway_readiness_events_total counter`);
    if (readinessFailureReasons && typeof readinessFailureReasons === "object") {
      for (const [reason, count] of Object.entries(readinessFailureReasons)) {
        const sanitizedReason = sanitizeMetricLabel(reason);
        lines.push(`${prefix}_gateway_readiness_events_total{reason="${sanitizedReason}"} ${count}`);
      }
    }

    // Provider health score
    const sanitizeLabel = (v) => String(v).replace(/["\\}\n\r]/g, "_");
    lines.push(`# HELP ${prefix}_provider_health_score Provider health score (0-100)`);
    lines.push(`# TYPE ${prefix}_provider_health_score gauge`);
    if (snapshot.providerScores) {
      for (const [providerId, score] of Object.entries(snapshot.providerScores)) {
        lines.push(`${prefix}_provider_health_score{provider="${sanitizeLabel(providerId)}"} ${score}`);
      }
    }

    // Uptime
    lines.push(`# HELP ${prefix}_uptime_seconds Service uptime in seconds`);
    lines.push(`# TYPE ${prefix}_uptime_seconds gauge`);
    lines.push(`${prefix}_uptime_seconds ${process.uptime().toFixed(2)}`);

    // Memory usage
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
