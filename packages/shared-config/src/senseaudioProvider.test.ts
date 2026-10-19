import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "./index.js";

type RuntimeConfig = ReturnType<typeof loadRuntimeConfig>;
type ProviderEntry = RuntimeConfig["aiGatewayService"]["providerModels"][number];

function SENSEAUDIO(config: RuntimeConfig): ProviderEntry {
  const found = config.aiGatewayService.providerModels.find((p: ProviderEntry) => p.providerId === "senseaudio");
  assert.ok(found, "senseaudio must be present in the provider catalog");
  return found;
}

describe("loadRuntimeConfig — SenseAudio provider and credential pool", () => {
  it("keeps SenseAudio disabled by default", () => {
    const provider = SENSEAUDIO(loadRuntimeConfig({}));
    assert.equal(provider.enabled, false);
    assert.equal(provider.credentialPool, false);
  });

  it("stays disabled when the real-provider switch is off", () => {
    const provider = SENSEAUDIO(loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_ENABLED_PROVIDERS: "senseaudio",
      SENSEAUDIO_MODEL: "glm-5.3-flash",
      SENSEAUDIO_POOL_ENABLED: "true",
      // AI_GATEWAY_REAL_PROVIDER_ENABLED intentionally absent
    }));
    assert.equal(provider.enabled, false);
  });

  it("stays disabled when the provider is not in the enabled list", () => {
    const provider = SENSEAUDIO(loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      SENSEAUDIO_MODEL: "glm-5.3-flash",
      SENSEAUDIO_POOL_ENABLED: "true",
      // AI_GATEWAY_ENABLED_PROVIDERS intentionally absent
    }));
    assert.equal(provider.enabled, false);
  });

  it("enables with a single key and pins the endpoint", () => {
    const provider = SENSEAUDIO(loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_ENABLED_PROVIDERS: "senseaudio",
      SENSEAUDIO_API_KEY: "sk-test",
      SENSEAUDIO_MODEL: "glm-5.3-flash",
    }));
    assert.equal(provider.enabled, true);
    assert.equal(provider.modelId, "glm-5.3-flash");
    assert.equal(provider.apiKeyPresent, true);
    // The destination is deliberately fixed so an env var cannot redirect keys.
    assert.equal(provider.endpoint, "https://api.senseaudio.cn/v1");
  });

  it("enables from the pool alone, with no single key present", () => {
    const provider = SENSEAUDIO(loadRuntimeConfig({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_ENABLED_PROVIDERS: "senseaudio",
      SENSEAUDIO_POOL_ENABLED: "true",
      SENSEAUDIO_MODEL: "glm-5.3-flash",
    }));
    assert.equal(provider.enabled, true);
    assert.equal(provider.credentialPool, true);
    assert.equal(provider.apiKeyPresent, false);
  });
});
