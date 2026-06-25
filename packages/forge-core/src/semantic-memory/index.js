/**
 * SemanticMemory -- embedding-based vector similarity search for the MemoryEngine.
 *
 * Provides a fully local semantic search engine that does NOT depend on external
 * embedding APIs.  Instead it builds TF-IDF-weighted sparse vectors augmented
 * with character n-gram features and uses cosine similarity for retrieval.
 *
 * Architecture:
 *   +---------------------------------------------------------------+
 *   |  VocabularyBuilder                                            |
 *   |  Builds a term vocabulary from all stored documents and       |
 *   |  tracks document frequency (DF) for IDF computation.          |
 *   +---------------------------------------------------------------+
 *   |  Vectorizer                                                   |
 *   |  Converts text to fixed-size sparse vectors using:            |
 *   |    1. TF-IDF weighted term vectors                            |
 *   |    2. Character n-grams (size 2-4) for fuzzy matching         |
 *   |    3. Hash-based dimensionality reduction                     |
 *   +---------------------------------------------------------------+
 *   |  VectorIndex                                                  |
 *   |  Stores sparse vectors and performs cosine similarity search   |
 *   |  with optional metadata filtering.                            |
 *   +---------------------------------------------------------------+
 *
 * Usage:
 *   const sm = new SemanticMemory({ dimensions: 256 });
 *   sm.index('doc1', 'The quick brown fox jumps over the lazy dog');
 *   sm.index('doc2', 'A lazy cat sleeps on the warm sofa');
 *   const results = sm.search('lazy animal', { limit: 5 });
 */

import {
  DEFAULT_DIMENSIONS,
  DEFAULT_MIN_SIMILARITY,
  DEFAULT_MAX_RESULTS,
  DEFAULT_NGRAM_SIZES,
  tokenize,
  VocabularyBuilder,
  Vectorizer,
} from './helpers.js';

import { VectorIndex } from './vector-index.js';

// =============================================================================
//  SemanticMemory -- public API
// =============================================================================

/**
 * @typedef {object} SemanticMemoryOptions
 * @property {number} [dimensions=256] -- fixed vector dimensionality
 * @property {number} [minSimilarity=0.1] -- default minimum cosine similarity
 * @property {number} [maxResults=20] -- default maximum search results
 * @property {number[]} [ngramSize=[2,3,4]] -- character n-gram sizes
 */

/**
 * @typedef {object} IndexResult
 * @property {string} id -- document identifier
 * @property {number} dimensions -- vector dimensionality
 * @property {number} vectorSize -- number of non-zero dimensions in the vector
 */

/**
 * @typedef {object} IndexStats
 * @property {number} documents -- number of indexed documents
 * @property {number} vocabulary -- number of unique terms in vocabulary
 * @property {number} avgVectorSize -- average non-zero dimensions per vector
 * @property {number} dimensions -- configured vector dimensionality
 */

export class SemanticMemory {
  /** @type {number} */
  #dimensions;

  /** @type {number} */
  #minSimilarity;

  /** @type {number} */
  #maxResults;

  /** @type {number[]} */
  #ngramSizes;

  /** @type {VocabularyBuilder} */
  #vocab;

  /** @type {Vectorizer} */
  #vectorizer;

  /** @type {VectorIndex} */
  #index;

