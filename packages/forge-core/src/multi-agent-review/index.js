/**
 * MultiAgentReview — multi-agent code review system.
 *
 * A reviewer agent checks code produced by a coder agent before it is committed.
 * Goes beyond test-based verification by using pattern-level reasoning to catch
 * logic errors, security issues, style problems, and more.
 *
 * Review flow:
 *   1. Coder agent produces a set of file changes (diffs).
 *   2. `review(changes)` runs every active rule against the NEW code in each diff.
 *   3. Issues are collected, deduplicated, and filtered by severity threshold.
 *   4. A pass/fail decision is returned along with a summary and statistics.
 *
 * Built-in rules cover security, logic, style, performance, maintainability, and
 * testing categories.  Custom rules can be added at runtime.
 *
 * Usage:
 *   const review = new MultiAgentReview({ autoFix: false, severityThreshold: 'warning' });
 *   const result = review.review([{ path, original, modified, action: 'write' }]);
 *   if (!result.passed) { console.log(review.generateReport(result)); }
 */

import { ReviewSeverity, ReviewCategory, SEVERITY_RANK, ALL_CATEGORIES } from './constants.js';
import { BUILTIN_RULES } from './builtin-rules.js';
import { uid, runRules } from './helpers.js';
import {
  computeStats,
  evaluatePass,
  buildSummary,
  pushHistory,
  aggregateStats,
  formatReport,
} from './stats.js';

// Re-export enumerations for backward compatibility
export { ReviewSeverity, ReviewCategory } from './constants.js';

/**
 * @typedef {object} ReviewIssue
 * @property {string} id — unique issue identifier
 * @property {string} severity — one of ReviewSeverity
 * @property {string} category — one of ReviewCategory
 * @property {string} path — file path the issue was found in
 * @property {number} line — 1-based line number
 * @property {number} column — 0-based column number
 * @property {string} message — human-readable description
 * @property {string} [suggestion] — optional fix suggestion text
 * @property {Function} [fix] — optional auto-fix function
 * @property {string} rule — id of the rule that produced this issue
 */

/**
 * @typedef {object} ReviewResult
 * @property {boolean} passed — true when no issues at or above severity threshold
 * @property {ReviewIssue[]} issues — all detected issues
 * @property {string} summary — human-readable one-liner
 * @property {object} stats — breakdown counts
 * @property {number} stats.total — total number of issues
 * @property {Record<string, number>} stats.byCategory — issue count per category
 * @property {Record<string, number>} stats.bySeverity — issue count per severity
 * @property {number} duration — review duration in milliseconds
 */

/**
 * @typedef {object} FileChange
 * @property {string} path — relative file path
 * @property {string} original — original file content (empty string for new files)
 * @property {string} modified — new file content
 * @property {'write'|'edit'} action — write = new/overwrite, edit = partial change
 */

export class MultiAgentReview {
  /** @type {Map<string, object>} all active rules keyed by id */
  #rules = new Map();

  /** @type {number} maximum issues to collect before stopping */
  #maxIssues;

  /** @type {string} minimum severity for a review to fail */
  #severityThreshold;

  /** @type {boolean} whether to apply auto-fixes automatically */
  #autoFix;

  /** @type {number} review timeout in milliseconds */
  #reviewTimeout;

  /** @type {string[]} active categories */
  #categories;

  /** @type {object[]} ring buffer of past review results (max 100) */
  #history = [];

