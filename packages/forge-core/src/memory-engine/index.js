/**
 * MemoryEngine — Three-tier infinite memory system for LLM agents.
 *
 * Architecture:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Hot Tier (Short-Term Memory)                                │
 *   │  In-memory ring buffer · bounded by count + token budget     │
 *   │  Stores: recent events, file reads, task results, actions    │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  Warm Tier (Long-Term Memory)                                │
 *   │  In-memory categorized store · consolidated from hot         │
 *   │  Stores: file summaries, project patterns, strategies        │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │  Cold Tier (Archival / Infinite)                             │
 *   │  File-based persistent storage · searchable · lazy-loaded    │
 *   │  Stores: compressed historical knowledge across sessions     │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Flow:
 *   remember() → hot tier
 *   consolidate() → hot entries → summarized → warm tier
 *   archive() → old warm entries → compressed → cold tier (file)
 *   recall() → searches all tiers, hot first, returns ranked results
 *   buildContext() → builds LLM prompt from memory within token budget
 *
 * Usage:
 *   const memory = new MemoryEngine({ persistencePath: '.forge/memory.json' });
 *   await memory.load();
 *   memory.remember('File src/index.js exports class App', { type: 'file', tags: ['src'] });
 *   const ctx = memory.buildContext({ query: 'what does App do?', tokenBudget: 8000 });
 */

import { MemoryType, MemoryTier, DEFAULT_TOKENIZER, defaultSummarizer } from './constants.js';
import { HotMemory } from './hot-memory.js';
import { WarmMemory } from './warm-memory.js';
import { ColdMemory } from './cold-memory.js';
import { buildContext as _buildContext } from './context-builder.js';

export { MemoryType, MemoryTier } from './constants.js';

// ═══════════════════════════════════════════════════════════════════════════════
//  MemoryEngine — Orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

export class MemoryEngine {
  #hot;
  #warm;
  #cold;
  #tokenizerFn;
  #autoConsolidateThreshold;
  #autoArchiveAgeMs;
  #stats = { remembers: 0, recalls: 0, consolidations: 0, archives: 0 };

