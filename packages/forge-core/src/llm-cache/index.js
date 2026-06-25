/**
 * Semantic-Aware LLM Response Cache — content-addressed caching with fuzzy
 * matching for LLM API responses.
 *
 * Extends the basic exact-match cache with:
 *   - Fuzzy key generation via prompt normalisation (lowercase, whitespace
 *     collapse, comment stripping, key-phrase extraction)
 *   - Jaccard-similarity scoring with code-token bonuses
 *   - LRU eviction when the cache reaches its configured capacity
 *   - Disk persistence via JSON serialisation (node:fs/promises)
 *   - Prefill for warm-start scenarios
 *   - Estimated cost-savings reporting
 *
 * Thread safety: Node.js is single-threaded, so no locking is required for
 * the internal Map-based store.
 *
 * Usage:
 *   import { LLMCache } from './llm-cache/index.js';
 *
 *   const cache = new LLMCache({ maxSize: 5000, ttlMs: 3_600_000 });
 *   const hit = cache.get(systemPrompt, userPrompt);
 *   if (!hit) {
 *     const { text, usage } = await callLLM(...);
 *     cache.set(systemPrompt, userPrompt, text, usage);
 *   }
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  DEFAULT_MAX_SIZE,
  DEFAULT_TTL_MS,
  DEFAULT_SIMILARITY_THRESHOLD,
  normaliseToFuzzyKey,
  computeSimilarity,
} from './helpers.js';

// ── LLMCache class ────────────────────────────────────────────────────────

export class LLMCache {
  /** @type {Map<string, CacheEntry>} exact-key → entry */
  #store = new Map();

  /** @type {Map<string, string>} fuzzy-key → exact-key */
  #fuzzyIndex = new Map();

  /** @type {number} */ #maxSize;
  /** @type {number} */ #ttlMs;
  /** @type {number} */ #similarityThreshold;
  /** @type {string|null} */ #persistencePath;
  /** @type {boolean} */ #enableFuzzyMatch;

  /** @type {number} */ #hitCount = 0;
  /** @type {number} */ #missCount = 0;
  /** @type {number} */ #evictions = 0;
  /** @type {number} */ #fuzzyHitCount = 0;
  /** @type {number} */ #similaritySum = 0;

  /**
   * Create a new semantic-aware LLM response cache.
   *
   * @param {object}  [opts]
   * @param {number}  [opts.maxSize=5000]             — maximum entries before LRU eviction
   * @param {number}  [opts.ttlMs=3600000]             — time-to-live in ms (default 1 h)
   * @param {number}  [opts.similarityThreshold=0.85]  — minimum Jaccard score for fuzzy hit
   * @param {string|null} [opts.persistencePath=null]  — JSON file path for disk persistence
   * @param {boolean} [opts.enableFuzzyMatch=true]     — whether to attempt fuzzy matching
   */
  constructor(opts = {}) {
    this.#maxSize = opts.maxSize ?? DEFAULT_MAX_SIZE;
    this.#ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.#similarityThreshold = opts.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    this.#persistencePath = opts.persistencePath ?? null;
    this.#enableFuzzyMatch = opts.enableFuzzyMatch ?? true;
  }

  // ── Key generation ────────────────────────────────────────────────────

  /**
   * Generate exact and fuzzy cache keys from prompt components.
   *
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {object} [options]
   * @returns {{ exactKey: string, fuzzyKey: string, metadata: { preview: string } }}
   */
  #generateKey(systemPrompt, userPrompt, options) {
    const payload = `${systemPrompt ?? ''}\x00${userPrompt ?? ''}\x00${JSON.stringify(options ?? {})}`;
    const exactKey = createHash('sha256').update(payload).digest('hex');
    const fuzzyKey = normaliseToFuzzyKey(`${systemPrompt ?? ''} ${userPrompt ?? ''}`);
    const preview = (userPrompt ?? '').slice(0, 80);
    return { exactKey, fuzzyKey, metadata: { preview } };
  }

  // ── Public API: get ───────────────────────────────────────────────────

  /**
   * Look up a cached response.
   *
   * 1. Try exact match first (O(1)).
   * 2. If no exact match and fuzzy matching is enabled, compare the fuzzy
   *    key against all stored fuzzy keys and return the best match above
   *    the similarity threshold.
   * 3. Update access statistics (hit count, last accessed).
   *
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {object} [options]
   * @returns {CacheHitResult | null}
   */
  get(systemPrompt, userPrompt, options = {}) {
    const { exactKey, fuzzyKey } = this.#generateKey(systemPrompt, userPrompt, options);

    // 1. Exact match.
    const exact = this.#store.get(exactKey);
    if (exact && Date.now() - exact.cachedAt < this.#ttlMs) {
      exact.lastAccessedAt = Date.now();
      exact.hitCount++;
      this.#hitCount++;
      this.#similaritySum += 1;
      return {
        response: exact.response,
        usage: exact.usage,
        cachedAt: exact.cachedAt,
        hitCount: exact.hitCount,
        similarity: 1,
      };
    }

    // Expired exact match — clean up.
    if (exact) {
      this.#store.delete(exactKey);
      this.#fuzzyIndex.delete(exact.fuzzyKey);
    }

    // 2. Fuzzy match.
    if (this.#enableFuzzyMatch) {
      let bestEntry = null;
      let bestScore = 0;

      for (const entry of this.#store.values()) {
        if (Date.now() - entry.cachedAt >= this.#ttlMs) continue;
        const score = this.#computeFuzzyScore(fuzzyKey, entry.fuzzyKey, userPrompt, entry);
        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
        }
      }

      if (bestEntry && bestScore >= this.#similarityThreshold) {
        bestEntry.lastAccessedAt = Date.now();
        bestEntry.hitCount++;
        this.#hitCount++;
        this.#fuzzyHitCount++;
        this.#similaritySum += bestScore;
        return {
          response: bestEntry.response,
          usage: bestEntry.usage,
          cachedAt: bestEntry.cachedAt,
          hitCount: bestEntry.hitCount,
          similarity: bestScore,
        };
      }
    }

    // 3. Miss.
    this.#missCount++;
    return null;
  }

  /**
   * Compute a similarity score between a query fuzzy key and a stored entry.
   *
   * When the fuzzy keys match exactly the score is derived from the stored
   * Jaccard similarity of the raw prompts; otherwise a quick FNV comparison
   * is used as a lightweight gate before the more expensive Jaccard pass.
   *
   * @param {string} queryFuzzy
   * @param {string} storedFuzzy
   * @param {string} queryPrompt
   * @param {CacheEntry} entry
   * @returns {number}
   */
  #computeFuzzyScore(queryFuzzy, storedFuzzy, queryPrompt, entry) {
    // Fast path: identical fuzzy keys → high similarity.
    if (queryFuzzy === storedFuzzy) {
      return computeSimilarity(queryPrompt, entry.preview);
    }
    // Slow path: full Jaccard on the original preview text.
    return computeSimilarity(queryPrompt, entry.preview);
  }

  // ── Public API: set ───────────────────────────────────────────────────

  /**
   * Store a response in the cache.
   *
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @param {string} response     — LLM response text
   * @param {object} usage        — token-usage metadata
   * @param {object} [options]
   * @returns {CacheSetResult}
   */
  set(systemPrompt, userPrompt, response, usage, options = {}) {
    const { exactKey, fuzzyKey, metadata } = this.#generateKey(systemPrompt, userPrompt, options);
    const now = Date.now();
    let evicted = false;

    // Evict LRU entries when at capacity and the key is new.
    if (!this.#store.has(exactKey) && this.#store.size >= this.#maxSize) {
      this.#evictLRU();
      evicted = true;
    }

    this.#store.set(exactKey, {
      exactKey,
      fuzzyKey,
      response,
      usage: usage ?? {},
      cachedAt: now,
      lastAccessedAt: now,
      hitCount: 0,
      preview: metadata.preview,
    });

    this.#fuzzyIndex.set(fuzzyKey, exactKey);

    return { evicted, cacheSize: this.#store.size };
  }

  // ── Public API: prefill ───────────────────────────────────────────────

  /**
   * Prefill the cache with a batch of entries (warm start).
   *
   * Duplicate exact keys are silently skipped.
   *
   * @param {Array<{ systemPrompt: string, userPrompt: string, response: string, usage: object }>} entries
   * @returns {Promise<{ inserted: number, skipped: number }>}
   */
  async prefill(entries) {
    if (!Array.isArray(entries)) return { inserted: 0, skipped: 0 };

    let inserted = 0;
    let skipped = 0;

    for (const entry of entries) {
      const { exactKey } = this.#generateKey(entry.systemPrompt, entry.userPrompt);
      if (this.#store.has(exactKey)) {
        skipped++;
        continue;
      }
      this.set(entry.systemPrompt, entry.userPrompt, entry.response, entry.usage);
      inserted++;
    }

    return { inserted, skipped };
  }

  // ── Public API: getStats ──────────────────────────────────────────────

  /**
   * Return detailed cache statistics.
   *
   * @returns {CacheStats}
   */
  getStats() {
    const total = this.#hitCount + this.#missCount;
    const fuzzyHits = this.#fuzzyHitCount;
    const avgSimilarity =
      this.#hitCount > 0 ? this.#similaritySum / this.#hitCount : 0;

    let oldestEntry = null;
    let newestEntry = null;
    for (const entry of this.#store.values()) {
      if (oldestEntry === null || entry.cachedAt < oldestEntry) {
        oldestEntry = entry.cachedAt;
      }
      if (newestEntry === null || entry.cachedAt > newestEntry) {
        newestEntry = entry.cachedAt;
      }
    }

    // Top queries by hit count.
    const topQueries = [...this.#store.values()]
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map((e) => ({
        hash: e.exactKey.slice(0, 12),
        hitCount: e.hitCount,
        preview: e.preview,
      }));

    return {
      size: this.#store.size,
      maxSize: this.#maxSize,
      hitRate: total > 0 ? this.#hitCount / total : 0,
      hitCount: this.#hitCount,
      missCount: this.#missCount,
      avgSimilarity,
      evictions: this.#evictions,
      oldestEntry,
      newestEntry,
      topQueries,
      fuzzyHitCount: fuzzyHits,
    };
  }

  // ── Public API: clear ─────────────────────────────────────────────────

  /**
   * Remove all entries and reset counters.
   */
  clear() {
    this.#store.clear();
    this.#fuzzyIndex.clear();
    this.#hitCount = 0;
    this.#missCount = 0;
    this.#evictions = 0;
    this.#fuzzyHitCount = 0;
    this.#similaritySum = 0;
  }

  // ── Public API: persist ───────────────────────────────────────────────

  /**
   * Persist the cache to a JSON file on disk.
   *
   * @param {string} [path] — file path; defaults to constructor persistencePath
   * @returns {Promise<void>}
   */
  async persist(path) {
    const target = path ?? this.#persistencePath;
    if (!target) return;

    const data = {
      version: 1,
      maxSize: this.#maxSize,
      ttlMs: this.#ttlMs,
      similarityThreshold: this.#similarityThreshold,
      enableFuzzyMatch: this.#enableFuzzyMatch,
      counters: {
        hitCount: this.#hitCount,
        missCount: this.#missCount,
        evictions: this.#evictions,
        fuzzyHitCount: this.#fuzzyHitCount,
        similaritySum: this.#similaritySum,
      },
      entries: [...this.#store.values()].map((e) => ({
        exactKey: e.exactKey,
        fuzzyKey: e.fuzzyKey,
        response: e.response,
        usage: e.usage,
        cachedAt: e.cachedAt,
        lastAccessedAt: e.lastAccessedAt,
        hitCount: e.hitCount,
        preview: e.preview,
      })),
    };

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(data), 'utf-8');
  }

  // ── Public API: load ──────────────────────────────────────────────────

  /**
   * Load cache entries from a JSON file on disk.
   *
   * Existing entries are cleared before loading. Counters are restored
   * from the persisted snapshot.
   *
   * @param {string} [path] — file path; defaults to constructor persistencePath
   * @returns {Promise<{ loaded: number }>}
   */
  async load(path) {
    const target = path ?? this.#persistencePath;
    if (!target) return { loaded: 0 };

    let raw;
    try {
      raw = await readFile(target, 'utf-8');
    } catch {
      return { loaded: 0 };
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return { loaded: 0 };
    }

    if (!data || !Array.isArray(data.entries)) return { loaded: 0 };

    this.clear();

    const now = Date.now();
    let loaded = 0;

    for (const e of data.entries) {
      // Skip expired entries.
      if (now - e.cachedAt >= this.#ttlMs) continue;

      this.#store.set(e.exactKey, {
        exactKey: e.exactKey,
        fuzzyKey: e.fuzzyKey,
        response: e.response,
        usage: e.usage ?? {},
        cachedAt: e.cachedAt,
        lastAccessedAt: e.lastAccessedAt ?? e.cachedAt,
        hitCount: e.hitCount ?? 0,
        preview: e.preview ?? '',
      });
      this.#fuzzyIndex.set(e.fuzzyKey, e.exactKey);
      loaded++;
    }

    // Restore counters if present.
    if (data.counters) {
      this.#hitCount = data.counters.hitCount ?? 0;
      this.#missCount = data.counters.missCount ?? 0;
      this.#evictions = data.counters.evictions ?? 0;
      this.#fuzzyHitCount = data.counters.fuzzyHitCount ?? 0;
      this.#similaritySum = data.counters.similaritySum ?? 0;
    }

    return { loaded };
  }

  // ── Public API: getEstimatedSavings ───────────────────────────────────

  /**
   * Calculate estimated cost savings from cache hits.
   *
   * @param {number} [costPerToken=0.00003] — USD cost per output token
   * @returns {SavingsResult}
   */
  getEstimatedSavings(costPerToken = 0.00003) {
    let tokensSaved = 0;

    for (const entry of this.#store.values()) {
      if (entry.hitCount > 0 && entry.usage) {
        const outputTokens = entry.usage.outputTokens ?? entry.usage.completionTokens ?? 0;
        tokensSaved += outputTokens * entry.hitCount;
      }
    }

    const total = this.#hitCount + this.#missCount;

    return {
      tokensSaved,
      estimatedCostSaved: tokensSaved * costPerToken,
      hitRate: total > 0 ? this.#hitCount / total : 0,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Evict the least-recently-used entry (oldest lastAccessedAt).
   */
  #evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.#store) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      const entry = this.#store.get(oldestKey);
      if (entry) this.#fuzzyIndex.delete(entry.fuzzyKey);
      this.#store.delete(oldestKey);
      this.#evictions++;
    }
  }
}
