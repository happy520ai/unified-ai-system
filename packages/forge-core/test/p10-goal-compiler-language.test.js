import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { compileGoal } from '../src/goal-compiler/index.js';
import {
  getLanguageFileExtension,
  inferPreferredLanguage,
  inferTaskLanguage,
  resolveLanguageProfile,
} from '../src/goal-refiner/helpers.js';
import {
  buildGenerationPrompt,
  scoreCodeQuality,
} from '../src/iterative-refiner/helpers.js';
import { buildPrompt } from '../src/worker/base-prompt-utils.js';

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
        implementTask?.constraints?.some((text) => text.includes('language') && text.includes('Python')),
        'language-specific Python constraint should be added',
      );
    } finally {
      restoreFetch();
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('keeps language as other when no supported language signals exist', async () => {
    const store = createMockStore();
    const projectRoot = await makeProjectWithFiles(['README.md']);
    globalThis.fetch = mockFetchForJson(dagWithAllowedFiles(['docs/**/*.md'], [], 'documentation'));

    try {
      const result = await compileGoal(store, { goalText: 'Improve repository documentation', projectRoot });
      assert.ok(result.goalId);
      const dags = store.getDags();
      const implementTask = dags[0].tasks.find(task => task.type === 'implement');
      assert.equal(implementTask?.language, 'other');
      assert.ok(
        implementTask?.constraints?.some((text) => text.includes('Default implementation language')),
        'uncertain language should still carry default language guidance',
      );
    } finally {
      restoreFetch();
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('clears the 120-second LLM deadline after a fast compiler result', async () => {
    const store = createMockStore();
    const projectRoot = await makeProjectWithFiles(['README.md']);
    globalThis.fetch = mockFetchForJson(dagWithAllowedFiles(['docs/**/*.md'], [], 'timer-cleanup'));
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    let compilerTimeout;
    let compilerTimeoutCleared = false;
    globalThis.setTimeout = (callback, delay, ...args) => {
      const handle = originalSetTimeout(callback, delay, ...args);
      if (delay === 120_000) compilerTimeout = handle;
      return handle;
    };
    globalThis.clearTimeout = (handle) => {
      if (handle === compilerTimeout) compilerTimeoutCleared = true;
      return originalClearTimeout(handle);
    };

    try {
      await compileGoal(store, {
        goalText: 'Document the timer cleanup path',
        projectRoot,
        skipCodebaseProbe: true,
      });
      assert.ok(compilerTimeout, 'compiler should create its bounded LLM deadline');
      assert.equal(compilerTimeoutCleared, true, 'compiler must clear the deadline after the LLM settles');
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
      restoreFetch();
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('shared language execution policy', () => {
  it('normalizes extended language targets and emits native extensions', () => {
    assert.equal(inferTaskLanguage({ allowedFiles: ['src/**/*.cs'] }, 'js'), 'csharp');
    assert.equal(inferTaskLanguage({ prompt: 'Implement this in PowerShell' }, 'js'), 'powershell');
    assert.equal(getLanguageFileExtension('csharp'), 'cs');
    assert.equal(getLanguageFileExtension('unknown-language'), 'ext');
    assert.equal(resolveLanguageProfile('c++').label, 'C++');
  });

  it('chooses the dominant codebase language when task text is neutral', () => {
    const language = inferPreferredLanguage({
      languages: ['ts', 'python'],
      fileCountsByExt: { '.ts': 2, '.py': 30 },
    }, 'Improve request validation');

    assert.equal(language, 'python');
  });

  it('builds Python-native generation and action guidance', () => {
    const task = {
      type: 'implement',
      language: 'python',
      prompt: 'Create a configuration loader',
    };
    const generationPrompt = buildGenerationPrompt(task, 1);
    const workerPrompt = buildPrompt(task, '', '', {
      tools: ['read', 'write'],
      role: 'coder',
      errorPatternLearner: null,
    });

    assert.match(generationPrompt, /PEP 8/);
    assert.doesNotMatch(generationPrompt, /Use ESM syntax/);
    assert.match(workerPrompt, /relative\/path\.py/);
    assert.match(workerPrompt, /Primary implementation language: Python/);
  });

  it('scores Python error handling and declarations with Python rules', () => {
    const code = [
      'from pathlib import Path',
      '',
      'class ConfigLoader:',
      '    """Load configuration files safely."""',
      '    def load(self, path: Path) -> str:',
      '        try:',
      '            return path.read_text()',
      '        except OSError as error:',
      '            raise RuntimeError("load failed") from error',
    ].join('\n');
    const result = scoreCodeQuality(code, { language: 'python' });

    assert.equal(result.checks.find((check) => check.name === 'has_exports')?.passed, true);
    assert.equal(result.checks.find((check) => check.name === 'has_error_handling')?.passed, true);
    assert.equal(result.checks.find((check) => check.name === 'has_comments')?.passed, true);
  });
});
