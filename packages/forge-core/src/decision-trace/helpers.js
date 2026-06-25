/**
 * Pure helper functions and constants for DecisionTrace.
 *
 * Extracted from index.js to keep the main module under 500 lines.
 * All functions are stateless and side-effect free.
 */

// -- Constants ──────────────────────────────────────────────────────────────

/** Recognised decision types. */
export const DECISION_TYPES = new Set([
  'tool_choice',
  'file_modification',
  'strategy_selection',
  'error_handling',
  'retry_decision',
]);

/** Valid outcome values. */
export const OUTCOME_VALUES = new Set(['success', 'failure', 'partial', 'pending']);

/** Valid annotation severity levels. */
export const SEVERITY_VALUES = new Set(['info', 'warning', 'error']);

/** Default maximum number of entries retained in the ring buffer. */
export const DEFAULT_MAX_ENTRIES = 5000;

/** Maximum annotation array length per entry (safety cap). */
export const MAX_ANNOTATIONS_PER_ENTRY = 50;

// -- Type definitions ───────────────────────────────────────────────────────

/**
 * @typedef {object} DecisionEntry
 * @property {string}   id           — unique entry identifier
 * @property {string}   goalId       — goal this decision belongs to
 * @property {string}   taskId       — task this decision belongs to
 * @property {string}   workerType   — worker that made the decision (e.g. 'coder')
 * @property {number}   timestamp    — epoch ms when the decision was recorded
 * @property {string}   decision     — decision type (see DECISION_TYPES)
 * @property {object}   action       — the chosen action payload
 * @property {string}   reasoning    — free-text explanation of *why*
 * @property {Array<object>} alternatives — other options that were considered
 * @property {'success'|'failure'|'partial'|'pending'} outcome
 * @property {number}   confidence   — self-assessed confidence 0-100
 * @property {object}   context      — arbitrary contextual metadata
 * @property {Array<Annotation>} annotations — post-hoc notes
 * @property {string[]} tags         — free-form classification tags
 */

/**
 * @typedef {object} Annotation
 * @property {string}  note            — free-text observation
 * @property {string}  correctedAction — what should have been done instead
 * @property {'info'|'warning'|'error'} severity
 * @property {number}  timestamp       — epoch ms when the annotation was added
 */

/**
 * @typedef {object} SearchCriteria
 * @property {string}  [workerType]   — filter by worker type
 * @property {string}  [decision]     — filter by decision type
 * @property {string}  [outcome]      — filter by outcome
 * @property {number}  [minConfidence] — minimum confidence threshold (0-100)
 * @property {number}  [after]        — entries recorded after this epoch ms
 * @property {number}  [before]       — entries recorded before this epoch ms
 * @property {string[]} [tags]        — entries that contain ALL of these tags
 */

/**
 * @typedef {object} DecisionPattern
 * @property {string[]} pattern   — ordered sequence of decision types
 * @property {number}   count     — how many times this sequence was observed
 * @property {string}   avgOutcome — most common outcome for this pattern
 */

// -- Pure helpers ───────────────────────────────────────────────────────────

/**
 * Find the most common element in a string array.
 *
 * @param {string[]} arr
 * @returns {string}
 */
export function mostCommon(arr) {
  if (arr.length === 0) return 'unknown';

  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of arr) {
    counts[item] = (counts[item] ?? 0) + 1;
  }

  let best = arr[0];
  let bestCount = 0;
  for (const [item, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Convert an array of decision entries to a CSV string.
 *
 * @param {DecisionEntry[]} entries
 * @returns {string}
 */
export function toCSV(entries) {
  const headers = [
    'id', 'goalId', 'taskId', 'workerType', 'timestamp',
    'decision', 'reasoning', 'outcome', 'confidence', 'tags',
  ];

  const escape = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];

  for (const e of entries) {
    const row = [
      e.id,
      e.goalId,
      e.taskId,
      e.workerType,
      e.timestamp,
      e.decision,
      e.reasoning,
      e.outcome,
      e.confidence,
      (e.tags ?? []).join(';'),
    ];
    lines.push(row.map(escape).join(','));
  }

  return lines.join('\n');
}

// -- Reusable filter / sort helpers ─────────────────────────────────────────

/**
 * Filter entries by common search criteria (AND semantics).
 *
 * @param {DecisionEntry[]} entries
 * @param {SearchCriteria} criteria
 * @returns {DecisionEntry[]}
 */
export function filteredEntries(entries, criteria) {
  let result = entries;
  if (criteria.workerType) {
    result = result.filter((e) => e.workerType === criteria.workerType);
  }
  if (criteria.decision) {
    result = result.filter((e) => e.decision === criteria.decision);
  }
  if (criteria.outcome) {
    result = result.filter((e) => e.outcome === criteria.outcome);
  }
  if (criteria.minConfidence != null) {
    result = result.filter((e) => e.confidence >= criteria.minConfidence);
  }
  if (criteria.after != null) {
    result = result.filter((e) => e.timestamp >= criteria.after);
  }
  if (criteria.before != null) {
    result = result.filter((e) => e.timestamp <= criteria.before);
  }
  if (criteria.tags && criteria.tags.length > 0) {
    const required = new Set(criteria.tags);
    result = result.filter((e) => {
      for (const t of required) {
        if (!e.tags.includes(t)) return false;
      }
      return true;
    });
  }
  return result;
}

/**
 * Filter entries by timeline-style criteria (goalId, taskId, after, before).
 *
 * @param {DecisionEntry[]} entries
 * @param {object} opts
 * @returns {DecisionEntry[]}
 */
export function timelineFilteredEntries(entries, opts) {
  let result = entries;
  if (opts.goalId) {
    result = result.filter((e) => e.goalId === opts.goalId);
  }
  if (opts.taskId) {
    result = result.filter((e) => e.taskId === opts.taskId);
  }
  if (opts.after != null) {
    result = result.filter((e) => e.timestamp >= opts.after);
  }
  if (opts.before != null) {
    result = result.filter((e) => e.timestamp <= opts.before);
  }
  return result;
}

/** Sort entries by timestamp ascending. */
export function sortAsc(entries) {
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}

/** Sort entries by timestamp descending. */
export function sortDesc(entries) {
  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Count entries by a given field value.
 *
 * @param {DecisionEntry[]} entries
 * @param {string} field
 * @returns {Record<string, number>}
 */
export function countByField(entries, field) {
  /** @type {Record<string, number>} */
  const result = {};
  for (const e of entries) {
    const key = e[field];
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}
