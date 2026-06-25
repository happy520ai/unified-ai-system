import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import GoalRefiner, { compileGoalV2 } from '../src/goal-refiner/index.js';
import { clearLLMCache } from '../src/llm-client.js';
import {
  createMockStore,
  restoreFetch,
  runRefine,
  successFetch,
  makeTempProject,
} from './p10-goal-refiner-fixtures.js';

// ============================================================================
// 1. GoalRefiner Class Construction
// ============================================================================

describe('GoalRefiner class construction', () => {
  it('creates an instance with default options', () => {
    const refiner = new GoalRefiner();
    assert.ok(refiner instanceof GoalRefiner);
  });

  it('accepts enableReview=false without error', () => {
    const refiner = new GoalRefiner({ enableReview: false });
    assert.ok(refiner instanceof GoalRefiner);
  });

  it('accepts custom maxTokens option', () => {
    const refiner = new GoalRefiner({ maxTokens: 8192 });
    assert.ok(refiner instanceof GoalRefiner);
  });

  it('accepts custom temperature option', () => {
    const refiner = new GoalRefiner({ temperature: 0.7 });
    assert.ok(refiner instanceof GoalRefiner);
  });

  it('accepts all options simultaneously', () => {
    const refiner = new GoalRefiner({
      enableReview: false,
      maxTokens: 4096,
      temperature: 0.5,
    });
    assert.ok(refiner instanceof GoalRefiner);
  });

  it('default export is the GoalRefiner class', () => {
    assert.strictEqual(GoalRefiner, GoalRefiner);
    assert.equal(typeof GoalRefiner, 'function');
  });
});

// ============================================================================
// 2. compileGoalV2 Backward Compatibility
// ============================================================================

describe('compileGoalV2 backward compatibility', () => {
  let tempDir;

  beforeEach(async () => {
    clearLLMCache();
    tempDir = await makeTempProject();
  });

  afterEach(async () => {
    restoreFetch();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('is exported as a named function', () => {
    assert.equal(typeof compileGoalV2, 'function');
  });

  it('returns { goalId, taskCount, summary } shape', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add a config endpoint at src/api/config.js with validation', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.goalId);
    assert.equal(typeof result.taskCount, 'number');
    assert.equal(typeof result.summary, 'string');
  });

  it('calls store.createGoal during compilation', async () => {
    const store = createMockStore();
    await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add config module at src/config/index.js', projectRoot: tempDir },
      successFetch(),
    );
    const goal = store.getGoal('goal-1');
    assert.ok(goal, 'goal should have been created');
    assert.ok(goal.text.includes('config module'));
  });

  it('calls store.logEvent with goal_created event', async () => {
    const store = createMockStore();
    await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add route handler at src/routes/health.js', projectRoot: tempDir },
      successFetch(),
    );
    const events = store.getEvents();
    const created = events.find(e => e.type === 'goal_created');
    assert.ok(created, 'goal_created event should exist');
  });

  it('calls store.insertTaskDAG with tasks and deps', async () => {
    const store = createMockStore();
    await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add logging to src/utils/logger.js', projectRoot: tempDir },
      successFetch(),
    );
    const dags = store.getDags();
    assert.ok(dags.length > 0, 'insertTaskDAG should have been called');
    assert.ok(Array.isArray(dags[0].tasks), 'tasks should be an array');
    assert.ok(Array.isArray(dags[0].deps), 'deps should be an array');
  });

  it('calls store.updateGoalStatus with compiled status', async () => {
    const store = createMockStore();
    await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add parser module at src/parsers/csv.js', projectRoot: tempDir },
      successFetch(),
    );
    const goal = store.getGoal('goal-1');
    assert.equal(goal.status, 'compiled');
  });
});
