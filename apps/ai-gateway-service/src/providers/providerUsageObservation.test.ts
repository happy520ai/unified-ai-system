import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAnthropicAdapter } from "./anthropicAdapter.js";
import { createGeminiAdapter } from "./geminiAdapter.ts";
import { mapChatCompletionsResponseToProviderResponse, readChatCompletionsStream } from "./httpProviderMapping.js";
import { fetchWithAgent } from "../http/connectionPool.js";
import { createGeminiGenerateContentResponse } from "../http/geminiCompatibilityRoutes.ts";
import { createAnthropicMessage } from "../http/openAiCompatibilityRoutes.js";

vi.mock("../http/connectionPool.js", () => ({ fetchWithAgent: vi.fn() }));
vi.mock("../security/outboundUrlPolicy.ts", () => ({
  resolveSafeOutboundUrl: vi.fn(async (url) => ({ url: String(url), lookup: undefined })),
}));

const request = { request: { messages: [{ role: "user", content: "hi" }], options: {} },
  target: { providerId: "fixture", modelId: "fixture-model" } };
function adapter(kind: "anthropic" | "gemini") {
  const options = { providerId: "fixture", apiKey: "synthetic-fixture-key", models: ["fixture-model"] };
  const result = kind === "anthropic" ? createAnthropicAdapter(options) : createGeminiAdapter(options);
  if (!("generate" in result) || typeof result.generate !== "function"
    || !("generateStream" in result) || typeof result.generateStream !== "function") {
    throw new Error("Fixture adapter is missing generation methods.");
  }
  return result as { generate: (input: typeof request) => Promise<any>;
    generateStream: (input: typeof request) => AsyncIterable<any> };
}
const frame = (data: unknown, event?: string) => `${event ? `event: ${event}\n` : ""}data: ${JSON.stringify(data)}\n\n`;
const stream = (frames: string[]) => ({ ok: true, status: 200,
  body: (async function* () { for (const value of frames) yield new TextEncoder().encode(value); })() });
async function collect(iterable: AsyncIterable<any>) { const values = []; for await (const value of iterable) values.push(value); return values; }
const mapOpenAi = (usage?: unknown) => mapChatCompletionsResponseToProviderResponse({
  choices: [{ message: { content: "ok" }, finish_reason: "stop" }], ...(usage === undefined ? {} : { usage }),
}, { providerRequest: request, latencyMs: 1 });

beforeEach(() => vi.mocked(fetchWithAgent).mockReset());

