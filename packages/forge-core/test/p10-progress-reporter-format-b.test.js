import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProgressReporter } from '../src/progress-reporter/index.js';

// ============================================================================
// getTrackedGoalIds / removeGoal / clear
// ============================================================================

describe('ProgressReporter — getTrackedGoalIds / removeGoal / clear', () => {
  it('getTrackedGoalIds returns all registered goal ids', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'a');
    r.startGoal('g2', 2, 'b');
    r.startGoal('g3', 3, 'c');
    const ids = r.getTrackedGoalIds();
    assert.deepEqual(ids.sort(), ['g1', 'g2', 'g3']);
  });

  it('removeGoal removes a single goal', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'a');
    r.startGoal('g2', 2, 'b');
    r.removeGoal('g1');
    assert.deepEqual(r.getTrackedGoalIds(), ['g2']);
    assert.equal(r.getProgress('g1'), null);
  });

  it('removeGoal on non-existent goal is a no-op', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'a');
    r.removeGoal('non-existent');
    assert.deepEqual(r.getTrackedGoalIds(), ['g1']);
  });

  it('clear() removes all goals', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'a');
    r.startGoal('g2', 2, 'b');
    r.clear();
    assert.deepEqual(r.getTrackedGoalIds(), []);
    assert.equal(r.getProgress('g1'), null);
    assert.equal(r.getProgress('g2'), null);
  });

  it('clear() on empty reporter is safe', () => {
    const r = new ProgressReporter();
    r.clear();
    assert.deepEqual(r.getTrackedGoalIds(), []);
  });
});

// ============================================================================
// Edge cases — operations on non-existent goals
// ============================================================================

describe('ProgressReporter — edge cases', () => {
  it('taskStarted on non-existent goal is a no-op', () => {
    const r = new ProgressReporter();
    // Should not throw
    r.taskStarted('no-goal', 't1', 'coder', 'task');
  });

  it('taskCompleted on non-existent goal is a no-op', () => {
    const r = new ProgressReporter();
    r.taskCompleted('no-goal', 't1', true, 1000);
  });

  it('goalCompleted on non-existent goal is a no-op', () => {
    const r = new ProgressReporter();
    r.goalCompleted('no-goal', 'completed', 1000);
  });

  it('startGoal overwrites a previous goal with the same id', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'first');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.startGoal('g1', 3, 'second');
    const p = r.getProgress('g1');
    assert.equal(p.goalText, 'second');
    assert.equal(p.totalTasks, 3);
    assert.equal(p.tasks.length, 0);
  });

  it('multiple goals can be tracked simultaneously', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 2, 'first');
    r.startGoal('g2', 3, 'second');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.taskStarted('g2', 't1', 'tester', 't1');
    const p1 = r.getProgress('g1');
    const p2 = r.getProgress('g2');
    assert.equal(p1.completedTasks, 1);
    assert.equal(p2.completedTasks, 0);
    assert.equal(p2.tasks[0].workerType, 'tester');
  });

  it('formatProgress shows spinner for in_progress goal', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'goal');
    const s = r.formatProgress('g1');
    // Spinner frames are from the set ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const firstChar = s.charAt(0);
    assert.ok(spinnerFrames.includes(firstChar), `Expected spinner char, got "${firstChar}"`);
  });

  it('formatProgress shows ⊘-like icon for cancelled/budget_exceeded', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.goalCompleted('g1', 'budget_exceeded', 1000);
    const s = r.formatProgress('g1');
    assert.ok(s.includes('✗'));
  });

  it('formatSummary for cancelled goal shows appropriate status', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'cancelled', 1000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('cancelled'));
  });

  it('formatSummary for in_progress goal shows ⊘ icon', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'In progress goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    const s = r.formatSummary('g1');
    const firstLine = s.split('\n')[0];
    assert.ok(firstLine.includes('⊘'));
  });
});

// ============================================================================
// ETA calculation
// ============================================================================

describe('ProgressReporter — ETA calculation', () => {
  it('etaMs is null when no tasks completed yet', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 5, 'goal');
    const p = r.getProgress('g1');
    assert.equal(p.etaMs, null);
  });

  it('etaMs is null when all tasks are done (no pending)', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    const p = r.getProgress('g1');
    assert.equal(p.etaMs, null);
  });

  it('etaMs is based on average successful task duration * pending', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 4, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 2000);
    r.taskStarted('g1', 't2', 'coder', 't2');
    r.taskCompleted('g1', 't2', true, 4000);
    // avg = 3000ms, pending = 2, eta = 6000ms
    const p = r.getProgress('g1');
    assert.equal(p.etaMs, 6000);
  });

  it('etaMs ignores failed task durations in average', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 5000);
    r.taskStarted('g1', 't2', 'coder', 't2');
    r.taskCompleted('g1', 't2', false, 100);
    // only 1 success at 5000ms, pending = 1, eta = 5000
    const p = r.getProgress('g1');
    assert.equal(p.etaMs, 5000);
  });

  it('etaMs is null when goal is not in_progress', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 1000);
    r.goalCompleted('g1', 'completed', 1000);
    // Even though pending > 0 and completedTasks > 0, status is 'completed'
    const p = r.getProgress('g1');
    assert.equal(p.etaMs, null);
  });
});

// ============================================================================
// Status transitions
// ============================================================================

