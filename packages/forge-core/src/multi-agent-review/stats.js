/**
 * Statistics and reporting utilities for the multi-agent review system.
 */

import { ReviewSeverity, SEVERITY_RANK } from './constants.js';

/**
 * Compute issue statistics for a single review run.
 *
 * @param {Array<object>} issues
 * @returns {{ total: number, byCategory: Record<string, number>, bySeverity: Record<string, number> }}
 */
export function computeStats(issues) {
  /** @type {Record<string, number>} */
  const byCategory = {};
  /** @type {Record<string, number>} */
  const bySeverity = {};

  for (const issue of issues) {
    byCategory[issue.category] = (byCategory[issue.category] ?? 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
  }

  return { total: issues.length, byCategory, bySeverity };
}

/**
 * Determine whether a review passes based on the severity threshold.
 *
 * A review passes when no issues exist at or above the configured threshold.
 *
 * @param {Array<object>} issues
 * @param {string} severityThreshold
 * @returns {boolean}
 */
export function evaluatePass(issues, severityThreshold) {
  const thresholdRank = SEVERITY_RANK[severityThreshold] ?? 0;
  return !issues.some(
    (i) => (SEVERITY_RANK[i.severity] ?? 0) >= thresholdRank
  );
}

/**
 * Build a human-readable summary string for a review result.
 *
 * @param {Array<object>} issues
 * @param {boolean} passed
 * @returns {string}
 */
export function buildSummary(issues, passed) {
  if (issues.length === 0) {
    return passed ? 'Review passed with no issues.' : 'Review failed (unknown).';
  }

  const critical = issues.filter((i) => i.severity === ReviewSeverity.CRITICAL).length;
  const errors = issues.filter((i) => i.severity === ReviewSeverity.ERROR).length;
  const warnings = issues.filter((i) => i.severity === ReviewSeverity.WARNING).length;
  const infos = issues.filter((i) => i.severity === ReviewSeverity.INFO).length;

  const parts = [];
  if (critical > 0) parts.push(`${critical} critical`);
  if (errors > 0) parts.push(`${errors} error(s)`);
  if (warnings > 0) parts.push(`${warnings} warning(s)`);
  if (infos > 0) parts.push(`${infos} info`);

  return `${passed ? 'PASSED' : 'FAILED'} — ${parts.join(', ')} (${issues.length} total).`;
}

/**
 * Push a review result into the history ring buffer (max 100 entries).
 *
 * @param {Array<object>} history — the history array to push into
 * @param {object} result
 * @param {number} max — maximum history size
 */
export function pushHistory(history, result, max) {
  history.push({
    passed: result.passed,
    stats: result.stats,
    duration: result.duration,
    timestamp: Date.now(),
  });

  // Ring-buffer eviction
  if (history.length > max) {
    history.shift();
  }
}

/**
 * Get aggregate review statistics across the entire history.
 *
 * @param {Array<object>} history
 * @returns {{
 *   totalReviews: number,
 *   passed: number,
 *   failed: number,
 *   byCategory: Record<string, number>,
 *   bySeverity: Record<string, number>,
 *   avgIssuesPerReview: number,
 * }}
 */
export function aggregateStats(history) {
  const total = history.length;
  if (total === 0) {
    return {
      totalReviews: 0,
      passed: 0,
      failed: 0,
      byCategory: {},
      bySeverity: {},
      avgIssuesPerReview: 0,
    };
  }

  let passed = 0;
  let totalIssues = 0;
  /** @type {Record<string, number>} */
  const byCategory = {};
  /** @type {Record<string, number>} */
  const bySeverity = {};

  for (const entry of history) {
    if (entry.passed) passed++;
    totalIssues += entry.stats.total;

    for (const [cat, count] of Object.entries(entry.stats.byCategory)) {
      byCategory[cat] = (byCategory[cat] ?? 0) + count;
    }
    for (const [sev, count] of Object.entries(entry.stats.bySeverity)) {
      bySeverity[sev] = (bySeverity[sev] ?? 0) + count;
    }
  }

  return {
    totalReviews: total,
    passed,
    failed: total - passed,
    byCategory,
    bySeverity,
    avgIssuesPerReview: Math.round((totalIssues / total) * 100) / 100,
  };
}

/**
 * Generate a human-readable review report.
 *
 * @param {object} result — the result from review()
 * @returns {string} formatted multi-line report
 */
export function formatReport(result) {
  const lines = [];
  lines.push('=== Code Review Report ===');
  lines.push(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
  lines.push(`Summary: ${result.summary}`);
  lines.push(`Duration: ${result.duration}ms`);
  lines.push(`Total issues: ${result.stats.total}`);
  lines.push('');

  // Severity breakdown
  lines.push('-- Severity Breakdown --');
  for (const [sev, count] of Object.entries(result.stats.bySeverity)) {
    lines.push(`  ${sev}: ${count}`);
  }
  lines.push('');

  // Category breakdown
  lines.push('-- Category Breakdown --');
  for (const [cat, count] of Object.entries(result.stats.byCategory)) {
    lines.push(`  ${cat}: ${count}`);
  }
  lines.push('');

  // Individual issues
  if (result.issues.length > 0) {
    lines.push('-- Issues --');
    for (const issue of result.issues) {
      lines.push(`  [${issue.severity.toUpperCase()}] ${issue.path}:${issue.line} — ${issue.message}`);
      lines.push(`    Category: ${issue.category} | Rule: ${issue.rule}`);
      if (issue.suggestion) {
        lines.push(`    Suggestion: ${issue.suggestion}`);
      }
    }
  } else {
    lines.push('No issues found.');
  }

  lines.push('');
  lines.push('=== End of Report ===');
  return lines.join('\n');
}
