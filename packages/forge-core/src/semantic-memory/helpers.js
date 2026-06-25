// SemanticMemory helpers -- constants, pure functions, and internal classes.
// Extracted from index.js to keep the public API module under 500 lines.

// -- Constants ----------------------------------------------------------------

/**
 * Common English stop words that carry little semantic weight.
 * Filtered during tokenization to reduce noise.
 * @type {Set<string>}
 */
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their',
  'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'not',
  'no', 'nor', 'so', 'if', 'then', 'than', 'too', 'very', 'just', 'about',
  'above', 'after', 'again', 'all', 'also', 'am', 'any', 'because', 'before',
  'between', 'both', 'each', 'few', 'get', 'got', 'here', 'into', 'more',
  'most', 'other', 'out', 'over', 'own', 'same', 'some', 'such', 'there',
  'through', 'under', 'until', 'up', 'while', 'down', 'during', 'only',
]);

/** Default vector dimensionality after hash-based reduction. */
export const DEFAULT_DIMENSIONS = 256;

/** Default minimum cosine similarity threshold. */
export const DEFAULT_MIN_SIMILARITY = 0.1;

/** Default maximum number of search results. */
export const DEFAULT_MAX_RESULTS = 20;

/** Default character n-gram sizes for fuzzy matching. */
export const DEFAULT_NGRAM_SIZES = [2, 3, 4];

// -- Pure Functions -----------------------------------------------------------

let _idSeq = 0;

/**
 * Generate a unique internal identifier.
 * @returns {string}
 */
export function genId() {
  return `sm_${Date.now()}_${++_idSeq}`;
}

/**
 * Simple polynomial rolling hash that maps a string to a non-negative integer.
 * Used for dimensionality reduction (feature hashing / the "hashing trick").
 *
 * @param {string} str -- the string to hash
 * @param {number} buckets -- number of output buckets (vector dimensions)
 * @returns {number} integer in [0, buckets)
 */
export function featureHash(str, buckets) {
  let h = 2166136261; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  // Ensure non-negative and within bucket range
  return (h >>> 0) % buckets;
}

/**
 * Signed variant of the feature hash.  Returns +1 or -1 to reduce
 * collisions when accumulating hashed features into a vector.
 *
 * @param {string} str
 * @returns {number} +1 or -1
 */
export function signedHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (h & 1) === 0 ? 1 : -1;
}

// -- Tokenizer ---------------------------------------------------------------

/**
 * Tokenize a text string into lowercased terms, stripping punctuation and
 * filtering out stop words and very short tokens.
 *
 * @param {string} text -- input text
 * @returns {string[]} array of tokens
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  // Split on whitespace and common punctuation, lowercase
  const raw = text
    .toLowerCase()
    .split(/[\s,.:;!?()[\]{}"'`~@#$%^&*+=|\\/<>_-]+/)
    .filter(Boolean);

  return raw.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// =============================================================================
//  VocabularyBuilder -- tracks term document-frequency across the corpus
// =============================================================================

/**
 * @typedef {object} VocabularyStats
 * @property {number} termCount -- total unique terms in vocabulary
 * @property {number} documentCount -- total indexed documents
 */

export class VocabularyBuilder {
  /**
   * Map of term -> document frequency (number of documents containing the term).
   * @type {Map<string, number>}
   */
  #df = new Map();

  /**
   * Set of document IDs that have been registered.
   * @type {Set<string>}
   */
  #docIds = new Set();

  /**
   * Register a document's terms so their DF counts are updated.
   *
   * @param {string} docId -- unique document identifier
   * @param {string[]} terms -- tokenized terms from the document
   */
  addDocument(docId, terms) {
    if (this.#docIds.has(docId)) {
      this.removeDocument(docId);
    }
    this.#docIds.add(docId);
    // Each term contributes +1 DF regardless of how many times it appears
    // within the same document.
    const seen = new Set();
    for (const term of terms) {
      if (!seen.has(term)) {
        seen.add(term);
        this.#df.set(term, (this.#df.get(term) || 0) + 1);
      }
    }
  }

