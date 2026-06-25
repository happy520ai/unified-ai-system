import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { CrossSessionMemory } from '../src/cross-session-memory/index.js';

// ============================================================================
// CrossSessionMemory — Constructor, storeInsight, storeErrorFix, storeStrategy,
// search, recall
// ============================================================================

describe('CrossSessionMemory', () => {
  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      const csm = new CrossSessionMemory();
      const status = csm.getStatus();
      assert.equal(status.entries, 0);
      assert.deepEqual(status.byType, { insights: 0, errorFixes: 0, strategies: 0 });
      assert.equal(status.persistencePath, null);
      assert.equal(status.lastConsolidation, null);
    });

    it('accepts custom persistencePath', () => {
      const csm = new CrossSessionMemory({ persistencePath: '/tmp/custom.json' });
      const status = csm.getStatus();
      assert.equal(status.persistencePath, '/tmp/custom.json');
    });

    it('accepts custom maxGlobalEntries', () => {
      const csm = new CrossSessionMemory({ maxGlobalEntries: 5 });
      // Store 6 entries; the first should be evicted
      for (let i = 0; i < 6; i++) {
        csm.storeInsight({ content: `entry-${i}` });
      }
      const stats = csm.getStats();
      assert.equal(stats.insights, 5);
    });

    it('accepts custom consolidationThreshold', () => {
      const csm = new CrossSessionMemory({ consolidationThreshold: 3 });
      // Just verifying it constructs without error
      assert.ok(csm);
    });

    it('accepts custom relevanceDecayDays', () => {
      const csm = new CrossSessionMemory({ relevanceDecayDays: 30 });
      assert.ok(csm);
    });
  });

  // ── storeInsight ─────────────────────────────────────────────────────────

  describe('storeInsight', () => {
    let csm;

    before(() => {
      csm = new CrossSessionMemory();
    });

    it('stores an insight and returns a string id', () => {
      const id = csm.storeInsight({ content: 'Always use try/catch with async/await' });
      assert.equal(typeof id, 'string');
      assert.ok(id.startsWith('csm_'));
    });

    it('applies default category "general" when omitted', () => {
      csm.clear();
      csm.storeInsight({ content: 'some insight' });
      const result = csm.search('some insight', { type: 'insights' });
      assert.equal(result.results[0].category, 'general');
    });

    it('applies default empty tags array when omitted', () => {
      csm.clear();
      csm.storeInsight({ content: 'no tags insight' });
      const result = csm.search('no tags insight', { type: 'insights' });
      assert.deepEqual(result.results[0].tags, []);
    });

    it('applies default confidence of 50 when omitted', () => {
      csm.clear();
      csm.storeInsight({ content: 'default confidence' });
      const result = csm.search('default confidence', { type: 'insights' });
      assert.equal(result.results[0].confidence, 50);
    });

    it('stores with explicit category, tags, and confidence', () => {
      csm.clear();
      csm.storeInsight({
        content: 'explicit fields',
        category: 'patterns',
        tags: ['async', 'error'],
        confidence: 85,
      });
      const result = csm.search('explicit fields', { type: 'insights' });
      assert.equal(result.results[0].category, 'patterns');
      assert.deepEqual(result.results[0].tags, ['async', 'error']);
      assert.equal(result.results[0].confidence, 85);
    });

    it('handles missing content gracefully (defaults to empty string)', () => {
      csm.clear();
      const id = csm.storeInsight({});
      assert.equal(typeof id, 'string');
      const stats = csm.getStats();
      assert.equal(stats.insights, 1);
    });

    it('initializes feedback counters to zero', () => {
      csm.clear();
      csm.storeInsight({ content: 'feedback test' });
      const result = csm.search('feedback test', { type: 'insights' });
      assert.deepEqual(result.results[0].feedback, { positive: 0, negative: 0 });
    });
  });

  // ── storeErrorFix ────────────────────────────────────────────────────────

  describe('storeErrorFix', () => {
    let csm;

    before(() => {
      csm = new CrossSessionMemory();
    });

    it('stores an error fix and returns a string id', () => {
      const id = csm.storeErrorFix({
        errorPattern: 'TypeError: Cannot read property of undefined',
        fixDescription: 'Add null check before access',
      });
      assert.equal(typeof id, 'string');
      assert.ok(id.startsWith('csm_'));
    });

    it('applies default language "unknown" when omitted', () => {
      csm.clear();
      csm.storeErrorFix({ errorPattern: 'some error', fixDescription: 'some fix' });
      const result = csm.search('some error', { type: 'errorFixes' });
      assert.equal(result.results[0].language, 'unknown');
    });

    it('applies default successRate of 50 when omitted', () => {
      csm.clear();
      csm.storeErrorFix({ errorPattern: 'err', fixDescription: 'fix' });
      const result = csm.search('err', { type: 'errorFixes' });
      assert.equal(result.results[0].successRate, 50);
    });

    it('stores with explicit language and successRate', () => {
      csm.clear();
      csm.storeErrorFix({
        errorPattern: 'SyntaxError',
        fixDescription: 'Fix missing bracket',
        language: 'javascript',
        tags: ['syntax'],
        successRate: 90,
      });
      const result = csm.search('SyntaxError', { type: 'errorFixes' });
      assert.equal(result.results[0].language, 'javascript');
      assert.equal(result.results[0].successRate, 90);
      assert.deepEqual(result.results[0].tags, ['syntax']);
    });

    it('handles missing fields gracefully', () => {
      csm.clear();
      const id = csm.storeErrorFix({});
      assert.equal(typeof id, 'string');
      const stats = csm.getStats();
      assert.equal(stats.errorFixes, 1);
    });
  });

  // ── storeStrategy ────────────────────────────────────────────────────────

  describe('storeStrategy', () => {
    let csm;

    before(() => {
      csm = new CrossSessionMemory();
    });

    it('stores a strategy and returns a string id', () => {
      const id = csm.storeStrategy({
        name: 'Early Returns',
        description: 'Use early returns to simplify control flow',
      });
      assert.equal(typeof id, 'string');
      assert.ok(id.startsWith('csm_'));
    });

    it('applies default empty applicableTo when omitted', () => {
      csm.clear();
      csm.storeStrategy({ name: 'test', description: 'test strat' });
      const result = csm.search('test strat', { type: 'strategies' });
      assert.deepEqual(result.results[0].applicableTo, []);
    });

    it('applies default effectiveness of 50 when omitted', () => {
      csm.clear();
      csm.storeStrategy({ name: 'test', description: 'test strat' });
      const result = csm.search('test strat', { type: 'strategies' });
      assert.equal(result.results[0].effectiveness, 50);
    });

    it('stores with all explicit fields', () => {
      csm.clear();
      csm.storeStrategy({
        name: 'Guard Clauses',
        description: 'Use guard clauses for readability',
        applicableTo: ['javascript', 'typescript'],
        tags: ['clean-code'],
        effectiveness: 80,
      });
      const result = csm.search('Guard Clauses', { type: 'strategies' });
      assert.deepEqual(result.results[0].applicableTo, ['javascript', 'typescript']);
      assert.equal(result.results[0].effectiveness, 80);
    });

    it('handles missing fields gracefully', () => {
      csm.clear();
      const id = csm.storeStrategy({});
      assert.equal(typeof id, 'string');
      const stats = csm.getStats();
      assert.equal(stats.strategies, 1);
    });
  });

  // ── search ───────────────────────────────────────────────────────────────

  describe('search', () => {
    let csm;

    before(() => {
      csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'Always use try/catch with async/await', category: 'patterns', tags: ['async'] });
      csm.storeInsight({ content: 'Prefer composition over inheritance', category: 'design', tags: ['oop'] });
      csm.storeErrorFix({ errorPattern: 'TypeError null reference', fixDescription: 'Add null guard', language: 'javascript' });
      csm.storeStrategy({ name: 'Early Returns', description: 'Simplify control flow with early returns', tags: ['clean-code'] });
    });

    it('finds insights by keyword', () => {
      const result = csm.search('async try catch');
      assert.ok(result.results.length > 0);
      const found = result.results.some(r => r._type === 'insight' && r.content.includes('async'));
      assert.ok(found);
    });

    it('finds error fixes by keyword', () => {
      const result = csm.search('TypeError null');
      const found = result.results.some(r => r._type === 'errorFix');
      assert.ok(found);
    });

    it('finds strategies by keyword', () => {
      const result = csm.search('early returns control flow');
      const found = result.results.some(r => r._type === 'strategy');
      assert.ok(found);
    });

    it('filters by type "insights"', () => {
      const result = csm.search('async', { type: 'insights' });
      for (const r of result.results) {
        assert.equal(r._type, 'insight');
      }
    });

    it('filters by type "errorFixes"', () => {
      const result = csm.search('TypeError', { type: 'errorFixes' });
      for (const r of result.results) {
        assert.equal(r._type, 'errorFix');
      }
    });

    it('filters by type "strategies"', () => {
      const result = csm.search('early returns', { type: 'strategies' });
      for (const r of result.results) {
        assert.equal(r._type, 'strategy');
      }
    });

    it('returns empty results for no match', () => {
      const result = csm.search('zzzznonexistentzzz');
      assert.equal(result.results.length, 0);
      assert.equal(result.total, 0);
    });

    it('respects the limit option', () => {
      // Add many entries
      const csm2 = new CrossSessionMemory();
      for (let i = 0; i < 10; i++) {
        csm2.storeInsight({ content: `repeated keyword entry number ${i}` });
      }
      const result = csm2.search('repeated keyword', { limit: 3 });
      assert.ok(result.results.length <= 3);
      assert.equal(result.total, 10);
    });

    it('returns results sorted by score descending', () => {
      const result = csm.search('async try catch');
      for (let i = 1; i < result.results.length; i++) {
        assert.ok(result.results[i - 1]._score >= result.results[i]._score);
      }
    });
  });

  // ── recall ───────────────────────────────────────────────────────────────

  describe('recall', () => {
    let csm;

    before(() => {
      csm = new CrossSessionMemory();
      csm.storeInsight({ content: 'Use try/catch with async/await', category: 'patterns', tags: ['async', 'error'], confidence: 80 });
      csm.storeInsight({ content: 'Prefer composition over inheritance', category: 'design', tags: ['oop'], confidence: 60 });
      csm.storeErrorFix({ errorPattern: 'TypeError null reference', fixDescription: 'Add null guard', language: 'javascript', tags: ['safety'], successRate: 75 });
      csm.storeStrategy({ name: 'Early Returns', description: 'Simplify flow with early returns', applicableTo: ['javascript'], tags: ['clean-code'], effectiveness: 70 });
    });

    it('returns results from all three pools', () => {
      const result = csm.recall('javascript error handling');
      assert.ok(Array.isArray(result.insights));
      assert.ok(Array.isArray(result.errorFixes));
      assert.ok(Array.isArray(result.strategies));
      assert.equal(typeof result.total, 'number');
    });

    it('filters insights by category', () => {
      const result = csm.recall('patterns', { categories: ['patterns'] });
      for (const insight of result.insights) {
        assert.equal(insight.category, 'patterns');
      }
    });

    it('filters insights by tags', () => {
      const result = csm.recall('async error', { tags: ['async'] });
      for (const insight of result.insights) {
        assert.ok(insight.tags.some(t => t.toLowerCase() === 'async'));
      }
    });

    it('filters error fixes by language', () => {
      const result = csm.recall('null reference', { language: 'javascript' });
      for (const fix of result.errorFixes) {
        assert.equal(fix.language.toLowerCase(), 'javascript');
      }
    });

    it('filters by minConfidence', () => {
      const result = csm.recall('async patterns', { minConfidence: 70 });
      for (const insight of result.insights) {
        assert.ok(insight.confidence >= 70);
      }
    });

    it('respects limit option', () => {
      const result = csm.recall('javascript', { limit: 1 });
      assert.ok(result.insights.length <= 1);
      assert.ok(result.errorFixes.length <= 1);
      assert.ok(result.strategies.length <= 1);
    });

    it('returns empty arrays when nothing matches', () => {
      const emptyCsm = new CrossSessionMemory();
      const result = emptyCsm.recall('zzzznonexistentzzz');
      assert.deepEqual(result.insights, []);
      assert.deepEqual(result.errorFixes, []);
      assert.deepEqual(result.strategies, []);
      assert.equal(result.total, 0);
    });
  });
});
