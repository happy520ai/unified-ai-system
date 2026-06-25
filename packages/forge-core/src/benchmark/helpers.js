/**
 * Benchmark Framework — helper functions, constants, and type definitions.
 *
 * Extracted from index.js to reduce file size and improve maintainability.
 * Contains pure functions, constants, and JSDoc typedefs that don't require
 * class instance state.
 *
 * @module benchmark/helpers
 */

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} BenchmarkTaskDef
 * @property {string} name — unique task identifier (e.g. "add-function")
 * @property {string} description — human-readable task description
 * @property {string[]} inputFiles — relative paths the task expects to exist
 * @property {string} expectedOutcome — what a correct solution looks like
 * @property {ScoringRubric} scoringRubric — weights and thresholds for scoring
 */

/**
 * @typedef {object} ScoringRubric
 * @property {number} correctnessWeight — 0-1, default 0.35
 * @property {number} completenessWeight — 0-1, default 0.25
 * @property {number} efficiencyWeight — 0-1, default 0.15
 * @property {number} speedWeight — 0-1, default 0.10
 * @property {number} codeQualityWeight — 0-1, default 0.15
 * @property {number} [maxTimeMs] — soft deadline; tasks beyond this lose speed points
 * @property {number} [maxLlmCalls] — efficiency budget; exceeding this loses points
 */

/**
 * @typedef {object} DimensionScores
 * @property {number} correctness — 0-100
 * @property {number} completeness — 0-100
 * @property {number} efficiency — 0-100
 * @property {number} speed — 0-100
 * @property {number} codeQuality — 0-100
 */

/**
 * @typedef {object} TaskResult
 * @property {string} taskName
 * @property {DimensionScores} dimensions
 * @property {number} weightedScore — 0-100 composite
 * @property {number} durationMs
 * @property {number} llmCalls
 * @property {number} tokensUsed
 * @property {boolean} success
 * @property {string[]} errors
 */

/**
 * @typedef {object} BenchmarkReport
 * @property {string} id — unique run identifier
 * @property {string} startedAt — ISO timestamp
 * @property {string} finishedAt — ISO timestamp
 * @property {number} totalDurationMs
 * @property {TaskResult[]} tasks
 * @property {DimensionScores} averageDimensions
 * @property {number} overallScore — 0-100
 * @property {number} passed — count of tasks with weightedScore >= 60
 * @property {number} failed — count of tasks with weightedScore < 60
 */

/**
 * @typedef {object} RegressionDelta
 * @property {string} taskName
 * @property {number} scoreA
 * @property {number} scoreB
 * @property {number} delta — B - A (negative = regression)
 * @property {boolean} regressed — true when delta < -5
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default scoring weights. */
export const DEFAULT_RUBRIC = Object.freeze({
  correctnessWeight: 0.35,
  completenessWeight: 0.25,
  efficiencyWeight: 0.15,
  speedWeight: 0.10,
  codeQualityWeight: 0.15,
  maxTimeMs: 60_000,
  maxLlmCalls: 20,
});

/** Score threshold for "passing" a task. */
export const PASS_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Pre-defined benchmark tasks
// ---------------------------------------------------------------------------

/** @type {Record<string, BenchmarkTaskDef>} */
export const BENCHMARK_TASKS = Object.freeze({
  'add-function': {
    name: 'add-function',
    description:
      'Add a new exported function to an existing module. The function must be ' +
      'correctly typed, documented with JSDoc, and pass the provided test case.',
    inputFiles: ['src/utils/math.js', 'test/math.test.js'],
    expectedOutcome:
      'A new exported function appears in src/utils/math.js, is covered by ' +
      'the test file, and all tests pass.',
    scoringRubric: { ...DEFAULT_RUBRIC },
  },

  'fix-bug': {
    name: 'fix-bug',
    description:
      'Fix a known bug described in a comment or failing test. The fix must ' +
      'resolve the failure without introducing new ones.',
    inputFiles: ['src/services/calculator.js', 'test/calculator.test.js'],
    expectedOutcome:
      'The previously failing test passes. No other tests break. The fix is ' +
      'minimal and does not refactor unrelated code.',
    scoringRubric: {
      ...DEFAULT_RUBRIC,
      correctnessWeight: 0.40,
      completenessWeight: 0.20,
    },
  },

  'refactor': {
    name: 'refactor',
    description:
      'Refactor existing code to use a specified pattern (e.g. replace ' +
      'callbacks with async/await) while preserving behaviour.',
    inputFiles: ['src/services/fetcher.js', 'test/fetcher.test.js'],
    expectedOutcome:
      'The module uses the target pattern. All existing tests still pass. ' +
      'External API surface is unchanged.',
    scoringRubric: {
      ...DEFAULT_RUBRIC,
      codeQualityWeight: 0.25,
      correctnessWeight: 0.30,
    },
  },

  'add-test': {
    name: 'add-test',
    description:
      'Write comprehensive tests for an existing function or module that ' +
      'currently has no test coverage.',
    inputFiles: ['src/utils/strings.js'],
    expectedOutcome:
      'A new test file exists with meaningful test cases covering happy path, ' +
      'edge cases, and error conditions. All tests pass.',
    scoringRubric: {
      ...DEFAULT_RUBRIC,
      completenessWeight: 0.35,
      correctnessWeight: 0.30,
    },
  },

  'explain-code': {
    name: 'explain-code',
    description:
      'Produce a human-readable explanation of what a piece of code does. ' +
      'This is a read-only task — no source files should be modified.',
    inputFiles: ['src/services/auth.js'],
    expectedOutcome:
      'A structured explanation covering purpose, inputs, outputs, side ' +
      'effects, and key algorithmic steps. No files are modified.',
    scoringRubric: {
      correctnessWeight: 0.30,
      completenessWeight: 0.35,
      efficiencyWeight: 0.10,
      speedWeight: 0.10,
      codeQualityWeight: 0.15,
      maxTimeMs: 30_000,
      maxLlmCalls: 5,
    },
  },
});

