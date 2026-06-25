/**
 * Metrics Collector — Prometheus-compatible metrics for the AI Gateway.
 *
 * Tracks HTTP requests, auth attempts, provider calls, connections,
 * and system resource usage. Outputs Prometheus text exposition format.
 *
 * Zero external dependencies — uses Node.js built-in process module.
 */

export function createMetricsCollector() {
  const startTime = Date.now();

  // --- Counters ---
  // Map<labelKey, count> where labelKey = JSON.stringify(labels)
  const httpRequestsTotal = new Map();
  const authAttemptsTotal = new Map();
  const providerCallsTotal = new Map();
  const auditEventsTotal = new Map();

  // --- Histograms ---
  // Map<labelKey, { buckets: Map<le, count>, sum, count }>
  const httpRequestDuration = new Map();
  const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  // --- Gauges ---
  let activeConnections = 0;
  let activeWsConnections = 0;

  function labelKey(labels) {
    return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${v}"`).join(",");
  }

  function incrementCounter(map, labels) {
    const key = labelKey(labels);
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  function recordHttpRequest(method, path, status, durationMs) {
    // Normalize path to avoid high cardinality (strip query, UUIDs, etc.)
    const normalizedPath = normalizePath(path);
    incrementCounter(httpRequestsTotal, { method, path: normalizedPath, status: String(status) });

    // Histogram
    const hKey = labelKey({ method, path: normalizedPath });
    if (!httpRequestDuration.has(hKey)) {
      httpRequestDuration.set(hKey, { buckets: new Map(), sum: 0, count: 0 });
    }
    const h = httpRequestDuration.get(hKey);
    h.sum += durationMs;
    h.count++;
    for (const le of DEFAULT_BUCKETS) {
      if (durationMs <= le) {
        h.buckets.set(le, (h.buckets.get(le) ?? 0) + 1);
      }
    }
  }

  function recordAuthAttempt(outcome) {
    incrementCounter(authAttemptsTotal, { outcome });
  }

  function recordProviderCall(provider, model, status) {
    incrementCounter(providerCallsTotal, { provider, model, status: String(status) });
  }

  function recordAuditEvent(outcome) {
    incrementCounter(auditEventsTotal, { outcome });
  }

  function incrementConnections() { activeConnections++; }
  function decrementConnections() { activeConnections = Math.max(0, activeConnections - 1); }
  function incrementWsConnections() { activeWsConnections++; }
  function decrementWsConnections() { activeWsConnections = Math.max(0, activeWsConnections - 1); }

  function normalizePath(path) {
    // Strip query string
    const qIdx = path.indexOf("?");
    let p = qIdx >= 0 ? path.slice(0, qIdx) : path;
    // Replace UUIDs with placeholder
    p = p.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, ":id");
    // Truncate to avoid cardinality explosion
    if (p.length > 80) p = p.slice(0, 80);
    return p;
  }

  function formatPrometheus() {
    const lines = [];
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const mem = process.memoryUsage();

    // Uptime gauge
    lines.push("# HELP gateway_uptime_seconds Time since gateway start");
    lines.push("# TYPE gateway_uptime_seconds gauge");
    lines.push(`gateway_uptime_seconds ${uptime}`);

    // Memory gauges
    lines.push("# HELP gateway_memory_bytes Process memory usage");
    lines.push("# TYPE gateway_memory_bytes gauge");
    lines.push(`gateway_memory_bytes{type="rss"} ${mem.rss}`);
    lines.push(`gateway_memory_bytes{type="heapUsed"} ${mem.heapUsed}`);
    lines.push(`gateway_memory_bytes{type="heapTotal"} ${mem.heapTotal}`);
    lines.push(`gateway_memory_bytes{type="external"} ${mem.external}`);

    // Active connections gauge
    lines.push("# HELP gateway_active_connections Current active HTTP connections");
    lines.push("# TYPE gateway_active_connections gauge");
    lines.push(`gateway_active_connections ${activeConnections}`);

    lines.push("# HELP gateway_active_ws_connections Current active WebSocket connections");
    lines.push("# TYPE gateway_active_ws_connections gauge");
    lines.push(`gateway_active_ws_connections ${activeWsConnections}`);

    // HTTP requests counter
    if (httpRequestsTotal.size > 0) {
      lines.push("# HELP http_requests_total Total HTTP requests");
      lines.push("# TYPE http_requests_total counter");
      for (const [key, count] of httpRequestsTotal) {
        lines.push(`http_requests_total{${key}} ${count}`);
      }
    }

    // HTTP request duration histogram
    if (httpRequestDuration.size > 0) {
      lines.push("# HELP http_request_duration_ms HTTP request duration in milliseconds");
      lines.push("# TYPE http_request_duration_ms histogram");
      for (const [key, h] of httpRequestDuration) {
        let cumulative = 0;
        for (const le of DEFAULT_BUCKETS) {
          cumulative += h.buckets.get(le) ?? 0;
          lines.push(`http_request_duration_ms_bucket{${key},le="${le}"} ${cumulative}`);
        }
        lines.push(`http_request_duration_ms_bucket{${key},le="+Inf"} ${h.count}`);
        lines.push(`http_request_duration_ms_sum{${key}} ${Math.round(h.sum)}`);
        lines.push(`http_request_duration_ms_count{${key}} ${h.count}`);
      }
    }

    // Auth attempts counter
    if (authAttemptsTotal.size > 0) {
      lines.push("# HELP auth_attempts_total Total authentication attempts");
      lines.push("# TYPE auth_attempts_total counter");
      for (const [key, count] of authAttemptsTotal) {
        lines.push(`auth_attempts_total{${key}} ${count}`);
      }
    }

    // Provider calls counter
    if (providerCallsTotal.size > 0) {
      lines.push("# HELP provider_calls_total Total provider API calls");
      lines.push("# TYPE provider_calls_total counter");
      for (const [key, count] of providerCallsTotal) {
        lines.push(`provider_calls_total{${key}} ${count}`);
      }
    }

    // Audit events counter
    if (auditEventsTotal.size > 0) {
      lines.push("# HELP audit_events_total Total audit events");
      lines.push("# TYPE audit_events_total counter");
      for (const [key, count] of auditEventsTotal) {
        lines.push(`audit_events_total{${key}} ${count}`);
      }
    }

    lines.push("# EOF");
    return lines.join("\n") + "\n";
  }

  function getSnapshot() {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
      activeConnections,
      activeWsConnections,
      httpRequests: Object.fromEntries(httpRequestsTotal),
      authAttempts: Object.fromEntries(authAttemptsTotal),
      providerCalls: Object.fromEntries(providerCallsTotal),
      auditEvents: Object.fromEntries(auditEventsTotal),
    };
  }

  return {
    recordHttpRequest, recordAuthAttempt, recordProviderCall, recordAuditEvent,
    incrementConnections, decrementConnections,
    incrementWsConnections, decrementWsConnections,
    formatPrometheus, getSnapshot,
  };
}
