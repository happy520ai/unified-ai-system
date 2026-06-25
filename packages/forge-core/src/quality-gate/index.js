/**
 * QualityGate — validates generated code before accepting it.
 *
 * Runs a suite of heuristic and structural checks on generated code to
 * determine whether it meets minimum quality standards.  Blocking issues
 * prevent acceptance; warnings are advisory only.
 *
 * Usage:
 *   const gate = new QualityGate({ minScore: 70, forbiddenPatterns: [/eval\s*\(/] });
 *   const result = await gate.evaluate(code, task);
 *   if (result.passed) { ... }
 *
 * @module quality-gate
 */

import {
  DEFAULTS, CheckSeverity,
  compareVersions as _compareVersions,
  checkAntiPatterns as _checkAntiPatterns,
  checkStructure as _checkStructure,
  checkRequirements as _checkRequirements,
  checkSyntax as _checkSyntax,
  detectLanguage as _detectLanguage,
  computeScore as _computeScore,
} from './helpers.js';

// ─── QualityGate ─────────────────────────────────────────────────────────────

/**
 * Validates generated code against configurable quality criteria.
 */
export class QualityGate {
  /** @type {number} */ #minScore;
  /** @type {boolean} */ #requireTests;
  /** @type {boolean} */ #requireTypes;
  /** @type {RegExp[]} */ #forbiddenPatterns;
  /** @type {RegExp[]} */ #requiredPatterns;

