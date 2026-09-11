import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { AgentPoolManager } from '../src/agent-pool/index.js';
import { WORKER_MAP } from '../src/agent-pool/constants.js';
import { SelfHealingEngine } from '../src/self-healing/index.js';
import { MemoryEngine } from '../src/memory-engine/index.js';
import { reapOrphanTasks } from '../src/agent-pool/orphan-reaper.js';

const hash = value => 'sha256:' + createHash('sha256').update(value).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject, settled = false;
  const promise = new Promise((yes, no) => {
    resolve = value => { if (!settled) { settled = true; yes(value); } };
    reject = value => { if (!settled) { settled = true; no(value); } };
  });
  return { promise, resolve, reject, get settled() { return settled; } };
}
function pointer(label, revision = 0) {
  const taskId = randomUUID();
  return { goalId: taskId, taskId, userId: `owner-${label}`, tenantId: `tenant-${label}`, projectId: `project-${label}`,
    agentId: `agt_${label}`, profileHash: hash(`profile-${label}`), reviewHash: hash(`review-${label}`),
    planHash: hash(`plan-${label}`), residentAuthorizationHash: hash(`resident-${label}`), bindingHash: hash(`binding-${label}`), revision };
}
function outcome(goal, status = 'completed', revision = goal.revision + 1) {
  return { goalId: goal.goalId, taskId: goal.taskId, bindingHash: goal.bindingHash, revision, status };
}
function fixture(context, options = {}) {
  const goals = new Map(), calls = [], controls = [], pending = [], admissionHolds = new Map(), controlHolds = new Map();
  let execute = async ({ goal }) => outcome(goal), recovering = [];
  let controlOperation = async input => { await controlHolds.get(input.goal.goalId)?.promise; };
  const port = {
    async admit(input) {
      calls.push({ type: 'admit', ...input });
      await admissionHolds.get(input.goalId)?.promise;
      const current = goals.get(input.goalId);
      if (!current || current.userId !== input.userId || current.denied) throw Object.assign(new Error('Fixture admission rejected.'), { code: 'FIXTURE_ADMISSION_DENIED' });
      return { ...current };
    },
    async executeChunk(input) {
      calls.push({ type: 'execute', ...input });
      assert.ok(Object.isFrozen(input)); assert.ok(Object.isFrozen(input.goal));
      return execute(input);
    },
    async cancel(input) { controls.push(input); await controlOperation(input); },
    async recoverableGoals() { return recovering; },
  };
  const pool = new AgentPoolManager({ governedChunkExecutor: port, ...options });
  context.after(async () => {
    for (const hold of admissionHolds.values()) hold.resolve();
    for (const hold of controlHolds.values()) hold.resolve();
    for (const { hold, goal } of pending) hold.resolve(outcome(goal));
    await pool.shutdown();
  });
  return { pool, port, goals, calls, controls, admissionHolds, controlHolds,
    add(label) { const goal = pointer(label); goals.set(goal.goalId, goal); return goal; },
    setExecute(fn) { execute = fn; },
    setControl(fn) { controlOperation = fn; },
    holdExecution() { execute = input => { const hold = deferred(); pending.push({ hold, ...input }); return hold.promise; }; return pending; },
    recover(entries) { recovering = entries; },
  };
}

test('governed mode uses the actual Pool collections without global store, workspace, legacy workers or healing side effects', async context => {
  const healing = context.mock.method(SelfHealingEngine.prototype, 'start', () => { throw new Error('Legacy healing must not start.'); });
  const memory = context.mock.method(MemoryEngine.prototype, 'load', async () => { throw new Error('Legacy memory must not load.'); });
  for (const name of Object.keys(WORKER_MAP)) context.mock.method(WORKER_MAP, name, () => { throw new Error('Legacy worker must not run.'); });
  const f = fixture(context), goal = f.add('isolated');
  assert.equal(f.calls.length, 0);
  assert.equal((await f.pool.start()).mode, 'governed-chunks');
  const admitted = await f.pool.enqueueGovernedGoal(goal.goalId, goal.userId);
  assert.equal(admitted.status, 'queued'); assert.ok(admitted.completion instanceof Promise);
  const report = await admitted.completion;
  assert.equal(report.status, 'completed'); assert.equal(report.tenantId, goal.tenantId); assert.equal(report.projectId, goal.projectId);
  assert.equal(f.pool.getStatus().activeWorkers, 0); assert.equal(f.pool.getStatus().activeGoals, 0);
  assert.equal(f.pool.getStatus().legacySideEffectsEnabled, false);
  assert.equal(healing.mock.callCount(), 0); assert.equal(memory.mock.callCount(), 0);
  await reapOrphanTasks({ governedChunkExecutor: f.port, store: new Proxy({}, { get() { throw new Error('No legacy orphan reads.'); } }) });
  await assert.rejects(f.pool.submitGoal(randomUUID(), goal.userId, { budget: { maxTokens: 1 } }), { code: 'FORGE_POOL_CONTRACT_INVALID' });
});

