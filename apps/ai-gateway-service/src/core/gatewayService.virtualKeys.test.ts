import { describe, expect, it, vi } from "vitest";
import { GatewayService } from "./gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting, type VirtualKeyAccountingEvent } from "../enterprise/virtualKeyRequestAccounting.ts";
import { getVirtualKeyBillingSnapshot } from "./virtualKeyUsageAccounting.ts";
import { estimateTextTokens, estimateTokens } from "../cost/tokenEstimator.js";
import { mapChatCompletionsResponseToProviderResponse, readChatCompletionsStream } from "../providers/httpProviderMapping.js";
import { iteratePrimedGatewayStream, primeGatewayStream } from "../http/gatewayStreamPreflight.ts";
import { createAnthropicAdapter } from "../providers/anthropicAdapter.js";
import { createGeminiAdapter } from "../providers/geminiAdapter.ts";
import { fetchWithAgent } from "../http/connectionPool.js";

vi.mock("../http/connectionPool.js", () => ({ fetchWithAgent: vi.fn() }));
vi.mock("../security/outboundUrlPolicy.ts", () => ({ resolveSafeOutboundUrl: vi.fn(async url => ({ url: String(url), lookup: undefined })) }));

function rawUsage(total: number, complete = true) {
  const usage = { inputTokens: Math.min(1, total), outputTokens: Math.max(0, total - 1), totalTokens: total };
  return { fake: true, usage, usageObservation: { version: 1, source: "reported", ...usage, knownTokens: total, invalid: false, complete } };
}
const providerResult = (tokens = 12) => ({ text: "fixture complete", message: { role: "assistant", content: "fixture complete" },
  usage: rawUsage(tokens).usage, raw: rawUsage(tokens), executionStatus: "success", latencyMs: 0, warnings: [] });
function fixture(options: { budget?: boolean; limit?: number; secondary?: boolean; failAudit?: boolean; requestLogger?: any; healthScorer?: any; shadow?: boolean; billableFixture?: boolean } = {}) {
  const manager = createApiKeyManager({ storePath: null });
  const { key, record } = manager.create({ budget: options.budget === false ? undefined : { limitTokens: options.limit ?? 1000, window: "daily" },
    rateLimit: { requestsPerMinute: 1 }, tenantId: "fixture-tenant" });
  const authenticated = manager.validate(key);
  if (!authenticated.valid || !authenticated.record) throw new Error("Fixture authentication failed.");
  const identity = { userId: `api-key:${record.keyFingerprint}`, tenantId: record.tenantId, role: record.role, apiKeyFingerprint: record.keyFingerprint };
  const providerType = options.billableFixture ? "openai" : "fake";
  const primary = createFakeProvider({ providerId: "primary", modelId: "model-primary", providerType, priority: 1, fixedLatencyMs: 0,
    enabled: true, capabilities: ["chat"] });
  const secondary = createFakeProvider({ providerId: "secondary", modelId: "model-secondary", providerType, priority: 2, fixedLatencyMs: 0,
    enabled: true, capabilities: ["chat"] });
  const generate = vi.spyOn(primary, "generate").mockImplementation(async () => providerResult());
  const otherGenerate = vi.spyOn(secondary, "generate").mockImplementation(async () => providerResult(7));
  const registry = new ProviderRegistry();
  registry.register(primary);
  if (options.secondary || options.shadow) registry.register(secondary);
  const gateway = new GatewayService({ providerRegistry: registry,
    runtimeConfig: { providerMode: options.billableFixture ? "real" : "fake", realProviderEnabled: options.billableFixture === true,
      enabledProviders: ["primary", "secondary"], fallbackEnabled: options.secondary === true },
    requestLogger: options.requestLogger,
    healthScorer: options.healthScorer,
    enterpriseAudit: options.billableFixture ? { recordAudit: async () => {} } : null,
    weightedTrafficPolicy: options.shadow ? { apply: () => null, shouldShadow: () => ({ providerId: "secondary", routeName: "fixture-shadow", percent: 100 }) } : null });
  const events: VirtualKeyAccountingEvent[] = [];
  const admissions = vi.spyOn(manager, "authorizeUsage");
  const charges = vi.spyOn(manager, "recordUsage");
  const scope = createVirtualKeyRequestAccounting({ manager, keyFingerprint: authenticated.record.keyFingerprint,
    onEvent: async event => { if (options.failAudit) throw new Error("synthetic audit failure"); events.push(event); } });
  const controller = new AbortController();
  const execution = { signal: controller.signal };
  bindVirtualKeyRequestAccounting(execution, scope);
  const input = { messages: [{ role: "user" as const, content: "hello fixture" }], enterpriseIdentity: identity };
  return { manager, record, scope, gateway, primary, secondary, generate, otherGenerate, events, admissions, charges, controller, execution, input,
    usage: () => manager.describeUsage({ keyId: record.keyId })!.usage };
}
async function collect(iterable: AsyncIterable<any>) { const events = []; for await (const event of iterable) events.push(event); return events; }

