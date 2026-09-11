import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { dispatchOpenAiCompatibilityRoutes } from "../http/openAiCompatibilityRoutes.js";
import { dispatchOpenAiResponsesRoutes } from "../http/openAiResponsesRoutes.js";
import { dispatchGeminiCompatibilityRoutes } from "../http/geminiCompatibilityRoutes.ts";
import { createChatRoutes } from "../http/httpServerChatRoutes.js";
import {
  createGuardrailsEngineForTests,
  setGuardrailsEngineForTests,
} from "./guardrailsEngine.ts";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

interface TestRequest extends Readable {
  method: string;
}

interface TestResponse extends EventEmitter {
  statusCode: number | null;
  headers: Record<string, unknown>;
  body: any;
  text: string;
  writableEnded: boolean;
  headersSent: boolean;
  writeHead(statusCode: number, headers?: Record<string, unknown>): void;
  flushHeaders(): void;
  write(chunk: unknown): boolean;
  end(body?: unknown): void;
}

interface TestGatewayService {
  getProviderDescriptors(): typeof descriptors;
  execute: Mock<(input: any) => Promise<any>>;
  executeStream(input?: any): AsyncGenerator<any>;
}

function createGatewayService(): TestGatewayService {
  return {
    getProviderDescriptors: () => descriptors,
    execute: vi.fn(async (_input: any): Promise<any> => ({
      success: true,
      data: {
        id: "request-123",
        message: { role: "assistant", content: "[fake] completed — write to ops@corp.example" },
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
      const common = { requestId: "request-123", selectedModel: "local-fake-model", executionMode: "fake" };
      yield { ...common, type: "start" };
      yield { ...common, type: "chunk", textDelta: "reach me at hero@corp.example ok" };
      yield { ...common, type: "done" };
    },
  };
}

function createContext({ body }: { body: any }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]) as TestRequest;
  request.method = "POST";
  const response = new EventEmitter() as TestResponse;
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.text = "";
  response.writableEnded = false;
  response.headersSent = false;
  response.writeHead = (statusCode: number, headers: Record<string, unknown> = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
    response.headersSent = true;
  };
  response.flushHeaders = () => {};
  response.write = (chunk: unknown) => {
    response.text += String(chunk);
    return true;
  };
  response.end = (endBody?: unknown) => {
    if (endBody !== undefined) {
      response.text += String(endBody);
      response.body = JSON.parse(String(endBody));
    }
    response.writableEnded = true;
  };
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL("http://127.0.0.1/v1/chat/completions"),
    gatewayService: createGatewayService(),
    writeServiceLog: vi.fn(),
  };
}

beforeEach(() => {
  setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: true }));
});

afterEach(() => {
  setGuardrailsEngineForTests(null);
});

describe("chat completions guardrails wiring", () => {
  it("blocks a request containing a pasted provider secret before the provider call", async () => {
    const context = createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "please use AKIAIOSFODNN7EXAMPLE going forward" }],
      },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(400);
    expect(context.response.body.error.code).toBe("guardrail_blocked");
    expect(context.gatewayService.execute).not.toHaveBeenCalled();
    expect(context.writeServiceLog).toHaveBeenCalledWith(
      "openai_chat_guardrail_blocked",
      expect.objectContaining({ path: "/v1/chat/completions" }),
    );
  });

  it("redacts PII in the request and still calls the provider", async () => {
    const context = createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "email jane@corp.example about the plan" }],
      },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(200);
    expect(context.gatewayService.execute).toHaveBeenCalledTimes(1);
    const passedInput = context.gatewayService.execute.mock.calls[0]![0];
    expect(JSON.stringify(passedInput)).not.toContain("jane@corp.example");
    expect(JSON.stringify(passedInput)).toContain("[redacted-email]");
    expect(context.writeServiceLog).toHaveBeenCalledWith(
      "openai_chat_guardrail_findings",
      expect.anything(),
    );
  });

  it("redacts PII in the JSON response payload", async () => {
    const context = createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "who owns this service" }],
      },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(200);
    expect(context.response.body.choices[0].message.content).not.toContain("ops@corp.example");
    expect(context.response.body.choices[0].message.content).toContain("[redacted-email]");
  });

  it("redacts PII inside streaming SSE deltas", async () => {
    const context = createContext({
      body: {
        model: "local-fake-model",
        stream: true,
        messages: [{ role: "user", content: "give me a contact" }],
      },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(200);
    expect(context.response.text).not.toContain("hero@corp.example");
    expect(context.response.text).toContain("[redacted-email]");
    expect(context.response.text).toContain("[DONE]");
  });

  it("passes requests through untouched when guardrails are disabled", async () => {
    setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: false }));
    const context = createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "email jane@corp.example and use AKIAIOSFODNN7EXAMPLE" }],
      },
    });
    await dispatchOpenAiCompatibilityRoutes(context);

    expect(context.response.statusCode).toBe(200);
    const passedInput = context.gatewayService.execute.mock.calls[0]![0];
    expect(JSON.stringify(passedInput)).toContain("jane@corp.example");
    expect(JSON.stringify(passedInput)).toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("blocks pasted secrets on the Anthropic-native /v1/messages path before the provider call", async () => {
    const request = Readable.from([Buffer.from(JSON.stringify({
      model: "local-fake-model",
      max_tokens: 64,
      messages: [{ role: "user", content: `here use ${["sk-ant-", "1234567890", "abcdef"].join("")}` }],
    }))]) as TestRequest;
    request.method = "POST";
    const response = createResponseRecorderForTest();
    const gatewayService = createGatewayService();
    const writeServiceLog = vi.fn();
    await dispatchOpenAiCompatibilityRoutes({
      request,
      response,
      startedAt: Date.now(),
      url: new URL("http://127.0.0.1/v1/messages"),
      gatewayService,
      writeServiceLog,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.type).toBe("error");
    expect(response.body.error.type).toBe("api_error");
    expect(gatewayService.execute).not.toHaveBeenCalled();
  });
});

