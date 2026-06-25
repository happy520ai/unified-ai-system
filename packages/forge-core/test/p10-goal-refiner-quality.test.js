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
  makeTempProject,
} from './p10-goal-refiner-fixtures.js';

// ============================================================================
// 5. Goal Clarity Analysis (tested through clarityScore in refine result)
// ============================================================================

describe('goal clarity analysis (via refine clarityScore)', () => {
  let tempDir;

  beforeEach(async () => {
    clearLLMCache();
    tempDir = await makeTempProject();
  });

  afterEach(async () => {
    restoreFetch();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('short vague goal gets a low clarity score', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Make it better', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.clarityScore <= 45, `expected <= 45, got ${result.clarityScore}`);
  });

  it('very short empty-ish goal gets a low clarity score', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Do it', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.clarityScore < 50, `expected < 50, got ${result.clarityScore}`);
  });

  it('goal with file path gets a higher score than without', async () => {
    const storeA = createMockStore();
    const resultA = await runRefine(
      new GoalRefiner(),
      storeA,
      { goalText: 'Refactor the authentication module for better security', projectRoot: tempDir },
      successFetch(),
    );

    clearLLMCache();

    const storeB = createMockStore();
    const resultB = await runRefine(
      new GoalRefiner(),
      storeB,
      { goalText: 'Refactor the authentication module in src/auth/login.js for better security', projectRoot: tempDir },
      successFetch(),
    );

    assert.ok(resultB.clarityScore > resultA.clarityScore,
      `path goal (${resultB.clarityScore}) should score higher than no-path goal (${resultA.clarityScore})`);
  });

  it('goal with action verb gets a higher score', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add user authentication to src/auth/login.js with session management and password hashing', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.clarityScore >= 50, `expected >= 50, got ${result.clarityScore}`);
  });

  it('goal mentioning function name pattern scores higher', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Fix handleLogin() function in src/auth/handler.js to validate tokens properly before redirect', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.clarityScore >= 50, `expected >= 50, got ${result.clarityScore}`);
  });

  it('long descriptive goal scores higher than short goal', async () => {
    const storeShort = createMockStore();
    const shortResult = await runRefine(
      new GoalRefiner(),
      storeShort,
      { goalText: 'Add tests', projectRoot: tempDir },
      successFetch(),
    );

    clearLLMCache();

    const storeLong = createMockStore();
    const longResult = await runRefine(
      new GoalRefiner(),
      storeLong,
      { goalText: 'Add comprehensive integration tests for the authentication module in test/auth.test.js covering login, logout, and session expiry scenarios', projectRoot: tempDir },
      successFetch(),
    );

    assert.ok(longResult.clarityScore > shortResult.clarityScore,
      `long goal (${longResult.clarityScore}) should outscore short goal (${shortResult.clarityScore})`);
  });

  it('ESM project + require() mention triggers clarification about conflict', async () => {
    const esmDir = await makeTempProject({ type: 'module' });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner(),
        store,
        { goalText: 'Add require() call to src/utils/loader.js for dynamic module loading', projectRoot: esmDir },
        successFetch(),
      );
      assert.ok(
        result.clarifications.some(c => c.toLowerCase().includes('esm')),
        `expected ESM clarification, got: ${JSON.stringify(result.clarifications)}`,
      );
    } finally {
      await rm(esmDir, { recursive: true, force: true });
    }
  });

  it('CJS project + import syntax mention triggers clarification about conflict', async () => {
    const cjsDir = await makeTempProject({ type: 'commonjs' });
    const store = createMockStore();
    try {
      const result = await runRefine(
        new GoalRefiner(),
        store,
        { goalText: 'Add import statement to src/utils/helper.js for better module organization', projectRoot: cjsDir },
        successFetch(),
      );
      assert.ok(
        result.clarifications.some(c => c.toLowerCase().includes('commonjs')),
        `expected CommonJS clarification, got: ${JSON.stringify(result.clarifications)}`,
      );
    } finally {
      await rm(cjsDir, { recursive: true, force: true });
    }
  });

  it('scope too_big keyword triggers splitting clarification', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Redesign the entire system architecture for all microservices in the platform', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(
      result.clarifications.some(c => c.toLowerCase().includes('splitting')),
      `expected splitting clarification, got: ${JSON.stringify(result.clarifications)}`,
    );
  });

  it('scope too_small keyword does not trigger splitting clarification', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Fix a typo in the readme file', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(
      !result.clarifications.some(c => c.toLowerCase().includes('splitting')),
      'should not suggest splitting for a small goal',
    );
  });

  it('normal goal does not trigger splitting clarification', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add user profile page at src/pages/profile.js with avatar upload', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(
      !result.clarifications.some(c => c.toLowerCase().includes('splitting')),
      'should not suggest splitting for a normal-scoped goal',
    );
  });

  it('clarity score is clamped between 0 and 100', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Fix the entire system architecture redesign for all microservices with jQuery in the ESM project using require()', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.clarityScore >= 0, `score should be >= 0, got ${result.clarityScore}`);
    assert.ok(result.clarityScore <= 100, `score should be <= 100, got ${result.clarityScore}`);
  });
});

