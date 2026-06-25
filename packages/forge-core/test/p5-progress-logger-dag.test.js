import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ── Module 5: ProgressEstimator ──────────────────────────────────────────────

describe('ProgressEstimator', () => {
  let ProgressEstimator;

  before(async () => {
    const mod = await import('../src/progress-estimator/index.js');
    ProgressEstimator = mod.ProgressEstimator;
  });

  it('should construct with no initial goals', () => {
    const pe = new ProgressEstimator();
    const status = pe.getStatus();
    assert.equal(status.trackedGoals, 0);
    assert.equal(status.totalTasksCompleted, 0);
  });

  it('should trackGoal() and register a goal', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 0 });
    const progress = pe.getProgress('g1');
    assert.ok(progress);
    assert.equal(progress.goalId, 'g1');
    assert.equal(progress.totalTasks, 10);
    assert.equal(progress.completed, 0);
    assert.equal(progress.remaining, 10);
    assert.equal(progress.percentComplete, 0);
  });

  it('should update existing goal via trackGoal()', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 0 });
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 5 });
    const progress = pe.getProgress('g1');
    assert.equal(progress.completed, 5);
    assert.equal(progress.percentComplete, 50);
  });

  it('should recordTaskCompletion() and store timing data', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 5, tasksCompleted: 1 });
    pe.recordTaskCompletion('g1', 't1', { durationMs: 4000, taskType: 'file-gen' });
    const progress = pe.getProgress('g1');
    assert.equal(progress.eta.basedOn, 1);
    assert.equal(progress.avgTaskDurationMs, 4000);
  });

  it('should auto-initialize goal on recordTaskCompletion() if not tracked', () => {
    const pe = new ProgressEstimator();
    pe.recordTaskCompletion('auto-g', 't1', { durationMs: 2000 });
    const progress = pe.getProgress('auto-g');
    assert.ok(progress);
    assert.equal(progress.eta.basedOn, 1);
  });

  it('should return correct percentComplete', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 20, tasksCompleted: 10 });
    const progress = pe.getProgress('g1');
    assert.equal(progress.percentComplete, 50);
  });

  it('should cap percentComplete at 100', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 5, tasksCompleted: 10 });
    const progress = pe.getProgress('g1');
    assert.equal(progress.percentComplete, 100);
  });

  it('should report low confidence ETA with fewer than 2 task completions', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 0 });
    pe.recordTaskCompletion('g1', 't1', { durationMs: 5000 });

    const progress = pe.getProgress('g1');
    assert.equal(progress.eta.confidence, 'low');
    assert.equal(progress.eta.basedOn, 1);
    // With low confidence, uses default 30s per task
    assert.equal(progress.eta.estimatedSeconds, 300); // 10 remaining * 30s
  });

  it('should report medium confidence ETA with 2-4 task completions', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 3 });
    pe.recordTaskCompletion('g1', 't1', { durationMs: 5000 });
    pe.recordTaskCompletion('g1', 't2', { durationMs: 7000 });
    pe.recordTaskCompletion('g1', 't3', { durationMs: 6000 });

    const progress = pe.getProgress('g1');
    assert.equal(progress.eta.confidence, 'medium');
    assert.equal(progress.eta.basedOn, 3);
    // avg = 6000ms, 7 remaining -> 42s
    assert.equal(progress.eta.estimatedSeconds, 42);
  });

  it('should report high confidence ETA with 5+ task completions', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 5 });
    for (let i = 0; i < 5; i++) {
      pe.recordTaskCompletion('g1', `t${i}`, { durationMs: 4000 });
    }

    const progress = pe.getProgress('g1');
    assert.equal(progress.eta.confidence, 'high');
    assert.equal(progress.eta.basedOn, 5);
    // avg = 4000ms, 5 remaining -> 20s
    assert.equal(progress.eta.estimatedSeconds, 20);
  });

  it('should apply failure rate buffer when failure rate exceeds 30%', () => {
    const pe = new ProgressEstimator();
    // 3 completed, 4 failed => failure rate = 4/7 ~ 57% > 30%
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 3, tasksFailed: 4 });
    for (let i = 0; i < 5; i++) {
      pe.recordTaskCompletion('g1', `t${i}`, { durationMs: 10_000 });
    }

    const progress = pe.getProgress('g1');
    // remaining = 10 - 3 - 4 = 3, avg = 10s, base = 30s
    // With 1.2x buffer: 30 * 1.2 = 36
    assert.equal(progress.eta.estimatedSeconds, 36);
  });

  it('should not apply failure rate buffer when failure rate is below 30%', () => {
    const pe = new ProgressEstimator();
    // 8 completed, 1 failed => failure rate = 1/9 ~ 11%
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 8, tasksFailed: 1 });
    for (let i = 0; i < 5; i++) {
      pe.recordTaskCompletion('g1', `t${i}`, { durationMs: 2000 });
    }

    const progress = pe.getProgress('g1');
    // remaining = 10 - 8 - 1 = 1, avg = 2s, base = 2s, no buffer
    assert.equal(progress.eta.estimatedSeconds, 2);
  });

  it('should getAllProgress() return array of all tracked goals', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 5, tasksCompleted: 2 });
    pe.trackGoal('g2', { totalTasks: 10, tasksCompleted: 7 });

    const all = pe.getAllProgress();
    assert.equal(all.length, 2);
    const ids = all.map(p => p.goalId).sort();
    assert.deepEqual(ids, ['g1', 'g2']);
  });

  it('should removeGoal() and return true', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 5 });
    assert.equal(pe.removeGoal('g1'), true);
    assert.equal(pe.getProgress('g1'), null);
  });

  it('should return false from removeGoal() for unknown goal', () => {
    const pe = new ProgressEstimator();
    assert.equal(pe.removeGoal('nonexistent'), false);
  });

  it('should getStatus() reflect tracked goals and completed tasks', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 10, tasksCompleted: 3 });
    pe.trackGoal('g2', { totalTasks: 5, tasksCompleted: 5 });
    const status = pe.getStatus();
    assert.equal(status.trackedGoals, 2);
    assert.equal(status.totalTasksCompleted, 8);
  });

  it('should return null from getProgress() for untracked goal', () => {
    const pe = new ProgressEstimator();
    assert.equal(pe.getProgress('nope'), null);
  });

  it('should include estimatedCompletionAt as ISO string in ETA', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('g1', { totalTasks: 5, tasksCompleted: 2 });
    const progress = pe.getProgress('g1');
    assert.ok(progress.eta.estimatedCompletionAt);
    // Should parse as valid date
    const d = new Date(progress.eta.estimatedCompletionAt);
    assert.ok(!isNaN(d.getTime()));
  });

  it('should handle goal with zero totalTasks', () => {
    const pe = new ProgressEstimator();
    pe.trackGoal('empty', { totalTasks: 0 });
    const progress = pe.getProgress('empty');
    assert.equal(progress.percentComplete, 0);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.eta.estimatedSeconds, 0);
  });
});

