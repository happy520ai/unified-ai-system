import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  createGeminiGenerateContentResponse,
  createGeminiModelList,
  dispatchGeminiCompatibilityRoutes,
  isGeminiCompatibilityRoute,
  isGeminiStreamRoute,
  parseGeminiModelRoute,
} from "./geminiCompatibilityRoutes.ts";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

interface TestRequest extends Readable {
  method: string;
  enterpriseIdentity?: unknown;
}

interface TestResponse extends EventEmitter {
  statusCode: number | null;
  headers: Record<string, any>;
  body: any;
  text: string;
  writableEnded: boolean;
  destroyed: boolean;
  headersSent: boolean;
  writeHead(statusCode: number, headers?: Record<string, any>): void;
  flushHeaders(): void;
  write(chunk: unknown): boolean;
  end(body?: unknown): void;
}

interface TestGatewayService {
  getProviderDescriptors: Mock<() => typeof descriptors>;
  execute: Mock<(input: any) => Promise<any>>;
  executeStream: (input?: any) => AsyncGenerator<any>;
}

describe("geminiCompatibilityRoutes route matching", () => {
  it("parses generateContent and streamGenerateContent model routes", () => {
    expect(parseGeminiModelRoute("/v1beta/models/gemini-2.5-pro:generateContent")).toEqual({
      modelId: "gemini-2.5-pro",
      action: "generateContent",
    });
    expect(parseGeminiModelRoute("/v1/models/gpt%2dx:streamGenerateContent")).toEqual({
      modelId: "gpt-x",
      action: "streamGenerateContent",
    });
    expect(parseGeminiModelRoute("/v1/chat/completions")).toBeNull();
  });

  it("recognises list and stream routes", () => {
    expect(isGeminiCompatibilityRoute("/v1beta/models")).toBe(true);
    expect(isGeminiCompatibilityRoute("/v1beta/models/m:generateContent")).toBe(true);
    expect(isGeminiCompatibilityRoute("/v1/models")).toBe(true);
    expect(isGeminiCompatibilityRoute("/v1/messages")).toBe(false);
    expect(isGeminiStreamRoute("/v1beta/models/m:streamGenerateContent")).toBe(true);
    expect(isGeminiStreamRoute("/v1beta/models/m:generateContent")).toBe(false);
  });
});

describe("geminiCompatibilityRoutes generateContent", () => {
  it("maps contents and systemInstruction to internal messages and returns Gemini shape", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:generateContent",
      body: {
        systemInstruction: { parts: [{ text: "Be terse." }] },
        contents: [
          { role: "user", parts: [{ text: "hello" }] },
          { role: "model", parts: [{ text: "hi" }] },
          { role: "user", parts: [{ text: "bye" }] },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 64, stopSequences: ["END"] },
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0]![0];
    expect(gatewayInput.messages).toEqual([
      { role: "system", content: "Be terse." },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "bye" },
    ]);
    expect(gatewayInput.options.temperature).toBe(0.3);
    expect(gatewayInput.options.maxOutputTokens).toBe(64);
    expect(gatewayInput.metadata.source).toBe("gemini-compatible-api");
    expect(gatewayInput.metadata.geminiCompatibility.requestedModel).toBe("local-fake-model");

    expect(response.statusCode).toBe(200);
    expect(response.body.candidates[0].content.parts[0].text).toBe(
      "[fake:local-fake-provider/local-fake-model] completed",
    );
    expect(response.body.candidates[0].finishReason).toBe("STOP");
    expect(response.body.usageMetadata).toEqual({
      promptTokenCount: 8,
      candidatesTokenCount: 4,
      totalTokenCount: 12,
    });
    expect(response.body.modelVersion).toBe("local-fake-model");
  });

  it("translates function declarations, calls, and responses", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:generateContent",
      body: {
        contents: [
          { role: "user", parts: [{ text: "weather?" }] },
          {
            role: "model",
            parts: [{ functionCall: { name: "get_weather", args: { city: "hz" } } }],
          },
          {
            role: "user",
            parts: [{ functionResponse: { name: "get_weather", response: { temp: 30 } } }],
          },
        ],
        tools: [
          {
            functionDeclarations: [
              { name: "get_weather", description: "Get weather", parameters: { type: "object" } },
            ],
          },
        ],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0]![0];
    expect(gatewayInput.tools).toEqual([
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather",
          parameters: { type: "object" },
        },
      },
    ]);
    expect(gatewayInput.toolChoice).toBe("auto");
    const [, assistantMessage, toolMessage] = gatewayInput.messages;
    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.toolCalls[0].function.name).toBe("get_weather");
    expect(toolMessage.role).toBe("tool");
    expect(toolMessage.toolCallId).toBe(assistantMessage.toolCalls[0].id);
    expect(JSON.parse(toolMessage.content)).toEqual({ temp: 30 });
  });

  it("maps inline image parts to data-url image inputs", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:generateContent",
      body: {
        contents: [
          {
            role: "user",
            parts: [
              { text: "what is this" },
              { inlineData: { mimeType: "image/png", data: "aGk=" } },
            ],
          },
        ],
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0]![0];
    const userMessage = gatewayInput.messages.at(-1)!;
    expect(Array.isArray(userMessage.content)).toBe(true);
    const imagePart = userMessage.content.find((part: any) => part.type === "image_url")!;
    expect(imagePart.image_url.url).toBe("data:image/png;base64,aGk=");
    expect(response.statusCode).toBe(200);
  });

  it("rejects empty contents and non-image inlineData with 400", async () => {
    for (const body of [
      { contents: [] },
      { contents: [{ role: "user", parts: [{ inlineData: { mimeType: "video/mp4", data: "x" } }] }] },
      { contents: [{ role: "user", parts: [{ unknown: true }] }] },
      { contents: [{ role: "user", parts: [{ functionResponse: { name: "f", response: {} } }] }] },
    ]) {
      const response = createResponseRecorder();
      await dispatchGeminiCompatibilityRoutes(createContext({
        path: "/v1beta/models/local-fake-model:generateContent",
        body,
        response,
      }));
      expect(response.statusCode).toBe(400);
      expect(response.body.error.status).toBe("INVALID_ARGUMENT");
      expect(typeof response.body.error.message).toBe("string");
    }
  });

  it("maps gateway failures to Google error payloads", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    gatewayService.execute = vi.fn(async () => ({
      success: false,
      error: { code: "PROVIDER_TIMEOUT", message: "provider timed out", category: "provider" },
    }));
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:generateContent",
      body: { contents: [{ role: "user", parts: [{ text: "hi" }] }] },
      gatewayService,
      response,
    }));
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
    expect(response.body.error.status).toBeTruthy();
    expect(response.body.error.message).toContain("provider timed out");
  });
});

