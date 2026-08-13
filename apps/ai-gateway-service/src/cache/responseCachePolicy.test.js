import { describe, it, expect } from "vitest";
import { createResponseCachePolicy } from "./responseCachePolicy.js";

describe("response-cache-policy", () => {
  it("returns default policy with no overrides", () => {
    const policy = createResponseCachePolicy();
    expect(policy.enabled).toBe(true);
    expect(policy.mode).toBe("local-preview-hardening");
    expect(policy.ttlMs).toBe(604_800_000);
    expect(policy.maxEntries).toBe(500);
    expect(policy.maxRecordBytes).toBe(200_000);
    expect(policy.cacheVersion).toBe("phase275a-v1");
    expect(policy.cacheable).toBe(true);
  });

  it("respects enabled: false override", () => {
    const policy = createResponseCachePolicy({ enabled: false });
    expect(policy.enabled).toBe(false);
    expect(policy.cacheable).toBe(false);
  });

  it("respects custom ttlMs", () => {
    const policy = createResponseCachePolicy({ ttlMs: 3600_000 });
    expect(policy.ttlMs).toBe(3600_000);
  });

  it("respects custom maxEntries and maxRecordBytes", () => {
    const policy = createResponseCachePolicy({ maxEntries: 100, maxRecordBytes: 50000 });
    expect(policy.maxEntries).toBe(100);
    expect(policy.maxRecordBytes).toBe(50000);
  });

  it("blocks caching when query contains 'secret'", () => {
    const policy = createResponseCachePolicy({ query: "show me the secret key" });
    expect(policy.cacheable).toBe(false);
  });

  it("blocks caching when query contains 'api-key'", () => {
    const policy = createResponseCachePolicy({ prompt: "what is the api-key?" });
    expect(policy.cacheable).toBe(false);
  });

  it("blocks caching when query contains 'credential'", () => {
    const policy = createResponseCachePolicy({ reason: "credential check" });
    expect(policy.cacheable).toBe(false);
  });

  it("blocks caching when query contains 'authorization'", () => {
    const policy = createResponseCachePolicy({ query: "authorization header" });
    expect(policy.cacheable).toBe(false);
  });

  it("blocks caching when query contains 'auth-header'", () => {
    const policy = createResponseCachePolicy({ type: "auth-header inspection" });
    expect(policy.cacheable).toBe(false);
  });

  it("allows caching for normal queries", () => {
    const policy = createResponseCachePolicy({ query: "what is the weather today?" });
    expect(policy.cacheable).toBe(true);
  });

  it("preserves default allowProviders", () => {
    const policy = createResponseCachePolicy();
    expect(policy.allowProviders).toEqual(["mimo", "nvidia", "local"]);
  });

  it("respects custom allowProviders", () => {
    const policy = createResponseCachePolicy({ allowProviders: ["openai"] });
    expect(policy.allowProviders).toEqual(["openai"]);
  });
});
