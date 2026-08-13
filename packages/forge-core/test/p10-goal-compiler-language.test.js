import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { compileGoal } from '../src/goal-compiler/index.js';

const ORIGINAL_FETCH = globalThis.fetch;

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
}

function mockFetchForJson(jsonPayload) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        success: true,
        data: { outputText: jsonPayload, selectedProvider: 'mock' },
      };
    },
    async text() {
      return '';
    },
  });
}

function dagWithAllowedFiles(allowedFiles, constraints = [], goalType = 'goal') {
  return JSON.stringify({
    tasks: [
      {
        id: 't1',
        name: `${goalType} explorer`,
        type: 'explore',
        agentRole: 'code-archaeologist',
        prompt: `Explore ${goalType} files`,
        dependsOn: [],
        allowedFiles: ['docs/**/*.md'],
        constraints,
      },
      {
        id: 't2',
        name: `${goalType} implementer`,
        type: 'implement',
        agentRole: 'coder',
        prompt: `Implement ${goalType} change`,
        dependsOn: ['t1'],
        allowedFiles,
      },
    ],
    checkpoints: ['after_t2'],
    rollbackPoints: ['before_t2'],
    summary: `${goalType} summary`,
  });
}

function createMockStore() {
  const goals = new Map();
  const dags = [];
  let goalCounter = 0;
  return {
    createGoal({ text, projectRoot, budget }) {
      const id = `g-${++goalCounter}`;
      goals.set(id, { id, text, projectRoot, budget, status: 'pending' });
      return id;
    },
    logEvent() {},
    updateGoalStatus(id, status, payload) {
      const goal = goals.get(id);
      if (goal) {
        goal.status = status;
        if (payload !== undefined) goal.payload = payload;
      }
    },
    insertTaskDAG(goalId, tasks, deps) {
      dags.push({ goalId, tasks, deps });
    },
    getGoals() { return goals; },
    getDags() { return dags; },
  };
}

async function makeProjectWithFiles(structure) {
  const dir = await mkdtemp(join(tmpdir(), 'goal-compiler-lang-test-'));
  for (const file of structure) {
    const fullPath = join(dir, file);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, 'content');
  }
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'test-proj', version: '1.0.0' }));
  return dir;
}

describe('legacy compileGoal language propagation', () => {
  it('injects inferred language and constraints for implement tasks', async () => {
    const store = createMockStore();
    const projectRoot = await makeProjectWithFiles(['src/app.js', 'README.md']);
    globalThis.fetch = mockFetchForJson(dagWithAllowedFiles(['src/**/*.js']));

    try {
      const result = await compileGoal(store, { goalText: 'Add a logger', projectRoot });
      assert.ok(result.goalId);
      const dags = store.getDags();
      assert.equal(dags.length, 1);
      assert.equal(dags[0].tasks.length >= 2, true);
      const implementTask = dags[0].tasks.find(task => task.type === 'implement');
      assert.equal(implementTask?.language, 'js');
      assert.ok(
        implementTask?.constraints?.some((text) => text.includes('Default implementation language')),
        'implement task should receive language constraints',
      );
    } finally {
      restoreFetch();
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('infers task language from allowedFiles when project has mixed languages', async () => {
    const store = createMockStore();
    const projectRoot = await makeProjectWithFiles(['src/app.py', 'src/index.ts', 'docs/guide.md']);
    globalThis.fetch = mockFetchForJson(dagWithAllowedFiles(['src/**/*.py'], [], 'pythonic'));

    try {
      const result = await compileGoal(store, { goalText: 'Refactor python utilities', projectRoot });
      assert.ok(result.goalId);
      const dags = store.getDags();
      const implementTask = dags[0].tasks.find(task => task.type === 'implement');
      assert.equal(implementTask?.language, 'python');
      assert.ok(
        implementTask?.constraints?.some((text) => text.includes('Primary task language')),
        'language-specific constraint should be added',
      );
    } finally {
      restoreFetch();
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
