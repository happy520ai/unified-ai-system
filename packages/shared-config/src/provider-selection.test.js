import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  shouldEnableMimoProvider,
  shouldEnableNvidiaProvider,
  shouldEnableOpenAiProvider,
} from "./provider-selection.js";

describe("provider-selection — OpenAI", () => {
  it("is disabled when real providers are off", () => {
    assert.equal(
      shouldEnableOpenAiProvider({ providerMode: "real", realProviderEnabled: false, openAiApiKeyPresent: true, requestedEnabledProviders: ["openai"] }),
      false,
    );
  });

  it("requires an API key and an explicit request", () => {
    assert.equal(
      shouldEnableOpenAiProvider({ providerMode: "real", realProviderEnabled: true, openAiApiKeyPresent: false, requestedEnabledProviders: ["openai"] }),
      false,
    );
    assert.equal(
      shouldEnableOpenAiProvider({ providerMode: "real", realProviderEnabled: true, openAiApiKeyPresent: true, requestedEnabledProviders: [] }),
      false,
    );
    assert.equal(
      shouldEnableOpenAiProvider({ providerMode: "real", realProviderEnabled: true, openAiApiKeyPresent: true, requestedEnabledProviders: ["openai"] }),
      true,
    );
  });
});

describe("provider-selection — Nvidia", () => {
  it("enables in real mode without a key requirement", () => {
    assert.equal(
      shouldEnableNvidiaProvider({ providerMode: "real", realProviderEnabled: true, nvidiaApiKeyPresent: false, requestedEnabledProviders: [] }),
      true,
    );
  });

  it("requires a key in auto mode", () => {
    assert.equal(
      shouldEnableNvidiaProvider({ providerMode: "auto", realProviderEnabled: true, nvidiaApiKeyPresent: false, requestedEnabledProviders: [] }),
      false,
    );
    assert.equal(
      shouldEnableNvidiaProvider({ providerMode: "auto", realProviderEnabled: true, nvidiaApiKeyPresent: true, requestedEnabledProviders: [] }),
      true,
    );
  });
});

describe("provider-selection — Mimo", () => {
  it("requires a key and explicit request", () => {
    assert.equal(
      shouldEnableMimoProvider({ providerMode: "real", realProviderEnabled: true, mimoApiKeyPresent: true, requestedEnabledProviders: [] }),
      false,
    );
    assert.equal(
      shouldEnableMimoProvider({ providerMode: "real", realProviderEnabled: true, mimoApiKeyPresent: true, requestedEnabledProviders: ["mimo"] }),
      true,
    );
    assert.equal(
      shouldEnableMimoProvider({ providerMode: "real", realProviderEnabled: true, mimoApiKeyPresent: false, requestedEnabledProviders: ["mimo"] }),
      false,
    );
  });
});
