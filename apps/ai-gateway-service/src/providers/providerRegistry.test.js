import { describe, it, expect, beforeAll } from "vitest";
import { ProviderRegistry } from "./providerRegistry.js";
import { createFakeProvider } from "./fakeProvider.js";

describe("provider-registry", () => {
  let registry;

  beforeAll(() => {
    registry = new ProviderRegistry();
  });

  it("registers a provider", () => {
    const provider = createFakeProvider({ providerId: "test-fake", modelId: "test-model", providerType: "fake" });
    registry.register(provider);
    expect(registry.has("test-fake")).toBe(true);
  });

  it("lists registered providers", () => {
    const providers = registry.listAll();
    expect(providers.length).toBeGreaterThan(0);
  });

  it("gets provider by id", () => {
    const provider = registry.get("test-fake");
    expect(provider.descriptor.id).toBe("test-fake");
  });

  it("throws for duplicate registration", () => {
    const provider = createFakeProvider({ providerId: "test-fake", modelId: "test-model", providerType: "fake" });
    expect(() => registry.register(provider)).toThrow();
  });

  it("throws for missing provider", () => {
    expect(() => registry.get("nonexistent")).toThrow();
  });

  it("lists descriptors", () => {
    const descriptors = registry.listDescriptors();
    expect(descriptors.length).toBeGreaterThan(0);
    expect(descriptors[0].id).toBeDefined();
  });
});