describe("geminiCompatibilityRoutes streamGenerateContent", () => {
  it("streams SSE chunks and a terminal chunk with finishReason and usageMetadata", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:streamGenerateContent",
      body: { contents: [{ role: "user", parts: [{ text: "hello" }] }] },
      gatewayService,
      response,
    }));

    expect(response.headers["Content-Type"]).toContain("text/event-stream");
    const frames = parseSseFrames(response.text);
    expect(frames.length).toBeGreaterThanOrEqual(3);
    const textFrames = frames.filter((frame) => frame.candidates?.[0]?.content?.parts?.[0]?.text);
    expect(textFrames.map((frame) => frame.candidates[0].content.parts[0].text).join("")).toBe(
      "Hello world",
    );
    const terminal = frames.at(-1)!;
    expect(terminal.candidates[0].finishReason).toBe("STOP");
    expect(terminal.usageMetadata.totalTokenCount).toBeGreaterThan(0);
  });

  it("emits a Gemini error frame when the stream fails", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    gatewayService.executeStream = async function* () {
      yield {
        type: "error",
        envelope: { error: { code: "PROVIDER_FAILED", message: "boom", category: "provider" } },
      };
    };
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:streamGenerateContent",
      body: { contents: [{ role: "user", parts: [{ text: "hello" }] }] },
      gatewayService,
      response,
    }));
    const frames = parseSseFrames(response.text);
    expect(frames.at(-1)!.error.status).toBeTruthy();
    expect(frames.at(-1)!.error.message).toContain("boom");
  });
});

describe("geminiCompatibilityRoutes model list", () => {
  it("lists enabled models in Gemini format", async () => {
    const response = createResponseRecorder();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models",
      method: "GET",
      body: null,
      response,
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.models).toEqual([
      {
        name: "models/local-fake-model",
        displayName: "local-fake-model",
        supportedGenerationMethods: ["generateContent", "streamGenerateContent"],
      },
    ]);
  });

  it("rejects non-GET model list and non-POST generateContent with 405", async () => {
    const listResponse = createResponseRecorder();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models",
      method: "DELETE",
      body: null,
      response: listResponse,
    }));
    expect(listResponse.statusCode).toBe(405);

    const generateResponse = createResponseRecorder();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:generateContent",
      method: "GET",
      body: null,
      response: generateResponse,
    }));
    expect(generateResponse.statusCode).toBe(405);
  });

  it("maps tool_calls in results back to functionCall parts", () => {
    const payload = createGeminiGenerateContentResponse({
      data: {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "get_weather", arguments: "{\"city\":\"hz\"}" },
            },
          ],
        },
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
        finishReason: "tool_calls",
        selectedModel: "m",
      },
    });
    expect(payload.candidates[0].content.parts).toEqual([
      { functionCall: { name: "get_weather", args: { city: "hz" } } },
    ]);
    expect(payload.candidates[0].finishReason).toBe("STOP");
  });

  it("skips disabled models in createGeminiModelList", () => {
    const list = createGeminiModelList([
      { models: [{ id: "a", enabled: true }, { id: "b", enabled: false }] },
    ]);
    expect(list.models.map((model) => model.name)).toEqual(["models/a"]);
  });
});

