import { describe, expect, it, vi } from "vitest";

import { createProviderKeyConfigStore } from "./providerKeyConfigStore.js";

describe("provider key configuration test lane", () => {
  it("routes B.AI away from the legacy provider save path before retaining its key", () => {
    const set = vi.fn();
    const store = createProviderKeyConfigStore({
      env: { AI_GATEWAY_PROVIDER_CONFIG_ALLOWED_PROVIDERS: "bai" },
      runtimeCredentialStore: { set },
    });

    expect(() => store.save({
      providerId: "bai",
      apiKey: "test-bai-key",
      baseUrl: "https://attacker.example/v1",
    })).toThrow(expect.objectContaining({
      code: "provider_runtime_credential_route_required",
      statusCode: 422,
    }));
    expect(set).not.toHaveBeenCalled();
  });

  it("uses GatewayService governance instead of constructing a direct provider client", async () => {
    const recordProviderTest = vi.fn();
    const store = createProviderKeyConfigStore({
      env: { NVIDIA_MODEL: "nvidia/test-model" },
      modelLibraryStore: { recordProviderTest },
    });
    const gatewayService = {
      execute: vi.fn(async () => ({
        success: true,
        data: {
          message: { role: "assistant", content: "phase312a-provider-key-ok" },
          executionMode: "real",
          usage: { totalTokens: 2 },
        },
        meta: { requestId: "provider-test-1" },
      })),
    };

    await expect(store.test({}, gatewayService)).resolves.toMatchObject({
      success: true,
      providerId: "nvidia",
      modelId: "nvidia/test-model",
      realExternalCall: true,
      secretValueVisible: false,
    });
    expect(gatewayService.execute).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "nvidia",
      modelId: "nvidia/test-model",
      metadata: expect.objectContaining({ source: "phase312a-governed-gateway" }),
    }));
    expect(recordProviderTest).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "nvidia",
      success: true,
      realExternalCall: true,
    }));
  });

  it("fails closed when no governed gateway is supplied", async () => {
    const store = createProviderKeyConfigStore({ env: {} });
    await expect(store.test({ modelId: "nvidia/test-model" })).resolves.toMatchObject({
      success: false,
      code: "provider_test_governed_gateway_required",
      realExternalCall: false,
    });
  });
});
