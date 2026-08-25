import { describe, expect, it, vi } from "vitest";

import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { GatewayService } from "./gatewayService.js";

const execution = Object.freeze({
  providerDispatchKeyHash: "a".repeat(64),
  providerDispatchRoute: "/v1/chat/completions",
  providerDispatchInvocation: 3,
});

function createBillableService({
  providers,
  providerDispatchGate,
  requestLogger,
  fallbackEnabled = false,
  requireProviderDispatchGate = true,
}: {
  providers: any[];
  providerDispatchGate: any;
  requestLogger: any;
  fallbackEnabled?: boolean;
  requireProviderDispatchGate?: boolean;
}) {
  const registry = new (ProviderRegistry as any)({
    enabledProviders: providers.map((provider: any) => provider.descriptor.id),
  });
  for (const provider of providers) registry.register(provider);
  return new GatewayService({
    providerRegistry: registry,
    runtimeConfig: {
      providerMode: "real",
      realProviderEnabled: true,
      enabledProviders: providers.map((provider: any) => provider.descriptor.id),
      fallbackEnabled,
      requireDurableUsageLedger: true,
      requireProviderDispatchGate,
    },
    requestLogger,
    enterpriseAudit: { recordAudit: vi.fn(async () => {}) },
    providerDispatchGate,
  });
}

function realProvider({
  providerId = "real-primary",
  modelId = `${providerId}-model`,
  priority = 1,
  failMode,
}: {
  providerId?: string;
  modelId?: string;
  priority?: number;
  failMode?: string;
} = {}) {
  return createFakeProvider({
    providerId,
    modelId,
    providerType: "openai",
    priority,
    capabilities: ["chat"],
    enabled: true,
    fixedLatencyMs: 1,
    ...(failMode ? { failMode } : {}),
  } as any);
}

function successfulGate(events: string[] = []) {
  return {
    reserve: vi.fn(async (_input: Record<string, any>) => {
      events.push("dispatch-reserved");
      return {
        reserved: true,
        bypassed: false,
        reservationFingerprint: "0123456789abcdef",
      };
    }),
  };
}

function durableLogger(events: string[] = []) {
  return {
    assertDurable: vi.fn(async () => {
      events.push("usage-ready");
    }),
    log: vi.fn(async (entry: Record<string, any>) => {
      events.push(`usage-${entry.usageEventType ?? "record"}`);
    }),
  };
}