test('one actual worker slot alternates continuing goals fairly without duplicate assignments or changed bindings', async context => {
  const f = fixture(context, { maxConcurrent: 1, maxGoals: 2 }), a = f.add('a'), b = f.add('b'), order = [];
  let executing = 0, peak = 0;
  f.setExecute(async ({ goal }) => {
    executing++; peak = Math.max(peak, executing); order.push(goal.goalId); await tick(); executing--;
    return outcome(goal, goal.revision < 2 ? 'continue' : 'completed');
  });
  const accepted = await Promise.all([f.pool.enqueueGovernedGoal(a.goalId, a.userId), f.pool.enqueueGovernedGoal(b.goalId, b.userId)]);
  const results = await Promise.all(accepted.map(value => value.completion));
  assert.deepEqual(order, [a.goalId, b.goalId, a.goalId, b.goalId, a.goalId, b.goalId]);
  assert.equal(peak, 1); assert.ok(results.every(value => value.status === 'completed' && value.revision === 3));
  assert.equal(f.pool.getMetrics().chunksStarted, 6); assert.equal(f.pool.getMetrics().chunksSettled, 6);
  assert.equal(f.calls.filter(value => value.type === 'admit').length, 2);
  for (const call of f.calls.filter(value => value.type === 'execute')) {
    const original = call.goal.goalId === a.goalId ? a : b;
    assert.equal(call.goal.tenantId, original.tenantId); assert.equal(call.goal.projectId, original.projectId);
    assert.equal(call.goal.bindingHash, original.bindingHash);
  }
});

test('maxGoals reserves admitting goals and admission is acknowledged only after the real server check', async context => {
  const f = fixture(context, { maxGoals: 2, maxConcurrent: 2 }), a = f.add('admit_a'), b = f.add('admit_b'), c = f.add('admit_c');
  const holdA = deferred(), holdB = deferred(); f.admissionHolds.set(a.goalId, holdA); f.admissionHolds.set(b.goalId, holdB);
  let acknowledged = false;
  const waitingA = f.pool.enqueueGovernedGoal(a.goalId, a.userId).then(value => { acknowledged = true; return value; });
  const waitingB = f.pool.enqueueGovernedGoal(b.goalId, b.userId);
  await assert.rejects(f.pool.enqueueGovernedGoal(c.goalId, c.userId), { code: 'FORGE_POOL_MAX_GOALS' });
  await tick(); assert.equal(acknowledged, false); assert.equal(f.pool.getStatus().admittingGoals, 2);
  assert.equal(f.calls.filter(value => value.type === 'execute').length, 0);
  assert.equal(f.calls.filter(value => value.type === 'admit').length, 2);
  holdA.resolve(); holdB.resolve();
  const accepted = await Promise.all([waitingA, waitingB]); await Promise.all(accepted.map(value => value.completion));
  assert.equal(f.pool.getStatus().activeGoals, 0);
  const denied = f.add('denied'); denied.denied = true;
  await assert.rejects(f.pool.enqueueGovernedGoal(denied.goalId, denied.userId), { code: 'FIXTURE_ADMISSION_DENIED' });
  assert.equal(f.pool.hasGovernedGoal(denied.goalId), false);
});

