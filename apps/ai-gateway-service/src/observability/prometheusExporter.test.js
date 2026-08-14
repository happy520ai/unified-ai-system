import { describe, it, expect } from "vitest";
import { createPrometheusExporter } from "./prometheusExporter.js";

describe("prometheusExporter", () => {
  it("formats a metrics snapshot into Prometheus text format", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      totalRequests: 10,
      activeConnections: 2,
      latency: { p50: 100, p95: 200, p99: 300 },
      totalErrors: 1,
      providerScores: { "local-fake": 90 },
    });

    expect(text).toContain("# HELP ai_gateway_requests_total");
    expect(text).toContain("ai_gateway_requests_total 10");
    expect(text).toContain("ai_gateway_active_connections 2");
    expect(text).toContain('ai_gateway_request_duration_ms{quantile="0.5"} 100');
    expect(text).toContain('ai_gateway_request_duration_ms{quantile="0.99"} 300');
    expect(text).toContain("ai_gateway_errors_total 1");
    expect(text).toContain('ai_gateway_provider_health_score{provider="local-fake"} 90');
    expect(text).toContain("ai_gateway_uptime_seconds");
  });

  it("handles empty/missing snapshot fields gracefully", () => {
    const exporter = createPrometheusExporter();
    const text = exporter.formatMetrics({});
    expect(text).toContain("ai_gateway_requests_total 0");
    expect(text).toContain("ai_gateway_errors_total 0");
    expect(text).toContain("ai_gateway_memory_usage_bytes");
  });

  it("exposes gateway error circuit resilience metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      resilience: {
        gatewayErrorCircuitState: "open",
        gatewayErrorCircuitOpenAt: 1600000000000,
        gatewayErrorCircuitRejections: 3,
        gatewayErrorCircuitFailures: 7,
        gatewayErrorCircuitSuccesses: 11,
      },
    });

    expect(text).toContain("ai_gateway_gateway_error_circuit_state{state=\"open\"} 1");
    expect(text).toContain("ai_gateway_gateway_error_circuit_state{state=\"closed\"} 0");
    expect(text).toContain("ai_gateway_gateway_error_circuit_rejections_total 3");
    expect(text).toContain("ai_gateway_gateway_error_circuit_failures_total 7");
    expect(text).toContain("ai_gateway_gateway_error_circuit_success_total 11");
    expect(text).toMatch(/ai_gateway_gateway_error_circuit_open_seconds [1-9][0-9]*\.\d{2}/);
  });

  it("emits readiness status and failure metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      totalRequests: 5,
      activeConnections: 2,
      resilience: {
        readinessCheckCount: 10,
        readinessReadyChecks: 6,
        readinessDegradedChecks: 4,
        readinessFailureReasons: {
          knowledge: 4,
          workflow: 2,
          "service-dependency": 2,
        },
      },
      readinessFailures: ["knowledge", "workflow"],
      latency: null,
      totalErrors: 0,
    });

    expect(text).toContain('ai_gateway_gateway_readiness_status{state="ready"} 0');
    expect(text).toContain('ai_gateway_gateway_readiness_status{state="degraded"} 1');
    expect(text).toContain("ai_gateway_gateway_readiness_checks_total{result=\"total\"} 10");
    expect(text).toContain("ai_gateway_gateway_readiness_checks_total{result=\"ready\"} 6");
    expect(text).toContain("ai_gateway_gateway_readiness_checks_total{result=\"degraded\"} 4");
    expect(text).toContain('ai_gateway_gateway_readiness_failures{reason="knowledge"} 1');
    expect(text).toContain('ai_gateway_gateway_readiness_failures{reason="workflow"} 1');
    expect(text).toContain('ai_gateway_gateway_readiness_events_total{reason="knowledge"} 4');
    expect(text).toContain('ai_gateway_gateway_readiness_events_total{reason="workflow"} 2');
    expect(text).toContain('ai_gateway_gateway_readiness_events_total{reason="service-dependency"} 2');
  });

  it("renders zeroed readiness metrics when no failures are present", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      totalRequests: 1,
      activeConnections: 0,
      resilience: {
        readinessCheckCount: 5,
        readinessReadyChecks: 5,
        readinessDegradedChecks: 0,
        readinessFailureReasons: {},
      },
      readinessFailures: [],
      totalErrors: 0,
    });

    expect(text).toContain('ai_gateway_gateway_readiness_status{state="ready"} 1');
    expect(text).toContain('ai_gateway_gateway_readiness_status{state="degraded"} 0');
    expect(text).toContain("ai_gateway_gateway_readiness_failures 0");
  });

  it("renders safe PostgreSQL idempotency health metrics", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      idempotency: {
        storeMode: "postgres",
        available: false,
        entries: 7,
        inFlight: 2,
        replayable: 3,
        tombstones: 2,
        statsUpdatedAt: Date.now() - 2_000,
      },
    });

    expect(text).toContain('ai_gateway_idempotency_store_available{mode="postgres"} 0');
    expect(text).toContain('ai_gateway_idempotency_entries{mode="postgres",state="total"} 7');
    expect(text).toContain('ai_gateway_idempotency_entries{mode="postgres",state="replayable"} 3');
    expect(text).toMatch(/ai_gateway_idempotency_stats_age_seconds\{mode="postgres"\} 2\.\d{3}/);
    expect(text).not.toContain("connectionString");
  });

  it("renders bounded WebSocket lease metrics without deployment identifiers", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      webSocketLease: {
        storeMode: "postgres",
        distributed: true,
        available: false,
        activeLocalLeases: 3,
        leaseMs: 30_000,
        localSafetyMs: 1_000,
        acquired: 9,
        denied: 4,
        lost: 2,
        released: 6,
        namespace: "private-cluster-name",
        connectionString: "postgres://must-not-leak",
      },
    });

    expect(text).toContain("ai_gateway_websocket_lease_enabled 1");
    expect(text).toContain('ai_gateway_websocket_lease_store_available{mode="postgres"} 0');
    expect(text).toContain("ai_gateway_websocket_lease_active_local 3");
    expect(text).toContain("ai_gateway_websocket_lease_duration_seconds 30");
    expect(text).toContain("ai_gateway_websocket_lease_local_safety_seconds 1");
    expect(text).toContain('ai_gateway_websocket_lease_events_total{event="lost"} 2');
    expect(text).not.toContain("private-cluster-name");
    expect(text).not.toContain("postgres://must-not-leak");
  });

  it("renders PostgreSQL rate-limit store health without partition keys", () => {
    const exporter = createPrometheusExporter({ prefix: "ai_gateway" });
    const text = exporter.formatMetrics({
      rateLimiter: {
        storeMode: "postgres",
        available: false,
        distributed: true,
        global: {
          activeBuckets: 5,
          statsUpdatedAt: Date.now() - 1_000,
          subjectMode: "credential-or-network",
          trustedProxyCount: 2,
        },
        routes: {},
      },
    });

    expect(text).toContain('ai_gateway_rate_limit_active_buckets{scope="global"} 5');
    expect(text).toContain('ai_gateway_rate_limit_store_available{mode="postgres"} 0');
    expect(text).toMatch(/ai_gateway_rate_limit_stats_age_seconds\{mode="postgres"\} 1\.\d{3}/);
    expect(text).toContain('ai_gateway_rate_limit_subject_mode{mode="credential-or-network"} 1');
    expect(text).toContain("ai_gateway_trusted_proxy_cidrs 2");
    expect(text).not.toContain("subject_hash");
  });
});
