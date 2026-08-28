import { describe, expect, it, vi } from "vitest";
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
      enterpriseIdentity: { userId: "alice" },
    });
    expect(result.success).toBe(true);
  });

  it("denies a user without model access", async () => {
    const rbac = createAdvancedRBAC(); // bob has no role → no model:use
    const service = buildService({ modelAccessEnforce: true, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      enterpriseIdentity: { userId: "bob" },
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("MODEL_ACCESS_DENIED");
  });

  it("fails closed when enforcement has no server-authenticated identity", async () => {
    const rbac = createAdvancedRBAC();
    const service = buildService({ modelAccessEnforce: true, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("MODEL_ACCESS_IDENTITY_REQUIRED");
  });

  it("never accepts caller metadata as model-access identity", async () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("spoofed-admin", "api_user");
    const service = buildService({ modelAccessEnforce: true, governance: rbac });

    const result = await service.execute({
      messages: [{ role: "user", content: "hello" }],
      metadata: { userId: "spoofed-admin" },
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe("MODEL_ACCESS_IDENTITY_REQUIRED");
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

  it("enforces server identity before a streaming adapter is invoked", async () => {
    const registry = new ProviderRegistry();
    const provider = createFakeProvider({
      providerId: "local-fake-provider",
      modelId: "local-fake-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
    });
    const generateStream = vi.spyOn(provider, "generateStream");
    registry.register(provider);
    const service = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "fake",
        realProviderEnabled: false,
        fallbackEnabled: false,
        modelAccessEnforce: true,
      },
      governance: createAdvancedRBAC(),
    });

    const events = [];
    for await (const event of service.executeStream({
      messages: [{ role: "user", content: "hello" }],
      enterpriseIdentity: { userId: "denied-user" },
    })) {
      events.push(event);
    }
    expect(events.at(-1)).toMatchObject({
      type: "error",
      envelope: { code: "MODEL_ACCESS_DENIED" },
    });
    expect(generateStream).not.toHaveBeenCalled();
  });
});
