import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, readFile, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── SelfLoopEngine Tests ────────────────────────────────────────────────────

describe('SelfLoopEngine — Decision enum', () => {

  it('should export frozen Decision with all 5 types', async () => {
    const { Decision } = await import('../src/self-loop/index.js');
    assert.equal(Decision.ACCEPT, 'ACCEPT');
    assert.equal(Decision.ADJUST_RETRY, 'ADJUST_RETRY');
    assert.equal(Decision.ROLLBACK_RETRY, 'ROLLBACK_RETRY');
    assert.equal(Decision.ESCALATE, 'ESCALATE');
    assert.equal(Decision.EXHAUSTED, 'EXHAUSTED');
    assert.ok(Object.isFrozen(Decision));
  });
});

describe('SelfLoopEngine — snapshotBefore & rollback', () => {
  let SelfLoopEngine;
  const tmpRoot = join(tmpdir(), `forge-selfloop-snap-${Date.now()}`);

  before(async () => {
    const mod = await import('../src/self-loop/index.js');
    SelfLoopEngine = mod.SelfLoopEngine;
    await mkdir(join(tmpRoot, 'src'), { recursive: true });
  });

  after(async () => {
    try { await rm(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should capture existing file contents', async () => {
    await writeFile(join(tmpRoot, 'src/a.js'), 'const a = 1;', 'utf-8');
    await writeFile(join(tmpRoot, 'src/b.js'), 'const b = 2;', 'utf-8');

    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: tmpRoot });
    const snap = await engine.snapshotBefore(tmpRoot, ['src/a.js', 'src/b.js']);

    assert.ok(snap.snapshotId, 'should have snapshotId');
    assert.equal(snap.files.size, 2);
    assert.equal(snap.files.get('src/a.js'), 'const a = 1;');
    assert.equal(snap.files.get('src/b.js'), 'const b = 2;');
  });

  it('should record null for files that do not exist', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: tmpRoot });
    const snap = await engine.snapshotBefore(tmpRoot, ['src/nonexistent.js']);

    assert.equal(snap.files.size, 1);
    assert.equal(snap.files.get('src/nonexistent.js'), null);
  });

  it('should rollback: restore modified file and delete new file', async () => {
    await writeFile(join(tmpRoot, 'src/orig.js'), 'original content', 'utf-8');
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: tmpRoot });
    const snap = await engine.snapshotBefore(tmpRoot, ['src/orig.js', 'src/brand-new.js']);

    // Simulate mutation: modify existing file and create new file
    await writeFile(join(tmpRoot, 'src/orig.js'), 'MUTATED content', 'utf-8');
    await writeFile(join(tmpRoot, 'src/brand-new.js'), 'I am new', 'utf-8');

    // Rollback
    const result = await engine.rollback(snap, tmpRoot);
    assert.equal(result.restored, 1, 'should restore 1 file');
    assert.equal(result.deleted, 1, 'should delete 1 file');
    assert.equal(result.errors.length, 0, 'should have no errors');

    // Verify file contents restored
    const restored = await readFile(join(tmpRoot, 'src/orig.js'), 'utf-8');
    assert.equal(restored, 'original content');

    // Verify new file deleted
    let newFileExists = true;
    try { await readFile(join(tmpRoot, 'src/brand-new.js')); } catch { newFileExists = false; }
    assert.equal(newFileExists, false, 'brand-new.js should be deleted');
  });

  it('should return empty errors when rollback targets already match', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: tmpRoot });
    const snap = await engine.snapshotBefore(tmpRoot, ['src/nonexistent2.js']);

    const result = await engine.rollback(snap, tmpRoot);
    assert.equal(result.errors.length, 0);
    assert.equal(result.restored, 0);
    assert.equal(result.deleted, 0);
  });
});

