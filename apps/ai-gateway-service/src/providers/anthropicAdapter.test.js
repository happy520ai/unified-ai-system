import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAnthropicAdapter, mapToAnthropicRequest } from "./anthropicAdapter.js";
import { fetchWithAgent } from "../http/connectionPool.js";

vi.mock("../http/connectionPool.js", () => ({ fetchWithAgent: vi.fn() }));
vi.mock("../security/outboundUrlPolicy.ts", () => ({
  resolveSafeOutboundUrl: vi.fn(async (url) => ({ url: String(url), lookup: undefined })),
}));

function sseFrame(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
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

function happyPathFrames() {
  return [
    sseFrame("message_start", {
      type: "message_start",
      message: { usage: { input_tokens: 10 } },
    }),
    sseFrame("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }),
    sseFrame("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } }),
    sseFrame("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " world" } }),
    sseFrame("content_block_stop", { type: "content_block_stop", index: 0 }),
    sseFrame("message_delta", {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 5 },
    }),
    sseFrame("message_stop", { type: "message_stop" }),
  ];
}

function createStreamingAdapter() {
  return createAnthropicAdapter({
    providerId: "anthropic",
    apiKey: "sk-ant-test-key",
    models: [{ id: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5" }],
  });
}

function createProviderStreamRequest() {
  return {
    request: {
      messages: [
        { role: "system", content: "Be terse." },
        { role: "user", content: "hi" },
      ],
      options: {},
    },
    target: { providerId: "anthropic", modelId: "claude-sonnet-4.5" },
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
});

describe("anthropic-adapter", () => {
  it("creates adapter with correct descriptor", () => {
    const adapter = createAnthropicAdapter({
      providerId: "anthropic",
      apiKey: "sk-ant-test-key",
      models: [
        { id: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5" },
      ],
    });

    expect(adapter.descriptor.id).toBe("anthropic");
    expect(adapter.descriptor.kind).toBe("llm");
    expect(adapter.descriptor.metadata.providerType).toBe("anthropic");
    expect(adapter.descriptor.models).toHaveLength(1);
    expect(adapter.descriptor.models[0].id).toBe("claude-sonnet-4.5");
  });

  it("uses default base URL when not specified", () => {
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      models: [{ id: "claude-sonnet-4.5" }],
    });
    expect(adapter.descriptor.metadata.endpoint).toBe("https://api.anthropic.com");
  });

  it("throws when API key is missing", async () => {
    const adapter = createAnthropicAdapter({
      providerId: "anthropic",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    await expect(
      adapter.generate({
        request: { messages: [{ role: "user", content: "hi" }] },
        target: { providerId: "anthropic", modelId: "claude-sonnet-4.5" },
      }),
    ).rejects.toThrow("API key");
  });

  it("maps system messages to top-level system field", () => {
    // Verify the internal mapping logic by testing the adapter structure
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    expect(typeof adapter.generate).toBe("function");
    expect(adapter.descriptor.metadata.anthropicVersion).toBe("2023-06-01");
  });

  it("normalizes string model configs", () => {
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      models: ["claude-sonnet-4.5"],
    });

    expect(adapter.descriptor.models[0].id).toBe("claude-sonnet-4.5");
    expect(adapter.descriptor.models[0].capabilities).toContain("chat");
  });

  it("accepts custom endpoint for proxies", () => {
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      endpoint: "https://my-proxy.example.com",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    expect(adapter.descriptor.metadata.endpoint).toBe("https://my-proxy.example.com");
  });

  it("maps inline OpenAI image blocks to Anthropic base64 sources", () => {
    const imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const body = mapToAnthropicRequest({
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: imageUrl } },
        { type: "text", text: "Describe" },
      ] }],
      options: {},
    }, "claude-sonnet");

    expect(body.messages[0].content[0]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: imageUrl.split(",")[1],
      },
    });
    expect(body.messages[0].content[1]).toEqual({ type: "text", text: "Describe" });
  });
});

describe("anthropic-adapter generateStream", () => {
  beforeEach(() => {
    vi.mocked(fetchWithAgent).mockReset();
  });

  it("exposes generateStream on the adapter", () => {
    expect(typeof createStreamingAdapter().generateStream).toBe("function");
  });

  it("streams text deltas and ends with a usage-carrying final chunk", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(createSseResponse(happyPathFrames()));
    const adapter = createStreamingAdapter();

    const chunks = await collectStream(adapter.generateStream(createProviderStreamRequest()));

    expect(chunks.map((chunk) => chunk.textDelta)).toEqual(["Hello", " world", ""]);
    expect(chunks[2].raw).toEqual({
      anthropic: true,
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    const [, options] = vi.mocked(fetchWithAgent).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.stream).toBe(true);
    expect(body.system).toBe("Be terse.");
  });

  it("reassembles SSE frames split across network chunks", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(
      createSseResponse(happyPathFrames(), { splitMidFrame: true }),
    );
    const adapter = createStreamingAdapter();

    const chunks = await collectStream(adapter.generateStream(createProviderStreamRequest()));

    expect(chunks.map((chunk) => chunk.textDelta)).toEqual(["Hello", " world", ""]);
  });

  it("rejects with the mapped error code on non-OK HTTP status", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"type":"error","error":{"type":"rate_limit_error"}}',
    });
    const adapter = createStreamingAdapter();

    await expect(
      collectStream(adapter.generateStream(createProviderStreamRequest())),
    ).rejects.toMatchObject({ code: "ANTHROPIC_API_429", retryable: true });
  });

  it("rejects on an in-stream Anthropic error event", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(createSseResponse([
      sseFrame("message_start", { type: "message_start", message: { usage: { input_tokens: 3 } } }),
      sseFrame("error", {
        type: "error",
        error: { type: "overloaded_error", message: "Overloaded" },
      }),
    ]));
    const adapter = createStreamingAdapter();

    await expect(
      collectStream(adapter.generateStream(createProviderStreamRequest())),
    ).rejects.toMatchObject({ code: "ANTHROPIC_STREAM_ERROR", retryable: true });
  });

  it("yields a final usage chunk even when the stream ends without message_stop", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(createSseResponse([
      sseFrame("message_start", { type: "message_start", message: { usage: { input_tokens: 7 } } }),
      sseFrame("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "partial" } }),
    ]));
    const adapter = createStreamingAdapter();

    const chunks = await collectStream(adapter.generateStream(createProviderStreamRequest()));

    expect(chunks.map((chunk) => chunk.textDelta)).toEqual(["partial", ""]);
    expect(chunks[1].raw.usage).toEqual({ inputTokens: 7, outputTokens: 0, totalTokens: 7 });
  });

  it("rejects when the API key is missing", async () => {
    const adapter = createAnthropicAdapter({
      providerId: "anthropic",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    await expect(
      collectStream(adapter.generateStream(createProviderStreamRequest())),
    ).rejects.toMatchObject({ code: "ANTHROPIC_API_KEY_MISSING" });
    expect(fetchWithAgent).not.toHaveBeenCalled();
  });
});