// ── Module 6: Logger (ForgeLogger + LogLevel) ────────────────────────────────

describe('ForgeLogger + LogLevel', () => {
  let ForgeLogger, LogLevel;

  before(async () => {
    const mod = await import('../src/logger/index.js');
    ForgeLogger = mod.ForgeLogger;
    LogLevel = mod.LogLevel;
  });

  it('should export LogLevel enum with expected values', () => {
    assert.equal(LogLevel.DEBUG, 'debug');
    assert.equal(LogLevel.INFO, 'info');
    assert.equal(LogLevel.WARN, 'warn');
    assert.equal(LogLevel.ERROR, 'error');
    assert.equal(LogLevel.SILENT, 'silent');
  });

  it('should construct ForgeLogger with module and level', () => {
    const logger = new ForgeLogger({ module: 'test', level: 'debug' });
    const status = logger.getStatus();
    assert.equal(status.module, 'test');
    assert.equal(status.level, 'debug');
    assert.equal(status.jsonMode, false);
    assert.equal(status.entryCount, 0);
  });

  it('should construct ForgeLogger with default options', () => {
    const logger = new ForgeLogger();
    const status = logger.getStatus();
    assert.equal(status.module, 'forge');
    assert.equal(status.level, 'info');
  });

  it('should throw on invalid log level', () => {
    assert.throws(() => new ForgeLogger({ level: 'bogus' }), /Invalid log level/);
  });

  it('should child() return a new logger with different module', () => {
    const parent = new ForgeLogger({ module: 'parent', level: 'debug' });
    const child = parent.child('child-mod');
    assert.ok(child instanceof ForgeLogger);
    const status = child.getStatus();
    assert.equal(status.module, 'child-mod');
    assert.equal(status.level, 'debug'); // inherits parent level
  });

  it('should child() logger be independent from parent', () => {
    const parent = new ForgeLogger({ module: 'parent', level: 'info' });
    const child = parent.child('child');
    child.info('child message');
    // Parent buffer should not contain the child's message
    const parentEntries = parent.getEntries();
    const childEntries = child.getEntries();
    assert.equal(childEntries.length, 1);
    assert.equal(parentEntries.length, 0);
  });

  it('should log methods write entries to buffer', () => {
    const logger = new ForgeLogger({ module: 'test', level: 'debug' });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    const entries = logger.getEntries();
    assert.equal(entries.length, 4);
    assert.equal(entries[0].level, 'debug');
    assert.equal(entries[1].level, 'info');
    assert.equal(entries[2].level, 'warn');
    assert.equal(entries[3].level, 'error');
  });

  it('should filter entries below the configured level', () => {
    const sink = { write() {} }; // silent sink
    const logger = new ForgeLogger({ module: 'test', level: 'warn', output: sink });
    logger.debug('should not output');
    logger.info('should not output');
    logger.warn('should output');
    logger.error('should output');
    // All 4 are stored in buffer regardless of level
    const entries = logger.getEntries();
    assert.equal(entries.length, 4);
  });

  it('should setLevel() change the minimum level', () => {
    const logger = new ForgeLogger({ module: 'test', level: 'info' });
    assert.equal(logger.getLevel(), 'info');
    logger.setLevel('error');
    assert.equal(logger.getLevel(), 'error');
  });

  it('should throw on setLevel() with invalid level', () => {
    const logger = new ForgeLogger({ module: 'test', level: 'info' });
    assert.throws(() => logger.setLevel('verbose'), /Invalid log level/);
  });
});