  /**
   * Create a new SemanticMemory instance.
   *
   * @param {Partial<SemanticMemoryOptions>} [opts]
   */
  constructor(opts = {}) {
    this.#dimensions = opts.dimensions ?? DEFAULT_DIMENSIONS;
    this.#minSimilarity = opts.minSimilarity ?? DEFAULT_MIN_SIMILARITY;
    this.#maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;
    this.#ngramSizes = opts.ngramSize ?? DEFAULT_NGRAM_SIZES;

    this.#vocab = new VocabularyBuilder();
    this.#vectorizer = new Vectorizer({
      vocab: this.#vocab,
      dimensions: this.#dimensions,
      ngramSizes: this.#ngramSizes,
    });
    this.#index = new VectorIndex();
  }

  // -- Core Operations --------------------------------------------------------

  /**
   * Index a document for later semantic search.
   *
   * If a document with the same `id` already exists it is replaced and the
   * vocabulary is updated accordingly.
   *
   * @param {string} id -- unique document identifier
   * @param {string} content -- text content to index
   * @param {object} [metadata={}] -- arbitrary metadata attached to the document
   * @returns {IndexResult} summary of the indexed document
   */
  index(id, content, metadata = {}) {
    // Remove previous version if re-indexing the same id
    if (this.#index.has(id)) {
      this.remove(id);
    }

    const terms = tokenize(content);

    // Register terms in the vocabulary (updates DF counts)
    this.#vocab.addDocument(id, terms);

    // Build the sparse vector
    const vector = this.#vectorizer.vectorize(content);

    // Store in the index
    this.#index.set({
      id,
      content,
      metadata,
      vector,
      terms,
    });

    return { id, dimensions: this.#dimensions, vectorSize: vector.size };
  }

  /**
   * Remove a document from the index.
   *
   * @param {string} id -- document identifier
   * @returns {boolean} true if the document was found and removed
   */
  remove(id) {
    const doc = this.#index.delete(id);
    if (!doc) return false;

    // Update vocabulary DF counts
    this.#vocab.removeDocument(id, doc.terms);
    return true;
  }

  /**
   * Search for documents by semantic similarity to a query string.
   *
   * @param {string} query -- search query text
   * @param {object} [opts]
   * @param {number} [opts.limit] -- max results (defaults to constructor maxResults)
   * @param {number} [opts.minSimilarity] -- similarity threshold (defaults to constructor minSimilarity)
   * @param {object} [opts.metadataFilter] -- key-value pairs that results must match
   * @returns {SearchResult[]} results sorted by descending similarity score
   */
  search(query, opts = {}) {
    const limit = opts.limit ?? this.#maxResults;
    const minSimilarity = opts.minSimilarity ?? this.#minSimilarity;
    const metadataFilter = opts.metadataFilter ?? null;

    // Vectorize the query using the existing vocabulary for IDF weights
    const queryVec = this.#vectorizer.vectorize(query);

    return this.#index.search(queryVec, {
      limit,
      minSimilarity,
      metadataFilter,
    });
  }

  /**
   * Batch-index multiple documents at once.
   *
   * @param {Array<{ id: string, content: string, metadata?: object }>} documents
   * @returns {number} number of documents successfully indexed
   */
  indexBatch(documents) {
    if (!Array.isArray(documents)) return 0;
    let count = 0;
    for (const doc of documents) {
      if (doc && doc.id && doc.content != null) {
        this.index(doc.id, doc.content, doc.metadata || {});
        count++;
      }
    }
    return count;
  }

  // -- Statistics & Management ------------------------------------------------

  /**
   * Get index statistics.
   *
   * @returns {IndexStats}
   */
  getStats() {
    const docCount = this.#index.size;
    let totalVectorSize = 0;
    for (const doc of this.#index.values()) {
      totalVectorSize += doc.vector.size;
    }
    const avgVectorSize = docCount > 0 ? Math.round(totalVectorSize / docCount) : 0;

    return {
      documents: docCount,
      vocabulary: this.#vocab.termCount,
      avgVectorSize,
      dimensions: this.#dimensions,
    };
  }

  /**
   * Clear all indexed documents and reset the vocabulary.
   */
  clear() {
    this.#index.clear();
    this.#vocab.clear();
  }

  /**
   * Rebuild the entire index by recomputing IDF weights from scratch.
   *
   * This is useful after a large batch of insertions or deletions to ensure
   * that IDF weights accurately reflect the current corpus.
   *
   * @returns {{ documents: number, vocabulary: number }}
   */
  rebuild() {
    // Collect all documents before clearing
    const docs = [];
    for (const doc of this.#index.values()) {
      docs.push({ id: doc.id, content: doc.content, metadata: doc.metadata });
    }

    // Clear and re-index everything
    this.clear();
    for (const doc of docs) {
      this.index(doc.id, doc.content, doc.metadata);
    }

    return {
      documents: this.#index.size,
      vocabulary: this.#vocab.termCount,
    };
  }

  // -- Persistence ------------------------------------------------------------

  /**
   * Export the full index state for serialization / persistence.
   *
   * The returned object can be passed to `importState()` to restore the index.
   *
   * @returns {object} serializable state object
   */
  exportState() {
    return {
      config: {
        dimensions: this.#dimensions,
        minSimilarity: this.#minSimilarity,
        maxResults: this.#maxResults,
        ngramSizes: [...this.#ngramSizes],
      },
      vocabulary: this.#vocab.exportState(),
      index: this.#index.exportState(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import a previously exported state, replacing all current data.
   *
   * After importing, call `rebuild()` if you want to recompute IDF weights
   * from the restored corpus.
   *
   * @param {object} state -- state object from `exportState()`
   */
  importState(state) {
    if (!state || typeof state !== 'object') return;

    // Restore configuration if present
    if (state.config && typeof state.config === 'object') {
      this.#dimensions = state.config.dimensions ?? this.#dimensions;
      this.#minSimilarity = state.config.minSimilarity ?? this.#minSimilarity;
      this.#maxResults = state.config.maxResults ?? this.#maxResults;
      this.#ngramSizes = state.config.ngramSizes ?? this.#ngramSizes;

      // Rebuild vectorizer with possibly new dimensions / ngram sizes
      this.#vectorizer = new Vectorizer({
        vocab: this.#vocab,
        dimensions: this.#dimensions,
        ngramSizes: this.#ngramSizes,
      });
    }

    // Restore vocabulary
    if (state.vocabulary) {
      this.#vocab.importState(state.vocabulary);
    }

    // Restore index
    if (state.index) {
      this.#index.importState(state.index);
    }
  }
}
