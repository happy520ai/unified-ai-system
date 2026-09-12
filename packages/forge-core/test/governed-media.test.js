import test from 'node:test';
import assert from 'node:assert/strict';
import { Forge } from '../src/index.js';
import { TaskStore } from '../src/task-store/index.js';
import { Orchestrator } from '../src/orchestrator/index.js';
import { compileGoal } from '../src/goal-compiler/index.js';

function fixture(t, overrides = {}) {
  const store = new TaskStore(':memory:');
  t.after(() => store.close());
  const controller = new AbortController();
  const media = { success: true, outcomeUnknown: false, audio: { base64: 'WAV-PRIVATE-BYTES' } };
  const calls = [];
  const port = { taskId: 'media-tts', summary: 'Generate the approved speech.', getResult: () => media,
    execute: async (task, context) => {
      calls.push({ task, context });
      return { success: true, outcomeUnknown: false, tokenUsage: null, filesModified: [], audio: media.audio };
    }, ...overrides };
  const governedExecution = { beforeAction: async () => {}, mediaTask: port };
  const goalId = store.createGoal({ text: 'Approved speech', projectRoot: process.cwd() });
  store.insertTaskDAG(goalId, [{ id: 'media-tts', name: port.summary, prompt: port.summary,
    type: 'explore', agentRole: 'media', allowedFiles: [] }], []);
  store.updateGoalStatus(goalId, 'compiled', JSON.stringify({ kind: 'approved-media-profile', taskId: 'media-tts' }));
  const execute = (options = {}) => new Orchestrator(store, process.cwd(), {
    governanceRequired: true, governedExecution, signal: controller.signal, ...options,
  }).execute(goalId);
  return { store, controller, media, port, governedExecution, goalId, calls, execute };
}

test('the actual media port completes one task without persisting returned audio or inventing cost', async t => {
  const f = fixture(t), report = await f.execute();
  assert.equal(report.status, 'completed');
  assert.equal(report.completedTasks, 1); assert.equal(report.failedTasks, 0);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].context.signal, f.controller.signal);
  assert.equal(f.calls[0].task.type, 'explore'); assert.deepEqual(f.calls[0].task.allowedFiles, []);
  assert.equal(report.budget.tokensUsed, null); assert.equal(report.budget.costIncurred, null);
  assert.equal(report.budget.costStatus, 'not_reported');
  const persisted = f.store.getTask(f.goalId, 'media-tts').result_json;
  assert.equal(persisted.includes('WAV-PRIVATE-BYTES'), false);
  assert.deepEqual(JSON.parse(persisted), { success: true, outcomeUnknown: false,
    tokenUsage: null, filesModified: [], output: f.port.summary });
});

test('Forge uses the fixed compiler path and returns audio only in report.media', async t => {
  const f = fixture(t);
  const forge = new Forge({ projectRoot: process.cwd(), dbPath: ':memory:', enableCostTracking: false,
    governanceRequired: true, governedExecution: f.governedExecution, signal: f.controller.signal });
  t.after(() => forge.close());
  const report = await forge.run('Approved speech');
  assert.equal(report.status, 'completed'); assert.deepEqual(report.media, f.media);
  assert.equal(report.completedTasks, 1); assert.equal(report.failedTasks, 0); assert.equal(f.calls.length, 1);
  assert.equal(JSON.stringify(forge.getStatus(report.goalId)).includes('WAV-PRIVATE-BYTES'), false);
  await assert.rejects(forge.resume(report.goalId), { code: 'FORGE_MEDIA_RESUME_UNSUPPORTED' });
  await assert.rejects(forge.submitGoal('Approved speech'), { code: 'FORGE_POOL_GOVERNANCE_UNSUPPORTED' });
  await assert.rejects(forge.recoverGoals(), { code: 'FORGE_POOL_GOVERNANCE_UNSUPPORTED' });
  assert.equal(f.calls.length, 1);
  const ungoverned = new Forge({ projectRoot: process.cwd(), dbPath: ':memory:', enableCostTracking: false,
    governedExecution: f.governedExecution });
  t.after(() => ungoverned.close());
  await assert.rejects(ungoverned.run('Approved speech'), { code: 'FORGE_MEDIA_CAPABILITY_INVALID' });
  await assert.rejects(ungoverned.submitGoal('Approved speech'), { code: 'FORGE_POOL_GOVERNANCE_UNSUPPORTED' });
  await assert.rejects(ungoverned.recoverGoals(), { code: 'FORGE_POOL_GOVERNANCE_UNSUPPORTED' });
  assert.equal(f.calls.length, 1);
});