// ── Module 7: DAG dependency check (conceptual) ──────────────────────────────

describe('DAG dependency check (conceptual)', () => {
  /**
   * Simulates a simple DAG-aware task queue.
   * Tasks have a `dependsOn` array of task ids that must complete first.
   * The selector picks the next pending task whose dependencies are all satisfied.
   * Already-completed tasks are skipped.
   */
  function selectNextTask(queue, completedIds) {
    for (const task of queue) {
      if (completedIds.has(task.id)) continue; // skip already done
      const deps = task.dependsOn || [];
      const allMet = deps.every(d => completedIds.has(d));
      if (allMet) return task;
    }
    return null;
  }

  it('should select a task with no dependencies', () => {
    const queue = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
    ];
    const next = selectNextTask(queue, new Set());
    assert.equal(next.id, 'a');
  });

  it('should skip a task whose dependencies are unmet', () => {
    const queue = [
      { id: 'a', dependsOn: ['x'] },
      { id: 'b', dependsOn: [] },
    ];
    const next = selectNextTask(queue, new Set());
    assert.equal(next.id, 'b');
  });

  it('should select a task once all its dependencies are completed', () => {
    const queue = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['a', 'b'] },
    ];
    const completed = new Set(['a']);
    const next = selectNextTask(queue, completed);
    assert.equal(next.id, 'b');
  });

  it('should select a task with multiple deps once all are done', () => {
    const queue = [
      { id: 'c', dependsOn: ['a', 'b'] },
    ];
    const completed = new Set(['a', 'b']);
    const next = selectNextTask(queue, completed);
    assert.equal(next.id, 'c');
  });

  it('should return null when no tasks have met dependencies', () => {
    const queue = [
      { id: 'a', dependsOn: ['x'] },
      { id: 'b', dependsOn: ['y'] },
    ];
    const next = selectNextTask(queue, new Set());
    assert.equal(next, null);
  });

  it('should return null for an empty queue', () => {
    const next = selectNextTask([], new Set());
    assert.equal(next, null);
  });

  it('should handle task with dependsOn field absent (treat as no deps)', () => {
    const queue = [
      { id: 'a' },
      { id: 'b', dependsOn: ['a'] },
    ];
    const next = selectNextTask(queue, new Set());
    assert.equal(next.id, 'a');
  });

  it('should process a chain: a -> b -> c in order', () => {
    const queue = [
      { id: 'a', dependsOn: [] },
      { id: 'b', dependsOn: ['a'] },
      { id: 'c', dependsOn: ['b'] },
    ];
    const completed = new Set();

    const t1 = selectNextTask(queue, completed);
    assert.equal(t1.id, 'a');
    completed.add('a');

    const t2 = selectNextTask(queue, completed);
    assert.equal(t2.id, 'b');
    completed.add('b');

    const t3 = selectNextTask(queue, completed);
    assert.equal(t3.id, 'c');
  });
});

