import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SelfLoopEngine, Decision } from '../src/self-loop/index.js';
import { SelfHealingEngine } from '../src/self-healing/index.js';

function verificationInput(passed = true) {
  return {
    verification: { status: passed ? 'passed' : 'failed', attemptId: 'verify-1', sourceFilesHash: 'a'.repeat(64), checkResult: {
      version: 1, adapter: 'node-test', contractHash: 'sha256:' + 'b'.repeat(64), runnerHash: 'sha256:' + 'c'.repeat(64),
      snapshotHash: 'a'.repeat(64), verdict: passed ? 'passed' : 'failed', reason: passed ? 'checks-passed' : 'checks-failed',
      counts: { tests: 1, passed: Number(passed), failed: Number(!passed), cancelled: 0, skipped: 0, todo: 0, suites: 0, topLevel: 1 },
      executedPassed: Number(passed), requiredChecks: [{ file: 'test/value.test.mjs', name: 'value is two', status: passed ? 'passed' : 'failed' }],
    } },
    counters: { iterations: 1, modelCalls: 2, reservedTokens: 200, repairAttempts: 0 },
    limits: { maxIterations: 4, maxModelCalls: 5, maxTotalTokens: 1000, maxRepairAttempts: 2 },
  };
}

describe('SelfLoop governed decisions use the original task owner', () => {
  const forbidden = () => assert.fail('Legacy execution, verification or rollback must not run');
  const engine = new SelfLoopEngine({ verifier: { verifyAfterMutation: forbidden }, store: { logEvent: forbidden },
    evolution: { recordOutcome: forbidden, getInsights: forbidden, selectStrategy: forbidden } });
  engine.verify = forbidden; engine.rollback = forbidden; engine.snapshotBefore = forbidden; engine.computeAdjustments = forbidden;

  it('accepts complete named evidence without mutating counters or opening a second loop', () => {
    const input = verificationInput(), before = structuredClone(input);
    assert.deepEqual(engine.decideGovernedVerification(input), { action: Decision.ACCEPT, reason: 'VERIFIED' });
    assert.deepEqual(input, before); assert.deepEqual(engine.getStatus('goal'), []);
    input.counters = { iterations: 4, modelCalls: 5, reservedTokens: 1000, repairAttempts: 2 };
    assert.equal(engine.decideGovernedVerification(input).action, Decision.ACCEPT, 'Finishing at the original limit needs no retry');
  });

  it('returns repair advice while the service alone increments the retained attempt', () => {
    const input = verificationInput(false), before = structuredClone(input);
    assert.equal(engine.decideGovernedVerification(input).action, Decision.ADJUST_RETRY);
    assert.equal(engine.decideGovernedVerification(input).action, Decision.ADJUST_RETRY);
    assert.deepEqual(input, before); assert.deepEqual(engine.getStatus('goal'), []);
    input.counters.repairAttempts = 2;
    assert.deepEqual(engine.decideGovernedVerification(input), { action: Decision.EXHAUSTED, reason: 'REPAIR_BUDGET_EXHAUSTED' });
  });

  for (const [counter, limit, reason] of [['iterations', 'maxIterations', 'ITERATION'], ['modelCalls', 'maxModelCalls', 'MODEL'],
    ['reservedTokens', 'maxTotalTokens', 'TOKEN'], ['repairAttempts', 'maxRepairAttempts', 'REPAIR']]) {
    it(`stops a known failure at the original ${counter} limit`, () => {
      const input = verificationInput(false); input.counters[counter] = input.limits[limit];
      assert.deepEqual(engine.decideGovernedVerification(input), { action: Decision.EXHAUSTED, reason: reason + '_BUDGET_EXHAUSTED' });
    });
  }

  for (const [name, change] of [
    ['missing result', input => { delete input.verification.checkResult; }],
    ['unknown outcome', input => { input.verification.status = 'unknown'; }],
    ['mismatched snapshot', input => { input.verification.checkResult.snapshotHash = 'd'.repeat(64); }],
    ['contradictory verdict', input => { input.verification.checkResult.verdict = 'failed'; }],
    ['empty required checks', input => { input.verification.checkResult.requiredChecks = []; }],
    ['skipped required check', input => { input.verification.checkResult.requiredChecks[0].status = 'skipped'; }],
    ['zero executed checks', input => { input.verification.checkResult.executedPassed = 0; }],
    ['inconsistent counts', input => { input.verification.checkResult.counts.tests = 2; }],
    ['duplicate named checks', input => { const check = input.verification.checkResult; check.counts.tests = 2;
      check.counts.passed = 2; check.executedPassed = 2; check.requiredChecks.push({ ...check.requiredChecks[0] }); }],
    ['incomplete report', input => { input.verification.checkResult.reason = 'incomplete-report'; }],
  ]) {
    it(`does not accept or repair ${name}`, () => {
      const input = verificationInput(); change(input);
      assert.equal(engine.decideGovernedVerification(input).action, Decision.ESCALATE);
    });
  }

  it('rejects accessors without invoking them, and stops aborted verified work', () => {
    const input = verificationInput(); let reads = 0;
    Object.defineProperty(input, 'signal', { enumerable: true, get() { reads++; throw Error('Getter must not run'); } });
    assert.equal(engine.decideGovernedVerification(input).action, Decision.ESCALATE); assert.equal(reads, 0);
    const controller = new AbortController(); controller.abort();
    assert.deepEqual(engine.decideGovernedVerification({ ...verificationInput(), signal: controller.signal }), { action: Decision.ESCALATE, reason: 'ABORTED' });
  });

  it('accepts data-only null-prototype oracle facts delivered by the Tool Proxy', () => {
    const input = verificationInput();
    input.verification.checkResult = Object.assign(Object.create(null), input.verification.checkResult);
    assert.equal(engine.decideGovernedVerification({ ...input, signal: undefined }).action, Decision.ACCEPT);
  });
});