test('media compilation is one fixed task and rejects unsafe or conflicting capability shapes', async t => {
  const f = fixture(t);
  const compiled = await compileGoal(f.store, { goalText: 'Approved speech', projectRoot: '/nonexistent-media-fixture',
    skipCodebaseProbe: true, governanceRequired: true, mediaTask: f.port });
  const tasks = f.store.getTasksForGoal(compiled.goalId);
  assert.equal(compiled.taskCount, 1); assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, 'media-tts'); assert.equal(tasks[0].agent_role, 'media');
  assert.equal(tasks[0].type, 'explore'); assert.deepEqual(tasks[0].allowed_files, []);
  for (const options of [{ governanceRequired: false }, { skipCodebaseProbe: false },
    { mediaTask: { ...f.port, taskId: 'other' } }, { mediaTask: { ...f.port, execute: null } },
    { mediaTask: { ...f.port, getResult: null } }, { webTask: { taskId: 'web-lookup' } }]) {
    await assert.rejects(compileGoal(f.store, { goalText: 'Approved speech', projectRoot: process.cwd(),
      skipCodebaseProbe: true, governanceRequired: true, mediaTask: f.port, ...options }), /FORGE_MEDIA_CAPABILITY_INVALID/);
  }
  assert.equal(f.calls.length, 0);
});

test('direct media execution rejects absent governance, absent port, wrong id and competing web capability', async t => {
  for (const options of [
    f => ({ governanceRequired: false }),
    f => ({ governedExecution: { beforeAction: f.governedExecution.beforeAction } }),
    f => ({ governedExecution: { ...f.governedExecution, mediaTask: { ...f.port, taskId: 'other' } } }),
    f => ({ governedExecution: { ...f.governedExecution, webTask: { taskId: 'web-lookup' } } }),
  ]) {
    const f = fixture(t);
    await assert.rejects(f.execute(options(f)), { code: 'FORGE_MEDIA_CAPABILITY_INVALID' });
    assert.equal(f.calls.length, 0);
  }
});

test('a media task cannot enlarge the fixed DAG or its file and role boundary', async t => {
  for (const mutate of [
    f => f.store.db.prepare("UPDATE tasks SET allowed_files = '[\"output.wav\"]' WHERE goal_id = ?").run(f.goalId),
    f => f.store.db.prepare("UPDATE tasks SET type = 'implement' WHERE goal_id = ?").run(f.goalId),
    f => f.store.db.prepare("UPDATE tasks SET agent_role = 'audio-generator' WHERE goal_id = ?").run(f.goalId),
    f => f.store.insertTaskDAG(f.goalId, [{ id: 'extra', name: 'extra', type: 'explore', agentRole: 'coder' }], []),
  ]) {
    const f = fixture(t); mutate(f);
    await assert.rejects(f.execute(), { code: 'FORGE_MEDIA_CAPABILITY_INVALID' });
    assert.equal(f.calls.length, 0);
  }
});

test('missing markers, unknown outcomes, file claims and thrown failures never retry the media port', async t => {
  for (const result of [undefined, { success: true },
    { success: true, outcomeUnknown: true, tokenUsage: null, filesModified: [] },
    { success: false, outcomeUnknown: false, tokenUsage: null, filesModified: [] },
    { success: true, outcomeUnknown: false, tokenUsage: {}, filesModified: [] },
    { success: true, outcomeUnknown: false, tokenUsage: null, filesModified: ['output.wav'] },
    new Error('untrusted execution detail')]) {
    let calls = 0;
    const f = fixture(t, { execute: async () => { calls++; if (result instanceof Error) throw result; return result; } });
    const report = await f.execute();
    assert.equal(report.status, 'failed'); assert.equal(report.completedTasks, 0); assert.equal(report.failedTasks, 1);
    assert.equal(calls, 1); assert.equal(f.store.getTask(f.goalId, 'media-tts').status, 'failed');
    assert.equal(f.store.getTask(f.goalId, 'media-tts').result_json, null);
    await assert.rejects(f.execute(), { code: 'FORGE_MEDIA_RESUME_UNSUPPORTED' });
    assert.equal(calls, 1);
  }
});

test('a budget stop before dispatch and missing completion evidence cannot report completed', async t => {
  const f = fixture(t), report = await f.execute({ budget: { maxTokens: 0 } });
  assert.equal(report.status, 'failed'); assert.equal(report.completedTasks, 0); assert.equal(f.calls.length, 0);
  assert.equal(f.store.getGoal(f.goalId).status, 'failed');
  for (const media of [null, { success: true }, { success: true, outcomeUnknown: true }, { success: false, outcomeUnknown: false }]) {
    const other = fixture(t, { getResult: () => media }), result = await other.execute();
    assert.equal(result.status, 'failed'); assert.equal(other.store.getGoal(other.goalId).status, 'failed');
    assert.equal(other.calls.length, 1);
  }
});

test('cancellation reaches the port, drains its call, and cannot be resumed or retried', async t => {
  let settled = false, started;
  const ready = new Promise(resolve => { started = resolve; });
  const f = fixture(t, { execute: (_task, context) => new Promise((resolve, reject) => {
    assert.equal(context.signal, f.controller.signal); started();
    context.signal.addEventListener('abort', () => { settled = true; reject(context.signal.reason); }, { once: true });
  }) });
  const running = f.execute(); await ready;
  f.controller.abort(new Error('cancelled fixture'));
  await assert.rejects(running); assert.equal(settled, true);
  await assert.rejects(f.execute({ signal: new AbortController().signal }), { code: 'FORGE_MEDIA_RESUME_UNSUPPORTED' });
  const preAborted = fixture(t); preAborted.controller.abort();
  await assert.rejects(preAborted.execute()); assert.equal(preAborted.calls.length, 0);
});
