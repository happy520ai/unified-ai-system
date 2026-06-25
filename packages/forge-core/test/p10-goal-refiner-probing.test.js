import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';

import GoalRefiner from '../src/goal-refiner/index.js';
import { clearLLMCache } from '../src/llm-client.js';
import {
  createMockStore,
  restoreFetch,
  buildMockDagJson,
  buildMockReviewJson,
  runRefine,
  successFetch,
  failureFetch,
  makeTempProject,
} from './p10-goal-refiner-fixtures.js';

// ============================================================================
// 7. JSON Parsing Robustness (tested through refine behavior)
// ============================================================================

describe('JSON parsing robustness (via refine)', () => {
  let tempDir;

  beforeEach(async () => {
    clearLLMCache();
    tempDir = await makeTempProject();
  });

  afterEach(async () => {
    restoreFetch();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('handles DAG JSON wrapped in markdown code fences', async () => {
    const store = createMockStore();
    const fencedDag = '```json\n' + buildMockDagJson() + '\n```';
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Add markdown renderer at src/renderers/markdown.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: fencedDag } }; },
        async text() { return ''; },
      }),
    );
    assert.ok(result.goalId);
    assert.ok(result.taskCount > 0);
  });

  it('handles DAG JSON wrapped in plain fences (no language tag)', async () => {
    const store = createMockStore();
    const fencedDag = '```\n' + buildMockDagJson() + '\n```';
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Add CSV exporter at src/exporters/csv.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: fencedDag } }; },
        async text() { return ''; },
      }),
    );
    assert.ok(result.goalId);
  });

  it('handles DAG JSON with leading text prefix', async () => {
    const store = createMockStore();
    const prefixedDag = 'Here is the DAG:\n' + buildMockDagJson();
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Add image resizer at src/images/resize.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: prefixedDag } }; },
        async text() { return ''; },
      }),
    );
    assert.ok(result.goalId);
  });

  it('handles DAG JSON with trailing text suffix', async () => {
    const store = createMockStore();
    const suffixedDag = buildMockDagJson() + '\n\nThis should work well.';
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Add queue processor at src/queues/processor.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: suffixedDag } }; },
        async text() { return ''; },
      }),
    );
    assert.ok(result.goalId);
  });

  it('handles DAG JSON with leading and trailing whitespace', async () => {
    const store = createMockStore();
    const paddedDag = '   \n\n  ' + buildMockDagJson() + '  \n\n  ';
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Add slug generator at src/utils/slug.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: paddedDag } }; },
        async text() { return ''; },
      }),
    );
    assert.ok(result.goalId);
  });

  it('handles truncated DAG JSON by best-effort repair', async () => {
    const store = createMockStore();
    const fullDag = buildMockDagJson();
    const truncated = fullDag.slice(0, Math.floor(fullDag.length * 0.85));
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Add template engine at src/templates/engine.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: truncated } }; },
        async text() { return ''; },
      }),
    );
    if (result) {
      assert.ok(result.goalId);
    }
  });

  it('fails gracefully for completely empty LLM response', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    await assert.rejects(
      () => runRefine(
        refiner,
        store,
        { goalText: 'Add something to src/something.js', projectRoot: tempDir },
        failureFetch(),
      ),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      },
    );
  });

  it('fails gracefully for response with no JSON-like content', async () => {
    const store = createMockStore();
    const refiner = new GoalRefiner({ enableReview: false });
    await assert.rejects(
      () => runRefine(
        refiner,
        store,
        { goalText: 'Add feature to src/feature.js', projectRoot: tempDir },
        async () => ({
          ok: true, status: 200,
          async json() {
            return {
              success: true,
              data: { outputText: 'I cannot help with this request at all.' },
            };
          },
          async text() { return ''; },
        }),
      ),
      /failed to parse initial DAG/,
    );
  });
});

// ============================================================================
// 8. Review Merge (tested through refine result with controlled review DAG)
// ============================================================================

