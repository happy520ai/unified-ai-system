/**
 * LiveStream — pure event helper functions.
 *
 * Extracted from live-stream/index.js to keep the class module
 * under the 500-line limit (分层律).
 *
 * StreamEvent is defined here (not in index.js) to break the circular
 * dependency: index.js → eventHelpers.js → index.js.
 */

/**
 * Event types emitted during task execution.
 * @readonly
 * @enum {string}
 */
export const StreamEvent = Object.freeze({
  TASK_START: 'task_start',
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  LLM_CALL_START: 'llm_call_start',
  LLM_CALL_END: 'llm_call_end',
  ACTION_EXECUTE: 'action_execute',
  TOOL_CALL: 'tool_call',
  ERROR: 'error',
  TASK_COMPLETE: 'task_complete',
  TASK_FAIL: 'task_fail',
});

/**
 * Paired event types used for timeline duration computation.
 * Maps a "start" event to its corresponding "end" event.
 * @type {Record<string, string>}
 */
export const PAIRED_EVENTS = Object.freeze({
  [StreamEvent.LLM_CALL_START]: StreamEvent.LLM_CALL_END,
  [StreamEvent.TASK_START]: StreamEvent.TASK_COMPLETE,
});

/**
 * Check whether an event matches a subscriber's filter criteria.
 *
 * @param {object} entry
 * @param {object} filters
 * @returns {boolean}
 */
export function matchesFilters(entry, filters) {
  if (filters.taskId && entry.taskId !== filters.taskId) return false;
  if (filters.goalId && entry.goalId !== filters.goalId) return false;
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    if (!filters.eventTypes.includes(entry.type)) return false;
  }
  return true;
}

/**
 * Find the start-event type that pairs with a given end-event type.
 *
 * @param {string} endType
 * @returns {string|null}
 */
export function findStartType(endType) {
  for (const [start, end] of Object.entries(PAIRED_EVENTS)) {
    if (end === endType) return start;
  }
  return null;
}

/**
 * Generate a human-readable summary string for an event.
 *
 * @param {object} evt
 * @returns {string}
 */
export function summarizeEvent(evt) {
  const d = evt.data ?? {};
  switch (evt.type) {
    case StreamEvent.TASK_START:
      return `Task started: ${d.taskName ?? evt.taskId ?? 'unknown'}`;
    case StreamEvent.FILE_READ:
      return `File read: ${d.path ?? 'unknown'}`;
    case StreamEvent.FILE_WRITE:
      return `File write: ${d.path ?? 'unknown'}`;
    case StreamEvent.LLM_CALL_START:
      return `LLM call started: ${d.model ?? 'unknown model'}`;
    case StreamEvent.LLM_CALL_END:
      return `LLM call ended: ${d.model ?? 'unknown model'}${d.tokens ? ` (${d.tokens} tokens)` : ''}`;
    case StreamEvent.ACTION_EXECUTE:
      return `Action executed: ${d.actionType ?? 'unknown'}${d.path ? ` on ${d.path}` : ''}`;
    case StreamEvent.TOOL_CALL:
      return `Tool call: ${d.tool ?? 'unknown'}`;
    case StreamEvent.ERROR:
      return `Error: ${d.message ?? 'unknown error'}`;
    case StreamEvent.TASK_COMPLETE:
      return `Task completed${d.durationMs ? ` in ${d.durationMs}ms` : ''}`;
    case StreamEvent.TASK_FAIL:
      return `Task failed: ${d.error ?? d.message ?? 'unknown reason'}`;
    default:
      return `${evt.type}`;
  }
}