// ---------------------------------------------------------------------------
// generateReport
// ---------------------------------------------------------------------------

/**
 * Format a {@link BenchmarkReport} as a human-readable text block.
 *
 * @param {BenchmarkReport} report
 * @returns {string}
 */
export function generateReport(report) {
  if (!report || typeof report !== 'object') {
    throw new TypeError('generateReport requires a BenchmarkReport object');
  }

  const lines = [];
  const hr = '='.repeat(64);
  const hr2 = '-'.repeat(64);

  lines.push(hr);
  lines.push('  BENCHMARK REPORT');
  lines.push(hr);
  lines.push(`  Run ID     : ${report.id}`);
  lines.push(`  Started    : ${report.startedAt}`);
  lines.push(`  Finished   : ${report.finishedAt}`);
  lines.push(`  Duration   : ${(report.totalDurationMs / 1000).toFixed(1)}s`);
  lines.push(`  Tasks      : ${report.tasks.length} total, ${report.passed} passed, ${report.failed} failed`);
  lines.push(`  Overall    : ${report.overallScore} / 100`);
  lines.push('');

  // Average dimensions
  lines.push(hr2);
  lines.push('  AVERAGE DIMENSION SCORES');
  lines.push(hr2);
  const ad = report.averageDimensions;
  lines.push(`  Correctness  : ${ad.correctness}`);
  lines.push(`  Completeness : ${ad.completeness}`);
  lines.push(`  Efficiency   : ${ad.efficiency}`);
  lines.push(`  Speed        : ${ad.speed}`);
  lines.push(`  Code Quality : ${ad.codeQuality}`);
  lines.push('');

  // Per-task breakdown
  for (const t of report.tasks) {
    lines.push(hr2);
    const icon = t.success ? '[PASS]' : '[FAIL]';
    lines.push(`  ${icon} ${t.taskName}  —  ${t.weightedScore} / 100`);
    lines.push(`    Duration   : ${(t.durationMs / 1000).toFixed(1)}s`);
    lines.push(`    LLM Calls  : ${t.llmCalls}`);
    lines.push(`    Tokens     : ${t.tokensUsed}`);
    lines.push(`    Correctness  : ${t.dimensions.correctness}`);
    lines.push(`    Completeness : ${t.dimensions.completeness}`);
    lines.push(`    Efficiency   : ${t.dimensions.efficiency}`);
    lines.push(`    Speed        : ${t.dimensions.speed}`);
    lines.push(`    Code Quality : ${t.dimensions.codeQuality}`);
    if (t.errors.length > 0) {
      lines.push(`    Errors     : ${t.errors.join('; ')}`);
    }
  }

  lines.push('');
  lines.push(hr);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// compareReports
// ---------------------------------------------------------------------------

/**
 * Compare two benchmark reports and detect regressions.
 *
 * A task is considered regressed when its weighted score dropped by more than
 * 5 points from report A to report B.
 *
 * @param {BenchmarkReport} reportA — baseline
 * @param {BenchmarkReport} reportB — candidate
 * @returns {{
 *   overallDelta: number,
 *   regressions: RegressionDelta[],
 *   improvements: RegressionDelta[],
 *   unchanged: string[],
 *   summary: string,
 * }}
 */
export function compareReports(reportA, reportB) {
  if (!reportA || !reportB) {
    throw new TypeError('compareReports requires two BenchmarkReport objects');
  }

  const mapA = new Map((reportA.tasks || []).map((t) => [t.taskName, t]));
  const mapB = new Map((reportB.tasks || []).map((t) => [t.taskName, t]));

  const regressions = [];
  const improvements = [];
  const unchanged = [];

  // Compare overlapping tasks
  for (const [name, taskA] of mapA) {
    const taskB = mapB.get(name);
    if (!taskB) continue;

    const delta = taskB.weightedScore - taskA.weightedScore;
    const entry = {
      taskName: name,
      scoreA: taskA.weightedScore,
      scoreB: taskB.weightedScore,
      delta,
      regressed: delta < -5,
    };

    if (delta < -5) regressions.push(entry);
    else if (delta > 5) improvements.push(entry);
    else unchanged.push(name);
  }

  const overallDelta = reportB.overallScore - reportA.overallScore;

  // Build summary text
  const parts = [];
  parts.push(`Overall: ${reportA.overallScore} -> ${reportB.overallScore} (${overallDelta >= 0 ? '+' : ''}${overallDelta})`);
  if (regressions.length) {
    parts.push(`Regressions (${regressions.length}): ${regressions.map((r) => `${r.taskName} (${r.scoreA}->${r.scoreB})`).join(', ')}`);
  }
  if (improvements.length) {
    parts.push(`Improvements (${improvements.length}): ${improvements.map((r) => `${r.taskName} (${r.scoreA}->${r.scoreB})`).join(', ')}`);
  }
  if (unchanged.length) {
    parts.push(`Unchanged (${unchanged.length}): ${unchanged.join(', ')}`);
  }

  return {
    overallDelta,
    regressions,
    improvements,
    unchanged,
    summary: parts.join('\n'),
  };
}
