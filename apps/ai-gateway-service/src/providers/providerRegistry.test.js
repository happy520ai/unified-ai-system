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

  it("filters every primary and fallback candidate by required capabilities", () => {
    const capabilityRegistry = new ProviderRegistry();
    capabilityRegistry.register(createFakeProvider({
      providerId: "text-only",
      modelId: "text-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
      priority: 1,
    }));
    capabilityRegistry.register(createFakeProvider({
      providerId: "vision",
      modelId: "vision-model",
      providerType: "fake",
      capabilities: ["chat", "vision"],
      enabled: true,
      priority: 2,
    }));

    const selection = capabilityRegistry.select({
      taskType: "chat",
      requiredCapabilities: ["vision"],
    });
    expect(selection.selected.target.providerId).toBe("vision");
    expect(selection.candidates.every((candidate) => candidate.model.capabilities.includes("vision"))).toBe(true);
  });

  it("fails closed when no model satisfies a required capability", () => {
    const capabilityRegistry = new ProviderRegistry();
    const provider = createFakeProvider({
      providerId: "text-only",
      modelId: "text-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
    });
    provider.descriptor.models[0].capabilities = ["chat"];
    capabilityRegistry.register(provider);

    expect(() => capabilityRegistry.select({
      taskType: "chat",
      requiredCapabilities: ["vision"],
    })).toThrowError(expect.objectContaining({ code: "NO_CAPABLE_PROVIDER_ROUTE" }));
  });
});
