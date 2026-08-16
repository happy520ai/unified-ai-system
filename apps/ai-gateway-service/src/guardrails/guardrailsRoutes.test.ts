import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchOpenAiCompatibilityRoutes } from "../http/openAiCompatibilityRoutes.js";
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

function createGatewayService() {
  return {
    getProviderDescriptors: () => descriptors,
    execute: vi.fn(async () => ({
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

function createContext({ body }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.text = "";
  response.writableEnded = false;
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
  response.end = (endBody) => {
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
    const passedInput = context.gatewayService.execute.mock.calls[0][0];
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
    const passedInput = context.gatewayService.execute.mock.calls[0][0];
    expect(JSON.stringify(passedInput)).toContain("jane@corp.example");
    expect(JSON.stringify(passedInput)).toContain("AKIAIOSFODNN7EXAMPLE");
  });
});
