import { describe, it, expect, beforeAll } from "vitest";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

describe("local-knowledge-service", () => {
  let service;

  beforeAll(() => {
    service = createLocalKnowledgeService();
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    expect(h.status).toBe("ready");
    expect(h.mode).toBe("local-keyword");
    expect(h.documentCount).toBeGreaterThan(0);
  });

  it("lists default sources", () => {
    const result = service.listSources();
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("retrieves documents by keyword", () => {
    const result = service.retrieve({ query: "default command set" });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].text).toBeDefined();
  });

  it("loads and retrieves custom documents", () => {
    service.loadDocuments({
      sourceId: "test-source",
      sourceTitle: "Test Source",
      documents: [
        { documentId: "doc-1", title: "Custom Doc", text: "This is a custom test document about quantum computing" },
      ],
    });
    const result = service.retrieve({ query: "quantum computing" });
    expect(result.chunks.some((c) => c.text.includes("quantum"))).toBe(true);
  });

  it("returns empty for non-matching query", () => {
    const result = service.retrieve({ query: "zzzznonexistentquery12345" });
    expect(result.chunks.length).toBe(0);
  });

  it("supports topK parameter", () => {
    const result = service.retrieve({ query: "phase", topK: 1 });
    expect(result.chunks.length).toBeLessThanOrEqual(1);
  });
});
