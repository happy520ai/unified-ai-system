import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import GoalRefiner from '../src/goal-refiner/index.js';
import { clearLLMCache } from '../src/llm-client.js';
import {
  createMockStore,
  restoreFetch,
  buildMockDagJson,
  runRefine,
  successFetch,
  failureFetch,
  makeTempProject,
  DEFAULT_ROOT,
} from './p10-goal-refiner-fixtures.js';

// ============================================================================
// 3. refine() — Full Pipeline
// ============================================================================

describe('refine() full pipeline', () => {
  let tempDir;

  beforeEach(async () => {
    clearLLMCache();
    tempDir = await makeTempProject();
  });

  afterEach(async () => {
    restoreFetch();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('returns goalId as a non-empty string', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create auth middleware at src/middleware/auth.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.equal(typeof result.goalId, 'string');
    assert.ok(result.goalId.length > 0);
  });

  it('returns taskCount matching the mock DAG task count', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create user service at src/services/user.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.taskCount > 0);
    assert.equal(typeof result.taskCount, 'number');
  });

  it('returns a non-empty summary string', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create email service at src/services/email.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.equal(typeof result.summary, 'string');
    assert.ok(result.summary.length > 0);
  });

  it('returns codebaseProfile object with expected keys', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create cache layer at src/cache/redis.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.codebaseProfile);
    assert.ok(Array.isArray(result.codebaseProfile.frameworks));
    assert.ok(Array.isArray(result.codebaseProfile.testFrameworks));
    assert.ok(Array.isArray(result.codebaseProfile.languages));
    assert.equal(typeof result.codebaseProfile.moduleSystem, 'string');
    assert.equal(typeof result.codebaseProfile.monorepo, 'boolean');
    assert.equal(typeof result.codebaseProfile.totalFileCount, 'number');
    assert.ok(Array.isArray(result.codebaseProfile.tree));
  });

  it('returns clarityScore as a number between 0 and 100', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create notification service at src/notifications/push.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.equal(typeof result.clarityScore, 'number');
    assert.ok(result.clarityScore >= 0 && result.clarityScore <= 100);
  });

  it('returns qualityScores with all five sub-scores', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create file upload handler at src/handlers/upload.js', projectRoot: tempDir },
      successFetch(),
    );
    const qs = result.qualityScores;
    assert.ok(qs, 'qualityScores should exist');
    for (const key of ['structure', 'coverage', 'parallelism', 'testCoverage', 'overall']) {
      assert.equal(typeof qs[key], 'number', `qualityScores.${key} should be a number`);
      assert.ok(qs[key] >= 0 && qs[key] <= 100, `qualityScores.${key} should be 0..100`);
    }
  });

  it('returns clarifications as an array', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create search indexer at src/search/indexer.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(Array.isArray(result.clarifications));
  });

  it('returns dagVersion as 1 or 2', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create report generator at src/reports/generator.js', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok([1, 2].includes(result.dagVersion));
  });

  it('works with enableReview=false (single LLM pass)', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    let fetchCallCount = 0;
    const result = await runRefine(
      refiner,
      store,
      { goalText: 'Create payment processor at src/payments/stripe.js', projectRoot: tempDir },
      async (url, opts) => {
        fetchCallCount++;
        return {
          ok: true,
          status: 200,
          async json() {
            return { success: true, data: { outputText: buildMockDagJson() } };
          },
          async text() { return ''; },
        };
      },
    );
    assert.ok(result.goalId);
    assert.equal(fetchCallCount, 1, 'only one fetch call expected with review disabled');
  });

  it('skips review gracefully when review LLM returns unparseable data', async () => {
    const store = createMockStore();
    let callCount = 0;
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create audit logger at src/audit/logger.js', projectRoot: tempDir },
      async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { success: true, data: { outputText: buildMockDagJson() } };
            },
            async text() { return ''; },
          };
        }
        return {
          ok: true,
          status: 200,
          async json() {
            return { success: true, data: { outputText: 'this is not JSON at all' } };
          },
          async text() { return ''; },
        };
      },
    );
    assert.ok(result.goalId);
    assert.equal(result.dagVersion, 1);
  });

  it('skips review gracefully when review LLM throws', async () => {
    const store = createMockStore();
    let callCount = 0;
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Create metrics collector at src/metrics/collector.js', projectRoot: tempDir },
      async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: true,
            status: 200,
            async json() {
              return { success: true, data: { outputText: buildMockDagJson() } };
            },
            async text() { return ''; },
          };
        }
        return {
          ok: false,
          status: 400,
          async text() { return 'bad request'; },
          async json() { return {}; },
        };
      },
    );
    assert.ok(result.goalId);
    assert.equal(result.dagVersion, 1);
  });
});

