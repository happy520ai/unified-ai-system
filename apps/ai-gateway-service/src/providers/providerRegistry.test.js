import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { ProviderRegistry } from "./providerRegistry.js";
import { createFakeProvider } from "./fakeProvider.js";

describe("provider-registry", () => {
  let registry;

  before(() => {
    registry = new ProviderRegistry();
  });

  it("registers a provider", () => {
    const provider = createFakeProvider({ providerId: "test-fake", modelId: "test-model", providerType: "fake" });
    registry.register(provider);
    assert.ok(registry.has("test-fake"))=== (true);
  });

  it("lists registered providers", () => {
    const providers = registry.listAll();
    assert.ok(providers.length > 0);
  });

  it("gets provider by id", () => {
    const provider = registry.get("test-fake");
    assert.equal(provider.descriptor.id, "test-fake");
  });

  it("throws for duplicate registration", () => {
    const provider = createFakeProvider({ providerId: "test-fake", modelId: "test-model", providerType: "fake" });
    assert.throws(() => registry.register(provider));
  });

  it("throws for missing provider", () => {
    assert.throws(() => registry.get("nonexistent"));
  });

  it("lists descriptors", () => {
    const descriptors = registry.listDescriptors();
    assert.ok(descriptors.length > 0);
    assert.ok(descriptors[0].id)!== undefined;
  });
});
