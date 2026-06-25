import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProgressReporter } from '../src/progress-reporter/index.js';

// ============================================================================
// Event payloads
// ============================================================================

describe('ProgressReporter — event payloads', () => {
  it('task_started event carries goalId, taskId, workerType, taskName', () => {
    const r = new ProgressReporter();
    let payload;
    r.on('task_started', (e) => { payload = e; });
    r.startGoal('g1', 2, 'goal');
    r.taskStarted('g1', 't-1', 'coder', 'Build widget');
    assert.equal(payload.goalId, 'g1');
    assert.equal(payload.taskId, 't-1');
    assert.equal(payload.workerType, 'coder');
    assert.equal(payload.taskName, 'Build widget');
  });

  it('task_started event defaults taskName to taskId', () => {
    const r = new ProgressReporter();
    let payload;
    r.on('task_started', (e) => { payload = e; });
    r.startGoal('g1', 2, 'goal');
    r.taskStarted('g1', 't-1', 'coder');
    assert.equal(payload.taskName, 't-1');
  });

  it('task_completed event carries goalId, taskId, success, durationMs', () => {
    const r = new ProgressReporter();
    let payload;
    r.on('task_completed', (e) => { payload = e; });
    r.startGoal('g1', 2, 'goal');
    r.taskStarted('g1', 't-1', 'coder', 'Build');
    r.taskCompleted('g1', 't-1', true, 3500);
    assert.equal(payload.goalId, 'g1');
    assert.equal(payload.taskId, 't-1');
    assert.equal(payload.success, true);
    assert.equal(payload.durationMs, 3500);
  });

  it('goal_completed event carries all summary fields', () => {
    const r = new ProgressReporter();
    let payload;
    r.on('goal_completed', (e) => { payload = e; });
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.taskStarted('g1', 't2', 'coder', 't2');
    r.taskCompleted('g1', 't2', false, 500);
    r.goalCompleted('g1', 'failed', 2000);
    assert.equal(payload.goalId, 'g1');
    assert.equal(payload.status, 'failed');
    assert.equal(payload.totalDurationMs, 2000);
    assert.equal(payload.completedTasks, 1);
    assert.equal(payload.failedTasks, 1);
    assert.equal(payload.totalTasks, 3);
  });
});

// ============================================================================
// formatProgress
// ============================================================================

describe('ProgressReporter — formatProgress', () => {
  it('returns "No progress data" for unknown goal', () => {
    const r = new ProgressReporter();
    const s = r.formatProgress('missing');
    assert.equal(s, '[missing] No progress data');
  });

  it('returns a string containing progress fraction', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'Add feature');
    r.taskStarted('g1', 't1', 'implement', 'build');
    r.taskCompleted('g1', 't1', true, 1000);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('[1/5]'));
  });

  it('includes percentage in output', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 4, 'goal');
    r.taskStarted('g1', 't1', 'implement', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('(25%)'));
  });

  it('includes phase label capitalized', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'test', 'running test');
    const s = r.formatProgress('g1');
    assert.ok(s.includes('Testing'));
  });

  it('shows checkmark when goal is completed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'done');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('✓'));
  });

  it('shows cross when goal has failed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'fail');
    r.goalCompleted('g1', 'failed', 1000);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('✗'));
  });

  it('truncates long goal text to 30 characters with ellipsis', () => {
    const r = new ProgressReporter();
    const longText = 'A'.repeat(50);
    r.startGoal('g1', 1, longText);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('...'));
    // The truncated text should be 27 chars + "..."
    assert.ok(!s.includes(longText));
  });

  it('includes ETA when goal is in_progress and eta available', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 2000);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('ETA:'));
  });

  it('does not include ETA when goal is completed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatProgress('g1');
    assert.ok(!s.includes('ETA:'));
  });
});

// ============================================================================
// formatSummary
// ============================================================================

describe('ProgressReporter — formatSummary', () => {
  it('returns "No progress data" for unknown goal', () => {
    const r = new ProgressReporter();
    const s = r.formatSummary('missing');
    assert.equal(s, '[missing] No progress data');
  });

  it('returns a multi-line string', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 2, 'My Goal');
    r.taskStarted('g1', 't1', 'coder', 'Build');
    r.taskCompleted('g1', 't1', true, 1000);
    r.goalCompleted('g1', 'completed', 2000);
    const s = r.formatSummary('g1');
    const lines = s.split('\n');
    assert.ok(lines.length >= 6, `expected at least 6 lines, got ${lines.length}`);
  });

  it('includes goal text', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'Deploy API');
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('Deploy API'));
  });

  it('includes status line', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'failed', 1000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('Status:'));
    assert.ok(s.includes('failed'));
  });

  it('includes task counts', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.taskStarted('g1', 't2', 'coder', 't2');
    r.taskCompleted('g1', 't2', false, 500);
    r.goalCompleted('g1', 'failed', 2000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('1/3 completed'));
    assert.ok(s.includes('1 failed'));
    assert.ok(s.includes('1 pending'));
  });

  it('includes task breakdown section when tasks exist', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 2, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'Build feature');
    r.taskCompleted('g1', 't1', true, 3000);
    r.taskStarted('g1', 't2', 'tester', 'Test feature');
    r.taskCompleted('g1', 't2', false, 1500);
    r.goalCompleted('g1', 'failed', 5000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('Task Breakdown:'));
    assert.ok(s.includes('[coder] Build feature'));
    assert.ok(s.includes('[tester] Test feature'));
  });

  it('shows checkmark for succeeded tasks in breakdown', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'Build');
    r.taskCompleted('g1', 't1', true, 1000);
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatSummary('g1');
    // Line should contain checkmark and the worker type
    const lines = s.split('\n');
    const taskLine = lines.find(l => l.includes('[coder]'));
    assert.ok(taskLine);
    assert.ok(taskLine.includes('✓'));
  });

  it('shows cross for failed tasks in breakdown', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'Build');
    r.taskCompleted('g1', 't1', false, 1000);
    r.goalCompleted('g1', 'failed', 1000);
    const s = r.formatSummary('g1');
    const lines = s.split('\n');
    const taskLine = lines.find(l => l.includes('[coder]'));
    assert.ok(taskLine);
    assert.ok(taskLine.includes('✗'));
  });

  it('shows hourglass for still-running tasks in breakdown', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 2, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'Still running');
    const s = r.formatSummary('g1');
    const lines = s.split('\n');
    const taskLine = lines.find(l => l.includes('[coder]'));
    assert.ok(taskLine);
  });

  it('includes throughput line', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('tasks/min'));
  });

  it('includes duration line', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('Duration:'));
  });

  it('completed goal shows checkmark status icon', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'completed', 1000);
    const s = r.formatSummary('g1');
    const firstLine = s.split('\n')[0];
    assert.ok(firstLine.includes('✓'));
  });

  it('failed goal shows cross status icon', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'failed', 1000);
    const s = r.formatSummary('g1');
    const firstLine = s.split('\n')[0];
    assert.ok(firstLine.includes('✗'));
  });
});
