/**
 * Tests for MemoryEngine — enums, hot tier, and recall/search.
 *
 * Coverage:
 *   - MemoryType / MemoryTier enums
 *   - Constructor defaults and custom options
 *   - Hot tier: store, eviction, TTL
 *   - recall(): text query, tags, types, budget, limit, tiers, stats
 *   - search(): cross-tier, filters
 *   - forget(), get()
 *   - Edge cases
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('MemoryEngine', () => {
  let MemoryEngine, MemoryType, MemoryTier;

  before(async () => {
    const mod = await import('../src/memory-engine/index.js');
    MemoryEngine = mod.MemoryEngine;
    MemoryType = mod.MemoryType;
    MemoryTier = mod.MemoryTier;
  });

  // ── Enums ──────────────────────────────────────────────────────────────

  describe('MemoryType', () => {
    it('should have all expected types', () => {
      assert.equal(MemoryType.FILE, 'file');
      assert.equal(MemoryType.PATTERN, 'pattern');
      assert.equal(MemoryType.DECISION, 'decision');
      assert.equal(MemoryType.ERROR, 'error');
      assert.equal(MemoryType.STRATEGY, 'strategy');
      assert.equal(MemoryType.SUMMARY, 'summary');
      assert.equal(MemoryType.ACTION, 'action');
      assert.equal(MemoryType.CONVERSATION, 'conversation');
      assert.equal(MemoryType.OTHER, 'other');
    });

    it('should be frozen', () => {
      assert.throws(() => { MemoryType.NEW = 'new'; }, TypeError);
    });
  });

  describe('MemoryTier', () => {
    it('should have HOT, WARM, COLD', () => {
      assert.equal(MemoryTier.HOT, 'hot');
      assert.equal(MemoryTier.WARM, 'warm');
      assert.equal(MemoryTier.COLD, 'cold');
    });

    it('should be frozen', () => {
      assert.throws(() => { MemoryTier.NEW = 'new'; }, TypeError);
    });
  });

  // ── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should construct with defaults', () => {
      const me = new MemoryEngine();
      const status = me.getStatus();
      assert.equal(status.hot.entries, 0);
      assert.equal(status.hot.maxEntries, 500);
      assert.equal(status.hot.tokenBudget, 32000);
      assert.equal(status.warm.maxPerCategory, 200);
      assert.equal(status.cold.entries, 0);
    });

    it('should accept custom options', () => {
      const me = new MemoryEngine({
        hotMaxEntries: 50,
        hotTokenBudget: 4000,
        warmMaxPerCategory: 30,
        warmRelevanceHalfLife: 12,
        autoConsolidateThreshold: 20,
        autoArchiveAgeMs: 60000,
      });
      const status = me.getStatus();
      assert.equal(status.hot.maxEntries, 50);
      assert.equal(status.hot.tokenBudget, 4000);
      assert.equal(status.warm.maxPerCategory, 30);
      assert.equal(status.config.autoConsolidateThreshold, 20);
      assert.equal(status.config.autoArchiveAgeMs, 60000);
    });
  });

  // ── remember() — Hot tier ──────────────────────────────────────────────

  describe('remember()', () => {
    it('should store a memory in hot tier', () => {
      const me = new MemoryEngine();
      const entry = me.remember('File src/index.js exports class App');
      assert.ok(entry.id);
      assert.ok(entry.id.startsWith('mem_'));
      assert.equal(entry.content, 'File src/index.js exports class App');
      assert.equal(entry.tier, MemoryTier.HOT);
      assert.equal(entry.accessCount, 0);
    });

    it('should accept type, tags, and importance', () => {
      const me = new MemoryEngine();
      const entry = me.remember('User chose React for frontend', {
        type: MemoryType.DECISION,
        tags: ['frontend', 'react'],
        importance: 90,
      });
      assert.equal(entry.type, MemoryType.DECISION);
      assert.deepEqual(entry.tags, ['frontend', 'react']);
      assert.equal(entry.importance, 90);
    });

    it('should default type to OTHER and importance to 50', () => {
      const me = new MemoryEngine();
      const entry = me.remember('some info');
      assert.equal(entry.type, MemoryType.OTHER);
      assert.equal(entry.importance, 50);
    });

    it('should increment remembers stat', () => {
      const me = new MemoryEngine();
      me.remember('a');
      me.remember('b');
      me.remember('c');
      const stats = me.getStats();
      assert.equal(stats.operations.remembers, 3);
    });

    it('should track entries in hot tier status', () => {
      const me = new MemoryEngine();
      me.remember('entry 1');
      me.remember('entry 2');
      const status = me.getStatus();
      assert.equal(status.hot.entries, 2);
    });
  });

  // ── Hot tier eviction ──────────────────────────────────────────────────

  describe('hot tier eviction', () => {
    it('should evict entries when token budget is exceeded', () => {
      const me = new MemoryEngine({ hotTokenBudget: 100 });
      for (let i = 0; i < 20; i++) {
        me.remember('x'.repeat(100), { importance: i * 5 });
      }
      const status = me.getStatus();
      assert.ok(status.hot.tokens <= 100);
      assert.ok(status.hot.entries < 20);
    });

    it('should evict entries when max entry count is exceeded', () => {
      const me = new MemoryEngine({ hotMaxEntries: 5, hotTokenBudget: 999999 });
      for (let i = 0; i < 10; i++) {
        me.remember(`entry ${i}`, { importance: i * 10 });
      }
      const status = me.getStatus();
      assert.equal(status.hot.entries, 5);
    });

    it('should prefer keeping high-importance entries', () => {
      const me = new MemoryEngine({ hotMaxEntries: 3, hotTokenBudget: 999999 });
      me.remember('low', { importance: 10 });
      me.remember('medium', { importance: 50 });
      me.remember('high', { importance: 90 });
      me.remember('very high', { importance: 95 });

      const all = me.recall('', { limit: 10 });
      const contents = all.entries.map(e => e.content);
      assert.ok(contents.includes('very high'));
      assert.ok(contents.includes('high'));
    });

    it('should track eviction stats', () => {
      const me = new MemoryEngine({ hotMaxEntries: 3, hotTokenBudget: 999999 });
      for (let i = 0; i < 10; i++) {
        me.remember(`entry ${i}`);
      }
      const stats = me.getStats();
      assert.ok(stats.hot.evicted > 0);
    });
  });

  // ── Hot tier TTL ──────────────────────────────────────────────────────

  describe('hot tier TTL', () => {
    it('should expire entries after TTL', async () => {
      const me = new MemoryEngine({ hotTTL: 50 });
      me.remember('ephemeral data');
      let status = me.getStatus();
      assert.equal(status.hot.entries, 1);

      await new Promise(r => setTimeout(r, 80));

      const result = me.recall('ephemeral');
      assert.equal(result.entries.length, 0);
    });

    it('should support per-entry TTL override', async () => {
      const me = new MemoryEngine();
      me.remember('short-lived', { ttl: 50 });
      me.remember('long-lived', { ttl: 0 });

      await new Promise(r => setTimeout(r, 80));

      const result = me.recall('');
      const contents = result.entries.map(e => e.content);
      assert.ok(!contents.includes('short-lived'));
      assert.ok(contents.includes('long-lived'));
    });

    it('should track expired stats', async () => {
      const me = new MemoryEngine({ hotTTL: 30 });
      me.remember('a');
      me.remember('b');
      await new Promise(r => setTimeout(r, 60));
      me.recall('');
      const stats = me.getStats();
      assert.ok(stats.hot.expired >= 2);
    });
  });

  // ── recall() — Cross-tier retrieval ────────────────────────────────────

  describe('recall()', () => {
    it('should return entries matching text query', () => {
      const me = new MemoryEngine();
      me.remember('React is used for frontend', { tags: ['frontend'] });
      me.remember('Node.js powers the backend', { tags: ['backend'] });
      me.remember('Database uses PostgreSQL', { tags: ['database'] });

      const result = me.recall('frontend');
      assert.ok(result.entries.length > 0);
      assert.ok(result.entries[0].content.includes('React'));
    });

    it('should return entries matching tags', () => {
      const me = new MemoryEngine();
      me.remember('file A', { tags: ['src'] });
      me.remember('file B', { tags: ['test'] });

      const result = me.recall('', { tags: ['src'] });
      assert.ok(result.entries.length > 0);
      assert.ok(result.entries.some(e => e.content === 'file A'));
    });

    it('should filter by memory types', () => {
      const me = new MemoryEngine();
      me.remember('decision 1', { type: MemoryType.DECISION });
      me.remember('error 1', { type: MemoryType.ERROR });
      me.remember('file info', { type: MemoryType.FILE });

      const result = me.recall('', { types: [MemoryType.DECISION] });
      assert.ok(result.entries.every(e => e.type === MemoryType.DECISION));
    });

    it('should respect token budget', () => {
      const me = new MemoryEngine();
      for (let i = 0; i < 20; i++) {
        me.remember(`Memory entry ${i} with some padding text`, { importance: 50 + i });
      }

      const result = me.recall('', { tokenBudget: 200 });
      assert.ok(result.totalTokens <= 200);
    });

    it('should respect limit parameter', () => {
      const me = new MemoryEngine();
      for (let i = 0; i < 20; i++) {
        me.remember(`entry ${i}`);
      }

      const result = me.recall('', { limit: 5 });
      assert.ok(result.entries.length <= 5);
    });

    it('should return byTier counts', () => {
      const me = new MemoryEngine();
      me.remember('hot entry');

      const result = me.recall('');
      assert.ok('hot' in result.byTier);
      assert.ok('warm' in result.byTier);
      assert.ok('cold' in result.byTier);
    });

    it('should search only specified tiers', () => {
      const me = new MemoryEngine();
      me.remember('hot entry', { tags: ['test'] });

      const result = me.recall('', { tiers: [MemoryTier.WARM, MemoryTier.COLD] });
      assert.equal(result.byTier.hot, 0);
    });

    it('should increment recall stats', () => {
      const me = new MemoryEngine();
      me.recall('a');
      me.recall('b');
      const stats = me.getStats();
      assert.equal(stats.operations.recalls, 2);
    });
  });

  // ── search() — All tiers ──────────────────────────────────────────────

  describe('search()', () => {
    it('should find entries across all tiers', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('hot memory about React', { tags: ['react'] });

      me.remember('warm memory about Vue', { type: MemoryType.FILE, tags: ['vue'] });
      me.remember('warm memory about Vue 2', { type: MemoryType.FILE, tags: ['vue'] });
      me.consolidate({ maxAge: 0 });

      const results = me.search('memory');
      assert.ok(results.length > 0);
    });

    it('should support type and tag filters', () => {
      const me = new MemoryEngine();
      me.remember('decision: use TypeScript', { type: MemoryType.DECISION, tags: ['ts'] });
      me.remember('error: null pointer', { type: MemoryType.ERROR, tags: ['bug'] });

      const decisions = me.search('', { types: [MemoryType.DECISION] });
      assert.ok(decisions.every(e => e.type === MemoryType.DECISION));
    });
  });

  // ── forget() ───────────────────────────────────────────────────────────

  describe('forget()', () => {
    it('should remove entry from hot tier', () => {
      const me = new MemoryEngine();
      const entry = me.remember('temporary data');
      assert.ok(me.forget(entry.id));
      assert.equal(me.getStatus().hot.entries, 0);
    });

    it('should return false for non-existent ID', () => {
      const me = new MemoryEngine();
      assert.ok(!me.forget('nonexistent'));
    });
  });

  // ── get() ──────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('should get entry by ID from hot tier', () => {
      const me = new MemoryEngine();
      const entry = me.remember('findable');
      const found = me.get(entry.id);
      assert.ok(found);
      assert.equal(found.content, 'findable');
    });

    it('should return null for non-existent ID', () => {
      const me = new MemoryEngine();
      assert.equal(me.get('nope'), null);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const me = new MemoryEngine();
      const entry = me.remember('');
      assert.equal(entry.content, '');
      assert.equal(entry.tokenCount, 0);
    });

    it('should handle very long content', () => {
      const me = new MemoryEngine({ hotTokenBudget: 999999 });
      const longContent = 'x'.repeat(100000);
      const entry = me.remember(longContent);
      assert.ok(entry.tokenCount > 0);
    });

    it('should handle special characters in content', () => {
      const me = new MemoryEngine();
      const entry = me.remember('Content with `backticks` and ${} and \\n escapes');
      assert.ok(entry.content.includes('backticks'));
    });

    it('should handle recall with empty query', () => {
      const me = new MemoryEngine();
      me.remember('something');
      const result = me.recall('');
      assert.ok(result.entries.length > 0);
    });

    it('should handle buildContext with no memories', () => {
      const me = new MemoryEngine();
      const result = me.buildContext({ query: 'test' });
      assert.equal(result.entries.length, 0);
      assert.ok(result.tokenUsage >= 0);
    });
  });
});