describe('review merge (via refine)', () => {
  let tempDir;

  beforeEach(async () => {
    clearLLMCache();
    tempDir = await makeTempProject();
  });

  afterEach(async () => {
    restoreFetch();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('adds a verify task when the initial DAG is missing one', async () => {
    const store = createMockStore();
    const dagWithoutVerify = buildMockDagJson({
      tasks: [
        { id: 't1', name: 'Explore', type: 'explore', agentRole: 'code-archaeologist',
          prompt: 'Explore', dependsOn: [], allowedFiles: ['src/**/*.js'], estimatedMin: 10 },
        { id: 't2', name: 'Plan', type: 'plan', agentRole: 'architect',
          prompt: 'Plan', dependsOn: ['t1'], allowedFiles: ['docs/**/*.md'], estimatedMin: 15 },
        { id: 't3', name: 'Implement', type: 'implement', agentRole: 'coder',
          prompt: 'Code', dependsOn: ['t2'], allowedFiles: ['src/**/*.js'], estimatedMin: 30 },
        { id: 't4', name: 'Test', type: 'test', agentRole: 'tester',
          prompt: 'Test', dependsOn: ['t3'], allowedFiles: ['test/**/*.js'], estimatedMin: 20 },
      ],
    });
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add session handler at src/sessions/handler.js', projectRoot: tempDir },
      successFetch({ tasks: JSON.parse(dagWithoutVerify).tasks }),
    );
    assert.equal(result.dagVersion, 2);
    const dags = store.getDags();
    const hasVerifyTask = dags[0].tasks.some(t => t.type === 'verify');
    assert.ok(hasVerifyTask, 'final DAG should contain a verify task');
  });

  it('adds a test task when implements exist but no test task', async () => {
    const store = createMockStore();
    const dagWithoutTest = buildMockDagJson({
      tasks: [
        { id: 't1', name: 'Explore', type: 'explore', agentRole: 'code-archaeologist',
          prompt: 'Explore', dependsOn: [], allowedFiles: ['src/**/*.js'], estimatedMin: 10 },
        { id: 't2', name: 'Plan', type: 'plan', agentRole: 'architect',
          prompt: 'Plan', dependsOn: ['t1'], allowedFiles: ['docs/**/*.md'], estimatedMin: 15 },
        { id: 't3', name: 'Implement', type: 'implement', agentRole: 'coder',
          prompt: 'Code', dependsOn: ['t2'], allowedFiles: ['src/**/*.js'], estimatedMin: 30 },
        { id: 't4', name: 'Verify', type: 'verify', agentRole: 'verifier',
          prompt: 'Verify', dependsOn: ['t3'], allowedFiles: ['**/*'], estimatedMin: 10 },
      ],
    });
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add migration script at src/db/migrate.js', projectRoot: tempDir },
      successFetch({ tasks: JSON.parse(dagWithoutTest).tasks }),
    );
    const dags = store.getDags();
    const hasTestTask = dags[0].tasks.some(t => t.type === 'test');
    assert.ok(hasTestTask, 'final DAG should contain a test task');
  });

  it('applies missing dependency from review feedback', async () => {
    const store = createMockStore();
    const dagWithMissingDep = buildMockDagJson({
      tasks: [
        { id: 't1', name: 'Explore', type: 'explore', agentRole: 'code-archaeologist',
          prompt: 'Explore', dependsOn: [], allowedFiles: ['src/**/*.js'], estimatedMin: 10 },
        { id: 't2', name: 'Plan', type: 'plan', agentRole: 'architect',
          prompt: 'Plan', dependsOn: ['t1'], allowedFiles: ['docs/**/*.md'], estimatedMin: 15 },
        { id: 't3', name: 'Implement', type: 'implement', agentRole: 'coder',
          prompt: 'Code', dependsOn: ['t1'], allowedFiles: ['src/**/*.js'], estimatedMin: 30 },
        { id: 't4', name: 'Test', type: 'test', agentRole: 'tester',
          prompt: 'Test', dependsOn: ['t3'], allowedFiles: ['test/**/*.js'], estimatedMin: 20 },
        { id: 't5', name: 'Verify', type: 'verify', agentRole: 'verifier',
          prompt: 'Verify', dependsOn: ['t4'], allowedFiles: ['**/*'], estimatedMin: 10 },
      ],
    });
    const reviewWithDepFix = buildMockReviewJson({
      issues: [{
        kind: 'missing_dep',
        taskId: 't3',
        detail: 't3 should depend on t2',
        fix: 'add dependsOn t2',
      }],
      verdict: 'needs_revision',
    });
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add rate limiter at src/middleware/rate-limit.js', projectRoot: tempDir },
      successFetch(
        { tasks: JSON.parse(dagWithMissingDep).tasks },
        JSON.parse(reviewWithDepFix),
      ),
    );
    assert.equal(result.dagVersion, 2, 'dagVersion should be 2 after dep merge');
    const dags = store.getDags();
    const deps = dags[0].deps;
    const t3DependsOnT2 = deps.some(d => d.taskId === 't3' && d.dependsOn === 't2');
    assert.ok(t3DependsOnT2, 't3 should now depend on t2');
  });

  it('adopts revised summary from review', async () => {
    const store = createMockStore();
    const revisedText = 'Revised and improved plan summary v2';
    const reviewWithSummary = buildMockReviewJson({
      issues: [],
      verdict: 'ok',
      revisedSummary: revisedText,
    });
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add webhook handler at src/webhooks/handler.js', projectRoot: tempDir },
      successFetch({}, JSON.parse(reviewWithSummary)),
    );
    assert.equal(result.summary, revisedText);
  });

  it('keeps original summary when review has no revisedSummary', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add cache invalidation at src/cache/invalidate.js', projectRoot: tempDir },
      successFetch({}, { issues: [], verdict: 'ok' }),
    );
    assert.equal(result.summary, 'Mock DAG plan summary');
  });

  it('does not add duplicate verify task when one already exists', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add health check at src/health/check.js with verify step', projectRoot: tempDir },
      successFetch(),
    );
    const dags = store.getDags();
    const verifyTasks = dags[0].tasks.filter(t => t.type === 'verify');
    assert.equal(verifyTasks.length, 1, 'should have exactly one verify task');
  });
});
