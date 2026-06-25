/**
 * Benchmark Framework — structured evaluation of Forge coding performance.
 *
 * Provides a reproducible harness for scoring autonomous coding tasks across
 * five dimensions: correctness, completeness, efficiency, speed, and code
 * quality.  Ships with pre-defined tasks for common scenarios and supports
 * regression detection between runs.
 *
 * @module benchmark
 */

import {
  DEFAULT_RUBRIC,
  PASS_THRESHOLD,
  BENCHMARK_TASKS,
  generateReport,
  compareReports,
} from './helpers.js';

// Re-export for backward compatibility
export { DEFAULT_RUBRIC, PASS_THRESHOLD, BENCHMARK_TASKS, generateReport, compareReports };

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

/**
 * Scorer — evaluates a task execution result across five dimensions.
 *
 * Each dimension produces a score from 0 to 100.  The weighted composite is
 * computed using the task's {@link ScoringRubric}.
 */
export class Scorer {
  /**
   * Evaluate correctness — does the output match expected behaviour?
   *
   * @param {object} evidence
   * @param {boolean} evidence.testsPass — did all tests pass?
   * @param {number}  [evidence.testsPassed] — count of tests that passed
   * @param {number}  [evidence.testsTotal] — total test count
   * @param {boolean} [evidence.outputMatches] — does output match expected?
   * @returns {number} 0-100
   */
  scoreCorrectness(evidence) {
    if (!evidence) return 0;
    let score = 0;

    // Base: tests pass/fail
    if (evidence.testsPass) {
      score += 60;
    } else if (evidence.testsTotal && evidence.testsPassed != null) {
      const ratio = evidence.testsPassed / evidence.testsTotal;
      score += Math.round(60 * ratio);
    }

    // Bonus: explicit output match
    if (evidence.outputMatches) {
      score += 40;
    } else if (evidence.testsPass) {
      // If tests pass but no explicit output match, partial credit
      score += 25;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Evaluate completeness — were all requirements addressed?
   *
   * @param {object} evidence
   * @param {string[]} evidence.requirements — list of stated requirements
   * @param {string[]} evidence.met — list of requirements that were met
   * @param {boolean}  [evidence.filesModified] — were expected files touched?
   * @returns {number} 0-100
   */
  scoreCompleteness(evidence) {
    if (!evidence) return 0;

    const reqs = evidence.requirements || [];
    const met = evidence.met || [];

    if (reqs.length === 0) {
      // No explicit requirements — use filesModified as proxy
      return evidence.filesModified ? 70 : 20;
    }

    const ratio = met.length / reqs.length;
    let score = Math.round(ratio * 80);

    // Bonus for file modifications when expected
    if (evidence.filesModified) {
      score += 20;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Evaluate efficiency — how many LLM calls / tokens were consumed?
   *
   * @param {object} evidence
   * @param {number} evidence.llmCalls — actual LLM calls made
   * @param {number} [evidence.tokensUsed] — total tokens consumed
   * @param {number} [evidence.maxLlmCalls] — budget ceiling
   * @returns {number} 0-100
   */
  scoreEfficiency(evidence) {
    if (!evidence) return 0;

    const calls = evidence.llmCalls ?? 0;
    const budget = evidence.maxLlmCalls ?? DEFAULT_RUBRIC.maxLlmCalls;

    if (calls <= 0) return 100;
    if (calls <= budget) {
      // Linear scale: 1 call = 100, budget calls = 60
      const ratio = calls / budget;
      return Math.round(100 - ratio * 40);
    }

    // Over budget: steep penalty
    const over = (calls - budget) / budget;
    return Math.max(0, Math.round(60 - over * 60));
  }

  /**
   * Evaluate speed — wall-clock duration relative to budget.
   *
   * @param {object} evidence
   * @param {number} evidence.durationMs — actual wall time
   * @param {number} [evidence.maxTimeMs] — time budget
   * @returns {number} 0-100
   */
  scoreSpeed(evidence) {
    if (!evidence) return 0;

    const dur = evidence.durationMs ?? 0;
    const budget = evidence.maxTimeMs ?? DEFAULT_RUBRIC.maxTimeMs;

    if (dur <= 0) return 100;
    if (dur <= budget) {
      // Linear: instant = 100, budget = 50
      const ratio = dur / budget;
      return Math.round(100 - ratio * 50);
    }

    // Over budget
    const over = (dur - budget) / budget;
    return Math.max(0, Math.round(50 - over * 50));
  }

  /**
   * Evaluate code quality — does the result pass lint/typecheck?
   *
   * @param {object} evidence
   * @param {boolean} [evidence.lintPass] — ESLint or equivalent passed
   * @param {boolean} [evidence.typeCheckPass] — TypeScript / JSDoc check passed
   * @param {boolean} [evidence.noWarnings] — zero warnings
   * @param {number}  [evidence.complexity] — cyclomatic complexity (lower = better)
   * @returns {number} 0-100
   */
  scoreCodeQuality(evidence) {
    if (!evidence) return 0;

    let score = 0;
    if (evidence.lintPass) score += 35;
    if (evidence.typeCheckPass) score += 35;
    if (evidence.noWarnings) score += 15;

    // Complexity bonus: <= 5 = full, <= 10 = half, > 10 = 0
    if (evidence.complexity != null) {
      if (evidence.complexity <= 5) score += 15;
      else if (evidence.complexity <= 10) score += 8;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Compute all five dimension scores from raw evidence.
   *
   * @param {object} evidence — merged evidence object
   * @returns {DimensionScores}
   */
  scoreAll(evidence) {
    return {
      correctness: this.scoreCorrectness(evidence),
      completeness: this.scoreCompleteness(evidence),
      efficiency: this.scoreEfficiency(evidence),
      speed: this.scoreSpeed(evidence),
      codeQuality: this.scoreCodeQuality(evidence),
    };
  }

  /**
   * Compute the weighted composite score from dimension scores and a rubric.
   *
   * @param {DimensionScores} dims
   * @param {ScoringRubric} rubric
   * @returns {number} 0-100
   */
  weightedScore(dims, rubric) {
    const r = { ...DEFAULT_RUBRIC, ...rubric };
    const total =
      dims.correctness * r.correctnessWeight +
      dims.completeness * r.completenessWeight +
      dims.efficiency * r.efficiencyWeight +
      dims.speed * r.speedWeight +
      dims.codeQuality * r.codeQualityWeight;
    return Math.round(Math.min(100, Math.max(0, total)));
  }
}

// ---------------------------------------------------------------------------
// BenchmarkSuite
// ---------------------------------------------------------------------------

/**
 * BenchmarkSuite — runs a collection of {@link BenchmarkTaskDef} tasks against
 * a Forge instance, collects metrics, and produces a {@link BenchmarkReport}.
 */
export class BenchmarkSuite {
  /** @type {BenchmarkTaskDef[]} */
  #tasks = [];

  /** @type {Scorer} */
  #scorer;

  /**
   * @param {object} [opts]
   * @param {BenchmarkTaskDef[]} [opts.tasks] — initial task list
   * @param {Scorer} [opts.scorer] — custom scorer instance
   */
  constructor({ tasks, scorer } = {}) {
    this.#scorer = scorer ?? new Scorer();
    if (Array.isArray(tasks)) {
      for (const t of tasks) this.addTask(t);
    }
  }

  /** @returns {number} — number of registered tasks */
  get taskCount() {
    return this.#tasks.length;
  }

  /** @returns {BenchmarkTaskDef[]} — shallow copy of task list */
  get tasks() {
    return [...this.#tasks];
  }

  /** @returns {Scorer} */
  get scorer() {
    return this.#scorer;
  }

  /**
   * Register a new task.
   *
   * @param {BenchmarkTaskDef} task
   * @returns {this}
   */
  addTask(task) {
    if (!task || typeof task.name !== 'string' || !task.name) {
      throw new TypeError('BenchmarkTask requires a non-empty name');
    }
    this.#tasks.push({
      name: task.name,
      description: task.description ?? '',
      inputFiles: Array.isArray(task.inputFiles) ? [...task.inputFiles] : [],
      expectedOutcome: task.expectedOutcome ?? '',
      scoringRubric: { ...DEFAULT_RUBRIC, ...(task.scoringRubric || {}) },
    });
    return this;
  }

  /**
   * Remove a task by name.
   *
   * @param {string} name
   * @returns {boolean} true if a task was removed
   */
  removeTask(name) {
    const idx = this.#tasks.findIndex((t) => t.name === name);
    if (idx === -1) return false;
    this.#tasks.splice(idx, 1);
    return true;
  }

  /**
   * Execute all registered tasks against a Forge-like executor.
   *
   * The executor is expected to expose either:
   *   - `run(goal: string): Promise<{ filesModified, llmCalls, tokensUsed, ... }>`
   *   - or a callable `(goal: string) => Promise<...>`
   *
   * @param {object|Function} forge — Forge instance or executor function
   * @param {object} [opts]
   * @param {Function} [opts.onTaskStart]  — (task) => void
   * @param {Function} [opts.onTaskEnd]    — (task, result) => void
   * @param {Function} [opts.evaluate]     — (task, forgeResult) => evidence overrides
   * @returns {Promise<BenchmarkReport>}
   */
  async run(forge, opts = {}) {
    const { onTaskStart, onTaskEnd, evaluate } = opts;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const results = [];

    for (const task of this.#tasks) {
      if (typeof onTaskStart === 'function') onTaskStart(task);

      const taskStart = Date.now();
      let forgeResult = null;
      const errors = [];

      try {
        // Execute the task through the forge
        if (typeof forge === 'function') {
          forgeResult = await forge(task.description);
        } else if (forge && typeof forge.run === 'function') {
          forgeResult = await forge.run(task.description);
        } else {
          throw new Error('forge must be a function or expose .run()');
        }
      } catch (err) {
        errors.push(err.message || String(err));
      }

      const durationMs = Date.now() - taskStart;
      const raw = forgeResult || {};

      // Build evidence — allow caller overrides
      const evidence =
        typeof evaluate === 'function'
          ? evaluate(task, raw)
          : {
              testsPass: raw.testsPass ?? (errors.length === 0),
              testsPassed: raw.testsPassed ?? 0,
              testsTotal: raw.testsTotal ?? 0,
              outputMatches: raw.outputMatches ?? false,
              requirements: raw.requirements ?? [],
              met: raw.met ?? [],
              filesModified: raw.filesModified ?? false,
              llmCalls: raw.llmCalls ?? 0,
              tokensUsed: raw.tokensUsed ?? 0,
              durationMs,
              maxTimeMs: task.scoringRubric.maxTimeMs,
              maxLlmCalls: task.scoringRubric.maxLlmCalls,
              lintPass: raw.lintPass ?? false,
              typeCheckPass: raw.typeCheckPass ?? false,
              noWarnings: raw.noWarnings ?? false,
              complexity: raw.complexity ?? null,
            };

      const dims = this.#scorer.scoreAll(evidence);
      const weighted = this.#scorer.weightedScore(dims, task.scoringRubric);

      const taskResult = {
        taskName: task.name,
        dimensions: dims,
        weightedScore: weighted,
        durationMs,
        llmCalls: raw.llmCalls ?? 0,
        tokensUsed: raw.tokensUsed ?? 0,
        success: weighted >= PASS_THRESHOLD,
        errors,
      };

      results.push(taskResult);
      if (typeof onTaskEnd === 'function') onTaskEnd(task, taskResult);
    }

    const finishedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - startMs;

    return this.#buildReport(startedAt, finishedAt, totalDurationMs, results);
  }

  /**
   * Build a structured report from collected results.
   *
   * @param {string} startedAt
   * @param {string} finishedAt
   * @param {number} totalDurationMs
   * @param {TaskResult[]} results
   * @returns {BenchmarkReport}
   * @private
   */
  #buildReport(startedAt, finishedAt, totalDurationMs, results) {
    const dims = { correctness: 0, completeness: 0, efficiency: 0, speed: 0, codeQuality: 0 };
    let overallSum = 0;
    let passed = 0;
    let failed = 0;

    for (const r of results) {
      dims.correctness += r.dimensions.correctness;
      dims.completeness += r.dimensions.completeness;
      dims.efficiency += r.dimensions.efficiency;
      dims.speed += r.dimensions.speed;
      dims.codeQuality += r.dimensions.codeQuality;
      overallSum += r.weightedScore;
      if (r.success) passed++;
      else failed++;
    }

    const n = results.length || 1;
    const averageDimensions = {
      correctness: Math.round(dims.correctness / n),
      completeness: Math.round(dims.completeness / n),
      efficiency: Math.round(dims.efficiency / n),
      speed: Math.round(dims.speed / n),
      codeQuality: Math.round(dims.codeQuality / n),
    };

    const overallScore = results.length
      ? Math.round(overallSum / results.length)
      : 0;

    return {
      id: `bench-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt,
      finishedAt,
      totalDurationMs,
      tasks: results,
      averageDimensions,
      overallScore,
      passed,
      failed,
    };
  }
}

// ---------------------------------------------------------------------------
// Top-level helper: runBenchmark
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper — create a suite, run tasks, and return a report.
 *
 * @param {object|Function} forge — Forge instance or executor function
 * @param {BenchmarkTaskDef[]} [tasks] — defaults to all BENCHMARK_TASKS
 * @param {object} [opts] — forwarded to BenchmarkSuite.run()
 * @returns {Promise<BenchmarkReport>}
 */
export async function runBenchmark(forge, tasks, opts) {
  const taskList = tasks ?? Object.values(BENCHMARK_TASKS);
  const suite = new BenchmarkSuite({ tasks: taskList });
  return suite.run(forge, opts);
}
