import { describe, expect, it } from "vitest";
import {
  createHttpLLMProviderAdapter,
  tryPartialToolArgs,
} from "./httpLlmProviderAdapter.js";

function createRequest() {
  return {
    target: {
      providerId: "test",
      modelId: "test-model",
    },
    request: {
      messages: [{ role: "user", content: "hello" }],
      options: {},
    },
  };
}

function createAdapter(options = {}) {
  return createHttpLLMProviderAdapter({
    providerId: "test",
    modelId: "test-model",
    endpoint: "http://127.0.0.1:9",
    apiKey: "test-key",
    enabled: true,
    dryRun: false,
  }, {
    maxRetries: 1,
    ...options,
  });
}

describe("http LLM provider adapter", () => {
  it("keeps dry-run calls out of runtime health counters", async () => {
    const adapter = createHttpLLMProviderAdapter({
      providerId: "test",
      modelId: "test-model",
      endpoint: "https://example.com",
      dryRun: true,
    });

    const response = await adapter.generate(createRequest());

    expect(response.executionStatus).toBe("dry_run");
    expect(adapter.health.totalRequests).toBe(0);
    expect(adapter.streamState).toBeNull();
    expect(adapter.qualityStats.sampleSize).toBe(0);
    expect(adapter.costSummary.requestCount).toBe(0);
  });

  it("blocks private endpoints before a non-stream request", async () => {
    const adapter = createAdapter();

    await expect(adapter.generate(createRequest())).rejects.toMatchObject({
      code: "TEST_SSRF_BLOCKED",
      type: "security",
      retryable: false,
    });
    expect(adapter.health).toMatchObject({
      totalRequests: 1,
      successfulRequests: 0,
      failedRequests: 1,
    });
  });

  it("blocks private endpoints before a streaming request", async () => {
    const adapter = createAdapter();
    const stream = adapter.generateStream(createRequest());

    await expect(stream.next()).rejects.toMatchObject({
      code: "TEST_SSRF_BLOCKED",
      type: "security",
      retryable: false,
    });
    expect(adapter.streamState).toBeNull();
  });

  it("preserves the incremental tool-argument parser export", () => {
    expect(tryPartialToolArgs('{"path":"index.js"}')).toEqual({
      path: "index.js",
    });
    expect(tryPartialToolArgs('{"path":"index.js","con')).toEqual({
      _partial: true,
      path: "index.js",
    });
  });

  it("resets health, quality, and cost snapshots", () => {
    const adapter = createAdapter();
    adapter._health.totalRequests = 2;
    adapter._qualityScores.push(0.5);
    adapter._costTracker.estimatedCostUsd = 1;

    adapter.resetHealth();
    adapter.resetQuality();
    adapter.resetCost();

    expect(adapter.health.totalRequests).toBe(0);
    expect(adapter.qualityStats.sampleSize).toBe(0);
    expect(adapter.costSummary.estimatedCostUsd).toBe(0);
  });

  it("does not retry or count an already-cancelled execution as a provider failure", async () => {
    const adapter = createAdapter({ maxRetries: 3 });
    const controller = new AbortController();
    const cancellation = Object.assign(new Error("client left"), {
      code: "CLIENT_DISCONNECTED",
      category: "cancellation",
      retryable: false,
    });
    controller.abort(cancellation);
    const providerRequest = {
      ...createRequest(),
      execution: { signal: controller.signal },
    };

    await expect(adapter.generate(providerRequest)).rejects.toBe(cancellation);
    expect(adapter.health).toMatchObject({
      totalRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
    });
  });
});