  /**
   * Remove a document's terms from the DF counts.
   *
   * @param {string} docId
   * @param {string[]} terms -- the terms originally in the document
   */
  removeDocument(docId, terms) {
    if (!this.#docIds.has(docId)) return;
    this.#docIds.delete(docId);
    if (terms) {
      const seen = new Set();
      for (const term of terms) {
        if (!seen.has(term)) {
          seen.add(term);
          const count = (this.#df.get(term) || 1) - 1;
          if (count <= 0) {
            this.#df.delete(term);
          } else {
            this.#df.set(term, count);
          }
        }
      }
    }
  }

  /**
   * Compute the IDF weight for a given term.
   * IDF = log(N / df) where N = total documents, df = docs containing term.
   *
   * @param {string} term
   * @returns {number} IDF weight (>= 0)
   */
  idf(term) {
    const df = this.#df.get(term);
    if (!df) return 0;
    return Math.log(this.#docIds.size / df);
  }

  /**
   * Total number of indexed documents.
   * @returns {number}
   */
  get documentCount() {
    return this.#docIds.size;
  }

  /**
   * Total number of unique terms in the vocabulary.
   * @returns {number}
   */
  get termCount() {
    return this.#df.size;
  }

  /**
   * Export internal state for persistence.
   * @returns {{ df: Record<string, number>, docIds: string[] }}
   */
  exportState() {
    return {
      df: Object.fromEntries(this.#df),
      docIds: [...this.#docIds],
    };
  }

  /**
   * Import previously exported state, replacing current data.
   * @param {{ df: Record<string, number>, docIds: string[] }} state
   */
  importState(state) {
    this.#df.clear();
    this.#docIds.clear();
    if (state.df && typeof state.df === 'object') {
      for (const [term, count] of Object.entries(state.df)) {
        this.#df.set(term, count);
      }
    }
    if (Array.isArray(state.docIds)) {
      for (const id of state.docIds) {
        this.#docIds.add(id);
      }
    }
  }

  /** Clear all vocabulary data. */
  clear() {
    this.#df.clear();
    this.#docIds.clear();
  }
}

// =============================================================================
//  Vectorizer -- converts text to fixed-size sparse vectors
// =============================================================================

export class Vectorizer {
  /** @type {VocabularyBuilder} */
  #vocab;

  /** @type {number} */
  #dimensions;

  /** @type {number[]} */
  #ngramSizes;

  /**
   * @param {object} opts
   * @param {VocabularyBuilder} opts.vocab -- shared vocabulary builder
   * @param {number} opts.dimensions -- target vector dimensionality
   * @param {number[]} opts.ngramSizes -- character n-gram sizes
   */
  constructor({ vocab, dimensions, ngramSizes }) {
    this.#vocab = vocab;
    this.#dimensions = dimensions;
    this.#ngramSizes = ngramSizes;
  }

  /**
   * Extract character n-grams from a string.
   *
   * @param {string} text
   * @returns {string[]} array of n-gram strings
   */
  #extractNgrams(text) {
    const lower = text.toLowerCase();
    const ngrams = [];
    for (const size of this.#ngramSizes) {
      for (let i = 0; i <= lower.length - size; i++) {
        ngrams.push(lower.slice(i, i + size));
      }
    }
    return ngrams;
  }

  /**
   * Compute term frequency (TF) for an array of tokens.
   * TF = count(term) / total_terms
   *
   * @param {string[]} tokens
   * @returns {Map<string, number>}
   */
  #termFrequency(tokens) {
    const counts = new Map();
    for (const t of tokens) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    const total = tokens.length || 1;
    for (const [term, count] of counts) {
      counts.set(term, count / total);
    }
    return counts;
  }

  /**
   * Vectorize a piece of text into a sparse vector (Map<dimension, weight>).
   *
   * The vector combines:
   *   1. TF-IDF weighted term features (hashed to fixed dimensions)
   *   2. Character n-gram features (hashed to fixed dimensions)
   *
   * @param {string} text -- input text
   * @returns {Map<number, number>} sparse vector: dimension index -> weight
   */
  vectorize(text) {
    const vector = new Map();
    const tokens = tokenize(text);
    const tf = this.#termFrequency(tokens);

    // -- TF-IDF term features --
    for (const [term, freq] of tf) {
      const idf = this.#vocab.idf(term);
      const weight = freq * idf;
      if (weight === 0) continue;
      const dim = featureHash(`term:${term}`, this.#dimensions);
      const sign = signedHash(`term:${term}`);
      vector.set(dim, (vector.get(dim) || 0) + weight * sign);
    }

    // -- Character n-gram features --
    const ngrams = this.#extractNgrams(text);
    const ngramTotal = ngrams.length || 1;
    const ngramCounts = new Map();
    for (const ng of ngrams) {
      ngramCounts.set(ng, (ngramCounts.get(ng) || 0) + 1);
    }
    for (const [ng, count] of ngramCounts) {
      const freq = count / ngramTotal;
      // N-grams use a fixed weight scaled down relative to TF-IDF terms
      const weight = freq * 0.5;
      const dim = featureHash(`ngram:${ng}`, this.#dimensions);
      const sign = signedHash(`ngram:${ng}`);
      vector.set(dim, (vector.get(dim) || 0) + weight * sign);
    }

    return vector;
  }

  /**
   * Compute the L2 norm (magnitude) of a sparse vector.
   *
   * @param {Map<number, number>} vec
   * @returns {number}
   */
  static magnitude(vec) {
    let sum = 0;
    for (const v of vec.values()) {
      sum += v * v;
    }
    return Math.sqrt(sum);
  }

  /**
   * Compute cosine similarity between two sparse vectors.
   * Returns a value in [-1, 1]; in practice TF-IDF vectors are non-negative
   * so results will be in [0, 1].
   *
   * @param {Map<number, number>} a
   * @param {Map<number, number>} b
   * @returns {number} cosine similarity
   */
  static cosineSimilarity(a, b) {
    if (a.size === 0 || b.size === 0) return 0;

    let dot = 0;
    // Iterate over the smaller map for efficiency
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    for (const [dim, val] of small) {
      const other = large.get(dim);
      if (other !== undefined) {
        dot += val * other;
      }
    }

    const magA = Vectorizer.magnitude(a);
    const magB = Vectorizer.magnitude(b);
    if (magA === 0 || magB === 0) return 0;
    return dot / (magA * magB);
  }
}
