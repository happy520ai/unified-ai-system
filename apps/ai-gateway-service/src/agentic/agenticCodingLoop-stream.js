/**
 * Agentic Coding Loop — Stream Event Helpers
 *
 * Utilities for creating SSE stream events in the agentic loop.
 */

export function createStreamEvent(type, data) {
  return { type, ...data, timestamp: new Date().toISOString() };
}

export function truncateForEvent(content, maxLen = 2000) {
  if (!content) return "";
  return content.length > maxLen ? content.slice(0, maxLen) + "...[truncated]" : content;
}