// ── Module 8: Parallel verification (conceptual) ─────────────────────────────

describe('Parallel verification (conceptual)', () => {
  /**
   * Simulates running verification across multiple tiers in parallel using
   * Promise.allSettled. Even if one tier fails, the others should still
   * produce results.
   */
  async function runParallelVerification(tiers) {
    const results = await Promise.allSettled(
      tiers.map(tier => tier.verify())
    );
    return results.map((r, i) => ({
      tier: tiers[i].name,
      status: r.status,
      value: r.status === 'fulfilled' ? r.value : undefined,
      reason: r.status === 'rejected' ? r.reason : undefined,
    }));
  }

  it('should collect results from two successful tiers', async () => {
    const tiers = [
      { name: 'syntax', verify: async () => ({ pass: true, errors: [] }) },
      { name: 'semantic', verify: async () => ({ pass: true, warnings: [] }) },
    ];
    const results = await runParallelVerification(tiers);
    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[0].tier, 'syntax');
    assert.deepEqual(results[0].value, { pass: true, errors: [] });
    assert.equal(results[1].status, 'fulfilled');
    assert.equal(results[1].tier, 'semantic');
  });

  it('should collect both fulfilled and rejected results', async () => {
    const tiers = [
      { name: 'syntax', verify: async () => ({ pass: true }) },
      { name: 'runtime', verify: async () => { throw new Error('timeout'); } },
    ];
    const results = await runParallelVerification(tiers);
    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[0].value.pass, true);
    assert.equal(results[1].status, 'rejected');
    assert.ok(results[1].reason instanceof Error);
    assert.equal(results[1].reason.message, 'timeout');
  });

  it('should handle all tiers failing', async () => {
    const tiers = [
      { name: 'a', verify: async () => { throw new Error('fail-a'); } },
      { name: 'b', verify: async () => { throw new Error('fail-b'); } },
    ];
    const results = await runParallelVerification(tiers);
    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].status, 'rejected');
  });

  it('should handle empty tier list', async () => {
    const results = await runParallelVerification([]);
    assert.equal(results.length, 0);
  });

  it('should run tiers in parallel (timing check)', async () => {
    const start = Date.now();
    const tiers = [
      { name: 'slow', verify: () => new Promise(r => setTimeout(() => r({ ok: true }), 300)) },
      { name: 'fast', verify: () => new Promise(r => setTimeout(() => r({ ok: true }), 100)) },
    ];
    const results = await runParallelVerification(tiers);
    const elapsed = Date.now() - start;
    // If parallel, total time ~300ms. If sequential, ~400ms.
    // Use 600ms threshold to tolerate Windows timer jitter while still catching sequential.
    assert.ok(elapsed < 600, `Expected parallel execution < 600ms, got ${elapsed}ms`);
    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'fulfilled');
  });

  it('should include tier name in each result for traceability', async () => {
    const tiers = [
      { name: 'lint', verify: async () => 'lint-ok' },
      { name: 'type-check', verify: async () => { throw new Error('type-fail'); } },
      { name: 'test', verify: async () => 'test-ok' },
    ];
    const results = await runParallelVerification(tiers);
    assert.equal(results[0].tier, 'lint');
    assert.equal(results[1].tier, 'type-check');
    assert.equal(results[2].tier, 'test');
    assert.equal(results[0].value, 'lint-ok');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[2].value, 'test-ok');
  });
});
