import { describe, it, expect, beforeAll } from "vitest";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

describe("knowledge-cache", () => {
  let service;

  beforeAll(() => {
    service = createLocalKnowledgeService();
  });

  it("returns cacheHit=false on first query", () => {
    const result = service.retrieve({ query: "unique cache test query 12345" });
    expect(result.metadata.cacheHit).toBe(false);
  });

  it("returns cacheHit=true on same query", () => {
    const result1 = service.retrieve({ query: "cache hit test query 67890" });
    expect(result1.metadata.cacheHit).toBe(false);
    const result2 = service.retrieve({ query: "cache hit test query 67890" });
    expect(result2.metadata.cacheHit).toBe(true);
  });

  it("returns cacheHit=false for different topK", () => {
    const result1 = service.retrieve({ query: "topk cache test", topK: 3 });
    expect(result1.metadata.cacheHit).toBe(false);
    const result2 = service.retrieve({ query: "topk cache test", topK: 5 });
    expect(result2.metadata.cacheHit).toBe(false);
  });

  it("cache returns same results", () => {
    const result1 = service.retrieve({ query: "same result test" });
    const result2 = service.retrieve({ query: "same result test" });
    expect(result1.chunks.length).toBe(result2.chunks.length);
    expect(result1.normalizedQuery).toBe(result2.normalizedQuery);
  });
});
