import fs from "fs/promises";
import path from "path";
import {
  DATA_DIR,
  DOCS_DIR,
  CHUNKS_DIR,
  INDEX_FILE,
  MAX_DOCUMENTS,
  MAX_IMPORT_DOCUMENTS,
  tokenize,
  splitSentences,
  overlapTail,
  createChunk,
  generateId,
  sha256,
  extractExtension,
  humanBytes,
  cosineSimilarity,
  chunkDocument as chunkDocumentFn,
  generateEmbedding as generateEmbeddingFn,
  searchChunks,
  buildContext,
} from "./personalKnowledgeHelpers.js";

/**
 * Personal Knowledge RAG System
 * Allows users to upload documents, which are chunked, embedded, and indexed
 * for retrieval-augmented generation during chat conversations.
 *
 * Uses a local TF-IDF-style embedding so no external model is required.
 * All data is persisted under `.data/knowledge/`.
 */

export class PersonalKnowledgeRAG {
  constructor(options = {}) {
    this.maxDocSize = options.maxDocSize ?? 10 * 1024 * 1024;
    this.chunkSize = options.chunkSize ?? 500;
    this.chunkOverlap = options.chunkOverlap ?? 50;
    this.maxResults = options.maxResults ?? 5;
    this.supportedFormats = [
      "txt", "md", "json", "csv", "html",
      "js", "py", "java", "ts", "yaml",
    ];

    this.documents = new Map();
    this.chunks = new Map();
    this.index = [];
    this._df = new Map();
    this._totalChunks = 0;
  }

  async init() {
    await fs.mkdir(DOCS_DIR, { recursive: true });
    await fs.mkdir(CHUNKS_DIR, { recursive: true });

    try {
      const raw = await fs.readFile(INDEX_FILE, "utf-8");
      const data = JSON.parse(raw);

      this.index = Array.isArray(data.index) ? data.index : [];
      this._df = new Map(Object.entries(data.df ?? {}));
      this._totalChunks = data.totalChunks ?? 0;

      for (const entry of this.index) {
        try {
          const docPath = path.join(DOCS_DIR, `${entry.docId}.json`);
          const docRaw = await fs.readFile(docPath, "utf-8");
          this.documents.set(entry.docId, JSON.parse(docRaw));
        } catch { /* skip missing document file */ }

        for (const chunkId of entry.chunkIds ?? []) {
          try {
            const chunkPath = path.join(CHUNKS_DIR, `${chunkId}.json`);
            const chunkRaw = await fs.readFile(chunkPath, "utf-8");
            this.chunks.set(chunkId, JSON.parse(chunkRaw));
          } catch { /* skip missing chunk file */ }
        }
      }
    } catch {
      this.index = [];
      this._df = new Map();
      this._totalChunks = 0;
    }
  }