describe("GatewayService actual virtual-key accounting boundary", () => {
  it("admits one request and charges distinct child calls once even for fake providers", async () => {
    const f = fixture();
    f.scope.admit(8);
    const first = await f.gateway.execute(f.input, f.execution);
    const second = await f.gateway.execute(f.input, f.execution);
    expect(first.success && second.success).toBe(true);
    expect(f.admissions).toHaveBeenCalledOnce();
    expect(f.charges).toHaveBeenCalledTimes(2);
    expect(f.usage()).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: 24 });
    expect(getVirtualKeyBillingSnapshot(first)).toEqual({ version: 1, source: "reported", totalTokens: 12 });
    expect(getVirtualKeyBillingSnapshot(JSON.parse(JSON.stringify(first)))).toBeUndefined();
  });

  it("distinguishes a reported zero from legacy default zero and includes output in estimates", async () => {
    const f = fixture();
    f.generate.mockResolvedValueOnce(providerResult(0));
    const zero = await f.gateway.execute(f.input, f.execution);
    expect(f.charges).toHaveBeenLastCalledWith({ keyId: f.record.keyFingerprint, tokens: 0 });
    expect(getVirtualKeyBillingSnapshot(zero)).toEqual({ version: 1, source: "reported", totalTokens: 0 });
    f.generate.mockResolvedValueOnce({ ...providerResult(), text: "long output ".repeat(40),
      message: { role: "assistant", content: "long output ".repeat(40) }, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      raw: { usageObservation: { version: 1, source: "unknown", totalTokens: null, knownTokens: null, invalid: false, complete: true } } });
    const estimated = await f.gateway.execute(f.input, f.execution);
    expect(getVirtualKeyBillingSnapshot(estimated)?.source).toBe("estimated");
    expect(f.usage().tokensUsed).toBeGreaterThan(estimateTokens(f.input).estimatedInputTokens);
    expect(getVirtualKeyBillingSnapshot(estimated)?.totalTokens).toBe(f.usage().tokensUsed);
  });

  it("denies an unbound fingerprint and exhausted child before provider execution", async () => {
    const unbound = fixture();
    const denied = await unbound.gateway.execute(unbound.input);
    expect(denied).toMatchObject({ success: false, error: { code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" } });
    expect(unbound.generate).not.toHaveBeenCalled();
    const f = fixture({ limit: 12 });
    await f.gateway.execute(f.input, f.execution);
    expect(await f.gateway.execute(f.input, f.execution)).toMatchObject({ success: false, error: { code: "VIRTUAL_KEY_BUDGET_EXHAUSTED" } });
    expect(f.generate).toHaveBeenCalledOnce();
  });

  it("charges a result returned immediately before cancellation without replaying it", async () => {
    const f = fixture({ secondary: true });
    f.generate.mockImplementationOnce(async () => {
      f.controller.abort(Object.assign(new Error("synthetic disconnect"), { code: "CLIENT_DISCONNECTED" }));
      return providerResult(17);
    });
    await expect(f.gateway.execute(f.input, f.execution)).rejects.toMatchObject({ code: "CLIENT_DISCONNECTED" });
    expect(f.usage().tokensUsed).toBe(17);
    expect(f.charges).toHaveBeenCalledOnce();
    expect(f.otherGenerate).not.toHaveBeenCalled();
  });

  it("settles known streaming work once when the consumer returns early", async () => {
    const f = fixture();
    const closed = vi.fn();
    vi.spyOn(f.primary, "generateStream").mockImplementation(async function* () {
      try { yield { textDelta: "partial", raw: rawUsage(6, false) }; yield { textDelta: "unconsumed", raw: rawUsage(20) }; }
      finally { closed(); }
    });
    const iterator = f.gateway.executeStream(f.input, f.execution);
    let event = await iterator.next();
    while (!event.done && event.value.type !== "chunk") event = await iterator.next();
    await iterator.return(undefined);
    expect(closed).toHaveBeenCalledOnce();
    expect(f.usage().tokensUsed).toBe(6);
    expect(f.events.at(-1)).toMatchObject({ source: "partial", incomplete: true, tokens: 6 });
    expect(f.charges).toHaveBeenCalledOnce();
  });

  it("charges known pre-output streaming attempts without summing snapshots or changing fallback", async () => {
    const f = fixture({ secondary: true });
    vi.spyOn(f.primary, "generateStream").mockImplementation(async function* () {
      yield { textDelta: "", usageOnly: true, raw: rawUsage(3, false) };
      yield { textDelta: "", usageOnly: true, raw: rawUsage(5, false) };
      throw Object.assign(new Error("synthetic overload"), { retryable: true, code: "FIXTURE_OVERLOAD" });
    });
    vi.spyOn(f.secondary, "generateStream").mockImplementation(async function* () {
      yield { textDelta: "complete", raw: rawUsage(7) };
    });
    const events = await collect(f.gateway.executeStream(f.input, f.execution));
    expect(events.at(-1)).toMatchObject({ type: "done", outputText: "complete" });
    expect(f.usage()).toMatchObject({ requestCount: 1, tokensUsed: 12 });
    expect(f.events.map(event => event.tokens)).toEqual([5, 7]);
    expect(getVirtualKeyBillingSnapshot(events.at(-1))?.totalTokens).toBe(7);
  });

  it("settles partial work when the HTTP primed-stream wrapper is closed", async () => {
    const f = fixture();
    const closed = vi.fn();
    vi.spyOn(f.primary, "generateStream").mockImplementation(async function* () {
      try { yield { textDelta: "partial", raw: rawUsage(8, false) }; }
      finally { closed(); }
    });
    const primed = await primeGatewayStream(f.gateway.executeStream(f.input, f.execution));
    for await (const event of iteratePrimedGatewayStream(primed)) if (event.type === "chunk") break;
    expect(closed).toHaveBeenCalledOnce();
    expect(f.usage().tokensUsed).toBe(8);
  });

  it("records unknown failed attempts without pretending they consumed zero tokens", async () => {
    const f = fixture();
    f.generate.mockRejectedValueOnce(Object.assign(new Error("synthetic transport failure"), { retryable: false }));
    expect((await f.gateway.execute(f.input, f.execution)).success).toBe(false);
    expect(f.charges).not.toHaveBeenCalled();
    expect(f.events).toHaveLength(1);
    expect(f.events[0]).toMatchObject({ tokens: null, source: "unknown", incomplete: true });
  });

  it("keeps a known charge when the existing attempt ledger fails after provider work", async () => {
    const f = fixture({ secondary: true, billableFixture: true, requestLogger: { assertDurable: () => true,
      log: async (entry: any) => { if (entry.usageEventType === "attempt-completed") throw new Error("synthetic ledger failure"); } } });
    expect(await f.gateway.execute(f.input, f.execution)).toMatchObject({ success: false, error: { code: "USAGE_LEDGER_WRITE_FAILED" } });
    expect(f.usage().tokensUsed).toBe(12);
    expect(f.generate).toHaveBeenCalledOnce();
    expect(f.otherGenerate).not.toHaveBeenCalled();
  });

  it("does not retry or settle the ledger again when post-call health recording fails", async () => {
    const log = vi.fn(async (_entry: any) => {});
    const recordFailure = vi.fn(() => { throw Object.assign(new Error("synthetic health failure recorder"), { code: "FIXTURE_HEALTH_FAILURE_RECORDER", retryable: true }); });
    const f = fixture({ secondary: true, billableFixture: true, requestLogger: { assertDurable: () => true, log }, healthScorer: {
      recordSuccess: () => { throw Object.assign(new Error("synthetic health failure"), { code: "FIXTURE_HEALTH_FAILURE", retryable: true }); }, recordFailure } });
    expect(await f.gateway.execute(f.input, f.execution)).toMatchObject({ success: false, error: { code: "FIXTURE_HEALTH_FAILURE", retryable: false } });
    expect(f.generate).toHaveBeenCalledOnce(); expect(f.otherGenerate).not.toHaveBeenCalled();
    expect(f.charges).toHaveBeenCalledOnce(); expect(f.usage().tokensUsed).toBe(12);
    expect(recordFailure).not.toHaveBeenCalled();
    expect(log.mock.calls.map(([entry]) => (entry as any).usageEventType)).toEqual(["attempt-started", "attempt-completed"]);
  });

  it("does not retry a usage-only stream after its completed-attempt ledger write fails", async () => {
    const f = fixture({ secondary: true, billableFixture: true, requestLogger: { assertDurable: () => true,
      log: async (entry: any) => { if (entry.usageEventType === "attempt-completed") throw new Error("synthetic ledger failure"); } } });
    vi.spyOn(f.primary, "generateStream").mockImplementation(async function* () {
      yield { textDelta: "", usageOnly: true, raw: rawUsage(12) };
    });
    const fallback = vi.spyOn(f.secondary, "generateStream");
    const events = await collect(f.gateway.executeStream(f.input, f.execution));
    expect(events.at(-1)).toMatchObject({ type: "error", envelope: { error: { code: "USAGE_LEDGER_WRITE_FAILED", retryable: false } } });
    expect(fallback).not.toHaveBeenCalled();
    expect(f.usage().tokensUsed).toBe(12);
    expect(f.charges).toHaveBeenCalledOnce();
  });

  it.each([null, "visible answer"])("includes tools and observed reasoning when usage is absent (text=%s)", async (content) => {
    const f = fixture({ limit: 10_000 });
    const args = JSON.stringify({ value: "x".repeat(3000) });
    const calls = [{ id: "tool-fixture", type: "function", function: { name: "fixture", arguments: args } }];
    const mapped = mapChatCompletionsResponseToProviderResponse({ choices: [{ message: {
      content, tool_calls: calls, reasoning_content: "observed reasoning ".repeat(20),
    } }] }, { providerRequest: { target: { providerId: "primary", modelId: "model-primary" } }, latencyMs: 0 });
    f.generate.mockResolvedValueOnce(mapped);
    const result = await f.gateway.execute(f.input, f.execution);
    expect(result.success).toBe(true);
    expect(f.usage().tokensUsed).toBeGreaterThan(estimateTokens(f.input).estimatedInputTokens + estimateTextTokens(args));
    expect(getVirtualKeyBillingSnapshot(result)?.totalTokens).toBe(f.usage().tokensUsed);
  });

  it("includes streamed tool arguments without usage and without emitting reasoning frames", async () => {
    const f = fixture({ limit: 10_000 });
    const args = JSON.stringify({ value: "x".repeat(3000) });
    const frames = [
      { choices: [{ delta: { reasoning_content: "observed reasoning ".repeat(20) } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "tool-fixture", type: "function", function: { name: "fixture", arguments: args.slice(0, 1200) } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(1200) } }] } }] },
    ];
    const response = { body: (async function* () {
      for (const frame of frames) yield Buffer.from(`data: ${JSON.stringify(frame)}\n\n`);
      yield Buffer.from("data: [DONE]\n\n");
    })() };
    vi.spyOn(f.primary, "generateStream").mockImplementation((request: any) => readChatCompletionsStream(response, request) as any);
    const events = await collect(f.gateway.executeStream(f.input, f.execution));
    expect(events.at(-1).type).toBe("done");
    expect(JSON.stringify(events)).not.toContain("observed reasoning");
    expect(f.usage().tokensUsed).toBeGreaterThan(estimateTokens(f.input).estimatedInputTokens + estimateTextTokens(args));
  });

  it.each(["input", "output"])("preserves known %s usage and estimates the other component", async (known) => {
    const f = fixture({ limit: 10_000 });
    const text = "x".repeat(120);
    f.generate.mockResolvedValueOnce({ ...providerResult(), text, message: { role: "assistant", content: text },
      raw: { usageObservation: { version: 1, source: "partial", totalTokens: null, invalid: false, complete: true,
        inputTokens: known === "input" ? 1000 : null, outputTokens: known === "output" ? 1000 : null, knownTokens: 1000 } } });
    await f.gateway.execute(f.input, f.execution);
    expect(f.usage().tokensUsed).toBe(1000 + (known === "input" ? estimateTextTokens(text) : estimateTokens(f.input).estimatedInputTokens));
  });

  it("transfers the same request capability to an authorized shadow call", async () => {
    const f = fixture({ shadow: true });
    expect((await f.gateway.execute(f.input, f.execution)).success).toBe(true);
    await vi.waitFor(() => expect(f.events).toHaveLength(2));
    expect(f.usage()).toMatchObject({ tokensUsed: 19, requestCount: 1, rateRequestCount: 1 });
    expect(f.admissions).toHaveBeenCalledOnce();
  });

  it.each(["normal", "stream", "operation"])("never advertises retry after the failed-attempt ledger also fails (%s)", async mode => {
    const f = fixture({ secondary: true, billableFixture: true, budget: mode !== "operation", requestLogger: { assertDurable: () => true,
      log: async (entry: any) => { if (entry.usageEventType === "attempt-failed") throw new Error("synthetic failed-attempt ledger failure"); } } });
    const failure = Object.assign(new Error("synthetic provider failure"), { code: "FIXTURE_OVERLOAD", retryable: true });
    if (mode === "operation") {
      await expect(f.gateway.executeProviderOperation({ operationType: "image_generation", providerId: "primary", providerType: "openai",
        modelId: "model-primary", path: "/v1/images/generations", requestFingerprint: "a".repeat(64),
        enterpriseIdentity: f.input.enterpriseIdentity, invoke: async () => { throw failure; } }, f.execution))
        .rejects.toMatchObject({ code: "USAGE_LEDGER_WRITE_FAILED", retryable: false });
    } else if (mode === "stream") {
      vi.spyOn(f.primary, "generateStream").mockImplementation(async function* () {
        yield { textDelta: "", usageOnly: true, raw: rawUsage(9, false) }; throw failure;
      });
      const fallback = vi.spyOn(f.secondary, "generateStream");
      const events = await collect(f.gateway.executeStream(f.input, f.execution));
      expect(events.at(-1)).toMatchObject({ type: "error", envelope: { error: { code: "USAGE_LEDGER_WRITE_FAILED", retryable: false } } });
      expect(fallback).not.toHaveBeenCalled(); expect(f.usage().tokensUsed).toBe(9);
    } else {
      f.generate.mockRejectedValueOnce(failure);
      expect(await f.gateway.execute(f.input, f.execution)).toMatchObject({ success: false, error: { code: "USAGE_LEDGER_WRITE_FAILED", retryable: false } });
    }
    expect(f.otherGenerate).not.toHaveBeenCalled();
  });

  it.each([false, true])("retains native Gemini known visible tokens and estimates missing thoughts (stream=%s)", async streaming => {
    const f = fixture({ limit: 10_000 });
    const thinking = "x".repeat(600);
    const native = createGeminiAdapter({ providerId: "primary", apiKey: "synthetic-fixture-key", models: ["model-primary"] }) as any;
    const payload = { candidates: [{ content: { parts: [{ thought: true, text: thinking }, { text: "answer" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 5 } };
    vi.mocked(fetchWithAgent).mockResolvedValue(streaming ? { ok: true, status: 200,
      body: (async function* () { yield Buffer.from(`data: ${JSON.stringify(payload)}\n\n`); })() }
      : { ok: true, status: 200, text: async () => JSON.stringify(payload) });
    if (streaming) {
      vi.spyOn(f.primary, "generateStream").mockImplementation(request => native.generateStream(request));
      const events = await collect(f.gateway.executeStream(f.input, f.execution));
      expect(events.at(-1).type).toBe("done");
      expect(getVirtualKeyBillingSnapshot(events.at(-1))).toBeUndefined();
    } else {
      f.generate.mockImplementation(request => native.generate(request));
      const response = await f.gateway.execute(f.input, f.execution); expect(response.success).toBe(true);
      expect(getVirtualKeyBillingSnapshot(response)).toBeUndefined();
    }
    expect(f.usage().tokensUsed).toBe(1005 + estimateTextTokens(thinking));
    expect(f.events.at(-1)).toMatchObject({ source: "estimated", incomplete: true });
  });

  it.each([false, true])("includes native Anthropic thinking and tools when usage is missing (stream=%s)", async streaming => {
    const f = fixture({ limit: 10_000 }); const thinking = "x".repeat(600); const args = { value: "x".repeat(3000) };
    const native = createAnthropicAdapter({ providerId: "primary", apiKey: "synthetic-fixture-key", models: ["model-primary"] }) as any;
    const payload = { content: [{ type: "thinking", thinking }, { type: "tool_use", id: "fixture", name: "fixture", input: args }], stop_reason: "tool_use" };
    const frames = [
      { type: "message_start", message: {} },
      { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking } },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "fixture", name: "fixture", input: {} } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: JSON.stringify(args) } },
      { type: "message_stop" },
    ];
    vi.mocked(fetchWithAgent).mockResolvedValue(streaming ? { ok: true, status: 200,
      body: (async function* () { for (const frame of frames) yield Buffer.from(`event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`); })() }
      : { ok: true, status: 200, text: async () => JSON.stringify(payload) });
    if (streaming) {
      vi.spyOn(f.primary, "generateStream").mockImplementation(request => native.generateStream(request));
      const events = await collect(f.gateway.executeStream(f.input, f.execution)); expect(events.at(-1).type).toBe("done");
    } else { f.generate.mockImplementation(request => native.generate(request)); expect((await f.gateway.execute(f.input, f.execution)).success).toBe(true); }
    expect(f.usage().tokensUsed).toBeGreaterThan(estimateTokens(f.input).estimatedInputTokens + estimateTextTokens(JSON.stringify(args)) + estimateTextTokens(thinking));
    expect(f.charges).toHaveBeenCalledOnce();
  });

  it("denies unsupported budgeted provider operations before dispatch and permits RPM-only unknown use", async () => {
    const operation = { operationType: "image_generation", providerId: "primary", providerType: "fake", modelId: "fixture-image",
      path: "/v1/images/generations", requestFingerprint: "a".repeat(64), invoke: vi.fn(async () => ({ data: { url: "synthetic-image", usage: { images: 1, total_tokens: 99 } } })) };
    const f = fixture();
    await expect(f.gateway.executeProviderOperation({ ...operation, enterpriseIdentity: f.input.enterpriseIdentity }, f.execution))
      .rejects.toMatchObject({ code: "VIRTUAL_KEY_METERING_UNSUPPORTED" });
    expect(operation.invoke).not.toHaveBeenCalled();
    const rpm = fixture({ budget: false });
    await rpm.gateway.executeProviderOperation({ ...operation, enterpriseIdentity: rpm.input.enterpriseIdentity }, rpm.execution);
    expect(operation.invoke).toHaveBeenCalledOnce();
    expect(rpm.usage().requestCount).toBe(1);
    expect(rpm.charges).not.toHaveBeenCalled();
    expect(rpm.events.at(-1)).toMatchObject({ tokens: null, source: "unknown" });
  });
});
