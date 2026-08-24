import { describe, expect, it, vi } from "vitest";
import { GatewayService } from "./gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

function buildService({ costGuardEnforce = false } = {}) {
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
    runtimeConfig: {
      providerMode: "fake",
      realProviderEnabled: false,
      fallbackEnabled: false,
      costGuardEnforce,
    },
  });
}

describe("GatewayService cost guard enforcement", () => {
  it("does not enforce the cost guard by default", async () => {
    const service = buildService();
    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      options: { maxOutputTokens: 99999 }, // would exceed budget, but guard is off
    });
    expect(result.success).toBe(true);
  });

  it("blocks an over-budget request when enforcement is on", async () => {
    const service = buildService({ costGuardEnforce: true });
    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      options: { maxOutputTokens: 99999 },
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("COST_GUARD_BLOCKED");
  });

  it("allows an in-budget request when enforcement is on", async () => {
    const service = buildService({ costGuardEnforce: true });
    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      options: { maxOutputTokens: 100 },
    });
    expect(result.success).toBe(true);
  });

  it("enforces the cost guard on streaming requests", async () => {
    const service = buildService({ costGuardEnforce: true });
    const events = [];
    for await (const event of service.executeStream({
      messages: [{ role: "user", content: "hello" }],
      options: { maxOutputTokens: 99999 },
    })) {
      events.push(event);
    }
    expect(events.at(-1)?.envelope?.error?.code).toBe("COST_GUARD_BLOCKED");
  });
});

function buildRealProviderService(runtimeConfig) {
  const registry = new ProviderRegistry({ enabledProviders: ["real-test-provider"] });
  const provider = createFakeProvider({
    providerId: "real-test-provider",
    modelId: "real-test-model",
    providerType: "openai",
    capabilities: ["chat"],
    enabled: true,
  });
  const generate = vi.spyOn(provider, "generate");
  const generateStream = vi.spyOn(provider, "generateStream");
  registry.register(provider);
  return {
    generate,
    generateStream,
    service: new GatewayService({
      providerRegistry: registry,
      runtimeConfig,
      requestLogger: { assertDurable: () => true, log: () => {} },
    }),
  };
}

describe("GatewayService real provider execution gate", () => {
  it("blocks before a real adapter is invoked", async () => {
    const { service, generate } = buildRealProviderService({
      providerMode: "fake",
      realProviderEnabled: false,
      enabledProviders: ["real-test-provider"],
      fallbackEnabled: false,
    });
    const result = await service.execute({
      taskType: "chat",
      providerId: "real-test-provider",
      modelId: "real-test-model",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe("REAL_PROVIDER_EXECUTION_BLOCKED");
    expect(generate).not.toHaveBeenCalled();
  });

  it("allows calls only when all three gates pass", async () => {
    const { service, generate } = buildRealProviderService({
      providerMode: "real",
      realProviderEnabled: true,
      enabledProviders: ["real-test-provider"],
      fallbackEnabled: false,
    });
    const result = await service.execute({
      taskType: "chat",
      providerId: "real-test-provider",
      modelId: "real-test-model",
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.success).toBe(true);
    expect(generate).toHaveBeenCalledOnce();
  });

  it("blocks streaming before a real adapter is invoked", async () => {
    const { service, generateStream } = buildRealProviderService({
      providerMode: "fake",
      realProviderEnabled: false,
      enabledProviders: ["real-test-provider"],
      fallbackEnabled: false,
    });
    const events = [];
    for await (const event of service.executeStream({
      taskType: "chat",
      providerId: "real-test-provider",
      modelId: "real-test-model",
      messages: [{ role: "user", content: "test" }],
    })) {
      events.push(event);
    }

    expect(events.at(-1)?.envelope?.error?.code).toBe("REAL_PROVIDER_EXECUTION_BLOCKED");
    expect(generateStream).not.toHaveBeenCalled();
  });
});
