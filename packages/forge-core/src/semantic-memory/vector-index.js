// VectorIndex -- stores vectors and performs similarity search.
// Extracted from helpers.js to keep the helpers module under 500 lines.

import { DEFAULT_MAX_RESULTS, DEFAULT_MIN_SIMILARITY, Vectorizer } from './helpers.js';

/**
 * @typedef {object} IndexedDocument
 * @property {string} id -- document identifier
 * @property {string} content -- original text content
 * @property {object} metadata -- user-supplied metadata
 * @property {Map<number, number>} vector -- sparse vector representation
 * @property {string[]} terms -- tokenized terms (for vocabulary removal)
 */

/**
 * @typedef {object} SearchResult
 * @property {string} id -- document identifier
 * @property {number} score -- cosine similarity score (0-1)
 * @property {string} content -- original text content
 * @property {object} metadata -- user-supplied metadata
 */

export class VectorIndex {
  /**
   * Map of document id -> IndexedDocument.
   * @type {Map<string, IndexedDocument>}
   */
  #documents = new Map();

  /**
   * Retrieve a stored document by id.
   * @param {string} id
   * @returns {IndexedDocument|undefined}
   */
  get(id) {
    return this.#documents.get(id);
  }

  /**
   * Check whether a document exists in the index.
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.#documents.has(id);
  }

  /**
   * Store a document and its vector in the index.
   * @param {IndexedDocument} doc
   */
  set(doc) {
    this.#documents.set(doc.id, doc);
  }

  /**
   * Remove a document from the index.
   * @param {string} id
   * @returns {IndexedDocument|undefined} the removed document, or undefined
   */
  delete(id) {
    const doc = this.#documents.get(id);
    if (doc) {
      this.#documents.delete(id);
    }
    return doc;
  }

  /**
   * Search the index by cosine similarity against a query vector.
   *
   * @param {Map<number, number>} queryVec -- sparse query vector
   * @param {object} [opts]
   * @param {number} [opts.limit] -- max results to return
   * @param {number} [opts.minSimilarity] -- minimum similarity threshold
   * @param {object} [opts.metadataFilter] -- key-value pairs that must match
   * @returns {SearchResult[]} results sorted by descending score
   */
  search(queryVec, opts = {}) {
    const limit = opts.limit ?? DEFAULT_MAX_RESULTS;
    const minSim = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
    const filter = opts.metadataFilter || null;

    const scored = [];

    for (const doc of this.#documents.values()) {
      // Apply metadata filter before computing similarity (saves work)
      if (filter && !this.#matchesFilter(doc.metadata, filter)) {
        continue;
      }

      const score = Vectorizer.cosineSimilarity(queryVec, doc.vector);
      if (score >= minSim) {
        scored.push({ id: doc.id, score, content: doc.content, metadata: doc.metadata });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Check whether a document's metadata satisfies all filter key-value pairs.
   *
   * @param {object} metadata
   * @param {object} filter
   * @returns {boolean}
   */
  #matchesFilter(metadata, filter) {
    if (!metadata || typeof metadata !== 'object') return false;
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) return false;
    }
    return true;
  }

  /**
   * Total number of documents in the index.
   * @returns {number}
   */
  get size() {
    return this.#documents.size;
  }

  /** Iterate over all stored documents. */
  values() {
    return this.#documents.values();
  }

  /** Clear all stored documents. */
  clear() {
    this.#documents.clear();
  }

  /**
   * Export index state for persistence.
   * Sparse vectors are serialized as arrays of [dim, weight] pairs.
   *
   * @returns {Array<object>}
   */
  exportState() {
    const entries = [];
    for (const doc of this.#documents.values()) {
      entries.push({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        terms: doc.terms,
        vector: [...doc.vector.entries()],
      });
    }
    return entries;
  }

  /**
   * Import previously exported index state.
   * @param {Array<object>} entries
   */
  importState(entries) {
    this.#documents.clear();
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      this.#documents.set(entry.id, {
        id: entry.id,
        content: entry.content,
        metadata: entry.metadata || {},
        terms: entry.terms || [],
        vector: new Map(entry.vector || []),
      });
    }
  }
}
