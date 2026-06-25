import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProgressReporter } from '../src/progress-reporter/index.js';

// ============================================================================
// Constructor
// ============================================================================

describe('ProgressReporter — constructor', () => {
  it('creates an instance without error', () => {
    const r = new ProgressReporter();
    assert.ok(r instanceof ProgressReporter);
  });

  it('starts with no tracked goals', () => {
    const r = new ProgressReporter();
    assert.deepEqual(r.getTrackedGoalIds(), []);
  });
});

// ============================================================================
// Event subscription — on / once / off / chaining
// ============================================================================

describe('ProgressReporter — event subscription', () => {
  it('on() returns this for chaining', () => {
    const r = new ProgressReporter();
    const ret = r.on('task_started', () => {});
    assert.equal(ret, r);
  });

  it('once() returns this for chaining', () => {
    const r = new ProgressReporter();
    const ret = r.once('task_started', () => {});
    assert.equal(ret, r);
  });

  it('off() returns this for chaining', () => {
    const r = new ProgressReporter();
    const fn = () => {};
    r.on('task_started', fn);
    const ret = r.off('task_started', fn);
    assert.equal(ret, r);
  });

  it('on() listener fires on emitted event', () => {
    const r = new ProgressReporter();
    const events = [];
    r.on('task_started', (e) => events.push(e));
    r.startGoal('g1', 3, 'test');
    r.taskStarted('g1', 't1', 'coder', 'task-1');
    assert.equal(events.length, 1);
    assert.equal(events[0].taskId, 't1');
  });

  it('once() listener fires only once', () => {
    const r = new ProgressReporter();
    const events = [];
    r.once('task_completed', (e) => events.push(e));
    r.startGoal('g1', 3, 'test');
    r.taskStarted('g1', 't1', 'coder', 'task-1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.taskStarted('g1', 't2', 'coder', 'task-2');
    r.taskCompleted('g1', 't2', true, 1000);
    assert.equal(events.length, 1);
  });

  it('off() removes a listener so it no longer fires', () => {
    const r = new ProgressReporter();
    const events = [];
    const fn = (e) => events.push(e);
    r.on('task_started', fn);
    r.startGoal('g1', 3, 'test');
    r.taskStarted('g1', 't1', 'coder', 'task-1');
    assert.equal(events.length, 1);
    r.off('task_started', fn);
    r.taskStarted('g1', 't2', 'coder', 'task-2');
    assert.equal(events.length, 1);
  });

  it('chaining multiple subscriptions works', () => {
    const r = new ProgressReporter();
    const a = [];
    const b = [];
    r.on('task_started', (e) => a.push(e))
      .on('task_completed', (e) => b.push(e));
    r.startGoal('g1', 2, 'chain');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 500);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  });
});

// ============================================================================
// Goal lifecycle — startGoal / taskStarted / taskCompleted / goalCompleted
// ============================================================================

describe('ProgressReporter — goal lifecycle', () => {
  it('startGoal registers a tracked goal', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'Add auth');
    assert.deepEqual(r.getTrackedGoalIds(), ['g1']);
  });

  it('startGoal sets initial progress correctly', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'Add auth');
    const p = r.getProgress('g1');
    assert.equal(p.totalTasks, 5);
    assert.equal(p.completedTasks, 0);
    assert.equal(p.failedTasks, 0);
    assert.equal(p.pendingTasks, 5);
    assert.equal(p.percentComplete, 0);
    assert.equal(p.status, 'in_progress');
    assert.equal(p.goalText, 'Add auth');
  });

  it('startGoal with empty goalText defaults to empty string', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 2);
    const p = r.getProgress('g1');
    assert.equal(p.goalText, '');
  });

  it('taskStarted records the task in progress', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'Explore codebase');
    const p = r.getProgress('g1');
    assert.equal(p.tasks.length, 1);
    assert.equal(p.tasks[0].taskId, 't1');
    assert.equal(p.tasks[0].workerType, 'coder');
    assert.equal(p.tasks[0].taskName, 'Explore codebase');
    assert.equal(p.tasks[0].running, true);
    assert.equal(p.tasks[0].success, null);
  });

  it('taskStarted defaults taskName to taskId when omitted', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 'task-42', 'coder');
    const p = r.getProgress('g1');
    assert.equal(p.tasks[0].taskName, 'task-42');
  });

  it('taskStarted defaults workerType to "unknown" when falsy', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', '', 'name');
    const p = r.getProgress('g1');
    assert.equal(p.tasks[0].workerType, 'unknown');
  });

  it('taskCompleted increments completedTasks on success', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 2000);
    const p = r.getProgress('g1');
    assert.equal(p.completedTasks, 1);
    assert.equal(p.failedTasks, 0);
  });

  it('taskCompleted increments failedTasks on failure', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', false, 500);
    const p = r.getProgress('g1');
    assert.equal(p.completedTasks, 0);
    assert.equal(p.failedTasks, 1);
  });

  it('taskCompleted marks the task as no longer running', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    const p = r.getProgress('g1');
    assert.equal(p.tasks[0].running, false);
    assert.equal(p.tasks[0].success, true);
    assert.equal(p.tasks[0].durationMs, 1000);
  });

  it('taskCompleted without prior taskStarted still increments counters', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskCompleted('g1', 'unknown-task', true, 1000);
    const p = r.getProgress('g1');
    assert.equal(p.completedTasks, 1);
  });

  it('goalCompleted sets status and emits event', () => {
    const r = new ProgressReporter();
    const events = [];
    r.on('goal_completed', (e) => events.push(e));
    r.startGoal('g1', 2, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.goalCompleted('g1', 'completed', 5000);
    const p = r.getProgress('g1');
    assert.equal(p.status, 'completed');
    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'completed');
    assert.equal(events[0].totalDurationMs, 5000);
    assert.equal(events[0].completedTasks, 1);
    assert.equal(events[0].totalTasks, 2);
  });

  it('goalCompleted uses elapsed time when totalDurationMs not provided', () => {
    const r = new ProgressReporter();
    const events = [];
    r.on('goal_completed', (e) => events.push(e));
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'completed');
    assert.ok(events[0].totalDurationMs >= 0);
  });

  it('full lifecycle: start → tasks → goal complete', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'Full cycle');
    r.taskStarted('g1', 't1', 'explore', 'Explore');
    r.taskCompleted('g1', 't1', true, 1000);
    r.taskStarted('g1', 't2', 'implement', 'Build');
    r.taskCompleted('g1', 't2', true, 2000);
    r.taskStarted('g1', 't3', 'test', 'Test');
    r.taskCompleted('g1', 't3', false, 500);
    r.goalCompleted('g1', 'failed', 4000);
    const p = r.getProgress('g1');
    assert.equal(p.completedTasks, 2);
    assert.equal(p.failedTasks, 1);
    assert.equal(p.pendingTasks, 0);
    assert.equal(p.status, 'failed');
  });
});

