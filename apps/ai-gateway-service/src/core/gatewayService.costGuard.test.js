import { describe, expect, it } from "vitest";
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
});
