import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ── StrategyEvolution Tests ─────────────────────────────────────────────────

describe('StrategyEvolution — recordOutcome & getStats', () => {
  let StrategyEvolution;

  before(async () => {
    const mod = await import('../src/self-loop/strategy-evolution.js');
    StrategyEvolution = mod.StrategyEvolution;
  });

  it('should track success/failure counts per (taskType, strategy)', () => {
    const evo = new StrategyEvolution();
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true, loopCount: 1 });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true, loopCount: 2 });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: false, loopCount: 3 });

    const stats = evo.getStats();
    assert.ok(stats.implement);
    assert.equal(stats.implement.targeted_fix.success, 2);
    assert.equal(stats.implement.targeted_fix.failure, 1);
    assert.equal(stats.implement.targeted_fix.total, 3);
  });

  it('should compute avgLoops as running average', () => {
    const evo = new StrategyEvolution();
    evo.recordOutcome({ taskType: 'test', strategy: 'test_first', success: true, loopCount: 1 });
    evo.recordOutcome({ taskType: 'test', strategy: 'test_first', success: true, loopCount: 3 });

    const stats = evo.getStats();
    assert.equal(stats.test.test_first.avgLoops, '2.0');
  });

  it('should handle multiple task types independently', () => {
    const evo = new StrategyEvolution();
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });
    evo.recordOutcome({ taskType: 'test', strategy: 'test_first', success: false });
    evo.recordOutcome({ taskType: 'debug', strategy: 'debugger', success: true });

    const stats = evo.getStats();
    assert.ok(stats.implement);
    assert.ok(stats.test);
    assert.ok(stats.debug);
  });

  it('should format successRate correctly', () => {
    const evo = new StrategyEvolution();
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: false });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: false });

    const stats = evo.getStats();
    assert.equal(stats.implement.targeted_fix.successRate, '0.50');
  });
});

describe('StrategyEvolution — selectStrategy', () => {
  let StrategyEvolution;

  before(async () => {
    const mod = await import('../src/self-loop/strategy-evolution.js');
    StrategyEvolution = mod.StrategyEvolution;
  });

  it('should return a different strategy than current', () => {
    const evo = new StrategyEvolution({ explorationRate: 0 });
    const selected = evo.selectStrategy('implement', 'targeted_fix');
    assert.notEqual(selected, 'targeted_fix', 'should not return the current strategy');
    assert.ok(StrategyEvolution.STRATEGIES.includes(selected));
  });

  it('should prefer strategies with higher success rate', () => {
    const evo = new StrategyEvolution({ explorationRate: 0 });
    for (let i = 0; i < 10; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'full_rewrite', success: true, loopCount: 1 });
    }
    for (let i = 0; i < 5; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'rollback_retry', success: false, loopCount: 4 });
    }

    const selected = evo.selectStrategy('implement', 'targeted_fix');
    assert.equal(selected, 'full_rewrite', 'should pick the best performing strategy');
  });

  it('should explore less-tried strategies with high exploration rate', () => {
    const evo = new StrategyEvolution({ explorationRate: 1.0 });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });

    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(evo.selectStrategy('implement', 'targeted_fix'));
    }
    assert.ok(results.size >= 2, `should explore multiple strategies, got: ${[...results].join(', ')}`);
  });

  it('should return a valid strategy for unknown current strategy', () => {
    const evo = new StrategyEvolution();
    const selected = evo.selectStrategy('implement', 'nonexistent_strategy');
    assert.ok(StrategyEvolution.STRATEGIES.includes(selected));
  });
});

describe('StrategyEvolution — evolve & getInsights', () => {
  let StrategyEvolution;

  before(async () => {
    const mod = await import('../src/self-loop/strategy-evolution.js');
    StrategyEvolution = mod.StrategyEvolution;
  });

  it('should return minimal summary when history < 5', () => {
    const evo = new StrategyEvolution();
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: false });

    const { summary } = evo.evolve();
    assert.equal(summary.totalOutcomes, 2);
    assert.equal(summary.overallSuccessRate, 0);
  });

  it('should calculate overall success rate with sufficient history', () => {
    const evo = new StrategyEvolution();
    for (let i = 0; i < 10; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: i < 7, loopCount: 1 });
    }
    const { summary } = evo.evolve();
    assert.equal(summary.totalOutcomes, 10);
    assert.equal(summary.overallSuccessRate, 0.7);
  });

  it('should find best strategy per task type', () => {
    const evo = new StrategyEvolution();
    for (let i = 0; i < 10; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: i < 8, loopCount: 1 });
    }
    for (let i = 0; i < 10; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'full_rewrite', success: i < 5, loopCount: 2 });
    }
    const { summary } = evo.evolve();
    assert.ok(summary.bestStrategies.implement, 'should have best strategy for implement');
    assert.equal(summary.bestStrategies.implement.strategy, 'targeted_fix');
  });

  it('should detect consistent failure patterns and generate insights', () => {
    const evo = new StrategyEvolution();
    for (let i = 0; i < 10; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'full_rewrite', success: false, loopCount: 4 });
    }
    for (let i = 0; i < 5; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true, loopCount: 1 });
    }

    const { summary } = evo.evolve();
    const failurePatterns = summary.patterns.filter(p => p.type === 'consistent_failure');
    assert.ok(failurePatterns.length > 0, 'should detect consistent failure pattern');

    const insights = evo.getInsights('implement');
    assert.ok(insights.length > 0, 'should have insights for implement tasks');
    assert.ok(insights[0].includes('AVOID'), 'insight should mention AVOID');
    assert.ok(insights[0].includes('full_rewrite'), 'insight should mention failing strategy');
  });

  it('should return empty insights for task types with no patterns', () => {
    const evo = new StrategyEvolution();
    const insights = evo.getInsights('nonexistent_type');
    assert.deepEqual(insights, []);
  });
});

