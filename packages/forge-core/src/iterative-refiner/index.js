/**
 * IterativeRefiner — multi-pass code generation refinement with self-critique.
 *
 * Instead of single-pass generation, runs 2-3 iterations with self-critique
 * between each pass.  Each pass improves the generated code by feeding back
 * LLM-identified issues plus heuristic quality scores.
 *
 * Usage:
 *   const refiner = new IterativeRefiner({ maxPasses: 3, qualityThreshold: 85 });
 *   const result = await refiner.refine(task, llmCaller);
 *   // result.code — best generated code
 *   // result.converged — whether quality met the threshold
 *
 * The only external dependency is an `llmCaller` function passed in by the
 * caller, making this module fully standalone.
 *
 * @module iterative-refiner
 */

import {
  DEFAULTS,
  IssueCategory,
  Severity,
  extractCode,
  scoreCodeQuality as _scoreCodeQuality,
  parseCritiqueResponse,
  buildGenerationPrompt,
  buildImprovementPrompt,
  getTemperatureForPass,
} from './helpers.js';

// ─── JSDoc Type Definitions ──────────────────────────────────────────────────

/**
 * @typedef {object} RefinerOptions
 * @property {number} maxPasses
 * @property {number} qualityThreshold
 * @property {boolean} selfCritiqueEnabled
 * @property {string} diversityStrategy
 * @property {number} minImprovement
 */

/**
 * @typedef {object} RefinementResult
 * @property {string} code — final refined code (alias for bestCode)
 * @property {number} passes — total number of passes executed
 * @property {number[]} qualityScores — heuristic score for each pass
 * @property {number} finalScore — final quality score (0-100)
 * @property {CritiqueResult[]} critiqueLog — critique results per pass
 * @property {boolean} converged — whether quality met the threshold
 * @property {string} bestCode — code from the highest-scoring pass
 * @property {number} bestScore — highest quality score achieved
 * @property {PassDetail[]} passDetails — details for each pass
 */

/**
 * @typedef {object} PassDetail
 * @property {number} pass — pass number (1-based)
 * @property {string} code — code generated in this pass
 * @property {number} score — heuristic quality score
 * @property {QualityCheck[]} checks — individual quality check results
 * @property {CritiqueResult|null} critique — self-critique result (null for pass 1)
 * @property {number} [delta] — score change from previous pass
 */

/**
 * @typedef {object} CritiqueResult
 * @property {CritiqueIssue[]} issues — identified issues
 * @property {number} score — LLM-assigned quality score (0-100)
 * @property {string} summary — overall assessment text
 * @property {string} [error] — error message if critique failed
 */

/**
 * @typedef {object} CritiqueIssue
 * @property {string} severity — 'critical' | 'warning' | 'info'
 * @property {string} category — issue category
 * @property {string} description — human-readable issue description
 * @property {number|null} line — approximate line number
 * @property {string} fix — suggested fix
 */

/**
 * @typedef {object} QualityCheck
 * @property {string} name — check identifier
 * @property {boolean} passed — whether the check passed
 * @property {number} points — points earned
 * @property {number} max — maximum points possible
 */

// ─── IterativeRefiner ────────────────────────────────────────────────────────

/**
 * Multi-pass code generation refinement with self-critique.
 *
 * Algorithm:
 *   Pass 1 — Generate initial code with a detailed prompt.
 *   Pass 2 — Self-critique the output, identify issues, generate improvement.
 *   Pass 3 (if needed) — Focus on remaining specific issues from pass 2.
 *   Early stop when quality >= threshold or improvement < minImprovement.
 */
