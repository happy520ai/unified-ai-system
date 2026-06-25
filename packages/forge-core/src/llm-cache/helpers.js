/**
 * Helper functions and constants for the semantic-aware LLM response cache.
 * Extracted from index.js to keep the main class file under 500 lines.
 */

// ── Type definitions ──────────────────────────────────────────────────────

/**
 * @typedef {object} CacheEntry
 * @property {string} exactKey       — SHA-256 hash of the raw request
 * @property {string} fuzzyKey       — normalised key for similarity matching
 * @property {string} response       — cached LLM response text
 * @property {object} usage          — token-usage metadata from the provider
 * @property {number} cachedAt       — epoch ms when the entry was stored
 * @property {number} lastAccessedAt — epoch ms of the most recent access
 * @property {number} hitCount       — number of times this entry was read
 * @property {string} preview        — first 80 chars of the user prompt
 */

/**
 * @typedef {object} CacheHitResult
 * @property {string} response   — cached LLM response text
 * @property {object} usage      — token-usage metadata
 * @property {number} cachedAt   — original storage timestamp (ms since epoch)
 * @property {number} hitCount   — cumulative read count for this entry
 * @property {number} similarity — 1.0 for exact match, else fuzzy score (0-1)
 */

/**
 * @typedef {object} CacheSetResult
 * @property {boolean} evicted   — whether an LRU eviction occurred
 * @property {number}  cacheSize — total entries after insertion
 */

/**
 * @typedef {object} CacheStats
 * @property {number}   size           — current entry count
 * @property {number}   maxSize        — configured upper bound
 * @property {number}   hitRate        — hits / (hits + misses) (0-1)
 * @property {number}   hitCount       — cumulative hits
 * @property {number}   missCount      — cumulative misses
 * @property {number}   avgSimilarity  — average similarity of fuzzy hits
 * @property {number}   evictions      — cumulative LRU evictions
 * @property {number|null} oldestEntry — epoch ms of the oldest entry
 * @property {number|null} newestEntry — epoch ms of the newest entry
 * @property {Array<{ hash: string, hitCount: number, preview: string }>} topQueries
 */

/**
 * @typedef {object} SavingsResult
 * @property {number} tokensSaved       — total output tokens saved by hits
 * @property {number} estimatedCostSaved — tokensSaved * costPerToken
 * @property {number} hitRate            — cache hit rate (0-1)
 */

// ── Constants ─────────────────────────────────────────────────────────────

/** Default maximum number of cached entries. */
export const DEFAULT_MAX_SIZE = 5000;

/** Default time-to-live: 1 hour (3 600 000 ms). */
export const DEFAULT_TTL_MS = 3_600_000;

/** Default Jaccard similarity threshold for fuzzy matching. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Compute a 32-bit FNV-1a hash and return it as an 8-char hex string.
 *
 * @param {string} str — input string
 * @returns {string} — 8-character lowercase hex digest
 */
export function fnv1a(str) {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Normalise a prompt into a fuzzy-matching key.
 *
 * Steps:
 *   1. Lowercase the input
 *   2. Collapse whitespace runs to a single space
 *   3. Strip single-line comments (// ...) and block comments
 *   4. Extract the first sentence of each paragraph (split on double newline)
 *   5. Hash the result with FNV-1a
 *
 * @param {string} text — raw prompt text
 * @returns {string} — fuzzy key (8-char hex)
 */
export function normaliseToFuzzyKey(text) {
  if (!text) return '00000000';

  let normalised = text
    .toLowerCase()
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract first sentence of each paragraph.
  const paragraphs = normalised.split(/\n{2,}/);
  const keyPhrases = paragraphs
    .map((p) => {
      const firstSentence = p.split(/[.!?。！？]/)[0];
      return firstSentence ? firstSentence.trim() : p.trim();
    })
    .filter(Boolean);

  return fnv1a(keyPhrases.join(' '));
}

/**
 * Extract a word set from text for Jaccard similarity computation.
 *
 * Splits on whitespace and common punctuation, lowercases, and filters
 * tokens shorter than 2 characters.
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function wordSet(text) {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .split(/[\s,;:()\[\]{}"'`<>|/\\@#$%^&*+=~!?。！？、；：（）【】""''「」]+/)
      .filter((w) => w.length >= 2),
  );
}

/**
 * Detect code-specific tokens (function names, file paths, camelCase words).
 *
 * @param {string} text
 * @returns {Set<string>}
 */
export function codeTokens(text) {
  if (!text) return new Set();
  const tokens = new Set();

  // File paths (e.g. src/foo/bar.js)
  const pathRe = /[\w./\\-]+\.\w{1,5}/g;
  let m;
  while ((m = pathRe.exec(text)) !== null) {
    tokens.add(m[0].toLowerCase());
  }

  // camelCase / PascalCase identifiers
  const camelRe = /[a-z][a-zA-Z0-9]{3,}|[A-Z][a-zA-Z0-9]{2,}/g;
  while ((m = camelRe.exec(text)) !== null) {
    tokens.add(m[0].toLowerCase());
  }

  return tokens;
}

/**
 * Compute Jaccard similarity between two prompt strings, with a bonus for
 * matching code-specific tokens.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} — similarity score in [0, 1]
 */
export function computeSimilarity(a, b) {
  const setA = wordSet(a);
  const setB = wordSet(b);

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  const jaccard = union > 0 ? intersection / union : 0;

  // Code-token bonus: up to 0.1 additional similarity.
  const codeA = codeTokens(a);
  const codeB = codeTokens(b);
  let codeIntersection = 0;
  for (const w of codeA) {
    if (codeB.has(w)) codeIntersection++;
  }
  const codeUnion = codeA.size + codeB.size - codeIntersection;
  const codeBonus = codeUnion > 0 ? (codeIntersection / codeUnion) * 0.1 : 0;

  return Math.min(1, jaccard + codeBonus);
}