describe('StrategyEvolution — reset', () => {
  let StrategyEvolution;

  before(async () => {
    const mod = await import('../src/self-loop/strategy-evolution.js');
    StrategyEvolution = mod.StrategyEvolution;
  });

  it('should clear all data on reset', () => {
    const evo = new StrategyEvolution();
    evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true });
    evo.recordOutcome({ taskType: 'test', strategy: 'test_first', success: false });

    evo.reset();
    const stats = evo.getStats();
    assert.deepEqual(stats, {}, 'stats should be empty after reset');
    assert.deepEqual(evo.getInsights('implement'), []);
  });
});

describe('StrategyEvolution — ring buffer', () => {
  let StrategyEvolution;

  before(async () => {
    const mod = await import('../src/self-loop/strategy-evolution.js');
    StrategyEvolution = mod.StrategyEvolution;
  });

  it('should cap history at maxHistory size', () => {
    const evo = new StrategyEvolution({ maxHistory: 10 });
    for (let i = 0; i < 20; i++) {
      evo.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true, loopCount: i });
    }
    const { summary } = evo.evolve();
    assert.equal(summary.totalOutcomes, 10, 'history should be capped at maxHistory');
  });
});

// ── Integration: SelfLoopEngine + StrategyEvolution ─────────────────────────

describe('SelfLoopEngine + StrategyEvolution integration', () => {
  let SelfLoopEngine, Decision, StrategyEvolution;

  before(async () => {
    const mod1 = await import('../src/self-loop/index.js');
    const mod2 = await import('../src/self-loop/strategy-evolution.js');
    SelfLoopEngine = mod1.SelfLoopEngine;
    Decision = mod1.Decision;
    StrategyEvolution = mod2.StrategyEvolution;
  });

  it('should flow through multiple loop iterations with evolution tracking', async () => {
    const evolution = new StrategyEvolution();
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution, projectRoot: '/tmp',
      config: { maxLoops: 3 },
    });
    const task = { id: 't-int', type: 'implement' };
    const failResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    // Loop 0: ADJUST_RETRY
    const d1 = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult: failResult });
    assert.equal(d1.action, Decision.ADJUST_RETRY);
    assert.equal(d1.loopCount, 1);

    // Loop 1: ADJUST_RETRY
    const d2 = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult: failResult });
    assert.equal(d2.action, Decision.ADJUST_RETRY);
    assert.equal(d2.loopCount, 2);

    // Loop 2: ROLLBACK_RETRY (with snapshot)
    const snapshot = { snapshotId: 'snap-int', files: new Map() };
    const d3 = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult: failResult, snapshot });
    assert.equal(d3.action, Decision.ROLLBACK_RETRY);
    assert.equal(d3.loopCount, 3);

    // Loop 3: EXHAUSTED (maxLoops = 3)
    const d4 = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult: failResult });
    assert.equal(d4.action, Decision.EXHAUSTED);

    // Evolution should have recorded outcomes
    const stats = evolution.getStats();
    assert.ok(stats.implement, 'should have implement stats');
    const totalOutcomes = Object.values(stats.implement).reduce((sum, s) => sum + s.total, 0);
    assert.ok(totalOutcomes >= 1, 'should have at least 1 outcome recorded');
  });

  it('should succeed after initial failure (recovery flow)', async () => {
    const evolution = new StrategyEvolution();
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution, projectRoot: '/tmp',
      config: { maxLoops: 4 },
    });
    const task = { id: 't-recover', type: 'test' };
    const failResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    // Loop 0: ADJUST_RETRY
    const d1 = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult: failResult });
    assert.equal(d1.action, Decision.ADJUST_RETRY);

    // Loop 1: Verification passes → ACCEPT
    const d2 = await engine.handlePostExecution('g1', task, { success: true }, {
      verifyResult: { passed: true, failures: [] },
    });
    assert.equal(d2.action, Decision.ACCEPT);

    // Evolution should record success
    const stats = evolution.getStats();
    assert.ok(stats.test, 'should have test stats');
    const totalSuccess = Object.values(stats.test).reduce((sum, s) => sum + s.success, 0);
    assert.equal(totalSuccess, 1, 'should record 1 success');
  });
});
