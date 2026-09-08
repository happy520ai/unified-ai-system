import { afterEach, describe, expect, it, vi } from "vitest";
import * as connectionPool from "../http/connectionPool.js";
import {
  createHttpLLMProviderAdapter,
  tryPartialToolArgs,
} from "./httpLlmProviderAdapter.js";

afterEach(() => {
  vi.restoreAllMocks();
  connectionPool.destroyAllPools();
});

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

function syntheticResponse(mode, status = 200) {
  if (status !== 200) return new Response(JSON.stringify({ error: { message: "synthetic busy" } }), { status });
  return mode === "stream"
    ? new Response('data: {"choices":[{"delta":{"content":"fixture success"}}]}\n\ndata: [DONE]\n\n',
      { headers: { "content-type": "text/event-stream" } })
    : new Response(JSON.stringify({ choices: [{ message: { content: "fixture success" }, finish_reason: "stop" }] }));
}

async function invokeAdapter(adapter, mode) {
  if (mode === "json") return (await adapter.generate(createRequest())).text;
  let text = "";
  for await (const chunk of adapter.generateStream(createRequest())) text += chunk.textDelta ?? "";
  return text;
}

function retryFixture(mode, options = {}) {
  const resolveOutboundUrl = vi.fn(async (url) => ({ url, lookup: () => { throw new Error("No DNS in fixture."); } }));
  const transport = vi.spyOn(connectionPool, "fetchWithAgent").mockImplementation(async () => syntheticResponse(mode));
  const adapter = createAdapter({ resolveOutboundUrl, ...options });
  const delay = vi.spyOn(adapter, "_retryDelay").mockResolvedValue(undefined);
  return { adapter, transport, delay, resolveOutboundUrl };
}

describe.each(["json", "stream"])("HTTP total-attempt configuration (%s)", (mode) => {
  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, "2"])(
    "rejects invalid maxRetries=%s before any provider dispatch", async (maxRetries) => {
      const f = retryFixture(mode, { maxRetries });
      await expect(invokeAdapter(f.adapter, mode)).rejects.toMatchObject({
        code: "TEST_RETRY_CONFIG_INVALID", category: "provider", type: "configuration", retryable: false,
      });
      expect(f.transport).not.toHaveBeenCalled();
      expect(f.resolveOutboundUrl).not.toHaveBeenCalled();
      expect(f.delay).not.toHaveBeenCalled();
      expect(f.adapter.health).toMatchObject({ totalRequests: 0, failedRequests: 0 });
      expect(f.adapter.streamState).toBeNull();
    },
  );

  it("validates a model's attempt limit when no option overrides it", async () => {
    const f = retryFixture(mode, { maxRetries: undefined });
    f.adapter.modelConfig.maxRetries = 0;
    await expect(invokeAdapter(f.adapter, mode)).rejects.toMatchObject({ code: "TEST_RETRY_CONFIG_INVALID" });
    expect(f.transport).not.toHaveBeenCalled();
  });

  it("returns the first success with one total attempt and no retry", async () => {
    const f = retryFixture(mode, { maxRetries: 1 });
    await expect(invokeAdapter(f.adapter, mode)).resolves.toBe("fixture success");
    expect(f.transport).toHaveBeenCalledOnce();
    expect(f.delay).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3])("never exceeds the existing %s total-attempt budget", async (maxRetries) => {
    const f = retryFixture(mode, { maxRetries });
    f.transport.mockImplementation(async () => syntheticResponse(mode, 429));
    await expect(invokeAdapter(f.adapter, mode)).rejects.toMatchObject({ code: "TEST_RATE_LIMIT" });
    expect(f.transport).toHaveBeenCalledTimes(maxRetries);
    expect(f.delay).toHaveBeenCalledTimes(maxRetries - 1);
  });

  it("can succeed on its second and final permitted attempt", async () => {
    const f = retryFixture(mode, { maxRetries: 2 });
    f.transport.mockImplementationOnce(async () => syntheticResponse(mode, 429));
    await expect(invokeAdapter(f.adapter, mode)).resolves.toBe("fixture success");
    expect(f.transport).toHaveBeenCalledTimes(2);
    expect(f.delay).toHaveBeenCalledOnce();
  });

  it.each([
    { source: "default", option: undefined, model: undefined, attempts: 3 },
    { source: "model", option: undefined, model: 2, attempts: 2 },
    { source: "option", option: 1, model: 2, attempts: 1 },
  ])("preserves $source selection and its $attempts attempts", async ({ option, model, attempts }) => {
    const f = retryFixture(mode, { maxRetries: option });
    f.adapter.modelConfig.maxRetries = model;
    f.transport.mockImplementation(async () => syntheticResponse(mode, 429));
    await expect(invokeAdapter(f.adapter, mode)).rejects.toMatchObject({ code: "TEST_RATE_LIMIT" });
    expect(f.transport).toHaveBeenCalledTimes(attempts);
    expect(f.delay).toHaveBeenCalledTimes(attempts - 1);
  });
});

describe("Workforce fence at the final HTTP transport boundary", () => {
  it("rejects a claim revoked while DNS resolution was pending", async () => {
    const f = retryFixture("json");
    let active = true;
    const fence = { providerId: "test", modelId: "test-model", onDispatch: vi.fn(),
      assertActive: vi.fn(async () => { if (!active) throw new Error("synthetic revoked claim"); }),
    };
    f.resolveOutboundUrl.mockImplementationOnce(async (url) => { active = false; return { url }; });
    await expect(f.adapter.generate({ ...createRequest(), execution: { workforceDispatchFence: fence } }))
      .rejects.toMatchObject({ code: "WORKFORCE_PROVIDER_DISPATCH_DENIED", retryable: false });
    expect(f.transport).not.toHaveBeenCalled();
    expect(fence.onDispatch).not.toHaveBeenCalled();
  });

  it("rechecks the claim after retry delay and records only the actual first attempt", async () => {
    const f = retryFixture("json", { maxRetries: 2 });
    let active = true;
    const fence = { providerId: "test", modelId: "test-model", onDispatch: vi.fn(),
      assertActive: vi.fn(async () => { if (!active) throw new Error("synthetic revoked claim"); }),
    };
    f.transport.mockImplementationOnce(async () => syntheticResponse("json", 429));
    f.delay.mockImplementationOnce(async () => { active = false; });
    await expect(f.adapter.generate({ ...createRequest(), execution: { workforceDispatchFence: fence } }))
      .rejects.toMatchObject({ code: "WORKFORCE_PROVIDER_DISPATCH_DENIED", retryable: false });
    expect(f.transport).toHaveBeenCalledOnce();
    expect(fence.onDispatch).toHaveBeenCalledOnce();
  });
});