describe('SelfLoopEngine — verify', () => {
  let SelfLoopEngine;

  before(async () => {
    const mod = await import('../src/self-loop/index.js');
    SelfLoopEngine = mod.SelfLoopEngine;
  });

  it('should return passed:true when no verifier configured', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
    const result = await engine.verify('g1', 't1');
    assert.equal(result.passed, true);
    assert.equal(result.tier, 0);
    assert.equal(result.failures.length, 0);
  });

  it('should call verifier.verifyAfterMutation and return result', async () => {
    const mockVerifier = {
      verifyAfterMutation: async (goalId, taskId, opts) => ({
        overall: 'PASS',
        failures: [],
        summary: 'All checks passed',
      }),
    };
    const engine = new SelfLoopEngine({ verifier: mockVerifier, store: null, evolution: null, projectRoot: '/tmp' });
    const result = await engine.verify('g1', 't1', { filesModified: ['a.js'], loopCount: 0 });
    assert.equal(result.passed, true);
    assert.equal(result.failures.length, 0);
  });

  it('should detect FAIL and return passed:false', async () => {
    const mockVerifier = {
      verifyAfterMutation: async () => ({
        overall: 'FAIL',
        failures: [{ checkName: 'syntax_check', output: 'Unexpected token', tier: 1 }],
        summary: 'Syntax errors found',
      }),
    };
    const engine = new SelfLoopEngine({ verifier: mockVerifier, store: null, evolution: null, projectRoot: '/tmp' });
    const result = await engine.verify('g1', 't1');
    assert.equal(result.passed, false);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].checkName, 'syntax_check');
  });

  it('should escalate tier when loopCount >= 2', async () => {
    let capturedMaxTier = 0;
    const mockVerifier = {
      verifyAfterMutation: async (goalId, taskId, opts) => {
        capturedMaxTier = opts.maxTier;
        return { overall: 'PASS', failures: [], summary: '' };
      },
    };
    const engine = new SelfLoopEngine({
      verifier: mockVerifier, store: null, evolution: null, projectRoot: '/tmp',
      config: { defaultTier: 2 },
    });
    await engine.verify('g1', 't1', { loopCount: 3 });
    assert.equal(capturedMaxTier, 3, 'should escalate to tier 3 when loopCount >= 2');
  });

  it('should handle verifier exceptions gracefully', async () => {
    const mockVerifier = {
      verifyAfterMutation: async () => { throw new Error('verifier crashed'); },
    };
    const engine = new SelfLoopEngine({ verifier: mockVerifier, store: null, evolution: null, projectRoot: '/tmp' });
    const result = await engine.verify('g1', 't1');
    assert.equal(result.passed, true, 'should default to passed on verifier error');
    assert.ok(result.error, 'should include error message');
  });
});

describe('SelfLoopEngine — computeAdjustments', () => {
  let SelfLoopEngine;
  let engine;

  before(async () => {
    const mod = await import('../src/self-loop/index.js');
    SelfLoopEngine = mod.SelfLoopEngine;
    engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
  });

  it('should produce minimal hints at loopCount 0', () => {
    const adj = engine.computeAdjustments({
      taskType: 'implement',
      failures: [{ checkName: 'syntax_check', output: 'Unexpected token at line 5', tier: 1 }],
      loopCount: 0,
      previousStrategy: 'targeted_fix',
    });
    assert.ok(adj.promptHints.includes('Verification Failures'), 'should include failure header');
    assert.ok(adj.promptHints.includes('syntax_check'), 'should include check name');
    assert.equal(adj.workerType, null, 'should not escalate worker at loop 0');
  });

  it('should add STRICT RULES at loopCount 1', () => {
    const adj = engine.computeAdjustments({
      taskType: 'implement',
      failures: [{ checkName: 'test', output: 'expected 1 but got 2', tier: 2 }],
      loopCount: 1,
      previousStrategy: 'targeted_fix',
    });
    assert.ok(adj.promptHints.includes('STRICT RULES'), 'should include strict rules');
    assert.ok(adj.promptHints.includes('Double-check'), 'should have double-check hint');
  });

  it('should escalate to debugger at loopCount >= 2 with syntax errors', () => {
    const adj = engine.computeAdjustments({
      taskType: 'implement',
      failures: [{ checkName: 'syntax_check', output: 'syntax error near line 10', tier: 1 }],
      loopCount: 2,
      previousStrategy: 'targeted_fix',
    });
    assert.ok(adj.promptHints.includes('CRITICAL'), 'should include critical header');
    assert.equal(adj.workerType, 'debugger', 'should escalate to debugger for syntax errors at loop 2+');
  });

  it('should add test_failure hint when tests fail on non-test task', () => {
    const adj = engine.computeAdjustments({
      taskType: 'implement',
      failures: [{ checkName: 'unit_test', output: 'assertion failed: expected true', tier: 2 }],
      loopCount: 0,
      previousStrategy: 'targeted_fix',
    });
    assert.ok(adj.promptHints.includes('Tests are failing'), 'should include test failure hint');
  });

  it('should add lint hint for lint failures', () => {
    const adj = engine.computeAdjustments({
      taskType: 'implement',
      failures: [{ checkName: 'eslint', output: 'no-unused-vars', tier: 1 }],
      loopCount: 0,
      previousStrategy: 'targeted_fix',
    });
    assert.ok(adj.promptHints.includes('linting errors'), 'should include lint fix hint');
  });

  it('should detect missing_module from ENOENT output', () => {
    const adj = engine.computeAdjustments({
      taskType: 'implement',
      failures: [{ checkName: 'runtime', output: 'Cannot find module "./utils"', tier: 0 }],
      loopCount: 0,
      previousStrategy: 'targeted_fix',
    });
    assert.ok(adj.promptHints.includes('Missing module'), 'should include missing module hint');
  });
});

