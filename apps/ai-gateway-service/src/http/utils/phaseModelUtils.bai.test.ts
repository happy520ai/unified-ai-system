import { describe, expect, it, vi } from "vitest";
import {
  normalizeRuntimeProviderEndpoint,
  setRuntimeProviderCredential,
} from "./phaseModelUtils.js";

function createApplication() {
  const set = vi.fn(() => ({
    providerId: "bai",
    apiKeyPresent: true,
    endpointConfigured: false,
    secretStorage: "memory-only",
    persisted: false,
  }));
  const enableProvider = vi.fn();
  return {
    runtimeCredentialStore: { set },
    providerRegistry: {
      get: vi.fn(() => ({
        descriptor: {
          metadata: { providerType: "openai-compatible" },
          models: [{
            id: "qwen3.8-flash",
            displayName: "Qwen 3.8 Flash",
            capabilities: ["chat", "reasoning", "coding", "summary"],
          }],
        },
      })),
      addRuntimeModels: vi.fn(() => []),
      enableProvider,
    },
    gatewayService: {
      runtimeConfig: {
        providerMode: "auto",
        realProviderEnabled: true,
        enabledProviders: ["bai"],
      },
    },
  };
}

describe("B.AI runtime endpoint policy", () => {
  it("uses the adapter's pinned endpoint when the credential payload omits one", () => {
    const application = createApplication();

    const result = setRuntimeProviderCredential(application, {
      providerId: "bai",
      apiKey: "test-bai-key",
    });

    expect(application.runtimeCredentialStore.set).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "bai",
        apiKey: "test-bai-key",
        endpoint: "",
      }),
    );
    expect(application.providerRegistry.enableProvider).toHaveBeenCalledWith("bai");
    expect(result.runtimeProviderEnabled).toBe(true);
  });

  it("canonicalizes the official endpoint", () => {
    expect(normalizeRuntimeProviderEndpoint("bai", "https://api.b.ai/v1/"))
      .toBe("https://api.b.ai/v1");
  });

  it("preserves catalog capabilities when selecting a known runtime model", () => {
    const application = createApplication();

    setRuntimeProviderCredential(application, {
      providerId: "bai",
      apiKey: "test-bai-key",
      modelId: "qwen3.8-flash",
    });

    expect(application.runtimeCredentialStore.set).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [{
          id: "qwen3.8-flash",
          displayName: "Qwen 3.8 Flash",
          capabilities: ["chat", "reasoning", "coding", "summary"],
          source: "runtime-credential-selected",
        }],
      }),
    );
  });

  it.each([
    "http://api.b.ai/v1",
    "https://api.b.ai/v1?redirect=https://example.com",
    "https://api.b.ai/v1#fragment",
    "https://user:pass@api.b.ai/v1",
    "https://api.b.ai.evil.example/v1",
    "https://example.com/v1",
  ])("rejects a non-official endpoint before storing the key: %s", (endpoint) => {
    const application = createApplication();

    expect(() => setRuntimeProviderCredential(application, {
      providerId: "bai",
      apiKey: "test-bai-key",
      endpoint,
    })).toThrow("pinned to its official HTTPS endpoint");
    expect(application.runtimeCredentialStore.set).not.toHaveBeenCalled();
  });

  it("does not change endpoint behavior for other providers", () => {
    expect(normalizeRuntimeProviderEndpoint("generic-openai-compatible", "https://example.com/v1"))
      .toBe("https://example.com/v1");
  });
});