  /** @type {number} maximum entries in the review history ring buffer */
  #historyMax = 100;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxIssues=50] — maximum issues to collect per review
   * @param {string} [opts.severityThreshold='warning'] — minimum severity that causes failure
   * @param {boolean} [opts.autoFix=false] — automatically apply fixes when available
   * @param {number} [opts.reviewTimeout=30000] — timeout in ms for a single review
   * @param {string[]} [opts.categories] — categories to check (default: all)
   */
  constructor(opts = {}) {
    this.#maxIssues = opts.maxIssues ?? 50;
    this.#severityThreshold = opts.severityThreshold ?? ReviewSeverity.WARNING;
    this.#autoFix = opts.autoFix ?? false;
    this.#reviewTimeout = opts.reviewTimeout ?? 30_000;
    this.#categories = opts.categories ?? [...ALL_CATEGORIES];

    // Register all built-in rules
    for (const rule of BUILTIN_RULES) {
      this.#rules.set(rule.id, { ...rule, languages: rule.languages ?? ['all'] });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Review a set of file changes and produce a verdict.
   *
   * @param {FileChange[]} changes — array of file changes to review
   * @param {object} [opts]
   * @param {string[]} [opts.focusCategories] — restrict to these categories for this run
   * @param {string[]} [opts.contextFiles] — additional file paths for context
   * @param {string} [opts.taskDescription] — description of the task that produced the changes
   * @returns {ReviewResult}
   */
  review(changes, opts = {}) {
    const start = Date.now();
    const focusCategories = opts.focusCategories ?? this.#categories;
    const allIssues = [];

    for (const change of changes) {
      if (allIssues.length >= this.#maxIssues) break;
      const fileIssues = this.reviewFile(change.path, change.original, change.modified, {
        focusCategories,
        remaining: this.#maxIssues - allIssues.length,
      });
      allIssues.push(...fileIssues);
    }

    // Deduplicate by path + line + rule
    const seen = new Set();
    const deduplicated = [];
    for (const issue of allIssues) {
      const key = `${issue.path}:${issue.line}:${issue.rule}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(issue);
      }
    }

    const stats = computeStats(deduplicated);
    const passed = evaluatePass(deduplicated, this.#severityThreshold);
    const summary = buildSummary(deduplicated, passed);
    const duration = Date.now() - start;

    const result = { passed, issues: deduplicated, summary, stats, duration };

    // Record in history ring buffer
    pushHistory(this.#history, result, this.#historyMax);

    return result;
  }

  /**
   * Review a single file by comparing original and modified content.
   *
   * Only NEW issues (present in `modified` but not in `original`) are reported.
   *
   * @param {string} path — file path for labelling
   * @param {string} original — original file content
   * @param {string} modified — new file content
   * @param {object} [opts]
   * @param {string[]} [opts.focusCategories] — restrict to these categories
   * @param {number} [opts.remaining] — max issues still allowed
   * @returns {ReviewIssue[]}
   */
  reviewFile(path, original, modified, opts = {}) {
    const focusCategories = opts.focusCategories ?? this.#categories;
    const maxIssues = opts.remaining ?? this.#maxIssues;

    // Collect issues from original so we can subtract pre-existing ones
    const originalIssues = runRules(original, path, focusCategories, this.#rules);
    const modifiedIssues = runRules(modified, path, focusCategories, this.#rules);

    // Build a fingerprint set of original issues
    const originalFps = new Set(
      originalIssues.map((i) => `${i.line}:${i.rule}`)
    );

    // Keep only new issues (not present at same line+rule in original)
    const newIssues = modifiedIssues.filter(
      (i) => !originalFps.has(`${i.line}:${i.rule}`)
    );

    return newIssues.slice(0, maxIssues);
  }

  /**
   * Add a custom review rule.
   *
   * @param {object} rule
   * @param {string} [rule.id] — auto-generated if omitted
   * @param {string} rule.name — human-readable name
   * @param {string} rule.category — one of ReviewCategory
   * @param {string} rule.severity — one of ReviewSeverity
   * @param {RegExp|Function} rule.pattern — regex or function(content) => matches[]
   * @param {string} rule.message — description shown on the issue
   * @param {Function} [rule.fix] — optional auto-fix function
   * @returns {string} the rule id
   */
  addRule(rule) {
    const id = rule.id ?? uid('custom');
    this.#rules.set(id, {
      id,
      name: rule.name ?? id,
      category: rule.category ?? ReviewCategory.STYLE,
      severity: rule.severity ?? ReviewSeverity.WARNING,
      pattern: rule.pattern,
      message: rule.message ?? 'Custom rule violation.',
      fix: rule.fix ?? undefined,
    });
    return id;
  }

  /**
   * Remove a custom or built-in rule by id.
   *
   * @param {string} ruleId
   * @returns {boolean} true if the rule existed and was removed
   */
  removeRule(ruleId) {
    return this.#rules.delete(ruleId);
  }

  /**
   * Get all active rules, optionally filtered.
   *
   * @param {object} [opts]
   * @param {string} [opts.category] — filter by category
   * @param {string} [opts.severity] — filter by severity
   * @returns {Array<object>}
   */
  getRules(opts = {}) {
    let rules = [...this.#rules.values()];
    if (opts.category) {
      rules = rules.filter((r) => r.category === opts.category);
    }
    if (opts.severity) {
      rules = rules.filter((r) => r.severity === opts.severity);
    }
    return rules;
  }

  /**
   * Generate a human-readable review report.
   *
   * @param {ReviewResult} result — the result from review()
   * @returns {string} formatted multi-line report
   */
  generateReport(result) {
    return formatReport(result);
  }

  /**
   * Apply auto-fix suggestions from a review result to a set of files.
   *
   * @param {ReviewResult} result — the review result containing fixable issues
   * @param {Array<{ path: string, content: string }>} files — current file contents
   * @returns {{ fixed: number, files: Array<{ path: string, content: string }> }}
   */
  applyFixes(result, files) {
    const fixableIssues = result.issues.filter((i) => typeof i.fix === 'function');
    const fileMap = new Map(files.map((f) => [f.path, { ...f }]));
    let fixed = 0;

    for (const issue of fixableIssues) {
      const file = fileMap.get(issue.path);
      if (!file) continue;

      try {
        file.content = issue.fix(file.content);
        fixed++;
      } catch {
        // Fix function failed — skip silently
      }
    }

    return { fixed, files: [...fileMap.values()] };
  }

  /**
   * Get aggregate review statistics across the entire history.
   *
   * @returns {{
   *   totalReviews: number,
   *   passed: number,
   *   failed: number,
   *   byCategory: Record<string, number>,
   *   bySeverity: Record<string, number>,
   *   avgIssuesPerReview: number,
   * }}
   */
  getStats() {
    return aggregateStats(this.#history);
  }

  /**
   * Clear review history and reset state.
   */
  clear() {
    this.#history = [];
  }

  /**
   * Quick status snapshot for health-check endpoints.
   *
   * @returns {{ rules: number, reviews: number, passRate: number }}
   */
  getStatus() {
    const totalReviews = this.#history.length;
    const passed = this.#history.filter((h) => h.passed).length;
    return {
      rules: this.#rules.size,
      reviews: totalReviews,
      passRate: totalReviews > 0 ? Math.round((passed / totalReviews) * 10000) / 100 : 0,
    };
  }
}
