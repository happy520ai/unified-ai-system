/**
 * WarmMemory — Long-term, in-memory categorized store.
 */

import { MemoryType, MemoryTier, ALL_TYPES, DEFAULT_TOKENIZER, genId } from './constants.js';

export class WarmMemory {
  #categories = {};
  #maxPerCategory;
  #tokenizerFn;
  #relevanceHalfLife;
  #stats = { stored: 0, evicted: 0, consolidated: 0 };

  /**
   * @param {object} opts
   * @param {number} opts.maxPerCategory — max entries per category
   * @param {function} opts.tokenizerFn — token estimator
   * @param {number} opts.relevanceHalfLife — hours for relevance to halve
   */
  constructor({ maxPerCategory = 200, tokenizerFn, relevanceHalfLife = 24 } = {}) {
    this.#maxPerCategory = maxPerCategory;
    this.#tokenizerFn = tokenizerFn ?? DEFAULT_TOKENIZER;
    this.#relevanceHalfLife = relevanceHalfLife;
    for (const type of ALL_TYPES) {
      this.#categories[type] = [];
    }
  }

  /**
   * Store an entry in the warm tier.
   * @param {object} entry
   * @returns {object} stored entry
   */
  store(entry) {
    const type = entry.type || MemoryType.OTHER;
    if (!this.#categories[type]) {
      this.#categories[type] = [];
    }

    const record = {
      id: entry.id || genId(),
      timestamp: entry.timestamp || Date.now(),
      content: entry.content,
      type,
      tags: entry.tags || [],
      importance: entry.importance ?? 50,
      tokenCount: this.#tokenizerFn(entry.content),
      accessCount: 0,
      lastAccessed: null,
      tier: MemoryTier.WARM,
      consolidatedFrom: entry.consolidatedFrom || [],
      relevance: entry.importance ?? 50,
    };

    const cat = this.#categories[type];

    // Evict lowest relevance if at capacity
    if (cat.length >= this.#maxPerCategory) {
      this.#decayRelevance(cat);
      cat.sort((a, b) => a.relevance - b.relevance);
      cat.shift();
      this.#stats.evicted++;
    }

    cat.push(record);
    this.#stats.stored++;
    return record;
  }

  /**
   * Recall entries matching a query.
   * @param {string} query
   * @param {object} opts — { limit, types, tags, minRelevance }
   * @returns {object[]}
   */
  recall(query, { limit = 30, types, tags, minRelevance = 0 } = {}) {
    const queryLower = (query || '').toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);
    const typeSet = types ? new Set(types) : null;
    const tagSet = tags ? new Set(tags.map(t => t.toLowerCase())) : null;

    const scored = [];
    for (const type of ALL_TYPES) {
      if (typeSet && !typeSet.has(type)) continue;
      const cat = this.#categories[type] || [];

      for (const entry of cat) {
        if (entry.relevance < minRelevance) continue;
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
            if (tagSet.has(tag.toLowerCase())) score += 25;
          }
        }

        // Relevance (0-100)
        score += entry.relevance;

        // Recency (decay based on half-life)
        const ageHours = (Date.now() - entry.timestamp) / 3600000;
        const recencyFactor = Math.pow(0.5, ageHours / this.#relevanceHalfLife);
        score += 30 * recencyFactor;

        // Access frequency
        score += Math.min(entry.accessCount * 3, 25);

        if (score > 0 || !query) {
          scored.push({ entry, score });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => {
      s.entry.accessCount++;
      s.entry.lastAccessed = Date.now();
      return s.entry;
    });
  }

  /**
   * Consolidate hot entries into a warm summary.
   * @param {object[]} hotEntries — entries from hot tier
   * @param {string} summary — consolidated summary text
   * @param {object} opts — { type, tags, importance }
   * @returns {object} the warm entry
   */
  consolidate(hotEntries, summary, { type, tags, importance } = {}) {
    const entry = this.store({
      content: summary,
      type: type || MemoryType.SUMMARY,
      tags: tags || [...new Set(hotEntries.flatMap(e => e.tags))],
      importance: importance ?? Math.max(...hotEntries.map(e => e.importance ?? 50), 50),
      consolidatedFrom: hotEntries.map(e => e.id),
    });
    this.#stats.consolidated++;
    return entry;
  }

  /**
   * Get entries older than a given age (for archiving to cold).
   * @param {number} ageMs
   * @returns {object[]}
   */
  getOlderThan(ageMs) {
    const cutoff = Date.now() - ageMs;
    const results = [];
    for (const type of ALL_TYPES) {
      const cat = this.#categories[type] || [];
      for (const entry of cat) {
        if (entry.timestamp <= cutoff) {
          results.push(entry);
        }
      }
    }
    return results;
  }

  /**
   * Remove specific entries by ID.
   * @param {string[]} ids
   * @returns {number}
   */
  removeBatch(ids) {
    const idSet = new Set(ids);
    let removed = 0;
    for (const type of ALL_TYPES) {
      const cat = this.#categories[type];
      if (!cat) continue;
      const before = cat.length;
      this.#categories[type] = cat.filter(e => !idSet.has(e.id));
      removed += before - this.#categories[type].length;
    }
    return removed;
  }

  /**
   * Remove an entry by ID.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    for (const type of ALL_TYPES) {
      const cat = this.#categories[type];
      if (!cat) continue;
      const idx = cat.findIndex(e => e.id === id);
      if (idx !== -1) {
        cat.splice(idx, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Get all entries across all categories.
   * @returns {object[]}
   */
  getAll() {
    const all = [];
    for (const type of ALL_TYPES) {
      all.push(...(this.#categories[type] || []));
    }
    return all;
  }

  /**
   * Get entries by category.
   * @param {string} type
   * @returns {object[]}
   */
  getByCategory(type) {
    return [...(this.#categories[type] || [])];
  }

  clear() {
    for (const type of ALL_TYPES) {
      this.#categories[type] = [];
    }
  }

  get status() {
    const byCategory = {};
    let totalEntries = 0;
    let totalTokens = 0;
    for (const type of ALL_TYPES) {
      const cat = this.#categories[type] || [];
      byCategory[type] = cat.length;
      totalEntries += cat.length;
      totalTokens += cat.reduce((sum, e) => sum + e.tokenCount, 0);
    }
    return {
      totalEntries,
      totalTokens,
      maxPerCategory: this.#maxPerCategory,
      byCategory,
    };
  }

  get stats() {
    return { ...this.#stats };
  }

  // ── Private ──

  #decayRelevance(entries) {
    const now = Date.now();
    for (const e of entries) {
      const ageHours = (now - e.timestamp) / 3600000;
      e.relevance = (e.importance ?? 50) * Math.pow(0.5, ageHours / this.#relevanceHalfLife);
    }
  }
}
