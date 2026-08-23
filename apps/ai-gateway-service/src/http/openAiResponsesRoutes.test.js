import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchOpenAiResponsesRoutes,
  normalizeOpenAiResponseRequest,
} from "./openAiResponsesRoutes.js";
import { createResponseSessionStore } from "../responses/responseSessionStore.js";

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

  it("rejects remote multimodal input and unknown tool types without gateway execution", async () => {
    const gatewayService = createGatewayService();

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

    const builtinToolResponse = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Search the web",
        tools: [{ type: "custom_widget" }],
      },
      gatewayService,
      response: builtinToolResponse,
    }));
    expect(builtinToolResponse.statusCode).toBe(400);
    expect(builtinToolResponse.body.error).toEqual(expect.objectContaining({
      code: "unsupported_parameter",
      param: "tools[0].type",
    }));
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("drops Codex-style built-in tools, include tokens, and cache hints with recorded metadata", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Do the thing",
        tools: [
          { type: "function", name: "shell", parameters: { type: "object" } },
          { type: "namespace" },
          { type: "web_search" },
        ],
        include: ["reasoning.encrypted_content"],
        prompt_cache_key: "cache-key-1",
      },
      gatewayService,
      responseSessionStore: createResponseSessionStore({}),
      response,
    }));

    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.tools).toHaveLength(1);
    expect(gatewayInput.tools[0].function.name).toBe("shell");
    expect(gatewayInput.metadata.openAiCompatibility.droppedToolTypes).toEqual(["namespace", "web_search"]);
    expect(gatewayInput.metadata.openAiCompatibility.droppedIncludeTokens).toEqual(["reasoning.encrypted_content"]);
    expect(gatewayInput.metadata.openAiCompatibility.droppedParameters).toEqual(["prompt_cache_key"]);
  });

  it("skips blank assistant history items instead of rejecting them", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: [
          { type: "message", role: "user", content: [{ type: "input_text", text: "Go" }] },
          { type: "message", role: "assistant", content: [{ type: "output_text", text: "\n\n" }] },
          { type: "message", role: "user", content: [{ type: "input_text", text: "Continue" }] },
        ],
      },
      gatewayService,
      responseSessionStore: createResponseSessionStore({}),
      response,
    }));

    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.messages.map((message) => message.role)).toEqual(["user", "user"]);
  });

  it("maps Responses function tools, tool_choice, and call items to the chat contract", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Run the lookup",
        tools: [{
          type: "function",
          name: "lookup",
          description: "Look things up",
          parameters: { type: "object", properties: { q: { type: "string" } } },
          strict: false,
        }],
        tool_choice: "auto",
        parallel_tool_calls: false,
      },
      gatewayService,
      responseSessionStore: createResponseSessionStore({}),
      response,
    }));

    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.tools).toEqual([{
      type: "function",
      function: {
        name: "lookup",
        description: "Look things up",
        parameters: { type: "object", properties: { q: { type: "string" } } },
        strict: false,
      },
    }]);
    expect(gatewayInput.toolChoice).toBe("auto");
    expect(response.body.tools).toEqual([{
      type: "function",
      name: "lookup",
      description: "Look things up",
      parameters: { type: "object", properties: { q: { type: "string" } } },
      strict: false,
    }]);
    expect(response.body.tool_choice).toBe("auto");
  });

  it("round-trips function_call items and outputs into tool messages", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: [
          { type: "function_call", call_id: "call_1", name: "lookup", arguments: "{\"q\":\"ada\"}" },
          { type: "function_call_output", call_id: "call_1", output: "{\"result\":\"found\"}" },
          { type: "message", role: "user", content: [{ type: "input_text", text: "Summarize" }] },
          { type: "reasoning", id: "rs_1", summary: [] },
        ],
      },
      gatewayService,
      responseSessionStore: createResponseSessionStore({}),
      response,
    }));

    expect(response.statusCode).toBe(200);
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    const toolCallMessage = gatewayInput.messages.find((message) => message.role === "assistant");
    expect(toolCallMessage.toolCalls).toEqual([{
      id: "call_1",
      type: "function",
      function: { name: "lookup", arguments: "{\"q\":\"ada\"}" },
    }]);
    const toolMessage = gatewayInput.messages.find((message) => message.role === "tool");
    expect(toolMessage).toEqual(expect.objectContaining({
      role: "tool",
      content: "{\"result\":\"found\"}",
      toolCallId: "call_1",
    }));
    expect(gatewayInput.metadata.openAiCompatibility.droppedReasoningInputItems).toBe(1);
  });

  it("emits reasoning and function_call output items from the provider result", async () => {
    const gatewayService = createGatewayService();
    gatewayService.execute = vi.fn(async () => ({
      success: true,
      data: {
        id: "request-tool-1",
        message: {
          role: "assistant",
          content: "Done",
          reasoningContent: "I considered the lookup result.",
          tool_calls: [{
            id: "call_9",
            type: "function",
            function: { name: "lookup", arguments: "{\"q\":\"x\"}" },
          }],
        },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        executionMode: "fake",
        usage: { inputTokens: 8, outputTokens: 4, reasoningTokens: 3, totalTokens: 12 },
      },
      meta: { requestId: "request-tool-1" },
    }));
    const sessionStore = createResponseSessionStore({});
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Use the tool",
        tools: [{ type: "function", name: "lookup", parameters: { type: "object" } }],
        store: true,
      },
      gatewayService,
      responseSessionStore: sessionStore,
      response,
    }));

    expect(response.statusCode).toBe(200);
    const types = response.body.output.map((item) => item.type);
    expect(types).toEqual(["reasoning", "function_call", "message"]);
    expect(response.body.output[0].summary[0].text).toBe("I considered the lookup result.");
    expect(response.body.output[1]).toEqual(expect.objectContaining({
      type: "function_call",
      call_id: "call_9",
      name: "lookup",
      arguments: "{\"q\":\"x\"}",
    }));
    expect(response.body.usage.output_tokens_details.reasoning_tokens).toBe(3);

    const stored = sessionStore.get(response.body.id);
    expect(stored.reasoningSummary).toBe("I considered the lookup result.");
    expect(stored.contextMessages.at(-1).tool_calls[0]).toEqual(expect.objectContaining({
      id: "call_9",
    }));
  });

  it("replays retained reasoning summaries into chained turns", async () => {
    const sessionStore = createResponseSessionStore({});
    const gatewayService = createGatewayService();
    gatewayService.execute = vi.fn(async () => ({
      success: true,
      data: {
        id: "request-rs-1",
        message: {
          role: "assistant",
          content: "Answer",
          reasoningContent: "Derived that the answer is stable.",
        },
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
      meta: { requestId: "request-rs-1" },
    }));

    const first = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: { model: "local-fake-model", input: "Think", store: true },
      gatewayService,
      responseSessionStore: sessionStore,
      response: first,
    }));
    const second = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        previous_response_id: first.body.id,
        input: "Continue",
      },
      gatewayService,
      responseSessionStore: sessionStore,
      response: second,
    }));

    const chainedMessages = gatewayService.execute.mock.calls[1][0].messages;
    const retained = chainedMessages.find((message) =>
      message.role === "system" && message.content.includes("Retained reasoning"));
    expect(retained.content).toContain("Derived that the answer is stable.");
  });

  it("retrieves and deletes stored responses by id", async () => {
    const sessionStore = createResponseSessionStore({});
    const gatewayService = createGatewayService();
    const created = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: { model: "local-fake-model", input: "Store me", store: true },
      gatewayService,
      responseSessionStore: sessionStore,
      response: created,
    }));
    const responseId = created.body.id;

    const retrieved = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      method: "GET",
      path: `/v1/responses/${responseId}`,
      gatewayService,
      responseSessionStore: sessionStore,
      response: retrieved,
    }));
    expect(retrieved.statusCode).toBe(200);
    expect(retrieved.body.id).toBe(responseId);
    expect(retrieved.body.output_text).toBe(created.body.output_text);

    const deleted = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      method: "DELETE",
      path: `/v1/responses/${responseId}`,
      gatewayService,
      responseSessionStore: sessionStore,
      response: deleted,
    }));
    expect(deleted.statusCode).toBe(200);
    expect(deleted.body).toEqual({ id: responseId, object: "response", deleted: true });

    const missing = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      method: "GET",
      path: `/v1/responses/${responseId}`,
      gatewayService,
      responseSessionStore: sessionStore,
      response: missing,
    }));
    expect(missing.statusCode).toBe(404);
    expect(missing.body.error.code).toBe("response_not_found");
  });

  it("enforces the virtual key budget gate on the Responses path", async () => {
    const gatewayService = createGatewayService();
    const authorizeUsage = vi.fn(() => ({
      allowed: false,
      code: "VIRTUAL_KEY_BUDGET_EXHAUSTED",
    }));
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: { model: "local-fake-model", input: "Over budget" },
      gatewayService,
      response,
      enterpriseGovernanceService: {
        getApiKeyManager: () => ({ authorizeUsage, recordUsage: vi.fn() }),
      },
      enterpriseIdentity: { apiKeyFingerprint: "fp123", tenantId: "default" },
      responseSessionStore: createResponseSessionStore({}),
    }));

    expect(response.statusCode).toBe(429);
    expect(response.body.error).toEqual(expect.objectContaining({
      code: "VIRTUAL_KEY_BUDGET_EXHAUSTED",
      type: "rate_limit_error",
    }));
    expect(authorizeUsage).toHaveBeenCalled();
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("records virtual key usage after a successful Responses call", async () => {
    const gatewayService = createGatewayService();
    const recordUsage = vi.fn(() => ({ softBudgetExceeded: false }));
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: { model: "local-fake-model", input: "Record me" },
      gatewayService,
      response,
      enterpriseGovernanceService: {
        getApiKeyManager: () => ({
          authorizeUsage: () => ({ allowed: true }),
          recordUsage,
        }),
      },
      enterpriseIdentity: { apiKeyFingerprint: "fp456", tenantId: "default" },
      responseSessionStore: createResponseSessionStore({}),
    }));

    expect(response.statusCode).toBe(200);
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ keyId: "fp456" }));
  });
});

