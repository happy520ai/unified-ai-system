import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

describe("knowledge-cache", () => {
  let service;

  before(() => {
    service = createLocalKnowledgeService();
  });

  it("returns cacheHit=false on first query", () => {
    const result = service.retrieve({ query: "unique cache test query 12345" });
    assert.equal(result.metadata.cacheHit, false);
  });

  it("returns cacheHit=true on same query", () => {
    const result1 = service.retrieve({ query: "cache hit test query 67890" });
    assert.equal(result1.metadata.cacheHit, false);
    const result2 = service.retrieve({ query: "cache hit test query 67890" });
    assert.equal(result2.metadata.cacheHit, true);
  });

  it("returns cacheHit=false for different topK", () => {
    const result1 = service.retrieve({ query: "topk cache test", topK: 3 });
    assert.equal(result1.metadata.cacheHit, false);
    const result2 = service.retrieve({ query: "topk cache test", topK: 5 });
    assert.equal(result2.metadata.cacheHit, false);
  });

  it("cache returns same results", () => {
    const result1 = service.retrieve({ query: "same result test" });
    const result2 = service.retrieve({ query: "same result test" });
    assert.equal(result1.chunks.length, result2.chunks.length);
    assert.equal(result1.normalizedQuery, result2.normalizedQuery);
  });
});