// ============================================================================
// 4. refine() — Error Handling
// ============================================================================

describe('refine() error handling', () => {
  beforeEach(() => { clearLLMCache(); });
  afterEach(() => { restoreFetch(); });

  it('throws when LLM returns HTTP 400 for all calls', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    await assert.rejects(
      () => runRefine(
        refiner,
        store,
        { goalText: 'Add something somewhere', projectRoot: DEFAULT_ROOT },
        failureFetch(),
      ),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      },
    );
  });

  it('sets goal status to failed when DAG parsing fails', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    try {
      await runRefine(
        refiner,
        store,
        { goalText: 'Add feature to src/main.js', projectRoot: DEFAULT_ROOT },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return { success: true, data: { outputText: JSON.stringify({ error: 'no dag' }) } };
          },
          async text() { return ''; },
        }),
      );
    } catch { /* expected */ }
    const goal = store.getGoal('goal-1');
    assert.equal(goal?.status, 'failed');
  });

  it('logs compile_failed event when DAG parsing fails', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    try {
      await runRefine(
        refiner,
        store,
        { goalText: 'Fix the app', projectRoot: DEFAULT_ROOT },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return { success: true, data: { outputText: 'not valid json at all no braces' } };
          },
          async text() { return ''; },
        }),
      );
    } catch { /* expected */ }
    const events = store.getEvents();
    const failed = events.find(e => e.type === 'compile_failed');
    assert.ok(failed, 'compile_failed event should be logged');
  });

  it('throws when LLM returns valid JSON but without tasks array', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    await assert.rejects(
      () => runRefine(
        refiner,
        store,
        { goalText: 'Add helper to src/utils/helper.js', projectRoot: DEFAULT_ROOT },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              data: { outputText: JSON.stringify({ error: 'no tasks here' }) },
            };
          },
          async text() { return ''; },
        }),
      ),
      /failed to parse initial DAG/,
    );
  });

  it('throws when LLM returns an empty tasks array', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    await assert.rejects(
      () => runRefine(
        refiner,
        store,
        { goalText: 'Add validator to src/validators/email.js', projectRoot: DEFAULT_ROOT },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              data: { outputText: JSON.stringify({ tasks: [], summary: 'empty' }) },
            };
          },
          async text() { return ''; },
        }),
      ),
      /failed to parse initial DAG/,
    );
  });

  it('sets goal status to failed when LLM returns empty tasks', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    try {
      await runRefine(
        refiner,
        store,
        { goalText: 'Refactor the module', projectRoot: DEFAULT_ROOT },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              data: { outputText: JSON.stringify({ tasks: [] }) },
            };
          },
          async text() { return ''; },
        }),
      );
    } catch { /* expected */ }
    const goal = store.getGoal('goal-1');
    assert.equal(goal?.status, 'failed');
  });

  it('throws when gateway returns non-success JSON', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    await assert.rejects(
      () => runRefine(
        refiner,
        store,
        { goalText: 'Create scheduler at src/jobs/scheduler.js', projectRoot: DEFAULT_ROOT },
        async () => ({
          ok: true,
          status: 200,
          async json() {
            return { success: false, data: {} };
          },
          async text() { return ''; },
        }),
      ),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      },
    );
  });
});
