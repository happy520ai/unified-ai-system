/**
 * Local SQLite vector storage with JavaScript cosine ranking.
 * The legacy sqlite-vec identifier does not imply a native vec extension.
 * No external database required - works with local SQLite file.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = ".data/knowledge/vectors.sqlite";
const DEFAULT_DIMENSION = 384; // MiniLM-L6 default
const DEFAULT_TOP_K = 5;

export function safeParseMetadata(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * Create a SQLite-vec vector store instance.
 * @param {Object} options
 * @param {string} options.dbPath - Path to SQLite database file
 * @param {number} options.dimension - Vector dimension
 */
export function createSqliteVecStore(options = {}) {
  const requestedDbPath = options.dbPath || DEFAULT_DB_PATH;
  const dbPath = requestedDbPath === ":memory:" ? requestedDbPath : resolve(requestedDbPath);
  const dimension = options.dimension ?? DEFAULT_DIMENSION;
  if (!Number.isSafeInteger(dimension) || dimension < 1 || dimension > 65_536) {
    throw vectorError("DIMENSION_INVALID", "Vector dimension must be an integer from 1 to 65536.");
  }
  let db = null;

  function ensureDb() {
    if (db) return db;

    let candidate;
    try {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      candidate = new DatabaseSync(dbPath);
      candidate.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");

      // Create tables if not exist
      candidate.exec(`
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

      db = candidate;
      return db;
    } catch (error) {
      candidate?.close();
      throw vectorError("STORAGE_UNAVAILABLE", "Local vector storage could not be opened.", error);
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
      implementation: "node-sqlite-js-cosine",
      nativeVectorExtension: false,
      dbPath,
      dimension,
      reason: available
        ? "Local SQLite vector storage with JavaScript cosine ranking is ready."
        : "Local vector storage is unavailable; check its configured path and permissions.",
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
    validateDocument(doc);
    const database = ensureDb();
    transaction(database, () => writeDocument(database, doc));
    return { id: doc.id, stored: true };
  }

  function writeDocument(database, doc) {
    const metadataStr = doc.metadata ? JSON.stringify(doc.metadata) : null;
    const embeddingBuffer = Buffer.alloc(dimension * 4);
    for (let index = 0; index < dimension; index++) embeddingBuffer.writeFloatLE(doc.embedding[index], index * 4);

    const upsertDoc = database.prepare(`
      INSERT OR REPLACE INTO documents (id, source_id, title, content, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const upsertVec = database.prepare(`
      INSERT OR REPLACE INTO vectors (id, document_id, embedding)
      VALUES (?, ?, ?)
    `);

    upsertDoc.run(doc.id, doc.sourceId || "default", doc.title || "", doc.content || "", metadataStr);
    upsertVec.run(`vec-${doc.id}`, doc.id, embeddingBuffer);
  }

  /**
   * Batch insert documents with embeddings.
   * @param {Object[]} documents
   */
  function upsertDocuments(documents) {
    if (!Array.isArray(documents)) throw vectorError("DOCUMENT_INVALID", "Vector documents must be an array.");
    documents.forEach(validateDocument);
    const database = ensureDb();
    transaction(database, () => {
      for (const doc of documents) writeDocument(database, doc);
    });
    return documents.map(doc => ({ id: doc.id, stored: true }));
  }

  /**
   * Query similar vectors using cosine similarity.
   * @param {Float32Array|number[]} queryEmbedding
   * @param {Object} options
   * @param {number} [options.topK] - Number of results
   * @param {string[]} [options.sourceIds] - Filter by source IDs
   * @param {string[]} [options.documentIds] - Trusted visible document IDs, before ranking
   * @returns {{ documentId: string, sourceId: string, title: string, content: string, metadata: object, score: number, rank: number }[]} Results with similarity scores
   */
  function query(queryEmbedding, options = {}) {
    validateVector(queryEmbedding);
    const database = ensureDb();
    const topK = options.topK ?? DEFAULT_TOP_K;
    if (!Number.isSafeInteger(topK) || topK < 1 || topK > 10_000) throw vectorError("QUERY_INVALID", "Vector topK must be an integer from 1 to 10000.");
    for (const ids of [options.sourceIds, options.documentIds]) {
      if (ids !== undefined && (!Array.isArray(ids) || !ids.every(id => typeof id === "string"))) throw vectorError("QUERY_INVALID", "Vector filters must be arrays of IDs.");
    }
    const allowed = options.documentIds === undefined ? null : new Set(options.documentIds);
    if (allowed?.size === 0) return [];
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
    const results = rows.filter(row => !allowed || allowed.has(row.document_id)).map((row) => {
      if (!(row.embedding instanceof Uint8Array) || row.embedding.byteLength !== dimension * 4) throw vectorError("DIMENSION_MISMATCH", "Stored vector dimensions do not match the configured embedding model.");
      const buffer = Buffer.from(row.embedding);
      const docVec = Array.from({ length: dimension }, (_, index) => buffer.readFloatLE(index * 4));
      validateVector(docVec);
      const similarity = cosineSimilarity(queryVec, docVec);

      return {
        documentId: row.document_id,
        sourceId: row.source_id,
        title: row.title,
        content: row.content,
        metadata: safeParseMetadata(row.metadata),
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

  function validateVector(vector) {
    if ((!Array.isArray(vector) && !(vector instanceof Float32Array)) || vector.length !== dimension
      || !Array.from(vector).every(value => typeof value === "number" && Number.isFinite(value) && Number.isFinite(Math.fround(value)))) {
      throw vectorError("EMBEDDING_INVALID", "Embedding must contain the configured number of finite Float32 values.");
    }
  }

  function validateDocument(doc) {
    if (!doc || typeof doc.id !== "string" || doc.id.length === 0) throw vectorError("DOCUMENT_INVALID", "Vector documents require a non-empty ID.");
    validateVector(doc.embedding);
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

function transaction(database, operation) {
  database.exec("BEGIN IMMEDIATE");
  try {
    operation();
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* Keep the original failure. */ }
    throw vectorError("WRITE_FAILED", "Local vector storage could not commit the document batch.", error);
  }
}

function vectorError(suffix, message, cause) {
  return Object.assign(new Error(message, cause ? { cause } : undefined), { code: `KNOWLEDGE_VECTOR_${suffix}` });
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
