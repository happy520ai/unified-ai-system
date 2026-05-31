/**
 * SQLite-vec Vector Store
 * Lightweight vector storage using better-sqlite3 with vec extension.
 * No external database required - works with local SQLite file.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_DB_PATH = ".data/knowledge/vectors.sqlite";
const DEFAULT_DIMENSION = 384; // MiniLM-L6 default
const DEFAULT_TOP_K = 5;

/**
 * Create a SQLite-vec vector store instance.
 * @param {Object} options
 * @param {string} options.dbPath - Path to SQLite database file
 * @param {number} options.dimension - Vector dimension
 * @returns {Object} Vector store instance
 */
export function createSqliteVecStore(options = {}) {
  const dbPath = resolve(options.dbPath || DEFAULT_DB_PATH);
  const dimension = options.dimension || DEFAULT_DIMENSION;
  let db = null;

  function ensureDb() {
    if (db) return db;

    try {
      const { Database } = require("better-sqlite3");
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      db = new Database(dbPath);
      db.pragma("journal_mode = WAL");
      db.pragma("synchronous = NORMAL");

      // Create tables if not exist
      db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          source_id TEXT,
          title TEXT,
          content TEXT,
          metadata TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS vectors (
          id TEXT PRIMARY KEY,
          document_id TEXT,
          embedding BLOB,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_id);
        CREATE INDEX IF NOT EXISTS idx_vectors_document ON vectors(document_id);
      `);

      return db;
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND") {
        return null; // better-sqlite3 not installed
      }
      throw error;
    }
  }

  /**
   * Check if the store is available.
   */
  function isAvailable() {
    try {
      const database = ensureDb();
      return database !== null;
    } catch {
      return false;
    }
  }

  /**
   * Get store health/status.
   */
  function getReadiness() {
    const available = isAvailable();
    return {
      id: "sqlite-vec",
      status: available ? "ready" : "unavailable",
      configured: available,
      dbPath,
      dimension,
      reason: available
        ? "SQLite-vec vector store is ready for local vector storage."
        : "better-sqlite3 is not installed. Run: npm install better-sqlite3",
    };
  }

  /**
   * Insert or update a document with its vector embedding.
   * @param {Object} doc
   * @param {string} doc.id - Document ID
   * @param {string} doc.sourceId - Source ID
   * @param {string} doc.title - Document title
   * @param {string} doc.content - Document content
   * @param {Float32Array|number[]} doc.embedding - Vector embedding
   * @param {Object} doc.metadata - Additional metadata
   */
  function upsertDocument(doc) {
    const database = ensureDb();
    if (!database) throw new Error("SQLite-vec store not available");

    const metadataStr = doc.metadata ? JSON.stringify(doc.metadata) : null;
    const embeddingBuffer = Buffer.from(new Float32Array(doc.embedding).buffer);

    const upsertDoc = database.prepare(`
      INSERT OR REPLACE INTO documents (id, source_id, title, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const upsertVec = database.prepare(`
      INSERT OR REPLACE INTO vectors (id, document_id, embedding)
      VALUES (?, ?, ?)
    `);

    const transaction = database.transaction(() => {
      upsertDoc.run(doc.id, doc.sourceId || "default", doc.title || "", doc.content || "", metadataStr);
      upsertVec.run(`vec-${doc.id}`, doc.id, embeddingBuffer);
    });

    transaction();

    return { id: doc.id, stored: true };
  }

  /**
   * Batch insert documents with embeddings.
   * @param {Object[]} documents
   */
  function upsertDocuments(documents) {
    const database = ensureDb();
    if (!database) throw new Error("SQLite-vec store not available");

    const results = [];
    const transaction = database.transaction(() => {
      for (const doc of documents) {
        results.push(upsertDocument(doc));
      }
    });

    transaction();
    return results;
  }

  /**
   * Query similar vectors using cosine similarity.
   * @param {Float32Array|number[]} queryEmbedding
   * @param {Object} options
   * @param {number} options.topK - Number of results
   * @param {string[]} options.sourceIds - Filter by source IDs
   * @returns {Object[]} Results with similarity scores
   */
  function query(queryEmbedding, options = {}) {
    const database = ensureDb();
    if (!database) throw new Error("SQLite-vec store not available");

    const topK = options.topK || DEFAULT_TOP_K;
    const sourceFilter = options.sourceIds?.length
      ? `AND d.source_id IN (${options.sourceIds.map(() => "?").join(",")})`
      : "";

    // Get all vectors and compute cosine similarity in JS
    // (SQLite-vec extension would do this natively if available)
    const rows = database.prepare(`
      SELECT v.document_id, v.embedding, d.source_id, d.title, d.content, d.metadata
      FROM vectors v
      JOIN documents d ON v.document_id = d.id
      WHERE 1=1 ${sourceFilter}
    `).all(...(options.sourceIds || []));

    const queryVec = new Float32Array(queryEmbedding);
    const results = rows.map((row) => {
      const docVec = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
      const similarity = cosineSimilarity(queryVec, docVec);

      return {
        documentId: row.document_id,
        sourceId: row.source_id,
        title: row.title,
        content: row.content,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        score: similarity,
      };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((result, index) => ({ ...result, rank: index + 1 }));
  }

  /**
   * Delete a document and its vector.
   * @param {string} documentId
   */
  function deleteDocument(documentId) {
    const database = ensureDb();
    if (!database) throw new Error("SQLite-vec store not available");

    database.prepare("DELETE FROM documents WHERE id = ?").run(documentId);
    return { id: documentId, deleted: true };
  }

  /**
   * Get document count.
   */
  function getDocumentCount() {
    const database = ensureDb();
    if (!database) return 0;

    const row = database.prepare("SELECT COUNT(*) as count FROM documents").get();
    return row.count;
  }

  /**
   * Close the database connection.
   */
  function close() {
    if (db) {
      db.close();
      db = null;
    }
  }

  return {
    isAvailable,
    getReadiness,
    upsertDocument,
    upsertDocuments,
    query,
    deleteDocument,
    getDocumentCount,
    close,
  };
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
