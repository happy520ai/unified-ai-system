/**
 * Tests for P6-P1P2 DecisionTrace module.
 *
 * Coverage:
 *   - Constructor defaults and custom options
 *   - All public methods (record, getTaskDecisions, getGoalDecisions, search,
 *     getStats, getTimeline, getPatterns, getFailures, annotate, export,
 *     getStatus, clear, save, load)
 *   - Edge cases (empty state, boundaries, ring buffer, persistence)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

describe('DecisionTrace', () => {
  let DecisionTrace;

  before(async () => {
    const mod = await import('../src/decision-trace/index.js');
    DecisionTrace = mod.DecisionTrace;
  });

  // ── Constructor ────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const trace = new DecisionTrace();
    const status = trace.getStatus();
    assert.equal(status.entries, 0);
    assert.equal(status.maxEntries, 5000);
    assert.deepEqual(status.byOutcome, {});
    assert.deepEqual(status.recent, []);
  });

  it('should accept custom maxEntries', () => {
    const trace = new DecisionTrace({ maxEntries: 10 });
    const status = trace.getStatus();
    assert.equal(status.maxEntries, 10);
  });

  it('should clamp maxEntries to at least 1', () => {
    const trace = new DecisionTrace({ maxEntries: 0 });
    const status = trace.getStatus();
    assert.equal(status.maxEntries, 1);
  });

  // ── record() ───────────────────────────────────────────────────────────

  it('should record an entry and return a unique id', () => {
    const trace = new DecisionTrace();
    const id = trace.record({
      goalId: 'g1', taskId: 't1', workerType: 'coder',
      decision: 'tool_choice', action: { tool: 'edit' },
      reasoning: 'best fit', confidence: 80,
    });
    assert.ok(id.startsWith('dt-'));
    assert.equal(trace.getStatus().entries, 1);
  });

  it('should default decision to tool_choice for invalid values', () => {
    const trace = new DecisionTrace();
    const id = trace.record({ decision: 'bogus', action: {} });
    const entries = trace.getTaskDecisions(null);
    const found = entries.find(e => e.id === id);
    assert.equal(found.decision, 'tool_choice');
  });

  it('should default outcome to pending for invalid values', () => {
    const trace = new DecisionTrace();
    const id = trace.record({ outcome: 'invalid', action: {} });
    const timeline = trace.getTimeline();
    const found = timeline.find(e => e.id === id);
    assert.equal(found.outcome, 'pending');
  });

  it('should clamp confidence between 0 and 100', () => {
    const trace = new DecisionTrace();
    const id1 = trace.record({ confidence: 150, action: {} });
    const id2 = trace.record({ confidence: -20, action: {} });
    const timeline = trace.getTimeline();
    const e1 = timeline.find(e => e.id === id1);
    const e2 = timeline.find(e => e.id === id2);
    assert.equal(e1.confidence, 100);
    assert.equal(e2.confidence, 0);
  });

  it('should evict oldest entry when ring buffer is full', () => {
    const trace = new DecisionTrace({ maxEntries: 2 });
    const id1 = trace.record({ action: { n: 1 } });
    trace.record({ action: { n: 2 } });
    trace.record({ action: { n: 3 } }); // evicts id1
    assert.equal(trace.getStatus().entries, 2);
    const timeline = trace.getTimeline();
    assert.ok(!timeline.find(e => e.id === id1));
  });

  it('should deep-clone action, alternatives, context, and tags', () => {
    const trace = new DecisionTrace();
    const action = { tool: 'edit' };
    const alternatives = [{ tool: 'write' }];
    const context = { key: 'val' };
    const tags = ['urgent'];
    const id = trace.record({ action, alternatives, context, tags });

    action.tool = 'changed';
    alternatives[0].tool = 'changed';
    context.key = 'changed';
    tags[0] = 'changed';

    const entry = trace.getTimeline()[0];
    assert.equal(entry.action.tool, 'edit');
    assert.equal(entry.alternatives[0].tool, 'write');
    assert.equal(entry.context.key, 'val');
    assert.equal(entry.tags[0], 'urgent');
  });

  // ── getTaskDecisions() ─────────────────────────────────────────────────

  it('should return entries for a specific task sorted by timestamp', () => {
    const trace = new DecisionTrace();
    trace.record({ taskId: 't1', action: {} });
    trace.record({ taskId: 't2', action: {} });
    trace.record({ taskId: 't1', action: {} });
    const results = trace.getTaskDecisions('t1');
    assert.equal(results.length, 2);
    assert.ok(results[0].timestamp <= results[1].timestamp);
  });

  it('should return empty array for unknown taskId', () => {
    const trace = new DecisionTrace();
    assert.deepEqual(trace.getTaskDecisions('no-such'), []);
  });

  // ── getGoalDecisions() ─────────────────────────────────────────────────

  it('should return entries for a specific goal sorted by timestamp', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', action: {} });
    trace.record({ goalId: 'g1', action: {} });
    trace.record({ goalId: 'g2', action: {} });
    const results = trace.getGoalDecisions('g1');
    assert.equal(results.length, 2);
    assert.ok(results[0].timestamp <= results[1].timestamp);
  });

  // ── search() ───────────────────────────────────────────────────────────

  it('should search by workerType', () => {
    const trace = new DecisionTrace();
    trace.record({ workerType: 'coder', action: {} });
    trace.record({ workerType: 'reviewer', action: {} });
    const results = trace.search({ workerType: 'coder' });
    assert.equal(results.length, 1);
    assert.equal(results[0].workerType, 'coder');
  });

  it('should search by decision type and outcome', () => {
    const trace = new DecisionTrace();
    trace.record({ decision: 'tool_choice', outcome: 'success', action: {} });
    trace.record({ decision: 'retry_decision', outcome: 'failure', action: {} });
    trace.record({ decision: 'tool_choice', outcome: 'failure', action: {} });

    const r1 = trace.search({ decision: 'tool_choice' });
    assert.equal(r1.length, 2);

    const r2 = trace.search({ outcome: 'failure' });
    assert.equal(r2.length, 2);

    const r3 = trace.search({ decision: 'tool_choice', outcome: 'failure' });
    assert.equal(r3.length, 1);
  });

  it('should search by minConfidence', () => {
    const trace = new DecisionTrace();
    trace.record({ confidence: 20, action: {} });
    trace.record({ confidence: 80, action: {} });
    const results = trace.search({ minConfidence: 50 });
    assert.equal(results.length, 1);
    assert.equal(results[0].confidence, 80);
  });

  it('should search by tags (AND logic)', () => {
    const trace = new DecisionTrace();
    trace.record({ tags: ['a', 'b'], action: {} });
    trace.record({ tags: ['a'], action: {} });
    trace.record({ tags: ['b'], action: {} });
    const results = trace.search({ tags: ['a', 'b'] });
    assert.equal(results.length, 1);
  });

  it('should return results sorted by timestamp descending', () => {
    const trace = new DecisionTrace();
    trace.record({ action: {} });
    trace.record({ action: {} });
    trace.record({ action: {} });
    const results = trace.search();
    assert.ok(results[0].timestamp >= results[1].timestamp);
    assert.ok(results[1].timestamp >= results[2].timestamp);
  });

  // ── getStats() ─────────────────────────────────────────────────────────

  it('should return zeroed stats when empty', () => {
    const trace = new DecisionTrace();
    const stats = trace.getStats();
    assert.equal(stats.total, 0);
    assert.deepEqual(stats.byDecision, {});
    assert.equal(stats.avgConfidence, 0);
  });

  it('should compute aggregated stats correctly', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', decision: 'tool_choice', outcome: 'success', confidence: 60, workerType: 'coder', action: {} });
    trace.record({ goalId: 'g1', decision: 'tool_choice', outcome: 'failure', confidence: 40, workerType: 'coder', action: {} });
    trace.record({ goalId: 'g1', decision: 'retry_decision', outcome: 'success', confidence: 80, workerType: 'reviewer', action: {} });

    const stats = trace.getStats();
    assert.equal(stats.total, 3);
    assert.equal(stats.byDecision.tool_choice, 2);
    assert.equal(stats.byDecision.retry_decision, 1);
    assert.equal(stats.byOutcome.success, 2);
    assert.equal(stats.byOutcome.failure, 1);
    assert.equal(stats.byWorker.coder, 2);
    assert.equal(stats.byWorker.reviewer, 1);
    assert.equal(stats.avgConfidence, 60);
  });

  it('should scope stats to a specific goalId', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', action: {} });
    trace.record({ goalId: 'g2', action: {} });
    trace.record({ goalId: 'g2', action: {} });
    const stats = trace.getStats({ goalId: 'g2' });
    assert.equal(stats.total, 2);
  });

  // ── getTimeline() ──────────────────────────────────────────────────────

  it('should return timeline sorted ascending with limit', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', action: {} });
    trace.record({ goalId: 'g1', action: {} });
    trace.record({ goalId: 'g1', action: {} });
    const timeline = trace.getTimeline({ goalId: 'g1', limit: 2 });
    assert.equal(timeline.length, 2);
    assert.ok(timeline[0].timestamp <= timeline[1].timestamp);
  });

  it('should filter timeline by taskId', () => {
    const trace = new DecisionTrace();
    trace.record({ taskId: 't1', action: {} });
    trace.record({ taskId: 't2', action: {} });
    const timeline = trace.getTimeline({ taskId: 't2' });
    assert.equal(timeline.length, 1);
    assert.equal(timeline[0].taskId, 't2');
  });

  // ── getPatterns() ──────────────────────────────────────────────────────

  it('should return empty array when no patterns exist', () => {
    const trace = new DecisionTrace();
    assert.deepEqual(trace.getPatterns(), []);
  });

  it('should detect recurring bigram patterns within a goal', () => {
    const trace = new DecisionTrace();
    for (let i = 0; i < 3; i++) {
      trace.record({ goalId: 'g1', decision: 'tool_choice', action: {} });
      trace.record({ goalId: 'g1', decision: 'file_modification', action: {} });
    }
    const patterns = trace.getPatterns();
    assert.ok(patterns.length > 0);
    const bigram = patterns.find(p =>
      p.pattern.length === 2 &&
      p.pattern[0] === 'tool_choice' &&
      p.pattern[1] === 'file_modification'
    );
    assert.ok(bigram);
    assert.ok(bigram.count >= 2);
  });

  // ── getFailures() ──────────────────────────────────────────────────────

  it('should return only failure outcomes', () => {
    const trace = new DecisionTrace();
    trace.record({ outcome: 'success', action: {} });
    trace.record({ outcome: 'failure', workerType: 'coder', action: {} });
    trace.record({ outcome: 'failure', workerType: 'reviewer', action: {} });
    const failures = trace.getFailures();
    assert.equal(failures.length, 2);
    assert.ok(failures.every(f => f.outcome === 'failure'));
  });

  it('should filter failures by workerType', () => {
    const trace = new DecisionTrace();
    trace.record({ outcome: 'failure', workerType: 'coder', action: {} });
    trace.record({ outcome: 'failure', workerType: 'reviewer', action: {} });
    const failures = trace.getFailures({ workerType: 'coder' });
    assert.equal(failures.length, 1);
  });

  it('should limit failures returned', () => {
    const trace = new DecisionTrace();
    for (let i = 0; i < 10; i++) {
      trace.record({ outcome: 'failure', action: {} });
    }
    const failures = trace.getFailures({ limit: 3 });
    assert.equal(failures.length, 3);
  });

  // ── annotate() ─────────────────────────────────────────────────────────

  it('should add an annotation to an existing entry', () => {
    const trace = new DecisionTrace();
    const id = trace.record({ action: {} });
    const ok = trace.annotate(id, { note: 'should have used write', severity: 'warning' });
    assert.equal(ok, true);
    const entry = trace.getTimeline()[0];
    assert.equal(entry.annotations.length, 1);
    assert.equal(entry.annotations[0].note, 'should have used write');
    assert.equal(entry.annotations[0].severity, 'warning');
  });

  it('should return false when annotating non-existent entry', () => {
    const trace = new DecisionTrace();
    assert.equal(trace.annotate('no-such-id', { note: 'x' }), false);
  });

  it('should default severity to info for invalid values', () => {
    const trace = new DecisionTrace();
    const id = trace.record({ action: {} });
    trace.annotate(id, { note: 'test', severity: 'bogus' });
    const entry = trace.getTimeline()[0];
    assert.equal(entry.annotations[0].severity, 'info');
  });

  it('should reject annotation when at max capacity (50)', () => {
    const trace = new DecisionTrace();
    const id = trace.record({ action: {} });
    for (let i = 0; i < 50; i++) {
      trace.annotate(id, { note: `a${i}` });
    }
    const ok = trace.annotate(id, { note: 'overflow' });
    assert.equal(ok, false);
  });

  // ── export() ───────────────────────────────────────────────────────────

  it('should export in JSON format by default', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', action: {} });
    const result = trace.export();
    assert.equal(result.format, 'json');
    assert.equal(result.count, 1);
    assert.ok(Array.isArray(result.entries));
    assert.ok(typeof result.exportedAt === 'number');
  });

  it('should export in CSV format', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', action: {} });
    const result = trace.export({ format: 'csv' });
    assert.equal(result.format, 'csv');
    assert.equal(result.count, 1);
    assert.ok(typeof result.entries === 'string');
    assert.ok(result.entries.includes('id,goalId'));
  });

  it('should filter export by goalId', () => {
    const trace = new DecisionTrace();
    trace.record({ goalId: 'g1', action: {} });
    trace.record({ goalId: 'g2', action: {} });
    const result = trace.export({ goalId: 'g1' });
    assert.equal(result.count, 1);
  });

  // ── getStatus() ────────────────────────────────────────────────────────

  it('should return correct status summary', () => {
    const trace = new DecisionTrace({ maxEntries: 100 });
    trace.record({ outcome: 'success', action: {} });
    trace.record({ outcome: 'failure', action: {} });
    const status = trace.getStatus();
    assert.equal(status.entries, 2);
    assert.equal(status.maxEntries, 100);
    assert.equal(status.byOutcome.success, 1);
    assert.equal(status.byOutcome.failure, 1);
    assert.equal(status.recent.length, 2);
  });

  // ── clear() ────────────────────────────────────────────────────────────

  it('should remove all entries', () => {
    const trace = new DecisionTrace();
    trace.record({ action: {} });
    trace.record({ action: {} });
    trace.clear();
    assert.equal(trace.getStatus().entries, 0);
  });

  // ── save() / load() ───────────────────────────────────────────────────

  it('should persist and reload entries from disk', async () => {
    const filePath = join(tmpdir(), `dt-test-${Date.now()}.json`);
    try {
      const trace1 = new DecisionTrace({ persistencePath: filePath });
      trace1.record({ goalId: 'g1', action: { x: 1 } });
      trace1.record({ goalId: 'g2', action: { x: 2 } });
      await trace1.save();

      const trace2 = new DecisionTrace({ persistencePath: filePath });
      await trace2.load();
      assert.equal(trace2.getStatus().entries, 2);
    } finally {
      await rm(filePath, { force: true });
    }
  });

  it('should be a no-op for save/load when no persistencePath', async () => {
    const trace = new DecisionTrace();
    await trace.save(); // should not throw
    await trace.load(); // should not throw
    assert.equal(trace.getStatus().entries, 0);
  });

  it('should silently handle load when file does not exist', async () => {
    const filePath = join(tmpdir(), `dt-nofile-${Date.now()}.json`);
    const trace = new DecisionTrace({ persistencePath: filePath });
    await trace.load(); // should not throw
    assert.equal(trace.getStatus().entries, 0);
  });
});