  /**
   * @param {object} [opts]
   * @param {number} [opts.hotMaxEntries=500] — hot tier max entries
   * @param {number} [opts.hotTokenBudget=32000] — hot tier token budget
   * @param {number} [opts.hotTTL=0] — hot entry default TTL (0=forever)
   * @param {number} [opts.warmMaxPerCategory=200] — warm tier max per category
   * @param {number} [opts.warmRelevanceHalfLife=24] — hours for relevance to halve
   * @param {string} [opts.persistencePath] — cold tier file path
   * @param {number} [opts.coldMaxLoaded=1000] — cold tier max loaded in memory
   * @param {function} [opts.tokenizerFn] — custom token estimator
   * @param {number} [opts.autoConsolidateThreshold=100] — auto-consolidate when hot entries exceed this
   * @param {number} [opts.autoArchiveAgeMs=3600000] — archive warm entries older than this (default 1h)
   */
  constructor(opts = {}) {
    this.#tokenizerFn = opts.tokenizerFn ?? DEFAULT_TOKENIZER;
    this.#autoConsolidateThreshold = opts.autoConsolidateThreshold ?? 100;
    this.#autoArchiveAgeMs = opts.autoArchiveAgeMs ?? 3600000;

    this.#hot = new HotMemory({
      maxEntries: opts.hotMaxEntries ?? 500,
      tokenBudget: opts.hotTokenBudget ?? 32000,
      tokenizerFn: this.#tokenizerFn,
      defaultTTL: opts.hotTTL ?? 0,
    });

    this.#warm = new WarmMemory({
      maxPerCategory: opts.warmMaxPerCategory ?? 200,
      tokenizerFn: this.#tokenizerFn,
      relevanceHalfLife: opts.warmRelevanceHalfLife ?? 24,
    });

    this.#cold = new ColdMemory({
      persistencePath: opts.persistencePath,
      tokenizerFn: this.#tokenizerFn,
      maxLoaded: opts.coldMaxLoaded ?? 1000,
    });
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Store a memory. Always goes to the hot tier.
   *
   * @param {string} content — the memory content
   * @param {object} [opts]
   * @param {string} [opts.type] — MemoryType value
   * @param {string[]} [opts.tags] — tags for retrieval
   * @param {number} [opts.importance] — 0-100 importance score
   * @param {number} [opts.ttl] — TTL in ms (overrides hot default)
   * @returns {object} the stored entry
   */
  remember(content, opts = {}) {
    const entry = this.#hot.store({
      content,
      type: opts.type,
      tags: opts.tags,
      importance: opts.importance,
      ttl: opts.ttl,
    });

    this.#stats.remembers++;

    // Auto-consolidate if hot tier is getting full
    if (this.#hot.status.entries >= this.#autoConsolidateThreshold) {
      try { this.consolidate(); } catch { /* ignore */ }
    }

    return entry;
  }

  /**
   * Recall relevant memories from all tiers.
   *
   * Searches hot → warm → cold and returns combined results sorted by relevance.
   * Respects a token budget for the total returned content.
   *
   * @param {string} query — search query
   * @param {object} [opts]
   * @param {number} [opts.tokenBudget=8000] — max tokens for returned content
   * @param {number} [opts.limit=50] — max entries to return
   * @param {string[]} [opts.types] — filter by memory types
   * @param {string[]} [opts.tags] — filter by tags
   * @param {string[]} [opts.tiers] — which tiers to search (default: all)
   * @returns {object} { entries, totalTokens, byTier: { hot, warm, cold } }
   */
  recall(query, opts = {}) {
    const tokenBudget = opts.tokenBudget ?? 8000;
    const limit = opts.limit ?? 50;
    const tiers = opts.tiers || [MemoryTier.HOT, MemoryTier.WARM, MemoryTier.COLD];
    this.#stats.recalls++;

    const allResults = [];

    // Search each requested tier
    if (tiers.includes(MemoryTier.HOT)) {
      const hotResults = this.#hot.recall(query, {
        limit: Math.min(limit, 50),
        types: opts.types,
        tags: opts.tags,
      });
      for (const entry of hotResults) {
        allResults.push({ ...entry, _tier: MemoryTier.HOT, _tierPriority: 0 });
      }
    }

    if (tiers.includes(MemoryTier.WARM)) {
      const warmResults = this.#warm.recall(query, {
        limit: Math.min(limit, 30),
        types: opts.types,
        tags: opts.tags,
      });
      for (const entry of warmResults) {
        allResults.push({ ...entry, _tier: MemoryTier.WARM, _tierPriority: 1 });
      }
    }

    if (tiers.includes(MemoryTier.COLD)) {
      const coldResults = this.#cold.search(query, {
        limit: Math.min(limit, 20),
        types: opts.types,
        tags: opts.tags,
      });
      for (const entry of coldResults) {
        allResults.push({ ...entry, _tier: MemoryTier.COLD, _tierPriority: 2 });
      }
    }

    // Sort: tier priority first, then importance, then recency
    allResults.sort((a, b) => {
      if (a._tierPriority !== b._tierPriority) return a._tierPriority - b._tierPriority;
      const aImportance = a.importance ?? 50;
      const bImportance = b.importance ?? 50;
      if (aImportance !== bImportance) return bImportance - aImportance;
      return b.timestamp - a.timestamp;
    });

    // Apply token budget
    const entries = [];
    let totalTokens = 0;
    const byTier = { hot: 0, warm: 0, cold: 0 };

    for (const entry of allResults) {
      if (entries.length >= limit) break;
      const entryTokens = entry.tokenCount || this.#tokenizerFn(entry.content);
      if (totalTokens + entryTokens > tokenBudget) continue; // skip, try smaller entries
      entries.push(entry);
      totalTokens += entryTokens;
      byTier[entry._tier]++;
    }

    return { entries, totalTokens, byTier };
  }

  /**
   * Consolidate hot memories into warm tier.
   *
   * Groups hot entries by type+tags, creates summaries, stores in warm tier,
   * then removes consolidated entries from hot.
   *
   * @param {object} [opts]
   * @param {number} [opts.maxAge=300000] — only consolidate entries older than this (ms)
   * @param {function} [opts.summarizerFn] — custom summarizer (entries) => string
   * @returns {object} { consolidated: number, warmEntries: number }
   */
  consolidate(opts = {}) {
    const maxAge = opts.maxAge ?? 300000; // 5 minutes default
    const candidates = this.#hot.getOlderThan(maxAge);
    if (candidates.length === 0) return { consolidated: 0, warmEntries: 0 };

    // Group by type
    const groups = {};
    for (const entry of candidates) {
      const key = entry.type || MemoryType.OTHER;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }

    let consolidated = 0;
    const summarizerFn = opts.summarizerFn || defaultSummarizer;

    for (const [type, entries] of Object.entries(groups)) {
      // Sub-group by primary tag if available
      const tagGroups = {};
      for (const entry of entries) {
        const tagKey = entry.tags?.[0] || '_untagged';
        if (!tagGroups[tagKey]) tagGroups[tagKey] = [];
        tagGroups[tagKey].push(entry);
      }

      for (const [tag, groupEntries] of Object.entries(tagGroups)) {
        // Don't consolidate single entries — they're already atomic
        if (groupEntries.length < 2) {
          // Still move single important entries to warm
          if (groupEntries[0].importance >= 70) {
            this.#warm.store(groupEntries[0]);
            this.#hot.remove(groupEntries[0].id);
            consolidated++;
          }
          continue;
        }

        const summary = summarizerFn(groupEntries);
        this.#warm.consolidate(groupEntries, summary, {
          type,
          tags: tag !== '_untagged' ? [tag] : [],
          importance: Math.max(...groupEntries.map(e => e.importance ?? 50)),
        });

        this.#hot.removeBatch(groupEntries.map(e => e.id));
        consolidated += groupEntries.length;
      }
    }

    this.#stats.consolidations++;
    return { consolidated, warmEntries: this.#warm.status.totalEntries };
  }

  /**
   * Archive old warm entries to cold tier.
   *
   * @param {object} [opts]
   * @param {number} [opts.maxAge] — archive entries older than this (overrides default)
   * @param {boolean} [opts.compress=true] — compress groups into summaries
   * @param {function} [opts.summarizerFn] — custom summarizer
   * @returns {object} { archived, compressed }
   */
  archive(opts = {}) {
    const maxAge = opts.maxAge ?? this.#autoArchiveAgeMs;
    const candidates = this.#warm.getOlderThan(maxAge);
    if (candidates.length === 0) return { archived: 0, compressed: 0 };

    const summarizerFn = opts.summarizerFn || defaultSummarizer;
    const doCompress = opts.compress !== false;
    let archived = 0;
    let compressed = 0;

    if (doCompress && candidates.length >= 3) {
      // Group by type for compression
      const groups = {};
      for (const entry of candidates) {
        const key = entry.type || MemoryType.OTHER;
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
      }

      for (const [type, entries] of Object.entries(groups)) {
        if (entries.length >= 3) {
          const summary = summarizerFn(entries);
          this.#cold.store({
            content: summary,
            type,
            tags: [...new Set(entries.flatMap(e => e.tags))],
            importance: Math.max(...entries.map(e => e.importance ?? 50)),
            compressedFrom: entries.map(e => e.id),
          });
          compressed += entries.length;
        } else {
          // Move individually
          for (const entry of entries) {
            this.#cold.store(entry);
          }
        }
        archived += entries.length;
      }
    } else {
      // Move individually
      for (const entry of candidates) {
        this.#cold.store(entry);
        archived++;
      }
    }

    this.#warm.removeBatch(candidates.map(e => e.id));
    this.#stats.archives++;
    return { archived, compressed };
  }

  /**
   * Search across all tiers.
   *
   * @param {string} query
   * @param {object} [opts] — { limit, types, tags }
   * @returns {object[]} entries from all tiers
   */
  search(query, opts = {}) {
    const { entries } = this.recall(query, {
      ...opts,
      tokenBudget: Infinity,
    });
    return entries;
  }

  /**
   * Remove a memory from any tier.
   *
   * @param {string} id — memory ID
   * @returns {boolean} true if found and removed
   */
  forget(id) {
    if (this.#hot.remove(id)) return true;
    if (this.#warm.remove(id)) return true;
    return this.#cold.remove(id);
  }

  /**
   * Build an LLM context block from memories.
   *
   * Combines relevant memories into a formatted prompt section, respecting
   * a token budget. Includes hot memories first (most recent context),
   * then warm (consolidated knowledge), then cold (historical).
   *
   * @param {object} opts
   * @param {string} [opts.query] — what the LLM is working on
   * @param {number} [opts.tokenBudget=16000] — max tokens for context
   * @param {string[]} [opts.types] — filter memory types
   * @param {string[]} [opts.tags] — filter tags
   * @param {Array<{path: string, content: string}>} [opts.files] — files to include
   * @param {string} [opts.prevSummary] — previous task summary
   * @returns {object} { context, entries, tokenUsage, byTier }
   */
  buildContext(opts = {}) {
    return _buildContext(opts, this.recall.bind(this), this.#tokenizerFn);
  }

  /**
   * Save cold tier to persistent storage.
   */
  async save() {
    // Auto-archive before saving
    this.archive();
    await this.#cold.save();
  }

  /**
   * Load cold tier from persistent storage.
   */
  async load() {
    await this.#cold.load();
  }

  /**
   * Get an entry by ID from any tier.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return this.#hot.get(id) || this.#cold.get(id) || null;
  }

  /**
   * Clear all tiers.
   */
  clear() {
    this.#hot.clear();
    this.#warm.clear();
    this.#cold.clear();
  }

  /**
   * Get comprehensive status across all tiers.
   */
  getStatus() {
    return {
      hot: this.#hot.status,
      warm: this.#warm.status,
      cold: this.#cold.status,
      config: {
        autoConsolidateThreshold: this.#autoConsolidateThreshold,
        autoArchiveAgeMs: this.#autoArchiveAgeMs,
      },
    };
  }

  /**
   * Get statistics across all tiers.
   */
  getStats() {
    return {
      operations: { ...this.#stats },
      hot: this.#hot.stats,
      warm: this.#warm.stats,
      cold: this.#cold.stats,
    };
  }
}
