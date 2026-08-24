import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  createGatewayApplication,
  restoreRuntimeCredentialProviders,
} from "./createGatewayApplication.js";
import { setRuntimeProviderCredential } from "../http/utils/phaseModelUtils.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";

describe("gateway-application", () => {
  let app;

  beforeAll(() => {
    app = createGatewayApplication();
  });

  it("creates application with all services", () => {
    expect(app.gatewayService).toBeDefined();
    expect(app.knowledgeService).toBeDefined();
    expect(app.workflowService).toBeDefined();
    expect(app.workforceService).toBeDefined();
    expect(app.enterpriseGovernanceService).toBeDefined();
    expect(app.modelImportService).toBeDefined();
    expect(app.modelLibraryStore).toBeDefined();
    expect(app.providerConfigRoutes).toBeDefined();
    expect(app.runtimeCredentialStore).toBeDefined();
    expect(app.userExperienceService).toBeDefined();
    expect(app.capabilityRouterService).toBeDefined();
  });

  it("has correct config", () => {
    expect(app.config.aiGatewayService.endpoint.host).toBe("127.0.0.1");
    expect(app.config.aiGatewayService.endpoint.port).toBe(3100);
  });

  it("has provider registry with providers", () => {
    const providers = app.gatewayService.getProviderDescriptors();
    expect(providers.length).toBeGreaterThan(0);
  });

  it("has knowledge service ready", () => {
    const health = app.knowledgeService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has workflow service ready", () => {
    const health = app.workflowService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has workforce service ready", () => {
    const health = app.workforceService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has enterprise governance ready", () => {
    const health = app.enterpriseGovernanceService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("stores runtime credentials without enabling providers behind closed gates", () => {
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
    });
    const result = setRuntimeProviderCredential(application, {
      providerId: "openai",
      apiKey: "test-placeholder-runtime-key",
      modelId: "gpt-test",
    });

    expect(result.runtimeProviderEnabled).toBe(false);
    expect(result.runtimeProviderBlockers).toContain("provider-mode-not-real-capable");
    expect(application.providerRegistry.enabledProviders.has("openai")).toBe(false);
    expect(application.runtimeCredentialStore.has("openai")).toBe(true);
  });

  it("does not restore persisted providers behind closed gates", () => {
    const registry = new ProviderRegistry({ enabledProviders: ["local-fake-provider"] });
    registry.register(createFakeProvider({
      providerId: "real-test-provider",
      modelId: "real-test-model",
      providerType: "openai",
      capabilities: ["chat"],
      enabled: true,
    }));

    restoreRuntimeCredentialProviders({
      providerRegistry: registry,
      runtimeCredentialStore: {
        listRecords: () => [{ providerId: "real-test-provider", models: [] }],
      },
      runtimeConfig: {
        providerMode: "fake",
        realProviderEnabled: false,
        enabledProviders: ["real-test-provider"],
      },
    });

    expect(registry.enabledProviders.has("real-test-provider")).toBe(false);
  });

  it("blocks the direct NVIDIA client sink before fetch", async () => {
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
      NVIDIA_API_KEY: "test-placeholder-nvidia-key",
    });
    const fetchImpl = vi.fn();
    const client = createNvidiaUnifiedClient({
      env: application.runtimeEnv,
      runtimeCredentialStore: application.runtimeCredentialStore,
      modelLibraryStore: application.modelLibraryStore,
      runtimeConfig: application.gatewayService.runtimeConfig,
      fetchImpl,
    });
    const result = await client.chatCompletion({
      modelId: application.config.aiGatewayService.providerModels.find((item) => item.providerId === "nvidia")?.modelId,
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.code).toBe("real_provider_execution_blocked");
    expect(result.meta.providerCalled).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