const streamRoutes = [
  { path: "/v1/chat/completions", body: { model: "local-fake-model", stream: true, messages: [{ role: "user", content: "Continue" }] } },
  { path: "/v1/completions", body: { model: "local-fake-model", stream: true, prompt: "Continue" } },
  { path: "/v1/messages", body: { model: "local-fake-model", stream: true, max_tokens: 64, messages: [{ role: "user", content: "Continue" }] } },
  { path: "/v1/responses", body: { model: "local-fake-model", stream: true, input: "Continue" } },
  { path: "/v1beta/models/local-fake-model:streamGenerateContent", body: { contents: [{ role: "user", parts: [{ text: "Continue" }] }] } },
  { path: "/chat/stream", body: { model: "local-fake-model", messages: [{ role: "user", content: "Continue" }] } },
];

async function runGuardedStream(route: typeof streamRoutes[number], deltas: string[]) {
  const context = createContext({ body: route.body });
  context.url = new URL(`http://127.0.0.1${route.path}`);
  let iteratorClosed = false;
  context.gatewayService.executeStream = async function* () {
    const common = { requestId: "guardrail-fixture", selectedModel: "local-fake-model", executionMode: "fake" };
    let outputText = "";
    try {
      yield { ...common, type: "start", outputText };
      for (const textDelta of deltas) { outputText += textDelta; yield { ...common, type: "chunk", textDelta, outputText }; }
      yield { ...common, type: "done", outputText };
    } finally { iteratorClosed = true; }
  };
  if (route.path === "/v1/responses") await dispatchOpenAiResponsesRoutes(context);
  else if (route.path.startsWith("/v1beta/")) await dispatchGeminiCompatibilityRoutes(context);
  else if (route.path === "/chat/stream") {
    const { handlers } = createChatRoutes({ application: { config: { aiGatewayService: {
      providerSelection: { mode: "fixed", defaultProviderId: "local-fake-provider", defaultModelId: "local-fake-model" },
      providerModels: [],
    } } }, gatewayService: context.gatewayService });
    await handlers.get("POST /chat/stream")!(context.request, context.response, { startedAt: context.startedAt, body: route.body });
  } else await dispatchOpenAiCompatibilityRoutes(context);
  const text = context.response.text.split("\n").filter(line => line.startsWith("data: ") && line !== "data: [DONE]")
    .map(line => JSON.parse(line.slice(6))).map(value => {
      if (route.path === "/v1/responses") return value.type === "response.output_text.delta" ? value.delta : "";
      if (route.path === "/v1/messages") return value.delta?.text ?? "";
      if (route.path.startsWith("/v1beta/")) return value.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? "").join("") ?? "";
      if (route.path === "/chat/stream") return value.textDelta ?? "";
      return value.choices?.[0]?.delta?.content ?? value.choices?.[0]?.text ?? "";
    }).join("");
  expect(iteratorClosed).toBe(true);
  expect(context.response.writableEnded).toBe(true);
  return { context, text };
}

describe("streaming guardrail output contract", () => {
  it.each(streamRoutes)("blocks a complete forbidden output on $path", async route => {
    setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: true, bannedTerms: ["redwood-flag"] }));
    const { context, text } = await runGuardedStream(route, ["redwood-flag"]);
    expect(text).not.toContain("redwood-flag");
    expect(context.response.text).toContain(route.path === "/v1/messages"
      ? '"error":{"type":"api_error","message":"Response blocked by chat guardrails."}' : "guardrail_blocked");
  });

  it.each(streamRoutes)("blocks a forbidden term split across deltas on $path", async route => {
    setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: true, bannedTerms: ["redwood-flag"] }));
    const { context, text } = await runGuardedStream(route, ["redwood-", "flag"]);
    expect(text).not.toContain("redwood-flag");
    expect(context.response.text).toContain(route.path === "/v1/messages"
      ? '"error":{"type":"api_error","message":"Response blocked by chat guardrails."}' : "guardrail_blocked");
  });

  it.each(streamRoutes)("redacts a sensitive address split across deltas on $path", async route => {
    const { context, text } = await runGuardedStream(route, ["reach sample@", "corp.example now"]);
    expect(text).not.toContain("sample@corp.example");
    expect(context.response.text).not.toContain("sample@corp.example");
    expect(text).toContain("[redacted-email]");
    expect(text).toContain(" now");
  });
});

function createResponseRecorderForTest(): TestResponse {
  const recorder = new EventEmitter() as TestResponse;
  recorder.statusCode = null;
  recorder.headers = {};
  recorder.body = null;
  recorder.text = "";
  recorder.writableEnded = false;
  recorder.headersSent = false;
  recorder.writeHead = (statusCode: number, headers: Record<string, unknown> = {}) => {
    recorder.statusCode = statusCode;
    recorder.headers = headers;
    recorder.headersSent = true;
  };
  recorder.flushHeaders = () => {};
  recorder.write = (chunk: unknown) => {
    recorder.text += String(chunk);
    return true;
  };
  recorder.end = (endBody?: unknown) => {
    if (endBody !== undefined) {
      recorder.text += String(endBody);
      recorder.body = JSON.parse(String(endBody));
    }
    recorder.writableEnded = true;
  };
  return recorder;
}