describe("provider usage observations through actual protocol adapters", () => {
  it("distinguishes a reported OpenAI zero from a synthesized zero", () => {
    expect(mapOpenAi().raw.usageObservation).toMatchObject({ source: "unknown", totalTokens: null, complete: true });
    expect(mapOpenAi({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }).raw.usageObservation)
      .toMatchObject({ source: "reported", totalTokens: 0, invalid: false });
  });

  it.each([null, "12", -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("does not coerce malformed counts: %s", (value) => {
    const result = mapOpenAi({ prompt_tokens: 2, completion_tokens: 3, total_tokens: value });
    expect(result.raw.usageObservation).toMatchObject({ totalTokens: null, invalid: true, knownTokens: 5 });
    expect(result.usage.totalTokens).toBe(5);
  });

  it("does not add OpenAI reasoning and cache breakdowns twice", () => {
    const result = mapOpenAi({ prompt_tokens: 10, completion_tokens: 8, total_tokens: 18,
      prompt_tokens_details: { cached_tokens: 7 }, completion_tokens_details: { reasoning_tokens: 6 } });
    expect(result.usage).toMatchObject({ inputTokens: 10, outputTokens: 8, totalTokens: 18, reasoningTokens: 6 });
    expect(result.raw.usageObservation).toMatchObject({ source: "reported", totalTokens: 18 });
  });

  it("keeps usage-only SSE and latest cumulative usage until DONE", async () => {
    const chunks = await collect(readChatCompletionsStream(stream([
      frame({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }),
      frame({ choices: [], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }),
      frame({ choices: [], usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 } }),
      "data: [DONE]\n\n",
    ]), request));
    expect(chunks.map((chunk) => chunk.textDelta).join("")).toBe("ok");
    expect(chunks.at(-1).raw.usageObservation).toMatchObject({ source: "reported", totalTokens: 6, complete: true });
    expect(chunks.at(-1).raw.usage.totalTokens).toBe(6);
  });

  it("keeps a reported partial OpenAI observation before a transport exception", async () => {
    const response = { body: (async function* () {
      yield new TextEncoder().encode(frame({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }));
      throw new Error("fixture disconnect");
    })() };
    const seen: any[] = [];
    await expect((async () => { for await (const value of readChatCompletionsStream(response, request)) seen.push(value); })())
      .rejects.toThrow("fixture disconnect");
    expect(seen.at(-1).raw.usageObservation).toMatchObject({ totalTokens: 5, complete: false });
  });

  it("does not repeat a tool-call delta when carrying usage forward", async () => {
    const delta = [{ index: 0, id: "call-fixture", function: { name: "fixture", arguments: "{}" } }];
    const chunks = await collect(readChatCompletionsStream(stream([
      frame({ choices: [{ delta: { tool_calls: delta } }] }),
      frame({ choices: [], usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 } }),
      "data: [DONE]\n\n",
    ]), request));
    expect(chunks.flatMap((chunk) => chunk.raw.toolCallsDelta ?? [])).toEqual(delta);
  });

  it("counts Anthropic uncached, cache-read and cache-creation input exactly once", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({
      content: [{ type: "text", text: "ok" }], stop_reason: "end_turn",
      usage: { input_tokens: 2, output_tokens: 3, cache_read_input_tokens: 11, cache_creation_input_tokens: 5 },
    }) });
    const result = await adapter("anthropic").generate(request);
    expect(result.usage).toMatchObject({ inputTokens: 18, outputTokens: 3, totalTokens: 21 });
    expect(result.raw.usageObservation).toMatchObject({ source: "components", totalTokens: 21, complete: true });
    expect(createAnthropicMessage({ data: { usage: result.usage, message: result.message } }).usage)
      .toEqual({ input_tokens: 2, output_tokens: 3, cache_read_input_tokens: 11, cache_creation_input_tokens: 5 });
  });

  it("surfaces Anthropic known input before an error, then retains cumulative output without summing snapshots", async () => {
    const frames = [frame({ message: { usage: { input_tokens: 2, cache_read_input_tokens: 7 } } }, "message_start"),
      frame({ usage: { output_tokens: 3 } }, "message_delta"), frame({ usage: { output_tokens: 5 } }, "message_delta")];
    vi.mocked(fetchWithAgent).mockResolvedValue(stream([...frames, frame({ error: { type: "overloaded_error" } }, "error")]));
    const seen: any[] = [];
    await expect((async () => { for await (const chunk of adapter("anthropic").generateStream(request)) seen.push(chunk); })())
      .rejects.toMatchObject({ code: "ANTHROPIC_STREAM_ERROR" });
    expect(seen[0].raw.usageObservation).toMatchObject({ inputTokens: 9, outputTokens: null, knownTokens: 9, complete: false });
    expect(seen.at(-1).raw.usageObservation).toMatchObject({ totalTokens: 14, complete: false });
  });

  it("includes Gemini thoughts in canonical output and preserves the reported total", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 7,
        cachedContentTokenCount: 8, totalTokenCount: 20 },
    }) });
    const result = await adapter("gemini").generate(request);
    expect(result.usage).toMatchObject({ inputTokens: 10, outputTokens: 10, reasoningTokens: 7, totalTokens: 20 });
    expect(result.raw.usageObservation).toMatchObject({ source: "reported", totalTokens: 20 });
    const wire = createGeminiGenerateContentResponse({ data: { usage: result.usage, output: [{ text: "ok" }] } });
    expect(wire.usageMetadata).toMatchObject({ candidatesTokenCount: 3, thoughtsTokenCount: 7, totalTokenCount: 20 });
  });

  it("reads later Gemini usage after a finish frame and never sums cumulative snapshots", async () => {
    vi.mocked(fetchWithAgent).mockResolvedValue(stream([
      frame({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, thoughtsTokenCount: 3, totalTokenCount: 6 } }),
      frame({ usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 4, thoughtsTokenCount: 7, totalTokenCount: 13 } }),
    ]));
    const chunks = await collect(adapter("gemini").generateStream(request));
    expect(chunks.at(-1).raw.usage).toMatchObject({ inputTokens: 2, outputTokens: 11, totalTokens: 13, reasoningTokens: 7 });
    expect(chunks.at(-1).raw.usageObservation).toMatchObject({ totalTokens: 13, complete: true });
  });

  it.each(["anthropic", "gemini"] as const)("does not present absent %s stream usage as a reported zero", async (kind) => {
    vi.mocked(fetchWithAgent).mockResolvedValue(stream([]));
    const chunks = await collect(adapter(kind).generateStream(request));
    expect(chunks.at(-1).raw.usageObservation).toMatchObject({ source: "unknown", totalTokens: null, complete: false });
  });
});
