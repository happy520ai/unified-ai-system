import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchOpenAiResponsesRoutes,
  normalizeOpenAiResponseRequest,
} from "./openAiResponsesRoutes.js";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

describe("OpenAI Responses compatibility routes", () => {
  it("maps text input and instructions to a completed Response", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        instructions: "Be concise",
        input: [
          {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: "Build an API" }],
          },
        ],
        max_output_tokens: 128,
        metadata: { test: "responses" },
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.messages).toEqual([
      { role: "system", content: "Be concise" },
      { role: "user", content: "Build an API" },
    ]);
    expect(gatewayInput.options.maxOutputTokens).toBe(128);
    expect(gatewayInput.metadata.openAiCompatibility.api).toBe("responses");
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      object: "response",
      status: "completed",
      model: "local-fake-model",
      output_text: "[fake:local-fake-provider/local-fake-model] completed",
      metadata: { test: "responses" },
    }));
    expect(response.body.output[0]).toEqual(expect.objectContaining({
      type: "message",
      role: "assistant",
      status: "completed",
    }));
    expect(response.body.usage).toEqual(expect.objectContaining({
      input_tokens: 8,
      output_tokens: 4,
      total_tokens: 12,
    }));
    expect(response.body.unified_ai).toEqual(expect.objectContaining({
      selected_provider: "local-fake-provider",
      execution_mode: "fake",
    }));
  });

  it("supports Azure-style Responses path and infers deployment model", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiResponsesRoutes(createContext({
      path: "/openai/deployments/local-fake-model/responses",
      body: {
        input: "Draft a concise checklist.",
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.model).toBe("local-fake-model");
    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("response");
  });

  it("accepts trailing slash for responses path", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      path: "/v1/responses/",
      body: {
        model: "local-fake-model",
        input: "Trim my wording.",
      },
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("response");
  });

  it("accepts root responses path without /v1", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiResponsesRoutes(createContext({
      path: "/responses",
      body: {
        model: "local-fake-model",
        input: "Use root responses path.",
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("response");
    expect(response.body.model).toBe("local-fake-model");
  });

  it("emits Responses SSE events and a completed response", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Stream through Responses",
        stream: true,
      },
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/event-stream");
    expect(response.text).toContain("event: response.created");
    expect(response.text).toContain("event: response.output_text.delta");
    expect(response.text).toContain('"delta":"Hello"');
    expect(response.text).toContain("event: response.completed");
    expect(response.text).toMatch(/data: \[DONE\]\n\n$/);
  });

  it("emits a structured SSE error when the gateway iterator throws", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    gatewayService.executeStream = async function* executeStream() {
      const error = new Error("Provider stream failed");
      error.code = "provider_stream_failed";
      throw error;
    };

    await dispatchOpenAiResponsesRoutes(createContext({
      body: { model: "local-fake-model", input: "Stream", stream: true },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain("event: error");
    expect(response.text).toContain('\"code\":\"provider_stream_failed\"');
    expect(response.text).not.toContain("event: response.completed");
    expect(response.text).toMatch(/data: \[DONE\]\n\n$/);
  });

  it("rejects tools and remote multimodal input without gateway execution", async () => {
    const gatewayService = createGatewayService();
    const toolResponse = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Use a tool",
        tools: [{ type: "function", name: "lookup", parameters: {} }],
      },
      gatewayService,
      response: toolResponse,
    }));
    expect(toolResponse.statusCode).toBe(400);
    expect(toolResponse.body.error).toEqual(expect.objectContaining({
      code: "unsupported_parameter",
      param: "tools",
    }));

    const imageResponse = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: [{
          role: "user",
          content: [{ type: "input_image", image_url: "https://example.invalid/a.png" }],
        }],
      },
      gatewayService,
      response: imageResponse,
    }));
    expect(imageResponse.statusCode).toBe(400);
    expect(imageResponse.body.error.param).toBe("input[0].content[0].image_url");
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });
});

describe("OpenAI Responses request normalization", () => {
  it("uses the first enabled model when the SDK omits model", () => {
    const request = normalizeOpenAiResponseRequest({ input: "Hello" }, descriptors);
    expect(request.providerId).toBe("local-fake-provider");
    expect(request.model).toBe("local-fake-model");
    expect(request.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("rejects content arrays containing only empty text", () => {
    expect(() => normalizeOpenAiResponseRequest({
      input: [{ role: "user", content: [{ type: "input_text", text: " " }] }],
    }, descriptors)).toThrow("cannot be empty");
  });

  it("maps inline input_image blocks to the vision-capable gateway contract", () => {
    const imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const request = normalizeOpenAiResponseRequest({
      model: "local-fake-model",
      input: [{ role: "user", content: [
        { type: "input_text", text: "Describe" },
        { type: "input_image", image_url: imageUrl, detail: "low" },
      ] }],
    }, descriptors);

    expect(request.requiredCapabilities).toEqual(["vision"]);
    expect(request.messages[0].content).toEqual([
      { type: "text", text: "Describe" },
      { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
    ]);
    expect(request.metadata.openAiCompatibility.api).toBe("responses");
  });
});

function createContext({ body, gatewayService = createGatewayService(), response, path = "/v1/responses" }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  return {
    request,
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
