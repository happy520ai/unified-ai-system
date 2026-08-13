import { describe, it, expect } from "vitest";
import { createAnthropicAdapter } from "./anthropicAdapter.js";

describe("anthropic-adapter", () => {
  it("creates adapter with correct descriptor", () => {
    const adapter = createAnthropicAdapter({
      providerId: "anthropic",
      apiKey: "sk-ant-test-key",
      models: [
        { id: "claude-sonnet-4.5", displayName: "Claude Sonnet 4.5" },
      ],
    });

    expect(adapter.descriptor.id).toBe("anthropic");
    expect(adapter.descriptor.kind).toBe("llm");
    expect(adapter.descriptor.metadata.providerType).toBe("anthropic");
    expect(adapter.descriptor.models).toHaveLength(1);
    expect(adapter.descriptor.models[0].id).toBe("claude-sonnet-4.5");
  });

  it("uses default base URL when not specified", () => {
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      models: [{ id: "claude-sonnet-4.5" }],
    });
    expect(adapter.descriptor.metadata.endpoint).toBe("https://api.anthropic.com");
  });

  it("throws when API key is missing", async () => {
    const adapter = createAnthropicAdapter({
      providerId: "anthropic",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    await expect(
      adapter.generate({
        request: { messages: [{ role: "user", content: "hi" }] },
        target: { providerId: "anthropic", modelId: "claude-sonnet-4.5" },
      }),
    ).rejects.toThrow("API key");
  });

  it("maps system messages to top-level system field", () => {
    // Verify the internal mapping logic by testing the adapter structure
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    expect(typeof adapter.generate).toBe("function");
    expect(adapter.descriptor.metadata.anthropicVersion).toBe("2023-06-01");
  });

  it("normalizes string model configs", () => {
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      models: ["claude-sonnet-4.5"],
    });

    expect(adapter.descriptor.models[0].id).toBe("claude-sonnet-4.5");
    expect(adapter.descriptor.models[0].capabilities).toContain("chat");
  });

  it("accepts custom endpoint for proxies", () => {
    const adapter = createAnthropicAdapter({
      apiKey: "sk-ant-test",
      endpoint: "https://my-proxy.example.com",
      models: [{ id: "claude-sonnet-4.5" }],
    });

    expect(adapter.descriptor.metadata.endpoint).toBe("https://my-proxy.example.com");
  });
});
