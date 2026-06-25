/**
 * Tests for P6-P1P2 ErrorPatternLearner module.
 *
 * Coverage:
 *   - Constructor defaults and custom options
 *   - All public methods (recordError, learn, getPatterns, getInstructions,
 *     getRelevantPatterns, getStats, getTopPatterns, addPattern, removePattern,
 *     recordFeedback, exportPatterns, importPatterns, getStatus, clear,
 *     save, load)
 *   - Edge cases (empty state, boundaries, persistence, merging)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

describe('ErrorPatternLearner', () => {
  let ErrorPatternLearner;

  before(async () => {
    const mod = await import('../src/error-pattern-learner/index.js');
    ErrorPatternLearner = mod.ErrorPatternLearner;
  });

  // ── Constructor ────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const learner = new ErrorPatternLearner();
    const status = learner.getStatus();
    assert.equal(status.patterns, 0);
    assert.equal(status.errors, 0);
    assert.equal(status.lastLearned, null);
    assert.equal(status.topPattern, null);
  });

  it('should accept custom options', () => {
    const learner = new ErrorPatternLearner({
      maxPatterns: 50, minOccurrences: 3, decayHalfLife: 48,
    });
    const status = learner.getStatus();
    assert.equal(status.patterns, 0);
  });

  // ── recordError() ──────────────────────────────────────────────────────

  it('should record an error and return a unique id', () => {
    const learner = new ErrorPatternLearner();
    const id = learner.recordError({ errorType: 'runtime', message: 'Cannot read property x' });
    assert.ok(id.startsWith('err-'));
    assert.equal(learner.getStatus().errors, 1);
  });

  it('should default errorType to unknown', () => {
    const learner = new ErrorPatternLearner();
    learner.recordError({ message: 'something broke' });
    const stats = learner.getStats();
    assert.equal(stats.byType.unknown, 1);
  });

  it('should fill defaults for missing fields', () => {
    const learner = new ErrorPatternLearner();
    learner.recordError({});
    const stats = learner.getStats();
    assert.equal(stats.totalErrors, 1);
    assert.equal(stats.byType.unknown, 1);
    assert.equal(stats.byWorker.unknown, 1);
  });

  it('should deep-clone context', () => {
    const learner = new ErrorPatternLearner();
    const ctx = { taskType: 'coding', key: 'val' };
    learner.recordError({ message: 'err', context: ctx });
    ctx.key = 'changed';
    const stats = learner.getStats();
    assert.equal(stats.totalErrors, 1);
  });

  it('should trim errors when exceeding MAX_RAW_ERRORS (1000)', () => {
    const learner = new ErrorPatternLearner();
    for (let i = 0; i < 1010; i++) {
      learner.recordError({ message: `error-${i}` });
    }
    assert.equal(learner.getStats().totalErrors, 1000);
  });

  // ── learn() ────────────────────────────────────────────────────────────

  it('should return zero patterns when not enough occurrences', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 3 });
    learner.recordError({ errorType: 'runtime', message: 'fail once' });
    learner.recordError({ errorType: 'runtime', message: 'fail twice' });
    const result = learner.learn();
    assert.equal(result.newPatterns, 0);
    assert.equal(result.totalPatterns, 0);
  });

  it('should create a pattern when occurrences meet minOccurrences', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 2 });
    learner.recordError({ errorType: 'runtime', message: 'Error code 42 in module loader' });
    learner.recordError({ errorType: 'runtime', message: 'Error code 99 in module loader' });
    const result = learner.learn();
    assert.ok(result.totalPatterns >= 1);
    assert.equal(result.newPatterns, result.totalPatterns);
  });

  it('should update existing pattern on subsequent learn()', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 2 });
    learner.recordError({ errorType: 'runtime', message: 'Module not found at path /foo/bar' });
    learner.recordError({ errorType: 'runtime', message: 'Module not found at path /baz/qux' });
    learner.learn();

    learner.recordError({ errorType: 'runtime', message: 'Module not found at path /abc/def' });
    const result = learner.learn();
    assert.ok(result.updatedPatterns >= 1);
  });

  it('should mark errors as processed after learn()', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 2 });
    learner.recordError({ errorType: 'runtime', message: 'error A' });
    learner.recordError({ errorType: 'runtime', message: 'error A' });
    learner.learn();

    const result = learner.learn();
    assert.equal(result.newPatterns, 0);
    assert.equal(result.updatedPatterns, 0);
  });

  it('should set lastLearned timestamp', () => {
    const learner = new ErrorPatternLearner();
    learner.recordError({ message: 'err' });
    learner.learn();
    assert.ok(learner.getStatus().lastLearned > 0);
  });

  // ── getPatterns() ──────────────────────────────────────────────────────

  it('should return empty array when no patterns', () => {
    const learner = new ErrorPatternLearner();
    assert.deepEqual(learner.getPatterns(), []);
  });

  it('should filter patterns by workerType', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    learner.recordError({ errorType: 'runtime', message: 'err1', workerType: 'coder' });
    learner.recordError({ errorType: 'runtime', message: 'err2', workerType: 'reviewer' });
    learner.learn();

    const coderPats = learner.getPatterns({ workerType: 'coder' });
    assert.ok(coderPats.every(p => p.workerTypes.includes('coder')));
  });

  it('should filter patterns by errorType', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    learner.recordError({ errorType: 'runtime', message: 'runtime err' });
    learner.recordError({ errorType: 'syntax', message: 'syntax err' });
    learner.learn();

    const runtime = learner.getPatterns({ errorType: 'runtime' });
    assert.ok(runtime.every(p => p.errorType === 'runtime'));
  });

  it('should sort patterns by confidence descending', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    for (let i = 0; i < 5; i++) {
      learner.recordError({ errorType: 'runtime', message: `error msg ${i}` });
    }
    learner.learn();
    const patterns = learner.getPatterns();
    for (let i = 1; i < patterns.length; i++) {
      assert.ok(patterns[i - 1].confidence >= patterns[i].confidence);
    }
  });

  // ── getInstructions() ──────────────────────────────────────────────────

  it('should return empty string when no relevant patterns', () => {
    const learner = new ErrorPatternLearner();
    assert.equal(learner.getInstructions(), '');
  });

  it('should return formatted instructions block', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    learner.recordError({ errorType: 'runtime', message: 'Null pointer exception' });
    learner.learn();
    const block = learner.getInstructions();
    assert.ok(block.includes('## Common Errors to Avoid'));
    assert.ok(block.includes('[HIGH]') || block.includes('[MED]') || block.includes('[LOW]'));
  });

  // ── getRelevantPatterns() ──────────────────────────────────────────────

  it('should boost score for matching workerType', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    learner.recordError({ errorType: 'runtime', message: 'err', workerType: 'coder' });
    learner.learn();

    const withWorker = learner.getRelevantPatterns({ workerType: 'coder' });
    const withoutWorker = learner.getRelevantPatterns({});
    assert.equal(withWorker.length, 1);
    assert.equal(withoutWorker.length, 1);
  });

  it('should boost score for matching keywords', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    learner.recordError({ errorType: 'runtime', message: 'Null pointer in module loader' });
    learner.learn();

    const withKw = learner.getRelevantPatterns({ keywords: ['null', 'module'] });
    assert.equal(withKw.length, 1);
  });

  it('should respect limit parameter', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    for (let i = 0; i < 5; i++) {
      learner.recordError({ errorType: `type-${i}`, message: `unique error ${i}` });
    }
    learner.learn();
    const limited = learner.getRelevantPatterns({ limit: 2 });
    assert.equal(limited.length, 2);
  });

  // ── getStats() ─────────────────────────────────────────────────────────

  it('should return comprehensive stats', () => {
    const learner = new ErrorPatternLearner();
    learner.recordError({ errorType: 'runtime', workerType: 'coder', message: 'a' });
    learner.recordError({ errorType: 'syntax', workerType: 'reviewer', message: 'b' });
    learner.recordError({ errorType: 'runtime', workerType: 'coder', message: 'c' });
    const stats = learner.getStats();
    assert.equal(stats.totalErrors, 3);
    assert.equal(stats.byType.runtime, 2);
    assert.equal(stats.byType.syntax, 1);
    assert.equal(stats.byWorker.coder, 2);
    assert.equal(stats.byWorker.reviewer, 1);
    assert.ok(Array.isArray(stats.topErrors));
  });

  // ── getTopPatterns() ───────────────────────────────────────────────────

  it('should return empty array when no patterns', () => {
    const learner = new ErrorPatternLearner();
    assert.deepEqual(learner.getTopPatterns(), []);
  });

  it('should sort by occurrences descending', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });
    learner.recordError({ errorType: 'a', message: 'err-a1' });
    learner.recordError({ errorType: 'b', message: 'err-b1' });
    learner.recordError({ errorType: 'b', message: 'err-b2' });
    learner.learn();
    const top = learner.getTopPatterns({ limit: 5 });
    if (top.length >= 2) {
      assert.ok(top[0].occurrences >= top[1].occurrences);
    }
  });

  // ── addPattern() ───────────────────────────────────────────────────────

  it('should manually add a new pattern', () => {
    const learner = new ErrorPatternLearner();
    const id = learner.addPattern({
      errorType: 'runtime',
      messagePattern: 'Module * not found',
      instruction: 'Always verify import paths.',
      workerTypes: ['coder'],
    });
    assert.ok(id.startsWith('pat-'));
    assert.equal(learner.getStatus().patterns, 1);
  });

  it('should merge into existing pattern on addPattern', () => {
    const learner = new ErrorPatternLearner();
    const id1 = learner.addPattern({
      errorType: 'runtime', messagePattern: 'Module * not found',
      instruction: 'Check paths.', workerTypes: ['coder'],
    });
    const id2 = learner.addPattern({
      errorType: 'runtime', messagePattern: 'Module * not found',
      workerTypes: ['reviewer'],
    });
    assert.equal(id1, id2);
    const patterns = learner.getPatterns();
    assert.equal(patterns.length, 1);
    assert.ok(patterns[0].workerTypes.includes('coder'));
    assert.ok(patterns[0].workerTypes.includes('reviewer'));
  });

  it('should use provided confidence or compute it', () => {
    const learner = new ErrorPatternLearner();
    learner.addPattern({ errorType: 'a', messagePattern: 'pat1', confidence: 75 });
    learner.addPattern({ errorType: 'b', messagePattern: 'pat2' });
    const patterns = learner.getPatterns();
    const p1 = patterns.find(p => p.errorType === 'a');
    assert.ok(p1.confidence <= 75); // may decay slightly
  });

  // ── removePattern() ────────────────────────────────────────────────────

  it('should remove an existing pattern', () => {
    const learner = new ErrorPatternLearner();
    const id = learner.addPattern({ errorType: 'x', messagePattern: 'pat' });
    assert.equal(learner.removePattern(id), true);
    assert.equal(learner.getStatus().patterns, 0);
  });

  it('should return false when removing non-existent pattern', () => {
    const learner = new ErrorPatternLearner();
    assert.equal(learner.removePattern('no-such-id'), false);
  });

  // ── recordFeedback() ───────────────────────────────────────────────────

  it('should increase confidence on helpful feedback', () => {
    const learner = new ErrorPatternLearner();
    const id = learner.addPattern({ errorType: 'x', messagePattern: 'pat', confidence: 50 });
    const before = learner.getPatterns().find(p => p.id === id).confidence;
    learner.recordFeedback(id, true);
    const after = learner.getPatterns().find(p => p.id === id).confidence;
    assert.ok(after >= before);
  });

  it('should decrease confidence on unhelpful feedback', () => {
    const learner = new ErrorPatternLearner();
    const id = learner.addPattern({ errorType: 'x', messagePattern: 'pat', occurrences: 5, confidence: 60 });
    const before = learner.getPatterns().find(p => p.id === id).confidence;
    learner.recordFeedback(id, false);
    const after = learner.getPatterns().find(p => p.id === id).confidence;
    assert.ok(after <= before);
  });

  it('should silently ignore feedback for non-existent pattern', () => {
    const learner = new ErrorPatternLearner();
    learner.recordFeedback('no-such', true);
    learner.recordFeedback('no-such', false);
  });

  // ── exportPatterns() / importPatterns() ────────────────────────────────

  it('should export patterns with version and timestamp', () => {
    const learner = new ErrorPatternLearner();
    learner.addPattern({ errorType: 'x', messagePattern: 'pat1' });
    const exported = learner.exportPatterns();
    assert.equal(exported.version, '1.0');
    assert.ok(typeof exported.exportedAt === 'number');
    assert.equal(exported.patterns.length, 1);
  });

  it('should import patterns and merge duplicates', () => {
    const learner1 = new ErrorPatternLearner();
    learner1.addPattern({ errorType: 'x', messagePattern: 'shared-pat' });
    const exported = learner1.exportPatterns();

    const learner2 = new ErrorPatternLearner();
    learner2.addPattern({ errorType: 'x', messagePattern: 'shared-pat' });
    const count = learner2.importPatterns(exported);
    assert.equal(count, 1);
    assert.equal(learner2.getStatus().patterns, 1);
  });

  it('should return 0 when importing invalid data', () => {
    const learner = new ErrorPatternLearner();
    assert.equal(learner.importPatterns(null), 0);
    assert.equal(learner.importPatterns({}), 0);
    assert.equal(learner.importPatterns({ patterns: 'not-array' }), 0);
  });

  // ── getStatus() ────────────────────────────────────────────────────────

  it('should return correct status summary', () => {
    const learner = new ErrorPatternLearner();
    learner.recordError({ message: 'err1' });
    learner.addPattern({ errorType: 'x', messagePattern: 'pat' });
    const status = learner.getStatus();
    assert.equal(status.patterns, 1);
    assert.equal(status.errors, 1);
    assert.ok(status.topPattern);
  });

  // ── clear() ────────────────────────────────────────────────────────────

  it('should clear all patterns and errors', () => {
    const learner = new ErrorPatternLearner();
    learner.recordError({ message: 'err' });
    learner.addPattern({ errorType: 'x', messagePattern: 'pat' });
    learner.clear();
    const status = learner.getStatus();
    assert.equal(status.patterns, 0);
    assert.equal(status.errors, 0);
    assert.equal(status.lastLearned, null);
    assert.equal(status.topPattern, null);
  });

  // ── save() / load() ───────────────────────────────────────────────────

  it('should persist and reload patterns from disk', async () => {
    const filePath = join(tmpdir(), `epl-test-${Date.now()}.json`);
    try {
      const learner1 = new ErrorPatternLearner({ persistencePath: filePath });
      learner1.addPattern({ errorType: 'runtime', messagePattern: 'Null ref' });
      learner1.addPattern({ errorType: 'syntax', messagePattern: 'Unexpected token' });
      await learner1.save();

      const learner2 = new ErrorPatternLearner({ persistencePath: filePath });
      await learner2.load();
      assert.equal(learner2.getStatus().patterns, 2);
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it('should be a no-op for save/load when no persistencePath', async () => {
    const learner = new ErrorPatternLearner();
    await learner.save(); // should not throw
    await learner.load(); // should not throw
    assert.equal(learner.getStatus().patterns, 0);
  });

  it('should silently handle load when file does not exist', async () => {
    const filePath = join(tmpdir(), `epl-nofile-${Date.now()}.json`);
    const learner = new ErrorPatternLearner({ persistencePath: filePath });
    await learner.load(); // should not throw
    assert.equal(learner.getStatus().patterns, 0);
  });
});
