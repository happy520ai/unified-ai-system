/**
 * File Lock Management
 * Prevents parallel goals from modifying the same files simultaneously
 */

import { extractFilesFromPrompt } from './constants.js';

/**
 * Extract file paths from a task's prompt and allowed_files.
 * @param {object} task
 * @returns {string[]}
 */
export function extractTaskFiles(task) {
  const files = new Set();
  // From allowed_files
  let allowed;
  if (typeof task.allowed_files === 'string') {
    try { allowed = JSON.parse(task.allowed_files); } catch { allowed = []; }
  } else {
    allowed = task.allowed_files || [];
  }
  if (!Array.isArray(allowed)) allowed = [];
  for (const pattern of allowed) {
    // Only include concrete file paths, not glob patterns
    if (!pattern.includes('*')) files.add(pattern);
  }
  // From prompt
  if (task.prompt) {
    const promptFiles = extractFilesFromPrompt(task.prompt);
    for (const f of promptFiles) files.add(f);
  }
  return [...files];
}

/**
 * Check if any of the given files are locked by a DIFFERENT goal.
 * @param {Map} fileLocks - state.fileLocks
 * @param {string[]} files
 * @param {string} goalId — the requesting goal (same-goal locks are OK)
 * @returns {boolean} true if there's a conflict
 */
export function checkFileConflict(fileLocks, files, goalId) {
  for (const file of files) {
    const lock = fileLocks.get(file);
    if (lock && lock.goalId !== goalId) {
      return true;
    }
  }
  return false;
}

/**
 * Acquire file locks for a set of files.
 * @param {Map} fileLocks - state.fileLocks
 * @param {string[]} files
 * @param {string} goalId
 * @param {string} taskId
 * @returns {string[]} — the files that were actually locked
 */
export function acquireFileLocks(fileLocks, files, goalId, taskId) {
  const locked = [];
  for (const file of files) {
    if (!fileLocks.has(file)) {
      fileLocks.set(file, { goalId, taskId, lockedAt: Date.now() });
      locked.push(file);
    }
  }
  if (locked.length > 0) {
    console.log(`[forge:pool] Locked ${locked.length} file(s) for ${goalId}/${taskId}`);
  }
  return locked;
}

/**
 * Release all file locks held by a specific goal/task combination.
 * @param {Map} fileLocks - state.fileLocks
 * @param {string} goalId
 * @param {string} taskId
 */
export function releaseFileLocks(fileLocks, goalId, taskId) {
  let released = 0;
  for (const [file, lock] of fileLocks) {
    if (lock.goalId === goalId && lock.taskId === taskId) {
      fileLocks.delete(file);
      released++;
    }
  }
  if (released > 0) {
    console.log(`[forge:pool] Released ${released} file lock(s) for ${goalId}/${taskId}`);
  }
}
