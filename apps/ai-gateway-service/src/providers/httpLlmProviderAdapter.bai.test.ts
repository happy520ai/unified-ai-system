import { describe, expect, it } from "vitest";

import { createHttpLLMProviderAdapter } from "./httpLlmProviderAdapter.js";

describe("B.AI OpenAI-compatible adapter catalog", () => {
  it("exposes each configured B.AI model through one provider adapter", () => {
    const adapter = createHttpLLMProviderAdapter({
      providerId: "bai",
      providerType: "openai-compatible",
      providerDisplayName: "B.AI",
      modelId: "qwen3.8-flash",
      modelDisplayName: "Qwen 3.8 Flash",
      enabled: true,
      priority: 97,
      capabilities: ["chat", "summary"],
      endpoint: "https://api.b.ai/v1",
      fixedEndpoint: true,
      maxRetries: 1,
      staticModelsRequireExplicitSelection: true,
      modelSelectionExplicit: true,
      models: [
        {
          id: "deepseek-v4-flash",
          displayName: "DeepSeek V4 Flash",
          capabilities: ["chat", "reasoning", "coding", "summary"],
        },
        {
          id: "qwen3.8-flash",
          displayName: "Qwen 3.8 Flash",
          capabilities: ["chat", "reasoning", "coding", "summary"],
        },
        {
          id: "qwen3.8-flash",
          displayName: "Duplicate",
          capabilities: ["chat"],
        },
      ],
    }, {
      runtimeCredentialStore: {
        getApiKey: () => "test-bai-key",
        getEndpoint: () => "https://attacker.example/v1",
        has: () => true,
      },
    });

    expect(adapter.descriptor).toMatchObject({
      id: "bai",
      displayName: "B.AI",
      metadata: {
        endpointConfigured: true,
        apiKeyPresent: true,
        runtimeCredentialPresent: true,
      },
      models: [
        {
          id: "deepseek-v4-flash",
          capabilities: ["chat", "reasoning", "coding", "summary"],
          enabled: false,
          metadata: { staticProviderModel: true, observedUnverified: true },
        },
        {
          id: "qwen3.8-flash",
          capabilities: ["chat", "reasoning", "coding", "summary"],
          enabled: true,
          metadata: {
            staticProviderModel: true,
            configuredDefaultModel: true,
            observedUnverified: true,
          },
        },
      ],
    });
    expect(adapter.resolveBaseUrl()).toBe("https://api.b.ai/v1");
    expect(adapter.resolveRetryConfig().maxRetries).toBe(1);
  });

  it("keeps an operator-selected default model even when it is outside the static candidates", () => {
    const adapter = createHttpLLMProviderAdapter({
      providerId: "bai",
      providerType: "openai-compatible",
      modelId: "gpt-5.2",
      modelDisplayName: "gpt-5.2",
      enabled: true,
      priority: 97,
      capabilities: ["chat", "summary"],
      endpoint: "https://api.b.ai/v1",
      fixedEndpoint: true,
      maxRetries: 1,
      staticModelsRequireExplicitSelection: true,
      modelSelectionExplicit: true,
      models: [{
        id: "qwen3.8-flash",
        displayName: "Qwen 3.8 Flash",
        capabilities: ["chat", "reasoning", "coding", "summary"],
      }],
    });

    expect(adapter.descriptor.models.map((model: { id: string }) => model.id)).toEqual([
      "gpt-5.2",
      "qwen3.8-flash",
    ]);
    expect(adapter.descriptor.models[0].metadata).toMatchObject({
      staticProviderModel: false,
      configuredDefaultModel: true,
    });
  });
});
