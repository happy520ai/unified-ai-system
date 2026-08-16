import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGeminiAdapter, mapToGeminiRequest } from "./geminiAdapter.ts";
import { fetchWithAgent } from "../http/connectionPool.js";

vi.mock("../http/connectionPool.js", () => ({ fetchWithAgent: vi.fn() }));
vi.mock("../security/outboundUrlPolicy.ts", () => ({
  resolveSafeOutboundUrl: vi.fn(async (url) => ({ url: String(url), lookup: undefined })),
}));

function sseFrame(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function createSseResponse(frames, { splitMidFrame = false } = {}) {
  const text = frames.join("");
  const encoder = new TextEncoder();
  const chunks = splitMidFrame
    ? [text.slice(0, Math.floor(text.length / 2)), text.slice(Math.floor(text.length / 2))]
    : [text];
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

function jsonOk(payload) {
  return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
}

function happyStreamFrames() {
  return [
    sseFrame({
      candidates: [{ content: { role: "model", parts: [{ text: "Hello" }] }, finishReason: undefined }],
    }),
    sseFrame({
      candidates: [{ content: { role: "model", parts: [{ text: " world" }] } }],
    }),
    sseFrame({
      candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    }),
  ];
}

function createAdapter(overrides = {}) {
  return createGeminiAdapter({
    providerId: "gemini",
    apiKey: "AIza-test-key-1234567890",
    models: [{ id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" }],
    ...overrides,
  });
}

function createProviderRequest() {
  return {
    request: {
      messages: [
        { role: "system", content: "Be terse." },
        { role: "user", content: "hi" },
      ],
      options: {},
    },
    target: { providerId: "gemini", modelId: "gemini-2.5-pro" },
  };
}

async function collectStream(iterable) {
  const chunks = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

beforeEach(() => {
  vi.mocked(fetchWithAgent).mockReset();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
});

describe("gemini-adapter", () => {
  it("creates adapter with correct descriptor", () => {
    const adapter = createAdapter();
    expect(adapter.descriptor.id).toBe("gemini");
    expect(adapter.descriptor.kind).toBe("llm");
    expect(adapter.descriptor.metadata.providerType).toBe("gemini");
    expect(adapter.descriptor.models[0].id).toBe("gemini-2.5-pro");
  });

  it("uses default base URL when not specified", () => {
    const adapter = createGeminiAdapter({ apiKey: "AIza-x", models: [{ id: "gemini-2.5-pro" }] });
    expect(adapter.descriptor.metadata.endpoint).toBe("https://generativelanguage.googleapis.com");
  });

  it("throws when API key is missing", async () => {
    const adapter = createAdapter({ apiKey: undefined });
    await expect(adapter.generate(createProviderRequest())).rejects.toThrow("API key");
  });

  it("maps system messages to systemInstruction and assistant to model role", () => {
    const mapped = mapToGeminiRequest(
      {
        messages: [
          { role: "system", content: "sys-a" },
          { role: "system", content: "sys-b" },
          { role: "user", content: "hello" },
          { role: "assistant", content: "hi there" },
          { role: "user", content: "continue" },
        ],
        options: { temperature: 0.3, maxOutputTokens: 128, stop: ["END"] },
      },
      "gemini-2.5-pro",
    );

    expect(mapped.systemInstruction).toEqual({ parts: [{ text: "sys-a\n\nsys-b" }] });
    expect(mapped.contents).toEqual([
      { role: "user", parts: [{ text: "hello" }] },
      { role: "model", parts: [{ text: "hi there" }] },
      { role: "user", parts: [{ text: "continue" }] },
    ]);
    expect(mapped.generationConfig).toEqual({ maxOutputTokens: 128, temperature: 0.3, stopSequences: ["END"] });
  });

  it("maps inline image parts to inlineData", () => {
    const mapped = mapToGeminiRequest(
      {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "what is this" },
              { type: "image_url", image_url: { url: "data:image/png;base64,aGVsbG8=" } },
            ],
          },
        ],
        options: {},
      },
      "gemini-2.5-pro",
    );
    expect(mapped.contents[0].parts).toEqual([
      { text: "what is this" },
      { inlineData: { mimeType: "image/png", data: "aGVsbG8=" } },
    ]);
  });

  it("sends the API key in a header, never in the URL", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      jsonOk({
        candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
      }),
    );

    const adapter = createAdapter({ apiKey: "AIza-secret-key-999999" });
    const result = await adapter.generate(createProviderRequest());

    const [calledUrl, init] = vi.mocked(fetchWithAgent).mock.calls[0];
    expect(String(calledUrl)).not.toContain("AIza");
    expect(String(calledUrl)).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("AIza-secret-key-999999");
    expect(result.text).toBe("ok");
    expect(result.usage).toEqual({ inputTokens: 2, outputTokens: 1, totalTokens: 3 });
    expect(result.finishReason).toBe("stop");
  });

  it("throws a content-blocked error when promptFeedback carries a blockReason", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      jsonOk({ promptFeedback: { blockReason: "SAFETY" } }),
    );

    const adapter = createAdapter();
    await expect(adapter.generate(createProviderRequest())).rejects.toMatchObject({
      code: "GEMINI_CONTENT_BLOCKED",
      retryable: false,
      statusCode: 400,
    });
  });

  it("maps HTTP errors with retryability by status", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: "rate limited AIza-secret-key-999999999" } }),
    });

    const adapter = createAdapter();
    const promise = adapter.generate(createProviderRequest());
    await expect(promise).rejects.toMatchObject({ code: "GEMINI_API_429", retryable: true });
    await promise.catch((error) => {
      expect(error.message).not.toContain("AIza-secret");
      expect(error.message).toContain("AIza****redacted");
    });
  });

  it("resolves the API key from the runtime credential store before env", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      jsonOk({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    );
    process.env.GEMINI_API_KEY = "AIza-env-key-000000000";

    const store = { getCredential: vi.fn(async () => ({ apiKey: "AIza-store-key-0000000" })) };
    const adapter = createGeminiAdapter(
      { providerId: "gemini", models: [{ id: "gemini-2.5-pro" }] },
      { runtimeCredentialStore: store },
    );
    await adapter.generate(createProviderRequest());

    expect(store.getCredential).toHaveBeenCalledWith("gemini");
    expect(vi.mocked(fetchWithAgent).mock.calls[0][1].headers["x-goog-api-key"]).toBe("AIza-store-key-0000000");
  });

  it("falls back to GEMINI_API_KEY then GOOGLE_API_KEY env vars", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      jsonOk({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }),
    );
    process.env.GEMINI_API_KEY = "AIza-env1-key-0000000000";

    const adapter = createGeminiAdapter({ providerId: "gemini", models: [{ id: "gemini-2.5-pro" }] });
    await adapter.generate(createProviderRequest());
    expect(vi.mocked(fetchWithAgent).mock.calls[0][1].headers["x-goog-api-key"]).toBe("AIza-env1-key-0000000000");

    vi.mocked(fetchWithAgent).mockClear();
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = "AIza-env2-key-0000000000";
    await adapter.generate(createProviderRequest());
    expect(vi.mocked(fetchWithAgent).mock.calls[0][1].headers["x-goog-api-key"]).toBe("AIza-env2-key-0000000000");
  });

  it("streams text deltas and a terminal chunk with usage", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(createSseResponse(happyStreamFrames()));

    const adapter = createAdapter();
    const chunks = await collectStream(adapter.generateStream(createProviderRequest()));

    const text = chunks.map((c) => c.textDelta).join("");
    expect(text).toBe("Hello world");

    const last = chunks[chunks.length - 1];
    expect(last.raw.gemini).toBe(true);
    expect(last.raw.finishReason).toBe("stop");
    expect(last.raw.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });

    const [calledUrl] = vi.mocked(fetchWithAgent).mock.calls[0];
    expect(String(calledUrl)).toContain(":streamGenerateContent?alt=sse");
  });

  it("handles SSE frames split across TCP chunks", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(createSseResponse(happyStreamFrames(), { splitMidFrame: true }));

    const adapter = createAdapter();
    const chunks = await collectStream(adapter.generateStream(createProviderRequest()));
    expect(chunks.map((c) => c.textDelta).join("")).toBe("Hello world");
    expect(chunks[chunks.length - 1].raw.usage.totalTokens).toBe(15);
  });

  it("emits a terminal chunk even when the stream ends without usage", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      createSseResponse([
        sseFrame({ candidates: [{ content: { role: "model", parts: [{ text: "partial" }] } }] }),
      ]),
    );

    const adapter = createAdapter();
    const chunks = await collectStream(adapter.generateStream(createProviderRequest()));
    expect(chunks.map((c) => c.textDelta).join("")).toBe("partial");
    expect(chunks[chunks.length - 1].raw.gemini).toBe(true);
    expect(chunks[chunks.length - 1].raw.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("surfaces mid-stream content blocks as errors", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      createSseResponse([sseFrame({ promptFeedback: { blockReason: "SAFETY" } })]),
    );

    const adapter = createAdapter();
    await expect(collectStream(adapter.generateStream(createProviderRequest()))).rejects.toMatchObject({
      code: "GEMINI_CONTENT_BLOCKED",
    });
  });

  it("surfaces mid-stream error frames", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      createSseResponse([sseFrame({ error: { code: 503, message: "unavailable", status: "UNAVAILABLE" } })]),
    );

    const adapter = createAdapter();
    await expect(collectStream(adapter.generateStream(createProviderRequest()))).rejects.toMatchObject({
      code: "GEMINI_STREAM_ERROR",
      retryable: true,
    });
  });

  it("aborts the upstream request when the execution signal fires", async () => {
    let capturedSignal;
    vi.mocked(fetchWithAgent).mockImplementation(async (_url, init) => {
      capturedSignal = init.signal;
      return createSseResponse(happyStreamFrames());
    });

    const adapter = createAdapter();
    const externalController = new AbortController();
    const request = {
      ...createProviderRequest(),
      execution: { signal: externalController.signal },
    };

    const iterator = adapter.generateStream(request);
    await iterator.next();
    externalController.abort(new Error("client cancelled"));
    // Drain; the generator must terminate without hanging.
    for await (const _chunk of iterator) {
      // no-op
    }
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("maps SAFETY finish reasons to content_filter", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      jsonOk({
        candidates: [{ content: { parts: [{ text: "partial" }] }, finishReason: "SAFETY" }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      }),
    );

    const adapter = createAdapter();
    const result = await adapter.generate(createProviderRequest());
    expect(result.finishReason).toBe("content_filter");
  });
});
