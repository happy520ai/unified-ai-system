import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createSqliteVecStore } from "./sqliteVecStore.js";
import { createLocalKnowledgeService } from "./localKnowledgeService.js";

const stores: ReturnType<typeof createSqliteVecStore>[] = [];
const directories: string[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
function store(dbPath = ":memory:") {
  const value = createSqliteVecStore({ dbPath, dimension: 3 });
  stores.push(value);
  return value;
}
function doc(id: string, embedding: number[], sourceId = "source-a") {
  return { id, embedding, sourceId, title: id, content: `content-${id}`, metadata: { id } };
}

describe("local SQLite vector persistence", () => {
  it("works in a fresh production Node process without Vitest dependency resolution", () => {
    const source = new URL("./sqliteVecStore.js", import.meta.url).href;
    const program = `import {createSqliteVecStore} from ${JSON.stringify(source)};
      const store=createSqliteVecStore({dbPath:':memory:',dimension:3});
      try { store.upsertDocument({id:'child',embedding:[1,2,3]});
        console.log(JSON.stringify({available:store.isAvailable(),count:store.getDocumentCount(),id:store.query([1,2,3])[0].documentId}));
      } finally { store.close(); }`;
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", program], {
      windowsHide: true, encoding: "utf8", timeout: 10_000,
      env: { SystemRoot: process.env.SystemRoot ?? "", TEMP: tmpdir(), TMP: tmpdir() },
    });
    expect(JSON.parse(result)).toEqual({ available: true, count: 1, id: "child" });
  });

  it("opens the built-in database and ranks, filters, replaces and deletes stored vectors", () => {
    const db = store();
    expect(db.isAvailable()).toBe(true);
    db.upsertDocuments([doc("a", [1, 0, 0]), doc("b", [0, 1, 0]), doc("c", [0.8, 0.2, 0], "source-b")]);
    expect(db.query([1, 0, 0], { topK: 3 }).map(row => row.documentId)).toEqual(["a", "c", "b"]);
    expect(db.query([1, 0, 0], { sourceIds: ["source-b"] }).map(row => row.documentId)).toEqual(["c"]);
    db.upsertDocument(doc("a", [0, 0, 1]));
    expect(db.query([1, 0, 0], { topK: 1 })[0]?.documentId).toBe("c");
    db.deleteDocument("c");
    expect(db.getDocumentCount()).toBe(2);
    expect(db.query([1, 0, 0], { topK: 10 }).some(row => row.documentId === "c")).toBe(false);
  });

  it("retains documents and scores after closing and reopening the same file", () => {
    const directory = mkdtempSync(join(tmpdir(), "vector-persistence-")); directories.push(directory);
    const path = join(directory, "vectors.sqlite");
    const first = store(path);
    first.upsertDocument(doc("persisted", [1, 2, 3]));
    first.close();
    const reopened = store(path);
    expect(reopened.getDocumentCount()).toBe(1);
    expect(reopened.query([1, 2, 3])[0]).toMatchObject({ documentId: "persisted", score: 1, metadata: { id: "persisted" } });
  });

  it("rejects malformed vectors without partially changing a batch", () => {
    const db = store();
    db.upsertDocument(doc("original", [1, 0, 0]));
    for (const embedding of [[1, 2], [NaN, 0, 1], [Infinity, 0, 1], [1e100, 0, 1]]) {
      expect(() => db.upsertDocuments([doc("new", [0, 1, 0]), doc("bad", embedding)])).toThrow();
      expect(db.getDocumentCount()).toBe(1);
    }
    expect(() => db.query([1, 2])).toThrow();
    expect(() => createSqliteVecStore({ dbPath: ":memory:", dimension: 0 })).toThrow();
  });

  it("applies the trusted visible-document set before truncating ranked results", () => {
    const db = store();
    db.upsertDocuments([doc("other-a", [1, 0, 0]), doc("other-b", [1, 0, 0]), doc("allowed", [0.8, 0.2, 0])]);
    expect(db.query([1, 0, 0], { topK: 1, documentIds: ["allowed"] }).map(row => row.documentId)).toEqual(["allowed"]);
    expect(db.query([1, 0, 0], { documentIds: [] })).toEqual([]);
  });

  it("keeps real service retrieval useful when another tenant has more top-scoring vectors", async () => {
    const db = store();
    const service = createLocalKnowledgeService({
      storageMode: "memory", documents: [], vectorEnabled: true, vectorStore: db,
      embeddingProvider: { id: "fixture", dimensions: 3, credentialFree: true,
        embedText(text: string) { return text.includes("own") ? [0.8, 0.2, 0] : [1, 0, 0]; } },
    });
    const tenantA = { tenantScopeIdentity: { tenantId: "a" } };
    const tenantB = { tenantScopeIdentity: { tenantId: "b" } };
    try {
      service.loadDocuments({ sourceId: "same-source", documents: Array.from({ length: 10 }, (_, index) => ({ documentId: `foreign-${index}`, title: "exact", text: "exact" })) }, tenantB);
      await service.retrieve({ query: "exact", mode: "vector", topK: 1 }, tenantB);
      service.loadDocuments({ sourceId: "same-source", documents: [{ documentId: "own", title: "own", text: "own content" }] }, tenantA);
      const result = await service.retrieve({ query: "exact", mode: "vector", topK: 1 }, tenantA);
      expect(result.chunks.map((chunk: { document: { documentId: string } }) => chunk.document.documentId)).toEqual(["own"]);
    } finally { service.close(); }
  });
});