// ── helpers ──

function createContext({
  body,
  gatewayService = createGatewayService(),
  response,
  path = "/v1beta/models/local-fake-model:generateContent",
  method = "POST",
  enterpriseIdentity = null,
}: {
  body: any;
  gatewayService?: TestGatewayService;
  response: TestResponse;
  path?: string;
  method?: string;
  enterpriseIdentity?: unknown;
}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]) as TestRequest;
  request.method = method;
  if (enterpriseIdentity) request.enterpriseIdentity = enterpriseIdentity;
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${path}`),
    gatewayService,
    enterpriseGovernanceService: null,
    writeServiceLog: vi.fn(),
  };
}

function createGatewayService(): TestGatewayService {
  return {
    getProviderDescriptors: vi.fn(() => descriptors),
    execute: vi.fn(async (_input: any): Promise<any> => ({
      success: true,
      data: {
        id: "request-101",
        message: {
          role: "assistant",
          content: "[fake:local-fake-provider/local-fake-model] completed",
        },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        executionMode: "fake",
        executionStatus: "success",
        finishReason: "stop",
        usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
      },
      meta: { requestId: "request-101" },
    })),
    async *executeStream() {
      const common = {
        requestId: "request-102",
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
      };
      yield { ...common, type: "start", executionStatus: "streaming" };
      yield { ...common, type: "chunk", textDelta: "Hello", executionStatus: "streaming" };
      yield { ...common, type: "chunk", textDelta: " world", executionStatus: "streaming" };
      yield {
        ...common,
        type: "done",
        executionStatus: "success",
        finishReason: "stop",
        rawProviderMeta: { usage: { inputTokens: 7, outputTokens: 5, totalTokens: 12 } },
      };
    },
  };
}

function createResponseRecorder(): TestResponse {
  const response = new EventEmitter() as TestResponse;
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.text = "";
  response.writableEnded = false;
  response.destroyed = false;
  response.headersSent = false;
  response.writeHead = (statusCode: number, headers: Record<string, any> = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
    response.headersSent = true;
  };
  response.flushHeaders = () => {};
  response.write = (chunk: unknown) => {
    response.text += String(chunk);
    return true;
  };
  response.end = (body?: unknown) => {
    if (body !== undefined) {
      response.text += String(body);
      response.body = JSON.parse(String(body));
    }
    response.writableEnded = true;
  };
  return response;
}

function parseSseFrames(text: string): any[] {
  return text
    .split("\n\n")
    .filter((frame) => frame.trim().length > 0)
    .map((frame) => {
      const dataLine = frame.split(/\r?\n/).find((line) => line.startsWith("data:"));
      return JSON.parse(String(dataLine).slice(5).trimStart());
    });
}

describe("geminiCompatibilityRoutes batchGenerateContent", () => {
  it("executes each entry and returns a responses array", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:batchGenerateContent",
      body: {
        requests: [
          { contents: [{ role: "user", parts: [{ text: "first" }] }] },
          { contents: [{ role: "user", parts: [{ text: "second" }] }] },
        ],
      },
      gatewayService,
      response,
    }));
    expect(response.statusCode).toBe(200);
    expect(gatewayService.execute).toHaveBeenCalledTimes(2);
    expect(response.body.responses).toHaveLength(2);
    expect(response.body.responses[0].candidates[0].content.parts[0].text).toContain("completed");
    expect(response.body.partialFailure).toBeUndefined();
  });

  it("isolates per-entry execution failures instead of failing the batch", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    let calls = 0;
    gatewayService.execute = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return { success: false, error: { code: "PROVIDER_FAILED", message: "boom", category: "provider" } };
      }
      return {
        success: true,
        data: {
          message: { role: "assistant", content: "ok" },
          selectedModel: "local-fake-model",
          finishReason: "stop",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
        meta: { requestId: "r" },
      };
    });
    await dispatchGeminiCompatibilityRoutes(createContext({
      path: "/v1beta/models/local-fake-model:batchGenerateContent",
      body: {
        requests: [
          { contents: [{ role: "user", parts: [{ text: "bad" }] }] },
          { contents: [{ role: "user", parts: [{ text: "good" }] }] },
        ],
      },
      gatewayService,
      response,
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.partialFailure).toBe(true);
    expect(response.body.failureCount).toBe(1);
    expect(response.body.responses[0].error.status).toBeTruthy();
    expect(response.body.responses[1].candidates).toBeTruthy();
  });

  it("rejects empty and oversized batches", async () => {
    for (const requests of [[], Array.from({ length: 17 }, () => ({ contents: [{ role: "user", parts: [{ text: "x" }] }] }))]) {
      const response = createResponseRecorder();
      await dispatchGeminiCompatibilityRoutes(createContext({
        path: "/v1beta/models/local-fake-model:batchGenerateContent",
        body: { requests },
        response,
      }));
      expect(response.statusCode).toBe(400);
    }
  });
});
