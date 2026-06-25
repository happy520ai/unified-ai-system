import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BenchmarkSuite,
  BENCHMARK_TASKS,
  runBenchmark,
  generateReport,
  compareReports,
} from '../src/benchmark/index.js';

// ============================================================================
// generateReport
// ============================================================================

describe('generateReport', () => {
  it('throws on null input', () => {
    assert.throws(() => generateReport(null), TypeError);
  });

  it('throws on non-object input', () => {
    assert.throws(() => generateReport('not-a-report'), TypeError);
  });

  it('returns a string', () => {
    const report = {
      id: 'bench-test',
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      totalDurationMs: 60_000,
      tasks: [],
      averageDimensions: { correctness: 0, completeness: 0, efficiency: 0, speed: 0, codeQuality: 0 },
      overallScore: 0,
      passed: 0,
      failed: 0,
    };
    const text = generateReport(report);
    assert.ok(typeof text === 'string');
    assert.ok(text.length > 0);
  });

  it('includes the run ID', () => {
    const report = {
      id: 'bench-abc123',
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      totalDurationMs: 60_000,
      tasks: [],
      averageDimensions: { correctness: 0, completeness: 0, efficiency: 0, speed: 0, codeQuality: 0 },
      overallScore: 0,
      passed: 0,
      failed: 0,
    };
    const text = generateReport(report);
    assert.ok(text.includes('bench-abc123'));
  });

  it('includes task names in output', () => {
    const report = {
      id: 'bench-test',
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      totalDurationMs: 60_000,
      tasks: [
        {
          taskName: 'add-function',
          dimensions: { correctness: 80, completeness: 70, efficiency: 60, speed: 50, codeQuality: 40 },
          weightedScore: 65,
          durationMs: 10_000,
          llmCalls: 3,
          tokensUsed: 500,
          success: true,
          errors: [],
        },
      ],
      averageDimensions: { correctness: 80, completeness: 70, efficiency: 60, speed: 50, codeQuality: 40 },
      overallScore: 65,
      passed: 1,
      failed: 0,
    };
    const text = generateReport(report);
    assert.ok(text.includes('add-function'));
    assert.ok(text.includes('[PASS]'));
  });

  it('marks failed tasks with [FAIL]', () => {
    const report = {
      id: 'bench-test',
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      totalDurationMs: 60_000,
      tasks: [
        {
          taskName: 'fix-bug',
          dimensions: { correctness: 10, completeness: 10, efficiency: 10, speed: 10, codeQuality: 10 },
          weightedScore: 10,
          durationMs: 120_000,
          llmCalls: 50,
          tokensUsed: 10000,
          success: false,
          errors: ['timeout'],
        },
      ],
      averageDimensions: { correctness: 10, completeness: 10, efficiency: 10, speed: 10, codeQuality: 10 },
      overallScore: 10,
      passed: 0,
      failed: 1,
    };
    const text = generateReport(report);
    assert.ok(text.includes('[FAIL]'));
    assert.ok(text.includes('timeout'));
  });

  it('includes average dimension scores', () => {
    const report = {
      id: 'bench-avg',
      startedAt: '2025-01-01T00:00:00Z',
      finishedAt: '2025-01-01T00:01:00Z',
      totalDurationMs: 60_000,
      tasks: [],
      averageDimensions: { correctness: 75, completeness: 80, efficiency: 85, speed: 90, codeQuality: 70 },
      overallScore: 78,
      passed: 0,
      failed: 0,
    };
    const text = generateReport(report);
    assert.ok(text.includes('75'));
    assert.ok(text.includes('80'));
    assert.ok(text.includes('85'));
  });
});

// ============================================================================
// compareReports
// ============================================================================

