// Shared test fixtures and helpers for p10-goal-refiner tests
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function createMockStore() {
  const goals = new Map();
  const events = [];
  const dags = [];
  let goalCounter = 0;
  return {
    createGoal({ text, projectRoot, budget }) {
      const id = `goal-${++goalCounter}`;
      goals.set(id, { id, text, projectRoot, budget, status: 'pending' });
      return id;
    },
    logEvent(goalId, taskId, type, data) {
      events.push({ goalId, taskId, type, data });
    },
    updateGoalStatus(id, status, payload) {
      const g = goals.get(id);
      if (g) {
        g.status = status;
        if (payload !== undefined) g.payload = payload;
      }
    },
    insertTaskDAG(goalId, tasks, deps) {
      dags.push({ goalId, tasks, deps });
    },
    getGoal(id) { return goals.get(id); },
    getEvents() { return events; },
    getDags() { return dags; },
  };
}

const ORIGINAL_FETCH = globalThis.fetch;

export function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
}

export function buildMockDagJson(overrides = {}) {
  const tasks = overrides.tasks ?? [
    {
      id: 't1', name: 'Explore codebase', type: 'explore',
      agentRole: 'code-archaeologist',
      prompt: 'Explore the project structure and identify relevant files.',
      dependsOn: [], allowedFiles: ['src/**/*.js'], estimatedMin: 10,
    },
    {
      id: 't2', name: 'Plan approach', type: 'plan',
      agentRole: 'architect',
      prompt: 'Design the implementation approach based on exploration findings.',
      dependsOn: ['t1'], allowedFiles: ['docs/**/*.md'], estimatedMin: 15,
    },
    {
      id: 't3', name: 'Implement changes', type: 'implement',
      agentRole: 'coder',
      prompt: 'Implement the required changes in the source files.',
      dependsOn: ['t2'], allowedFiles: ['src/**/*.js'], estimatedMin: 30,
    },
    {
      id: 't4', name: 'Write tests', type: 'test',
      agentRole: 'tester',
      prompt: 'Write tests covering the implemented changes.',
      dependsOn: ['t3'], allowedFiles: ['test/**/*.js'], estimatedMin: 20,
    },
    {
      id: 't5', name: 'Verify results', type: 'verify',
      agentRole: 'verifier',
      prompt: 'Run all verifiers and confirm the goal is satisfied.',
      dependsOn: ['t4'], allowedFiles: ['**/*'], estimatedMin: 10,
    },
  ];
  return JSON.stringify({
    tasks,
    checkpoints: overrides.checkpoints ?? ['after_t3'],
    rollbackPoints: overrides.rollbackPoints ?? ['before_t3'],
    summary: overrides.summary ?? 'Mock DAG plan summary',
  });
}

export function buildMockReviewJson(overrides = {}) {
  return JSON.stringify({
    issues: overrides.issues ?? [],
    verdict: overrides.verdict ?? 'ok',
    revisedSummary: overrides.revisedSummary ?? undefined,
  });
}

export async function runRefine(refiner, store, args, fetchHandler) {
  globalThis.fetch = fetchHandler;
  try {
    return await refiner.refine(store, args);
  } finally {
    restoreFetch();
  }
}

export function successFetch(dagOverrides, reviewOverrides) {
  let callCount = 0;
  return async (url, opts) => {
    callCount++;
    let body;
    if (callCount === 1) {
      body = buildMockDagJson(dagOverrides);
    } else {
      body = buildMockReviewJson(reviewOverrides);
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return { success: true, data: { outputText: body, selectedProvider: 'mock' } };
      },
      async text() { return ''; },
    };
  };
}

export function failureFetch() {
  return async () => ({
    ok: false,
    status: 400,
    async text() { return 'Bad Request'; },
    async json() { return {}; },
  });
}

export async function makeTempProject(pkg = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'goal-refiner-test-'));
  const fullPkg = { name: 'test-project', version: '1.0.0', ...pkg };
  await writeFile(join(dir, 'package.json'), JSON.stringify(fullPkg, null, 2));
  return dir;
}

export const DEFAULT_ROOT = join(tmpdir(), 'nonexistent-refiner-probe-dir');