function recoveryFixture() {
  const engine = new SelfHealingEngine(), events = [], controller = new AbortController();
  const resource = { close: async () => { events.push('close'); } };
  const diagnosis = { code: 'WORKSPACE_NOT_ATTACHED', taskId: 'task-original', bindingHash: 'sha256:' + 'd'.repeat(64),
    attempt: 1, maxAttempts: 2, pendingEffect: false };
  const input = { diagnosis, signal: controller.signal, deadlineAt: Date.now() + 1000,
    authorize: async context => { events.push(context.phase); return true; },
    recover: async () => { events.push('recover'); return resource; },
    verify: async recovered => { assert.equal(recovered, resource); events.push('verify');
      return { healthy: true, taskId: diagnosis.taskId, bindingHash: diagnosis.bindingHash, sourceFilesHash: 'e'.repeat(64) }; },
  };
  return { engine, events, resource, input, controller };
}

describe('SelfHealing original-workspace recovery capabilities', () => {
  it('authorizes every action, independently verifies and returns the actual resource without starting legacy healing', async () => {
    const f = recoveryFixture();
    f.engine.registerModule('queue', () => ({ status: 'critical' }), [{ condition: 'critical', action: 'clear_state',
      handler: () => assert.fail('Queue state must not be cleared') }]);
    const result = await f.engine.recoverGovernedWorkspace(f.input);
    assert.equal(result.resource, f.resource);
    assert.deepEqual(result.receipt, { version: 1, code: 'WORKSPACE_NOT_ATTACHED', taskId: 'task-original', bindingHash: 'sha256:' + 'd'.repeat(64),
      attempt: 1, status: 'recovered', sourceFilesHash: 'e'.repeat(64) });
    assert.ok(Object.isFrozen(result.receipt));
    assert.deepEqual(f.events, ['before_recover', 'recover', 'after_recover', 'before_verify', 'verify', 'after_verify']);
    assert.equal(f.engine.getStatus().running, false); assert.equal(f.engine.getStats().totalChecks, 0);
    assert.equal(f.engine.getStats().totalHeals, 1); assert.equal(f.engine.getStats().successRate, 1);
  });

  for (const phase of ['before_recover', 'after_recover', 'before_verify', 'after_verify']) {
    it(`stops on authorization denial at ${phase}`, async () => {
      const f = recoveryFixture();
      f.input.authorize = async context => { f.events.push(context.phase); return context.phase !== phase; };
      await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), { code: 'FORGE_GOVERNED_RECOVERY_UNAUTHORIZED' });
      assert.equal(f.events.filter(event => event === 'recover').length, phase === 'before_recover' ? 0 : 1);
      assert.equal(f.events.filter(event => event === 'verify').length, phase === 'after_verify' ? 1 : 0);
      assert.equal(f.events.filter(event => event === 'close').length, phase === 'before_recover' ? 0 : 1);
      assert.equal(f.engine.getStats().successRate, 0);
    });
  }

  it('rejects unknown effects, unsupported diagnoses and exhausted attempts before authorization or recovery', async () => {
    for (const changed of [{ pendingEffect: true }, { code: 'PROVIDER_TIMEOUT' }, { attempt: 3 }, { attempt: 0 }]) {
      const f = recoveryFixture(); Object.assign(f.input.diagnosis, changed);
      await assert.rejects(f.engine.recoverGovernedWorkspace(f.input)); assert.deepEqual(f.events, []);
      assert.equal(f.engine.getStats().totalHeals, 0);
    }
  });

  it('never counts handler return as recovery success when independent verification fails', async () => {
    const f = recoveryFixture(), verify = f.input.verify;
    f.input.verify = async resource => ({ ...await verify(resource), healthy: false });
    await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), { code: 'FORGE_GOVERNED_RECOVERY_VERIFY_FAILED' });
    assert.equal(f.events.filter(event => event === 'recover').length, 1); assert.equal(f.events.at(-1), 'close');
    assert.equal(f.engine.getStats().successRate, 0); assert.equal(f.engine.getHistory()[0].success, false);
  });

  it('requires the independent proof to match the original task and binding', async () => {
    for (const changed of [{ taskId: 'another-task' }, { bindingHash: 'sha256:' + 'f'.repeat(64) }, { sourceFilesHash: 'invalid' }]) {
      const f = recoveryFixture(), verify = f.input.verify;
      f.input.verify = async resource => ({ ...await verify(resource), ...changed });
      await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), { code: 'FORGE_GOVERNED_RECOVERY_VERIFY_FAILED' });
      assert.equal(f.events.at(-1), 'close'); assert.equal(f.engine.getStats().successRate, 0);
    }
  });

  it('preserves the first recovery error when post-action authorization also fails and never retries', async () => {
    const f = recoveryFixture(), original = Object.assign(Error('Original fixture failure'), { code: 'ORIGINAL_RECOVERY_FAILURE' });
    f.input.recover = async () => { f.events.push('recover'); throw original; };
    f.input.authorize = async context => { f.events.push(context.phase); if (context.phase === 'after_recover') throw Error('Later admission failure'); return true; };
    await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), error => error === original);
    assert.deepEqual(f.events, ['before_recover', 'recover', 'after_recover']);
    assert.equal(f.engine.getHistory()[0].code, 'ORIGINAL_RECOVERY_FAILURE');
  });

  it('closes on verifier error while preserving the original error and separate cleanup failure', async () => {
    const f = recoveryFixture(), original = Object.assign(Error('Verification failed'), { code: 'ORIGINAL_VERIFY_FAILURE' });
    const cleanup = Error('Cleanup failed'); f.resource.close = async () => { f.events.push('close'); throw cleanup; };
    f.input.verify = async () => { f.events.push('verify'); throw original; };
    await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), error => error === original);
    assert.equal(original.cleanupError, cleanup); assert.notEqual(original.cause, original);
    assert.equal(f.events.filter(event => event === 'close').length, 1); assert.equal(f.engine.getStats().successRate, 0);
  });

  it('freezes the original diagnosis and function capabilities before awaiting admission', async () => {
    const f = recoveryFixture(), original = { ...f.input.diagnosis };
    f.input.authorize = async context => {
      assert.deepEqual(context.diagnosis, original); assert.ok(Object.isFrozen(context.diagnosis));
      f.input.diagnosis.bindingHash = 'sha256:' + 'f'.repeat(64);
      f.input.verify = () => assert.fail('Changed callback must not run'); return true;
    };
    f.input.verify = async (_resource, context) => ({ healthy: true, taskId: context.diagnosis.taskId,
      bindingHash: context.diagnosis.bindingHash, sourceFilesHash: 'e'.repeat(64) });
    const result = await f.engine.recoverGovernedWorkspace(f.input); assert.equal(result.receipt.bindingHash, original.bindingHash);
  });

  it('rejects concurrent recovery for the same task while the first action settles', { timeout: 2000 }, async context => {
    const f = recoveryFixture(); let release, entered;
    const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
    context.after(() => { release(); f.controller.abort(); });
    f.input.recover = async () => { f.events.push('recover'); entered(); await gate; return f.resource; };
    const first = f.engine.recoverGovernedWorkspace(f.input); await started;
    await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), { code: 'FORGE_GOVERNED_RECOVERY_BUSY' });
    release(); await first; assert.equal(f.events.filter(event => event === 'recover').length, 1);
  });

  it('waits for aborted recovery to settle, then closes without verifying or retrying', { timeout: 2000 }, async context => {
    const f = recoveryFixture(); let release, entered, settled = false;
    const gate = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
    context.after(() => { release(); f.controller.abort(); });
    f.input.recover = async () => { f.events.push('recover'); entered(); await gate; return f.resource; };
    const running = f.engine.recoverGovernedWorkspace(f.input);
    void running.then(() => { settled = true; }, () => { settled = true; }); await started;
    const cancelled = Object.assign(Error('Stopped'), { code: 'ORIGINAL_STOP' }); f.controller.abort(cancelled);
    await Promise.resolve(); assert.equal(settled, false); release();
    await assert.rejects(running, error => error === cancelled);
    assert.deepEqual(f.events, ['before_recover', 'recover', 'close']);
  });

  it('passes the bounded deadline signal into recovery and closes on expiration', { timeout: 2000 }, async () => {
    const f = recoveryFixture(); f.input.deadlineAt = Date.now() + 30;
    f.input.recover = async ({ signal }) => { f.events.push('recover');
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true })); return f.resource; };
    await assert.rejects(f.engine.recoverGovernedWorkspace(f.input), { code: 'FORGE_GOVERNED_RECOVERY_DEADLINE' });
    assert.deepEqual(f.events, ['before_recover', 'recover', 'close']); assert.equal(f.engine.getStats().successRate, 0);
  });

  it('rejects a pre-aborted or expired operation without authorizing any action', async () => {
    const cancelled = recoveryFixture(); cancelled.controller.abort();
    await assert.rejects(cancelled.engine.recoverGovernedWorkspace(cancelled.input), { name: 'AbortError' });
    assert.deepEqual(cancelled.events, []);
    const expired = recoveryFixture(); expired.input.deadlineAt = Date.now() - 1;
    await assert.rejects(expired.engine.recoverGovernedWorkspace(expired.input), { code: 'FORGE_GOVERNED_RECOVERY_DEADLINE' });
    assert.deepEqual(expired.events, []);
  });
});