describe('SelfLoopEngine — handlePostExecution', () => {
  let SelfLoopEngine, Decision, StrategyEvolution;

  before(async () => {
    const mod1 = await import('../src/self-loop/index.js');
    const mod2 = await import('../src/self-loop/strategy-evolution.js');
    SelfLoopEngine = mod1.SelfLoopEngine;
    Decision = mod1.Decision;
    StrategyEvolution = mod2.StrategyEvolution;
  });

  it('should ACCEPT when result.success is false (let normal retry handle it)', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
    const decision = await engine.handlePostExecution('g1', { id: 't1', type: 'implement' }, { success: false });
    assert.equal(decision.action, Decision.ACCEPT);
    assert.ok(decision.reason.includes('worker level'));
  });

  it('should ACCEPT when verification passed', async () => {
    const evolution = new StrategyEvolution();
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution, projectRoot: '/tmp' });
    const decision = await engine.handlePostExecution('g1', { id: 't2', type: 'implement' }, { success: true }, {
      verifyResult: { passed: true, failures: [] },
    });
    assert.equal(decision.action, Decision.ACCEPT);
    assert.ok(decision.reason.includes('Verification passed'));
  });

  it('should ACCEPT when no verifyResult provided', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
    const decision = await engine.handlePostExecution('g1', { id: 't3', type: 'implement' }, { success: true });
    assert.equal(decision.action, Decision.ACCEPT);
  });

  it('should return ADJUST_RETRY on first verification failure', async () => {
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution: new StrategyEvolution(), projectRoot: '/tmp',
      config: { maxLoops: 4 },
    });
    const decision = await engine.handlePostExecution('g1', { id: 't4', type: 'implement' }, { success: true }, {
      verifyResult: { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] },
    });
    assert.equal(decision.action, Decision.ADJUST_RETRY);
    assert.equal(decision.loopCount, 1);
    assert.ok(decision.adjustments, 'should include adjustments');
  });

  it('should return ROLLBACK_RETRY at loopCount >= 2 with snapshot', async () => {
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution: new StrategyEvolution(), projectRoot: '/tmp',
      config: { maxLoops: 4 },
    });
    const task = { id: 't5', type: 'implement' };
    const verifyResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };
    const snapshot = { snapshotId: 'snap-test', files: new Map() };

    // Loop 0 → ADJUST_RETRY
    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    // Loop 1 → ADJUST_RETRY
    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    // Loop 2 → ROLLBACK_RETRY (with snapshot)
    const decision = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult, snapshot });

    assert.equal(decision.action, Decision.ROLLBACK_RETRY);
    assert.equal(decision.loopCount, 3);
  });

  it('should return EXHAUSTED when maxLoops reached', async () => {
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution: new StrategyEvolution(), projectRoot: '/tmp',
      config: { maxLoops: 2 },
    });
    const task = { id: 't6', type: 'implement' };
    const verifyResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    // Loop 0
    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    // Loop 1
    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    // Loop 2 — exhausted (maxLoops = 2)
    const decision = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });

    assert.equal(decision.action, Decision.EXHAUSTED);
    assert.ok(decision.reason.includes('exhausted'));
  });

  it('should escalate to debugger when adjustments suggest it at loop 2+', async () => {
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution: new StrategyEvolution(), projectRoot: '/tmp',
      config: { maxLoops: 5 },
    });
    const task = { id: 't7', type: 'implement' };
    const verifyResult = {
      passed: false,
      failures: [{ checkName: 'syntax_check', output: 'syntax error at line 3', tier: 1 }],
    };

    // Loop 0 → ADJUST_RETRY
    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    // Loop 1 → ADJUST_RETRY
    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    // Loop 2 → should ESCALATE (syntax error + loopCount >= 2)
    const decision = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });

    assert.equal(decision.action, Decision.ESCALATE);
    assert.equal(decision.strategy, 'debugger_escalation');
  });

  it('should record outcome in evolution on ACCEPT', async () => {
    const evolution = new StrategyEvolution();
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution, projectRoot: '/tmp' });

    await engine.handlePostExecution('g1', { id: 't8', type: 'test' }, { success: true }, {
      verifyResult: { passed: true, failures: [] },
    });

    const stats = evolution.getStats();
    assert.ok(stats.test, 'should have test task type in stats');
    assert.equal(stats.test.targeted_fix.success, 1, 'should record 1 success');
  });

  it('should record failure in evolution on EXHAUSTED', async () => {
    const evolution = new StrategyEvolution();
    const engine = new SelfLoopEngine({
      verifier: null, store: null, evolution, projectRoot: '/tmp',
      config: { maxLoops: 1 },
    });
    const task = { id: 't9', type: 'refactor' };
    const verifyResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });
    const decision = await engine.handlePostExecution('g1', task, { success: true }, { verifyResult });

    assert.equal(decision.action, Decision.EXHAUSTED);
    const stats = evolution.getStats();
    assert.ok(stats.refactor, 'should have refactor task type');
    // The strategy may have changed via selectStrategy, so check total failures across all strategies
    const totalFailures = Object.values(stats.refactor).reduce((sum, s) => sum + s.failure, 0);
    assert.equal(totalFailures, 1, 'should record 1 failure total for refactor');
  });

  it('should inject evolution insights into adjustments (adaptive prompt)', async () => {
    const evolution = new StrategyEvolution();
    // Manually trigger consistent failures for full_rewrite on implement
    for (let i = 0; i < 5; i++) {
      evolution.recordOutcome({ taskType: 'implement', strategy: 'full_rewrite', loopCount: 3, success: false });
    }
    evolution.evolve();

    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution, projectRoot: '/tmp' });
    const decision = await engine.handlePostExecution('g1', { id: 't10', type: 'implement' }, { success: true }, {
      verifyResult: { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] },
    });

    assert.equal(decision.action, Decision.ADJUST_RETRY);
    // Should have adjustments with prompt hints
    assert.ok(decision.adjustments, 'should have adjustments');
    assert.ok(decision.adjustments.promptHints.length > 0, 'should have prompt hints');
  });
});

