import { describe, expect, it } from "vitest";
import {
  CAPABILITY_ORDER,
  CHAT_EXCLUSIVE_BLOCKERS,
  PROVIDER_CATALOG,
} from "./providerCatalog.js";

// Catalog metadata describes recognition candidates; runtime support still requires discovery or smoke evidence.
const catalogByProvider = new Map(PROVIDER_CATALOG.map((entry) => [entry.providerId, entry]));

const representativeEntries = [
  {
    providerId: "local-fake-provider",
    modelId: "local-fake-model",
    availableForChat: true,
    testOnly: true,
    capabilities: ["chat", "summary"],
  },
  {
    providerId: "openai",
    modelId: "gpt-4o",
    availableForChat: true,
    testOnly: false,
    capabilities: ["chat", "vision", "reasoning", "tool-use", "structured-output", "summary"],
  },
  {
    providerId: "cloudflare-workers-ai",
    modelId: "@cf/meta/llama-3.1-8b-instruct",
    availableForChat: false,
    testOnly: false,
    capabilities: ["chat", "summary"],
  },
  {
    providerId: "anthropic",
    modelId: "claude-sonnet-4.5",
    availableForChat: false,
    testOnly: false,
    capabilities: ["chat", "vision", "coding", "reasoning", "tool-use", "summary"],
  },
];

describe("provider catalog metadata", () => {
  it("defines unique provider and per-provider model identifiers", () => {
    const providerIds = PROVIDER_CATALOG.map((entry) => entry.providerId);

    expect(new Set(providerIds).size).toBe(providerIds.length);

    for (const entry of PROVIDER_CATALOG) {
      expect(entry.family).toEqual(expect.any(String));
      expect(entry.providerId).toEqual(expect.any(String));
      expect(entry.providerId.trim()).toBe(entry.providerId);
      expect(entry.displayName).toEqual(expect.any(String));
      expect(typeof entry.availableForChat).toBe("boolean");
      expect(entry.defaultModels.length).toBeGreaterThan(0);

      const modelIds = entry.defaultModels.map((model) => model.modelId);
      expect(new Set(modelIds).size).toBe(modelIds.length);
    }
  });

  it("keeps every model capability canonical and non-empty", () => {
    for (const entry of PROVIDER_CATALOG) {
      for (const model of entry.defaultModels) {
        expect(model.modelId).toEqual(expect.any(String));
        expect(model.modelId.trim()).toBe(model.modelId);
        expect(model.modelDisplayName).toEqual(expect.any(String));
        expect(Array.isArray(model.capabilities)).toBe(true);
        expect(model.capabilities.length).toBeGreaterThan(0);
        expect(new Set(model.capabilities).size).toBe(model.capabilities.length);

        for (const capability of model.capabilities) {
          expect(CAPABILITY_ORDER).toContain(capability);
        }
      }
    }
  });

  it("does not advertise exclusive non-chat capabilities as chat support", () => {
    for (const entry of PROVIDER_CATALOG) {
      for (const model of entry.defaultModels) {
        if (!model.capabilities.includes("chat")) continue;

        const exclusiveCapabilities = model.capabilities.filter((capability) =>
          CHAT_EXCLUSIVE_BLOCKERS.has(capability),
        );
        expect(exclusiveCapabilities).toEqual([]);
      }
    }
  });

  it.each(representativeEntries)(
    "keeps explicit metadata for $providerId/$modelId",
    ({ providerId, modelId, availableForChat, testOnly, capabilities }) => {
      const provider = catalogByProvider.get(providerId);
      const model = provider?.defaultModels.find((entry) => entry.modelId === modelId);

      expect(provider).toBeDefined();
      expect(model).toBeDefined();
      expect(provider.availableForChat).toBe(availableForChat);
      expect(provider.testOnly ?? false).toBe(testOnly);
      expect(model.capabilities).toEqual(capabilities);
    },
  );
});
