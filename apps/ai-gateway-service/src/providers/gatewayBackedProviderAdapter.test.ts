import { describe, expect, it, vi } from "vitest";

import { createGatewayBackedProviderAdapter } from "./gatewayBackedProviderAdapter.ts";
import { AGENT_GOVERNANCE_EXECUTION_CONTEXT, GatewayService, readGatewayProviderCallAttempted } from "../core/gatewayService.js";
import { ProviderRegistry } from "./providerRegistry.js";
import { createFakeProvider } from "./fakeProvider.js";
import { createPriorityProviderSelectionPolicy } from "../core/providerSelectionPolicy.js";
import { createApiKeyManager } from "../enterprise/apiKeyManager.js";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { bindGatewayExecution } from "../http/httpRequestExecution.ts";

function coreBackedFixture({ auditFails = false, limit = 1000, missingScope = false } = {}) {
  const priority = createPriorityProviderSelectionPolicy();
  // A legitimate operator-provided selection policy supplies a fallback chain.
  // Default HTTP provider/model preference filtering is not changed by this test.
  const registry = new ProviderRegistry({ selectionPolicy: { ...priority, select: ({ request, candidates }: any) => priority.select({
    request: { ...request, providerId: undefined, model: undefined }, candidates,
  }) } });
  const providers = ["primary", "secondary"].map((providerId, index) => createFakeProvider({ providerId, modelId: "fixture-model",
    providerType: "fake", priority: index + 1, enabled: true, capabilities: ["chat"] }));
  const calls = providers.map(provider => vi.spyOn(provider, "generate").mockResolvedValue({ text: "fixture", message: { role: "assistant", content: "fixture" },
    usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 }, raw: {}, warnings: [], latencyMs: 0, executionStatus: "success" }));
  for (const provider of providers) registry.register(provider);
  const manager = createApiKeyManager({ storePath: null });
  const { record } = manager.create({ tenantId: "fixture", budget: { limitTokens: limit, window: "daily" } });
  const identity = { tenantId: "fixture", userId: `api-key:${record.keyFingerprint}`, apiKeyFingerprint: record.keyFingerprint };
  const scope = createVirtualKeyRequestAccounting({ manager, keyFingerprint: record.keyFingerprint,
    onEvent: async () => { if (auditFails) throw new Error("Synthetic audit persistence failure after an actual attempt."); } });
  const execution = { signal: new AbortController().signal, timeoutMs: 30_000, deadlineAt: Date.now() + 30_000 };
  if (!missingScope) bindVirtualKeyRequestAccounting(execution, scope);
  const core = new GatewayService({ providerRegistry: registry,
    runtimeConfig: { providerMode: "fake", realProviderEnabled: false, fallbackEnabled: true } });
  const bound = bindGatewayExecution(core, execution, () => identity);
  const envelopes: unknown[] = [];
  const gatewayService = { execute: async (input: Record<string, unknown>, invocation?: Record<string, unknown>) => {
    const result = await bound.execute(input as any, invocation); envelopes.push(result); return result;
  } };
  return { calls, envelopes, adapter: createGatewayBackedProviderAdapter({ gatewayService, providerId: "primary", modelId: "fixture-model" }) };
}