describe('SelfLoopEngine — cleanup & getStatus', () => {
  let SelfLoopEngine, Decision;

  before(async () => {
    const mod = await import('../src/self-loop/index.js');
    SelfLoopEngine = mod.SelfLoopEngine;
    Decision = mod.Decision;
  });

  it('should cleanup loop state for a goal', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
    const verifyResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    await engine.handlePostExecution('g1', { id: 't1', type: 'implement' }, { success: true }, { verifyResult });
    await engine.handlePostExecution('g1', { id: 't2', type: 'implement' }, { success: true }, { verifyResult });

    let status = engine.getStatus('g1');
    assert.equal(status.length, 2);

    engine.cleanup('g1');
    status = engine.getStatus('g1');
    assert.equal(status.length, 0, 'should be empty after cleanup');
  });

  it('should only cleanup matching goalId', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
    const verifyResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    await engine.handlePostExecution('g1', { id: 't1', type: 'implement' }, { success: true }, { verifyResult });
    await engine.handlePostExecution('g2', { id: 't1', type: 'implement' }, { success: true }, { verifyResult });

    engine.cleanup('g1');
    assert.equal(engine.getStatus('g1').length, 0);
    assert.equal(engine.getStatus('g2').length, 1, 'g2 should still have state');
  });

  it('getStatus should return taskId, loopCount, strategy, and history', async () => {
    const engine = new SelfLoopEngine({ verifier: null, store: null, evolution: null, projectRoot: '/tmp' });
    const verifyResult = { passed: false, failures: [{ checkName: 'test', output: 'fail', tier: 2 }] };

    await engine.handlePostExecution('g1', { id: 't1', type: 'implement' }, { success: true }, { verifyResult });

    const status = engine.getStatus('g1');
    assert.equal(status.length, 1);
    assert.equal(status[0].taskId, 't1');
    assert.equal(status[0].loopCount, 1);
    assert.ok(status[0].strategy, 'should have strategy');
    assert.ok(Array.isArray(status[0].history), 'should have history array');
    assert.equal(status[0].history.length, 1);
  });
});
