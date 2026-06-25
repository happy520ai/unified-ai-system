import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

// ═══════════════════════════════════════════════════════════════════════════════
//  4. CostAttribution
// ═══════════════════════════════════════════════════════════════════════════════

describe('CostAttribution', () => {
  let CostAttribution;
  const testDir = join(tmpdir(), `forge-test-ca-${Date.now()}`);
  const persistPath = join(testDir, 'costs.json');

  before(async () => {
    const mod = await import('../src/cost-attribution/index.js');
    CostAttribution = mod.CostAttribution;
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const ca = new CostAttribution();
    const status = ca.getStatus();
    assert.equal(status.totalCost, 0);
    assert.equal(status.totalTokens, 0);
    assert.equal(status.goals, 0);
    assert.equal(status.tasks, 0);
  });

  it('should accept custom maxRecords', () => {
    const ca = new CostAttribution({ maxRecords: 5 });
    for (let i = 0; i < 10; i++) {
      ca.record({
        goalId: 'g1', taskId: `t${i}`, workerType: 'coder',
        model: 'default', inputTokens: 100, outputTokens: 50, cost: 0.001,
      });
    }
    // Ring buffer should cap at 5
    const total = ca.getTotalCost();
    assert.equal(total.tasks, 5, 'Should only keep last 5 records');
  });

  // ── record() ─────────────────────────────────────────────────────────────

  it('should record usage and return an id', () => {
    const ca = new CostAttribution();
    const id = ca.record({
      goalId: 'g1', taskId: 't1', workerType: 'coder',
      model: 'mimo-v2.5-pro', inputTokens: 5000, outputTokens: 2000,
      cost: 0.0027, duration: 1200,
    });
    assert.ok(id.startsWith('cr_'));
  });

  it('should auto-calculate cost when not provided', () => {
    const ca = new CostAttribution();
    ca.record({
      goalId: 'g1', taskId: 't1', workerType: 'coder',
      model: 'mimo-v2.5-pro', inputTokens: 1_000_000, outputTokens: 1_000_000,
    });
    const report = ca.getGoalCost('g1');
    // mimo-v2.5-pro: (1M/1M)*0.30 + (1M/1M)*0.60 = 0.90
    assert.ok(Math.abs(report.totalCost - 0.9) < 0.01, `Expected ~0.9, got ${report.totalCost}`);
  });

  it('should evict oldest record when ring buffer is full', () => {
    const ca = new CostAttribution({ maxRecords: 3 });
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'w', model: 'default', inputTokens: 100, outputTokens: 50, cost: 0.01 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'w', model: 'default', inputTokens: 100, outputTokens: 50, cost: 0.02 });
    ca.record({ goalId: 'g1', taskId: 't3', workerType: 'w', model: 'default', inputTokens: 100, outputTokens: 50, cost: 0.03 });
    ca.record({ goalId: 'g1', taskId: 't4', workerType: 'w', model: 'default', inputTokens: 100, outputTokens: 50, cost: 0.04 });
    // t1 should be evicted
    const taskCost = ca.getTaskCost('t1');
    assert.equal(taskCost.cost, 0, 't1 should have been evicted');
  });

  // ── getGoalCost() ────────────────────────────────────────────────────────

  it('should aggregate costs for a goal', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 1000, outputTokens: 500, cost: 0.1, duration: 100 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'tester', model: 'm2', inputTokens: 2000, outputTokens: 800, cost: 0.2, duration: 200 });
    const report = ca.getGoalCost('g1');
    assert.equal(report.goalId, 'g1');
    assert.ok(Math.abs(report.totalCost - 0.3) < 0.001);
    assert.equal(report.totalTokens, 1000 + 500 + 2000 + 800);
    assert.equal(report.tasks, 2);
    assert.ok(report.byWorker.coder);
    assert.ok(report.byWorker.tester);
    assert.ok(report.byModel.m1);
    assert.ok(report.byModel.m2);
    assert.equal(report.duration, 300);
  });

  it('should return zero-cost report for non-existent goal', () => {
    const ca = new CostAttribution();
    const report = ca.getGoalCost('nonexistent');
    assert.equal(report.totalCost, 0);
    assert.equal(report.tasks, 0);
  });

  // ── getTaskCost() ────────────────────────────────────────────────────────

  it('should aggregate costs for a task', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 500, outputTokens: 200, cost: 0.05, duration: 100 });
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 300, outputTokens: 100, cost: 0.03, duration: 80 });
    const report = ca.getTaskCost('t1');
    assert.equal(report.taskId, 't1');
    assert.equal(report.inputTokens, 800);
    assert.equal(report.outputTokens, 300);
    assert.ok(Math.abs(report.cost - 0.08) < 0.001);
    assert.equal(report.duration, 180);
  });

  it('should return zero-cost report for non-existent task', () => {
    const ca = new CostAttribution();
    const report = ca.getTaskCost('nonexistent');
    assert.equal(report.cost, 0);
    assert.equal(report.inputTokens, 0);
    assert.equal(report.goalId, '');
  });

  // ── getTotalCost() ───────────────────────────────────────────────────────

  it('should return total cost across all records', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 100, outputTokens: 50, cost: 0.1 });
    ca.record({ goalId: 'g2', taskId: 't2', workerType: 'tester', model: 'm2', inputTokens: 200, outputTokens: 100, cost: 0.2 });
    const total = ca.getTotalCost();
    assert.ok(Math.abs(total.totalCost - 0.3) < 0.001);
    assert.equal(total.totalTokens, 100 + 50 + 200 + 100);
    assert.equal(total.goals, 2);
    assert.equal(total.tasks, 2);
    assert.ok(total.byWorker.coder);
    assert.ok(total.byWorker.tester);
  });

  // ── getCostByWorker() ────────────────────────────────────────────────────

  it('should return cost breakdown by worker type', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 100, outputTokens: 50, cost: 0.1 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'coder', model: 'm1', inputTokens: 200, outputTokens: 100, cost: 0.2 });
    ca.record({ goalId: 'g1', taskId: 't3', workerType: 'tester', model: 'm1', inputTokens: 150, outputTokens: 80, cost: 0.15 });
    const byWorker = ca.getCostByWorker();
    assert.equal(byWorker.coder.count, 2);
    assert.ok(Math.abs(byWorker.coder.cost - 0.3) < 0.001);
    assert.equal(byWorker.tester.count, 1);
    assert.equal(byWorker.coder.tokens, 100 + 50 + 200 + 100);
  });

  // ── getCostByModel() ─────────────────────────────────────────────────────

  it('should return cost breakdown by model', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'model-a', inputTokens: 100, outputTokens: 50, cost: 0.1 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'coder', model: 'model-b', inputTokens: 200, outputTokens: 100, cost: 0.2 });
    const byModel = ca.getCostByModel();
    assert.equal(byModel['model-a'].count, 1);
    assert.equal(byModel['model-b'].count, 1);
    assert.ok(Math.abs(byModel['model-a'].cost - 0.1) < 0.001);
  });

  // ── getCostTrend() ───────────────────────────────────────────────────────

  it('should return trend buckets with correct count', () => {
    const ca = new CostAttribution();
    const trend = ca.getCostTrend({ granularity: 'hour', periods: 12 });
    assert.equal(trend.length, 12);
    for (const bucket of trend) {
      assert.ok('period' in bucket);
      assert.ok('cost' in bucket);
      assert.ok('tokens' in bucket);
      assert.ok('count' in bucket);
    }
  });

  it('should include recent records in trend buckets', () => {
    const ca = new CostAttribution();
    const now = Date.now();
    // Place the record well within the last hourly bucket (1 hour ago)
    ca.record({
      goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1',
      inputTokens: 100, outputTokens: 50, cost: 0.5, timestamp: now - 1_800_000,
    });
    const trend = ca.getCostTrend({ granularity: 'hour', periods: 24 });
    const totalInBuckets = trend.reduce((sum, b) => sum + b.cost, 0);
    assert.ok(totalInBuckets > 0, 'Should have cost in at least one bucket');
  });

  it('should support day granularity', () => {
    const ca = new CostAttribution();
    const trend = ca.getCostTrend({ granularity: 'day', periods: 7 });
    assert.equal(trend.length, 7);
  });

  // ── getTopExpensive() ────────────────────────────────────────────────────

  it('should return top expensive goals sorted by cost', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.5 });
    ca.record({ goalId: 'g2', taskId: 't2', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 1.5 });
    ca.record({ goalId: 'g3', taskId: 't3', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.8 });
    const top = ca.getTopExpensive({ type: 'goal', limit: 2 });
    assert.equal(top.length, 2);
    assert.equal(top[0].id, 'g2');
    assert.ok(top[0].cost >= top[1].cost);
  });

  it('should return top expensive tasks', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.3 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.9 });
    const top = ca.getTopExpensive({ type: 'task', limit: 5 });
    assert.equal(top[0].id, 't2');
    assert.equal(top[0].type, 'task');
  });

  it('should respect the limit option', () => {
    const ca = new CostAttribution();
    for (let i = 0; i < 20; i++) {
      ca.record({ goalId: `g${i}`, taskId: `t${i}`, workerType: 'w', model: 'm', inputTokens: 10, outputTokens: 5, cost: i * 0.1 });
    }
    const top = ca.getTopExpensive({ limit: 5 });
    assert.equal(top.length, 5);
  });

  // ── getProjection() ──────────────────────────────────────────────────────

  it('should return zero projection when no records', () => {
    const ca = new CostAttribution();
    const proj = ca.getProjection();
    assert.equal(proj.hourlyRate, 0);
    assert.equal(proj.dailyRate, 0);
    assert.equal(proj.monthlyProjection, 0);
  });

  it('should project from a single record', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.5 });
    const proj = ca.getProjection();
    assert.ok(proj.hourlyRate > 0, 'Hourly rate should be > 0');
    assert.ok(proj.dailyRate > proj.hourlyRate, 'Daily should be > hourly');
    assert.ok(proj.monthlyProjection > proj.dailyRate, 'Monthly should be > daily');
  });

  it('should project from multiple records', () => {
    const ca = new CostAttribution();
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      ca.record({
        goalId: 'g1', taskId: `t${i}`, workerType: 'w', model: 'm',
        inputTokens: 100, outputTokens: 50, cost: 0.1,
        timestamp: now - (10 - i) * 3_600_000, // 1 hour apart
      });
    }
    const proj = ca.getProjection();
    assert.ok(proj.hourlyRate > 0);
    assert.ok(proj.dailyRate > 0);
    assert.ok(proj.monthlyProjection > 0);
  });

  // ── getStatus() ──────────────────────────────────────────────────────────

  it('should return dashboard status with all fields', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 100, outputTokens: 50, cost: 0.1 });
    const status = ca.getStatus();
    assert.ok('totalCost' in status);
    assert.ok('totalTokens' in status);
    assert.ok('goals' in status);
    assert.ok('tasks' in status);
    assert.ok('last24h' in status);
    assert.ok('trend' in status);
    assert.ok(Array.isArray(status.trend));
    assert.equal(status.goals, 1);
    assert.equal(status.tasks, 1);
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  it('should clear all records', () => {
    const ca = new CostAttribution();
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.1 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'w', model: 'm', inputTokens: 100, outputTokens: 50, cost: 0.2 });
    ca.clear();
    const total = ca.getTotalCost();
    assert.equal(total.totalCost, 0);
    assert.equal(total.goals, 0);
  });

  // ── save() / load() persistence ──────────────────────────────────────────

  it('should save and load records to/from file', async () => {
    const ca = new CostAttribution({ persistencePath: persistPath });
    ca.record({ goalId: 'g1', taskId: 't1', workerType: 'coder', model: 'm1', inputTokens: 500, outputTokens: 200, cost: 0.1 });
    ca.record({ goalId: 'g1', taskId: 't2', workerType: 'tester', model: 'm2', inputTokens: 300, outputTokens: 100, cost: 0.2 });

    await ca.save();

    const ca2 = new CostAttribution({ persistencePath: persistPath });
    await ca2.load();

    const report = ca2.getGoalCost('g1');
    assert.equal(report.tasks, 2);
    assert.ok(Math.abs(report.totalCost - 0.3) < 0.001);
  });

  it('should throw when saving without persistencePath', async () => {
    const ca = new CostAttribution();
    await assert.rejects(() => ca.save(), /persistencePath/i);
  });

  it('should throw when loading without persistencePath', async () => {
    const ca = new CostAttribution();
    await assert.rejects(() => ca.load(), /persistencePath/i);
  });

  it('should silently handle load when file does not exist', async () => {
    const ca = new CostAttribution({ persistencePath: join(testDir, 'nonexistent.json') });
    await ca.load(); // Should not throw for ENOENT
    const total = ca.getTotalCost();
    assert.equal(total.totalCost, 0);
  });

  // ── Custom pricing ───────────────────────────────────────────────────────

  it('should use custom pricing for cost calculation', () => {
    const ca = new CostAttribution({
      pricing: { 'my-model': { input: 2.00, output: 4.00 } },
    });
    ca.record({
      goalId: 'g1', taskId: 't1', workerType: 'coder',
      model: 'my-model', inputTokens: 1_000_000, outputTokens: 1_000_000,
    });
    const report = ca.getGoalCost('g1');
    // (1M/1M)*2.00 + (1M/1M)*4.00 = 6.00
    assert.ok(Math.abs(report.totalCost - 6.0) < 0.01, `Expected ~6.0, got ${report.totalCost}`);
  });
});
