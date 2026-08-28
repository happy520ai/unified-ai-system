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

function createKnowledgeService(chunks) {
  return {
    retrieve: vi.fn(async () => ({ chunks })),
  };
}

function createContext({ body, response, gatewayService, knowledgeService }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body ?? {}))]);
  request.method = "POST";
  return {
    request,
    response,
    startedAt: Date.now(),
    url: new URL("http://127.0.0.1/v1/chat/completions"),
    gatewayService,
    knowledgeService,
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
        message: { role: "assistant", content: "ok" },
        selectedModel: "local-fake-model",
        finishReason: "stop",
        usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
      },
      meta: { requestId: "r1" },
    })),
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

describe("unified_ai.rag opt-in injection", () => {
  it("injects tenant-scoped knowledge context as a system message", async () => {
    const knowledgeService = createKnowledgeService([
      { sourceId: "handbook", sourceTitle: "运维手册", text: "网关默认运行在 fake provider 模式。" },
    ]);
    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: {
        model: "local-fake-model",
        messages: [{ role: "user", content: "网关默认怎么运行？" }],
        unified_ai: { rag: { enabled: true, topK: 3 } },
      },
      gatewayService,
      knowledgeService,
      response,
    }));

    expect(knowledgeService.retrieve).toHaveBeenCalledTimes(1);
    const retrieveArgs = knowledgeService.retrieve.mock.calls[0];
    expect(retrieveArgs[0].query).toBe("网关默认怎么运行？");
    expect(retrieveArgs[0].topK).toBe(3);

    const gatewayInput = gatewayService.execute.mock.calls[0][0];
    expect(gatewayInput.messages[0].role).toBe("system");
    expect(gatewayInput.messages[0].content).toContain("运维手册");
    expect(gatewayInput.messages[0].content).toContain("网关默认运行在 fake provider 模式。");
    expect(gatewayInput.metadata.ragInjection).toMatchObject({ applied: true, chunkCount: 1 });
    expect(response.statusCode).toBe(200);
  });

  it("passes the enterprise tenant identity into retrieval", async () => {
    const knowledgeService = createKnowledgeService([]);
    const response = createResponseRecorder();
    const request = Readable.from([Buffer.from(JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "anything" }],
      unified_ai: { rag: true },
    }))]);
    request.method = "POST";
    request.enterpriseIdentity = { tenantId: "tenant-7" };
    await dispatchOpenAiCompatibilityRoutes({
      request,
      response,
      startedAt: Date.now(),
      url: new URL("http://127.0.0.1/v1/chat/completions"),
      gatewayService: createGatewayService(),
      knowledgeService,
      enterpriseGovernanceService: null,
      writeServiceLog: vi.fn(),
    });
    expect(knowledgeService.retrieve.mock.calls[0][1]).toMatchObject({
      tenantScopeIdentity: { tenantId: "tenant-7" },
    });
  });

  it("skips RAG and answers normally when there are no matches or no service", async () => {
    for (const knowledgeService of [createKnowledgeService([]), null]) {
      const gatewayService = createGatewayService();
      const response = createResponseRecorder();
      await dispatchOpenAiCompatibilityRoutes(createContext({
        body: {
          model: "local-fake-model",
          messages: [{ role: "user", content: "hi" }],
          unified_ai: { rag: true },
        },
        gatewayService,
        knowledgeService,
        response,
      }));
      const gatewayInput = gatewayService.execute.mock.calls[0][0];
      expect(gatewayInput.messages[0].role).not.toBe("system");
      expect(response.statusCode).toBe(200);
    }
  });

  it("does not retrieve when rag is absent (default off)", async () => {
    const knowledgeService = createKnowledgeService([{ sourceId: "s", text: "x" }]);
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: { model: "local-fake-model", messages: [{ role: "user", content: "hi" }] },
      gatewayService: createGatewayService(),
      knowledgeService,
      response,
    }));
    expect(knowledgeService.retrieve).not.toHaveBeenCalled();
  });

  it("rejects invalid rag options with 400", async () => {
    for (const rag of [{ topK: 0 }, { topK: 99 }, { sourceIds: [42] }, "yes"]) {
      const response = createResponseRecorder();
      await dispatchOpenAiCompatibilityRoutes(createContext({
        body: {
          model: "local-fake-model",
          messages: [{ role: "user", content: "hi" }],
          unified_ai: { rag },
        },
        response,
      }));
      expect(response.statusCode).toBe(400);
    }
  });
});