describe("gateway-backed internal provider adapter", () => {
  it("routes low-level provider input through a pinned governed gateway call", async () => {
    const signal = new AbortController().signal;
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          message: { role: "assistant", content: "governed answer" },
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          finishReason: "stop",
          metadata: { latencyMs: 7, rawProviderMeta: { toolCalls: [] } },
        },
      })),
    };
    const adapter = createGatewayBackedProviderAdapter({
      gatewayService,
      providerId: "openai",
      modelId: "gpt-test",
      source: "agent-exec",
      agentExecutionContext: {
        agentId: "agt_adapter_test",
        runId: "agr_adapter_run",
        policyHash: `sha256:${"a".repeat(64)}`,
        tenantId: "tenant-a",
        userId: "operator-a",
      },
    });

    const result = await adapter.generate({
      request: {
        messages: [{ role: "user", content: "hello" }],
        tools: [{ type: "function", function: { name: "read_file" } }],
        toolChoice: "auto",
        options: { maxOutputTokens: 128 },
      },
      target: { providerId: "openai", modelId: "gpt-test" },
      execution: { signal },
    });

    expect(gatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      taskType: "chat",
      providerId: "openai",
      model: "gpt-test",
      enterpriseIdentity: { tenantId: "tenant-a", userId: "operator-a" },
      [AGENT_GOVERNANCE_EXECUTION_CONTEXT]: {
        agentId: "agt_adapter_test",
        runId: "agr_adapter_run",
        policyHash: `sha256:${"a".repeat(64)}`,
        tenantId: "tenant-a",
        userId: "operator-a",
      },
      tools: expect.any(Array),
      metadata: {
        source: "agent-exec",
        internalProviderExecution: { governedByGateway: true, directAdapterCall: false },
      },
    }), { signal });
    expect(result).toMatchObject({
      text: "governed answer",
      usage: { totalTokens: 5 },
      latencyMs: 7,
      raw: { toolCalls: [] },
    });
  });

  it("preserves safe gateway failure semantics and rejects target drift", async () => {
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: false,
        code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
        error: {
          code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
          type: "concurrency",
          message: "already consumed",
          retryable: false,
          details: {},
        },
      })),
    };
    const adapter = createGatewayBackedProviderAdapter({
      gatewayService,
      providerId: "openai",
      modelId: "gpt-test",
    });

    await expect(adapter.generate({
      request: { messages: [{ role: "user", content: "hello" }] },
      target: { providerId: "openai", modelId: "gpt-test" },
    })).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
      category: "concurrency",
      retryable: false,
    });
    await expect(adapter.generate({
      request: { messages: [{ role: "user", content: "hello" }] },
      target: { providerId: "other", modelId: "gpt-test" },
    })).rejects.toMatchObject({ code: "GATEWAY_BACKED_PROVIDER_TARGET_MISMATCH", providerCallAttempted: false });
    expect(gatewayService.execute).toHaveBeenCalledOnce();
  });

  it("rejects malformed server-owned Agent attribution", () => {
    expect(() => createGatewayBackedProviderAdapter({
      gatewayService: { execute: vi.fn() },
      providerId: "openai",
      agentExecutionContext: {
        agentId: "caller-controlled",
        runId: "agr_valid",
        policyHash: `sha256:${"a".repeat(64)}`,
        tenantId: "tenant-a",
        userId: "operator-a",
      },
    })).toThrow(expect.objectContaining({ code: "GATEWAY_BACKED_PROVIDER_AGENT_CONTEXT_INVALID" }));
  });

  it.each([
    "VIRTUAL_KEY_RATE_LIMITED", "VIRTUAL_KEY_BUDGET_EXHAUSTED", "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE",
    "VIRTUAL_KEY_METERING_UNSUPPORTED", "api_key_invalid",
  ])("keeps unmarked or JSON-fabricated execution evidence unknown for %s", async code => {
    const execute = vi.fn(async () => JSON.parse(JSON.stringify({ success: false, providerCallAttempted: false,
      error: { code, message: "Synthetic admission denied.", retryable: false, providerCallAttempted: false } })));
    const adapter = createGatewayBackedProviderAdapter({ gatewayService: { execute }, providerId: "fixture", modelId: "fixture-model" });
    await expect(adapter.generate({ request: { messages: [{ role: "user", content: "fixture" }] } }))
      .rejects.toMatchObject({ code, retryable: false, providerCallAttempted: null });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("retains an actual Core attempt when audit failure prevents the next fallback attempt", async () => {
    const f = coreBackedFixture({ auditFails: true });
    f.calls[0]!.mockRejectedValueOnce(Object.assign(new Error("Synthetic retryable upstream failure."), { code: "FIXTURE_OVERLOAD", retryable: true }));
    const error = await f.adapter.generate({ request: { messages: [{ role: "user", content: "fixture" }] } }).catch(error => error);
    expect(f.calls[0]).toHaveBeenCalledOnce(); expect(f.calls[1]).not.toHaveBeenCalled();
    expect(error).toMatchObject({ code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE", retryable: false, providerCallAttempted: true });
    expect(readGatewayProviderCallAttempted(f.envelopes[0])).toBe(true);
  });

  it.each([{ limit: 1, code: "VIRTUAL_KEY_BUDGET_EXHAUSTED" }, { missingScope: true, code: "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" }])(
    "uses actual Core no-dispatch evidence for $code", async ({ code, ...options }) => {
      const f = coreBackedFixture(options);
      await expect(f.adapter.generate({ request: { messages: [{ role: "user", content: "fixture" }] } }))
        .rejects.toMatchObject({ code, providerCallAttempted: false });
      expect(f.calls[0]).not.toHaveBeenCalled(); expect(f.calls[1]).not.toHaveBeenCalled();
      expect(readGatewayProviderCallAttempted(f.envelopes[0])).toBe(false);
    });

  it("does not preserve execution proof in JSON copies of real Core results", async () => {
    const f = coreBackedFixture();
    await f.adapter.generate({ request: { messages: [{ role: "user", content: "fixture" }] } });
    expect(readGatewayProviderCallAttempted(f.envelopes[0])).toBe(true);
    const copied = JSON.parse(JSON.stringify(f.envelopes[0]));
    expect(readGatewayProviderCallAttempted(copied)).toBeUndefined();
    expect(readGatewayProviderCallAttempted({ ...copied, providerCallAttempted: false })).toBeUndefined();
  });

  it.each(["USAGE_LEDGER_WRITE_FAILED", "PROVIDER_RESPONSE_FAILED"])("does not label the potentially post-call error %s as unattempted", async code => {
    const execute = vi.fn(async () => ({ success: false, error: { code, message: "Synthetic result persistence failed.", retryable: false } }));
    const adapter = createGatewayBackedProviderAdapter({ gatewayService: { execute }, providerId: "fixture", modelId: "fixture-model" });
    await expect(adapter.generate({ request: { messages: [{ role: "user", content: "fixture" }] } }))
      .rejects.toMatchObject({ code, providerCallAttempted: null });
  });
});
