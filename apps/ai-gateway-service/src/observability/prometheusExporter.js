// =============================================================================
// Prometheus metrics formatter for request + internal health signals.
// =============================================================================

import { createRuntimeResourceMonitor } from "./runtimeResourceMonitor.ts";
import { renderAiMetrics } from "./aiMetrics.ts";

let sharedRuntimeResourceMonitor;

/**
 * Prometheus exporter utilities.
 * @param {Object} options - { prefix }
 */
export function createPrometheusExporter(options = {}) {
  const prefix = options.prefix ?? "ai_gateway";
  const runtimeResourceMonitor = options.runtimeResourceMonitor ?? getSharedRuntimeResourceMonitor();

  /**
   * Render a lightweight Prometheus exposition for monitoring dashboards.
   * @param {Object} snapshot - Metric snapshot from request logger and related subsystems.
   * @returns {string} Prometheus exposition text
   */
  function formatMetrics(snapshot) {
    const lines = [];
    const sanitizeMetricLabel = (value) => String(value).replace(/["\\}\n\r]/g, "_");
    const safeMetricNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

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
    const globalRateLimiterStats = rateLimiterStats?.global ?? rateLimiterStats;
    lines.push(`${prefix}_rate_limit_active_buckets{scope="global"} ${globalRateLimiterStats?.activeBuckets ?? 0}`);
    if (rateLimiterStats?.routes) {
      for (const [route, routeStats] of Object.entries(rateLimiterStats.routes)) {
        const safeRoute = String(route).replace(/[^A-Za-z0-9_./-]/g, "_");
        lines.push(`${prefix}_rate_limit_active_buckets{scope="route",route="${safeRoute}"} ${routeStats?.activeBuckets ?? 0}`);
      }
    }
    const rateLimitStoreMode = sanitizeMetricLabel(
      rateLimiterStats?.storeMode ?? globalRateLimiterStats?.storeMode ?? "memory",
    );
    const rateLimitStoreAvailable = rateLimitStoreMode === "postgres"
      ? (rateLimiterStats?.available === true ? 1 : 0)
      : 1;
    const rateLimitStatsUpdatedAt = Number(
      rateLimiterStats?.statsUpdatedAt ?? globalRateLimiterStats?.statsUpdatedAt,
    );
    const rateLimitStatsAgeSeconds = Number.isFinite(rateLimitStatsUpdatedAt) && rateLimitStatsUpdatedAt > 0
      ? Math.max(0, (Date.now() - rateLimitStatsUpdatedAt) / 1000).toFixed(3)
      : -1;
    lines.push(`# HELP ${prefix}_rate_limit_store_available Whether the configured rate-limit store is reachable`);
    lines.push(`# TYPE ${prefix}_rate_limit_store_available gauge`);
    lines.push(`${prefix}_rate_limit_store_available{mode="${rateLimitStoreMode}"} ${rateLimitStoreAvailable}`);
    lines.push(`# HELP ${prefix}_rate_limit_stats_age_seconds Age of the last distributed rate-limit statistics snapshot, or -1 when unavailable`);
    lines.push(`# TYPE ${prefix}_rate_limit_stats_age_seconds gauge`);
    lines.push(`${prefix}_rate_limit_stats_age_seconds{mode="${rateLimitStoreMode}"} ${rateLimitStatsAgeSeconds}`);
    const rateLimitSubjectMode = sanitizeMetricLabel(globalRateLimiterStats?.subjectMode ?? "network");
    const trustedProxyCount = Number(globalRateLimiterStats?.trustedProxyCount ?? 0);
    lines.push(`# HELP ${prefix}_rate_limit_subject_mode Configured request identity mode for rate-limit subjects`);
    lines.push(`# TYPE ${prefix}_rate_limit_subject_mode gauge`);
    lines.push(`${prefix}_rate_limit_subject_mode{mode="${rateLimitSubjectMode}"} 1`);
    lines.push(`# HELP ${prefix}_trusted_proxy_cidrs Number of configured trusted proxy CIDR ranges`);
    lines.push(`# TYPE ${prefix}_trusted_proxy_cidrs gauge`);
    lines.push(`${prefix}_trusted_proxy_cidrs ${Number.isFinite(trustedProxyCount) ? trustedProxyCount : 0}`);

    // 錯誤總數
    lines.push(`# HELP ${prefix}_errors_total Total number of errors`);
    lines.push(`# TYPE ${prefix}_errors_total counter`);
    lines.push(`${prefix}_errors_total ${snapshot.totalErrors ?? 0}`);

    // 抗壓護欄統計（限流、過載、超時、超大請求）
    const resilience = snapshot.resilience;
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
    lines.push(`# HELP ${prefix}_gateway_error_circuit_state Current gateway-level circuit breaker state (1 for active state)`);
    lines.push(`# TYPE ${prefix}_gateway_error_circuit_state gauge`);
    const currentCircuitState = resilience?.gatewayErrorCircuitState ?? "closed";
    const circuitOpenSince = Number.isFinite(Number(resilience?.gatewayErrorCircuitOpenAt))
      ? Math.max(0, Number(resilience.gatewayErrorCircuitOpenAt))
      : 0;
    const circuitState = String(currentCircuitState);
    lines.push(`${prefix}_gateway_error_circuit_state{state="closed"} ${circuitState === "closed" ? 1 : 0}`);
    lines.push(`${prefix}_gateway_error_circuit_state{state="half-open"} ${circuitState === "half-open" ? 1 : 0}`);
    lines.push(`${prefix}_gateway_error_circuit_state{state="open"} ${circuitState === "open" ? 1 : 0}`);
    lines.push(`# HELP ${prefix}_gateway_error_circuit_open_seconds Seconds since gateway circuit opened`);
    lines.push(`# TYPE ${prefix}_gateway_error_circuit_open_seconds gauge`);
    lines.push(`${prefix}_gateway_error_circuit_open_seconds ${circuitOpenSince > 0 ? ((Date.now() - circuitOpenSince) / 1000).toFixed(2) : 0}`);
    lines.push(`# HELP ${prefix}_gateway_error_circuit_rejections_total Rejections while circuit denies requests`);
    lines.push(`# TYPE ${prefix}_gateway_error_circuit_rejections_total counter`);
    lines.push(`${prefix}_gateway_error_circuit_rejections_total ${resilience?.gatewayErrorCircuitRejections ?? 0}`);
    lines.push(`# HELP ${prefix}_gateway_error_circuit_failures_total Consecutive failures counted by gateway circuit`);
    lines.push(`# TYPE ${prefix}_gateway_error_circuit_failures_total counter`);
    lines.push(`${prefix}_gateway_error_circuit_failures_total ${resilience?.gatewayErrorCircuitFailures ?? 0}`);
    lines.push(`# HELP ${prefix}_gateway_error_circuit_success_total Requests recovered by gateway circuit`);
    lines.push(`# TYPE ${prefix}_gateway_error_circuit_success_total counter`);
    lines.push(`${prefix}_gateway_error_circuit_success_total ${resilience?.gatewayErrorCircuitSuccesses ?? 0}`);
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

    const idempotency = snapshot.idempotency;
    const idempotencyMode = sanitizeMetricLabel(idempotency?.storeMode ?? "memory");
    const idempotencyAvailable = idempotency?.storeMode === "postgres"
      ? (idempotency?.available === true ? 1 : 0)
      : 1;
    const statsUpdatedAt = Number(idempotency?.statsUpdatedAt);
    const statsAgeSeconds = Number.isFinite(statsUpdatedAt) && statsUpdatedAt > 0
      ? Math.max(0, (Date.now() - statsUpdatedAt) / 1000).toFixed(3)
      : -1;
    lines.push(`# HELP ${prefix}_idempotency_store_available Whether the configured idempotency store is reachable`);
    lines.push(`# TYPE ${prefix}_idempotency_store_available gauge`);
    lines.push(`${prefix}_idempotency_store_available{mode="${idempotencyMode}"} ${idempotencyAvailable}`);
    lines.push(`# HELP ${prefix}_idempotency_entries Idempotency records by state class`);
    lines.push(`# TYPE ${prefix}_idempotency_entries gauge`);
    lines.push(`${prefix}_idempotency_entries{mode="${idempotencyMode}",state="total"} ${idempotency?.entries ?? 0}`);
    lines.push(`${prefix}_idempotency_entries{mode="${idempotencyMode}",state="in_flight"} ${idempotency?.inFlight ?? 0}`);
    lines.push(`${prefix}_idempotency_entries{mode="${idempotencyMode}",state="replayable"} ${idempotency?.replayable ?? 0}`);
    lines.push(`${prefix}_idempotency_entries{mode="${idempotencyMode}",state="tombstone"} ${idempotency?.tombstones ?? 0}`);
    lines.push(`# HELP ${prefix}_idempotency_stats_age_seconds Age of the last distributed store statistics snapshot, or -1 when unavailable`);
    lines.push(`# TYPE ${prefix}_idempotency_stats_age_seconds gauge`);
    lines.push(`${prefix}_idempotency_stats_age_seconds{mode="${idempotencyMode}"} ${statsAgeSeconds}`);

    const webSocketLease = snapshot.webSocketLease;
    const webSocketLeaseEnabled = webSocketLease?.storeMode === "postgres" && webSocketLease?.distributed === true;
    const webSocketLeaseMode = webSocketLeaseEnabled ? "postgres" : "disabled";
    const webSocketLeaseAvailable = webSocketLeaseEnabled ? (webSocketLease?.available === true ? 1 : 0) : 1;
    lines.push(`# HELP ${prefix}_websocket_lease_enabled Whether distributed WebSocket connection leases are enabled`);
    lines.push(`# TYPE ${prefix}_websocket_lease_enabled gauge`);
    lines.push(`${prefix}_websocket_lease_enabled ${webSocketLeaseEnabled ? 1 : 0}`);
    lines.push(`# HELP ${prefix}_websocket_lease_store_available Whether the distributed WebSocket lease store is reachable`);
    lines.push(`# TYPE ${prefix}_websocket_lease_store_available gauge`);
    lines.push(`${prefix}_websocket_lease_store_available{mode="${webSocketLeaseMode}"} ${webSocketLeaseAvailable}`);
    lines.push(`# HELP ${prefix}_websocket_lease_active_local WebSocket leases currently owned by this process`);
    lines.push(`# TYPE ${prefix}_websocket_lease_active_local gauge`);
    lines.push(`${prefix}_websocket_lease_active_local ${safeMetricNumber(webSocketLease?.activeLocalLeases)}`);
    lines.push(`# HELP ${prefix}_websocket_lease_duration_seconds Configured database lease duration`);
    lines.push(`# TYPE ${prefix}_websocket_lease_duration_seconds gauge`);
    lines.push(`${prefix}_websocket_lease_duration_seconds ${safeMetricNumber(webSocketLease?.leaseMs) / 1000}`);
    lines.push(`# HELP ${prefix}_websocket_lease_local_safety_seconds Local monotonic expiry safety margin`);
    lines.push(`# TYPE ${prefix}_websocket_lease_local_safety_seconds gauge`);
    lines.push(`${prefix}_websocket_lease_local_safety_seconds ${safeMetricNumber(webSocketLease?.localSafetyMs) / 1000}`);
    lines.push(`# HELP ${prefix}_websocket_lease_events_total WebSocket lease lifecycle events observed by this process`);
    lines.push(`# TYPE ${prefix}_websocket_lease_events_total counter`);
    for (const event of ["acquired", "denied", "lost", "released"]) {
      lines.push(`${prefix}_websocket_lease_events_total{event="${event}"} ${safeMetricNumber(webSocketLease?.[event])}`);
    }

    const a2aTaskStore = snapshot.a2aTaskStore;
    const a2aTaskStoreMode = sanitizeMetricLabel(a2aTaskStore?.mode ?? "disabled");
    const a2aTaskStoreAvailable = a2aTaskStore ? (a2aTaskStore.available === true ? 1 : 0) : 1;
    lines.push(`# HELP ${prefix}_a2a_task_store_available Whether the configured A2A task store is reachable`);
    lines.push(`# TYPE ${prefix}_a2a_task_store_available gauge`);
    lines.push(`${prefix}_a2a_task_store_available{mode="${a2aTaskStoreMode}"} ${a2aTaskStoreAvailable}`);
    lines.push(`# HELP ${prefix}_a2a_task_store_durable Whether A2A task persistence survives a process restart`);
    lines.push(`# TYPE ${prefix}_a2a_task_store_durable gauge`);
    lines.push(`${prefix}_a2a_task_store_durable{mode="${a2aTaskStoreMode}"} ${a2aTaskStore?.durable === true ? 1 : 0}`);
    lines.push(`# HELP ${prefix}_a2a_task_store_limit Configured bounded A2A task-store limits`);
    lines.push(`# TYPE ${prefix}_a2a_task_store_limit gauge`);
    lines.push(`${prefix}_a2a_task_store_limit{resource="entries"} ${safeMetricNumber(a2aTaskStore?.maxEntries)}`);
    lines.push(`${prefix}_a2a_task_store_limit{resource="entries_per_owner"} ${safeMetricNumber(a2aTaskStore?.maxEntriesPerOwner)}`);
    lines.push(`${prefix}_a2a_task_store_limit{resource="task_bytes"} ${safeMetricNumber(a2aTaskStore?.maxTaskBytes)}`);

    const workforceClaimStore = snapshot.workforceClaimStore;
    const workforceClaimMode = sanitizeMetricLabel(workforceClaimStore?.mode ?? "disabled");
    const workforceClaimAvailable = workforceClaimStore
      ? (workforceClaimStore.available === true ? 1 : 0)
      : 1;
    const workforceClaimStatsUpdatedAt = Number(workforceClaimStore?.statsUpdatedAt);
    const workforceClaimStatsAgeSeconds = Number.isFinite(workforceClaimStatsUpdatedAt)
      && workforceClaimStatsUpdatedAt > 0
      ? Math.max(0, (Date.now() - workforceClaimStatsUpdatedAt) / 1000).toFixed(3)
      : -1;
    lines.push(`# HELP ${prefix}_workforce_claim_store_available Whether the configured Workforce claim store is reachable`);
    lines.push(`# TYPE ${prefix}_workforce_claim_store_available gauge`);
    lines.push(`${prefix}_workforce_claim_store_available{mode="${workforceClaimMode}"} ${workforceClaimAvailable}`);
    lines.push(`# HELP ${prefix}_workforce_claim_store_distributed Whether Workforce ownership is coordinated across hosts`);
    lines.push(`# TYPE ${prefix}_workforce_claim_store_distributed gauge`);
    lines.push(`${prefix}_workforce_claim_store_distributed{mode="${workforceClaimMode}"} ${workforceClaimStore?.distributed === true ? 1 : 0}`);
    lines.push(`# HELP ${prefix}_workforce_claims Active distributed or local Workforce task claims`);
    lines.push(`# TYPE ${prefix}_workforce_claims gauge`);
    lines.push(`${prefix}_workforce_claims{state="active"} ${safeMetricNumber(workforceClaimStore?.activeClaims)}`);
    lines.push(`${prefix}_workforce_claims{state="capacity"} ${safeMetricNumber(workforceClaimStore?.maxClaims)}`);
    lines.push(`# HELP ${prefix}_workforce_claim_stats_age_seconds Age of the last distributed claim statistics snapshot, or -1 when unavailable`);
    lines.push(`# TYPE ${prefix}_workforce_claim_stats_age_seconds gauge`);
    lines.push(`${prefix}_workforce_claim_stats_age_seconds{mode="${workforceClaimMode}"} ${workforceClaimStatsAgeSeconds}`);

    const usageLedger = snapshot.usageLedger;
    const usageLedgerMode = sanitizeMetricLabel(
      usageLedger?.storeMode ?? usageLedger?.persistence ?? "disabled",
    );
    const usageLedgerAvailable = usageLedger
      ? (usageLedger.status === "ready" && usageLedger.available !== false ? 1 : 0)
      : 1;
    lines.push(`# HELP ${prefix}_usage_ledger_store_available Whether the configured usage ledger can commit billable evidence`);
    lines.push(`# TYPE ${prefix}_usage_ledger_store_available gauge`);
    lines.push(`${prefix}_usage_ledger_store_available{mode="${usageLedgerMode}"} ${usageLedgerAvailable}`);
    lines.push(`# HELP ${prefix}_usage_ledger_rows Current and maximum central usage-ledger rows`);
    lines.push(`# TYPE ${prefix}_usage_ledger_rows gauge`);
    lines.push(`${prefix}_usage_ledger_rows{state="current"} ${safeMetricNumber(usageLedger?.rowCount)}`);
    lines.push(`${prefix}_usage_ledger_rows{state="capacity"} ${safeMetricNumber(usageLedger?.maxRows)}`);
    lines.push(`# HELP ${prefix}_usage_ledger_write_failures_total Usage-ledger write failures observed by this process`);
    lines.push(`# TYPE ${prefix}_usage_ledger_write_failures_total counter`);
    lines.push(`${prefix}_usage_ledger_write_failures_total ${safeMetricNumber(usageLedger?.totalWriteFailures)}`);

    const centralAudit = snapshot.health?.enterprise?.audit?.central;
    const centralAuditMode = sanitizeMetricLabel(centralAudit?.mode ?? "disabled");
    const centralAuditAvailable = centralAudit
      ? (centralAudit.status === "ready" && centralAudit.available !== false ? 1 : 0)
      : 1;
    lines.push(`# HELP ${prefix}_audit_central_store_available Whether the configured central enterprise audit store is reachable and verified`);
    lines.push(`# TYPE ${prefix}_audit_central_store_available gauge`);
    lines.push(`${prefix}_audit_central_store_available{mode="${centralAuditMode}"} ${centralAuditAvailable}`);
    lines.push(`# HELP ${prefix}_audit_central_sequence Latest verified central enterprise audit sequence`);
    lines.push(`# TYPE ${prefix}_audit_central_sequence gauge`);
    lines.push(`${prefix}_audit_central_sequence ${safeMetricNumber(centralAudit?.sequence)}`);
    lines.push(`# HELP ${prefix}_audit_external_retention_verified Whether external immutable retention is independently verified`);
    lines.push(`# TYPE ${prefix}_audit_external_retention_verified gauge`);
    lines.push(`${prefix}_audit_external_retention_verified ${centralAudit?.externalRetentionVerified === true ? 1 : 0}`);

    // Provider health score
    const sanitizeLabel = (v) => String(v).replace(/["\\}\n\r]/g, "_");
    lines.push(`# HELP ${prefix}_provider_health_score Provider health score (0-100)`);
    lines.push(`# TYPE ${prefix}_provider_health_score gauge`);
    if (snapshot.providerScores) {
      for (const [providerId, score] of Object.entries(snapshot.providerScores)) {
        lines.push(`${prefix}_provider_health_score{provider="${sanitizeLabel(providerId)}"} ${score}`);
      }
    }

    // AI 业务指标（chat 请求/TTFT/token/缓存/虚拟 key）
    lines.push(renderAiMetrics(snapshot.ai, prefix).trimEnd());

    // Uptime
    lines.push(`# HELP ${prefix}_uptime_seconds Service uptime in seconds`);
    lines.push(`# TYPE ${prefix}_uptime_seconds gauge`);
    lines.push(`${prefix}_uptime_seconds ${process.uptime().toFixed(2)}`);

    const runtimeResources = readRuntimeResources(runtimeResourceMonitor);

    // Memory usage
    lines.push(`# HELP ${prefix}_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE ${prefix}_memory_usage_bytes gauge`);
    const mem = runtimeResources.memoryBytes;
    lines.push(`${prefix}_memory_usage_bytes{type="rss"} ${mem.rss}`);
    lines.push(`${prefix}_memory_usage_bytes{type="heapUsed"} ${mem.heapUsed}`);
    lines.push(`${prefix}_memory_usage_bytes{type="heapTotal"} ${mem.heapTotal}`);
    lines.push(`${prefix}_memory_usage_bytes{type="external"} ${mem.external}`);
    lines.push(`${prefix}_memory_usage_bytes{type="arrayBuffers"} ${mem.arrayBuffers}`);

    // Process CPU counters
    lines.push(`# HELP ${prefix}_process_cpu_seconds_total Total process CPU time in seconds`);
    lines.push(`# TYPE ${prefix}_process_cpu_seconds_total counter`);
    lines.push(`${prefix}_process_cpu_seconds_total{mode="user"} ${runtimeResources.cpuSeconds.user}`);
    lines.push(`${prefix}_process_cpu_seconds_total{mode="system"} ${runtimeResources.cpuSeconds.system}`);

    // Event-loop pressure
    const eventLoop = runtimeResources.eventLoop;
    const delay = eventLoop.delaySeconds;
    lines.push(`# HELP ${prefix}_event_loop_utilization_ratio Event-loop utilization since the runtime monitor started`);
    lines.push(`# TYPE ${prefix}_event_loop_utilization_ratio gauge`);
    lines.push(`${prefix}_event_loop_utilization_ratio ${eventLoop.utilizationRatio}`);
    lines.push(`# HELP ${prefix}_event_loop_active_seconds_total Event-loop active time since the runtime monitor started`);
    lines.push(`# TYPE ${prefix}_event_loop_active_seconds_total counter`);
    lines.push(`${prefix}_event_loop_active_seconds_total ${eventLoop.activeSeconds}`);
    lines.push(`# HELP ${prefix}_event_loop_idle_seconds_total Event-loop idle time since the runtime monitor started`);
    lines.push(`# TYPE ${prefix}_event_loop_idle_seconds_total counter`);
    lines.push(`${prefix}_event_loop_idle_seconds_total ${eventLoop.idleSeconds}`);
    lines.push(`# HELP ${prefix}_event_loop_delay_seconds Event-loop delay distribution in seconds`);
    lines.push(`# TYPE ${prefix}_event_loop_delay_seconds summary`);
    lines.push(`${prefix}_event_loop_delay_seconds{quantile="0.5"} ${delay.p50}`);
    lines.push(`${prefix}_event_loop_delay_seconds{quantile="0.95"} ${delay.p95}`);
    lines.push(`${prefix}_event_loop_delay_seconds{quantile="0.99"} ${delay.p99}`);
    lines.push(`${prefix}_event_loop_delay_seconds_sum ${delay.sum}`);
    lines.push(`${prefix}_event_loop_delay_seconds_count ${delay.count}`);
    lines.push(`# HELP ${prefix}_event_loop_delay_max_seconds Maximum observed event-loop delay in seconds`);
    lines.push(`# TYPE ${prefix}_event_loop_delay_max_seconds gauge`);
    lines.push(`${prefix}_event_loop_delay_max_seconds ${delay.max}`);

    return lines.join("\n") + "\n";
  }

  return { formatMetrics };
}

function getSharedRuntimeResourceMonitor() {
  sharedRuntimeResourceMonitor ??= createRuntimeResourceMonitor();
  return sharedRuntimeResourceMonitor;
}

function readRuntimeResources(monitor) {
  try {
    const snapshot = monitor?.getSnapshot?.();
    if (snapshot) return snapshot;
  } catch {
    // Metrics must remain available even if a platform resource probe fails.
  }
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    cpuSeconds: { system: cpu.system / 1_000_000, user: cpu.user / 1_000_000 },
    eventLoop: {
      activeSeconds: 0,
      delaySeconds: { count: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0, sum: 0 },
      idleSeconds: 0,
      utilizationRatio: 0,
    },
    memoryBytes: {
      arrayBuffers: memory.arrayBuffers ?? 0,
      external: memory.external ?? 0,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      rss: memory.rss,
    },
  };
}