describe('ProgressReporter — status transitions', () => {
  it('status starts as in_progress', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    assert.equal(r.getProgress('g1').status, 'in_progress');
  });

  it('status transitions to completed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'completed', 1000);
    assert.equal(r.getProgress('g1').status, 'completed');
  });

  it('status transitions to failed', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'failed', 1000);
    assert.equal(r.getProgress('g1').status, 'failed');
  });

  it('status transitions to budget_exceeded', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'budget_exceeded', 1000);
    assert.equal(r.getProgress('g1').status, 'budget_exceeded');
  });

  it('status transitions to cancelled', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.goalCompleted('g1', 'cancelled', 1000);
    assert.equal(r.getProgress('g1').status, 'cancelled');
  });
});

// ============================================================================
// Phase detection — edge cases
// ============================================================================

describe('ProgressReporter — phase detection edge cases', () => {
  it('running tasks take priority over completed tasks for phase', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 4, 'goal');
    r.taskStarted('g1', 't1', 'implement', 'build');
    r.taskCompleted('g1', 't1', true, 1000);
    // Now a test task is running — phase should be testing
    r.taskStarted('g1', 't2', 'test', 'run tests');
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'testing');
  });

  it('falls back to completed tasks when nothing is running', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'implement', 'build');
    r.taskCompleted('g1', 't1', true, 1000);
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'implementing');
  });

  it('falls back to "exploring" for unrecognized workerTypes', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 3, 'goal');
    r.taskStarted('g1', 't1', 'misc_worker', 'something');
    r.taskCompleted('g1', 't1', true, 1000);
    const p = r.getProgress('g1');
    assert.equal(p.currentPhase, 'exploring');
  });
});

// ============================================================================
// Duration formatting (tested indirectly through formatProgress / formatSummary)
// ============================================================================

describe('ProgressReporter — duration formatting (indirect)', () => {
  it('sub-second durations render as ms', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'quick');
    r.taskCompleted('g1', 't1', true, 500);
    r.goalCompleted('g1', 'completed', 500);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('500ms'));
  });

  it('durations under a minute render as seconds', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'task');
    r.taskCompleted('g1', 't1', true, 30000);
    r.goalCompleted('g1', 'completed', 30000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('30s'));
  });

  it('durations under an hour render as minutes and seconds', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'task');
    r.taskCompleted('g1', 't1', true, 125000); // 2m 5s
    r.goalCompleted('g1', 'completed', 125000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('2m 5s'));
  });

  it('exact minute durations render without seconds', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'task');
    r.taskCompleted('g1', 't1', true, 120000); // exactly 2m
    r.goalCompleted('g1', 'completed', 120000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('2m'));
    assert.ok(!s.includes('2m 0s'));
  });

  it('durations over an hour render as hours and minutes', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'long task');
    r.taskCompleted('g1', 't1', true, 3_720_000); // 1h 2m
    r.goalCompleted('g1', 'completed', 3_720_000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('1h 2m'));
  });

  it('exact hour durations render without minutes', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 'very long');
    r.taskCompleted('g1', 't1', true, 7_200_000); // exactly 2h
    r.goalCompleted('g1', 'completed', 7_200_000);
    const s = r.formatSummary('g1');
    assert.ok(s.includes('2h'));
    assert.ok(!s.includes('2h 0m'));
  });
});

// ============================================================================
// taskCompleted duration fallback
// ============================================================================

describe('ProgressReporter — taskCompleted duration fallback', () => {
  it('uses provided durationMs when given', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, 9999);
    const p = r.getProgress('g1');
    assert.equal(p.tasks[0].durationMs, 9999);
  });

  it('falls back to elapsed time when durationMs is null', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'goal');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.taskCompleted('g1', 't1', true, null);
    const p = r.getProgress('g1');
    // durationMs should be computed from timestamps (>=0)
    assert.ok(p.tasks[0].durationMs >= 0);
  });

  it('falls back to 0 in event payload when durationMs null and no task record', () => {
    const r = new ProgressReporter();
    let payload;
    r.on('task_completed', (e) => { payload = e; });
    r.startGoal('g1', 1, 'goal');
    // Complete without starting — no task record exists
    r.taskCompleted('g1', 'ghost', true, null);
    // durationMs should be 0 because there's no task record
    assert.equal(payload.durationMs, 0);
  });
});

// ============================================================================
// Reusing reporter after clear
// ============================================================================

describe('ProgressReporter — reuse after clear', () => {
  it('can start new goals after clear()', () => {
    const r = new ProgressReporter();
    r.startGoal('g1', 1, 'old');
    r.clear();
    r.startGoal('g2', 2, 'new');
    assert.deepEqual(r.getTrackedGoalIds(), ['g2']);
    const p = r.getProgress('g2');
    assert.equal(p.goalText, 'new');
    assert.equal(p.totalTasks, 2);
  });

  it('event listeners survive clear()', () => {
    const r = new ProgressReporter();
    const events = [];
    r.on('task_started', (e) => events.push(e));
    r.startGoal('g1', 1, 'old');
    r.taskStarted('g1', 't1', 'coder', 't1');
    r.clear();
    r.startGoal('g2', 1, 'new');
    r.taskStarted('g2', 't1', 'coder', 't1');
    assert.equal(events.length, 2);
  });
});
