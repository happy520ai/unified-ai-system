import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  Scorer,
  BENCHMARK_TASKS,
} from '../src/benchmark/index.js';

// ============================================================================
// BENCHMARK_TASKS pre-defined tasks
// ============================================================================

describe('BENCHMARK_TASKS', () => {
  it('is a frozen object', () => {
    assert.ok(Object.isFrozen(BENCHMARK_TASKS));
  });

  it('contains exactly five pre-defined tasks', () => {
    assert.equal(Object.keys(BENCHMARK_TASKS).length, 5);
  });

  it('includes add-function task', () => {
    assert.ok(BENCHMARK_TASKS['add-function']);
    assert.equal(BENCHMARK_TASKS['add-function'].name, 'add-function');
  });

  it('includes fix-bug task', () => {
    assert.ok(BENCHMARK_TASKS['fix-bug']);
    assert.equal(BENCHMARK_TASKS['fix-bug'].name, 'fix-bug');
  });

  it('includes refactor task', () => {
    assert.ok(BENCHMARK_TASKS['refactor']);
    assert.equal(BENCHMARK_TASKS['refactor'].name, 'refactor');
  });

  it('includes add-test task', () => {
    assert.ok(BENCHMARK_TASKS['add-test']);
    assert.equal(BENCHMARK_TASKS['add-test'].name, 'add-test');
  });

  it('includes explain-code task', () => {
    assert.ok(BENCHMARK_TASKS['explain-code']);
    assert.equal(BENCHMARK_TASKS['explain-code'].name, 'explain-code');
  });

  it('every task has a non-empty description', () => {
    for (const task of Object.values(BENCHMARK_TASKS)) {
      assert.ok(task.description.length > 0, `${task.name} missing description`);
    }
  });

  it('every task has an inputFiles array', () => {
    for (const task of Object.values(BENCHMARK_TASKS)) {
      assert.ok(Array.isArray(task.inputFiles), `${task.name} inputFiles not array`);
    }
  });

  it('every task has an expectedOutcome string', () => {
    for (const task of Object.values(BENCHMARK_TASKS)) {
      assert.ok(typeof task.expectedOutcome === 'string' && task.expectedOutcome.length > 0);
    }
  });

  it('every task has a scoringRubric with all five weights', () => {
    const keys = [
      'correctnessWeight',
      'completenessWeight',
      'efficiencyWeight',
      'speedWeight',
      'codeQualityWeight',
    ];
    for (const task of Object.values(BENCHMARK_TASKS)) {
      for (const k of keys) {
        assert.ok(typeof task.scoringRubric[k] === 'number', `${task.name}.${k} missing`);
      }
    }
  });

  it('fix-bug has higher correctness weight than default', () => {
    assert.ok(BENCHMARK_TASKS['fix-bug'].scoringRubric.correctnessWeight >= 0.40);
  });
});

// ============================================================================
// Scorer
// ============================================================================

