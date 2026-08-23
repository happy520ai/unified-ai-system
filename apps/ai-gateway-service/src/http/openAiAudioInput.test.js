import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { dispatchOpenAiCompatibilityRoutes } from "./openAiCompatibilityRoutes.js";
import { dispatchGeminiCompatibilityRoutes } from "./geminiCompatibilityRoutes.ts";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

const WAV_BASE64 = Buffer.from("RIFFfake-wav-bytes").toString("base64");

function createChatContext({ body, gatewayService = createGatewayService(), response }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  request.method = "POST";
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL("http://127.0.0.1/v1/chat/completions"),
    gatewayService,
    knowledgeService: null,
    enterpriseGovernanceService: null,
    writeServiceLog: vi.fn(),
  };
}

function createGeminiContext({ body, response, gatewayService = createGatewayService() }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  request.method = "POST";
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL("http://127.0.0.1/v1beta/models/local-fake-model:generateContent"),
    gatewayService,
    enterpriseGovernanceService: null,
    writeServiceLog: vi.fn(),
  };
}

function createGatewayService() {
  return {
    getProviderDescriptors: vi.fn(() => descriptors),
    execute: vi.fn(async () => ({
      success: true,
      data: {
        message: { role: "assistant", content: "heard it" },
        selectedModel: "local-fake-model",
        finishReason: "stop",
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      },
      meta: { requestId: "r1" },
    })),
    async *executeStream() {},
  };
}

function createResponseRecorder() {
  const recorder = {
    statusCode: null,
    headers: {},
    body: null,
    writableEnded: false,
    destroyed: false,
    headersSent: false,
    writeHead(statusCode, headers = {}) {
      recorder.statusCode = statusCode;
      recorder.headers = headers;
      recorder.headersSent = true;
    },
    write() { return true; },
    end(body) {
      if (body !== undefined) recorder.body = JSON.parse(String(body));
      recorder.writableEnded = true;
    },
    on() {},
  };
  return recorder;
}

describe("input_audio passthrough on /v1/chat/completions", () => {
  it("accepts a user input_audio part, preserves the wire shape, and records audio metadata", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createChatContext({
      body: {
        model: "local-fake-model",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "transcribe this" },
            { type: "input_audio", input_audio: { data: WAV_BASE64, format: "wav" } },
          ],
        }],
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    const userMessage = gatewayInput.messages.at(-1);
    expect(Array.isArray(userMessage.content)).toBe(true);
    const audioPart = userMessage.content.find((part) => part.type === "input_audio");
    expect(audioPart.input_audio).toEqual({ data: WAV_BASE64, format: "wav" });
    expect(gatewayInput.metadata.openAiCompatibility.multimodalAudio).toEqual({
      audioCount: 1,
      formats: ["wav", "mp3"],
      passthrough: true,
    });
  });

  it("rejects input_audio outside user messages, bad formats, and non-base64 data", async () => {
    for (const messages of [
      [{ role: "assistant", content: [{ type: "input_audio", input_audio: { data: WAV_BASE64, format: "wav" } }] }],
      [{ role: "user", content: [{ type: "input_audio", input_audio: { data: WAV_BASE64, format: "flac" } }] }],
      [{ role: "user", content: [{ type: "input_audio", input_audio: { data: "not base64!!!", format: "mp3" } }] }],
      [{ role: "user", content: [{ type: "input_audio" }] }],
    ]) {
      const response = createResponseRecorder();
      await dispatchOpenAiCompatibilityRoutes(createChatContext({
        body: { model: "local-fake-model", messages },
        response,
      }));
      expect(response.statusCode).toBe(400);
      expect(response.body.error.message).toBeTruthy();
    }
  });

  it("caps the number of audio parts per request", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createChatContext({
      body: {
        model: "local-fake-model",
        messages: [{
          role: "user",
          content: Array.from({ length: 5 }, () => ({
            type: "input_audio",
            input_audio: { data: WAV_BASE64, format: "mp3" },
          })),
        }],
      },
      response,
    }));
    expect(response.statusCode).toBe(400);
  });

  it("forwards input_audio parts verbatim to the OpenAI-compatible provider wire mapping", async () => {
    const { mapGatewayRequestToChatCompletions } = await import("../providers/httpProviderMapping.js");
    const mapped = mapGatewayRequestToChatCompletions({
      request: {
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "listen" },
            { type: "input_audio", input_audio: { data: WAV_BASE64, format: "wav" } },
          ],
        }],
        options: {},
      },
      target: { modelId: "m1" },
    });
    expect(mapped.messages[0].content[1]).toEqual({
      type: "input_audio",
      input_audio: { data: WAV_BASE64, format: "wav" },
    });
  });
});

describe("Gemini inbound audio inlineData", () => {
  it("maps audio/wav and audio/mpeg inlineData to input_audio parts", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchGeminiCompatibilityRoutes(createGeminiContext({
      body: {
        contents: [{
          role: "user",
          parts: [
            { text: "what do you hear" },
            { inlineData: { mimeType: "audio/wav", data: WAV_BASE64 } },
            { inlineData: { mimeType: "audio/mpeg", data: WAV_BASE64 } },
          ],
        }],
      },
      gatewayService,
      response,
    }));
    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    const userMessage = gatewayInput.messages.at(-1);
    const audioParts = userMessage.content.filter((part) => part.type === "input_audio");
    expect(audioParts).toHaveLength(2);
    expect(audioParts[0].input_audio.format).toBe("wav");
    expect(audioParts[1].input_audio.format).toBe("mp3");
  });

  it("still rejects unsupported inline media types", async () => {
    const response = createResponseRecorder();
    await dispatchGeminiCompatibilityRoutes(createGeminiContext({
      body: {
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "video/mp4", data: "x" } }] }],
      },
      response,
    }));
    expect(response.statusCode).toBe(400);
    expect(response.body.error.status).toBe("INVALID_ARGUMENT");
  });
});
