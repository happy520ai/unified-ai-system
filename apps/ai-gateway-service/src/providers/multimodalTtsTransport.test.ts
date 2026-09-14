import { afterEach, describe, expect, it, vi } from "vitest";
import { callBinary } from "./multimodalHttpHelpers.js";
import { createMultimodalProviderAdapter } from "./multimodalProviderAdapter.js";

const request = { url: "https://tts.invalid/audio/speech", provider: "fixture", payload: { input: "hello" } };

function streamResponse(chunks: Uint8Array[], status = 200) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { status, headers: { "content-length": "1" } });
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("bounded TTS transport", () => {
  it("preserves reviewed leading and trailing whitespace in the dispatched text", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, _init?: Record<string, unknown>) => new Response("audio"));
    const adapter = createMultimodalProviderAdapter({ env: {}, fetchImpl,
      runtimeCredentialStore: { getApiKey: () => "synthetic-fixture-key" } });
    const text = " \nSpeak this exact text.\n ";
    await adapter.synthesizeSpeech({ provider: "openai", input: text, maxResponseBytes: 5, maxRetries: 0 });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).input).toBe(text);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects an already cancelled call before invoking fetch", async () => {
    const controller = new AbortController();
    const cause = new Error("fixture cancellation");
    controller.abort(cause);
    const fetchImpl = vi.fn(async () => new Response("audio"));
    await expect(callBinary(fetchImpl, { ...request, signal: controller.signal, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_request_aborted", cause, retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("enforces the actual error-body byte count despite a smaller Content-Length", async () => {
    const fetchImpl = vi.fn(async () => streamResponse([new Uint8Array(3), new Uint8Array(3)], 400));
    await expect(callBinary(fetchImpl, { ...request, maxResponseBytes: 5, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_response_too_large", retryable: false });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("requires a stream reader before arrayBuffer allocation when a limit is explicit", async () => {
    const arrayBuffer = vi.fn(async () => new Uint8Array(4).buffer);
    const response = { ok: true, status: 200, body: null, arrayBuffer } as unknown as Response;
    await expect(callBinary(vi.fn(async () => response), { ...request, maxResponseBytes: 4, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_response_stream_unavailable", retryable: false });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("accepts the exact byte boundary across streamed chunks", async () => {
    const fetchImpl = vi.fn(async () => streamResponse([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]));
    const result = await callBinary(fetchImpl, { ...request, maxResponseBytes: 5, maxRetries: 0 });
    expect([...result]).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects oversized successful bodies by their actual bytes", async () => {
    const fetchImpl = vi.fn(async () => streamResponse([new Uint8Array(2), new Uint8Array(4)]));
    await expect(callBinary(fetchImpl, { ...request, maxResponseBytes: 5, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_response_too_large" });
  });

  it("preserves HTTP diagnostics for an error body at the exact boundary", async () => {
    const body = JSON.stringify({ error: { message: "fixture denial" } });
    const fetchImpl = vi.fn(async () => new Response(body, { status: 400 }));
    await expect(callBinary(fetchImpl, { ...request, maxResponseBytes: Buffer.byteLength(body), maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_fixture_http_400", category: "provider" });
  });

  it("requires an error response reader before arrayBuffer or text allocation", async () => {
    const arrayBuffer = vi.fn(async () => new Uint8Array(4).buffer);
    const text = vi.fn(async () => "{}");
    const response = { ok: false, status: 503, body: {}, arrayBuffer, text } as unknown as Response;
    await expect(callBinary(vi.fn(async () => response), { ...request, maxResponseBytes: 4, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_response_stream_unavailable" });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(text).not.toHaveBeenCalled();
  });

  it("keeps the legacy arrayBuffer fallback when no explicit limit is supplied", async () => {
    const arrayBuffer = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
    const response = { ok: true, body: null, arrayBuffer } as unknown as Response;
    expect([...await callBinary(vi.fn(async () => response), { ...request, maxRetries: 0 })])
      .toEqual([1, 2, 3]);
    expect(arrayBuffer).toHaveBeenCalledOnce();
  });

  it("keeps legacy text-only error doubles without claiming an allocation bound", async () => {
    const text = vi.fn(async () => JSON.stringify({ message: "fixture error" }));
    const response = { ok: false, status: 400, text } as unknown as Response;
    await expect(callBinary(vi.fn(async () => response), { ...request, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_fixture_http_400" });
    expect(text).toHaveBeenCalledOnce();
  });

  it("cancels an in-flight fetch without turning caller cancellation into a timeout", async () => {
    const controller = new AbortController();
    const cause = new Error("fixture caller stop");
    let startFetch!: () => void;
    const started = new Promise<void>((resolve) => { startFetch = resolve; });
    let requestSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_url: unknown, init?: Record<string, unknown>) => {
      requestSignal = init?.signal instanceof AbortSignal ? init.signal : undefined;
      startFetch();
      return new Promise<Response>(() => {});
    });
    const pending = callBinary(fetchImpl, { ...request, signal: controller.signal, maxResponseBytes: 5, maxRetries: 0 });
    const failed = pending.catch((error) => error);
    await started;
    controller.abort(cause);
    const error = await failed;
    expect(error).toMatchObject({ code: "multimodal_request_aborted", retryable: false });
    expect(error.cause).toBe(cause);
    expect(error).not.toHaveProperty("knownNoPendingEffects");
    expect(requestSignal?.aborted).toBe(true);
    expect(requestSignal?.reason).toBe(cause);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("aborts a stalled body read with bounded cleanup even if reader.cancel stalls", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const cause = new Error("fixture stalled read cancellation");
    let startRead!: () => void;
    const started = new Promise<void>((resolve) => { startRead = resolve; });
    const reader = {
      read: vi.fn(() => { startRead(); return new Promise(() => {}); }),
      cancel: vi.fn(() => new Promise(() => {})),
      releaseLock: vi.fn(),
    };
    const response = { ok: true, body: { getReader: () => reader } } as unknown as Response;
    const fetchImpl = vi.fn(async () => response);
    const pending = callBinary(fetchImpl, { ...request, signal: controller.signal, maxResponseBytes: 5, maxRetries: 0 });
    const failed = pending.catch((error) => error);
    await started;
    controller.abort(cause);
    await vi.advanceTimersByTimeAsync(100);
    const error = await failed;
    expect(error.code).toBe("multimodal_request_aborted");
    expect(error.cause).toBe(cause);
    expect(error).not.toHaveProperty("knownNoPendingEffects");
    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not replay a timed out request when maxRetries is zero", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => new Promise<Response>(() => {}));
    const pending = callBinary(fetchImpl, { ...request, timeoutMs: 20, maxResponseBytes: 5, maxRetries: 0 });
    const failed = pending.catch((error) => error);
    await vi.advanceTimersByTimeAsync(20);
    const error = await failed;
    expect(error.code).toBe("multimodal_request_timeout");
    expect(error.cause).toBeInstanceOf(Error);
    expect(error).not.toHaveProperty("knownNoPendingEffects");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves the first body-limit failure when cleanup reaches the deadline", async () => {
    vi.useFakeTimers();
    const reader = {
      read: vi.fn(async () => ({ done: false, value: new Uint8Array(6) })),
      cancel: vi.fn(() => new Promise(() => {})), releaseLock: vi.fn(),
    };
    const response = { ok: true, body: { getReader: () => reader } } as unknown as Response;
    const fetchImpl = vi.fn(async () => response);
    const checked = expect(callBinary(fetchImpl, { ...request, timeoutMs: 20, maxResponseBytes: 5 }))
      .rejects.toMatchObject({ code: "multimodal_response_too_large", retryable: false });
    await vi.runAllTimersAsync();
    await checked;
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([429, 503])("does not replay HTTP %s when maxRetries is zero", async (status) => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status }));
    await expect(callBinary(fetchImpl, { ...request, maxResponseBytes: 5, maxRetries: 0 }))
      .rejects.toMatchObject({ code: `multimodal_fixture_http_${status}` });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("preserves a network failure cause and never replays the governed attempt", async () => {
    const cause = new Error("fixture network loss");
    const fetchImpl = vi.fn(async () => { throw cause; });
    const error = await callBinary(fetchImpl, { ...request, maxResponseBytes: 5, maxRetries: 0 }).catch((value) => value);
    expect(error.code).toBe("multimodal_network_error");
    expect(error.cause).toBe(cause);
    expect(error).not.toHaveProperty("knownNoPendingEffects");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("retains the original two retries when maxRetries is omitted", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok"));
    const pending = callBinary(fetchImpl, { ...request, maxResponseBytes: 5 });
    const checked = expect(pending).resolves.toEqual(Buffer.from("ok"));
    await vi.runAllTimersAsync();
    await checked;
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("honors an explicit single retry", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 429 }));
    const checked = expect(callBinary(fetchImpl, { ...request, maxResponseBytes: 5, maxRetries: 1 }))
      .rejects.toMatchObject({ code: "multimodal_fixture_http_429" });
    await vi.runAllTimersAsync();
    await checked;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending retry delay without sending another request", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 503 }));
    const pending = callBinary(fetchImpl, { ...request, signal: controller.signal, maxResponseBytes: 5 });
    const checked = expect(pending).rejects.toMatchObject({ code: "multimodal_request_aborted" });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
    controller.abort(new Error("fixture cancel backoff"));
    await checked;
    await vi.runAllTimersAsync();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([-1, 3, 0.5, NaN])("rejects invalid retry count %s before dispatch", async (maxRetries) => {
    const fetchImpl = vi.fn(async () => new Response("ok"));
    await expect(callBinary(fetchImpl, { ...request, maxRetries }))
      .rejects.toMatchObject({ code: "multimodal_validation_error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([0, -1, 0.5, Infinity])("rejects invalid byte limit %s before dispatch", async (maxResponseBytes) => {
    const fetchImpl = vi.fn(async () => new Response("ok"));
    await expect(callBinary(fetchImpl, { ...request, maxResponseBytes, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_validation_error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["openai", "dashscope", "siliconflow", "nvidia"])("forwards all transport controls through the %s TTS branch", async (provider) => {
    const fetchImpl = vi.fn(async () => new Response("large"));
    const adapter = createMultimodalProviderAdapter({
      env: {}, fetchImpl,
      runtimeCredentialStore: { getApiKey: () => "synthetic-fixture-key", getEndpoint: () => "https://tts.invalid/v1" },
    });
    const controller = new AbortController();
    const cause = new Error("fixture provider branch cancellation");
    controller.abort(cause);
    await expect(adapter.synthesizeSpeech({ provider, input: "hello", signal: controller.signal, maxResponseBytes: 2, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_request_aborted", cause });
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(adapter.synthesizeSpeech({ provider, input: "hello", maxResponseBytes: 2, maxRetries: 0 }))
      .rejects.toMatchObject({ code: "multimodal_response_too_large" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    fetchImpl.mockClear().mockImplementation(async () => new Response("{}", { status: 503 }));
    await expect(adapter.synthesizeSpeech({ provider, input: "hello", maxResponseBytes: 2, maxRetries: 0 }))
      .rejects.toMatchObject({ code: `multimodal_${provider}_http_503` });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