test('waiting capacity rejects before admission and pausing a queued goal releases it without executing that goal', async context => {
  const f = fixture(context, { maxConcurrent: 1, maxGoals: 3, maxQueuedGoals: 1 }), a = f.add('queue_a'), b = f.add('queue_b'), c = f.add('queue_c');
  const executing = f.holdExecution();
  const acceptedA = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  const acceptedB = await f.pool.enqueueGovernedGoal(b.goalId, b.userId);
  await assert.rejects(f.pool.enqueueGovernedGoal(c.goalId, c.userId), { code: 'FORGE_POOL_QUEUE_CAPACITY' });
  assert.equal(f.calls.filter(value => value.type === 'admit').length, 2);
  assert.equal((await f.pool.pauseGoal(b.goalId, b.userId)).status, 'paused');
  assert.equal((await acceptedB.completion).status, 'paused');
  assert.equal(f.calls.filter(value => value.type === 'execute' && value.goal.goalId === b.goalId).length, 0);
  const acceptedC = await f.pool.enqueueGovernedGoal(c.goalId, c.userId);
  executing[0].hold.resolve(outcome(executing[0].goal)); await acceptedA.completion; await tick();
  assert.equal(executing[1].goal.goalId, c.goalId); executing[1].hold.resolve(outcome(executing[1].goal));
  await acceptedC.completion;
});

test('cancellation during admission never queues a worker and emits its terminal outcome once', async context => {
  const f = fixture(context), a = f.add('cancel_admission'), hold = deferred(), notifications = [];
  f.admissionHolds.set(a.goalId, hold); f.pool.on('goal_cancelled', value => notifications.push(value));
  const admission = f.pool.enqueueGovernedGoal(a.goalId, a.userId);
  const rejected = assert.rejects(admission, { code: 'FORGE_POOL_ADMISSION_STOPPED' });
  const cancel = f.pool.cancelGoal(a.goalId, a.userId);
  await tick(); assert.equal(f.pool.getStatus().admittingGoals, 1);
  hold.resolve(); await rejected; assert.equal((await cancel).status, 'cancelled');
  assert.equal(notifications.length, 1); assert.equal(f.controls.length, 1);
  assert.equal(f.calls.filter(value => value.type === 'execute').length, 0);
});

test('failed admission preserves the original rejection for an overlapping control request', async context => {
  const f = fixture(context), a = f.add('denied_control'), hold = deferred(); a.denied = true;
  f.admissionHolds.set(a.goalId, hold);
  const admission = f.pool.enqueueGovernedGoal(a.goalId, a.userId);
  const rejectedAdmission = assert.rejects(admission, { code: 'FIXTURE_ADMISSION_DENIED' });
  const rejectedControl = assert.rejects(f.pool.pauseGoal(a.goalId, a.userId), { code: 'FIXTURE_ADMISSION_DENIED' });
  hold.resolve(); await Promise.all([rejectedAdmission, rejectedControl]);
  assert.equal(f.pool.hasGovernedGoal(a.goalId), false); assert.equal(f.controls.length, 0);
});

test('admission waits for a later cancel escalation instead of releasing capacity after only the earlier pause', async context => {
  const f = fixture(context), a = f.add('escalation'), admissionHold = deferred(), pauseHold = deferred(), cancelHold = deferred();
  f.admissionHolds.set(a.goalId, admissionHold); f.controlHolds.set('pause', pauseHold); f.controlHolds.set('cancel', cancelHold);
  f.setControl(async ({ reason }) => { await (reason === 'pause' ? pauseHold : cancelHold).promise; });
  let admissionSettled = false;
  const admission = f.pool.enqueueGovernedGoal(a.goalId, a.userId).then(() => { admissionSettled = true; assert.fail('Stopped admission cannot acknowledge queued.'); },
    error => { admissionSettled = true; assert.equal(error.code, 'FORGE_POOL_ADMISSION_STOPPED'); });
  const pause = f.pool.pauseGoal(a.goalId, a.userId); admissionHold.resolve(); await tick();
  const cancel = f.pool.cancelGoal(a.goalId, a.userId); pauseHold.resolve(); await tick();
  assert.equal(admissionSettled, false); assert.equal(f.pool.getStatus().activeGoals, 1);
  cancelHold.resolve(); await admission;
  assert.equal((await pause).status, 'cancelled'); assert.equal((await cancel).status, 'cancelled');
  assert.deepEqual(f.controls.map(value => value.reason), ['pause', 'cancel']);
});