export class IterativeRefiner {
  /** @type {number} */ #maxPasses;
  /** @type {number} */ #qualityThreshold;
  /** @type {boolean} */ #selfCritiqueEnabled;
  /** @type {string} */ #diversityStrategy;
  /** @type {number} */ #minImprovement;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxPasses=3] — maximum refinement passes (2-5 recommended)
   * @param {number} [opts.qualityThreshold=85] — score 0-100 at which to stop early
   * @param {boolean} [opts.selfCritiqueEnabled=true] — enable LLM self-critique between passes
   * @param {string} [opts.diversityStrategy='temperature'] — strategy for variation across passes
   * @param {number} [opts.minImprovement=5] — minimum score delta to continue refining
   */
  constructor(opts = {}) {
    const merged = { ...DEFAULTS, ...opts };
    this.#maxPasses = Math.max(1, Math.min(10, merged.maxPasses));
    this.#qualityThreshold = Math.max(0, Math.min(100, merged.qualityThreshold));
    this.#selfCritiqueEnabled = merged.selfCritiqueEnabled;
    this.#diversityStrategy = merged.diversityStrategy;
    this.#minImprovement = Math.max(0, merged.minImprovement);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Run the full iterative refinement loop.
   *
   * @param {object} task — task descriptor
   * @param {string} task.prompt — natural-language task description
   * @param {string} [task.context] — codebase context (file contents, architecture notes)
   * @param {string[]} [task.expectedFiles] — expected output file paths
   * @param {string[]} [task.constraints] — additional coding constraints
   * @param {Function} llmCaller — async (prompt, systemPrompt, options) => string
   * @param {object} [opts] — per-run overrides
   * @param {Function} [opts.onPassComplete] — callback(passNumber, result)
   * @returns {Promise<RefinementResult>}
   */
  async refine(task, llmCaller, opts = {}) {
    /** @type {RefinementResult} */
    const result = {
      code: '',
      passes: 0,
      qualityScores: [],
      finalScore: 0,
      critiqueLog: [],
      converged: false,
      bestCode: '',
      bestScore: 0,
      passDetails: [],
    };

    // ── Pass 1: initial generation ──────────────────────────────────────
    let currentCode = await this.#generateInitial(task, llmCaller);
    let currentScore = this.scoreCodeQuality(currentCode, task);

    result.passes = 1;
    result.qualityScores.push(currentScore.score);
    result.bestCode = currentCode;
    result.bestScore = currentScore.score;
    result.code = currentCode;
    result.passDetails.push({
      pass: 1,
      code: currentCode,
      score: currentScore.score,
      checks: currentScore.checks,
      critique: null,
    });

    if (typeof opts.onPassComplete === 'function') {
      opts.onPassComplete(1, { code: currentCode, score: currentScore.score });
    }

    // Early convergence: already above threshold
    if (currentScore.score >= this.#qualityThreshold) {
      result.converged = true;
      result.finalScore = currentScore.score;
      return result;
    }

    // ── Passes 2..N: critique + improvement ─────────────────────────────
    for (let pass = 2; pass <= this.#maxPasses; pass++) {
      // Step A: self-critique
      let critique = null;
      if (this.#selfCritiqueEnabled) {
        critique = await this.#selfCritique(currentCode, task, llmCaller);
        result.critiqueLog.push(critique);
      }

      // Step B: generate improved version
      const improvedCode = await this.#generateImprovement(
        currentCode, critique, task, llmCaller, pass,
      );

      // Step C: score the improvement
      const improvedScore = this.scoreCodeQuality(improvedCode, task);
      const delta = improvedScore.score - currentScore.score;

      result.passes = pass;
      result.qualityScores.push(improvedScore.score);
      result.passDetails.push({
        pass,
        code: improvedCode,
        score: improvedScore.score,
        checks: improvedScore.checks,
        critique,
        delta,
      });

      if (typeof opts.onPassComplete === 'function') {
        opts.onPassComplete(pass, {
          code: improvedCode,
          score: improvedScore.score,
          delta,
        });
      }

      // Accept improvement only if it is actually better (or equal)
      if (improvedScore.score >= currentScore.score) {
        currentCode = improvedCode;
        currentScore = improvedScore;
      }
      // else: keep previous version (don't make things worse)

      // Update best
      if (currentScore.score > result.bestScore) {
        result.bestCode = currentCode;
        result.bestScore = currentScore.score;
      }

      // Early stop: quality met
      if (currentScore.score >= this.#qualityThreshold) {
        result.converged = true;
        break;
      }

      // Early stop: improvement too small to justify another pass
      if (pass > 2 && Math.abs(delta) < this.#minImprovement) {
        break;
      }
    }

    result.code = result.bestCode;
    result.finalScore = result.bestScore;
    return result;
  }

  /**
   * Score code quality using heuristic checks (no LLM required).
   *
   * @param {string} code — generated source code
   * @param {object} task — the original task descriptor
   * @returns {{ score: number, checks: QualityCheck[] }}
   */
  scoreCodeQuality(code, task = {}) {
    return _scoreCodeQuality(code, task);
  }

