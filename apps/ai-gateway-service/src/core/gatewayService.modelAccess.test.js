import { describe, expect, it } from "vitest";
import { GatewayService } from "./gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createAdvancedRBAC } from "../enterprise/advancedRBAC.js";

function buildService({ modelAccessEnforce = false, governance } = {}) {
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
      modelAccessEnforce,
    },
    governance,
  });
}

describe("GatewayService model access guard", () => {
  it("allows a user with model:use permission", async () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("alice", "api_user"); // has model:use
    const service = buildService({ modelAccessEnforce: true, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      metadata: { userId: "alice" },
    });
    expect(result.success).toBe(true);
  });

  it("denies a user without model access", async () => {
    const rbac = createAdvancedRBAC(); // bob has no role → no model:use
    const service = buildService({ modelAccessEnforce: true, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      metadata: { userId: "bob" },
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("MODEL_ACCESS_DENIED");
  });

  it("skips the check when no identity is present", async () => {
    const rbac = createAdvancedRBAC();
    const service = buildService({ modelAccessEnforce: true, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }], // no metadata.userId
    });
    expect(result.success).toBe(true);
  });

  it("does not enforce when the flag is off", async () => {
    const rbac = createAdvancedRBAC();
    const service = buildService({ modelAccessEnforce: false, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      metadata: { userId: "nobody" },
    });
    expect(result.success).toBe(true);
  });
});
