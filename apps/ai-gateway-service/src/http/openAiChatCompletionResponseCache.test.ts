import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  createChatResponseCacheIntegration,
  setChatResponseCacheIntegrationForTests,
} from "../cache/chatResponseCacheIntegration.ts";
import { createResponseCacheStore } from "../cache/responseCacheStore.js";
import { dispatchOpenAiCompatibilityRoutes } from "./openAiCompatibilityRoutes.js";

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

const FIXED_STARTED_AT = new Date("2026-08-15T12:00:00.000Z").getTime();
const TENANT_A = { tenantId: "tenant-a" };
const TENANT_B = { tenantId: "tenant-b" };

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
  getProviderDescriptors(): typeof descriptors;
  execute: Mock<(input: any) => Promise<any>>;
  executeStream: Mock<(input: any) => AsyncGenerator<any>>;
}

function createTestIntegration() {
  const dir = mkdtempSync(join(tmpdir(), "chat-response-cache-test-"));
  const store = createResponseCacheStore({
    paths: {
      records: join(dir, "records.jsonl"),
      index: join(dir, "index.json"),
      summary: join(dir, "summary.json"),
      audit: join(dir, "audit.jsonl"),
    },
    auditFlushIntervalMs: 0,
  });
  const integration = createChatResponseCacheIntegration({
    env: { AI_GATEWAY_RESPONSE_CACHE_ENABLED: "true" },
    store,
  });
  return { integration, store, dir };
}

function createDisabledIntegration() {
  return createChatResponseCacheIntegration({ env: {} });
}

function createGatewayService(): TestGatewayService {
  const execute = vi.fn(async (_input: any): Promise<any> => ({
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
  }));
  const executeStream = vi.fn(async function* (_input: any): AsyncGenerator<any> {
    const common = {
      requestId: "request-123",
      selectedProvider: "local-fake-provider",
      selectedModel: "local-fake-model",
      executionMode: "fake",
    };
    yield { ...common, type: "start", executionStatus: "streaming" };
    yield { ...common, type: "chunk", textDelta: "Hello", executionStatus: "streaming" };
    yield { ...common, type: "done", executionStatus: "success" };
  });
  return {
    getProviderDescriptors: () => descriptors,
    execute,
    executeStream,
  };
}

