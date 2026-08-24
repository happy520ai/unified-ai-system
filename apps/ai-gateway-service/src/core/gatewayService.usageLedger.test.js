import { describe, expect, it, vi } from "vitest";
import { GatewayService } from "./gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

function buildService({ requestLogger } = {}) {
  const registry = new ProviderRegistry();
  registry.register(createFakeProvider({
    providerId: "local-fake-provider",
    modelId: "local-fake-model",
    providerType: "fake",
    capabilities: ["chat"],
    enabled: true,
    fixedLatencyMs: 1,
  }));

  return new GatewayService({
    providerRegistry: registry,
    runtimeConfig: { providerMode: "fake", realProviderEnabled: false, fallbackEnabled: false },
    requestLogger,
  });
}

describe("GatewayService usage ledger", () => {
  it("records a usage entry when a requestLogger is injected", async () => {
    const entries = [];
    const requestLogger = { log: (entry) => entries.push(entry) };
    const service = buildService({ requestLogger });

    const result = await service.execute({ messages: [{ role: "user", content: "hello world" }] });

    expect(result.success).toBe(true);
    expect(entries).toHaveLength(1);
    expect(entries[0].provider).toBe("local-fake-provider");
    expect(entries[0].model).toBe("local-fake-model");
    expect(entries[0].inputTokens).toBeGreaterThan(0);
    expect(entries[0].outputTokens).toBeGreaterThan(0);
    expect(entries[0].statusCode).toBe(200);
    expect(entries[0].traceId).toBeTruthy();
    expect(entries[0].shadow).toBe(false);
    expect(entries[0].providerCallAttempted).toBe(true);
    expect(entries[0].billable).toBe(false);
    expect(entries[0].estimatedCostUsd).toBe(0);
    expect(entries[0].costSource).toBe("non-billable-fake");
    expect(entries[0].costEstimateAvailable).toBe(true);
  });

  it("does not require a requestLogger (backwards compatible)", async () => {
    const service = buildService();
    const result = await service.execute({ messages: [{ role: "user", content: "hello" }] });
    expect(result.success).toBe(true);
  });

  it("fails open when the ledger throws", async () => {
    const service = buildService({
      requestLogger: { log: () => { throw new Error("ledger down"); } },
    });
    const result = await service.execute({ messages: [{ role: "user", content: "hello" }] });
    expect(result.success).toBe(true);
  });
});

function buildBillableService({ requestLogger }) {
  const registry = new ProviderRegistry({ enabledProviders: ["real-test-provider"] });
  const provider = createFakeProvider({
    providerId: "real-test-provider",
    modelId: "real-test-model",
    providerType: "openai",
    capabilities: ["chat"],
    enabled: true,
    fixedLatencyMs: 1,
  });
  const generate = vi.spyOn(provider, "generate");
  const generateStream = vi.spyOn(provider, "generateStream");
  const enterpriseAudit = { recordAudit: vi.fn(async () => {}) };
  registry.register(provider);
  return {
    generate,
    generateStream,
    enterpriseAudit,
    service: new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["real-test-provider"],
        fallbackEnabled: false,
        requireDurableUsageLedger: true,
      },
      requestLogger,
      enterpriseAudit,
    }),
  };
}