  async ingestDocument(name, content, metadata = {}) {
    if (!name || typeof name !== "string") {
      throw new Error("Document name is required.");
    }
    if (!content || typeof content !== "string") {
      throw new Error("Document content is required.");
    }
    if (Buffer.byteLength(content, "utf-8") > this.maxDocSize) {
      throw new Error(`Document exceeds the maximum size of ${this.maxDocSize} bytes.`);
    }
    if (this.documents.size >= MAX_DOCUMENTS) {
      throw new Error(`Knowledge base has reached the maximum of ${MAX_DOCUMENTS} documents.`);
    }

    const ext = extractExtension(name);
    if (!this.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported format ".${ext}". Supported: ${this.supportedFormats.join(", ")}`);
    }

    const docId = generateId(name);
    const doc = {
      docId,
      name,
      extension: ext,
      size: Buffer.byteLength(content, "utf-8"),
      contentHash: sha256(content),
      createdAt: new Date().toISOString(),
      metadata: { ...metadata, format: ext },
    };

    const chunks = this.chunkDocument(content, docId);

    for (const chunk of chunks) {
      chunk.embedding = this.generateEmbedding(chunk.text);
    }

    this._totalChunks += chunks.length;
    for (const chunk of chunks) {
      const terms = tokenize(chunk.text);
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        this._df.set(term, (this._df.get(term) ?? 0) + 1);
      }
    }

    this.documents.set(docId, doc);
    const chunkIds = [];
    for (const chunk of chunks) {
      this.chunks.set(chunk.chunkId, chunk);
      chunkIds.push(chunk.chunkId);
    }

    this.index.push({
      docId,
      name,
      extension: ext,
      chunkCount: chunks.length,
      chunkIds,
      createdAt: doc.createdAt,
    });

    await this._persistDocument(doc);
    await this._persistChunks(chunks);
    await this.persistIndex();

    return {
      docId,
      name: doc.name,
      chunks: chunks.length,
      size: doc.size,
      createdAt: doc.createdAt,
    };
  }

  chunkDocument(content, docId) {
    return chunkDocumentFn(content, docId, this.chunkSize, this.chunkOverlap);
  }

  generateEmbedding(text) {
    return generateEmbeddingFn(text, this._df, this._totalChunks);
  }

  async search(query, options = {}) {
    const topK = options.topK ?? this.maxResults;
    const queryEmbedding = this.generateEmbedding(query);
    return searchChunks(queryEmbedding, this.chunks, {
      ...options,
      topK,
      df: this._df,
      totalChunks: this._totalChunks,
    });
  }

  async getContextForQuery(query, options = {}) {
    const topK = options.topK ?? this.maxResults;
    const maxChars = options.maxChars ?? 4000;
    const results = await this.search(query, { topK, docId: options.docId });
    return buildContext(results, this.documents, maxChars);
  }

  listDocuments() {
    return this.index.map((entry) => ({
      docId: entry.docId,
      name: entry.name,
      extension: entry.extension,
      chunkCount: entry.chunkCount,
      createdAt: entry.createdAt,
    }));
  }

  getDocument(docId) {
    const doc = this.documents.get(docId);
    if (!doc) return null;
    const entry = this.index.find((e) => e.docId === docId);
    return {
      ...doc,
      chunkIds: entry?.chunkIds ?? [],
      chunkCount: entry?.chunkCount ?? 0,
    };
  }

  async deleteDocument(docId) {
    const entry = this.index.find((e) => e.docId === docId);
    if (!entry) {
      throw new Error(`Document not found: ${docId}`);
    }

    for (const chunkId of entry.chunkIds ?? []) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        const terms = tokenize(chunk.text);
        const uniqueTerms = new Set(terms);
        for (const term of uniqueTerms) {
          const current = this._df.get(term) ?? 0;
          if (current <= 1) {
            this._df.delete(term);
          } else {
            this._df.set(term, current - 1);
          }
        }
        this._totalChunks = Math.max(0, this._totalChunks - 1);
      }

      this.chunks.delete(chunkId);
      try {
        await fs.unlink(path.join(CHUNKS_DIR, `${chunkId}.json`));
      } catch { /* ignore if chunk file already gone */ }
    }

    this.documents.delete(docId);
    try {
      await fs.unlink(path.join(DOCS_DIR, `${docId}.json`));
    } catch { /* ignore if document file already gone */ }

    this.index = this.index.filter((e) => e.docId !== docId);
    await this.persistIndex();

    return {
      docId,
      name: entry.name,
      deletedChunks: entry.chunkIds?.length ?? 0,
      deletedAt: new Date().toISOString(),
    };
  }

  getStats() {
    const formatCounts = {};
    for (const entry of this.index) {
      formatCounts[entry.extension] = (formatCounts[entry.extension] ?? 0) + 1;
    }

    const totalSize = Array.from(this.documents.values()).reduce(
      (sum, doc) => sum + (doc.size ?? 0), 0
    );

    return {
      totalDocuments: this.documents.size,
      totalChunks: this.chunks.size,
      totalSizeBytes: totalSize,
      totalSizeHuman: humanBytes(totalSize),
      uniqueTerms: this._df.size,
      formats: formatCounts,
      supportedFormats: this.supportedFormats,
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      maxDocSize: this.maxDocSize,
      maxResults: this.maxResults,
    };
  }

  async exportKnowledgeBase() {
    const docs = [];
    for (const [docId, doc] of this.documents) {
      const entry = this.index.find((e) => e.docId === docId);
      const chunkTexts = (entry?.chunkIds ?? []).map((cid) => {
        const c = this.chunks.get(cid);
        return c ? { chunkId: cid, text: c.text, index: c.index } : null;
      }).filter(Boolean);

      docs.push({
        ...doc,
        chunks: chunkTexts,
      });
    }

    return {
      exportedAt: new Date().toISOString(),
      version: "1.0.0",
      documentCount: docs.length,
      documents: docs,
      stats: this.getStats(),
    };
  }

  async importKnowledgeBase(data) {
    if (!data || !Array.isArray(data.documents)) {
      throw new Error("Invalid import data: expected { documents: [...] }");
    }
    if (data.documents.length > MAX_IMPORT_DOCUMENTS) {
      throw new Error(`Import batch too large: ${data.documents.length} documents (max ${MAX_IMPORT_DOCUMENTS}).`);
    }

    const results = [];
    for (const doc of data.documents) {
      const existing = Array.from(this.documents.values()).find(
        (d) => d.contentHash === doc.contentHash
      );
      if (existing) {
        results.push({ name: doc.name, status: "skipped", reason: "duplicate" });
        continue;
      }

      try {
        const result = await this.ingestDocument(
          doc.name,
          doc.content ?? (doc.chunks ?? []).map((c) => c.text).join("\n\n"),
          doc.metadata ?? {}
        );
        results.push({ name: doc.name, status: "imported", ...result });
      } catch (err) {
        results.push({ name: doc.name, status: "error", error: err.message });
      }
    }

    return {
      importedAt: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        imported: results.filter((r) => r.status === "imported").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
      },
    };
  }

  async persistIndex() {
    const payload = {
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      totalChunks: this._totalChunks,
      df: Object.fromEntries(this._df),
      index: this.index,
    };

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(INDEX_FILE, JSON.stringify(payload, null, 2), "utf-8");
  }

  async _persistDocument(doc) {
    await fs.mkdir(DOCS_DIR, { recursive: true });
    const filePath = path.join(DOCS_DIR, `${doc.docId}.json`);
    await fs.writeFile(filePath, JSON.stringify(doc, null, 2), "utf-8");
  }

  async _persistChunks(chunks) {
    await fs.mkdir(CHUNKS_DIR, { recursive: true });

    for (const chunk of chunks) {
      const serialisable = {
        ...chunk,
        embedding: chunk.embedding instanceof Map
          ? Object.fromEntries(chunk.embedding)
          : chunk.embedding,
      };

      const filePath = path.join(CHUNKS_DIR, `${chunk.chunkId}.json`);
      await fs.writeFile(filePath, JSON.stringify(serialisable, null, 2), "utf-8");
    }
  }
}
