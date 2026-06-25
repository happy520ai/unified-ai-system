/**
 * HealthDashboard — shared constants and pure helpers.
 *
 * Extracted from health-dashboard/index.js to keep the class module
 * under the 500-line limit (分层律).
 */

/** Default interval for automatic refresh (ms). */
export const DEFAULT_REFRESH_INTERVAL = 5000;

/** Default number of historical snapshots to retain. */
export const DEFAULT_HISTORY_SIZE = 100;

/** Maximum number of alerts stored at any time. */
export const MAX_ALERTS = 50;

/** Health status values (ordered by severity). */
export const HEALTH_LEVELS = ['healthy', 'degraded', 'critical'];

/** Alert severity levels. */
export const ALERT_LEVELS = ['info', 'warning', 'error', 'critical'];

/**
 * Normalize a status value to one of the accepted health levels.
 *
 * @param {*} status
 * @returns {'healthy'|'degraded'|'critical'}
 */
export function normalizeStatus(status) {
  if (HEALTH_LEVELS.includes(status)) return status;
  return 'healthy';
}

/**
 * Infer a unit of measurement from a metric key name.
 *
 * @param {string} key
 * @returns {string}
 */
export function inferUnit(key) {
  const lower = key.toLowerCase();

  if (lower.includes('ms') || lower.includes('latency') || lower.includes('duration')) {
    return 'ms';
  }
  if (lower.includes('bytes') || lower.includes('size')) {
    return 'bytes';
  }
  if (lower.includes('percent') || lower.includes('rate') || lower.includes('ratio')) {
    return '%';
  }
  if (lower.includes('count') || lower.includes('total') || lower.includes('tasks')) {
    return 'count';
  }
  if (lower.includes('per') || lower.includes('throughput')) {
    return 'ops/s';
  }

  return 'units';
}