test('two goals run concurrently and cancellation aborts only its target, keeping its slot until executor and control settle', async context => {
  const f = fixture(context, { maxConcurrent: 2, maxGoals: 2 }), a = f.add('cancel_a'), b = f.add('cancel_b');
  const executing = f.holdExecution(), control = deferred(); f.controlHolds.set(a.goalId, control);
  const [acceptedA, acceptedB] = await Promise.all([f.pool.enqueueGovernedGoal(a.goalId, a.userId), f.pool.enqueueGovernedGoal(b.goalId, b.userId)]);
  await tick(); assert.equal(executing.length, 2); assert.equal(f.pool.getStatus().activeWorkers, 2);
  const activeA = executing.find(value => value.goal.goalId === a.goalId), activeB = executing.find(value => value.goal.goalId === b.goalId);
  let cancelled = false;
  const stopping = f.pool.cancelGoal(a.goalId, a.userId).then(result => { cancelled = true; return result; });
  assert.equal(activeA.signal.aborted, true); assert.equal(activeB.signal.aborted, false);
  activeA.hold.resolve(outcome(activeA.goal, 'continue')); await tick();
  assert.equal(cancelled, false); assert.equal(f.pool.getStatus().activeWorkers, 2);
  activeB.hold.resolve(outcome(activeB.goal)); await acceptedB.completion;
  assert.equal(f.pool.getStatus().activeWorkers, 1);
  control.resolve(); assert.equal((await stopping).status, 'cancelled'); assert.equal((await acceptedA.completion).status, 'cancelled');
  assert.equal(f.calls.filter(value => value.type === 'execute' && value.goal.goalId === a.goalId).length, 1);
  assert.equal(f.pool.getStatus().activeWorkers, 0);
});

test('pause never aborts an executing chunk and explicit reschedule uses a fresh admission and advanced cursor', async context => {
  const f = fixture(context, { maxConcurrent: 1 }), a = f.add('pause'), executing = f.holdExecution();
  const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  const pause = f.pool.pauseGoal(a.goalId, a.userId);
  assert.equal(executing[0].signal.aborted, false); assert.equal(f.pool.getStatus().activeWorkers, 1);
  executing[0].hold.resolve(outcome(executing[0].goal, 'continue'));
  assert.equal((await pause).status, 'paused'); assert.equal((await accepted.completion).status, 'paused');
  await tick(); assert.equal(executing.length, 1);
  a.revision = 0;
  await assert.rejects(f.pool.enqueueGovernedGoal(a.goalId, a.userId, 'resume'), { code: 'FORGE_POOL_BINDING_CHANGED' });
  a.revision = 7; a.bindingHash = hash('fresh-binding'); a.residentAuthorizationHash = hash('fresh-grant');
  f.setExecute(async ({ goal }) => { assert.equal(goal.revision, 7); return outcome(goal); });
  const resumed = await f.pool.enqueueGovernedGoal(a.goalId, a.userId, 'resume');
  assert.equal((await resumed.completion).revision, 8);
  assert.equal(f.calls.filter(value => value.type === 'admit').at(-1).mode, 'resume');
});

test('unknown, malformed and non-advancing results are never retried or rescheduled', async context => {
  for (const variant of ['unknown', 'throw', 'no-progress', 'other-goal', 'extra-authority']) {
    const f = fixture(context, { maxGoals: 1 }), a = f.add(variant.replaceAll('-', '_'));
    f.setExecute(async ({ goal }) => {
      if (variant === 'throw') throw Object.assign(new Error('First fixture executor failure.'), { code: 'FIXTURE_FIRST_ERROR' });
      if (variant === 'no-progress') return outcome(goal, 'continue', goal.revision);
      if (variant === 'other-goal') return { ...outcome(goal), goalId: randomUUID() };
      if (variant === 'extra-authority') return { ...outcome(goal), review: { execute: true } };
      return outcome(goal, 'unknown');
    });
    const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId);
    await assert.rejects(accepted.completion, error => error.code === 'FORGE_POOL_OUTCOME_UNKNOWN'
      && error.report.status === 'unknown' && (variant !== 'throw' || error.cause?.code === 'FIXTURE_FIRST_ERROR'));
    await tick(); assert.equal(f.calls.filter(value => value.type === 'execute').length, 1);
    await assert.rejects(f.pool.enqueueGovernedGoal(a.goalId, a.userId, 'resume'), { code: 'FORGE_POOL_OUTCOME_UNKNOWN' });
    assert.equal(f.calls.filter(value => value.type === 'admit').length, 1); assert.equal(f.pool.getStatus().queueLength, 0);
  }
});

