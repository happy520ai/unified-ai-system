import { describe, expect, it } from "vitest";
import { createPrometheusExporter } from "./prometheusExporter.js";

describe("prometheusExporter runtime resources", () => {
  it("exports CPU, memory, event-loop utilization, and delay in base units", () => {
    const exporter = createPrometheusExporter({
      prefix: "ai_gateway",
      runtimeResourceMonitor: {
        getSnapshot: () => ({
          cpuSeconds: { system: 1.25, user: 3.5 },
          eventLoop: {
            activeSeconds: 2,
            idleSeconds: 8,
            utilizationRatio: 0.2,
            delaySeconds: {
              count: 100,
              max: 0.09,
              mean: 0.012,
              p50: 0.01,
              p95: 0.03,
              p99: 0.05,
              sum: 1.2,
            },
          },
          memoryBytes: {
            arrayBuffers: 128,
            external: 256,
            heapTotal: 1_024,
            heapUsed: 512,
            rss: 2_048,
          },
        }),
      },
    });

    const text = exporter.formatMetrics({});

    expect(text).toContain('ai_gateway_process_cpu_seconds_total{mode="user"} 3.5');
    expect(text).toContain('ai_gateway_process_cpu_seconds_total{mode="system"} 1.25');
    expect(text).toContain("ai_gateway_event_loop_utilization_ratio 0.2");
    expect(text).toContain('ai_gateway_event_loop_delay_seconds{quantile="0.99"} 0.05');
    expect(text).toContain("ai_gateway_event_loop_delay_seconds_sum 1.2");
    expect(text).toContain("ai_gateway_event_loop_delay_seconds_count 100");
    expect(text).toContain("ai_gateway_event_loop_delay_max_seconds 0.09");
    expect(text).toContain('ai_gateway_memory_usage_bytes{type="external"} 256');
    expect(text).toContain('ai_gateway_memory_usage_bytes{type="arrayBuffers"} 128');
  });
});
