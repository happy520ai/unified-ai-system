/**
 * E2E Cost & Trace Tests - Tests 8-9
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CostAttribution } from '../src/cost-attribution/index.js';
import { DecisionTrace } from '../src/decision-trace/index.js';

describe('E2E Cost & Trace', () => {
  it('Cost attribution records actual usage', () => {
    const costTracker = new CostAttribution();
    const trace = new DecisionTrace();

    const goalId = 'goal-e2e-001';

    costTracker.record({
      goalId,
      taskId: 'task-1',
      workerType: 'coder',
      model: 'mimo-v2.5-pro',
      inputTokens: 5000,
      outputTokens: 2000,
      cost: 0.0027,
      duration: 1200,
    });

    trace.record({
      goalId,
      taskId: 'task-1',
      workerType: 'coder',
      decision: 'tool_choice',
      action: { tool: 'write', path: 'src/feature.js' },
      reasoning: 'Implementing the requested feature',
      outcome: 'success',
      confidence: 85,
    });

    costTracker.record({
      goalId,
      taskId: 'task-2',
      workerType: 'tester',
      model: 'mimo-v2.5-pro',
      inputTokens: 3000,
      outputTokens: 1500,
      cost: 0.0018,
      duration: 800,
    });

    trace.record({
      goalId,
      taskId: 'task-2',
      workerType: 'tester',
      decision: 'tool_choice',
      action: { tool: 'write', path: 'test/feature.test.js' },
      reasoning: 'Writing tests for the feature',
      outcome: 'success',
      confidence: 90,
    });

    costTracker.record({
      goalId,
      taskId: 'task-3',
      workerType: 'reviewer',
      model: 'deepseek-v3',
      inputTokens: 8000,
      outputTokens: 1000,
      duration: 2000,
    });

    const goalCost = costTracker.getGoalCost(goalId);
    assert.strictEqual(goalCost.tasks, 3, 'Goal should have 3 tasks');
    assert.ok(goalCost.totalCost > 0, 'Total cost should be positive');
    assert.strictEqual(goalCost.inputTokens, 16000, 'Total input tokens should be 16000');
    assert.strictEqual(goalCost.outputTokens, 4500, 'Total output tokens should be 4500');

    const byWorker = costTracker.getCostByWorker();
    assert.ok(byWorker['coder'], 'Should have coder worker costs');
    assert.ok(byWorker['tester'], 'Should have tester worker costs');
    assert.ok(byWorker['reviewer'], 'Should have reviewer worker costs');
    assert.strictEqual(byWorker['coder'].count, 1);
    assert.strictEqual(byWorker['tester'].count, 1);

    const byModel = costTracker.getCostByModel();
    assert.ok(byModel['mimo-v2.5-pro'], 'Should have mimo model costs');

    const task1Cost = costTracker.getTaskCost('task-1');
    assert.strictEqual(task1Cost.inputTokens, 5000);
    assert.strictEqual(task1Cost.cost, 0.0027);

    const totalCost = costTracker.getTotalCost();
    assert.strictEqual(totalCost.goals, 1, 'Should have 1 goal');
    assert.strictEqual(totalCost.tasks, 3, 'Should have 3 tasks total');

    const goalDecisions = trace.getGoalDecisions(goalId);
    assert.strictEqual(goalDecisions.length, 2, 'Should have 2 decision records for this goal');

    const traceStats = trace.getStats({ goalId });
    assert.strictEqual(traceStats.total, 2);
    assert.strictEqual(traceStats.byOutcome.success, 2, 'Both decisions should be successes');
  });

  it('Decision trace records task outcomes', () => {
    const trace = new DecisionTrace({ maxEntries: 100 });
    const goalId = 'goal-trace-001';
    const taskId = 'task-trace-001';

    trace.record({
      goalId,
      taskId,
      workerType: 'coder',
      decision: 'strategy_selection',
      action: { strategy: 'incremental-edit' },
      reasoning: 'Small change, incremental approach is safest',
      alternatives: [{ strategy: 'full-rewrite' }, { strategy: 'patch' }],
      outcome: 'success',
      confidence: 80,
      tags: ['strategy'],
    });

    trace.record({
      goalId,
      taskId,
      workerType: 'coder',
      decision: 'tool_choice',
      action: { tool: 'edit', path: 'src/index.js' },
      reasoning: 'Need to modify the main entry point',
      outcome: 'success',
      confidence: 90,
      tags: ['tool'],
    });

    trace.record({
      goalId,
      taskId,
      workerType: 'coder',
      decision: 'file_modification',
      action: { path: 'src/index.js', type: 'edit', lines: '10-15' },
      reasoning: 'Adding import statement and new function call',
      outcome: 'success',
      confidence: 85,
      tags: ['file'],
    });

    trace.record({
      goalId,
      taskId,
      workerType: 'coder',
      decision: 'error_handling',
      action: { error: 'SyntaxError', recovery: 'rollback' },
      reasoning: 'Edit introduced syntax error, rolling back',
      outcome: 'failure',
      confidence: 60,
      tags: ['error'],
    });

    trace.record({
      goalId,
      taskId,
      workerType: 'coder',
      decision: 'retry_decision',
      action: { retryWith: 'different-approach', attempt: 2 },
      reasoning: 'Trying a different approach after rollback',
      outcome: 'success',
      confidence: 75,
      tags: ['retry'],
    });

    const timeline = trace.getTimeline({ taskId });
    assert.strictEqual(timeline.length, 5, 'Should have 5 decisions in timeline');

    const failures = trace.getFailures({ goalId });
    assert.strictEqual(failures.length, 1, 'Should have 1 failure');
    assert.strictEqual(failures[0].decision, 'error_handling');

    const annotated = trace.annotate(failures[0].id, {
      note: 'The edit introduced an unclosed bracket',
      correctedAction: 'Should have validated syntax before applying edit',
      severity: 'warning',
    });
    assert.strictEqual(annotated, true, 'Annotation should succeed');

    const updatedDecisions = trace.getTaskDecisions(taskId);
    const failureEntry = updatedDecisions.find((d) => d.outcome === 'failure');
    assert.strictEqual(failureEntry.annotations.length, 1, 'Failure should have 1 annotation');
    assert.strictEqual(failureEntry.annotations[0].severity, 'warning');

    const stats = trace.getStats({ goalId });
    assert.strictEqual(stats.total, 5);
    assert.strictEqual(stats.byOutcome.success, 4);
    assert.strictEqual(stats.byOutcome.failure, 1);
    assert.ok(stats.avgConfidence > 0, 'Average confidence should be positive');

    const toolChoices = trace.search({ decision: 'tool_choice', workerType: 'coder' });
    assert.strictEqual(toolChoices.length, 1);
    assert.strictEqual(toolChoices[0].action.tool, 'edit');
  });
});
