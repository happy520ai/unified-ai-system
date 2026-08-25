import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "./index.js";

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
});
