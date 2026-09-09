import { mkdtempSync, rmSync, mkdirSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { GatewayService } from "../core/gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createEnterpriseGovernanceService } from "../enterprise/enterpriseGovernanceService.js";
import { createGatewayHttpServer } from "./httpServer.js";
import { createChatResponseCacheIntegration, setChatResponseCacheIntegrationForTests } from "../cache/chatResponseCacheIntegration.ts";
import { createResponseCacheStore } from "../cache/responseCacheStore.js";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import { createGatewayModelProposer } from "../agent-governance/gatewayModelProposer.ts";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); setChatResponseCacheIntegrationForTests(null); });
function result(text = "fixed fixture", totalTokens = 12) {
  return { text, message: { role: "assistant", content: text }, usage: { inputTokens: 5, outputTokens: 7, totalTokens },
    raw: {}, latencyMs: 0, executionStatus: "success", warnings: [] };
}

async function fixture(cache = false, compact = false, agent = false) {
  const directory = mkdtempSync(join(tmpdir(), "gateway-key-http-"));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const managementToken = randomBytes(24).toString("base64url");
  const env = { PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: managementToken,
    PME_API_KEY_STORE_PATH: join(directory, "keys.json"), PME_ENTERPRISE_USER_STORE_PATH: join(directory, "users.json"),
    PME_AUDIT_LOG_PATH: join(directory, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(directory, "audit-chain.jsonl"),
    AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_CORS_ALLOWED_ORIGINS: "https://meter.example", AI_GATEWAY_WS_SHUTDOWN_GRACE_MS: "5",
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1" };
  const governance = createEnterpriseGovernanceService({ env });
  const manager = governance.getApiKeyManager();
  const charges = vi.spyOn(manager, "recordUsage");
  const admissions = vi.spyOn(manager, "authorizeUsage");
  const provider = createFakeProvider({ providerId: "meter-fixture", modelId: "meter-model", providerType: "fake",
    enabled: true, capabilities: ["chat"] });
  const generate = vi.spyOn(provider, "generate").mockImplementation(async () => result());
  const generateImage = vi.fn(async () => ({ success: true, data: { images: [], usage: { images: 1 } } }));
  const generateStream = vi.spyOn(provider, "generateStream").mockImplementation(async function* () {
    yield { textDelta: "fixed fixture", raw: { fake: true } };
    yield { textDelta: "", usageOnly: true, raw: { fake: true, usage: result().usage } };
  });
  const registry = new ProviderRegistry(); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry,
    runtimeConfig: { providerMode: "fake", realProviderEnabled: false, fallbackEnabled: false,
      ...(compact ? { chatContextCompaction: { thresholdMessages: 2, keepRecentTurns: 1, maxContextTokens: 120 } } : {}) } });
  const agentGovernance = agent ? { dataDir: join(directory, "agent-governance"), service: createAgentGovernanceService({ dataDir: join(directory, "agent-governance"),
    env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: randomBytes(32).toString("hex"), PME_ENTERPRISE_PLATFORM_TENANT_ID: "default" },
    modelProposer: createGatewayModelProposer({ gatewayService: gateway as any, providerId: "meter-fixture", modelId: "meter-model" }),
  }) } : undefined;
  const store = createResponseCacheStore({ paths: { records: join(directory, "cache-records.jsonl"), index: join(directory, "cache-index.json"),
    summary: join(directory, "cache-summary.json"), audit: join(directory, "cache-audit.jsonl") }, auditFlushIntervalMs: 0 });
  cleanups.push(async () => { await store.close(); });
  setChatResponseCacheIntegrationForTests(createChatResponseCacheIntegration({ env: { AI_GATEWAY_RESPONSE_CACHE_ENABLED: String(cache) }, store }));
  const server = createGatewayHttpServer({ runtimeEnv: env, config: { aiGatewayService: { providerMode: "fake", realProviderEnabled: false,
    providerSelection: { mode: "fixed", defaultProviderId: "meter-fixture", defaultModelId: "meter-model" },
    providerModels: [{ providerId: "meter-fixture", modelId: "meter-model" }] } },
    gatewayService: gateway, providerRegistry: registry, enterpriseGovernanceService: governance, agentGovernance,
    multimodalAdapter: { generateImage },
    knowledgeService: { getHealth: () => ({ status: "ready" }) }, knowledgeInfra: { getReadiness: () => ({ status: "ready" }) },
    workflowService: { getHealth: () => ({ status: "ready" }) }, workforceService: { getHealth: () => ({ status: "ready" }) },
    requestLogger: { getStats: () => ({}) }, healthScorer: { getAllScores: () => ({}) },
    userExperienceService: { getDashboard: () => ({}) } }) as ReturnType<typeof createGatewayHttpServer> & {
      closeRealtimeConnections?: () => void; shutdownResources?: () => Promise<void>;
    };
  cleanups.push(async () => {
    server.closeRealtimeConnections?.();
    await new Promise<void>((resolve, reject) => { server.close((error?: Error) => error ? reject(error) : resolve()); server.closeAllConnections?.(); });
    await server.shutdownResources?.();
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing fixture server address.");
  const url = `http://127.0.0.1:${address.port}`;
  async function post(path: string, body: unknown, key = managementToken, headers: Record<string, string> = {}) {
    return fetch(url + path, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...headers },
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  }
  async function createKey(limit: number | null = 10_000, rpm = 50) {
    const response = await post("/enterprise/virtual-keys", { role: "operator", tenantId: "default", ...(limit === null ? {} : { budget: { limitTokens: limit, window: "daily" } }), rateLimit: { requestsPerMinute: rpm } });
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    return body.data as { key: string; record: { keyId: string; keyFingerprint: string } };
  }
  return { directory, server, url, post, createKey, manager, admissions, charges, generate, generateStream, generateImage, gateway, agentGovernance,
    usage: (id: string) => manager.describeUsage({ keyId: id })!.usage };
}

describe("actual authenticated HTTP and WebSocket virtual-key accounting", () => {
  it("denies unmetered operations for budgeted keys and enforces RPM-only keys with HTTP status", async () => {
    const f = await fixture(); const budgeted = await f.createKey(); const rpm = await f.createKey(null, 1);
    const body = { provider: "fake", model: "fixture-image", prompt: "synthetic fixture" };
    const denied = await f.post("/v1/images/generations", body, budgeted.key);
    expect(denied.status).toBe(400); expect(await denied.json()).toMatchObject({ error: { code: "VIRTUAL_KEY_METERING_UNSUPPORTED" } });
    expect(f.generateImage).not.toHaveBeenCalled(); expect(f.usage(budgeted.record.keyId).requestCount).toBe(0);
    const first = await f.post("/v1/images/generations", body, rpm.key); expect(first.status).toBe(200); await first.json();
    const limited = await f.post("/v1/images/generations", body, rpm.key);
    expect(limited.status).toBe(429); expect(await limited.json()).toMatchObject({ error: { code: "VIRTUAL_KEY_RATE_LIMITED" } });
    expect(f.generateImage).toHaveBeenCalledOnce(); expect(f.charges).not.toHaveBeenCalled();
    expect(f.usage(rpm.record.keyId)).toMatchObject({ requestCount: 1, rateRequestCount: 1 });
  }, 30_000);

  it("carries the authenticated accounting capability through Agent generation and the model proposer", async () => {
    const f = await fixture(false, false, true); const key = await f.createKey();
    f.generate.mockResolvedValueOnce(result(JSON.stringify({ classification: { family: "monitoring", domain: "operations", subclass: "watcher" },
      proposedTraits: ["read_only"], proposedRiskLevel: "low" })));
    const response = await f.post("/v1/agents/generate", { name: "metered-agent", task: "observe the fixture", requestedTools: ["file_read"], ttlSeconds: 3600 }, key.key);
    const payload = await response.json() as any;
    expect(response.status, `${payload.error?.code ?? ""} ${payload.error?.message ?? ""}`).toBe(200);
    const events = await f.agentGovernance!.service.readAudit(payload.data.agentId, "default", 50);
    expect(events.find(event => event.eventType === "AGENT_CLASSIFIED")?.metadata).toMatchObject({ proposalSource: "gateway_model", modelProposalFailed: false });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.charges).toHaveBeenCalledOnce(); expect(f.admissions).toHaveBeenCalledOnce();
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, tokensUsed: 12 });
  }, 30_000);

  it("charges each HTTP protocol once from the authenticated key, ignoring body fingerprints", async () => {
    const f = await fixture(); const key = await f.createKey(); const other = await f.createKey();
    const messages = [{ role: "user", content: "hello" }];
    const calls: Array<[string, unknown]> = [
      ["/chat", { messages, enterpriseIdentity: { apiKeyFingerprint: other.record.keyFingerprint } }],
      ["/v1/chat/completions", { model: "meter-model", messages }],
      ["/v1/responses", { model: "meter-model", input: "hello" }],
      ["/v1/messages", { model: "meter-model", max_tokens: 64, messages }],
      ["/v1beta/models/meter-model:generateContent", { contents: [{ role: "user", parts: [{ text: "hello" }] }] }],
    ];
    for (const [path, body] of calls) {
      const response = await f.post(path, body, key.key);
      const payload = await response.json() as any;
      expect(response.status, `${path}: ${payload.error?.code ?? ""} ${payload.error?.message ?? ""}`).toBe(200);
    }
    expect(f.generate).toHaveBeenCalledTimes(5);
    expect(f.admissions).toHaveBeenCalledTimes(5); expect(f.charges).toHaveBeenCalledTimes(5);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 5, tokensUsed: 60 });
    expect(f.usage(other.record.keyId).tokensUsed).toBe(0);
  }, 30_000);

  it("shares concurrent native replay and still replays after budget and RPM exhaustion", async () => {
    const f = await fixture(); const key = await f.createKey(12, 1);
    let release!: () => void;
    f.generate.mockImplementationOnce(async () => { await new Promise<void>(resolve => { release = resolve; }); return result(); });
    let received = 0; f.server.on("request", request => { if (request.url === "/chat") received += 1; });
    const body = { messages: [{ role: "user", content: "hello" }] };
    const headers = { "idempotency-key": "native-wire-replay" };
    const first = f.post("/chat", body, key.key, headers);
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
    const second = f.post("/chat", body, key.key, headers);
    await vi.waitFor(() => expect(received).toBe(2)); release();
    const responses = await Promise.all([first, second]);
    const contents = await Promise.all(responses.map(response => response.json()));
    expect(contents[0]).toEqual(contents[1]);
    const replay = await f.post("/chat", body, key.key, headers);
    expect(replay.status).toBe(200); expect(await replay.json()).toEqual(contents[0]);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: 12 });
    const denied = await f.post("/chat", body, key.key, { "idempotency-key": "distinct-wire-call" });
    expect(denied.status).toBe(429); await denied.json(); expect(f.generate).toHaveBeenCalledOnce();
  }, 30_000);

  it("replays JSON cache using the actual post-compaction estimate", async () => {
    const f = await fixture(true, true); const key = await f.createKey();
    const output = "completed output ".repeat(10);
    f.generate.mockImplementation(async () => ({ ...result(output), usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      raw: { usageObservation: { version: 1, source: "unknown", totalTokens: null, knownTokens: null, invalid: false, complete: true } } }));
    const body = { model: "meter-model", messages: [{ role: "user", content: "old input ".repeat(100) },
      { role: "assistant", content: "old answer ".repeat(100) }, { role: "user", content: "answer now" }] };
    for (let index = 0; index < 2; index += 1) { const response = await f.post("/v1/chat/completions", body, key.key); expect(response.status).toBe(200); await response.json(); }
    expect(f.generate).toHaveBeenCalledOnce();
    const sent = f.generate.mock.calls[0]![0]!.request;
    expect(sent.metadata.contextCompaction).toBeDefined();
    const expected = estimateTokens(sent).estimatedInputTokens + estimateTextTokens(output);
    expect(expected).not.toBe(estimateTokens(body).estimatedInputTokens + estimateTextTokens(output));
    expect(f.charges.mock.calls.map(([input]) => input!.tokens)).toEqual([expected, expected]);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 2, tokensUsed: expected * 2 });
  }, 30_000);

  it("admits WebSocket chat messages separately while ping and frame fingerprints carry no budget authority", async () => {
    const f = await fixture(); const key = await f.createKey(1000, 1); const other = await f.createKey();
    const messages: any[] = [];
    const client = new WebSocket(f.url.replace("http:", "ws:") + "/ws", { headers: { authorization: `Bearer ${key.key}` }, origin: "https://meter.example", perMessageDeflate: false });
    client.on("message", bytes => messages.push(JSON.parse(bytes.toString())));
    cleanups.push(async () => { if (client.readyState !== WebSocket.CLOSED) { const closed = new Promise<void>(resolve => client.once("close", () => resolve())); client.terminate(); await closed; } });
    await new Promise<void>((resolve, reject) => { client.once("open", resolve); client.once("error", reject); });
    client.send(JSON.stringify({ type: "ping" }));
    await vi.waitFor(() => expect(messages.some(value => value.type === "pong")).toBe(true));
    expect(f.usage(key.record.keyId).requestCount).toBe(0);
    const chat = { type: "chat", prompt: "hello", enterpriseIdentity: { apiKeyFingerprint: other.record.keyFingerprint } };
    client.send(JSON.stringify(chat));
    await vi.waitFor(() => expect(messages.filter(value => value.type === "chat_response")).toHaveLength(1));
    expect(messages.find(value => value.type === "chat_response").data.success).toBe(true);
    client.send(JSON.stringify(chat));
    await vi.waitFor(() => expect(messages.filter(value => value.type === "chat_response")).toHaveLength(2));
    expect(messages.filter(value => value.type === "chat_response")[1].data).toMatchObject({ success: false, error: { code: "VIRTUAL_KEY_RATE_LIMITED" } });
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, tokensUsed: 12 });
    expect(f.usage(other.record.keyId).tokensUsed).toBe(0);
  }, 30_000);

  it.each([false, true])("replays SSE cache with the same complete estimate regardless of wire usage (%s)", async includeUsage => {
    const f = await fixture(true, true); const key = await f.createKey();
    const output = "streamed completion ".repeat(40);
    f.generateStream.mockImplementation(async function* () {
      yield { textDelta: output, raw: { fake: true } };
      yield { textDelta: "", usageOnly: true, raw: { fake: true, usageObservation: {
        version: 1, source: "unknown", totalTokens: null, knownTokens: null, invalid: false, complete: true,
      } } };
    });
    const body = { model: "meter-model", stream: true, stream_options: { include_usage: includeUsage },
      messages: [{ role: "user", content: "old input ".repeat(100) }, { role: "assistant", content: "old answer ".repeat(100) },
        { role: "user", content: "answer now" }] };
    for (let index = 0; index < 2; index += 1) {
      const response = await f.post("/v1/chat/completions", body, key.key); expect(response.status).toBe(200);
      const text = await response.text(); expect(text).toContain("[DONE]");
      expect(text.includes('"usage":')).toBe(includeUsage);
    }
    expect(f.generateStream).toHaveBeenCalledOnce();
    const sent = f.generateStream.mock.calls[0]![0]!.request;
    expect(sent.metadata.contextCompaction).toBeDefined();
    const expected = estimateTokens(sent).estimatedInputTokens + estimateTextTokens(output);
    expect(f.charges.mock.calls.map(([input]) => input!.tokens)).toEqual([expected, expected]);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 2, tokensUsed: expected * 2 });
  }, 30_000);

  it("settles a known partial stream once after the HTTP consumer disconnects", async () => {
    const f = await fixture(); const key = await f.createKey(); const closed = vi.fn(); const waiting = vi.fn();
    f.generateStream.mockImplementation(async function* (request: any) {
      const signal = request.execution?.signal;
      if (!signal) throw new Error("Fixture expected actual provider cancellation signal.");
      try {
        yield { textDelta: "partial fixture", raw: { fake: true, usageObservation: {
          version: 1, source: "reported", totalTokens: 9, knownTokens: 9, invalid: false, complete: false,
        } } };
        waiting();
        await new Promise<void>(resolve => { if (signal.aborted) resolve(); else signal.addEventListener("abort", () => resolve(), { once: true }); });
        signal.throwIfAborted();
      } finally { closed(); }
    });
    const response = await f.post("/v1/chat/completions", { model: "meter-model", stream: true, messages: [{ role: "user", content: "hello" }] }, key.key);
    expect(response.status).toBe(200);
    const reader = response.body!.getReader(); await reader.read();
    await vi.waitFor(() => expect(waiting).toHaveBeenCalledOnce());
    await reader.cancel();
    await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(f.charges).toHaveBeenCalledOnce());
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, tokensUsed: 9 });
  }, 30_000);

  it("retains a post-call failed counter write without replaying work, then repairs before new work", async () => {
    const f = await fixture(true); const key = await f.createKey();
    const keyPath = join(f.directory, "keys.json");
    f.generate.mockImplementationOnce(async () => {
      rmSync(keyPath); mkdirSync(keyPath); return result();
    });
    const body = { model: "meter-model", messages: [{ role: "user", content: "hello" }] };
    const first = await f.post("/v1/chat/completions", body, key.key);
    expect(first.status).toBe(200); await first.json();
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, tokensUsed: 12 });
    const blocked = await f.post("/v1/chat/completions", body, key.key);
    expect(blocked.status).toBe(503); expect(await blocked.json()).toMatchObject({ error: { code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" } });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.charges).toHaveBeenCalledOnce();
    rmdirSync(keyPath);
    const recovered = await f.post("/v1/chat/completions", body, key.key);
    expect(recovered.status).toBe(200); await recovered.json();
    expect(f.generate).toHaveBeenCalledTimes(2); // Failed settlement must not create an exact-billing cache record.
    expect(f.charges).toHaveBeenCalledTimes(2);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 2, tokensUsed: 24 });
  }, 30_000);
});
