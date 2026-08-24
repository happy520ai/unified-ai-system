import { describe, expect, it } from "vitest";
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
