/**
 * ErrorPatternLearner — constants, typedefs, and pure helper functions.
 *
 * Extracted from index.js to keep the class module under the 500-line limit (分层律).
 */

/** Maximum number of patterns to retain. */
export const DEFAULT_MAX_PATTERNS = 200;
/** Minimum error occurrences before promoting to a pattern. */
export const DEFAULT_MIN_OCCURRENCES = 2;
/** Decay half-life in hours (default 7 days = 168 h). */
export const DEFAULT_DECAY_HALF_LIFE = 168;
/** Maximum instructions included in a generated prompt block. */
export const MAX_INSTRUCTIONS = 10;
/** Maximum raw error records retained (ring buffer). */
export const MAX_RAW_ERRORS = 1000;
/** Confidence threshold for [HIGH] label. */
export const CONFIDENCE_HIGH = 60;
/** Confidence threshold for [MED] label. */
export const CONFIDENCE_MED = 30;

/**
 * Regex rules used to normalise error messages into reusable templates.
 * Each rule replaces a class of variable tokens with a wildcard.
 * @type {Array<{ pattern: RegExp, replacement: string }>}
 */
export const NORMALIZATION_RULES = [
  { pattern: /\b[0-9a-f]{8,}\b/gi, replacement: '*' },             // hex hashes / IDs
  { pattern: /\b\d+\b/g, replacement: '*' },                        // plain numbers
  { pattern: /(?:\/[\w.-]+)+/g, replacement: '*' },                 // Unix-style paths
  { pattern: /[A-Z]:\\(?:[\w.-]+\\)*[\w.-]+/g, replacement: '*' }, // Windows paths
  { pattern: /'[^']*'/g, replacement: "'*'" },                      // single-quoted strings
  { pattern: /"[^"]*"/g, replacement: '"*"' },                      // double-quoted strings
];

/**
 * A single recorded error event.
 * @typedef {Object} ErrorRecord
 * @property {string} id — unique record identifier
 * @property {string|null} taskId — task that produced the error
 * @property {string|null} goalId — goal the task belongs to
 * @property {string|null} workerType — type of worker that encountered the error
 * @property {string} errorType — categorised error type
 * @property {string} message — original error message
 * @property {Object|null} context — additional context metadata
 * @property {string|null} stack — stack trace
 * @property {number} timestamp — epoch ms when the error was recorded
 * @property {boolean} processed — whether learn() has processed this record
 */

/**
 * An extracted error pattern with confidence scoring and feedback.
 * @typedef {Object} ErrorPattern
 * @property {string} id — unique pattern identifier
 * @property {string} errorType — error type category
 * @property {string} messagePattern — normalised error message template
 * @property {string} instruction — human-readable preventive instruction
 * @property {string[]} workerTypes — affected worker types
 * @property {string[]} taskTypes — affected task types
 * @property {number} occurrences — total occurrence count
 * @property {number} firstSeen — epoch ms of first occurrence
 * @property {number} lastSeen — epoch ms of most recent occurrence
 * @property {number} confidence — confidence score (0-100)
 * @property {{ helpful: number, unhelpful: number }} feedback — feedback counts
 */

/**
 * Normalise an error message into a reusable template by stripping variable tokens.
 * @param {string} message
 * @returns {string}
 */
export function normalizeMessage(message) {
  if (!message) return '*';
  let result = message;
  for (const rule of NORMALIZATION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

/**
 * Generate a human-readable instruction from an error type and message pattern.
 * @param {string} errorType
 * @param {string} messagePattern
 * @returns {string}
 */
export function generateInstruction(errorType, messagePattern) {
  const typeLabel = errorType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const summary = messagePattern.length > 80
    ? messagePattern.slice(0, 77) + '...' : messagePattern;
  return `${typeLabel} errors (${summary}): Review common causes and apply preventive checks before execution.`;
}

/**
 * Calculate confidence score for a pattern.
 * Base = min(occurrences * 10, 80), +2 per helpful, -5 per unhelpful,
 * decay = 0.5^(age_hours / halfLife), clamped to [0, 100].
 * @param {ErrorPattern} pattern
 * @param {number} decayHalfLife — half-life in hours
 * @returns {number} Confidence (0-100).
 */
export function calculateConfidence(pattern, decayHalfLife) {
  let score = Math.min(pattern.occurrences * 10, 80);
  score += pattern.feedback.helpful * 2;
  score -= pattern.feedback.unhelpful * 5;
  const ageHours = (Date.now() - pattern.lastSeen) / (1000 * 60 * 60);
  score *= Math.pow(0.5, ageHours / decayHalfLife);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Merge worker types and task types from new records into an existing pattern.
 * @param {ErrorPattern} pattern
 * @param {ErrorRecord[]} records
 */
export function mergeWorkerAndTaskTypes(pattern, records) {
  for (const record of records) {
    if (record.workerType && !pattern.workerTypes.includes(record.workerType)) {
      pattern.workerTypes.push(record.workerType);
    }
    const taskType = record.context?.taskType;
    if (taskType && !pattern.taskTypes.includes(taskType)) {
      pattern.taskTypes.push(taskType);
    }
  }
}

/**
 * Evict the pattern with the lowest confidence to make room for a new one.
 * @param {Map<string, ErrorPattern>} patterns
 */
export function evictLowestConfidence(patterns) {
  let lowestId = null;
  let lowestConfidence = Infinity;
  for (const [id, pattern] of patterns) {
    if (pattern.confidence < lowestConfidence) {
      lowestConfidence = pattern.confidence;
      lowestId = id;
    }
  }
  if (lowestId) patterns.delete(lowestId);
}
