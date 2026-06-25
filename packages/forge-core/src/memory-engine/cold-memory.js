/**
 * ColdMemory — Archival, file-based persistent storage.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { MemoryType, MemoryTier, DEFAULT_TOKENIZER, genId } from './constants.js';

export class ColdMemory {
  #entries = [];
  #persistencePath;
  #tokenizerFn;
  #maxLoaded;
  #loaded = false;
  #dirty = false;
  #stats = { stored: 0, compressed: 0, loaded: 0 };

  /**
   * @param {object} opts
   * @param {string} opts.persistencePath — path to JSON file
   * @param {function} opts.tokenizerFn — token estimator
   * @param {number} opts.maxLoaded — max entries to keep loaded in memory
   */
  constructor({ persistencePath, tokenizerFn, maxLoaded = 1000 } = {}) {
    this.#persistencePath = persistencePath || null;
    this.#tokenizerFn = tokenizerFn ?? DEFAULT_TOKENIZER;
    this.#maxLoaded = maxLoaded;
  }

  get persistencePath() { return this.#persistencePath; }
  get isLoaded() { return this.#loaded; }

  /**
   * Store an entry in cold tier.
   * @param {object} entry
   * @returns {object}
   */
  store(entry) {
    const record = {
      id: entry.id || genId(),
      timestamp: entry.timestamp || Date.now(),
      content: entry.content,
      type: entry.type || MemoryType.OTHER,
      tags: entry.tags || [],
      importance: entry.importance ?? 50,
      tokenCount: this.#tokenizerFn(entry.content),
      tier: MemoryTier.COLD,
      compressedFrom: entry.compressedFrom || [],
      accessCount: 0,
    };

    this.#entries.push(record);
    this.#stats.stored++;
    this.#dirty = true;

    // Trim in-memory if over limit (oldest first)
    if (this.#entries.length > this.#maxLoaded) {
      this.#entries.sort((a, b) => a.timestamp - b.timestamp);
      // Keep the newest maxLoaded entries in memory
      // Older ones remain on disk after next save
      this.#entries = this.#entries.slice(-this.#maxLoaded);
    }

    return record;
  }

  /**
   * Store a batch of entries (used during archive).
   * @param {object[]} entries
   * @returns {number} count stored
   */
  storeBatch(entries) {
    for (const entry of entries) {
      this.store(entry);
    }
    return entries.length;
  }

  /**
   * Search cold entries matching a query.
   * @param {string} query
   * @param {object} opts — { limit, types, tags }
   * @returns {object[]}
   */
  search(query, { limit = 20, types, tags } = {}) {
    const queryLower = (query || '').toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(Boolean);
    const typeSet = types ? new Set(types) : null;
    const tagSet = tags ? new Set(tags.map(t => t.toLowerCase())) : null;

    const scored = [];
    for (const entry of this.#entries) {
      if (typeSet && !typeSet.has(entry.type)) continue;
      if (tagSet && !entry.tags.some(t => tagSet.has(t.toLowerCase()))) continue;

      let score = 0;
      const contentLower = entry.content.toLowerCase();

      for (const term of queryTerms) {
        if (contentLower.includes(term)) score += 15;
      }

      if (tagSet) {
        for (const tag of entry.tags) {
          if (tagSet.has(tag.toLowerCase())) score += 20;
        }
      }

      score += (entry.importance ?? 50) * 0.3;

      if (score > 0 || !query) {
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => {
      s.entry.accessCount++;
      return s.entry;
    });
  }

  /**
   * Compress multiple entries into a single summary entry.
   * @param {string[]} ids — entry IDs to compress
   * @param {string} summary — compressed summary text
   * @param {object} opts — { type, tags, importance }
   * @returns {object|null} the compressed entry, or null
   */
  compress(ids, summary, opts = {}) {
    const idSet = new Set(ids);
    const originalEntries = this.#entries.filter(e => idSet.has(e.id));
    if (originalEntries.length === 0) return null;

    // Remove originals
    this.#entries = this.#entries.filter(e => !idSet.has(e.id));

    const record = this.store({
      content: summary,
      type: opts.type || MemoryType.SUMMARY,
      tags: opts.tags || [...new Set(originalEntries.flatMap(e => e.tags))],
      importance: opts.importance ?? Math.max(...originalEntries.map(e => e.importance ?? 50)),
      compressedFrom: originalEntries.map(e => e.id),
    });

    this.#stats.compressed++;
    return record;
  }

  /**
   * Remove an entry by ID.
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const idx = this.#entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this.#entries.splice(idx, 1);
    this.#dirty = true;
    return true;
  }

  /**
   * Get an entry by ID.
   * @param {string} id
   * @returns {object|null}
   */
  get(id) {
    return this.#entries.find(e => e.id === id) || null;
  }

  /**
   * Get all entries.
   * @returns {object[]}
   */
  getAll() {
    return [...this.#entries];
  }

  /**
   * Save cold tier to disk.
   */
  async save() {
    if (!this.#persistencePath) return;
    const data = {
      version: 1,
      savedAt: Date.now(),
      entryCount: this.#entries.length,
      entries: this.#entries.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        content: e.content,
        type: e.type,
        tags: e.tags,
        importance: e.importance,
        compressedFrom: e.compressedFrom || [],
      })),
    };

    const dir = dirname(this.#persistencePath);
    await mkdir(dir, { recursive: true });
    await writeFile(this.#persistencePath, JSON.stringify(data, null, 2), 'utf-8');
    this.#dirty = false;
  }

  /**
   * Load cold tier from disk.
   */
  async load() {
    if (!this.#persistencePath) {
      this.#loaded = true;
      return;
    }

    try {
      const raw = await readFile(this.#persistencePath, 'utf-8');
      const data = JSON.parse(raw);

      if (Array.isArray(data.entries)) {
        this.#entries = data.entries.map(e => ({
          id: e.id || genId(),
          timestamp: e.timestamp || Date.now(),
          content: e.content || '',
          type: e.type || MemoryType.OTHER,
          tags: e.tags || [],
          importance: e.importance ?? 50,
          tokenCount: this.#tokenizerFn(e.content || ''),
          tier: MemoryTier.COLD,
          compressedFrom: e.compressedFrom || [],
          accessCount: 0,
        }));
        this.#stats.loaded = this.#entries.length;
      }
    } catch {
      // File doesn't exist or is corrupt — start fresh
      this.#entries = [];
    }

    this.#loaded = true;
  }

  clear() {
    this.#entries = [];
    this.#dirty = true;
  }

  get status() {
    return {
      entries: this.#entries.length,
      maxLoaded: this.#maxLoaded,
      persistencePath: this.#persistencePath,
      loaded: this.#loaded,
      dirty: this.#dirty,
      totalTokens: this.#entries.reduce((sum, e) => sum + e.tokenCount, 0),
    };
  }

  get stats() {
    return { ...this.#stats };
  }
}
