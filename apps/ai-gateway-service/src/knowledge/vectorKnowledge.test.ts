import { describe, expect, it } from "vitest";
import { createDeterministicEmbeddingProvider } from "./deterministicEmbeddingProvider.ts";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

function createFakeVectorStore() {
  const documents = new Map<string, { id: string; sourceId: string; title: string; content: string; embedding: number[] }>();
  function cosine(a: number[], b: number[]): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let index = 0; index < a.length; index += 1) {
      dot += a[index] * b[index];
      na += a[index] * a[index];
      nb += b[index] * b[index];
    }
    const denominator = Math.sqrt(na) * Math.sqrt(nb);
    return denominator === 0 ? 0 : dot / denominator;
  }
  return {
    isAvailable: () => true,
    upsertDocuments(upserts: Array<{ id: string; sourceId: string; title: string; content: string; embedding: number[] }>) {
      for (const upsert of upserts) {
        documents.set(upsert.id, { ...upsert });
      }
      return upserts.map((upsert) => ({ id: upsert.id, stored: true }));
    },
    query(embedding: number[], options: { topK?: number; sourceIds?: string[] } = {}) {
      const rows = [...documents.values()]
        .filter((doc) => !options.sourceIds?.length || options.sourceIds.includes(doc.sourceId))
        .map((doc) => ({ documentId: doc.id, sourceId: doc.sourceId, title: doc.title, content: doc.content, score: cosine(embedding, doc.embedding) }));
      return rows
        .sort((a, b) => b.score - a.score)
        .slice(0, options.topK ?? 5)
        .map((row, index) => ({ ...row, rank: index + 1 }));
    },
    close() {},
  };
}

function createVectorService({ documents = [], store = createFakeVectorStore() } = {}) {
  return createLocalKnowledgeService({
    env: { KNOWLEDGE_INFRA_MODE: "sqlite-vec" },
    vectorEnabled: true,
    vectorStore: store,
    documents,
  });
}

const TENANT_A = { tenantId: "tenant-a" };
const TENANT_B = { tenantId: "tenant-b" };

describe("deterministic embedding provider", () => {
  it("produces deterministic, normalized vectors of fixed dimension", async () => {
    const provider = createDeterministicEmbeddingProvider();
    const first = provider.embedText("知识库向量检索激活");
    const second = provider.embedText("知识库向量检索激活");

    expect(first).toEqual(second);
    expect(first).toHaveLength(256);
    const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("scores related text closer than unrelated text", async () => {
    const provider = createDeterministicEmbeddingProvider();
    const base = provider.embedText("vector retrieval for the knowledge base");
    const related = provider.embedText("knowledge base vector retrieval");
    const unrelated = provider.embedText("погода сегодня дождь совершенно другой текст");
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    expect(dot(base, related)).toBeGreaterThan(dot(base, unrelated));
  });
});

describe("vector retrieval mode", () => {
  it("loads documents and retrieves them by vector similarity", async () => {
    const service = createVectorService();
    service.loadDocuments({
      sourceId: "vector-docs",
      documents: [
        { documentId: "vec-1", title: "Quantum computing overview", text: "Quantum computing uses qubits and superposition for computation." },
        { documentId: "vec-2", title: "Cooking pasta", text: "Boil water, add salt, cook pasta until al dente." },
      ],
    }, { tenantScopeIdentity: TENANT_A });

    const result = await service.retrieve({ query: "quantum qubits superposition", mode: "vector", topK: 2 }, { tenantScopeIdentity: TENANT_A });
    expect(result.mode).toBe("vector");
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].document.documentId).toBe("vec-1");
    expect(result.chunks[0].score).toBeGreaterThan(0);
    expect(result.chunks[0].vector.embeddingId).toBe("deterministic-hash-v1");
  });

  it("never leaks another tenant's documents through vector results", async () => {
    const service = createVectorService();
    service.loadDocuments({
      sourceId: "shared-source-id",
      documents: [{ documentId: "secret", title: "Tenant A private", text: "tenant A confidential quantum research notes" }],
    }, { tenantScopeIdentity: TENANT_A });

    const result = await service.retrieve({ query: "tenant A confidential quantum research notes", mode: "vector", topK: 5 }, { tenantScopeIdentity: TENANT_B });
    expect(result.chunks.every((chunk: { document: { documentId: string } }) => chunk.document.documentId !== "secret")).toBe(true);
  });

  it("keeps keyword mode unchanged and reports both modes in health", async () => {
    const service = createVectorService();
    const health = service.getHealth({ tenantScopeIdentity: TENANT_A });
    expect(health.mode).toBe("local-keyword+vector");
    expect(health.supportedModes).toEqual(["keyword", "vector"]);
    expect(health.embedding).toBe("deterministic-hash-v1");

    const keyword = await service.retrieve({ query: "defect report template", mode: "keyword" }, { tenantScopeIdentity: TENANT_A });
    expect(keyword.mode).toBe("keyword");
  });

  it("rejects vector mode cleanly when the store is unavailable", async () => {
    const service = createLocalKnowledgeService({
      env: { KNOWLEDGE_INFRA_MODE: "local-keyword" },
      vectorEnabled: false,
    });
    await expect(service.retrieve({ query: "anything", mode: "vector" }, { tenantScopeIdentity: TENANT_A })).rejects.toThrowError();
  });
});
