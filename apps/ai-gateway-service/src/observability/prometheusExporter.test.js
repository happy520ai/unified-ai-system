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
});
