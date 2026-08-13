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
      },
    });

    expect(text).toContain("ai_gateway_gateway_error_circuit_state{state=\"open\"} 1");
    expect(text).toContain("ai_gateway_gateway_error_circuit_state{state=\"closed\"} 0");
    expect(text).toContain("ai_gateway_gateway_error_circuit_rejections_total 3");
    expect(text).toContain("ai_gateway_gateway_error_circuit_failures_total 7");
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
});
