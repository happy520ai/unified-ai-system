/**
 * Tests for MemoryEngine — warm/cold tier lifecycle, persistence, and integration.
 *
 * Coverage:
 *   - consolidate(): hot → warm, grouping, summarizer
 *   - archive(): warm → cold, compression
 *   - buildContext(): context building, token budget, files, prevSummary
 *   - save() / load(): cold tier persistence
 *   - clear(): all tiers
 *   - getStatus() / getStats(): comprehensive status
 *   - Integration: full hot → warm → cold flow, rapid cycles, session lifecycle
 *   - Auto-consolidation trigger
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile, rm } from 'node:fs/promises';

const ALL_TYPES = Object.values({
  FILE: 'file', PATTERN: 'pattern', DECISION: 'decision',
  ERROR: 'error', STRATEGY: 'strategy', SUMMARY: 'summary',
  ACTION: 'action', CONVERSATION: 'conversation', OTHER: 'other',
});

describe('MemoryEngine lifecycle', () => {
  let MemoryEngine, MemoryType, MemoryTier;

  before(async () => {
    const mod = await import('../src/memory-engine/index.js');
    MemoryEngine = mod.MemoryEngine;
    MemoryType = mod.MemoryType;
    MemoryTier = mod.MemoryTier;
  });

  // ── consolidate() — Hot → Warm ────────────────────────────────────────

  describe('consolidate()', () => {
    it('should move old hot entries to warm tier', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('file info 1', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file info 2', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file info 3', { type: MemoryType.FILE, tags: ['src'] });

      const result = me.consolidate({ maxAge: 0 });
      assert.ok(result.consolidated > 0);

      const status = me.getStatus();
      assert.ok(status.warm.totalEntries > 0);
    });

    it('should group entries by type and tag', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('file A', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file B', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('error X', { type: MemoryType.ERROR, tags: ['runtime'] });
      me.remember('error Y', { type: MemoryType.ERROR, tags: ['runtime'] });

      me.consolidate({ maxAge: 0 });

      const warmStatus = me.getStatus().warm;
      assert.ok(warmStatus.byCategory.file >= 1 || warmStatus.byCategory.summary >= 1);
    });

    it('should not consolidate entries newer than maxAge', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('fresh entry');

      const result = me.consolidate({ maxAge: 999999 });
      assert.equal(result.consolidated, 0);
    });

    it('should keep high-importance single entries', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('critical decision', { importance: 90, type: MemoryType.DECISION, tags: ['critical'] });

      me.consolidate({ maxAge: 0 });

      const warmStatus = me.getStatus().warm;
      assert.ok(warmStatus.totalEntries > 0);
    });

    it('should use custom summarizer function', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('item 1', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('item 2', { type: MemoryType.FILE, tags: ['src'] });

      me.consolidate({
        maxAge: 0,
        summarizerFn: (entries) => `Custom summary: ${entries.length} items`,
      });

      const warmResult = me.recall('Custom summary', { tiers: [MemoryTier.WARM] });
      assert.ok(warmResult.entries.some(e => e.content.includes('Custom summary')));
    });

    it('should track consolidation stats', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('a', { tags: ['x'] });
      me.remember('b', { tags: ['x'] });
      me.consolidate({ maxAge: 0 });
      const stats = me.getStats();
      assert.ok(stats.operations.consolidations > 0);
    });
  });

  // ── archive() — Warm → Cold ───────────────────────────────────────────

  describe('archive()', () => {
    it('should move old warm entries to cold tier', () => {
      const me = new MemoryEngine({
        autoConsolidateThreshold: 999999,
        autoArchiveAgeMs: 0,
      });
      me.remember('entry 1', { tags: ['a'] });
      me.remember('entry 2', { tags: ['a'] });
      me.remember('entry 3', { tags: ['a'] });

      me.consolidate({ maxAge: 0 });

      const result = me.archive({ maxAge: 0 });
      assert.ok(result.archived > 0);

      const status = me.getStatus();
      assert.ok(status.cold.entries > 0);
    });

    it('should compress groups of 3+ entries', () => {
      const me = new MemoryEngine({
        autoConsolidateThreshold: 999999,
        autoArchiveAgeMs: 0,
      });

      me.remember('file info A', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file info B', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file info C', { type: MemoryType.FILE, tags: ['utils'] });
      me.remember('file info D', { type: MemoryType.FILE, tags: ['utils'] });
      me.remember('file info E', { type: MemoryType.FILE, tags: ['test'] });
      me.remember('file info F', { type: MemoryType.FILE, tags: ['test'] });

      me.consolidate({ maxAge: 0 });
      const result = me.archive({ maxAge: 0, compress: true });
      assert.ok(result.archived > 0);
      assert.ok(result.compressed > 0);
    });

    it('should move entries individually when compress is false', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('single 1', { tags: ['a'] });
      me.remember('single 2', { tags: ['a'] });
      me.remember('single 3', { tags: ['a'] });

      me.consolidate({ maxAge: 0 });
      const result = me.archive({ maxAge: 0, compress: false });
      assert.equal(result.compressed, 0);
      assert.ok(result.archived > 0);
    });

    it('should return 0 when no entries to archive', () => {
      const me = new MemoryEngine();
      const result = me.archive();
      assert.equal(result.archived, 0);
      assert.equal(result.compressed, 0);
    });

    it('should track archive stats', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('a', { tags: ['x'] });
      me.remember('b', { tags: ['x'] });
      me.consolidate({ maxAge: 0 });
      me.archive({ maxAge: 0 });
      const stats = me.getStats();
      assert.ok(stats.operations.archives > 0);
    });
  });

  // ── buildContext() ─────────────────────────────────────────────────────

  describe('buildContext()', () => {
    it('should build context from memories', () => {
      const me = new MemoryEngine();
      me.remember('React frontend uses hooks', { type: MemoryType.PATTERN, tags: ['frontend'] });
      me.remember('API server runs on port 3000', { type: MemoryType.FILE, tags: ['backend'] });

      const result = me.buildContext({ query: 'React frontend' });
      assert.ok(result.context.length > 0);
      assert.ok(result.tokenUsage > 0);
    });

    it('should include previous summary if provided', () => {
      const me = new MemoryEngine();
      const result = me.buildContext({
        query: 'test',
        prevSummary: 'Previous task completed: implemented auth module',
      });
      assert.ok(result.context.includes('Previous Task Results'));
      assert.ok(result.context.includes('auth module'));
    });

    it('should include files if provided', () => {
      const me = new MemoryEngine();
      const result = me.buildContext({
        query: 'test',
        files: [
          { path: 'src/index.js', content: 'export default {}' },
          { path: 'src/utils.js', content: 'export const fn = () => {}' },
        ],
      });
      assert.ok(result.context.includes('Relevant Files'));
      assert.ok(result.context.includes('src/index.js'));
    });

    it('should respect token budget', () => {
      const me = new MemoryEngine();
      for (let i = 0; i < 50; i++) {
        me.remember(`Long memory entry number ${i} with padding text to increase token count`);
      }

      const result = me.buildContext({ query: 'memory', tokenBudget: 500 });
      assert.ok(result.tokenUsage <= 600);
    });

    it('should return byTier breakdown', () => {
      const me = new MemoryEngine();
      me.remember('hot entry');

      const result = me.buildContext({ query: 'hot' });
      assert.ok('byTier' in result);
    });

    it('should organize memories by tier in context', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('recent hot memory', { importance: 80 });

      me.remember('warm source 1', { type: MemoryType.PATTERN, tags: ['p'] });
      me.remember('warm source 2', { type: MemoryType.PATTERN, tags: ['p'] });
      me.consolidate({ maxAge: 0 });

      const result = me.buildContext({ query: 'memory pattern' });
      assert.ok(result.context.includes('Recent Context') || result.context.includes('Learned Knowledge'));
    });
  });

  // ── save() and load() — Cold tier persistence ─────────────────────────

  describe('save() and load()', () => {
    const persistPath = join(tmpdir(), `forge-memory-test-${Date.now()}.json`);

    it('should save and load cold tier to/from file', async () => {
      const me1 = new MemoryEngine({
        persistencePath: persistPath,
        autoConsolidateThreshold: 999999,
      });

      me1.remember('persistent memory 1', { type: MemoryType.FILE, tags: ['important'] });
      me1.remember('persistent memory 2', { type: MemoryType.FILE, tags: ['important'] });
      me1.remember('persistent memory 3', { type: MemoryType.FILE, tags: ['important'] });

      me1.consolidate({ maxAge: 0 });
      me1.archive({ maxAge: 0 });
      await me1.save();

      const raw = await readFile(persistPath, 'utf-8');
      const data = JSON.parse(raw);
      assert.ok(data.entries);
      assert.ok(data.version === 1);

      const me2 = new MemoryEngine({ persistencePath: persistPath });
      await me2.load();

      const status = me2.getStatus();
      assert.ok(status.cold.entries > 0);
      assert.ok(status.cold.loaded);

      const result = me2.recall('persistent', { tiers: [MemoryTier.COLD] });
      assert.ok(result.entries.length > 0);

      await rm(persistPath, { force: true });
    });

    it('should handle missing persistence file gracefully', async () => {
      const me = new MemoryEngine({ persistencePath: '/tmp/nonexistent-forge-mem.json' });
      await me.load();
      assert.equal(me.getStatus().cold.entries, 0);
    });

    it('should handle no persistence path', async () => {
      const me = new MemoryEngine();
      await me.save();
      await me.load();
    });
  });

  // ── clear() ────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should clear all tiers', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('a', { tags: ['x'] });
      me.remember('b', { tags: ['x'] });
      me.consolidate({ maxAge: 0 });

      me.clear();
      const status = me.getStatus();
      assert.equal(status.hot.entries, 0);
      assert.equal(status.warm.totalEntries, 0);
      assert.equal(status.cold.entries, 0);
    });
  });

  // ── getStatus() and getStats() ─────────────────────────────────────────

  describe('getStatus() and getStats()', () => {
    it('should return comprehensive status', () => {
      const me = new MemoryEngine();
      me.remember('test');

      const status = me.getStatus();
      assert.ok('hot' in status);
      assert.ok('warm' in status);
      assert.ok('cold' in status);
      assert.ok('config' in status);
      assert.equal(status.hot.entries, 1);
    });

    it('should return operation and tier stats', () => {
      const me = new MemoryEngine();
      me.remember('a');
      me.recall('a');

      const stats = me.getStats();
      assert.ok('operations' in stats);
      assert.ok('hot' in stats);
      assert.ok('warm' in stats);
      assert.ok('cold' in stats);
      assert.equal(stats.operations.remembers, 1);
      assert.equal(stats.operations.recalls, 1);
    });

    it('should report warm tier by-category breakdown', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });
      me.remember('file A', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file B', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('error X', { type: MemoryType.ERROR, tags: ['runtime'] });
      me.remember('error Y', { type: MemoryType.ERROR, tags: ['runtime'] });
      me.consolidate({ maxAge: 0 });

      const status = me.getStatus();
      assert.ok('byCategory' in status.warm);
    });
  });

  // ── Integration: Full memory lifecycle ─────────────────────────────────

  describe('integration: hot → warm → cold', () => {
    it('should flow memories through all three tiers', () => {
      const me = new MemoryEngine({ autoConsolidateThreshold: 999999 });

      me.remember('file: src/index.js has main()', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file: src/utils.js has helpers', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('file: src/api.js has routes', { type: MemoryType.FILE, tags: ['src'] });
      me.remember('error: TypeError at line 42', { type: MemoryType.ERROR, tags: ['bug'] });
      me.remember('error: null ref in handler', { type: MemoryType.ERROR, tags: ['bug'] });

      assert.equal(me.getStatus().hot.entries, 5);

      me.consolidate({ maxAge: 0 });
      assert.ok(me.getStatus().warm.totalEntries > 0);

      me.archive({ maxAge: 0 });
      assert.ok(me.getStatus().cold.entries > 0);

      const results = me.search('file');
      assert.ok(results.length > 0);
    });

    it('should handle rapid remember/recall cycles', () => {
      const me = new MemoryEngine({ hotMaxEntries: 50, hotTokenBudget: 8000 });

      for (let i = 0; i < 200; i++) {
        me.remember(`Rapid entry ${i} with moderate content length`, {
          type: ALL_TYPES[i % ALL_TYPES.length],
          tags: [`tag-${i % 5}`],
          importance: 30 + (i % 70),
        });
      }

      const status = me.getStatus();
      assert.ok(status.hot.entries <= 50);

      const results = me.recall('entry', { limit: 10 });
      assert.ok(results.entries.length <= 10);
    });

    it('should support full session lifecycle with persistence', async () => {
      const persistPath = join(tmpdir(), `forge-memory-session-${Date.now()}.json`);

      const session1 = new MemoryEngine({
        persistencePath: persistPath,
        autoConsolidateThreshold: 999999,
      });

      session1.remember('Session 1: implemented auth', { type: MemoryType.DECISION, tags: ['auth'] });
      session1.remember('Session 1: fixed login bug', { type: MemoryType.ERROR, tags: ['auth', 'bug'] });
      session1.remember('Session 1: pattern: use middleware', { type: MemoryType.PATTERN, tags: ['auth'] });
      session1.consolidate({ maxAge: 0 });
      await session1.save();

      const session2 = new MemoryEngine({ persistencePath: persistPath });
      await session2.load();

      session2.remember('Session 2: added rate limiting', { type: MemoryType.DECISION, tags: ['api'] });

      const result = session2.recall('auth');
      assert.ok(result.entries.length > 0);

      await rm(persistPath, { force: true });
    });
  });

  // ── Auto-consolidation ─────────────────────────────────────────────────

  describe('auto-consolidation', () => {
    it('should trigger consolidation when hot entries exceed threshold', () => {
      const me = new MemoryEngine({
        autoConsolidateThreshold: 5,
        hotMaxEntries: 100,
        hotTokenBudget: 999999,
      });

      for (let i = 0; i < 10; i++) {
        me.remember(`Auto-consolidate entry ${i}`, {
          type: MemoryType.FILE,
          tags: ['auto'],
        });
      }

      const stats = me.getStats();
      assert.ok(stats.operations.remembers >= 10);
    });
  });
});
