import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CrossSessionMemory } from '../src/cross-session-memory/index.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ============================================================================
// CrossSessionMemory — Ring buffer, deduplication, consolidation, feedback,
// stats, persistence, clear, export, edge cases
// ============================================================================

describe('CrossSessionMemory (advanced)', () => {
  // ── Ring buffer eviction ─────────────────────────────────────────────────

  describe('ring buffer eviction', () => {
    it('evicts oldest entries when maxGlobalEntries is exceeded', () => {
      const csm = new CrossSessionMemory({ maxGlobalEntries: 3 });
      for (let i = 0; i < 5; i++) {
        csm.storeInsight({ content: `entry number ${i}` });
      }
      const stats = csm.getStats();
      assert.equal(stats.insights, 3);

      const result = csm.search('entry number');
      const contents = result.results.map(r => r.content);
      assert.ok(!contents.includes('entry number 0'));
      assert.ok(!contents.includes('entry number 1'));
      assert.ok(contents.includes('entry number 4'));
    });

    it('applies ring buffer independently per pool', () => {
      const csm = new CrossSessionMemory({ maxGlobalEntries: 2 });
      csm.storeInsight({ content: 'insight one' });
      csm.storeInsight({ content: 'insight two' });
      csm.storeInsight({ content: 'insight three' });

      csm.storeErrorFix({ errorPattern: 'err1', fixDescription: 'fix1' });
      csm.storeErrorFix({ errorPattern: 'err2', fixDescription: 'fix2' });

      const stats = csm.getStats();
      assert.equal(stats.insights, 2);
      assert.equal(stats.errorFixes, 2);
    });
  });

  // ── Deduplication via importFromProject ──────────────────────────────────

  describe('deduplication (importFromProject)', () => {
    it('deduplicates similar insight entries', () => {
      const csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'Always use try catch with async await patterns' });

      const result = csm.importFromProject(
        [{ content: 'Always use try catch with async await patterns', type: 'insight', importance: 60 }],
        { projectName: 'test-project' },
      );

      assert.equal(result.deduped, 1);
      assert.equal(result.imported, 0);
    });

    it('imports dissimilar insight entries', () => {
      const csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'Always use try catch with async await' });

      const result = csm.importFromProject(
        [{ content: 'Use a completely different approach for database management queries', type: 'insight', importance: 70 }],
        { projectName: 'test-project' },
      );

      assert.equal(result.imported, 1);
      assert.equal(result.deduped, 0);
    });

    it('deduplicates similar error fix entries', () => {
      const csm = new CrossSessionMemory();
      const errorText = 'TypeError cannot read property of undefined in module handler';
      csm.storeErrorFix({ errorPattern: errorText, fixDescription: '' });

      const result = csm.importFromProject(
        [{ content: errorText, type: 'error', fixDescription: '', importance: 80 }],
        { projectName: 'proj', languages: ['javascript'] },
      );

      assert.equal(result.deduped, 1);
      assert.equal(result.imported, 0);
    });

    it('deduplicates similar strategy entries', () => {
      const csm = new CrossSessionMemory();
      csm.storeStrategy({ name: 'Early Returns', description: 'Use early returns to simplify control flow logic' });

      const result = csm.importFromProject(
        [{ content: 'Use early returns to simplify control flow logic', type: 'strategy', title: 'Early Returns', importance: 75 }],
        { projectName: 'proj', languages: ['javascript'] },
      );

      assert.equal(result.deduped, 1);
      assert.equal(result.imported, 0);
    });

    it('skips entries with empty content', () => {
      const csm = new CrossSessionMemory();
      const result = csm.importFromProject(
        [{ content: '', type: 'insight' }],
        { projectName: 'proj' },
      );
      assert.equal(result.imported, 0);
      assert.equal(result.deduped, 0);
    });

    it('respects maxProjectEntries limit', () => {
      const csm = new CrossSessionMemory({ maxProjectEntries: 3 });
      const memories = [];
      for (let i = 0; i < 10; i++) {
        memories.push({ content: `Unique completely different insight number ${i} about various topics xyz`, type: 'insight' });
      }
      const result = csm.importFromProject(memories, { projectName: 'proj' });
      assert.ok(result.imported + result.deduped <= 3);
    });
  });

  // ── consolidate ──────────────────────────────────────────────────────────

  describe('consolidate', () => {
    it('merges similar insights in the same category with shared tags', () => {
      const csm = new CrossSessionMemory({ consolidationThreshold: 2 });
      for (let i = 0; i < 3; i++) {
        csm.storeInsight({ content: `Insight about async pattern ${i}`, category: 'patterns', tags: ['async'] });
      }
      const result = csm.consolidate();
      assert.ok(result.consolidated >= 1);
      assert.ok(result.removed >= 3);
    });

    it('does not consolidate groups below the threshold', () => {
      const csm = new CrossSessionMemory({ consolidationThreshold: 10 });
      for (let i = 0; i < 3; i++) {
        csm.storeInsight({ content: `Insight ${i}`, category: 'patterns', tags: ['async'] });
      }
      const result = csm.consolidate();
      assert.equal(result.consolidated, 0);
      assert.equal(result.removed, 0);
    });

    it('merges error fixes with identical normalized error patterns', () => {
      const csm = new CrossSessionMemory();
      csm.storeErrorFix({ errorPattern: 'TypeError null', fixDescription: 'fix A' });
      csm.storeErrorFix({ errorPattern: 'TypeError null', fixDescription: 'fix B' });

      const result = csm.consolidate();
      const stats = csm.getStats();
      assert.equal(stats.errorFixes, 1);
      assert.ok(result.removed >= 1);
    });

    it('sets lastConsolidation timestamp', () => {
      const csm = new CrossSessionMemory();
      assert.equal(csm.getStatus().lastConsolidation, null);
      csm.consolidate();
      assert.ok(csm.getStatus().lastConsolidation > 0);
    });
  });

  // ── recordFeedback ───────────────────────────────────────────────────────

  describe('recordFeedback', () => {
    it('increments positive feedback and adjusts confidence for insights', () => {
      const csm = new CrossSessionMemory();
      const id = csm.storeInsight({ content: 'test feedback', confidence: 50 });
      const ok = csm.recordFeedback(id, true);
      assert.equal(ok, true);
      const result = csm.search('test feedback', { type: 'insights' });
      assert.equal(result.results[0].feedback.positive, 1);
      assert.ok(result.results[0].confidence > 50);
    });

    it('increments negative feedback and adjusts confidence downward', () => {
      const csm = new CrossSessionMemory();
      const id = csm.storeInsight({ content: 'negative test', confidence: 50 });
      csm.recordFeedback(id, false);
      const result = csm.search('negative test', { type: 'insights' });
      assert.equal(result.results[0].feedback.negative, 1);
      assert.ok(result.results[0].confidence < 50);
    });

    it('returns false for a non-existent entry id', () => {
      const csm = new CrossSessionMemory();
      const ok = csm.recordFeedback('csm_nonexistent_999', true);
      assert.equal(ok, false);
    });

    it('adjusts successRate for error fix entries', () => {
      const csm = new CrossSessionMemory();
      const id = csm.storeErrorFix({ errorPattern: 'err', fixDescription: 'fix', successRate: 50 });
      csm.recordFeedback(id, true);
      const result = csm.search('err', { type: 'errorFixes' });
      assert.ok(result.results[0].successRate > 50);
    });

    it('adjusts effectiveness for strategy entries', () => {
      const csm = new CrossSessionMemory();
      const id = csm.storeStrategy({ name: 'strat', description: 'desc', effectiveness: 50 });
      csm.recordFeedback(id, true);
      const result = csm.search('strat', { type: 'strategies' });
      assert.ok(result.results[0].effectiveness > 50);
    });
  });

  // ── getStats ─────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns correct counts and avgConfidence', () => {
      const csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'a', confidence: 80 });
      csm.storeErrorFix({ errorPattern: 'e', fixDescription: 'f', successRate: 60 });
      csm.storeStrategy({ name: 's', description: 'd', effectiveness: 70 });

      const stats = csm.getStats();
      assert.equal(stats.insights, 1);
      assert.equal(stats.errorFixes, 1);
      assert.equal(stats.strategies, 1);
      assert.equal(stats.avgConfidence, 70);
    });

    it('collects languages from error fixes and strategies', () => {
      const csm = new CrossSessionMemory();
      csm.storeErrorFix({ errorPattern: 'e', fixDescription: 'f', language: 'python' });
      csm.storeStrategy({ name: 's', description: 'd', applicableTo: ['typescript'] });

      const stats = csm.getStats();
      assert.ok(stats.languages.includes('python'));
      assert.ok(stats.languages.includes('typescript'));
    });

    it('excludes "unknown" from languages', () => {
      const csm = new CrossSessionMemory();
      csm.storeErrorFix({ errorPattern: 'e', fixDescription: 'f' });
      const stats = csm.getStats();
      assert.ok(!stats.languages.includes('unknown'));
    });

    it('returns avgConfidence 0 for empty pools', () => {
      const csm = new CrossSessionMemory();
      const stats = csm.getStats();
      assert.equal(stats.avgConfidence, 0);
    });
  });

  // ── save / load persistence ──────────────────────────────────────────────

  describe('save and load persistence', () => {
    let tmpDir;

    before(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'p8-csm-adv-test-'));
    });

    after(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('save creates a file and load restores all entries', async () => {
      const persistPath = join(tmpDir, 'memory.json');
      const csm1 = new CrossSessionMemory({ persistencePath: persistPath });
      csm1.storeInsight({ content: 'persist insight', category: 'test', confidence: 75 });
      csm1.storeErrorFix({ errorPattern: 'persist err', fixDescription: 'persist fix', language: 'go' });
      csm1.storeStrategy({ name: 'persist strat', description: 'persist desc', effectiveness: 85 });
      await csm1.save();

      const csm2 = new CrossSessionMemory({ persistencePath: persistPath });
      await csm2.load();
      const stats = csm2.getStats();
      assert.equal(stats.insights, 1);
      assert.equal(stats.errorFixes, 1);
      assert.equal(stats.strategies, 1);

      const result = csm2.search('persist insight', { type: 'insights' });
      assert.equal(result.results[0].content, 'persist insight');
    });

    it('load is a no-op when file does not exist', async () => {
      const csm = new CrossSessionMemory({ persistencePath: join(tmpDir, 'nonexistent.json') });
      await csm.load();
      const stats = csm.getStats();
      assert.equal(stats.insights, 0);
    });

    it('save is a no-op when persistencePath is null', async () => {
      const csm = new CrossSessionMemory();
      await csm.save();
    });

    it('load is a no-op when persistencePath is null', async () => {
      const csm = new CrossSessionMemory();
      await csm.load();
      assert.equal(csm.getStats().insights, 0);
    });

    it('load restores lastConsolidation timestamp', async () => {
      const persistPath = join(tmpDir, 'consolidation.json');
      const csm1 = new CrossSessionMemory({ persistencePath: persistPath });
      csm1.consolidate();
      const ts = csm1.getStatus().lastConsolidation;
      await csm1.save();

      const csm2 = new CrossSessionMemory({ persistencePath: persistPath });
      await csm2.load();
      assert.equal(csm2.getStatus().lastConsolidation, ts);
    });
  });

  // ── clear ────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all entries from all pools', () => {
      const csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'a' });
      csm.storeErrorFix({ errorPattern: 'b', fixDescription: 'c' });
      csm.storeStrategy({ name: 'd', description: 'e' });
      csm.clear();
      const stats = csm.getStats();
      assert.equal(stats.insights, 0);
      assert.equal(stats.errorFixes, 0);
      assert.equal(stats.strategies, 0);
    });

    it('resets lastConsolidation to null', () => {
      const csm = new CrossSessionMemory();
      csm.consolidate();
      assert.ok(csm.getStatus().lastConsolidation !== null);
      csm.clear();
      assert.equal(csm.getStatus().lastConsolidation, null);
    });
  });

  // ── exportForProject ─────────────────────────────────────────────────────

  describe('exportForProject', () => {
    it('returns deep-cloned entries for all pools', () => {
      const csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'exported insight', tags: ['javascript'] });
      csm.storeErrorFix({ errorPattern: 'err', fixDescription: 'fix', language: 'javascript' });
      csm.storeStrategy({ name: 'strat', description: 'desc', applicableTo: ['javascript'] });

      const exported = csm.exportForProject({ languages: ['javascript'] });
      assert.ok(Array.isArray(exported.insights));
      assert.ok(Array.isArray(exported.errorFixes));
      assert.ok(Array.isArray(exported.strategies));
      assert.ok(exported.insights.length >= 1);
      assert.ok(exported.errorFixes.length >= 1);
      assert.ok(exported.strategies.length >= 1);
    });

    it('returns empty arrays when no entries exist', () => {
      const csm = new CrossSessionMemory();
      const exported = csm.exportForProject({ languages: ['python'] });
      assert.deepEqual(exported.insights, []);
      assert.deepEqual(exported.errorFixes, []);
      assert.deepEqual(exported.strategies, []);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('search on empty pools returns empty results', () => {
      const csm = new CrossSessionMemory();
      const result = csm.search('anything');
      assert.deepEqual(result.results, []);
      assert.equal(result.total, 0);
    });

    it('recall on empty pools returns empty structure', () => {
      const csm = new CrossSessionMemory();
      const result = csm.recall('anything');
      assert.deepEqual(result.insights, []);
      assert.deepEqual(result.errorFixes, []);
      assert.deepEqual(result.strategies, []);
      assert.equal(result.total, 0);
    });

    it('search with empty query string returns no matches', () => {
      const csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'some content here' });
      const result = csm.search('');
      assert.ok(result);
    });

    it('multiple store operations produce unique ids', () => {
      const csm = new CrossSessionMemory();
      const id1 = csm.storeInsight({ content: 'a' });
      const id2 = csm.storeInsight({ content: 'b' });
      const id3 = csm.storeErrorFix({ errorPattern: 'c', fixDescription: 'd' });
      assert.notEqual(id1, id2);
      assert.notEqual(id2, id3);
    });
  });
});
