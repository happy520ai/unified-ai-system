import { describe, expect, it } from "vitest";

import { loadRuntimeConfig } from "@unified-ai-system/shared-config";
import { createPriorityProviderSelectionPolicy } from "../core/providerSelectionPolicy.js";
import { PROVIDER_PROBES } from "../model-import/providerProbeDefinitions.js";
import { createHttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";
import { PROVIDER_CATALOG } from "./providerCatalog.js";
import { ProviderRegistry } from "./providerRegistry.js";

const BAI_ENDPOINT = "https://api.b.ai/v1";

function createBaiConfig(overrides: Record<string, string> = {}) {
  return loadRuntimeConfig({
    AI_GATEWAY_PROVIDER_MODE: "auto",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    AI_GATEWAY_ENABLED_PROVIDERS: "bai",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_FALLBACK_ENABLED: "false",
    AI_GATEWAY_DEFAULT_PROVIDER: "bai",
    AI_GATEWAY_DEFAULT_MODEL: "qwen3.8-flash",
    BAI_API_KEY: "test-bai-key",
    BAI_MODEL: "qwen3.8-flash",
    ...overrides,
  });
}

describe("B.AI cross-layer integration", () => {
  it("keeps discovery, runtime generation, and account catalog endpoints aligned", () => {
    const config = createBaiConfig();
    const modelConfig = config.aiGatewayService.providerModels.find(
      (provider: { providerId: string }) => provider.providerId === "bai",
    );
    const catalog = PROVIDER_CATALOG.find((provider) => provider.providerId === "bai");
    if (!modelConfig || !catalog) throw new Error("B.AI provider configuration is missing");

    expect(modelConfig).toMatchObject({
      endpoint: BAI_ENDPOINT,
      fixedEndpoint: true,
      maxRetries: 1,
    });
    expect(PROVIDER_PROBES.bai).toMatchObject({
      baseUrl: BAI_ENDPOINT,
      modelsPath: "/models",
      fixedBaseUrl: true,
    });
    expect(catalog).toMatchObject({
      endpoint: BAI_ENDPOINT,
      modelListPath: "/models",
      accountScopedModels: true,
    });
    expect(new Set((modelConfig.models ?? []).map((model: { id: string }) => model.id))).toEqual(
      new Set(catalog.defaultModels.map((model) => model.modelId)),
    );
  });

  it("pins an explicitly selected model to one candidate with fallback disabled", () => {
    const config = createBaiConfig();
    const modelConfig = config.aiGatewayService.providerModels.find(
      (provider: { providerId: string }) => provider.providerId === "bai",
    );
    if (!modelConfig) throw new Error("B.AI provider configuration is missing");
    const registry = new ProviderRegistry({
      enabledProviders: config.aiGatewayService.providerSelection.enabledProviders as never[],
      selectionPolicy: createPriorityProviderSelectionPolicy(
        config.aiGatewayService.providerSelection,
      ),
    });
    registry.register(createHttpLLMProviderAdapter(modelConfig));

    const descriptor = registry.get("bai").descriptor;
    const selection = registry.select({ taskType: "chat" });

    expect(config.aiGatewayService.fallbackEnabled).toBe(false);
    expect(config.aiGatewayService.providerSelection.mode).toBe("fixed");
    expect(descriptor.models.filter((model: { enabled: boolean }) => model.enabled)
      .map((model: { id: string }) => model.id)).toEqual(["qwen3.8-flash"]);
    expect(selection.selected.target).toEqual({
      providerId: "bai",
      modelId: "qwen3.8-flash",
    });
    expect(selection.candidates).toHaveLength(1);
  });

  it("keeps static candidates non-routable until a model is explicitly selected", () => {
    const config = createBaiConfig({ BAI_MODEL: "" });
    const modelConfig = config.aiGatewayService.providerModels.find(
      (provider: { providerId: string }) => provider.providerId === "bai",
    );
    if (!modelConfig) throw new Error("B.AI provider configuration is missing");
    const adapter = createHttpLLMProviderAdapter({ ...modelConfig, enabled: true });

    expect(modelConfig.enabled).toBe(false);
    expect(adapter.descriptor.models.every((model: { enabled: boolean }) => !model.enabled))
      .toBe(true);
  });
});
