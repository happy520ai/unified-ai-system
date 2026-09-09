import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  createChatResponseCacheIntegration,
  setChatResponseCacheIntegrationForTests,
} from "../cache/chatResponseCacheIntegration.ts";
import { createResponseCacheStore } from "../cache/responseCacheStore.js";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";
import { createGuardrailsEngineForTests, getGuardrailsEngine, GUARDED_STREAM_LIMITS, GUARDRAILS_STORAGE_DIR_ENV, setGuardrailsEngineForTests } from "../guardrails/guardrailsEngine.ts";
import {
  dispatchOpenAiCompatibilityRoutes as dispatchOpenAiRoutes,
  streamOpenAiChatCompletion as streamOpenAiCompletion,
} from "./openAiCompatibilityRoutes.js";
import { bindVirtualKeyTestGateway } from "./virtualKeyGateway.testHelper.ts";

function dispatchOpenAiCompatibilityRoutes(context: any) {
  return dispatchOpenAiRoutes({ ...context, gatewayService: bindVirtualKeyTestGateway(context) });
}
function streamOpenAiChatCompletion(context: any) {
  return streamOpenAiCompletion({ ...context, gatewayService: bindVirtualKeyTestGateway(context) });
}

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

function createTestIntegration(env: Record<string, string> = {}) {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "chat-response-cache-test-"));
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
    env: { AI_GATEWAY_RESPONSE_CACHE_ENABLED: "true", ...env },
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

  beforeEach(() => {
    setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: false }));
  });

  afterEach(() => {
    setChatResponseCacheIntegrationForTests(null);
    setGuardrailsEngineForTests(null);
    vi.unstubAllEnvs();
    for (const dir of cleanup.splice(0)) {
      expect(realpathSync(dir)).toBe(dir);
      expect(dirname(dir)).toBe(realpathSync(tmpdir()));
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function installIntegration(env: Record<string, string> = {}) {
    const testIntegration = createTestIntegration(env);
    cleanup.push(testIntegration.dir);
    setChatResponseCacheIntegrationForTests(testIntegration.integration);
    return testIntegration;
  }

  it.each([false, true])("applies a tightened tenant output policy to an already populated cache (stream=%s)", async (stream) => {
    const fixture = installIntegration();
    vi.stubEnv(GUARDRAILS_STORAGE_DIR_ENV, join(fixture.dir, "guardrails"));
    setGuardrailsEngineForTests(null);
    const engine = getGuardrailsEngine(TENANT_A.tenantId);
    engine.applyOverrides({ enabled: true });
    const gatewayService = createGatewayService();
    const body = { model: "local-fake-model", stream, messages: [{ role: "user", content: "Give a greeting" }] };
    const run = async () => {
      const context = createContext({ body, enterpriseIdentity: TENANT_A, gatewayService });
      await dispatchOpenAiCompatibilityRoutes(context);
      return context;
    };
    const first = await run();
    const cached = await run();
    expect(first.response.statusCode).toBe(200);
    expect(cached.response.text).toBe(first.response.text);
    expect(stream ? gatewayService.executeStream : gatewayService.execute).toHaveBeenCalledTimes(1);
    expect(cached.writeServiceLog).toHaveBeenCalledWith(
      stream ? "openai_chat_stream_cache_hit" : "openai_chat_cache_hit", expect.anything());

    const blockedOutput = stream ? "Hello" : "completed";
    engine.applyOverrides({ bannedTerms: [blockedOutput] });
    const afterTightening = await run();
    expect(afterTightening.response.text).not.toContain(blockedOutput);
    expect(afterTightening.response.text).toContain("guardrail_blocked");
    expect(afterTightening.response.writableEnded).toBe(true);
  });

  it.each([false, true])("requires exact output policy identity even for a high-similarity cache result (stream=%s)", async stream => {
    const fixture = installIntegration({ AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_ENABLED: "true", AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_THRESHOLD: "0.2" });
    vi.stubEnv(GUARDRAILS_STORAGE_DIR_ENV, join(fixture.dir, "guardrails"));
    setGuardrailsEngineForTests(null);
    const engine = getGuardrailsEngine(TENANT_A.tenantId);
    engine.applyOverrides({ enabled: true });
    const gatewayService = createGatewayService();
    const run = async (text: string) => {
      const context = createContext({ body: { model: "local-fake-model", stream, messages: [{ role: "user", content: text }] },
        enterpriseIdentity: TENANT_A, gatewayService });
      await dispatchOpenAiCompatibilityRoutes(context);
      return context;
    };
    await run("Give a greeting");
    const semanticHit = await run("Give a greeting please");
    expect(semanticHit.writeServiceLog).toHaveBeenCalledWith(stream ? "openai_chat_stream_cache_hit" : "openai_chat_cache_hit",
      expect.objectContaining(stream ? {} : { hitType: "semantic" }));
    expect(stream ? gatewayService.executeStream : gatewayService.execute).toHaveBeenCalledOnce();
    const forbidden = stream ? "Hello" : "completed";
    engine.applyOverrides({ bannedTerms: [forbidden] });
    const denied = await run("Please give a greeting");
    expect(denied.response.text).toContain("guardrail_blocked");
    expect(denied.response.text).not.toContain(forbidden);
    expect(stream ? gatewayService.executeStream : gatewayService.execute).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("keeps generation and cache write on their captured output policy (stream=%s)", async stream => {
    installIntegration();
    const engine = createGuardrailsEngineForTests({ enabled: true });
    setGuardrailsEngineForTests(engine);
    const gatewayService = createGatewayService();
    const forbidden = stream ? "Hello" : "completed";
    const originalExecute = gatewayService.execute;
    gatewayService.execute = vi.fn(async input => { const result = await originalExecute(input); engine.applyOverrides({ bannedTerms: [forbidden] }); return result; });
    const originalStream = gatewayService.executeStream;
    gatewayService.executeStream = vi.fn(async function* (input) {
      for await (const event of originalStream(input)) {
        if (event.type === "chunk") engine.applyOverrides({ bannedTerms: [forbidden] });
        yield event;
      }
    });
    const run = async () => {
      const context = createContext({ body: { model: "local-fake-model", stream, messages: [{ role: "user", content: "Give a greeting" }] },
        enterpriseIdentity: TENANT_A, gatewayService });
      await dispatchOpenAiCompatibilityRoutes(context); return context;
    };
    expect((await run()).response.text).toContain(forbidden);
    const current = await run();
    expect(current.response.text).not.toContain(forbidden);
    expect(current.response.text).toContain("guardrail_blocked");
    expect(stream ? gatewayService.executeStream : gatewayService.execute).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])("counts and charges two distinct HTTP cache requests with one Provider execution (stream=%s)", async (stream) => {
    installIntegration();
    setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: true }));
    const manager = createApiKeyManager({ storePath: null, now: () => FIXED_STARTED_AT });
    const { key, record } = manager.create({ role: "operator", tenantId: "tenant-a",
      budget: { limitTokens: 1000, window: "daily" }, rateLimit: { requestsPerMinute: 10 } });
    const validated = manager.validate(key);
    if (!validated.valid || !validated.record) throw new Error("Synthetic key did not authenticate.");
    const identity = { tenantId: validated.record.tenantId, userId: `api-key:${record.keyFingerprint}`, apiKeyFingerprint: record.keyFingerprint };
    const admission = vi.spyOn(manager, "authorizeUsage"); const charge = vi.spyOn(manager, "recordUsage");
    const gatewayService = createGatewayService();
    gatewayService.executeStream = vi.fn(async function* () {
      yield { type: "start", requestId: "cache-budget", selectedProvider: "local-fake-provider", selectedModel: "local-fake-model", executionMode: "fake" };
      yield { type: "chunk", textDelta: "Hello" };
      yield { type: "done", rawProviderMeta: { usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 } } };
    });
    const body = { ...chatBody, ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}) };
    const contexts = [0, 1].map(() => ({ ...createContext({ body, enterpriseIdentity: identity, gatewayService }),
      enterpriseGovernanceService: { getApiKeyManager: () => manager } }));
    await dispatchOpenAiCompatibilityRoutes(contexts[0]); await dispatchOpenAiCompatibilityRoutes(contexts[1]);
    expect(contexts[0].response.statusCode).toBe(200); expect(contexts[1].response.statusCode).toBe(200);
    expect(stream ? gatewayService.executeStream : gatewayService.execute).toHaveBeenCalledOnce();
    expect(admission).toHaveBeenCalledTimes(2); expect(charge).toHaveBeenCalledTimes(2);
    expect(manager.describeUsage({ keyId: record.keyId })!.usage).toMatchObject({ requestCount: 2, rateRequestCount: 2, tokensUsed: 24 });
  });

  it("settles actual Core key usage and closes the Provider iterator when guarded output hits its bound", async () => {
    installIntegration();
    setGuardrailsEngineForTests(createGuardrailsEngineForTests({ enabled: true }));
    const manager = createApiKeyManager({ storePath: null, now: () => FIXED_STARTED_AT });
    const { key, record } = manager.create({ role: "operator", tenantId: "tenant-a",
      budget: { limitTokens: 1_000_000, window: "daily" }, rateLimit: { requestsPerMinute: 10 } });
    const validated = manager.validate(key);
    if (!validated.valid || !validated.record) throw new Error("Synthetic key did not authenticate.");
    const identity = { tenantId: validated.record.tenantId, userId: `api-key:${record.keyFingerprint}`, apiKeyFingerprint: record.keyFingerprint };
    const charge = vi.spyOn(manager, "recordUsage");
    const gatewayService = createGatewayService();
    let providerClosed = false;
    gatewayService.executeStream = vi.fn(async function* () {
      try { yield { type: "chunk", textDelta: "Q".repeat(GUARDED_STREAM_LIMITS.chars + 1) }; }
      finally { providerClosed = true; }
    });
    const context = { ...createContext({ body: { ...chatBody, stream: true }, enterpriseIdentity: identity, gatewayService }),
      enterpriseGovernanceService: { getApiKeyManager: () => manager } };
    await dispatchOpenAiCompatibilityRoutes(context);
    expect(context.response.text).toContain("guardrail_output_limit");
    expect(context.response.text).not.toContain("QQQQ");
    expect(providerClosed).toBe(true);
    expect(charge).toHaveBeenCalledOnce();
    expect(manager.describeUsage({ keyId: record.keyId })!.usage.requestCount).toBe(1);
    expect(manager.describeUsage({ keyId: record.keyId })!.usage.tokensUsed).toBeGreaterThan(0);
  });

  it.each([false, true])("rejects a second HTTP cache request at RPM=1 without another token charge (stream=%s)", async (stream) => {
    installIntegration();
    const manager = createApiKeyManager({ storePath: null, now: () => FIXED_STARTED_AT });
    const { key, record } = manager.create({ role: "operator", tenantId: "tenant-a",
      budget: { limitTokens: 1000, window: "daily" }, rateLimit: { requestsPerMinute: 1 } });
    const validated = manager.validate(key);
    if (!validated.valid || !validated.record) throw new Error("Synthetic key did not authenticate.");
    const identity = { tenantId: validated.record.tenantId, userId: `api-key:${record.keyFingerprint}`, apiKeyFingerprint: record.keyFingerprint };
    const charge = vi.spyOn(manager, "recordUsage"); const gatewayService = createGatewayService();
    gatewayService.executeStream = vi.fn(async function* () {
      yield { type: "start", requestId: "cache-rate", selectedProvider: "local-fake-provider", selectedModel: "local-fake-model", executionMode: "fake" };
      yield { type: "chunk", textDelta: "Hello" };
      yield { type: "done", rawProviderMeta: { usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 } } };
    });
    const body = { ...chatBody, ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}) };
    const contexts = [0, 1].map(() => ({ ...createContext({ body, enterpriseIdentity: identity, gatewayService }),
      enterpriseGovernanceService: { getApiKeyManager: () => manager } }));
    await dispatchOpenAiCompatibilityRoutes(contexts[0]); await dispatchOpenAiCompatibilityRoutes(contexts[1]);
    expect(contexts[0].response.statusCode).toBe(200); expect(contexts[1].response.statusCode).toBe(429);
    expect(contexts[1].response.body.error.code).toBe("VIRTUAL_KEY_RATE_LIMITED");
    expect(stream ? gatewayService.executeStream : gatewayService.execute).toHaveBeenCalledOnce();
    expect(charge).toHaveBeenCalledOnce();
    expect(manager.describeUsage({ keyId: record.keyId })!.usage).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: 12 });
  });

  it.each([false, true])("keeps the Core-shaped live billing total in SSE cache independently of wire usage (include_usage=%s)", async (includeUsage) => {
    installIntegration();
    const manager = createApiKeyManager({ storePath: null, now: () => FIXED_STARTED_AT });
    const { key, record } = manager.create({ role: "operator", tenantId: "tenant-a",
      budget: { limitTokens: 1000, window: "daily" }, rateLimit: { requestsPerMinute: 10 } });
    const authenticated = manager.validate(key);
    if (!authenticated.valid || !authenticated.record) throw new Error("Synthetic key did not authenticate.");
    const identity = { tenantId: authenticated.record.tenantId, userId: `api-key:${record.keyFingerprint}`, apiKeyFingerprint: record.keyFingerprint };
    const charge = vi.spyOn(manager, "recordUsage");
    const gatewayService = createGatewayService();
    gatewayService.executeStream = vi.fn(async function* () {
      const common = { requestId: "core-shaped-cache", selectedProvider: "local-fake-provider", selectedModel: "local-fake-model", executionMode: "fake" };
      yield { ...common, type: "start", executionStatus: "streaming" };
      yield { ...common, type: "chunk", textDelta: "Hello" };
      yield { ...common, type: "done", executionStatus: "success", outputText: "Hello",
        rawProviderMeta: { usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 } } };
    });
    const body = { ...chatBody, stream: true, stream_options: { include_usage: includeUsage } };
    const contexts = [0, 1].map(() => ({ ...createContext({ body, enterpriseIdentity: identity, gatewayService }),
      enterpriseGovernanceService: { getApiKeyManager: () => manager } }));
    await dispatchOpenAiCompatibilityRoutes(contexts[0]); await dispatchOpenAiCompatibilityRoutes(contexts[1]);
    expect(gatewayService.executeStream).toHaveBeenCalledOnce();
    for (const context of contexts) {
      expect(context.response.statusCode).toBe(200);
      expect(context.response.text.includes('"usage":')).toBe(includeUsage);
    }
    expect(charge.mock.calls.map(([input]) => input?.tokens)).toEqual([12, 12]);
    expect(manager.describeUsage({ keyId: record.keyId })!.usage).toMatchObject({ requestCount: 2, rateRequestCount: 2, tokensUsed: 24 });
  });

  it.each([undefined, { version: 1, source: "reported", totalTokens: -1 }, { version: 1, source: "reported", totalTokens: "1" },
    { version: 1, source: "unverified", totalTokens: 1 }])("treats a legacy or malformed SSE billing record as a key cache miss: %j", async billing => {
    const fixture = installIntegration(); const persist = fixture.integration.persist;
    const injection = vi.spyOn(fixture.integration, "persist").mockImplementation(params => {
      const payload: any = { ...params.payload }; delete payload.billing;
      if (billing !== undefined) payload.billing = billing;
      persist({ ...params, payload });
    });
    const manager = createApiKeyManager({ storePath: null, now: () => FIXED_STARTED_AT });
    const { record } = manager.create({ role: "operator", tenantId: "tenant-a", budget: { limitTokens: 1000, window: "daily" } });
    const identity = { ...TENANT_A, apiKeyFingerprint: record.keyFingerprint };
    const gatewayService = createGatewayService(); const charge = vi.spyOn(manager, "recordUsage");
    const body = { ...chatBody, stream: true };
    const run = () => dispatchOpenAiCompatibilityRoutes({ ...createContext({ body, gatewayService, enterpriseIdentity: identity }),
      enterpriseGovernanceService: { getApiKeyManager: () => manager } });
    await run(); injection.mockRestore(); await run();
    expect(gatewayService.executeStream).toHaveBeenCalledTimes(2); expect(charge).toHaveBeenCalledTimes(2);
  });

  it("retains SSE estimated billing across a real cache store reload", async () => {
    const fixture = installIntegration(); const gatewayService = createGatewayService();
    const manager = createApiKeyManager({ storePath: null, now: () => FIXED_STARTED_AT });
    const { record } = manager.create({ role: "operator", tenantId: "tenant-a", budget: { limitTokens: 1000, window: "daily" } });
    const identity = { ...TENANT_A, apiKeyFingerprint: record.keyFingerprint }; const charge = vi.spyOn(manager, "recordUsage");
    const writeServiceLog = vi.fn(); const body = { ...chatBody, stream: true };
    const run = () => dispatchOpenAiCompatibilityRoutes({ ...createContext({ body, gatewayService, enterpriseIdentity: identity }),
      writeServiceLog, enterpriseGovernanceService: { getApiKeyManager: () => manager } });
    await run();
    const store = createResponseCacheStore({ paths: { records: join(fixture.dir, "records.jsonl"), index: join(fixture.dir, "index.json"),
      summary: join(fixture.dir, "summary.json"), audit: join(fixture.dir, "audit.jsonl") }, auditFlushIntervalMs: 0 });
    setChatResponseCacheIntegrationForTests(createChatResponseCacheIntegration({ env: { AI_GATEWAY_RESPONSE_CACHE_ENABLED: "true" }, store }));
    await run(); expect(gatewayService.executeStream).toHaveBeenCalledOnce();
    const amounts = charge.mock.calls.map(([input]) => input!.tokens); expect(amounts[0]).toBeGreaterThan(0); expect(amounts[1]).toBe(amounts[0]);
    expect(writeServiceLog.mock.calls.filter(([event]) => event === "virtual_key_usage_recorded").map(([, data]) => data.calculationSource)).toEqual(["estimated", "estimated"]);
  });

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

  it("never reads or writes the SSE cache for a server-pinned managed client", async () => {
    installIntegration();
    const gatewayService = createGatewayService();
    const body = { ...chatBody, stream: true };
    const gatewayInput = {
      model: "local-fake-model",
      providerId: "local-fake-provider",
      messages: chatBody.messages,
      options: {},
      metadata: {
        openAiCompatibility: { choiceCount: 1 },
        managedLocalClientProviderRouting: {
          providerPinned: true,
          modelPinned: true,
          policyRevision: "policy-r1",
          clientRevision: 2,
          decisionDigest: "a".repeat(64),
        },
      },
    };
    for (let index = 0; index < 2; index += 1) {
      const response = createResponseRecorder();
      await streamOpenAiChatCompletion({
        body,
        gatewayInput,
        gatewayService,
        request: createJsonRequest(undefined, "POST", TENANT_A),
        response,
        startedAt: FIXED_STARTED_AT + index,
        writeServiceLog: vi.fn(),
        enterpriseGovernanceService: undefined,
      });
      expect(response.writableEnded).toBe(true);
      expect(response.text).toContain("data: [DONE]");
    }
    expect(gatewayService.executeStream).toHaveBeenCalledTimes(2);
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