test('stale control binding cannot cancel a new residency, including its admitting window, while same-grant revision progress remains controllable', async context => {
  const f = fixture(context), a = f.add('control_cas'), executing = f.holdExecution(), oldBinding = a.bindingHash;
  const first = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  const pause = f.pool.pauseGoal(a.goalId, a.userId, oldBinding); executing[0].hold.resolve(outcome(executing[0].goal, 'continue'));
  await pause; await first.completion;
  a.revision = 1; a.bindingHash = hash('new-residency-binding'); a.residentAuthorizationHash = hash('new-residency-grant');
  const hold = deferred(); f.admissionHolds.set(a.goalId, hold);
  const pendingAdmission = f.pool.enqueueGovernedGoal(a.goalId, a.userId);
  await assert.rejects(f.pool.cancelGoal(a.goalId, a.userId, oldBinding), { code: 'FORGE_POOL_BINDING_CHANGED' });
  assert.equal(f.controls.length, 1); hold.resolve();
  const second = await pendingAdmission; await tick();
  await assert.rejects(f.pool.cancelGoal(a.goalId, a.userId, oldBinding), { code: 'FORGE_POOL_BINDING_CHANGED' });
  await assert.rejects(f.pool.pauseGoal(a.goalId, a.userId, 'bad-hash'), { code: 'FORGE_POOL_BINDING_CHANGED' });
  assert.equal(executing[1].signal.aborted, false); assert.equal(f.pool.getStatus().activeWorkers, 1); assert.equal(f.controls.length, 1);
  executing[1].hold.resolve(outcome(executing[1].goal, 'continue')); await tick();
  assert.equal(executing[2].goal.revision, 2);
  const cancel = f.pool.cancelGoal(a.goalId, a.userId, a.bindingHash);
  assert.equal(executing[2].signal.aborted, true);
  executing[2].hold.resolve(outcome(executing[2].goal, 'continue'));
  assert.equal((await cancel).status, 'cancelled'); assert.equal((await second.completion).revision, 3);
});

test('the first execution failure survives a later control failure and both operations are drained', async context => {
  const f = fixture(context), a = f.add('first_error'), executing = f.holdExecution(), control = deferred(); f.controlHolds.set(a.goalId, control);
  const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  const stopping = f.pool.cancelGoal(a.goalId, a.userId);
  const first = Object.assign(new Error('First execution error.'), { code: 'FIXTURE_FIRST_EXECUTION_ERROR' });
  executing[0].hold.reject(first); await tick(); assert.equal(f.pool.getStatus().activeWorkers, 1);
  control.reject(Object.assign(new Error('Later control error.'), { code: 'FIXTURE_LATER_CONTROL_ERROR' }));
  await assert.rejects(accepted.completion, error => error.cause === first && error.report.errorCode === first.code);
  assert.equal((await stopping).status, 'unknown'); assert.equal(f.pool.getStatus().activeWorkers, 0); assert.equal(f.controls.length, 1);
});

test('shutdown requests bounded drain without aborting or timeout-clearing active assignments', async context => {
  const f = fixture(context), a = f.add('shutdown'), executing = f.holdExecution();
  const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  let stopped = false; const shutdown = f.pool.shutdown({ timeoutMs: 1 }).then(value => { stopped = true; return value; });
  assert.equal(executing[0].signal.aborted, false); await tick();
  assert.equal(stopped, false); assert.equal(f.pool.getStatus().activeWorkers, 1);
  await assert.rejects(f.pool.enqueueGovernedGoal(randomUUID(), a.userId), { code: 'FORGE_POOL_SHUTTING_DOWN' });
  executing[0].hold.resolve(outcome(executing[0].goal, 'continue'));
  assert.equal((await accepted.completion).status, 'paused'); assert.equal((await shutdown).activeWorkers, 0);
  assert.equal(f.controls[0].reason, 'shutdown'); assert.equal(f.pool.getStatus().queueLength, 0);
});