// ============================================================================
// 6. DAG Quality Scoring (tested through qualityScores in refine result)
// ============================================================================

describe('DAG quality scoring (via refine qualityScores)', () => {
  let tempDir;

  beforeEach(async () => {
    clearLLMCache();
    tempDir = await makeTempProject();
  });

  afterEach(async () => {
    restoreFetch();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('well-structured DAG gets high structure score', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add CRUD endpoints at src/api/users.js with full test coverage', projectRoot: tempDir },
      successFetch(),
    );
    assert.ok(result.qualityScores.structure >= 70,
      `expected structure >= 70, got ${result.qualityScores.structure}`);
  });

  it('DAG starting with explore gets higher structure than one without', async () => {
    const storeGood = createMockStore();
    const goodResult = await runRefine(
      new GoalRefiner({ enableReview: false }),
      storeGood,
      { goalText: 'Add dashboard widget at src/widgets/stats.js', projectRoot: tempDir },
      successFetch(),
    );

    clearLLMCache();

    const storeBad = createMockStore();
    const badDag = buildMockDagJson({
      tasks: [
        { id: 't1', name: 'Plan work', type: 'plan', agentRole: 'architect',
          prompt: 'Plan', dependsOn: [], allowedFiles: ['**/*'], estimatedMin: 10 },
        { id: 't2', name: 'Code changes', type: 'implement', agentRole: 'coder',
          prompt: 'Code', dependsOn: ['t1'], allowedFiles: ['src/**/*.js'], estimatedMin: 20 },
        { id: 't3', name: 'Test code', type: 'test', agentRole: 'tester',
          prompt: 'Test', dependsOn: ['t2'], allowedFiles: ['test/**/*.js'], estimatedMin: 15 },
        { id: 't4', name: 'Verify', type: 'verify', agentRole: 'verifier',
          prompt: 'Verify', dependsOn: ['t3'], allowedFiles: ['**/*'], estimatedMin: 10 },
      ],
    });

    const badResult = await runRefine(
      new GoalRefiner({ enableReview: false }),
      storeBad,
      { goalText: 'Add report module at src/reports/monthly.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: badDag } }; },
        async text() { return ''; },
      }),
    );

    assert.ok(goodResult.qualityScores.structure > badResult.qualityScores.structure,
      `explore-first (${goodResult.qualityScores.structure}) should beat plan-first (${badResult.qualityScores.structure})`);
  });

  it('DAG with both test and verify gets perfect testCoverage', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Add validation to src/validators/schema.js with comprehensive testing', projectRoot: tempDir },
      successFetch(),
    );
    assert.equal(result.qualityScores.testCoverage, 100);
  });

  it('overall score is a weighted combination of sub-scores', async () => {
    const store = createMockStore();
    const result = await runRefine(
      new GoalRefiner(),
      store,
      { goalText: 'Implement feature at src/features/export.js with test and verification steps', projectRoot: tempDir },
      successFetch(),
    );
    const qs = result.qualityScores;
    const expected = Math.round(
      qs.structure * 0.25 +
      qs.coverage * 0.25 +
      qs.parallelism * 0.20 +
      qs.testCoverage * 0.30,
    );
    assert.equal(qs.overall, expected);
  });

  it('DAG without explore gets lower structure score', async () => {
    const store = createMockStore();
    const noExploreDag = buildMockDagJson({
      tasks: [
        { id: 't1', name: 'Plan', type: 'plan', agentRole: 'architect',
          prompt: 'Plan approach', dependsOn: [], allowedFiles: ['**/*'], estimatedMin: 10 },
        { id: 't2', name: 'Implement', type: 'implement', agentRole: 'coder',
          prompt: 'Build it', dependsOn: ['t1'], allowedFiles: ['src/**/*.js'], estimatedMin: 20 },
        { id: 't3', name: 'Verify', type: 'verify', agentRole: 'verifier',
          prompt: 'Check it', dependsOn: ['t2'], allowedFiles: ['**/*'], estimatedMin: 10 },
      ],
    });
    const result = await runRefine(
      new GoalRefiner({ enableReview: false }),
      store,
      { goalText: 'Create API client at src/api/client.js', projectRoot: tempDir },
      async () => ({
        ok: true, status: 200,
        async json() { return { success: true, data: { outputText: noExploreDag } }; },
        async text() { return ''; },
      }),
    );
    assert.ok(result.qualityScores.structure <= 80,
      `expected structure <= 80, got ${result.qualityScores.structure}`);
  });
});
