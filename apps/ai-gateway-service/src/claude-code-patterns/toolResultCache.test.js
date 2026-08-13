import { describe, it, expect } from "vitest";
import { createToolResultCache } from "./toolResultCache.js";

describe("tool-result-cache", () => {
  it("creates cache with size 0", () => {
    const cache = createToolResultCache();
    expect(cache.size).toBe(0);
    expect(cache.maxSize).toBe(500);
  });

  it("caches and retrieves results for cacheable tools", () => {
    const cache = createToolResultCache();
    cache.set("file_read", { path: "/test.js" }, "file content");
    expect(cache.size).toBe(1);
    expect(cache.get("file_read", { path: "/test.js" })).toBe("file content");
  });

  it("returns null for uncached entries", () => {
    const cache = createToolResultCache();
    expect(cache.get("file_read", { path: "/nonexistent" })).toBe(null);
  });

  it("does not cache non-cacheable tools", () => {
    const cache = createToolResultCache();
    cache.set("file_write", { path: "/test.js" }, "written");
    expect(cache.size).toBe(0);
    expect(cache.get("file_write", { path: "/test.js" })).toBe(null);
  });

  it("normalizes param order in cache key", () => {
    const cache = createToolResultCache();
    cache.set("glob", { pattern: "*.js", path: "/src" }, "results");
    expect(cache.get("glob", { path: "/src", pattern: "*.js" })).toBe("results");
  });

  it("increments hit counter on cache hit", () => {
    const cache = createToolResultCache();
    cache.set("file_read", { path: "/test.js" }, "content");
    cache.get("file_read", { path: "/test.js" });
    cache.get("file_read", { path: "/test.js" });
    // Internal hit count is not exposed, but we can verify it still returns the result
    expect(cache.get("file_read", { path: "/test.js" })).toBe("content");
  });

  it("invalidateForFileWrite removes file_read entries for same path", () => {
    const cache = createToolResultCache();
    cache.set("file_read", { path: "/src/test.js" }, "content");
    cache.set("file_read", { path: "/other.js" }, "other");
    const invalidated = cache.invalidateForFileWrite({ path: "/src/test.js" });
    expect(invalidated).toBeGreaterThanOrEqual(1);
    expect(cache.get("file_read", { path: "/src/test.js" })).toBe(null);
  });

  it("invalidateForFileWrite removes all glob and grep entries", () => {
    const cache = createToolResultCache();
    cache.set("glob", { pattern: "*.js" }, "results");
    cache.set("grep", { pattern: "test" }, "matches");
    cache.set("file_read", { path: "/unrelated.js" }, "content");
    const invalidated = cache.invalidateForFileWrite({ path: "/src/test.js" });
    expect(invalidated).toBeGreaterThanOrEqual(2);
    expect(cache.get("glob", { pattern: "*.js" })).toBe(null);
    expect(cache.get("grep", { pattern: "test" })).toBe(null);
  });

  it("clear removes all entries", () => {
    const cache = createToolResultCache();
    cache.set("file_read", { path: "/a.js" }, "a");
    cache.set("file_read", { path: "/b.js" }, "b");
    const result = cache.clear();
    expect(result.cleared).toBe(2);
    expect(cache.size).toBe(0);
  });

  it("exposes cacheableTools set", () => {
    const cache = createToolResultCache();
    expect(cache.cacheableTools.has("file_read")).toBe(true);
    expect(cache.cacheableTools.has("grep")).toBe(true);
    expect(cache.cacheableTools.has("file_write")).toBe(false);
  });
});
