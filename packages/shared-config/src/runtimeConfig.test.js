import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSafeRuntimeConfig, loadRuntimeConfig } from "./index.js";

describe("loadRuntimeConfig — safe defaults", () => {
  it("defaults to fake provider with real calls disabled", () => {
    const config = loadRuntimeConfig({});
    assert.equal(config.aiGatewayService.providerMode, "fake");
    assert.equal(config.aiGatewayService.realProviderEnabled, false);
  });

  it("explicitly opts in to a real provider when configured", () => {
    const config = loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      NVIDIA_API_KEY: "test-key",
      AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
    });
    assert.equal(config.aiGatewayService.providerMode, "real");
    assert.equal(config.aiGatewayService.realProviderEnabled, true);
  });

  it("falls back to fake mode on an invalid provider mode", () => {
    const config = loadRuntimeConfig({ AI_GATEWAY_PROVIDER_MODE: "bogus" });
    assert.equal(config.aiGatewayService.providerMode, "fake");
  });

  it("does not enable a real provider without its API key", () => {
    const config = loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      // no OPENAI_API_KEY / NVIDIA_API_KEY
    });
    const openAiModel = config.aiGatewayService.providerModels.find((p) => p.providerId === "openai");
    assert.equal(openAiModel.enabled, false);
  });

  it("uses the current official Xiaomi MiMo endpoint and model when explicitly enabled", () => {
    const config = loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_ENABLED_PROVIDERS: "mimo",
      AI_GATEWAY_DEFAULT_PROVIDER: "mimo",
      MIMO_API_KEY: "test-mimo-key",
    });
    const mimo = config.aiGatewayService.providerModels.find((provider) => provider.providerId === "mimo");
    assert.equal(mimo.enabled, true);
    assert.equal(mimo.modelId, "mimo-v2.5-pro");
    assert.equal(mimo.endpoint, "https://api.xiaomimimo.com/v1");
  });

  it("keeps B.AI disabled by default with a fixed endpoint", () => {
    const config = loadRuntimeConfig({});
    const bai = config.aiGatewayService.providerModels.find((provider) => provider.providerId === "bai");
    assert.equal(bai.enabled, false);
    assert.equal(bai.modelId, "qwen3.8-flash");
    assert.equal(bai.endpoint, "https://api.b.ai/v1");
    assert.equal(bai.fixedEndpoint, true);
    assert.deepEqual(bai.models.map((model) => model.id), [
      "deepseek-v4-flash",
      "deepseek-v4-flash-vision-exp",
      "hy3",
      "mimo-v2.5",
      "glm-5.3-flash",
      "qwen3.8-flash",
    ]);
  });

  it("does not enable B.AI when the provider allowlist gate is missing", () => {
    const config = loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      BAI_API_KEY: "test-bai-key-not-a-real-secret",
      BAI_MODEL: "qwen3.8-flash",
    });
    const bai = config.aiGatewayService.providerModels.find((provider) => provider.providerId === "bai");
    assert.equal(bai.enabled, false);
  });

  it("keeps B.AI disabled when any other real-provider gate is missing", () => {
    const cases = [
      {
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "bai",
        BAI_API_KEY: "test-bai-key-not-a-real-secret",
        BAI_MODEL: "qwen3.8-flash",
      },
      {
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        AI_GATEWAY_ENABLED_PROVIDERS: "bai",
        BAI_API_KEY: "test-bai-key-not-a-real-secret",
        BAI_MODEL: "qwen3.8-flash",
      },
      {
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "bai",
        BAI_MODEL: "qwen3.8-flash",
      },
      {
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "bai",
        BAI_API_KEY: "test-bai-key-not-a-real-secret",
      },
    ];
    for (const env of cases) {
      const config = loadRuntimeConfig(env);
      const bai = config.aiGatewayService.providerModels.find((provider) => provider.providerId === "bai");
      assert.equal(bai.enabled, false);
    }
  });

  it("enables B.AI only when real mode, the real switch, allowlist, and key all agree", () => {
    for (const providerMode of ["real", "auto"]) {
      const config = loadRuntimeConfig({
        AI_GATEWAY_PROVIDER_MODE: providerMode,
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "bai",
        BAI_API_KEY: "test-bai-key-not-a-real-secret",
        BAI_MODEL: "qwen3.8-flash",
      });
      const bai = config.aiGatewayService.providerModels.find((provider) => provider.providerId === "bai");
      assert.equal(bai.enabled, true);
    }
  });

  it("allows a B.AI model override without allowing a base URL override", () => {
    const config = loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_ENABLED_PROVIDERS: "bai",
      BAI_API_KEY: "test-bai-key-not-a-real-secret",
      BAI_MODEL: "gpt-5.2",
      BAI_BASE_URL: "https://attacker.invalid/v1",
    });
    const bai = config.aiGatewayService.providerModels.find((provider) => provider.providerId === "bai");
    assert.equal(bai.modelId, "gpt-5.2");
    assert.equal(bai.modelDisplayName, "gpt-5.2");
    assert.equal(bai.endpoint, "https://api.b.ai/v1");
  });

  it("redacts the B.AI key from safe runtime configuration", () => {
    const secret = "test-bai-key-not-a-real-secret";
    const safe = getSafeRuntimeConfig(loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_ENABLED_PROVIDERS: "bai",
      BAI_API_KEY: secret,
      BAI_MODEL: "qwen3.8-flash",
    }));
    const serialized = JSON.stringify(safe);
    const bai = safe.aiGatewayService.providerModels.find((provider) => provider.providerId === "bai");
    assert.equal(serialized.includes(secret), false);
    assert.equal(bai.apiKeyPresent, true);
    assert.equal(bai.hasEndpoint, true);
    assert.equal("apiKey" in bai, false);
  });

  it("does not duplicate default providers requested through the extra-provider extension", () => {
    const config = loadRuntimeConfig({
      AI_GATEWAY_EXTRA_PROVIDERS: "bai,bai,groq,google,google",
    });
    const providerIds = config.aiGatewayService.providerModels.map((provider) => provider.providerId);
    assert.equal(providerIds.filter((providerId) => providerId === "bai").length, 1);
    assert.equal(providerIds.filter((providerId) => providerId === "groq").length, 1);
    assert.equal(providerIds.filter((providerId) => providerId === "google").length, 1);
  });
});