function createJsonRequest(body: any, method: string, enterpriseIdentity?: unknown): TestRequest {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const request = Readable.from(chunks) as TestRequest;
  request.method = method;
  if (enterpriseIdentity) {
    request.enterpriseIdentity = enterpriseIdentity;
  }
  return request;
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

function createContext({
  body,
  enterpriseIdentity = null,
  gatewayService = createGatewayService(),
  method = "POST",
  path = "/v1/chat/completions",
  response = createResponseRecorder(),
}: {
  body: any;
  enterpriseIdentity?: unknown;
  gatewayService?: TestGatewayService;
  method?: string;
  path?: string;
  response?: TestResponse;
}) {
  return {
    request: createJsonRequest(body, method, enterpriseIdentity),
    response,
    startedAt: FIXED_STARTED_AT,
    url: new URL(`http://127.0.0.1${path}`),
    gatewayService,
    writeServiceLog: vi.fn(),
  };
}

const chatBody = {
  model: "local-fake-model",
  messages: [{ role: "user", content: "Say hello" }],
};

describe("chat response cache key and eligibility", () => {
  it("returns null when the feature flag is not enabled", () => {
    const integration = createDisabledIntegration();
    expect(integration.describeCacheCandidate({}, { model: "m", messages: [] })).toBeNull();
  });

  it("builds a stable key that discriminates model, messages, options, and stream", () => {
    const { integration } = createTestIntegration();
    const base = { model: "local-fake-model", providerId: "local-fake-provider", messages: [{ role: "user", content: "hi" }] };
    const first = integration.describeCacheCandidate({}, base);
    const repeat = integration.describeCacheCandidate({}, JSON.parse(JSON.stringify(base)));
    expect(first).not.toBeNull();
    if (!first || !repeat) throw new Error("Expected cache candidates.");
    expect(repeat.cacheKey).toBe(first.cacheKey);

    expect(integration.describeCacheCandidate({}, { ...base, model: "other-model" })!.cacheKey).not.toBe(first.cacheKey);
    expect(integration.describeCacheCandidate({}, { ...base, messages: [{ role: "user", content: "bye" }] })!.cacheKey).not.toBe(first.cacheKey);
    expect(integration.describeCacheCandidate({}, { ...base, options: { temperature: 0.2 } })!.cacheKey).not.toBe(first.cacheKey);
    expect(integration.describeCacheCandidate({ stream: true }, base)!.cacheKey).not.toBe(first.cacheKey);
  });

  it("rejects tool-call requests and secret-like message text", () => {
    const { integration } = createTestIntegration();
    expect(integration.describeCacheCandidate({}, {
      model: "m",
      messages: [],
      tools: [{ type: "function", function: { name: "noop" } }],
    })).toBeNull();

    expect(integration.describeCacheCandidate({}, {
      model: "m",
      messages: [{ role: "user", content: "my key is api_key=abcdefgh12345678" }],
    })).toBeNull();
  });
});

describe("chat completions hot-path response cache", () => {
  const cleanup: string[] = [];

  afterEach(() => {
    setChatResponseCacheIntegrationForTests(null);
    for (const dir of cleanup.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function installIntegration() {
    const testIntegration = createTestIntegration();
    cleanup.push(testIntegration.dir);
    setChatResponseCacheIntegrationForTests(testIntegration.integration);
    return testIntegration;
  }

  it("serves a repeat non-streaming request from cache without calling the provider", async () => {
    installIntegration();
    const gatewayService = createGatewayService();

    const first = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: chatBody,
      enterpriseIdentity: TENANT_A,
      gatewayService,
      response: first,
    }));
    expect(first.statusCode).toBe(200);
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);

    const second = createResponseRecorder();
    const secondLog = vi.fn();
    await dispatchOpenAiCompatibilityRoutes({
      ...createContext({
        body: chatBody,
        enterpriseIdentity: TENANT_A,
        gatewayService,
        response: second,
      }),
      writeServiceLog: secondLog,
    });
    expect(second.statusCode).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
    expect(secondLog).toHaveBeenCalledWith("openai_chat_cache_hit", expect.objectContaining({
      path: "/v1/chat/completions",
    }));
  });

  it("replays a cached SSE stream without calling the provider", async () => {
    installIntegration();
    const gatewayService = createGatewayService();
    const streamBody = { ...chatBody, stream: true };

    const first = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: streamBody,
      enterpriseIdentity: TENANT_A,
      gatewayService,
      response: first,
    }));
    expect(first.writableEnded).toBe(true);
    expect(first.text).toContain("data: [DONE]");
    expect(gatewayService.executeStream).toHaveBeenCalledTimes(1);

    const second = createResponseRecorder();
    const secondLog = vi.fn();
    await dispatchOpenAiCompatibilityRoutes({
      ...createContext({
        body: streamBody,
        enterpriseIdentity: TENANT_A,
        gatewayService,
        response: second,
      }),
      writeServiceLog: secondLog,
    });
    expect(second.writableEnded).toBe(true);
    expect(second.text).toBe(first.text);
    expect(gatewayService.executeStream).toHaveBeenCalledTimes(1);
    expect(secondLog).toHaveBeenCalledWith("openai_chat_stream_cache_hit", expect.objectContaining({
      path: "/v1/chat/completions",
    }));
  });

  it("isolates cache lanes per tenant", async () => {
    installIntegration();
    const gatewayService = createGatewayService();

    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, enterpriseIdentity: TENANT_A, gatewayService }));
    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, enterpriseIdentity: TENANT_A, gatewayService }));
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);

    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, enterpriseIdentity: TENANT_B, gatewayService }));
    expect(gatewayService.execute).toHaveBeenCalledTimes(2);

    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, enterpriseIdentity: TENANT_B, gatewayService }));
    expect(gatewayService.execute).toHaveBeenCalledTimes(2);
  });

  it("skips the cache entirely when no tenant identity is present", async () => {
    installIntegration();
    const gatewayService = createGatewayService();

    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, gatewayService }));
    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, gatewayService }));
    expect(gatewayService.execute).toHaveBeenCalledTimes(2);
  });

  it("fails open when the cache store errors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chat-response-cache-broken-"));
    cleanup.push(dir);
    const brokenStore = {
      lookupCache: () => {
        throw new Error("store down");
      },
      writeCacheRecord: () => {
        throw new Error("store down");
      },
    };
    setChatResponseCacheIntegrationForTests(createChatResponseCacheIntegration({
      env: { AI_GATEWAY_RESPONSE_CACHE_ENABLED: "true" },
      store: brokenStore,
    }));

    const gatewayService = createGatewayService();
    const response = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: chatBody,
      enterpriseIdentity: TENANT_A,
      gatewayService,
      response,
    }));
    expect(response.statusCode).toBe(200);
    expect(response.body.choices[0].message.content).toContain("completed");
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
  });

  it("does not change behavior when the feature flag is off", async () => {
    setChatResponseCacheIntegrationForTests(createDisabledIntegration());
    const gatewayService = createGatewayService();

    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, enterpriseIdentity: TENANT_A, gatewayService }));
    await dispatchOpenAiCompatibilityRoutes(createContext({ body: chatBody, enterpriseIdentity: TENANT_A, gatewayService }));
    expect(gatewayService.execute).toHaveBeenCalledTimes(2);
  });

  it("serves paraphrased requests from the semantic layer when enabled", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chat-response-cache-semantic-"));
    cleanup.push(dir);
    const store = createResponseCacheStore({
      paths: {
        records: join(dir, "records.jsonl"),
        index: join(dir, "index.json"),
        summary: join(dir, "summary.json"),
        audit: join(dir, "audit.jsonl"),
      },
      auditFlushIntervalMs: 0,
    });
    setChatResponseCacheIntegrationForTests(createChatResponseCacheIntegration({
      env: {
        AI_GATEWAY_RESPONSE_CACHE_ENABLED: "true",
        AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_ENABLED: "true",
        AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_THRESHOLD: "0.2",
      },
      store,
    }));
    const gatewayService = createGatewayService();

    const first = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: chatBody,
      enterpriseIdentity: TENANT_A,
      gatewayService,
      response: first,
    }));
    expect(first.statusCode).toBe(200);

    // 换措辞（同词重排+语气词）：精确 key 不同，语义近邻应命中。
    const paraphraseBody = {
      model: "local-fake-model",
      messages: [{ role: "user", content: "Say hello please, say hello" }],
    };
    const paraphrase = createResponseRecorder();
    const paraphraseLog = vi.fn();
    await dispatchOpenAiCompatibilityRoutes({
      ...createContext({
        body: paraphraseBody,
        enterpriseIdentity: TENANT_A,
        gatewayService,
        response: paraphrase,
      }),
      writeServiceLog: paraphraseLog,
    });
    expect(paraphrase.statusCode).toBe(200);
    expect(gatewayService.execute).toHaveBeenCalledTimes(1);
    expect(paraphraseLog).toHaveBeenCalledWith("openai_chat_cache_hit", expect.objectContaining({
      hitType: "semantic",
    }));

    // 语义索引按租户隔离：另一租户同款请求不应命中。
    const otherGateway = createGatewayService();
    const otherTenant = createResponseRecorder();
    await dispatchOpenAiCompatibilityRoutes(createContext({
      body: paraphraseBody,
      enterpriseIdentity: TENANT_B,
      gatewayService: otherGateway,
      response: otherTenant,
    }));
    expect(otherGateway.execute).toHaveBeenCalledTimes(1);
  });
});
