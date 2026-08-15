import { describe, expect, it, vi } from "vitest";
import { GatewayService } from "./gatewayService.js";
import { normalizeGatewayRequest } from "./requestNormalizer.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

const ONE_PIXEL_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("multimodal gateway core", () => {
  it("infers vision and rejects remote or non-user image content", () => {
    const normalized = normalizeGatewayRequest({
      taskType: "chat",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Describe" },
          { type: "image_url", image_url: { url: ONE_PIXEL_PNG, detail: "low" } },
        ],
      }],
    });
    expect(normalized.requiredCapabilities).toEqual(["vision"]);

    expect(() => normalizeGatewayRequest({
      messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "https://127.0.0.1/a.png" } }] }],
    })).toThrow(/remote image URLs are disabled/i);
    expect(() => normalizeGatewayRequest({
      messages: [{ role: "system", content: [{ type: "image_url", image_url: { url: ONE_PIXEL_PNG } }] }],
    })).toThrow(/only in user messages/i);
  });

  it("routes only through vision-capable providers and scans text without image payloads", async () => {
    const registry = new ProviderRegistry();
    registry.register(createFakeProvider({
      providerId: "fake",
      modelId: "vision-fake",
      providerType: "fake",
      capabilities: ["chat", "vision"],
      enabled: true,
      fixedLatencyMs: 1,
    }));
    const scan = vi.fn(() => ({ safe: true, violations: [] }));
    const service = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: { providerMode: "fake", realProviderEnabled: false },
      contentGuardrails: { scan },
    });
    const result = await service.execute({
      taskType: "chat",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Describe the image" },
          { type: "image_url", image_url: { url: ONE_PIXEL_PNG } },
        ],
      }],
    });

    expect(result.success).toBe(true);
    expect(result.data?.text).toContain("Describe the image");
    expect(result.data?.text).toMatch(/\[inline-image:[a-f0-9]{24}:\d+\]/);
    expect(scan).toHaveBeenCalledWith("Describe the image", expect.objectContaining({ role: "user" }));
    expect(JSON.stringify(scan.mock.calls)).not.toContain("iVBOR");
  });
});
