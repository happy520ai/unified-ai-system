import { describe, expect, it, vi } from "vitest";

import { createModelImportService } from "./modelImportService.js";
import {
  listModelImportProviders,
  probeProviderModels,
  resolveProviderCandidates,
} from "./providerProbeRegistry.js";

const OPENAI_STYLE_PREFIX = `${"s"}${"k"}-`;
const PLACEHOLDER_KEY = `${OPENAI_STYLE_PREFIX}test-placeholder-not-a-real-secret`;
const BAI_BASE_URL = "https://api.b.ai/v1";

function createModelsResponse() {
  return new Response(JSON.stringify({
    data: [
      { id: "deepseek-v4-flash", owned_by: "bai" },
      { id: "deepseek-v4-flash-vision-exp", owned_by: "bai" },
    ],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("B.AI provider model probe", () => {
  it("does not fan an ambiguous sk credential out to unrelated providers", async () => {
    const fetchImpl = vi.fn();
    const candidates = resolveProviderCandidates({ apiKey: PLACEHOLDER_KEY });
    const service = createModelImportService({ fetchImpl });

    expect(candidates).toEqual([]);
    await expect(service.preview({ apiKey: PLACEHOLDER_KEY })).resolves.toMatchObject({
      success: false,
      status: "needs_provider_selection",
      reason: "api_key_prefix_unknown_choose_provider_or_base_url",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("publishes a fixed OpenAI-compatible provider definition", () => {
    const provider = listModelImportProviders().find((item) => item.providerId === "bai");

    expect(provider).toMatchObject({
      providerId: "bai",
      displayName: "B.AI",
      providerGroup: "openai-compatible",
      baseUrl: BAI_BASE_URL,
      modelsPath: "/models",
      auth: "bearer",
      requiresBaseUrl: false,
    });
  });

  it("ignores a caller base URL override when resolving an explicit bai candidate", () => {
    const candidates = resolveProviderCandidates({
      apiKey: PLACEHOLDER_KEY,
      providerHint: "bai",
      baseUrl: "https://attacker.example/v1",
    });

    expect(candidates).toEqual([expect.objectContaining({
      providerId: "bai",
      baseUrl: BAI_BASE_URL,
    })]);
  });

  it("maps the exact official B.AI base URL to the independent provider identity", () => {
    expect(resolveProviderCandidates({
      apiKey: PLACEHOLDER_KEY,
      baseUrl: `${BAI_BASE_URL}/`,
    })).toEqual([expect.objectContaining({
      providerId: "bai",
      baseUrl: BAI_BASE_URL,
    })]);

    expect(resolveProviderCandidates({
      apiKey: PLACEHOLDER_KEY,
      baseUrl: "https://compatible.example/v1",
    })).toEqual([expect.objectContaining({
      providerId: "openai-compatible",
      baseUrl: "https://compatible.example/v1",
    })]);
  });

  it("sends the bearer credential only to the fixed B.AI models endpoint", async () => {
    const fetchImpl = vi.fn(async () => createModelsResponse());
    const candidate = {
      providerId: "bai",
      baseUrl: "https://attacker.example/v1",
    };

    const result = await probeProviderModels({
      candidate,
      apiKey: PLACEHOLDER_KEY,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${BAI_BASE_URL}/models`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: `Bearer ${PLACEHOLDER_KEY}`,
        }),
      }),
    );
    expect(fetchImpl.mock.calls[0][0]).not.toContain("attacker.example");
    expect(result).toMatchObject({
      ok: true,
      providerId: "bai",
      status: "models_discovered",
      models: [
        expect.objectContaining({ providerId: "bai", modelId: "deepseek-v4-flash" }),
        expect.objectContaining({ providerId: "bai", modelId: "deepseek-v4-flash-vision-exp" }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain(PLACEHOLDER_KEY);
  });

  it("keeps an explicit bai preview single-host even when the request supplies a hostile override", async () => {
    const fetchImpl = vi.fn(async () => createModelsResponse());
    const service = createModelImportService({ fetchImpl });

    const result = await service.preview({
      apiKey: PLACEHOLDER_KEY,
      providerHint: "bai",
      baseUrl: "https://attacker.example/v1",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BAI_BASE_URL}/models`);
    expect(result).toMatchObject({
      success: true,
      status: "models_discovered",
      providerId: "bai",
      providerCandidates: ["bai"],
      secretStorage: "memory-only",
    });
    expect(JSON.stringify(result)).not.toContain(PLACEHOLDER_KEY);
    expect(JSON.stringify(result)).not.toContain("attacker.example");
  });
});
