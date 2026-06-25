import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BenchmarkSuite,
  Scorer,
  BENCHMARK_TASKS,
  runBenchmark,
} from '../src/benchmark/index.js';

// ============================================================================
// BenchmarkSuite
// ============================================================================

describe('BenchmarkSuite', () => {
  describe('constructor', () => {
    it('creates an empty suite by default', () => {
      const suite = new BenchmarkSuite();
      assert.equal(suite.taskCount, 0);
      assert.deepEqual(suite.tasks, []);
    });

    it('accepts initial tasks in constructor', () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['add-function'], BENCHMARK_TASKS['fix-bug']],
      });
      assert.equal(suite.taskCount, 2);
    });

    it('uses a default Scorer when none provided', () => {
      const suite = new BenchmarkSuite();
      assert.ok(suite.scorer instanceof Scorer);
    });

    it('accepts a custom Scorer', () => {
      const custom = new Scorer();
      const suite = new BenchmarkSuite({ scorer: custom });
      assert.equal(suite.scorer, custom);
    });
  });

  describe('addTask', () => {
    it('adds a task and increments count', () => {
      const suite = new BenchmarkSuite();
      suite.addTask(BENCHMARK_TASKS['add-function']);
      assert.equal(suite.taskCount, 1);
    });

    it('is chainable', () => {
      const suite = new BenchmarkSuite();
      const result = suite.addTask(BENCHMARK_TASKS['add-function']);
      assert.equal(result, suite);
    });

    it('throws on task without name', () => {
      const suite = new BenchmarkSuite();
      assert.throws(() => suite.addTask({}), TypeError);
    });

    it('throws on null task', () => {
      const suite = new BenchmarkSuite();
      assert.throws(() => suite.addTask(null), TypeError);
    });

    it('fills in defaults for missing fields', () => {
      const suite = new BenchmarkSuite();
      suite.addTask({ name: 'minimal' });
      const task = suite.tasks[0];
      assert.equal(task.description, '');
      assert.deepEqual(task.inputFiles, []);
      assert.equal(task.expectedOutcome, '');
      assert.ok(task.scoringRubric.correctnessWeight > 0);
    });
  });

  describe('removeTask', () => {
    it('removes a task by name', () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['add-function'], BENCHMARK_TASKS['fix-bug']],
      });
      const removed = suite.removeTask('add-function');
      assert.equal(removed, true);
      assert.equal(suite.taskCount, 1);
    });

    it('returns false when task not found', () => {
      const suite = new BenchmarkSuite();
      assert.equal(suite.removeTask('nonexistent'), false);
    });
  });

  describe('run', () => {
    it('runs all tasks against a function executor', async () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['add-function']],
      });

      const executor = async () => ({
        testsPass: true,
        outputMatches: true,
        requirements: ['a'],
        met: ['a'],
        filesModified: true,
        llmCalls: 2,
        tokensUsed: 500,
        lintPass: true,
        typeCheckPass: true,
        noWarnings: true,
        complexity: 3,
      });

      const report = await suite.run(executor);
      assert.equal(report.tasks.length, 1);
      assert.equal(report.passed + report.failed, 1);
      assert.ok(report.overallScore >= 0);
    });

    it('runs tasks against an object with .run()', async () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['fix-bug']],
      });

      const forge = {
        run: async () => ({
          testsPass: true,
          testsPassed: 5,
          testsTotal: 5,
          outputMatches: true,
          llmCalls: 3,
          tokensUsed: 1000,
        }),
      };

      const report = await suite.run(forge);
      assert.equal(report.tasks.length, 1);
    });

    it('records errors when executor throws', async () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['add-function']],
      });

      const executor = async () => {
        throw new Error('boom');
      };

      const report = await suite.run(executor);
      assert.equal(report.tasks[0].errors.length, 1);
      assert.match(report.tasks[0].errors[0], /boom/);
    });

    it('throws when forge is not callable and has no .run()', async () => {
      const suite = new BenchmarkSuite({
        tasks: [{ name: 'test' }],
      });

      const report = await suite.run({});
      // The error should be caught and recorded
      assert.equal(report.tasks[0].errors.length, 1);
    });

    it('calls onTaskStart callback', async () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['add-function']],
      });
      const started = [];
      await suite.run(async () => ({}), {
        onTaskStart: (task) => started.push(task.name),
      });
      assert.deepEqual(started, ['add-function']);
    });

    it('calls onTaskEnd callback', async () => {
      const suite = new BenchmarkSuite({
        tasks: [BENCHMARK_TASKS['fix-bug']],
      });
      const ended = [];
      await suite.run(async () => ({}), {
        onTaskEnd: (task, result) => ended.push({ name: task.name, score: result.weightedScore }),
      });
      assert.equal(ended.length, 1);
      assert.equal(ended[0].name, 'fix-bug');
    });

    it('uses custom evaluate function when provided', async () => {
      const suite = new BenchmarkSuite({
        tasks: [{ name: 'custom' }],
      });

      const report = await suite.run(async () => ({}), {
        evaluate: () => ({
          testsPass: true,
          outputMatches: true,
          requirements: ['x'],
          met: ['x'],
          filesModified: true,
          llmCalls: 1,
          durationMs: 100,
          lintPass: true,
          typeCheckPass: true,
          noWarnings: true,
          complexity: 2,
        }),
      });

      assert.equal(report.tasks[0].weightedScore, 100);
    });

    it('report has correct structure', async () => {
      const suite = new BenchmarkSuite({
        tasks: Object.values(BENCHMARK_TASKS),
      });

      const report = await suite.run(async () => ({
        testsPass: true,
        llmCalls: 1,
        tokensUsed: 100,
      }));

      assert.ok(report.id.startsWith('bench-'));
      assert.ok(report.startedAt);
      assert.ok(report.finishedAt);
      assert.ok(typeof report.totalDurationMs === 'number');
      assert.ok(Array.isArray(report.tasks));
      assert.equal(report.tasks.length, 5);
      assert.ok(typeof report.overallScore === 'number');
      assert.equal(report.passed + report.failed, 5);
    });
  });
});

// ============================================================================
// runBenchmark convenience function
// ============================================================================

describe('runBenchmark', () => {
  it('runs all default tasks when no tasks specified', async () => {
    const report = await runBenchmark(async () => ({
      testsPass: true,
      llmCalls: 2,
    }));
    assert.equal(report.tasks.length, 5);
  });

  it('runs only specified tasks', async () => {
    const report = await runBenchmark(
      async () => ({ testsPass: true }),
      [BENCHMARK_TASKS['add-function']]
    );
    assert.equal(report.tasks.length, 1);
    assert.equal(report.tasks[0].taskName, 'add-function');
  });

  it('accepts a function executor', async () => {
    let callCount = 0;
    const report = await runBenchmark(async () => {
      callCount++;
      return { testsPass: true };
    }, [BENCHMARK_TASKS['add-function']]);
    assert.equal(callCount, 1);
    assert.equal(report.tasks.length, 1);
  });
});
