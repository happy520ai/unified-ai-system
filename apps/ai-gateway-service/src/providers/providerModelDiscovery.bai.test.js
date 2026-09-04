import { describe, expect, it } from "vitest";

import { discoverModels, matchProviderFamilies } from "./providerModelDiscovery.js";
import { PROVIDER_CATALOG } from "./providerCatalog.js";

const OPENAI_STYLE_PREFIX = `${"s"}${"k"}-`;

describe("B.AI provider detection", () => {
  it("does not upgrade random bai characters inside an ambiguous key to a unique match", () => {
    const matches = matchProviderFamilies(`${OPENAI_STYLE_PREFIX}example-token-containing-bai-marker`);
    const bai = matches.find((match) => match.family.providerId === "bai");

    expect(bai).toMatchObject({
      prefix: { value: OPENAI_STYLE_PREFIX, unique: false, confidence: "ambiguous" },
    });
  });

  it("recognizes explicit B.AI endpoint context", () => {
    const matches = matchProviderFamilies(
      `B.AI endpoint https://api.b.ai/v1 with ${OPENAI_STYLE_PREFIX}placeholder-token`,
    );

    expect(matches.map((match) => match.family.providerId)).toEqual(["bai"]);
  });

  it("honors an explicit B.AI provider choice without inspecting key text", () => {
    const matches = matchProviderFamilies("opaque-placeholder", "bai");

    expect(matches).toEqual([
      expect.objectContaining({
        family: expect.objectContaining({ providerId: "bai" }),
        prefix: expect.objectContaining({
          value: "manual-provider-choice",
          unique: true,
        }),
      }),
    ]);
  });

  it("does not let a bulk-probe flag override an ambiguous credential match", async () => {
    const family = PROVIDER_CATALOG.find((entry) => entry.providerId === "bai");

    await expect(discoverModels(family, {
      apiKey: `${OPENAI_STYLE_PREFIX}placeholder-token`,
      matchedPrefix: { value: OPENAI_STYLE_PREFIX, unique: false, confidence: "ambiguous" },
      preferredProviderId: "",
      endpoint: "https://api.b.ai/v1",
      allowModelListProbe: true,
    })).resolves.toMatchObject({
      status: "not-run-ambiguous-key",
      networkProbePerformed: false,
    });
  });

  it.each([429, 500])("fails closed on B.AI model-list HTTP %s", async (statusCode) => {
    const family = PROVIDER_CATALOG.find((entry) => entry.providerId === "bai");

    await expect(discoverModels(family, {
      apiKey: "opaque-placeholder",
      matchedPrefix: { value: "manual-provider-choice", unique: true, confidence: "manual" },
      preferredProviderId: "bai",
      endpoint: "https://api.b.ai/v1",
      allowModelListProbe: true,
      fetchImpl: async () => ({ ok: false, statusCode, body: {} }),
    })).resolves.toMatchObject({
      status: "not-ready-catalog-fallback",
      networkProbePerformed: true,
      models: [],
    });
  });

  it("fails closed when the B.AI model-list request throws", async () => {
    const family = PROVIDER_CATALOG.find((entry) => entry.providerId === "bai");

    await expect(discoverModels(family, {
      apiKey: "opaque-placeholder",
      matchedPrefix: { value: "manual-provider-choice", unique: true, confidence: "manual" },
      preferredProviderId: "bai",
      endpoint: "https://api.b.ai/v1",
      allowModelListProbe: true,
      fetchImpl: async () => { throw new Error("timeout"); },
    })).resolves.toMatchObject({
      status: "probe-failed",
      networkProbePerformed: true,
      models: [],
    });
  });
});
