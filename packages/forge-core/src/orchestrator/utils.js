/**
 * Orchestrator utility helpers — pure functions extracted from the main
 * orchestrator module to keep it under the 500-line layering limit.
 */

/**
 * Format a millisecond duration into a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

/**
 * Extract file paths mentioned in a task prompt.
 * Matches patterns like src/server.js, middleware/auth.js, etc.
 * @param {string} prompt
 * @returns {string[]}
 */
export function extractFilesFromPrompt(prompt) {
  const files = new Set();
  const pathPattern = /(?:src|lib|test|tests|middleware|routes|models|utils|config)\/[\w/.-]+\.(?:js|ts|mjs)/g;
  const matches = prompt.matchAll(pathPattern);
  for (const m of matches) {
    files.add(m[0]);
  }
  const filePattern = /[\w.-]+\.(?:js|ts|json|mjs)/g;
  for (const m of prompt.matchAll(filePattern)) {
    if (m[0].includes('/') || ['package.json', 'server.js', 'index.js'].includes(m[0])) {
      files.add(m[0]);
    }
  }
  return [...files];
}
