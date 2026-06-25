import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let MetricsCollector;
before(async () => {
  const mod = await import('../src/metrics/index.js');
  MetricsCollector = mod.MetricsCollector;
});

describe('MetricsCollector', () => {
  it('should export MetricsCollector class', () => {
    assert.ok(MetricsCollector);
    assert.strictEqual(typeof MetricsCollector, 'function');
  });

  it('should create an instance with default options', () => {
    const mc = new MetricsCollector();
    assert.ok(mc);
    assert.strictEqual(typeof mc.recordTaskStart, 'function');
    assert.strictEqual(typeof mc.recordTaskCompleted, 'function');
    assert.strictEqual(typeof mc.recordTaskFailed, 'function');
    assert.strictEqual(typeof mc.getMetrics, 'function');
    assert.strictEqual(typeof mc.getSummary, 'function');
  });

  it('should track task completions and compute stats', () => {
    const mc = new MetricsCollector();
    mc.recordTaskStart({ taskId: 't1', workerType: 'implement', enqueuedAt: Date.now() - 500 });
    mc.recordTaskCompleted({ taskId: 't1', goalId: 'g1', workerType: 'implement', durationMs: 1000 });
    mc.recordTaskStart({ taskId: 't2', workerType: 'implement', enqueuedAt: Date.now() - 200 });
    mc.recordTaskCompleted({ taskId: 't2', goalId: 'g1', workerType: 'implement', durationMs: 2000 });
    mc.recordTaskStart({ taskId: 't3', workerType: 'test' });
    mc.recordTaskFailed({ taskId: 't3', goalId: 'g1', workerType: 'test', durationMs: 500, error: 'timeout' });

    const m = mc.getMetrics();
    assert.strictEqual(m.tasks.total, 3);
    assert.strictEqual(m.tasks.completed, 2);
    assert.strictEqual(m.tasks.failed, 1);
    assert.ok(m.tasks.successRate > 0.6 && m.tasks.successRate < 0.7); // 2/3
    assert.strictEqual(m.tasks.avgDurationMs, 1500); // (1000+2000)/2
  });

  it('should compute percentiles correctly', () => {
    const mc = new MetricsCollector();
    const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    durations.forEach((d, i) => {
      mc.recordTaskStart({ taskId: `p${i}`, workerType: 'coder' });
      mc.recordTaskCompleted({ taskId: `p${i}`, goalId: 'g1', durationMs: d });
    });

    const m = mc.getMetrics();
    assert.strictEqual(m.tasks.p50DurationMs, 500);
    assert.ok(m.tasks.p95DurationMs >= 900);
    assert.strictEqual(m.tasks.minDurationMs, 100);
    assert.strictEqual(m.tasks.maxDurationMs, 1000);
  });

  it('should track worker type breakdowns', () => {
    const mc = new MetricsCollector();
    mc.recordTaskCompleted({ taskId: 'a', goalId: 'g1', workerType: 'coder', durationMs: 100 });
    mc.recordTaskCompleted({ taskId: 'b', goalId: 'g1', workerType: 'coder', durationMs: 200 });
    mc.recordTaskCompleted({ taskId: 'c', goalId: 'g1', workerType: 'tester', durationMs: 300 });
    mc.recordTaskFailed({ taskId: 'd', goalId: 'g1', workerType: 'tester', durationMs: 50, error: 'fail' });

    const m = mc.getMetrics();
    assert.ok(m.workerTypes.coder);
    assert.strictEqual(m.workerTypes.coder.count, 2);
    assert.strictEqual(m.workerTypes.coder.completed, 2);
    assert.strictEqual(m.workerTypes.coder.avgDurationMs, 150);
    assert.ok(m.workerTypes.tester);
    assert.strictEqual(m.workerTypes.tester.count, 2);
    assert.strictEqual(m.workerTypes.tester.completed, 1);
    assert.strictEqual(m.workerTypes.tester.failed, 1);
  });

  it('should track queue wait times', () => {
    const mc = new MetricsCollector();
    const now = Date.now();
    mc.recordTaskStart({ taskId: 'q1', workerType: 'coder', enqueuedAt: now - 1000 });
    mc.recordTaskCompleted({ taskId: 'q1', goalId: 'g1', durationMs: 500 });
    mc.recordTaskStart({ taskId: 'q2', workerType: 'coder', enqueuedAt: now - 2000 });
    mc.recordTaskCompleted({ taskId: 'q2', goalId: 'g1', durationMs: 300 });

    const m = mc.getMetrics();
    assert.ok(m.queueWait.samples >= 2);
    assert.ok(m.queueWait.avgMs > 0);
  });

  it('should track goal completions', () => {
    const mc = new MetricsCollector();
    mc.recordGoalCompleted({ goalId: 'g1', status: 'completed', completedTasks: 5, failedTasks: 1, totalTasks: 6 });
    mc.recordGoalCompleted({ goalId: 'g2', status: 'completed', completedTasks: 3, failedTasks: 0, totalTasks: 3 });

    const m = mc.getMetrics();
    assert.strictEqual(m.goals.total, 2);
    assert.strictEqual(m.goals.completed, 2);
    assert.strictEqual(m.goals.avgTasksPerGoal, 5); // (6+3)/2 rounded
  });

  it('should track verification events', () => {
    const mc = new MetricsCollector();
    mc.recordVerification({ taskId: 'v1', event: 'started' });
    mc.recordVerification({ taskId: 'v1', event: 'passed', durationMs: 200 });
    mc.recordVerification({ taskId: 'v2', event: 'started' });
    mc.recordVerification({ taskId: 'v2', event: 'failed', durationMs: 150, failureCount: 3 });

    const m = mc.getMetrics();
    assert.strictEqual(m.verifications.total, 4);
    assert.strictEqual(m.verifications.passed, 1);
    assert.strictEqual(m.verifications.failed, 1);
    assert.strictEqual(m.verifications.passRate, 0.5); // 1 passed out of 2 terminal events
    assert.strictEqual(m.verifications.avgDurationMs, 175); // (200+150)/2
  });

  it('should compute throughput metrics', () => {
    const mc = new MetricsCollector();
    // Record 5 tasks in the last minute
    for (let i = 0; i < 5; i++) {
      mc.recordTaskCompleted({ taskId: `th${i}`, goalId: 'g1', durationMs: 100 });
    }

    const m = mc.getMetrics();
    assert.strictEqual(m.throughput.perMinute, 5);
    assert.ok(m.throughput.perMinuteRate > 0);
  });

  it('should return time series data', () => {
    const mc = new MetricsCollector();
    mc.recordTaskCompleted({ taskId: 'ts1', goalId: 'g1', workerType: 'coder', durationMs: 100 });
    mc.recordTaskFailed({ taskId: 'ts2', goalId: 'g1', workerType: 'tester', durationMs: 50, error: 'x' });

    const ts = mc.getTimeSeries();
    assert.strictEqual(ts.length, 2);
    assert.ok(ts[0].timestamp > 0);
    assert.strictEqual(ts[0].status, 'completed');
    assert.strictEqual(ts[1].status, 'failed');
  });

  it('should return a lightweight summary', () => {
    const mc = new MetricsCollector();
    mc.recordTaskCompleted({ taskId: 's1', goalId: 'g1', durationMs: 500 });
    mc.recordTaskCompleted({ taskId: 's2', goalId: 'g1', durationMs: 1000 });

    const s = mc.getSummary();
    assert.strictEqual(s.totalTasks, 2);
    assert.strictEqual(s.successRate, 1);
    assert.strictEqual(s.avgDurationMs, 750);
    assert.ok(s.p95DurationMs != null);
  });

  it('should reset all collected data', () => {
    const mc = new MetricsCollector();
    mc.recordTaskCompleted({ taskId: 'r1', goalId: 'g1', durationMs: 100 });
    mc.recordGoalCompleted({ goalId: 'g1', status: 'completed', completedTasks: 1, failedTasks: 0, totalTasks: 1 });
    mc.recordVerification({ taskId: 'r1', event: 'passed' });

    mc.reset();
    const m = mc.getMetrics();
    assert.strictEqual(m.tasks.total, 0);
    assert.strictEqual(m.goals.total, 0);
    assert.strictEqual(m.verifications.total, 0);
  });

  it('should trim records when exceeding maxRecords', () => {
    const mc = new MetricsCollector({ maxRecords: 10 });
    for (let i = 0; i < 20; i++) {
      mc.recordTaskCompleted({ taskId: `trim${i}`, goalId: 'g1', durationMs: i * 10 });
    }
    const m = mc.getMetrics();
    assert.ok(m.tasks.total <= 10);
  });

  it('should handle duration calculation from start timer when not provided', () => {
    const mc = new MetricsCollector();
    mc.recordTaskStart({ taskId: 'auto1', workerType: 'coder' });
    // Wait a tiny bit then record completion without explicit duration
    mc.recordTaskCompleted({ taskId: 'auto1', goalId: 'g1' });

    const m = mc.getMetrics();
    assert.strictEqual(m.tasks.total, 1);
    assert.ok(m.tasks.avgDurationMs != null);
    assert.ok(m.tasks.avgDurationMs >= 0);
  });
});
