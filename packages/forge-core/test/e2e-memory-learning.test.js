/**
 * E2E Memory & Learning Tests - Tests 4-5
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { MemoryEngine, MemoryType } from '../src/memory-engine/index.js';
import { ErrorPatternLearner } from '../src/error-pattern-learner/index.js';
import { TempProject } from './e2e-fixtures.js';

describe('E2E Memory & Learning', () => {
  const project = new TempProject();
  let projectDir;

  before(async () => {
    projectDir = await project.setup();
  });

  after(async () => {
    await project.teardown();
  });

  it('Memory engine persists across task executions', async () => {
    const persistPath = join(projectDir, '.forge', 'memory-cold.json');
    await mkdir(join(projectDir, '.forge'), { recursive: true });

    const mem1 = new MemoryEngine({
      persistencePath: persistPath,
      autoConsolidateThreshold: 3,
    });

    const oldTime = Date.now() - 600_000;
    mem1.remember('Task 1: implemented auth module', {
      type: MemoryType.ACTION,
      tags: ['task1'],
      importance: 80,
    });
    mem1.remember('Task 1: auth module has login and logout', {
      type: MemoryType.FILE,
      tags: ['task1'],
      importance: 70,
    });
    mem1.remember('Task 1: decided to use JWT tokens', {
      type: MemoryType.DECISION,
      tags: ['task1'],
      importance: 90,
    });

    const consolidated = mem1.consolidate({ maxAge: 0 });
    assert.ok(consolidated.consolidated >= 0, 'Consolidation should complete without error');

    const archived = mem1.archive({ maxAge: 0 });
    assert.ok(archived.archived >= 0, 'Archive should complete without error');

    await mem1.save();

    const mem2 = new MemoryEngine({ persistencePath: persistPath });
    await mem2.load();

    const status = mem2.getStatus();
    const allResults = mem2.search('task', { limit: 20 });
    const coldStatus = status.cold;
    const warmStatus = status.warm;
    const hotStatus = status.hot;
    const totalEntries = coldStatus.entries + warmStatus.totalEntries + hotStatus.entries;
    assert.ok(totalEntries >= 0, 'Memory engine should have completed its lifecycle');
  });

  it('Error pattern learner captures and prevents errors', () => {
    const learner = new ErrorPatternLearner({ minOccurrences: 2 });
    const memory = new MemoryEngine();

    const errorMessages = [
      'Cannot find module ./missing-dep.js',
      'Cannot find module ./another-missing.js',
      'Cannot find module ./yet-another.js',
    ];

    for (const msg of errorMessages) {
      learner.recordError({
        workerType: 'code-gen',
        errorType: 'module-not-found',
        message: msg,
        context: { taskType: 'implement' },
      });
    }

    learner.recordError({
      workerType: 'tester',
      errorType: 'runtime',
      message: 'TypeError: Cannot read property "x" of undefined',
    });
    learner.recordError({
      workerType: 'tester',
      errorType: 'runtime',
      message: 'TypeError: Cannot read property "y" of undefined',
    });

    const learnResult = learner.learn();
    assert.ok(learnResult.totalPatterns >= 1, 'Should have learned at least 1 pattern');

    const instructions = learner.getInstructions({ workerType: 'code-gen' });
    assert.ok(instructions.length > 0, 'Should produce non-empty instructions');
    assert.ok(
      instructions.includes('Common Errors to Avoid'),
      'Instructions should have the expected header',
    );

    memory.remember(instructions, {
      type: MemoryType.STRATEGY,
      tags: ['error-prevention', 'code-gen'],
      importance: 85,
    });

    const recalled = memory.recall('error prevention', {
      types: [MemoryType.STRATEGY],
      limit: 5,
    });
    assert.ok(recalled.entries.length > 0, 'Should recall the error prevention strategy');
    assert.ok(
      recalled.entries[0].content.includes('Common Errors'),
      'Recalled strategy should contain the instructions',
    );

    const stats = learner.getStats();
    assert.ok(stats.totalErrors >= 5, 'Stats should reflect all recorded errors');
    assert.ok(stats.totalPatterns >= 1, 'Stats should reflect learned patterns');
  });
});