describe("OpenAI Responses sessions (previous_response_id + reasoning)", () => {
  it("stores a response and chains the next turn through previous_response_id", async () => {
    const sessionStore = createResponseSessionStore({});
    const gatewayService = createGatewayService();
    const first = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        instructions: "Stay terse",
        input: "My name is Ada.",
        store: true,
      },
      gatewayService,
      responseSessionStore: sessionStore,
      response: first,
    }));

    expect(first.statusCode).toBe(200);
    expect(first.body.store).toBe(true);
    expect(sessionStore.size()).toBe(1);

    const second = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        previous_response_id: first.body.id,
        input: "What is my name?",
      },
      gatewayService,
      responseSessionStore: sessionStore,
      response: second,
    }));

    expect(second.statusCode).toBe(200);
    expect(second.body.previous_response_id).toBe(first.body.id);
    const chainedMessages = gatewayService.execute.mock.calls[1][0].messages;
    expect(chainedMessages).toEqual([
      { role: "system", content: "Stay terse" },
      { role: "user", content: "My name is Ada." },
      { role: "assistant", content: "[fake:local-fake-provider/local-fake-model] completed" },
      { role: "user", content: "What is my name?" },
    ]);
    expect(sessionStore.size()).toBe(2);
  });

  it("does not store responses when store is false and reports that honestly", async () => {
    const sessionStore = createResponseSessionStore({});
    const gatewayService = createGatewayService();
    const first = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Stateless turn",
        store: false,
      },
      gatewayService,
      responseSessionStore: sessionStore,
      response: first,
    }));

    expect(first.statusCode).toBe(200);
    expect(first.body.store).toBe(false);
    expect(sessionStore.size()).toBe(0);
  });

  it("returns 404 response_not_found for an unknown previous_response_id", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        previous_response_id: "resp_does_not_exist_1234567890",
        input: "Continue",
      },
      gatewayService,
      responseSessionStore: createResponseSessionStore({}),
      response,
    }));

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toEqual(expect.objectContaining({
      code: "response_not_found",
      param: "previous_response_id",
    }));
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("passes reasoning effort into gateway options and echoes it back", async () => {
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Reason carefully.",
        reasoning: { effort: "high", summary: "auto" },
      },
      gatewayService,
      responseSessionStore: createResponseSessionStore({}),
      response,
    }));

    expect(response.statusCode).toBe(200);
    expect(response.body.reasoning).toEqual({ effort: "high", summary: "auto" });
    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.options.reasoningEffort).toBe("high");
    expect(gatewayInput.metadata.openAiCompatibility.reasoningEffort).toBe("high");
  });

  it("rejects invalid reasoning and store values without gateway execution", async () => {
    const gatewayService = createGatewayService();
    for (const body of [
      { model: "local-fake-model", input: "x", reasoning: { effort: "maximum" } },
      { model: "local-fake-model", input: "x", reasoning: { summary: "verbose" } },
      { model: "local-fake-model", input: "x", store: "yes" },
      { model: "local-fake-model", input: "x", previous_response_id: 42 },
    ]) {
      const response = createResponseRecorder();
      await dispatchOpenAiResponsesRoutes(createContext({
        body,
        gatewayService,
        responseSessionStore: createResponseSessionStore({}),
        response,
      }));
      expect(response.statusCode).toBe(400);
      expect(response.body.error.code).toBe("invalid_request");
    }
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });

  it("stores streamed responses and chains follow-up turns", async () => {
    const sessionStore = createResponseSessionStore({});
    const gatewayService = createGatewayService();
    const first = createResponseRecorder();
    await dispatchOpenAiResponsesRoutes(createContext({
      body: {
        model: "local-fake-model",
        input: "Stream one",
        stream: true,
        store: true,
      },
      gatewayService,
      responseSessionStore: sessionStore,
      response: first,
    }));

    expect(first.text).toContain("event: response.completed");
    expect(sessionStore.size()).toBe(1);
    const stored = sessionStore.get(first.text.match(/"id":"(resp_[A-Za-z0-9_-]+)"/)?.[1]);
    expect(stored).not.toBeNull();
    expect(stored.assistantOutput).toBe("Hello");
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

function createContext({
  body,
  gatewayService = createGatewayService(),
  response,
  path = "/v1/responses",
  method = "POST",
  responseSessionStore = null,
  enterpriseGovernanceService = null,
  enterpriseIdentity = null,
}) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  request.method = method;
  if (enterpriseIdentity) request.enterpriseIdentity = enterpriseIdentity;
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${path}`),
    gatewayService,
    responseSessionStore,
    enterpriseGovernanceService,
    writeServiceLog: vi.fn(),
  };
}

function createGatewayService() {
  let executeCount = 0;
  return {
    getProviderDescriptors: vi.fn(() => descriptors),
    execute: vi.fn(async () => {
      executeCount += 1;
      return {
        success: true,
        data: {
          id: `request-${100 + executeCount}`,
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
        meta: { requestId: `request-${100 + executeCount}` },
      };
    }),
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