describe("GatewayService provider dispatch reservation", () => {
  it("durably reserves before any non-streaming billable adapter call", async () => {
    const events: string[] = [];
    const provider = realProvider();
    const originalGenerate = provider.generate.bind(provider);
    const generate = vi.spyOn(provider, "generate").mockImplementation(async (request: any) => {
      events.push("provider-generate");
      return originalGenerate(request);
    });
    const gate = successfulGate(events);
    const requestLogger = durableLogger(events);
    const service = createBillableService({
      providers: [provider],
      providerDispatchGate: gate,
      requestLogger,
    });

    const result = await service.execute({
      messages: [{ role: "user", content: "reserve before spend" }],
      enterpriseIdentity: { tenantId: "tenant-a" },
    } as any, execution);

    expect(result.success).toBe(true);
    expect(generate).toHaveBeenCalledOnce();
    expect(events.indexOf("usage-ready")).toBeLessThan(events.indexOf("dispatch-reserved"));
    expect(events.indexOf("dispatch-reserved")).toBeLessThan(events.indexOf("usage-attempt-started"));
    expect(events.indexOf("usage-attempt-started")).toBeLessThan(events.indexOf("provider-generate"));
    expect(gate.reserve).toHaveBeenCalledWith(expect.objectContaining({
      dispatchKeyHash: execution.providerDispatchKeyHash,
      route: "/v1/chat/completions",
      invocation: 3,
      attempt: 1,
      shadow: false,
      tenantId: "tenant-a",
      providerId: "real-primary",
      modelId: "real-primary-model",
      requestFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(JSON.stringify(gate.reserve.mock.calls[0][0])).not.toContain("reserve before spend");
  });

  it("does not call the adapter when the reservation store rejects", async () => {
    const provider = realProvider();
    const generate = vi.spyOn(provider, "generate");
    const gate = {
      reserve: vi.fn(async (_input: Record<string, any>) => {
        throw Object.assign(new Error("duplicate"), {
          code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
          category: "concurrency",
          statusCode: 409,
          retryable: false,
        });
      }),
    };
    const requestLogger = durableLogger();
    const service = createBillableService({
      providers: [provider],
      providerDispatchGate: gate,
      requestLogger,
    });

    const result = await service.execute({
      messages: [{ role: "user", content: "must not double spend" }],
    }, execution);

    expect(result).toMatchObject({
      success: false,
      error: { code: "PROVIDER_DISPATCH_ALREADY_RESERVED", retryable: false },
    });
    expect(generate).not.toHaveBeenCalled();
    expect(requestLogger.log).toHaveBeenCalledOnce();
    expect(requestLogger.log.mock.calls[0][0]).toMatchObject({ providerCallAttempted: false });
  });

  it("fails closed when the required gate is missing", async () => {
    const provider = realProvider();
    const generate = vi.spyOn(provider, "generate");
    const service = createBillableService({
      providers: [provider],
      providerDispatchGate: null,
      requestLogger: durableLogger(),
    });

    const result = await service.execute({
      messages: [{ role: "user", content: "missing gate" }],
    }, execution);

    expect(result).toMatchObject({
      success: false,
      error: { code: "PROVIDER_DISPATCH_GATE_UNAVAILABLE" },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("reserves before creating a streaming provider iterator", async () => {
    const events: string[] = [];
    const provider = realProvider();
    const originalGenerateStream = provider.generateStream.bind(provider);
    const generateStream = vi.spyOn(provider, "generateStream").mockImplementation((request: any) => {
      events.push("provider-generate-stream");
      return originalGenerateStream(request);
    });
    const gate = successfulGate(events);
    const service = createBillableService({
      providers: [provider],
      providerDispatchGate: gate,
      requestLogger: durableLogger(events),
    });

    const streamEvents: any[] = [];
    for await (const event of service.executeStream({
      messages: [{ role: "user", content: "stream safely" }],
    }, execution)) {
      streamEvents.push(event);
    }

    expect(streamEvents.at(0)?.type).toBe("start");
    expect(streamEvents.at(-1)?.type).toBe("done");
    expect(generateStream).toHaveBeenCalledOnce();
    expect(events.indexOf("dispatch-reserved")).toBeLessThan(events.indexOf("provider-generate-stream"));
    expect(gate.reserve).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1 }));
  });

  it("assigns separate reservation attempts to primary and fallback providers", async () => {
    const primary = realProvider({ providerId: "primary", priority: 1, failMode: "retryable" });
    const fallback = realProvider({ providerId: "fallback", priority: 2 });
    const gate = successfulGate();
    const service = createBillableService({
      providers: [primary, fallback],
      providerDispatchGate: gate,
      requestLogger: durableLogger(),
      fallbackEnabled: true,
    });

    const result = await service.execute({
      messages: [{ role: "user", content: "safe fallback" }],
    }, execution);

    expect(result).toMatchObject({ success: true, data: { selectedProvider: "fallback" } });
    expect(gate.reserve.mock.calls.map(([input]) => ({
      providerId: input.providerId,
      attempt: input.attempt,
    }))).toEqual([
      { providerId: "primary", attempt: 1 },
      { providerId: "fallback", attempt: 2 },
    ]);
  });

  it("produces a stable request fingerprint without retaining prompt content", async () => {
    const provider = realProvider();
    const gate = successfulGate();
    const service = createBillableService({
      providers: [provider],
      providerDispatchGate: gate,
      requestLogger: durableLogger(),
    });

    await service.execute({ messages: [{ role: "user", content: "same prompt" }] }, execution);
    await service.execute({ messages: [{ content: "same prompt", role: "user" }] }, execution);
    await service.execute({ messages: [{ role: "user", content: "different prompt" }] }, execution);
    await service.execute({
      messages: [{ role: "user", content: "same prompt" }],
      tools: [{ type: "function", function: { name: "read_file", parameters: {} } }],
      toolChoice: "auto",
    } as any, execution);

    const fingerprints = gate.reserve.mock.calls.map(([input]) => input.requestFingerprint);
    expect(fingerprints[0]).toBe(fingerprints[1]);
    expect(fingerprints[2]).not.toBe(fingerprints[0]);
    expect(fingerprints[3]).not.toBe(fingerprints[0]);
    expect(JSON.stringify(gate.reserve.mock.calls)).not.toContain("same prompt");
    expect(JSON.stringify(gate.reserve.mock.calls)).not.toContain("different prompt");
  });

  it("bypasses the dispatch gate for credential-free fake providers", async () => {
    const provider = createFakeProvider({
      providerId: "local-fake",
      modelId: "local-fake-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
      fixedLatencyMs: 1,
    });
    const registry = new ProviderRegistry();
    registry.register(provider);
    const gate = successfulGate();
    const service = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "fake",
        realProviderEnabled: false,
        fallbackEnabled: false,
        requireProviderDispatchGate: true,
      },
      providerDispatchGate: gate,
    });

    const result = await service.execute({
      messages: [{ role: "user", content: "fake remains credential free" }],
    });

    expect(result.success).toBe(true);
    expect(gate.reserve).not.toHaveBeenCalled();
  });
});
