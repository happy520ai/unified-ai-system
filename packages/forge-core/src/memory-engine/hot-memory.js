/**
 * HotMemory — Short-term, in-memory ring buffer.
 */

import { MemoryType, MemoryTier, DEFAULT_TOKENIZER, genId } from './constants.js';

export class HotMemory {
  #entries = [];
  #maxEntries;
  #tokenBudget;
  #currentTokens = 0;
  #tokenizerFn;
  #defaultTTL;
  #stats = { stored: 0, evicted: 0, expired: 0 };

  /**
   * @param {object} opts
   * @param {number} opts.maxEntries — max entries in ring buffer
   * @param {number} opts.tokenBudget — max tokens in hot window
   * @param {function} opts.tokenizerFn — token estimator
   * @param {number} opts.defaultTTL — default TTL in ms (0 = no expiry)
   */
  constructor({ maxEntries = 500, tokenBudget = 32000, tokenizerFn, defaultTTL = 0 } = {}) {
    this.#maxEntries = maxEntries;
    this.#tokenBudget = tokenBudget;
    this.#tokenizerFn = tokenizerFn ?? DEFAULT_TOKENIZER;
    this.#defaultTTL = defaultTTL;
  }

  /**
   * Store a memory in the hot tier.
   * @param {object} entry — { id, content, type, tags, importance, ttl, timestamp }
   * @returns {object} the stored entry with computed fields
   */
  store(entry) {
    const tokenCount = this.#tokenizerFn(entry.content);
    const record = {
      id: entry.id || genId(),
      timestamp: entry.timestamp || Date.now(),
      content: entry.content,
      type: entry.type || MemoryType.OTHER,
      tags: entry.tags || [],
      importance: entry.importance ?? 50,
      tokenCount,
      accessCount: 0,
      lastAccessed: null,
      tier: MemoryTier.HOT,
      ttl: entry.ttl ?? this.#defaultTTL,
    };

    // Evict to make room (token budget or entry count)
    while (
      this.#entries.length > 0 &&
      (this.#currentTokens + tokenCount > this.#tokenBudget ||
       this.#entries.length >= this.#maxEntries)
    ) {
      this.#evictOne();
    }

    this.#entries.push(record);
    this.#currentTokens += tokenCount;
    this.#stats.stored++;
    return record;
  }

  /**
   * Recall entries matching a query.
   * @param {string} query — text to match
   * @param {object} opts — { limit, types, tags, minImportance }
   * @returns {object[]} matched entries sorted by relevance
   */
  recall(query, { limit = 50, types, tags, minImportance = 0 } = {}) {
    this.#purgeExpired();
    const queryLower = (query || '').toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);
    const typeSet = types ? new Set(types) : null;
    const tagSet = tags ? new Set(tags.map(t => t.toLowerCase())) : null;

    const scored = [];
    for (const entry of this.#entries) {
      if (typeSet && !typeSet.has(entry.type)) continue;
      if (entry.importance < minImportance) continue;
      if (tagSet && !entry.tags.some(t => tagSet.has(t.toLowerCase()))) continue;

      let score = 0;
      const contentLower = entry.content.toLowerCase();

      // Text matching
      for (const term of queryTerms) {
        if (contentLower.includes(term)) score += 20;
      }

      // Tag matching
      if (tagSet) {
        for (const tag of entry.tags) {
          if (tagSet.has(tag.toLowerCase())) score += 30;
        }
      }

      // Importance bonus (0-50)
      score += entry.importance * 0.5;

      // Recency bonus (newer = higher, max 30)
      const ageMinutes = (Date.now() - entry.timestamp) / 60000;
      score += Math.max(0, 30 - ageMinutes);

      // Access frequency bonus
      score += Math.min(entry.accessCount * 2, 20);

      if (score > 0 || !query) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, limit).map(s => {
      s.entry.accessCount++;
      s.entry.lastAccessed = Date.now();
      return s.entry;
    });

    return results;
  }

  /**
   * Get an entry by ID.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    this.#purgeExpired();
    const entry = this.#entries.find(e => e.id === id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }
    return entry || null;
  }

  /**
   * Remove an entry by ID.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const idx = this.#entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.#currentTokens -= this.#entries[idx].tokenCount;
    this.#entries.splice(idx, 1);
    return true;
  }

  /**
   * Get all entries (for consolidation).
   * @returns {object[]}
   */
  getAll() {
    this.#purgeExpired();
    return [...this.#entries];
  }

  /**
   * Get entries older than a given age.
   * @param {number} ageMs — age threshold in milliseconds (0 = all entries)
   * @returns {object[]}
   */
  getOlderThan(ageMs) {
    this.#purgeExpired();
    const cutoff = Date.now() - ageMs;
    return this.#entries.filter(e => e.timestamp <= cutoff);
  }

  /**
   * Remove specific entries (used after consolidation).
   * @param {string[]} ids
   * @returns {number} count removed
   */
  removeBatch(ids) {
    const idSet = new Set(ids);
    let removed = 0;
    this.#entries = this.#entries.filter(e => {
      if (idSet.has(e.id)) {
        this.#currentTokens -= e.tokenCount;
        removed++;
        return false;
      }
      return true;
    });
    return removed;
  }

  clear() {
    this.#entries = [];
    this.#currentTokens = 0;
  }

  get status() {
    return {
      entries: this.#entries.length,
      maxEntries: this.#maxEntries,
      tokens: this.#currentTokens,
      tokenBudget: this.#tokenBudget,
      utilization: this.#tokenBudget > 0 ? this.#currentTokens / this.#tokenBudget : 0,
    };
  }

  get stats() {
    return { ...this.#stats };
  }

  // ── Private ──

  #evictOne() {
    if (this.#entries.length === 0) return;

    // Evict the entry with lowest combined score (importance + recency + access)
    let worstIdx = 0;
    let worstScore = Infinity;
    for (let i = 0; i < this.#entries.length; i++) {
      const e = this.#entries[i];
      const ageMinutes = (Date.now() - e.timestamp) / 60000;
      const score = e.importance + Math.max(0, 30 - ageMinutes) + e.accessCount * 2;
      if (score < worstScore) {
        worstScore = score;
        worstIdx = i;
      }
    }

    this.#currentTokens -= this.#entries[worstIdx].tokenCount;
    this.#entries.splice(worstIdx, 1);
    this.#stats.evicted++;
  }

  #purgeExpired() {
    const now = Date.now();
    const before = this.#entries.length;
    this.#entries = this.#entries.filter(e => {
      if (e.ttl > 0 && (now - e.timestamp) > e.ttl) {
        this.#currentTokens -= e.tokenCount;
        return false;
      }
      return true;
    });
    this.#stats.expired += before - this.#entries.length;
  }
}
