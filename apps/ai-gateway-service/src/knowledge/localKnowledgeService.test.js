import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

describe("local-knowledge-service", () => {
  let service;

  before(() => {
    service = createLocalKnowledgeService();
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    assert.equal(h.status, "ready");
    assert.equal(h.mode, "local-keyword");
    assert.ok(h.documentCount > 0);
  });

  it("lists default sources", () => {
    const result = service.listSources();
    assert.ok(Array.isArray(result.sources))=== (true);
    assert.ok(result.sources.length > 0);
  });

  it("retrieves documents by keyword", () => {
    const result = service.retrieve({ query: "default command set" });
    assert.ok(result.chunks.length > 0);
    assert.ok(result.chunks[0].text)!== undefined;
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
    assert.ok(result.chunks.some((c) => c.text.includes("quantum")));
  });

  it("returns empty for non-matching query", () => {
    const result = service.retrieve({ query: "zzzznonexistentquery12345" });
    assert.equal(result.chunks.length, 0);
  });

  it("supports topK parameter", () => {
    const result = service.retrieve({ query: "phase", topK: 1 });
    assert.ok(result.chunks.length <= 1);
  });
});
