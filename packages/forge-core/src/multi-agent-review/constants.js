/**
 * Enumerations and constants for the multi-agent review system.
 */

/**
 * Severity levels for review issues, ordered from least to most severe.
 * @readonly
 * @enum {string}
 */
export const ReviewSeverity = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
});

/**
 * Categories that a review rule can belong to.
 * @readonly
 * @enum {string}
 */
export const ReviewCategory = Object.freeze({
  LOGIC: 'logic',
  SECURITY: 'security',
  STYLE: 'style',
  PERFORMANCE: 'performance',
  MAINTAINABILITY: 'maintainability',
  TESTING: 'testing',
});

/** @type {Record<string, number>} internal numeric rank for severity comparison */
export const SEVERITY_RANK = Object.freeze({
  [ReviewSeverity.INFO]: 0,
  [ReviewSeverity.WARNING]: 1,
  [ReviewSeverity.ERROR]: 2,
  [ReviewSeverity.CRITICAL]: 3,
});

/** All category values as an array (used as default). */
export const ALL_CATEGORIES = Object.values(ReviewCategory);
