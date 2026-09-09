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
function a2aResult() { return { ...result(), raw: { fake: true } }; }
function a2aMessage(messageId: string, options: { taskId?: string; returnImmediately?: boolean } = {}) {
  return { message: { messageId, role: "ROLE_USER", parts: [{ text: "hello", mediaType: "text/plain" }],
    ...(options.taskId ? { taskId: options.taskId } : {}) },
  configuration: { returnImmediately: options.returnImmediately ?? false } };
}
function deferredProvider() {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  cleanups.push(async () => { release(); });
  return { pending, release };
}
async function a2aRpc(f: Awaited<ReturnType<typeof fixture>>, method: string, params: unknown, key: string) {
  const response = await f.post("/a2a/jsonrpc", { jsonrpc: "2.0", id: "meter-a2a", method, params }, key);
  const payload = await response.json() as any;
  expect(response.status, JSON.stringify(payload)).toBe(200);
  expect(payload.error).toBeUndefined();
  return payload.result;
}

async function fixture(cache = false, compact = false, agent = false, a2a = false) {
  const directory = mkdtempSync(join(tmpdir(), "gateway-key-http-"));
  cleanups.push(async () => { rmSync(directory, { recursive: true, force: true }); });
  const managementToken = randomBytes(24).toString("base64url");
  const env = { PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: managementToken,
    PME_API_KEY_STORE_PATH: join(directory, "keys.json"), PME_ENTERPRISE_USER_STORE_PATH: join(directory, "users.json"),
    PME_AUDIT_LOG_PATH: join(directory, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(directory, "audit-chain.jsonl"),
    AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_CORS_ALLOWED_ORIGINS: "https://meter.example", AI_GATEWAY_WS_SHUTDOWN_GRACE_MS: "5",
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    ...(a2a ? { AI_GATEWAY_A2A_TASK_STORE_MODE: "memory", AI_GATEWAY_A2A_TASK_STORE_REQUIRED: "false",
      AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED: "false", AI_GATEWAY_A2A_EXECUTION_LEASE_MODE: "disabled",
      AI_GATEWAY_A2A_EXECUTION_LEASE_REQUIRED: "false", AI_GATEWAY_A2A_AGENT_CARD_SIGNING_REQUIRED: "false",
      AI_GATEWAY_A2A_AGENT_CARD_SIGNING_KEY_FILE: "", AI_GATEWAY_A2A_AGENT_CARD_PREVIOUS_SIGNING_KEY_FILES_JSON: "[]",
      AI_GATEWAY_A2A_AGENT_CARD_JWKS_URL: "", A2A_PUBLIC_BASE_URL: "http://127.0.0.1" } : {}) };
  const governance = createEnterpriseGovernanceService({ env });
  const audits = vi.spyOn(governance, "recordAudit");
  const manager = governance.getApiKeyManager();
  const charges = vi.spyOn(manager, "recordUsage");
  const admissions = vi.spyOn(manager, "authorizeUsage");
  const providerId = a2a ? "local-fake-provider" : "meter-fixture";
  const modelId = a2a ? "local-fake-model" : "meter-model";
  const provider = createFakeProvider({ providerId, modelId, providerType: "fake",
    enabled: true, capabilities: ["chat"] });
  const generate = vi.spyOn(provider, "generate").mockImplementation(async () => a2a ? a2aResult() : result());
  const generateImage = vi.fn(async () => ({ success: true, data: { images: [], usage: { images: 1 } } }));
  const generateStream = vi.spyOn(provider, "generateStream").mockImplementation(async function* () {
    yield { textDelta: "fixed fixture", raw: { fake: true } };
    yield { textDelta: "", usageOnly: true, raw: { fake: true, usage: result().usage } };
  });
  const registry = new ProviderRegistry(); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry,
    runtimeConfig: { providerMode: "fake", realProviderEnabled: false, fallbackEnabled: false,
      ...(compact ? { chatContextCompaction: { thresholdMessages: 2, keepRecentTurns: 1, maxContextTokens: 120 } } : {}) } });
  const executions = vi.spyOn(gateway, "execute");
  const agentGovernance = agent ? { dataDir: join(directory, "agent-governance"), service: createAgentGovernanceService({ dataDir: join(directory, "agent-governance"),
    env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: randomBytes(32).toString("hex"), PME_ENTERPRISE_PLATFORM_TENANT_ID: "default" },
    modelProposer: createGatewayModelProposer({ gatewayService: gateway as any, providerId, modelId }),
  }) } : undefined;
  const store = createResponseCacheStore({ paths: { records: join(directory, "cache-records.jsonl"), index: join(directory, "cache-index.json"),
    summary: join(directory, "cache-summary.json"), audit: join(directory, "cache-audit.jsonl") }, auditFlushIntervalMs: 0 });
  cleanups.push(async () => { await store.close(); });
  setChatResponseCacheIntegrationForTests(createChatResponseCacheIntegration({ env: { AI_GATEWAY_RESPONSE_CACHE_ENABLED: String(cache) }, store }));
  const server = createGatewayHttpServer({ runtimeEnv: env, config: { aiGatewayService: { providerMode: "fake", realProviderEnabled: false,
    providerSelection: { mode: "fixed", defaultProviderId: providerId, defaultModelId: modelId },
    providerModels: [{ providerId, modelId }] } },
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
  return { directory, server, url, post, createKey, manager, admissions, charges, audits, generate, generateStream, generateImage, gateway, executions, agentGovernance,
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

describe("actual authenticated A2A HTTP virtual-key accounting", () => {
  it.each([
    { limit: 24, rpm: 50, exhausted: "budget" },
    { limit: 1000, rpm: 2, exhausted: "RPM" },
  ])("charges repeated message IDs as separate executions and keeps queries free after $exhausted exhaustion", async ({ limit, rpm }) => {
    const f = await fixture(false, false, false, true); const key = await f.createKey(limit, rpm); const other = await f.createKey();
    const params = { ...a2aMessage("same-a2a-message"), tenant: "forged-tenant",
      enterpriseIdentity: { apiKeyFingerprint: other.record.keyFingerprint, tenantId: "forged-tenant" },
      metadata: { enterpriseIdentity: { apiKeyFingerprint: other.record.keyFingerprint, tenantId: "forged-tenant" },
        unifiedAi: { apiKeyFingerprint: other.record.keyFingerprint, tenantId: "forged-tenant" } } };
    const first = await a2aRpc(f, "SendMessage", params, key.key);
    const second = await a2aRpc(f, "SendMessage", params, key.key);
    expect(first.task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(second.task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(second.task.id).not.toBe(first.task.id);
    expect(f.generate).toHaveBeenCalledTimes(2); expect(f.admissions).toHaveBeenCalledTimes(2); expect(f.charges).toHaveBeenCalledTimes(2);
    for (const [input] of f.generate.mock.calls) {
      expect(input!.request.enterpriseIdentity).toMatchObject({ tenantId: "default", apiKeyFingerprint: key.record.keyFingerprint });
    }
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 2, rateRequestCount: 2, tokensUsed: 24 });
    expect(f.usage(other.record.keyId)).toMatchObject({ requestCount: 0, tokensUsed: 0 });
    const loaded = await a2aRpc(f, "GetTask", { id: first.task.id }, key.key);
    expect(loaded).toMatchObject({ id: first.task.id, status: { state: "TASK_STATE_COMPLETED" } });
    const listed = await a2aRpc(f, "ListTasks", { pageSize: 10 }, key.key);
    expect(listed.tasks.map((task: any) => task.id)).toEqual(expect.arrayContaining([first.task.id, second.task.id]));
    expect(f.admissions).toHaveBeenCalledTimes(2); expect(f.charges).toHaveBeenCalledTimes(2);
    const denied = await a2aRpc(f, "SendMessage", a2aMessage("later-a2a-message"), key.key);
    expect(denied.task.status.state).toBe("TASK_STATE_FAILED");
    expect(f.generate).toHaveBeenCalledTimes(2); expect(f.charges).toHaveBeenCalledTimes(2);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 2, rateRequestCount: 2, tokensUsed: 24 });
  }, 30_000);

  it("keeps a nonblocking execution billable after its HTTP response has finished", async () => {
    const f = await fixture(false, false, false, true); const key = await f.createKey(); const gate = deferredProvider();
    let providerSignal: AbortSignal | undefined;
    f.generate.mockImplementationOnce(async (input: any) => {
      providerSignal = input.execution?.signal;
      await gate.pending;
      return a2aResult();
    });
    const accepted = await a2aRpc(f, "SendMessage", a2aMessage("nonblocking-a2a", { returnImmediately: true }), key.key);
    expect(accepted.task.status.state).toBe("TASK_STATE_SUBMITTED");
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
    expect(providerSignal).toBeInstanceOf(AbortSignal); expect(providerSignal!.aborted).toBe(false);
    expect(f.charges).not.toHaveBeenCalled();
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, tokensUsed: 0 });
    gate.release();
    await Promise.allSettled(f.executions.mock.results.map(call => call.value));
    await vi.waitFor(() => expect(f.charges).toHaveBeenCalledOnce());
    await vi.waitFor(async () => expect(await a2aRpc(f, "GetTask", { id: accepted.task.id }, key.key))
      .toMatchObject({ status: { state: "TASK_STATE_COMPLETED" } }));
    expect(f.admissions).toHaveBeenCalledOnce();
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: 12 });
  }, 30_000);

  it.each([false, true])("aborts the provider on explicit cancellation and settles once (late result=%s)", async lateResult => {
    const f = await fixture(false, false, false, true); const key = await f.createKey(); const gate = deferredProvider();
    const aborted = vi.fn(); let providerSignal: AbortSignal | undefined;
    f.generate.mockImplementationOnce(async (input: any) => {
      const signal = input.execution?.signal as AbortSignal | undefined;
      if (!signal) throw new Error("A2A fixture expected the provider execution AbortSignal.");
      providerSignal = signal;
      const onAbort = () => { aborted(); gate.release(); };
      if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true });
      try {
        await gate.pending;
        if (lateResult) return a2aResult();
        signal.throwIfAborted();
        throw new Error("A2A fixture resumed without cancellation.");
      } finally { signal.removeEventListener("abort", onAbort); }
    });
    const accepted = await a2aRpc(f, "SendMessage", a2aMessage("cancel-a2a", { returnImmediately: true }), key.key);
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
    expect(providerSignal).toBeInstanceOf(AbortSignal); expect(providerSignal!.aborted).toBe(false);
    const cancelled = await a2aRpc(f, "CancelTask", { id: accepted.task.id }, key.key);
    expect(cancelled.status.state).toBe("TASK_STATE_CANCELED");
    await vi.waitFor(() => expect(aborted).toHaveBeenCalledOnce());
    await Promise.allSettled(f.executions.mock.results.map(call => call.value));
    if (lateResult) await vi.waitFor(() => expect(f.charges).toHaveBeenCalledOnce());
    else {
      await vi.waitFor(() => expect(f.audits.mock.calls.map(([event]) => event)
        .filter(event => (event as { code?: string }).code === "VIRTUAL_KEY_USAGE_SETTLED"))
        .toEqual([expect.objectContaining({ details: expect.objectContaining({ source: "unknown", tokens: null, incomplete: true }) })]));
      expect(f.charges).not.toHaveBeenCalled();
    }
    const stored = await a2aRpc(f, "GetTask", { id: accepted.task.id }, key.key);
    expect(stored).toMatchObject({ status: { state: "TASK_STATE_CANCELED" } });
    expect(stored.artifacts ?? []).toHaveLength(0);
    expect(f.admissions).toHaveBeenCalledOnce(); expect(f.generate).toHaveBeenCalledOnce();
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 1, rateRequestCount: 1 });
    if (lateResult) expect(f.usage(key.record.keyId).tokensUsed).toBe(12);
    else expect(f.usage(key.record.keyId).tokensUsed).toBe(0);
  }, 30_000);

  it("retains both active invocations on one task and aborts and bills each once", async () => {
    const f = await fixture(false, false, false, true); const key = await f.createKey();
    const gates = [deferredProvider(), deferredProvider()]; const signals: AbortSignal[] = []; const aborted = vi.fn();
    f.generate.mockImplementation(async (input: any) => {
      const signal = input.execution?.signal as AbortSignal | undefined;
      if (!signal) throw new Error("A2A fixture expected a separate provider execution AbortSignal.");
      const gate = gates[signals.length];
      if (!gate) throw new Error("A2A fixture received an unexpected additional provider call.");
      signals.push(signal);
      const onAbort = () => { aborted(signal); gate.release(); };
      if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true });
      try { await gate.pending; return a2aResult(); }
      finally { signal.removeEventListener("abort", onAbort); }
    });
    const first = await a2aRpc(f, "SendMessage", a2aMessage("task-first", { returnImmediately: true }), key.key);
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
    const second = await a2aRpc(f, "SendMessage", a2aMessage("task-second", { taskId: first.task.id, returnImmediately: true }), key.key);
    expect(second.task.id).toBe(first.task.id);
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledTimes(2));
    expect(signals).toHaveLength(2); expect(signals[0]).not.toBe(signals[1]);
    expect(signals.every(signal => !signal.aborted)).toBe(true);
    const cancelled = await a2aRpc(f, "CancelTask", { id: first.task.id }, key.key);
    expect(cancelled.status.state).toBe("TASK_STATE_CANCELED");
    await vi.waitFor(() => expect(aborted).toHaveBeenCalledTimes(2));
    await Promise.allSettled(f.executions.mock.results.map(call => call.value));
    await vi.waitFor(() => expect(f.charges).toHaveBeenCalledTimes(2));
    expect(await a2aRpc(f, "GetTask", { id: first.task.id }, key.key)).toMatchObject({ status: { state: "TASK_STATE_CANCELED" } });
    expect(f.generate).toHaveBeenCalledTimes(2); expect(f.admissions).toHaveBeenCalledTimes(2);
    expect(f.usage(key.record.keyId)).toMatchObject({ requestCount: 2, rateRequestCount: 2, tokensUsed: 24 });
  }, 30_000);

  it("aborts and settles a blocking invocation when the HTTP caller disconnects", async () => {
    const f = await fixture(false, false, false, true); const key = await f.createKey(); const gate = deferredProvider();
    const disconnected = new AbortController(); const aborted = vi.fn();
    f.generate.mockImplementationOnce(async (input: any) => {
      const signal = input.execution?.signal as AbortSignal | undefined;
      if (!signal) throw new Error("A2A fixture expected the provider execution AbortSignal.");
      const onAbort = () => { aborted(); gate.release(); };
      if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true });
      try { await gate.pending; signal.throwIfAborted(); throw new Error("A2A fixture resumed without disconnecting."); }
      finally { signal.removeEventListener("abort", onAbort); }
    });
    const pending = fetch(f.url + "/a2a/jsonrpc", { method: "POST", headers: { authorization: `Bearer ${key.key}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "disconnect-a2a", method: "SendMessage", params: a2aMessage("blocking-a2a") }),
      signal: disconnected.signal }).then(response => response.json(), error => error);
    cleanups.push(async () => { disconnected.abort(); await pending; });
    await vi.waitFor(() => expect(f.generate).toHaveBeenCalledOnce());
    disconnected.abort();
    expect(await pending).toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(aborted).toHaveBeenCalledOnce());
    await Promise.allSettled(f.executions.mock.results.map(call => call.value));
    await vi.waitFor(() => expect(f.audits.mock.calls.map(([event]) => event)
      .filter(event => (event as { code?: string }).code === "VIRTUAL_KEY_USAGE_SETTLED"))
      .toEqual([expect.objectContaining({ details: expect.objectContaining({ source: "unknown", tokens: null, incomplete: true }) })]));
    expect(f.charges).not.toHaveBeenCalled();
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.admissions).toHaveBeenCalledOnce();
    expect(f.usage(key.record.keyId).requestCount).toBe(1);
    expect(f.usage(key.record.keyId).tokensUsed).toBe(0);
  }, 30_000);
});