describe('Scorer', () => {
  // ── scoreCorrectness ──────────────────────────────────────────────────────

  describe('scoreCorrectness', () => {
    it('returns 0 for null evidence', () => {
      const s = new Scorer();
      assert.equal(s.scoreCorrectness(null), 0);
    });

    it('returns 0 for undefined evidence', () => {
      const s = new Scorer();
      assert.equal(s.scoreCorrectness(undefined), 0);
    });

    it('returns 85 when tests pass but no explicit output match', () => {
      const s = new Scorer();
      const score = s.scoreCorrectness({ testsPass: true });
      // 60 (testsPass) + 25 (partial output credit) = 85
      assert.equal(score, 85);
    });

    it('returns 100 when tests pass and output matches', () => {
      const s = new Scorer();
      const score = s.scoreCorrectness({ testsPass: true, outputMatches: true });
      assert.equal(score, 100);
    });

    it('returns partial score when some tests pass', () => {
      const s = new Scorer();
      const score = s.scoreCorrectness({ testsPass: false, testsPassed: 3, testsTotal: 10 });
      // 60 * 3/10 = 18
      assert.equal(score, 18);
    });

    it('returns 0 when no tests pass and no match', () => {
      const s = new Scorer();
      const score = s.scoreCorrectness({ testsPass: false });
      assert.equal(score, 0);
    });

    it('caps score at 100', () => {
      const s = new Scorer();
      const score = s.scoreCorrectness({ testsPass: true, outputMatches: true, testsPassed: 5, testsTotal: 5 });
      assert.ok(score <= 100);
    });
  });

  // ── scoreCompleteness ─────────────────────────────────────────────────────

  describe('scoreCompleteness', () => {
    it('returns 0 for null evidence', () => {
      const s = new Scorer();
      assert.equal(s.scoreCompleteness(null), 0);
    });

    it('returns 70 when no requirements but files were modified', () => {
      const s = new Scorer();
      assert.equal(s.scoreCompleteness({ filesModified: true }), 70);
    });

    it('returns 20 when no requirements and no file modification', () => {
      const s = new Scorer();
      assert.equal(s.scoreCompleteness({ filesModified: false }), 20);
    });

    it('returns 100 when all requirements met and files modified', () => {
      const s = new Scorer();
      const score = s.scoreCompleteness({
        requirements: ['a', 'b', 'c'],
        met: ['a', 'b', 'c'],
        filesModified: true,
      });
      assert.equal(score, 100);
    });

    it('returns proportional score when some requirements met', () => {
      const s = new Scorer();
      const score = s.scoreCompleteness({
        requirements: ['a', 'b', 'c', 'd'],
        met: ['a', 'b'],
        filesModified: false,
      });
      // (2/4) * 80 = 40
      assert.equal(score, 40);
    });

    it('returns 0 when no requirements met', () => {
      const s = new Scorer();
      const score = s.scoreCompleteness({
        requirements: ['a', 'b'],
        met: [],
        filesModified: false,
      });
      assert.equal(score, 0);
    });
  });

  // ── scoreEfficiency ───────────────────────────────────────────────────────

  describe('scoreEfficiency', () => {
    it('returns 0 for null evidence', () => {
      const s = new Scorer();
      assert.equal(s.scoreEfficiency(null), 0);
    });

    it('returns 100 when zero LLM calls', () => {
      const s = new Scorer();
      assert.equal(s.scoreEfficiency({ llmCalls: 0 }), 100);
    });

    it('returns high score when under budget', () => {
      const s = new Scorer();
      const score = s.scoreEfficiency({ llmCalls: 5, maxLlmCalls: 20 });
      // 100 - (5/20)*40 = 100 - 10 = 90
      assert.equal(score, 90);
    });

    it('returns 60 when exactly at budget', () => {
      const s = new Scorer();
      const score = s.scoreEfficiency({ llmCalls: 20, maxLlmCalls: 20 });
      assert.equal(score, 60);
    });

    it('returns reduced score when over budget', () => {
      const s = new Scorer();
      const score = s.scoreEfficiency({ llmCalls: 30, maxLlmCalls: 20 });
      // over = (30-20)/20 = 0.5, 60 - 0.5*60 = 30
      assert.equal(score, 30);
    });

    it('clamps to 0 when vastly over budget', () => {
      const s = new Scorer();
      const score = s.scoreEfficiency({ llmCalls: 100, maxLlmCalls: 20 });
      assert.equal(score, 0);
    });

    it('uses default budget when maxLlmCalls not provided', () => {
      const s = new Scorer();
      const score = s.scoreEfficiency({ llmCalls: 1 });
      assert.ok(score > 90);
    });
  });

  // ── scoreSpeed ────────────────────────────────────────────────────────────

  describe('scoreSpeed', () => {
    it('returns 0 for null evidence', () => {
      const s = new Scorer();
      assert.equal(s.scoreSpeed(null), 0);
    });

    it('returns 100 when duration is 0', () => {
      const s = new Scorer();
      assert.equal(s.scoreSpeed({ durationMs: 0 }), 100);
    });

    it('returns 75 when at half budget', () => {
      const s = new Scorer();
      const score = s.scoreSpeed({ durationMs: 30_000, maxTimeMs: 60_000 });
      // 100 - 0.5*50 = 75
      assert.equal(score, 75);
    });

    it('returns 50 when exactly at budget', () => {
      const s = new Scorer();
      const score = s.scoreSpeed({ durationMs: 60_000, maxTimeMs: 60_000 });
      assert.equal(score, 50);
    });

    it('returns reduced score when over budget', () => {
      const s = new Scorer();
      const score = s.scoreSpeed({ durationMs: 90_000, maxTimeMs: 60_000 });
      // over = (90-60)/60 = 0.5, 50 - 0.5*50 = 25
      assert.equal(score, 25);
    });

    it('clamps to 0 for extremely slow tasks', () => {
      const s = new Scorer();
      const score = s.scoreSpeed({ durationMs: 600_000, maxTimeMs: 60_000 });
      assert.equal(score, 0);
    });
  });

  // ── scoreCodeQuality ──────────────────────────────────────────────────────

  describe('scoreCodeQuality', () => {
    it('returns 0 for null evidence', () => {
      const s = new Scorer();
      assert.equal(s.scoreCodeQuality(null), 0);
    });

    it('returns 0 when no checks pass', () => {
      const s = new Scorer();
      assert.equal(s.scoreCodeQuality({}), 0);
    });

    it('returns 35 for lint pass only', () => {
      const s = new Scorer();
      assert.equal(s.scoreCodeQuality({ lintPass: true }), 35);
    });

    it('returns 70 for lint + typecheck pass', () => {
      const s = new Scorer();
      assert.equal(s.scoreCodeQuality({ lintPass: true, typeCheckPass: true }), 70);
    });

    it('returns 85 for lint + typecheck + no warnings', () => {
      const s = new Scorer();
      assert.equal(
        s.scoreCodeQuality({ lintPass: true, typeCheckPass: true, noWarnings: true }),
        85
      );
    });

    it('returns 100 when all pass with low complexity', () => {
      const s = new Scorer();
      const score = s.scoreCodeQuality({
        lintPass: true,
        typeCheckPass: true,
        noWarnings: true,
        complexity: 3,
      });
      assert.equal(score, 100);
    });

    it('gives partial complexity bonus for moderate complexity', () => {
      const s = new Scorer();
      const score = s.scoreCodeQuality({
        lintPass: true,
        typeCheckPass: true,
        noWarnings: true,
        complexity: 8,
      });
      // 85 + 8 = 93
      assert.equal(score, 93);
    });

    it('gives no complexity bonus for high complexity', () => {
      const s = new Scorer();
      const score = s.scoreCodeQuality({
        lintPass: true,
        typeCheckPass: true,
        noWarnings: true,
        complexity: 15,
      });
      assert.equal(score, 85);
    });
  });

  // ── scoreAll ──────────────────────────────────────────────────────────────

  describe('scoreAll', () => {
    it('returns all five dimensions', () => {
      const s = new Scorer();
      const dims = s.scoreAll({ testsPass: true });
      assert.ok('correctness' in dims);
      assert.ok('completeness' in dims);
      assert.ok('efficiency' in dims);
      assert.ok('speed' in dims);
      assert.ok('codeQuality' in dims);
    });

    it('all dimensions are between 0 and 100', () => {
      const s = new Scorer();
      const dims = s.scoreAll({
        testsPass: true,
        outputMatches: true,
        requirements: ['a'],
        met: ['a'],
        filesModified: true,
        llmCalls: 2,
        durationMs: 5000,
        lintPass: true,
        typeCheckPass: true,
      });
      for (const v of Object.values(dims)) {
        assert.ok(v >= 0 && v <= 100, `dimension out of range: ${v}`);
      }
    });
  });

  // ── weightedScore ─────────────────────────────────────────────────────────

  describe('weightedScore', () => {
    it('returns 0 when all dimensions are 0', () => {
      const s = new Scorer();
      const dims = { correctness: 0, completeness: 0, efficiency: 0, speed: 0, codeQuality: 0 };
      assert.equal(s.weightedScore(dims, {}), 0);
    });

    it('returns 100 when all dimensions are 100', () => {
      const s = new Scorer();
      const dims = { correctness: 100, completeness: 100, efficiency: 100, speed: 100, codeQuality: 100 };
      assert.equal(s.weightedScore(dims, {}), 100);
    });

    it('respects custom rubric weights', () => {
      const s = new Scorer();
      const dims = { correctness: 100, completeness: 0, efficiency: 0, speed: 0, codeQuality: 0 };
      const rubric = { correctnessWeight: 1.0, completenessWeight: 0, efficiencyWeight: 0, speedWeight: 0, codeQualityWeight: 0 };
      assert.equal(s.weightedScore(dims, rubric), 100);
    });

    it('clamps to 0 for negative input', () => {
      const s = new Scorer();
      const dims = { correctness: -10, completeness: -10, efficiency: -10, speed: -10, codeQuality: -10 };
      assert.equal(s.weightedScore(dims, {}), 0);
    });
  });
});
