import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import {
  createAnthropicMessage,
  createOpenAiChatCompletionChunk,
  dispatchOpenAiCompatibilityRoutes,
  normalizeAnthropicMessageRequest,
  normalizeOpenAiChatCompletionRequest,
  normalizeOpenAiCompletionRequest,
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

  it("returns a model detail record for GET /v1/models/{id}", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/v1/models/local-fake-model",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("model");
    expect(response.body.id).toBe("local-fake-model");
    expect(response.body.owned_by).toBe("local-fake-provider");
  });

  it("returns an engine detail record for GET /v1/engines/{id}", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/v1/engines/local-fake-model",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("engine");
    expect(response.body.id).toBe("local-fake-model");
    expect(response.body.owner).toBe("local-fake-provider");
  });

  it("returns route-detail 404 when the model id is unknown", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/v1/models/missing-model",
      response,
    }));

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toEqual(expect.objectContaining({
      code: "model_not_found",
      param: "model_id",
    }));
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

  it("accepts trailing slash chat paths", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/chat/completions/",
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "How do I normalize paths?" }],
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("chat.completion");
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
  });

  it("accepts root alias model list path", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/models",
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

  it("lists legacy engine entries for /v1/engines", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/v1/engines",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("list");
    expect(response.body.data).toEqual([
      expect.objectContaining({
        id: "local-fake-model",
        object: "engine",
        owned_by: "local-fake-provider",
        unified_ai: expect.objectContaining({ execution_mode: "fake" }),
      }),
    ]);
  });

  it("accepts root alias engine list path", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/engines",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("list");
  });

  it("supports root alias model detail path", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      method: "GET",
      path: "/models/local-fake-model",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("model");
    expect(response.body.id).toBe("local-fake-model");
  });

  it("accepts root client alias chat path without /v1", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/chat/completions",
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "Root alias check." }],
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("chat.completion");
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
  });

  it("uses Azure-style deployment path as model fallback for chat", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/openai/deployments/local-fake-model/chat/completions/",
      body: {
        messages: [{ role: "user", content: "Run this query from deployment path." }],
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.model).toBe("local-fake-model");
    expect(response.body.object).toBe("chat.completion");
  });

  it("uses Azure-style deployment path as model fallback for completions", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/openai/deployments/local-fake-model/completions",
      body: {
        prompt: "Rewrite this sentence.",
      },
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.model).toBe("local-fake-model");
    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("text_completion");
  });

  it("supports legacy engine chat/completions path with model inference", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/engines/local-fake-model/chat/completions",
      body: {
        messages: [{ role: "user", content: "Model comes from engine path." }],
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("chat.completion");
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
    expect(gatewayService.execute.mock.calls[0][0].model).toBe("local-fake-model");
  });

  it("supports legacy engine completions path with model inference", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/engines/local-fake-model/completions",
      body: {
        prompt: "Legacy engine completions path.",
      },
      gatewayService,
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("text_completion");
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
    expect(gatewayService.execute.mock.calls[0][0].model).toBe("local-fake-model");
  });

  it("maps legacy completion prompts to the same gateway path", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        prompt: "Rewrite this request in better prose.",
      },
      path: "/v1/completions",
      gatewayService,
      response,
    }));

    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.providerId).toBe("local-fake-provider");
    expect(gatewayInput.model).toBe("local-fake-model");
    expect(gatewayInput.messages).toEqual([
      { role: "user", content: "Rewrite this request in better prose." },
    ]);

    expect(response.statusCode).toBe(200);
    expect(response.body.object).toBe("text_completion");
    expect(response.body.choices[0]).toEqual({
      text: "[fake:local-fake-provider/local-fake-model] completed",
      index: 0,
      logprobs: null,
      finish_reason: "stop",
    });
    expect(response.body.usage).toEqual({
      prompt_tokens: 8,
      completion_tokens: 4,
      total_tokens: 12,
    });
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

  it("emits a final estimated usage chunk when stream usage is requested", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
        stream_options: { include_usage: true },
      },
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('"choices":[],"usage":{');
    expect(response.text).toContain('"usage_estimated":true');
    expect(response.text).toMatch(/data: \[DONE\]\n\n$/);
  });

  it("streams legacy completion chunks in text_completion format", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        prompt: "Build a migration plan",
        stream: true,
      },
      path: "/v1/completions",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/event-stream");
    expect(response.text).toContain('"object":"text_completion"');
    expect(response.text).toContain('"text":"Hello"');
    expect(response.text).toContain('"finish_reason":"stop"');
    expect(response.text).toMatch(/data: \[DONE\]\n\n$/);
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

  it("accepts OpenAI JSON object and JSON schema response formats", () => {
    const jsonObject = normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Return JSON" }],
      response_format: { type: "json_object" },
    }, descriptors);
    expect(jsonObject.options.responseFormat).toBe("json");
    expect(jsonObject.metadata.openAiCompatibility.responseFormat).toEqual({
      type: "json_object",
    });

    const jsonSchema = normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Return typed JSON" }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "GatewayResult",
          strict: true,
          schema: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
          },
        },
      },
    }, descriptors);
    expect(jsonSchema.options.responseFormat).toBe("json");
    expect(jsonSchema.metadata.openAiCompatibility.responseFormat).toEqual(
      expect.objectContaining({ type: "json_schema" }),
    );
  });

  it("rejects malformed or unsupported response formats", async () => {
    for (const responseFormat of [
      "json_object",
      { type: "yaml" },
      { type: "json_schema", json_schema: { name: "MissingSchema" } },
    ]) {
      const response = createResponseRecorder();
      const gatewayService = createGatewayService();
      await dispatchOpenAiCompatibilityRoutes(createContext({
        body: {
          model: "local-fake-model",
          messages: [{ role: "user", content: "Hello" }],
          response_format: responseFormat,
        },
        gatewayService,
        response,
      }));

      expect(response.statusCode).toBe(400);
      expect(response.body.error.type).toBe("invalid_request_error");
      expect(gatewayService.execute).not.toHaveBeenCalled();
    }
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
  it("serializes streaming function-call deltas and finish reasons", () => {
    const toolCallsDelta = [{
      index: 0,
      id: "call_1",
      type: "function",
      function: { name: "lookup", arguments: "{}" },
    }];
    const delta = createOpenAiChatCompletionChunk({
      type: "chunk",
      requestId: "req_1",
      selectedModel: "local-fake-model",
      rawProviderMeta: { toolCallsDelta, finishReason: "tool_calls" },
    });
    const done = createOpenAiChatCompletionChunk({
      type: "done",
      requestId: "req_1",
      selectedModel: "local-fake-model",
      rawProviderMeta: { toolCallsDelta, finishReason: "tool_calls" },
    });

    expect(delta.choices[0].delta.tool_calls).toEqual(toolCallsDelta);
    expect(delta.choices[0].finish_reason).toBeNull();
    expect(done.choices[0].delta).toEqual({});
    expect(done.choices[0].finish_reason).toBe("tool_calls");
  });

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

  it("treats SDK-serialized null optionals as unset", () => {
    const request = normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Hello" }],
      tools: null,
      tool_choice: null,
      parallel_tool_calls: null,
      logprobs: false,
      top_logprobs: null,
    }, descriptors);

    expect(request.model).toBe("local-fake-model");
  });

  it("normalizes OpenAI function tools and tool selection", () => {
    const request = normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Inspect the workspace" }],
      tools: [{
        type: "function",
        function: {
          name: "read_file",
          description: "Read one file",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
          },
          strict: true,
        },
      }],
      tool_choice: { type: "function", function: { name: "read_file" } },
      parallel_tool_calls: false,
    }, descriptors);

    expect(request.tools).toHaveLength(1);
    expect(request.tools[0].function.name).toBe("read_file");
    expect(request.toolChoice).toEqual({ type: "function", function: { name: "read_file" } });
    expect(request.parallelToolCalls).toBe(false);
    expect(request.metadata.openAiCompatibility.toolCount).toBe(1);
  });

  it("normalizes assistant tool calls and tool result messages", () => {
    const request = normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{
        role: "assistant",
        content: null,
        tool_calls: [{
          id: "call_1",
          type: "function",
          function: { name: "read_file", arguments: "{\"path\":\"README.md\"}" },
        }],
      }, {
        role: "tool",
        tool_call_id: "call_1",
        content: "contents",
      }],
      tools: [{
        type: "function",
        function: { name: "read_file", parameters: { type: "object" } },
      }],
    }, descriptors);

    expect(request.messages[0].toolCalls[0].id).toBe("call_1");
    expect(request.messages[1].toolCallId).toBe("call_1");
  });

  it("rejects malformed tools and unknown named tool choices", () => {
    expect(() => normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Hello" }],
      tools: [{ type: "function", function: { name: "bad name" } }],
    }, descriptors)).toThrow(/function\.name/);

    expect(() => normalizeOpenAiChatCompletionRequest({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Hello" }],
      tools: [{ type: "function", function: { name: "known_tool" } }],
      tool_choice: { type: "function", function: { name: "missing_tool" } },
    }, descriptors)).toThrow(/unknown tool/);
  });

  it("accepts completion prompts as string and array", () => {
    const byString = normalizeOpenAiCompletionRequest({
      model: "local-fake-model",
      prompt: "Build this in plain text",
    }, descriptors);
    expect(byString.messages).toEqual([{ role: "user", content: "Build this in plain text" }]);

    const byArray = normalizeOpenAiCompletionRequest({
      model: "local-fake-model",
      prompt: ["Build this", " in steps."],
    }, descriptors);
    expect(byArray.messages).toEqual([{ role: "user", content: "Build this in steps." }]);
  });

  it("normalizes Anthropic text messages and system blocks without retaining user identifiers", () => {
    const request = normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 128,
      system: [{ type: "text", text: "Answer briefly." }],
      messages: [{
        role: "user",
        content: [{ type: "text", text: "Hello from Anthropic." }],
      }],
      metadata: { user_id: "private-user-reference" },
      temperature: 0.4,
      stop_sequences: ["STOP"],
    }, descriptors);

    expect(request.messages).toEqual([
      { role: "system", content: "Answer briefly." },
      { role: "user", content: "Hello from Anthropic." },
    ]);
    expect(request.options).toMatchObject({
      maxOutputTokens: 128,
      temperature: 0.4,
      stopSequences: ["STOP"],
    });
    expect(request.metadata.source).toBe("anthropic-compatible-api");
    expect(request.metadata.anthropicCompatibility.metadataUserIdPresent).toBe(true);
    expect(JSON.stringify(request)).not.toContain("private-user-reference");
  });

  it("serves Anthropic Messages in the official response shape", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        max_tokens: 64,
        messages: [{ role: "user", content: "Hello" }],
      },
      path: "/v1/messages",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      type: "message",
      role: "assistant",
      model: "local-fake-model",
      stop_reason: "end_turn",
      content: [{ type: "text" }],
      usage: { input_tokens: 8, output_tokens: 4 },
      unified_ai: {
        provider_id: "local-fake-provider",
        execution_mode: "fake",
      },
    });
    expect(response.body.id).toMatch(/^msg_/);
  });

  it("emits the Anthropic SSE message lifecycle", async () => {
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        max_tokens: 64,
        stream: true,
        messages: [{ role: "user", content: "Stream" }],
      },
      path: "/v1/messages",
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(Object.entries(response.headers).some(([name, value]) => (
      name.toLowerCase() === "content-type" && String(value).includes("text/event-stream")
    ))).toBe(true);
    expect(response.text).toContain("event: message_start");
    expect(response.text).toContain("event: content_block_start");
    expect(response.text).toContain('"type":"text_delta","text":"Hello"');
    expect(response.text).toContain("event: content_block_stop");
    expect(response.text).toContain("event: message_delta");
    expect(response.text).toContain("event: message_stop");
  });

  it("rejects unsupported Anthropic tools and non-text content without pretending compatibility", () => {
    expect(() => normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 64,
      messages: [{ role: "user", content: "Hello" }],
      tools: [],
    }, descriptors)).toThrow(/tools is not supported/);

    expect(() => normalizeAnthropicMessageRequest({
      model: "local-fake-model",
      max_tokens: 64,
      messages: [{
        role: "user",
        content: [{ type: "image", source: { type: "base64" } }],
      }],
    }, descriptors)).toThrow(/only text blocks are enabled/);
  });

  it("creates Anthropic response objects from gateway results", () => {
    const response = createAnthropicMessage({
      success: true,
      data: {
        id: "request-abc",
        message: { content: "Result" },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        executionMode: "fake",
        finishReason: "length",
        usage: { inputTokens: 3, outputTokens: 2 },
      },
      meta: { requestId: "request-abc" },
    });

    expect(response.id).toBe("msg_request-abc");
    expect(response.stop_reason).toBe("max_tokens");
    expect(response.usage).toEqual({ input_tokens: 3, output_tokens: 2 });
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