  /**
   * @param {object} [opts]
   * @param {number} [opts.minScore=70] — minimum score (0-100) to pass the gate
   * @param {boolean} [opts.requireTests=false] — require test patterns (describe/it/test)
   * @param {boolean} [opts.requireTypes=false] — require TypeScript-style type annotations
   * @param {Array<RegExp|string>} [opts.forbiddenPatterns=[]] — regex patterns that must NOT appear
   * @param {Array<RegExp|string>} [opts.requiredPatterns=[]] — regex patterns that MUST appear
   */
  constructor(opts = {}) {
    const merged = { ...DEFAULTS, ...opts };
    this.#minScore = Math.max(0, Math.min(100, merged.minScore));
    this.#requireTests = merged.requireTests;
    this.#requireTypes = merged.requireTypes;
    this.#forbiddenPatterns = merged.forbiddenPatterns.map(p =>
      p instanceof RegExp ? p : new RegExp(p, 'g'),
    );
    this.#requiredPatterns = merged.requiredPatterns.map(p =>
      p instanceof RegExp ? p : new RegExp(p, 'g'),
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Run all quality checks on generated code.
   *
   * @param {string} code — generated source code
   * @param {object} task — task descriptor (may contain constraints and expected files)
   * @param {object} [opts] — per-evaluation overrides
   * @param {string} [opts.language] — override language detection ('js', 'ts', 'other')
   * @returns {Promise<EvaluationResult>}
   */
  async evaluate(code, task = {}, opts = {}) {
    /** @type {QualityCheckResult[]} */
    const checks = [];
    /** @type {string[]} */
    const blockingIssues = [];
    /** @type {string[]} */
    const warnings = [];

    if (typeof code !== 'string' || code.trim().length === 0) {
      return {
        passed: false,
        score: 0,
        checks: [{ name: 'non_empty', passed: false, severity: CheckSeverity.ERROR, detail: 'Code is empty or not a string' }],
        blockingIssues: ['Generated code is empty'],
        warnings: [],
      };
    }

    // Detect language
    const language = opts.language || _detectLanguage(code, task);

    // 1. Syntax check
    const syntaxResult = _checkSyntax(code, language);
    checks.push({
      name: 'syntax',
      passed: syntaxResult.valid,
      severity: syntaxResult.valid ? CheckSeverity.INFO : CheckSeverity.ERROR,
      detail: syntaxResult.valid ? 'Syntax OK' : syntaxResult.errors.join('; '),
    });
    if (!syntaxResult.valid) {
      blockingIssues.push(`Syntax errors: ${syntaxResult.errors.join('; ')}`);
    }

    // 2. Anti-pattern check
    const antiPatterns = _checkAntiPatterns(code);
    for (const ap of antiPatterns) {
      const sev = ap.severity === 'error' ? CheckSeverity.ERROR : CheckSeverity.WARNING;
      checks.push({
        name: `anti_pattern:${ap.pattern}`,
        passed: ap.severity !== 'error',
        severity: sev,
        detail: ap.suggestion || `Anti-pattern detected: ${ap.pattern}${ap.line ? ` (line ${ap.line})` : ''}`,
      });
      if (ap.severity === 'error') {
        blockingIssues.push(ap.suggestion || ap.pattern);
      } else {
        warnings.push(ap.suggestion || ap.pattern);
      }
    }

    // 3. Structure check
    const structureChecks = _checkStructure(code, task);
    for (const sc of structureChecks) {
      checks.push({
        name: `structure:${sc.check}`,
        passed: sc.passed,
        severity: sc.passed ? CheckSeverity.INFO : CheckSeverity.WARNING,
        detail: sc.detail || (sc.passed ? 'OK' : 'Failed'),
      });
      if (!sc.passed) {
        warnings.push(`Structure: ${sc.check} — ${sc.detail || 'failed'}`);
      }
    }

    // 4. Requirements check
    const reqChecks = _checkRequirements(code, task);
    for (const rq of reqChecks) {
      checks.push({
        name: `requirement:${rq.requirement}`,
        passed: rq.met,
        severity: rq.met ? CheckSeverity.INFO : CheckSeverity.ERROR,
        detail: rq.detail || (rq.met ? 'Met' : 'Not met'),
      });
      if (!rq.met) {
        blockingIssues.push(`Requirement not met: ${rq.requirement} — ${rq.detail || ''}`);
      }
    }

    // 5. Forbidden patterns (user-configured)
    for (const pattern of this.#forbiddenPatterns) {
      const match = code.match(pattern);
      if (match) {
        checks.push({
          name: 'forbidden_pattern',
          passed: false,
          severity: CheckSeverity.ERROR,
          detail: `Forbidden pattern matched: ${pattern.source} — "${match[0].slice(0, 60)}"`,
        });
        blockingIssues.push(`Forbidden pattern: ${pattern.source}`);
      }
    }

    // 6. Required patterns (user-configured)
    for (const pattern of this.#requiredPatterns) {
      const match = code.match(pattern);
      if (!match) {
        checks.push({
          name: 'required_pattern',
          passed: false,
          severity: CheckSeverity.ERROR,
          detail: `Required pattern not found: ${pattern.source}`,
        });
        blockingIssues.push(`Required pattern missing: ${pattern.source}`);
      }
    }

    // 7. Test requirement
    if (this.#requireTests) {
      const hasTests = /\b(?:describe|it|test)\s*\(/.test(code);
      checks.push({
        name: 'has_tests',
        passed: hasTests,
        severity: hasTests ? CheckSeverity.INFO : CheckSeverity.ERROR,
        detail: hasTests ? 'Test patterns found' : 'No test patterns (describe/it/test) found',
      });
      if (!hasTests) blockingIssues.push('Tests required but none found');
    }

    // 8. Type requirement
    if (this.#requireTypes) {
      const hasTypes = /(?::\s*(?:string|number|boolean|void|any|unknown|never|Record|Array|Map|Set|Promise)\b|\binterface\s+\w|\btype\s+\w+\s*=)/.test(code);
      checks.push({
        name: 'has_types',
        passed: hasTypes,
        severity: hasTypes ? CheckSeverity.INFO : CheckSeverity.WARNING,
        detail: hasTypes ? 'Type annotations found' : 'No type annotations found',
      });
      if (!hasTypes) warnings.push('Type annotations required but none found');
    }

    // Compute score
    const score = _computeScore(checks);
    const passed = score >= this.#minScore && blockingIssues.length === 0;

    return { passed, score, checks, blockingIssues, warnings };
  }

  /**
   * Compare two versions of code and assess improvement.
   *
   * @param {string} oldCode — previous version
   * @param {string} newCode — new version
   * @returns {VersionComparison}
   */
  compareVersions(oldCode, newCode) {
    return _compareVersions(oldCode, newCode);
  }
}

// ─── JSDoc Type Definitions (class-specific) ─────────────────────────────────

/**
 * @typedef {object} EvaluationResult
 * @property {boolean} passed — whether the code passes the gate
 * @property {number} score — computed quality score (0-100)
 * @property {QualityCheckResult[]} checks — individual check results
 * @property {string[]} blockingIssues — issues that prevent acceptance
 * @property {string[]} warnings — advisory warnings
 */

/**
 * @typedef {object} QualityCheckResult
 * @property {string} name — check identifier
 * @property {boolean} passed — whether the check passed
 * @property {string} severity — 'error' | 'warning' | 'info'
 * @property {string} detail — human-readable detail
 */

/**
 * @typedef {object} VersionComparison
 * @property {boolean} improved — whether the new version is generally improved
 * @property {string[]} changes — human-readable change descriptions
 * @property {{ lines: number, imports: number, handlers: number, tests: number, comments: number }} delta
 */

// ─── Exports ─────────────────────────────────────────────────────────────────

export { CheckSeverity };