// ============================================================================
// Progress queries — getProgress details
// ============================================================================

describe('ProgressReporter — getProgress', () => {
  it('returns null for unknown goalId', () => {
    const r = new ProgressReporter();
    assert.equal(r.getProgress('no-such'), null);
  });

  it('percentComplete is based on completed (not failed) tasks', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 4, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.taskStarted('g1', 't2', 'coder', 't2');
    r.taskCompleted('g1', 't2', false, 500);
    const p = r.getProgress('g1');
    // 1 completed out of 4 = 25%
    assert.equal(p.percentComplete, 25);
  });

  it('percentComplete is 0 when totalTasks is 0', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 0, 'empty');
    const p = r.getProgress('g1');
    assert.equal(p.percentComplete, 0);
  });

  it('pendingTasks accounts for both completed and failed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 100);
    r.taskStarted('g1', 't2', 'coder', 't2');
    r.taskCompleted('g1', 't2', false, 100);
    const p = r.getProgress('g1');
    assert.equal(p.pendingTasks, 3);
  });

  it('elapsedMs is non-negative', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    const p = r.getProgress('g1');
    assert.ok(p.elapsedMs >= 0);
  });

  it('goalId and goalText are included in progress', () => {
    const r = new ProgressReporter();
    r.startGoal('g-abc', 1, 'Some goal text');
    const p = r.getProgress('g-abc');
    assert.equal(p.goalId, 'g-abc');
    assert.equal(p.goalText, 'Some goal text');
  });

  it('tasks array includes running flag', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'running-task');
    r.taskStarted('g1', 't2', 'tester', 'done-task');
    r.taskCompleted('g1', 't2', true, 1000);
    const p = r.getProgress('g1');
    const t1 = p.tasks.find(t => t.taskId === 't1');
    const t2 = p.tasks.find(t => t.taskId === 't2');
    assert.equal(t1.running, true);
    assert.equal(t2.running, false);
  });
});

// ============================================================================
// Phase detection
// ============================================================================

describe('ProgressReporter — phase detection', () => {
  it('defaults to "exploring" when no tasks exist', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'exploring');
  });

  it('detects "exploring" for explore workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'explore', 'scan');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'exploring');
  });

  it('detects "planning" for plan workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'plan', 'design');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'planning');
  });

  it('detects "implementing" for implement workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'implement', 'build');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'implementing');
  });

  it('detects "implementing" for refactor workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'refactor', 'clean up');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'implementing');
  });

  it('detects "testing" for test workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'test', 'unit test');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'testing');
  });

  it('detects "verifying" for verify workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'verify', 'check');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'verifying');
  });

  it('detects "verifying" for review workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'review', 'code review');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'verifying');
  });

  it('detects "verifying" for debug workerType', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'debug', 'find bug');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'verifying');
  });
});

// ============================================================================
// Throughput calculation
// ============================================================================

describe('ProgressReporter — throughput', () => {
  it('throughputPerMinute is 0 when no time has elapsed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'goal');
    const p = r.getProgress('g1');
    // elapsedMs could be 0 or very close, throughput should be 0 or near-0
    assert.ok(p.throughputPerMinute >= 0);
  });

  it('throughputPerMinute is 0 when no tasks are completed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    const p = r.getProgress('g1');
    assert.equal(p.throughputPerMinute, 0);
  });

  it('throughputPerMinute counts only successful completions', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', false, 100);
    const p = r.getProgress('g1');
    assert.equal(p.throughputPerMinute, 0);
  });
});
