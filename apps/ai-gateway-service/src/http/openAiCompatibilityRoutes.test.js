import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import {
  dispatchOpenAiCompatibilityRoutes,
  normalizeOpenAiChatCompletionRequest,
} from "./openAiCompatibilityRoutes.js";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [
      {
        id: "local-fake-model",
        enabled: true,
        capabilities: ["chat"],
      },
    ],
  },
];

describe("OpenAI compatibility routes", () => {
  it("lists enabled models in the OpenAI model-list shape", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/v1/models",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("list");
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: "local-fake-model",
        object: "model",
        owned_by: "local-fake-provider",
        unified_ai: expect.objectContaining({ execution_mode: "fake" }),
      }),
    ]);
  });

  it("maps text chat requests and local prompt enhancement to the gateway", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "Build a Node API with tests" }],
        temperature: 0.2,
        top_p: 0.8,
        max_tokens: 128,
        stop: ["END"],
        unified_ai: {
          prompt_enhancement: { enabled: true, profile: "coding", language: "en" },
        },
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.providerId).toBe("local-fake-provider");
    expect(gatewayInput.model).toBe("local-fake-model");
    expect(gatewayInput.options).toEqual({
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 128,
      stopSequences: ["END"],
    });
    expect(gatewayInput.messages[0].content).toContain("# Execution requirements");
    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("chat.completion");
    expect(response.body.choices[0].message).toEqual({
      role: "assistant",
      content: "[fake:local-fake-provider/local-fake-model] completed",
    });
    expect(response.body.usage).toEqual({
      prompt_tokens: 8,
      completion_tokens: 4,
      total_tokens: 12,
    });
    expect(response.body.unified_ai).toEqual(expect.objectContaining({
      selected_provider: "local-fake-provider",
      execution_mode: "fake",
      prompt_enhancement: expect.objectContaining({ applied: true, profile: "coding" }),
    }));
  });

  it("emits OpenAI data-only SSE chunks followed by DONE", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      },
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/event-stream");
    expect(response.text).toContain('"object":"chat.completion.chunk"');
    expect(response.text).toContain('"delta":{"role":"assistant","content":""}');
    expect(response.text).toContain('"delta":{"content":"Hello"}');
    expect(response.text).toContain('"finish_reason":"stop"');
    expect(response.text).toMatch(/data: \[DONE\]\n\n$/);
    expect(response.text).not.toContain("event:");
  });

  it("rejects unsupported multimodal content without calling a provider", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "https://example.invalid/image.png" } }],
          },
        ],
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toEqual(expect.objectContaining({
      type: "invalid_request_error",
      code: "unsupported_parameter",
      param: "messages[0].content[0]",
    }));
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("rejects invalid gateway extensions instead of silently ignoring them", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "Hello" }],
        unified_ai: "invalid",
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body.error.param).toBe("unified_ai");
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("keeps unrelated routes available to later dispatchers", async () => {
    const result = await dispatchOpenAiCompatibilityRoutes({
      request: { method: "POST" },
      url: new URL("http://127.0.0.1/chat"),
    });
    expect(result).toBe(ROUTE_NOT_HANDLED);
  });
});

describe("OpenAI request normalization", () => {
  it("accepts developer messages and text content parts", () => {
    const request = normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [
        { role: "developer", content: "Be concise" },
        { role: "user", content: [{ type: "text", text: "Hello" }] },
      ],
    }, descriptors);

    expect(request.messages).toEqual([
      { role: "system", content: "Be concise" },
      { role: "user", content: "Hello" },
    ]);
  });
});

function createContext({
  body,
  gatewayService = createGatewayService(),
  method = "POST",
  path = "/v1/chat/completions",
  response = createResponseRecorder(),
} = {}) {
  return {
    request: createJsonRequest(body, method),
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${path}`),
    gatewayService,
    writeServiceLog: vi.fn(),
  };
}

function createGatewayService() {
  return {
    getProviderDescriptors: vi.fn(() => descriptors),
    execute: vi.fn(async () => ({
      success: true,
      data: {
        id: "request-123",
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
      meta: { requestId: "request-123" },
    })),
    async *executeStream() {
      const common = {
        requestId: "request-123",
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        executionMode: "fake",
      };
      yield { ...common, type: "start", executionStatus: "streaming" };
      yield { ...common, type: "chunk", textDelta: "Hello", executionStatus: "streaming" };
      yield { ...common, type: "done", executionStatus: "success" };
    },
  };
}

function createJsonRequest(body, method) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.method = method;
  return request;
}

function createResponseRecorder() {
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.text = "";
  response.writableEnded = false;
  response.destroyed = false;
  response.headersSent = false;
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
    response.headersSent = true;
  };
  response.flushHeaders = () => {};
  response.write = (chunk) => {
    response.text += String(chunk);
    return true;
  };
  response.end = (body) => {
    if (body !== undefined) {
      response.text += String(body);
      response.body = JSON.parse(String(body));
    }
    response.writableEnded = true;
  };
  return response;
}