  // ── Private: Generation ────────────────────────────────────────────────────

  /**
   * Generate the initial code from the task.
   *
   * @param {object} task
   * @param {Function} llmCaller
   * @returns {Promise<string>}
   */
  async #generateInitial(task, llmCaller) {
    const systemPrompt = [
      'You are an expert software engineer. Generate clean, production-quality code.',
      'Follow best practices for the target language.',
      'Include all necessary imports, error handling, and documentation.',
      'Do NOT include TODO, FIXME, or HACK comments.',
      'Do NOT include console.log statements in production code.',
      'Output ONLY the code — no explanations, no markdown fences.',
    ].join('\n');

    const userPrompt = buildGenerationPrompt(task, 1);

    try {
      const response = await llmCaller(userPrompt, systemPrompt, {
        temperature: 0.2,
        maxTokens: 8192,
      });
      return extractCode(response);
    } catch (err) {
      // If LLM call fails, return an empty scaffold so the caller can decide
      return `// Initial generation failed: ${err.message}\n// Task: ${task.prompt || ''}\n`;
    }
  }

  // ── Private: Self-Critique ─────────────────────────────────────────────────

  /**
   * Run self-critique on generated code using the LLM as a code reviewer.
   *
   * @param {string} code — the generated code to critique
   * @param {object} task — original task descriptor
   * @param {Function} llmCaller
   * @returns {Promise<CritiqueResult>}
   */
  async #selfCritique(code, task, llmCaller) {
    const systemPrompt = [
      'You are a senior code reviewer. Analyze the provided code for issues.',
      'Be specific and constructive.',
      'For each issue, provide: severity (critical/warning/info), category, description,',
      'approximate line number if identifiable, and a suggested fix.',
      'Categories: bug, missing_feature, style, import, type, performance, security.',
      'Output a JSON object with this exact structure:',
      '{ "issues": [ { "severity": "...", "category": "...", "description": "...", "line": 0, "fix": "..." } ],',
      '  "score": 0-100,',
      '  "summary": "brief overall assessment" }',
    ].join('\n');

    const userPrompt = [
      `## Original Task\n${task.prompt || 'Code review'}`,
      task.expectedFiles?.length > 0
        ? `## Expected Files\n${task.expectedFiles.map(f => `- ${f}`).join('\n')}`
        : '',
      `## Code to Review\n\`\`\`\n${code}\n\`\`\``,
      'Review this code thoroughly. Output the JSON review object.',
    ].filter(Boolean).join('\n\n');

    try {
      const response = await llmCaller(userPrompt, systemPrompt, {
        temperature: 0.1,
        maxTokens: 4096,
        responseFormat: 'json',
      });
      return parseCritiqueResponse(response);
    } catch (err) {
      // If critique fails, return a neutral result
      return {
        issues: [],
        score: 50,
        summary: `Critique failed: ${err.message}`,
        error: err.message,
      };
    }
  }

  // ── Private: Improvement Generation ────────────────────────────────────────

  /**
   * Generate improved code based on critique findings.
   *
   * @param {string} previousCode — code from the previous pass
   * @param {CritiqueResult|null} critique — issues found in self-critique
   * @param {object} task — original task descriptor
   * @param {Function} llmCaller
   * @param {number} passNumber — current pass number (affects strategy)
   * @returns {Promise<string>}
   */
  async #generateImprovement(previousCode, critique, task, llmCaller, passNumber) {
    const systemPrompt = [
      'You are an expert software engineer performinging code refinement.',
      'You will receive existing code and a list of issues to fix.',
      'Fix ONLY the identified issues. Preserve all working code.',
      'Do NOT remove working functionality.',
      'Do NOT add TODO/FIXME/HACK comments.',
      'Output ONLY the improved code — no explanations, no markdown fences.',
    ].join('\n');

    const userPrompt = buildImprovementPrompt(previousCode, critique, task, passNumber);

    try {
      // Apply diversity strategy for temperature
      const temperature = getTemperatureForPass(this.#diversityStrategy, passNumber);
      const response = await llmCaller(userPrompt, systemPrompt, {
        temperature,
        maxTokens: 8192,
      });
      return extractCode(response);
    } catch (err) {
      // If improvement fails, return previous code unchanged
      return previousCode;
    }
  }
}

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { IssueCategory, Severity };
