/**
 * P11 ExecutionAnalytics — test suite.
 *
 * Run with:
 *   node --test packages/forge-core/test/p11-execution-analytics.test.js
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { ExecutionAnalytics } from '../src/execution-analytics/index.js';

describe('ExecutionAnalytics', () => {
  let analytics;

  before(() => {
    analytics = new ExecutionAnalytics({ maxRecords: 500, trendWindow: 20 });
  });

  // ── Construction ──────────────────────────────────────────────────────

  it('constructs with default options', () => {
    const a = new ExecutionAnalytics();
    const status = a.getStatus();
    assert.equal(status.recordCount, 0);
    assert.equal(status.taskEventCount, 0);
    assert.equal(status.goalEventCount, 0);
    assert.equal(status.goalsTracked, 0);
    assert.equal(status.avgSuccessRate, 0);
    assert.equal(status.lastActivity, null);
  });

  it('constructs with custom options', () => {
    const a = new ExecutionAnalytics({ maxRecords: 100, trendWindow: 10 });
    const s = a.getStatus();
    assert.equal(s.recordCount, 0);
  });

  // ── recordTask ────────────────────────────────────────────────────────

  it('records a task event and updates status', () => {
    analytics.recordTask({
      goalId: 'g1', taskId: 't1', workerType: 'coder',
      status: 'completed', durationMs: 5000, tokensUsed: 1200,
    });
    const s = analytics.getStatus();
    assert.ok(s.recordCount >= 1);
    assert.ok(s.taskEventCount >= 1);
    assert.ok(s.goalsTracked >= 1);
    assert.ok(s.lastActivity > 0);
  });

  it('records multiple tasks for the same goal', () => {
    analytics.recordTask({
      goalId: 'g1', taskId: 't2', workerType: 'tester',
      status: 'completed', durationMs: 3000, tokensUsed: 800,
    });
    analytics.recordTask({
      goalId: 'g1', taskId: 't3', workerType: 'reviewer',
      status: 'failed', durationMs: 2000, tokensUsed: 500,
    });
    const s = analytics.getStatus();
    assert.ok(s.taskEventCount >= 3);
  });

  // ── recordGoal ────────────────────────────────────────────────────────

  it('records a goal event', () => {
    analytics.recordGoal({
      goalId: 'g1', status: 'completed', taskCount: 3,
      executionTimeMs: 10000, totalTokens: 2500, totalCost: 0.05,
    });
    const s = analytics.getStatus();
    assert.ok(s.goalEventCount >= 1);
  });

  // ── getTimeline ───────────────────────────────────────────────────────

  it('returns timeline events sorted by timestamp', () => {
    const timeline = analytics.getTimeline('g1');
    assert.ok(timeline.length >= 3, 'timeline should have at least 3 entries');
    for (let i = 1; i < timeline.length; i++) {
      assert.ok(timeline[i].timestamp >= timeline[i - 1].timestamp);
    }
  });

  it('returns empty timeline for unknown goal', () => {
    const timeline = analytics.getTimeline('nonexistent');
    assert.equal(timeline.length, 0);
  });

  // ── Timeline parallel detection ───────────────────────────────────────

  it('detects parallel task execution via overlapping time ranges', () => {
    const parAnalytics = new ExecutionAnalytics();
    // Task A starts at T=0
    parAnalytics.recordTask({
      goalId: 'pg', taskId: 'pa', workerType: 'coder',
      status: 'started', durationMs: 5000,
    });
    // Task B starts at T=1000 (before A ends) — overlap
    parAnalytics.recordTask({
      goalId: 'pg', taskId: 'pb', workerType: 'tester',
      status: 'started', durationMs: 3000,
    });

    const tl = parAnalytics.getTimeline('pg');
    const parallelEntries = tl.filter(e => e.parallel);
    assert.ok(parallelEntries.length >= 2, 'overlapping tasks should be marked parallel');
  });

  // ── detectBottlenecks ─────────────────────────────────────────────────

  it('returns empty array when no completed events exist', () => {
    const empty = new ExecutionAnalytics();
    assert.deepEqual(empty.detectBottlenecks(), []);
  });

  it('detects slow worker bottleneck', () => {
    const bn = new ExecutionAnalytics();
    // 3 fast coder tasks
    for (let i = 0; i < 5; i++) {
      bn.recordTask({
        goalId: 'g', taskId: `fast-${i}`, workerType: 'coder',
        status: 'completed', durationMs: 1000,
      });
    }
    // 5 slow reviewer tasks
    for (let i = 0; i < 5; i++) {
      bn.recordTask({
        goalId: 'g', taskId: `slow-${i}`, workerType: 'reviewer',
        status: 'completed', durationMs: 10000,
      });
    }
    const bottlenecks = bn.detectBottlenecks({ minOccurrences: 3 });
    const slow = bottlenecks.find(b => b.type === 'slow_worker' && b.target === 'reviewer');
    assert.ok(slow, 'should detect reviewer as slow worker');
    assert.ok(slow.metric.ratio > 1.5);
  });

  it('detects high failure rate bottleneck', () => {
    const bn = new ExecutionAnalytics();
    for (let i = 0; i < 3; i++) {
      bn.recordTask({
        goalId: 'g', taskId: `ok-${i}`, workerType: 'coder',
        status: 'completed', durationMs: 1000,
      });
    }
    for (let i = 0; i < 5; i++) {
      bn.recordTask({
        goalId: 'g', taskId: `fail-${i}`, workerType: 'tester',
        status: 'failed', durationMs: 500,
      });
    }
    for (let i = 0; i < 2; i++) {
      bn.recordTask({
        goalId: 'g', taskId: `pass-${i}`, workerType: 'tester',
        status: 'completed', durationMs: 500,
      });
    }
    const bottlenecks = bn.detectBottlenecks({ minOccurrences: 3 });
    const failBn = bottlenecks.find(b => b.type === 'high_failure' && b.target === 'tester');
    assert.ok(failBn, 'should detect tester high failure rate');
    assert.ok(failBn.metric.failureRate > 0.2);
  });

  it('detects high retry bottleneck', () => {
    const bn = new ExecutionAnalytics();
    for (let i = 0; i < 4; i++) {
      bn.recordTask({
        goalId: 'g', taskId: `retry-${i}`, workerType: 'coder',
        status: 'completed', durationMs: 1000, retryCount: 3,
      });
    }
    const bottlenecks = bn.detectBottlenecks({ minOccurrences: 3 });
    const retryBn = bottlenecks.find(b => b.type === 'high_retry');
    assert.ok(retryBn, 'should detect high retry');
    assert.ok(retryBn.metric.avgRetries > 1);
  });

  // ── getTrends ─────────────────────────────────────────────────────────

  it('returns trend data with linear regression fields', () => {
    const trends = analytics.getTrends();
    assert.ok('duration' in trends);
    assert.ok('successRate' in trends);
    assert.ok('costPerGoal' in trends);
    assert.ok('tokensPerTask' in trends);
    // Each section should have trend, slope, rSquared, avg, sampleCount
    for (const key of ['duration', 'successRate', 'costPerGoal', 'tokensPerTask']) {
      assert.ok(typeof trends[key].trend === 'string');
      assert.ok(typeof trends[key].slope === 'number');
      assert.ok(typeof trends[key].rSquared === 'number');
      assert.ok(typeof trends[key].sampleCount === 'number');
    }
  });

  it('trend direction is one of improving, degrading, stable', () => {
    const trends = analytics.getTrends();
    const valid = ['improving', 'degrading', 'stable'];
    assert.ok(valid.includes(trends.duration.trend));
    assert.ok(valid.includes(trends.successRate.trend));
  });

  // ── comparePeriods ────────────────────────────────────────────────────

  it('compares two time periods and returns a winner', () => {
    const now = Date.now();
    const cpAnalytics = new ExecutionAnalytics();
    // Period A: 3 tasks
    for (let i = 0; i < 3; i++) {
      cpAnalytics.recordTask({
        goalId: 'g', taskId: `a-${i}`, workerType: 'coder',
        status: 'completed', durationMs: 2000, tokensUsed: 500, cost: 0.01,
      });
    }
    // Period B: 3 faster tasks
    for (let i = 0; i < 3; i++) {
      cpAnalytics.recordTask({
        goalId: 'g', taskId: `b-${i}`, workerType: 'coder',
        status: 'completed', durationMs: 1000, tokensUsed: 400, cost: 0.005,
      });
    }
    const allEvents = cpAnalytics.getTimeline('g');
    const midTs = allEvents.length > 0
      ? allEvents[Math.floor(allEvents.length / 2)].timestamp
      : now;
    const result = cpAnalytics.comparePeriods(
      { start: now - 60000, end: midTs },
      { start: midTs, end: now + 60000 },
    );
    assert.ok('duration' in result);
    assert.ok('successRate' in result);
    assert.ok('cost' in result);
    assert.ok('throughput' in result);
    assert.ok(['A', 'B', 'equal'].includes(result.winner));
  });

  // ── getWorkerPerformance ──────────────────────────────────────────────

  it('returns per-worker performance map', () => {
    const perf = analytics.getWorkerPerformance();
    assert.ok(perf instanceof Map);
    // We recorded coder, tester, reviewer events earlier
    assert.ok(perf.has('coder') || perf.has('tester') || perf.has('reviewer'));
  });

  // ── generateReport ────────────────────────────────────────────────────

  it('generates a comprehensive report', () => {
    const report = analytics.generateReport();
    assert.ok('summary' in report);
    assert.ok('metrics' in report);
    assert.ok('bottlenecks' in report);
    assert.ok('trends' in report);
    assert.ok('recommendations' in report);
    assert.ok(Array.isArray(report.recommendations));
    assert.ok(report.recommendations.length >= 1);
  });

  // ── ring buffer enforcement ───────────────────────────────────────────

  it('enforces maxRecords ring buffer', () => {
    const tiny = new ExecutionAnalytics({ maxRecords: 5 });
    for (let i = 0; i < 20; i++) {
      tiny.recordTask({
        goalId: 'g', taskId: `r-${i}`, workerType: 'coder',
        status: 'completed', durationMs: 100,
      });
    }
    assert.ok(tiny.getStatus().taskEventCount <= 5);
  });
});