describe("GatewayService billable usage ledger gate", () => {
  it("cannot disable the ledger gate with a secondary runtime flag", async () => {
    const { service, generate } = buildBillableService({ requestLogger: null });
    service.runtimeConfig.requireDurableUsageLedger = false;

    const result = await service.execute({
      messages: [{ role: "user", content: "must remain metered" }],
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("USAGE_LEDGER_UNAVAILABLE");
    expect(generate).not.toHaveBeenCalled();
  });

  it("blocks before a billable adapter call when durable storage is unavailable", async () => {
    const requestLogger = {
      assertDurable: vi.fn(() => {
        const error = new Error("ledger unavailable");
        error.code = "USAGE_LEDGER_UNAVAILABLE";
        throw error;
      }),
      log: vi.fn(),
    };
    const { service, generate } = buildBillableService({ requestLogger });

    const result = await service.execute({
      messages: [{ role: "user", content: "must not spend" }],
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("USAGE_LEDGER_UNAVAILABLE");
    expect(generate).not.toHaveBeenCalled();
    expect(requestLogger.log).not.toHaveBeenCalled();
  });

  it("blocks before a billable adapter call when enterprise audit is unavailable", async () => {
    const requestLogger = {
      assertDurable: vi.fn(() => true),
      log: vi.fn(),
    };
    const { service, generate } = buildBillableService({ requestLogger });
    service.enterpriseAudit = null;

    const result = await service.execute({
      messages: [{ role: "user", content: "private prompt must not enter audit" }],
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("PROVIDER_AUDIT_UNAVAILABLE");
    expect(generate).not.toHaveBeenCalled();
    expect(requestLogger.log).not.toHaveBeenCalled();
  });

  it("blocks the adapter when the provider authorization audit cannot commit", async () => {
    const requestLogger = {
      assertDurable: vi.fn(() => true),
      log: vi.fn(),
    };
    const { service, generate, enterpriseAudit } = buildBillableService({ requestLogger });
    enterpriseAudit.recordAudit.mockRejectedValueOnce(new Error("audit disk failed"));

    const result = await service.execute({
      messages: [{ role: "user", content: "must not spend" }],
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("PROVIDER_AUDIT_WRITE_FAILED");
    expect(generate).not.toHaveBeenCalled();
    expect(requestLogger.log).not.toHaveBeenCalled();
  });

  it("does not report success when a completed billable call cannot be committed", async () => {
    let writeCount = 0;
    const requestLogger = {
      assertDurable: vi.fn(() => true),
      log: vi.fn(() => {
        writeCount += 1;
        if (writeCount === 1) return;
        const error = new Error("disk failed");
        error.code = "USAGE_LEDGER_WRITE_FAILED";
        throw error;
      }),
    };
    const { service, generate, enterpriseAudit } = buildBillableService({ requestLogger });

    const result = await service.execute({
      messages: [{ role: "user", content: "billable result" }],
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(requestLogger.log).toHaveBeenCalledTimes(2);
    expect(enterpriseAudit.recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "attempt-authorized",
      permission: "provider:execute",
      details: expect.objectContaining({
        providerId: "real-test-provider",
        modelId: "real-test-model",
        promptContentRecorded: false,
        credentialRecorded: false,
      }),
    }));
    expect(JSON.stringify(enterpriseAudit.recordAudit.mock.calls)).not.toContain("billable result");
    expect(enterpriseAudit.recordAudit.mock.invocationCallOrder[0])
      .toBeLessThan(generate.mock.invocationCallOrder[0]);
    expect(requestLogger.log.mock.calls[0][0]).toEqual(expect.objectContaining({
      usageEventType: "attempt-started",
      costSource: "pending-provider-attempt",
    }));
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("USAGE_LEDGER_WRITE_FAILED");
  });

  it("returns success only after the billable usage record commits", async () => {
    const requestLogger = {
      assertDurable: vi.fn(() => true),
      log: vi.fn(),
    };
    const { service, generate, enterpriseAudit } = buildBillableService({ requestLogger });

    const result = await service.execute({
      messages: [{ role: "user", content: "durably metered" }],
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(requestLogger.assertDurable).toHaveBeenCalledOnce();
    expect(requestLogger.log).toHaveBeenCalledTimes(2);
    expect(enterpriseAudit.recordAudit).toHaveBeenCalledOnce();
    expect(JSON.stringify(enterpriseAudit.recordAudit.mock.calls)).not.toContain("durably metered");
    expect(enterpriseAudit.recordAudit.mock.invocationCallOrder[0])
      .toBeLessThan(generate.mock.invocationCallOrder[0]);
    expect(requestLogger.log).toHaveBeenCalledWith(expect.objectContaining({
      provider: "real-test-provider",
      providerCallAttempted: true,
      billable: true,
      usageEventType: "attempt-completed",
    }));
    expect(result.success).toBe(true);
  });

  it("blocks a billable stream before its start event when the ledger is unavailable", async () => {
    const requestLogger = {
      assertDurable: vi.fn(() => {
        const error = new Error("ledger unavailable");
        error.code = "USAGE_LEDGER_UNAVAILABLE";
        throw error;
      }),
      log: vi.fn(),
    };
    const { service, generateStream } = buildBillableService({ requestLogger });
    const events = [];
    for await (const event of service.executeStream({
      messages: [{ role: "user", content: "must not stream" }],
    })) {
      events.push(event);
    }

    expect(generateStream).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect(events[0].envelope.error.code).toBe("USAGE_LEDGER_UNAVAILABLE");
  });

  it("terminates a completed billable stream with an error when its record cannot commit", async () => {
    let writeCount = 0;
    const requestLogger = {
      assertDurable: vi.fn(() => true),
      log: vi.fn(() => {
        writeCount += 1;
        if (writeCount === 1) return;
        const error = new Error("disk failed");
        error.code = "USAGE_LEDGER_WRITE_FAILED";
        throw error;
      }),
    };
    const { service, generateStream } = buildBillableService({ requestLogger });
    const events = [];
    for await (const event of service.executeStream({
      messages: [{ role: "user", content: "meter this stream" }],
    })) {
      events.push(event);
    }

    expect(generateStream).toHaveBeenCalledOnce();
    expect(events.some((event) => event.type === "chunk")).toBe(true);
    expect(events.some((event) => event.type === "done")).toBe(false);
    expect(events.at(-1)?.type).toBe("error");
    expect(events.at(-1)?.envelope?.error?.code).toBe("USAGE_LEDGER_WRITE_FAILED");
  });

  it("records every billable fallback attempt with a paired lifecycle", async () => {
    const registry = new ProviderRegistry({ enabledProviders: ["primary", "fallback"] });
    registry.register(createFakeProvider({
      providerId: "primary",
      modelId: "primary-model",
      providerType: "openai",
      priority: 1,
      capabilities: ["chat"],
      enabled: true,
      failMode: "retryable",
    }));
    registry.register(createFakeProvider({
      providerId: "fallback",
      modelId: "fallback-model",
      providerType: "openai",
      priority: 2,
      capabilities: ["chat"],
      enabled: true,
    }));
    const entries = [];
    const service = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["primary", "fallback"],
        fallbackEnabled: true,
        requireDurableUsageLedger: true,
      },
      requestLogger: {
        assertDurable: () => true,
        log: (entry) => entries.push(entry),
      },
      enterpriseAudit: { recordAudit: async () => {} },
    });

    const result = await service.execute({
      messages: [{ role: "user", content: "fallback accounting" }],
    });

    expect(result.success).toBe(true);
    expect(result.data.selectedProvider).toBe("fallback");
    expect(entries.map((entry) => [entry.provider, entry.usageEventType])).toEqual([
      ["primary", "attempt-started"],
      ["primary", "attempt-failed"],
      ["fallback", "attempt-started"],
      ["fallback", "attempt-completed"],
    ]);
    expect(entries[0].usageAttemptId).toBe(entries[1].usageAttemptId);
    expect(entries[2].usageAttemptId).toBe(entries[3].usageAttemptId);
    expect(entries[0].usageAttemptId).not.toBe(entries[2].usageAttemptId);
  });
});