test('a deadline or unknown executor result during shutdown remains unknown and is never requeued', async context => {
  const f = fixture(context), a = f.add('shutdown_unknown'), executing = f.holdExecution();
  const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  let stopped = false; const shutdown = f.pool.shutdown({ timeoutMs: 1 }).then(value => { stopped = true; return value; });
  await tick(); assert.equal(stopped, false); assert.equal(executing[0].signal.aborted, false);
  const deadline = Object.assign(new Error('The owner execution deadline expired.'), { code: 'AGENT_LONG_TASK_CHUNK_DEADLINE' });
  executing[0].hold.reject(deadline);
  await assert.rejects(accepted.completion, error => error.code === 'FORGE_POOL_OUTCOME_UNKNOWN' && error.cause === deadline);
  assert.equal((await shutdown).outcomeUnknown, true); assert.equal(f.pool.getStatus().activeWorkers, 0);
  assert.equal(f.pool.getStatus().queueLength, 0); assert.equal(f.calls.filter(value => value.type === 'execute').length, 1);
});

test('operator cancel wins a concurrent shutdown drain and remains the only reason that aborts execution', async context => {
  const f = fixture(context), a = f.add('shutdown_cancel'), executing = f.holdExecution();
  const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await tick();
  const shutdown = f.pool.shutdown(); await tick(); assert.equal(executing[0].signal.aborted, false);
  const cancel = f.pool.cancelGoal(a.goalId, a.userId, a.bindingHash); assert.equal(executing[0].signal.aborted, true);
  executing[0].hold.resolve(outcome(executing[0].goal, 'continue'));
  assert.equal((await cancel).status, 'cancelled'); assert.equal((await accepted.completion).status, 'cancelled');
  await shutdown; assert.deepEqual(f.controls.map(value => value.reason), ['shutdown', 'cancel']);
});

test('recovery uses only root-provided original pointers and fresh admission, while inactive status history stays bounded', async context => {
  const f = fixture(context, { maxGoals: 2 }), a = f.add('recover_a'), b = f.add('recover_b');
  a.revision = 6; b.denied = true;
  f.recover([{ goalId: a.goalId, userId: a.userId }, { goalId: b.goalId, userId: b.userId }]);
  assert.equal(f.calls.length, 0);
  const recovered = await f.pool.recoverInterruptedGoals();
  assert.deepEqual(recovered.admitted, [a.goalId]); assert.deepEqual(recovered.rejected, [{ goalId: b.goalId, code: 'FIXTURE_ADMISSION_DENIED' }]);
  assert.equal(recovered.legacyTasksReplayed, false); await tick();
  assert.equal(f.calls.find(value => value.type === 'execute').goal.revision, 6);
  assert.ok(f.calls.filter(value => value.type === 'admit').every(value => value.mode === 'resume'));
  for (let index = 0; index < 135; index++) {
    const goal = f.add('history_' + index); const accepted = await f.pool.enqueueGovernedGoal(goal.goalId, goal.userId); await accepted.completion;
  }
  assert.equal(f.pool.getStatus().goals.length, 128); assert.equal(f.pool.getStatus().activeGoals, 0);
});

test('plain JSON cannot provide executor methods or override an admitted identity', async context => {
  assert.throws(() => new AgentPoolManager({ governedChunkExecutor: { admit: true, executeChunk: true, cancel: true } }));
  const getter = () => { throw new Error('Getter must never run.'); };
  assert.throws(() => new AgentPoolManager({ governedChunkExecutor: Object.defineProperty({ executeChunk() {}, cancel() {} }, 'admit', { get: getter, enumerable: true }) }),
    error => error.code === 'FORGE_POOL_CONTRACT_INVALID');
  const f = fixture(context), a = f.add('identity');
  await assert.rejects(f.pool.enqueueGovernedGoal(a.goalId, 'another-owner'), { code: 'FIXTURE_ADMISSION_DENIED' });
  const accepted = await f.pool.enqueueGovernedGoal(a.goalId, a.userId); await accepted.completion;
  await assert.rejects(f.pool.pauseGoal(a.goalId, 'another-owner'), { code: 'FORGE_POOL_GOAL_NOT_FOUND' });
});
