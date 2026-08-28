import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { dispatchOpenAiCompatibilityRoutes } from "./openAiCompatibilityRoutes.js";

const descriptors = [
  {
    id: "local-fake-provider",
    metadata: { providerType: "fake" },
    models: [{ id: "local-fake-model", enabled: true, capabilities: ["chat"] }],
  },
];

describe("OpenAI compatibility n>1 multiple choices", () => {
  it("executes n times and returns indexed choices with summed completion usage", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/chat/completions",
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "give me options" }],
        n: 3,
      },
      gatewayService,
      response,
    }));

    expect(gatewayService.execute).toHaveBeenCalledTimes(3);
    expect(response.statusCode).toBe(200);
    expect(response.body.choices).toHaveLength(3);
    expect(response.body.choices.map((choice) => choice.index)).toEqual([0, 1, 2]);
    // prompt 计一次（8），completion 按 3 次（4×3）求和。
    expect(response.body.usage).toEqual({
      prompt_tokens: 8,
      completion_tokens: 12,
      total_tokens: 20,
    });
  });

  it("rejects out-of-range n values with 400", async () => {
    for (const n of [0, -1, 9, 1.5, "three"]) {
      const response = createResponseRecorder();
      await dispatchOpenAiCompatibilityRoutes(createContext({
        path: "/v1/chat/completions",
        body: {
          model: "local-fake-model",
          messages: [{ role: "user", content: "hi" }],
          n,
        },
        response,
      }));
      expect(response.statusCode).toBe(400);
      expect(response.body.error.type || response.body.error.code).toBeTruthy();
    }
  });

  it("streams n=2 as index-tagged sequential choice streams", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/chat/completions",
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "hi" }],
        n: 2,
        stream: true,
      },
      gatewayService,
      response,
    }));

    expect(gatewayService.executeStreamInvocations).toBe(2);
    const frames = parseSseFrames(response.text);
    const choiceIndexes = [
      ...new Set(
        frames
          .filter((frame) => frame.choices?.length > 0)
          .map((frame) => frame.choices[0].index),
      ),
    ];
    expect(choiceIndexes).toEqual([0, 1]);
    expect(response.text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("supports n>1 on legacy /v1/completions", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/completions",
      body: { model: "local-fake-model", prompt: "once upon", n: 2 },
      gatewayService,
      response,
    }));

    expect(gatewayService.execute).toHaveBeenCalledTimes(2);
    expect(response.statusCode).toBe(200);
    expect(response.body.choices).toHaveLength(2);
    expect(response.body.choices.map((choice) => choice.index)).toEqual([0, 1]);
    expect(response.body.usage.total_tokens).toBe(8 + 4 * 2);
  });

  it("emits a usage chunk for legacy completions when stream_options.include_usage is set", async () => {
    const response = createResponseRecorder();
    const gatewayService = createGatewayService();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      path: "/v1/completions",
      body: {
        model: "local-fake-model",
        prompt: "once upon",
        stream: true,
        stream_options: { include_usage: true },
      },
      gatewayService,
      response,
    }));

    const frames = parseSseFrames(response.text);
    const usageFrame = frames.find((frame) => frame.usage && frame.choices?.length === 0);
    expect(usageFrame).toBeTruthy();
    expect(usageFrame.usage.prompt_tokens).toBe(7);
    expect(usageFrame.usage.completion_tokens).toBe(5);
    expect(usageFrame.unified_ai.usage_estimated).toBe(false);
    expect(response.text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });
});

// ── helpers ──

function createContext({ body, gatewayService = createGatewayService(), response, path }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  request.method = "POST";
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

function createGatewayService() {
  let executeCount = 0;
  const service = {
    getProviderDescriptors: vi.fn(() => descriptors),
    execute: vi.fn(async () => {
      executeCount += 1;
      return {
        success: true,
        data: {
          id: `request-${100 + executeCount}`,
          message: {
            role: "assistant",
            content: `[fake:local-fake-provider/local-fake-model] choice ${executeCount}`,
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
    executeStreamInvocations: 0,
    async *executeStream() {
      service.executeStreamInvocations += 1;
      const common = {
        requestId: `request-stream-${service.executeStreamInvocations}`,
        selectedProvider: "local-fake-provider",
        selectedModel: "local-fake-model",
      };
      yield { ...common, type: "start", executionStatus: "streaming" };
      yield { ...common, type: "chunk", textDelta: "Hello", executionStatus: "streaming" };
      yield {
        ...common,
        type: "done",
        executionStatus: "success",
        rawProviderMeta: {
          finishReason: "stop",
          usage: { inputTokens: 7, outputTokens: 5, totalTokens: 12 },
        },
      };
    },
  };
  return service;
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

function parseSseFrames(text) {
  return text
    .split("\n\n")
    .filter((frame) => frame.trim().length > 0 && frame.trim() !== "data: [DONE]")
    .map((frame) => {
      const dataLine = frame.split(/\r?\n/).find((line) => line.startsWith("data:"));
      return JSON.parse(String(dataLine).slice(5).trimStart());
    });
}
