import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";

import { createHttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";

let server;
let baseUrl;

async function resolveLocalTestUrl(url) {
  return {
    url,
    lookup(_hostname, options, callback) {
      const resolvedCallback = typeof options === "function" ? options : callback;
      resolvedCallback(null, "127.0.0.1", 4);
    },
  };
}

function startMockProvider(handler) {
  return new Promise((resolve) => {
    const srv = createServer(handler);
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

beforeAll(async () => {
  server = await startMockProvider((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "chatcmpl-mock",
      model: "test-model",
      choices: [{ message: { role: "assistant", content: "hello from mock" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  if (server) server.close();
});

function createAdapter() {
  return createHttpLLMProviderAdapter({
    providerId: "test",
    modelId: "test-model",
    endpoint: baseUrl,
    apiKey: "test-key",
    enabled: true,
  }, { resolveOutboundUrl: resolveLocalTestUrl });
}

function createRequest() {
  return {
    target: { providerId: "test", modelId: "test-model" },
    request: { messages: [{ role: "user", content: "hello" }], options: {} },
  };
}

describe("http LLM provider adapter — success path (mock HTTP)", () => {
  it("parses a real chat completion response and records usage + cost", async () => {
    const adapter = createAdapter();
    const response = await adapter.generate(createRequest());

    expect(response.text).toBe("hello from mock");
    expect(response.executionStatus).toBe("success");
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15, reasoningTokens: 0 });

    expect(adapter.health.totalRequests).toBe(1);
    expect(adapter.health.successfulRequests).toBe(1);
    expect(adapter.health.failedRequests).toBe(0);

    expect(adapter.costSummary.totalInputTokens).toBe(10);
    expect(adapter.costSummary.totalOutputTokens).toBe(5);
    expect(adapter.costSummary.requestCount).toBe(1);
    expect(adapter.costSummary.estimatedCostUsd).toBeGreaterThan(0);
  });
});

describe("http LLM provider adapter — error path (mock HTTP)", () => {
  it("surfaces a non-2xx response as a provider error", async () => {
    const errorServer = await startMockProvider((req, res) => {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "bad request" } }));
    });
    const errorUrl = `http://127.0.0.1:${errorServer.address().port}`;
    try {
      const adapter = createHttpLLMProviderAdapter({
        providerId: "test",
        modelId: "test-model",
        endpoint: errorUrl,
        apiKey: "test-key",
        enabled: true,
      }, { resolveOutboundUrl: resolveLocalTestUrl });

      await expect(adapter.generate(createRequest())).rejects.toMatchObject({
        type: "http",
      });
      expect(adapter.health.failedRequests).toBe(1);
    } finally {
      errorServer.close();
    }
  });
});
