import { describe, expect, it, beforeEach } from "vitest";
import {
  MAX_SERIES_PER_METRIC,
  getAiMetricsSnapshot,
  recordChatCacheEvent,
  recordChatRequest,
  recordChatTokens,
  recordChatTtft,
  recordChatVirtualKeyRejection,
  renderAiMetrics,
  resetAiMetricsForTests,
} from "./aiMetrics.ts";

describe("ai metrics registry", () => {
  beforeEach(() => {
    resetAiMetricsForTests();
  });

  it("counts chat requests by route and stream flag", () => {
    recordChatRequest("/v1/chat/completions", false);
    recordChatRequest("/v1/chat/completions", false);
    recordChatRequest("/v1/chat/completions", true);

    const snapshot = getAiMetricsSnapshot();
    expect(snapshot.chatRequests['route="/v1/chat/completions",stream="false"']).toBe(2);
    expect(snapshot.chatRequests['route="/v1/chat/completions",stream="true"']).toBe(1);
  });

  it("accumulates token magnitudes per model and direction", () => {
    recordChatTokens("m1", "input", 10);
    recordChatTokens("m1", "input", 15);
    recordChatTokens("m1", "output", 5);
    recordChatTokens("m1", "output", 0);

    const snapshot = getAiMetricsSnapshot();
    expect(snapshot.chatTokens['direction="input",model="m1"']).toBe(25);
    expect(snapshot.chatTokens['direction="output",model="m1"']).toBe(5);
  });

  it("records TTFT observations into cumulative histogram buckets", () => {
    recordChatTtft("/v1/chat/completions", 1_000, 900); // 100ms
    recordChatTtft("/v1/chat/completions", 2_000, 100); // 1900ms
    recordChatTtft("/v1/chat/completions", 500, 900); // negative — ignored

    const series = getAiMetricsSnapshot().chatTtft.series['route="/v1/chat/completions"'];
    expect(series.count).toBe(2);
    expect(series.sum).toBe(2_000);
    // Cumulative buckets: 100ms falls into le=100..; 1900ms only into le=2500,5000.
    const buckets = getAiMetricsSnapshot().chatTtft.buckets;
    const le2500 = buckets.indexOf(2_500);
    const le5000 = buckets.indexOf(5_000);
    expect(series.counts[le2500]).toBe(2);
    expect(series.counts[le5000]).toBe(2);
  });

  it("renders a valid Prometheus exposition", () => {
    recordChatRequest("/v1/chat/completions", true);
    recordChatTokens("m1", "input", 42);
    recordChatCacheEvent("exact", "hit");
    recordChatVirtualKeyRejection("VIRTUAL_KEY_BUDGET_EXHAUSTED");
    recordChatTtft("/v1/chat/completions", 1_000, 900);

    const text = renderAiMetrics(getAiMetricsSnapshot());
    expect(text).toContain('# TYPE ai_gateway_chat_requests_total counter');
    expect(text).toContain('ai_gateway_chat_requests_total{route="/v1/chat/completions",stream="true"} 1');
    expect(text).toContain('ai_gateway_chat_tokens_total{direction="input",model="m1"} 42');
    expect(text).toContain('ai_gateway_chat_cache_events_total{layer="exact",outcome="hit"} 1');
    expect(text).toContain('ai_gateway_chat_virtual_key_rejections_total{code="VIRTUAL_KEY_BUDGET_EXHAUSTED"} 1');
    expect(text).toContain('ai_gateway_chat_ttft_ms_bucket{route="/v1/chat/completions",le="+Inf"} 1');
    expect(text).toContain('ai_gateway_chat_ttft_ms_count{route="/v1/chat/completions"} 1');
  });

  it("renders nothing for an empty snapshot", () => {
    expect(renderAiMetrics(getAiMetricsSnapshot())).toBe("");
  });

  it("caps label cardinality instead of growing without bound", () => {
    for (let index = 0; index < MAX_SERIES_PER_METRIC + 500; index += 1) {
      recordChatVirtualKeyRejection(`code-${index}`);
    }
    const seriesCount = Object.keys(getAiMetricsSnapshot().chatVirtualKeyRejections).length;
    expect(seriesCount).toBeLessThanOrEqual(MAX_SERIES_PER_METRIC);
  });
});