describe('compareReports', () => {
  const makeReport = (taskScores) => ({
    id: 'bench-test',
    startedAt: '2025-01-01T00:00:00Z',
    finishedAt: '2025-01-01T00:01:00Z',
    totalDurationMs: 60_000,
    overallScore: Math.round(taskScores.reduce((s, t) => s + t.score, 0) / (taskScores.length || 1)),
    tasks: taskScores.map((t) => ({
      taskName: t.name,
      weightedScore: t.score,
      dimensions: { correctness: t.score, completeness: t.score, efficiency: t.score, speed: t.score, codeQuality: t.score },
      durationMs: 1000,
      llmCalls: 1,
      tokensUsed: 100,
      success: t.score >= 60,
      errors: [],
    })),
    averageDimensions: { correctness: 0, completeness: 0, efficiency: 0, speed: 0, codeQuality: 0 },
    passed: taskScores.filter((t) => t.score >= 60).length,
    failed: taskScores.filter((t) => t.score < 60).length,
  });

  it('throws on null first argument', () => {
    assert.throws(() => compareReports(null, {}), TypeError);
  });

  it('throws on null second argument', () => {
    assert.throws(() => compareReports({}, null), TypeError);
  });

  it('detects no changes for identical reports', () => {
    const r = makeReport([{ name: 'a', score: 80 }]);
    const result = compareReports(r, r);
    assert.equal(result.overallDelta, 0);
    assert.equal(result.regressions.length, 0);
    assert.equal(result.improvements.length, 0);
    assert.deepEqual(result.unchanged, ['a']);
  });

  it('detects regressions when score drops by more than 5', () => {
    const a = makeReport([{ name: 'a', score: 80 }]);
    const b = makeReport([{ name: 'a', score: 60 }]);
    const result = compareReports(a, b);
    assert.equal(result.regressions.length, 1);
    assert.equal(result.regressions[0].taskName, 'a');
    assert.equal(result.regressions[0].delta, -20);
    assert.equal(result.regressions[0].regressed, true);
  });

  it('detects improvements when score rises by more than 5', () => {
    const a = makeReport([{ name: 'a', score: 50 }]);
    const b = makeReport([{ name: 'a', score: 80 }]);
    const result = compareReports(a, b);
    assert.equal(result.improvements.length, 1);
    assert.equal(result.improvements[0].delta, 30);
  });

  it('treats small deltas as unchanged', () => {
    const a = makeReport([{ name: 'a', score: 70 }]);
    const b = makeReport([{ name: 'a', score: 73 }]);
    const result = compareReports(a, b);
    assert.deepEqual(result.unchanged, ['a']);
    assert.equal(result.regressions.length, 0);
    assert.equal(result.improvements.length, 0);
  });

  it('computes correct overall delta', () => {
    const a = makeReport([{ name: 'a', score: 70 }, { name: 'b', score: 80 }]);
    const b = makeReport([{ name: 'a', score: 60 }, { name: 'b', score: 90 }]);
    const result = compareReports(a, b);
    // A overall = 75, B overall = 75 => delta = 0
    assert.equal(result.overallDelta, 0);
  });

  it('generates a summary string', () => {
    const a = makeReport([{ name: 'a', score: 80 }]);
    const b = makeReport([{ name: 'a', score: 50 }]);
    const result = compareReports(a, b);
    assert.ok(typeof result.summary === 'string');
    assert.ok(result.summary.includes('Overall'));
    assert.ok(result.summary.includes('Regression'));
  });

  it('handles non-overlapping tasks gracefully', () => {
    const a = makeReport([{ name: 'a', score: 80 }]);
    const b = makeReport([{ name: 'b', score: 80 }]);
    const result = compareReports(a, b);
    assert.equal(result.regressions.length, 0);
    assert.equal(result.improvements.length, 0);
    assert.equal(result.unchanged.length, 0);
  });

  it('handles mixed overlapping and non-overlapping tasks', () => {
    const a = makeReport([{ name: 'a', score: 80 }, { name: 'b', score: 60 }]);
    const b = makeReport([{ name: 'a', score: 70 }, { name: 'c', score: 90 }]);
    const result = compareReports(a, b);
    // Only 'a' overlaps
    assert.equal(result.regressions.length, 1);
    assert.equal(result.regressions[0].taskName, 'a');
  });
});

// ============================================================================
// Integration: full pipeline
// ============================================================================

describe('Benchmark integration', () => {
  it('end-to-end: run, generate report, compare', async () => {
    const executor = async (desc) => ({
      testsPass: desc.includes('explain') ? true : Math.random() > 0.3,
      outputMatches: true,
      requirements: ['req1', 'req2'],
      met: ['req1', 'req2'],
      filesModified: true,
      llmCalls: 3,
      tokensUsed: 800,
      lintPass: true,
      typeCheckPass: true,
      noWarnings: true,
      complexity: 4,
    });

    const reportA = await runBenchmark(executor);
    const reportB = await runBenchmark(executor);

    const text = generateReport(reportA);
    assert.ok(text.includes('BENCHMARK REPORT'));

    const comparison = compareReports(reportA, reportB);
    assert.ok(typeof comparison.summary === 'string');
    assert.ok(typeof comparison.overallDelta === 'number');
  });

  it('suite with empty tasks produces a valid report', async () => {
    const suite = new BenchmarkSuite();
    const report = await suite.run(async () => ({}));
    assert.equal(report.tasks.length, 0);
    assert.equal(report.overallScore, 0);
  });
});
