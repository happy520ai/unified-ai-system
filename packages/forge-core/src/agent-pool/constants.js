/**
 * Agent Pool Constants
 * Shared constants and utility functions for agent pool management
 */

import { CoderWorker, ArchitectWorker, CodeArchaeologistWorker } from '../worker/coder.js';
import { TesterWorker, VerifierWorker } from '../worker/tester.js';
import { ReviewerWorker } from '../worker/reviewer.js';
import { DebuggerWorker } from '../worker/debugger.js';
import { WebWorker } from '../worker/web.js';

/**
 * Worker factory map — maps agent role names to worker constructors.
 * Each factory returns a fresh worker instance.
 */
export const WORKER_MAP = {
  'coder': () => new CoderWorker(),
  'architect': () => new ArchitectWorker(),
  'code-archaeologist': () => new CodeArchaeologistWorker(),
  'tester': () => new TesterWorker(),
  'verifier': () => new VerifierWorker(),
  'reviewer': () => new ReviewerWorker(),
  'debugger': () => new DebuggerWorker(),
  'web': () => new WebWorker(),
};

/**
 * Priority weights for task types — higher values are dequeued first.
 * Exploration and planning tasks are prioritized so downstream work can proceed.
 */
export const TYPE_PRIORITY = {
  'explore': 100,
  'plan': 90,
  'implement': 70,
  'refactor': 60,
  'test': 50,
  'verify': 40,
  'review': 30,
  'debug': 20,
  'web': 55,
  'scrape': 55,
};

/**
 * Task types that modify code and should trigger auto-verification after completion.
 * Exploration, planning, review, and test-only tasks are excluded.
 */
export const CODE_MUTATING_TYPES = new Set(['implement', 'refactor', 'debug']);

/**
 * Maximum number of verification retry attempts (separate from execution retries)
 */
export const MAX_VERIFY_RETRIES = 2;

/**
 * Extract file paths from a task prompt (matches patterns like src/foo.js, test/bar.test.js, etc.).
 * @param {string} prompt
 * @returns {string[]}
 */
export function extractFilesFromPrompt(prompt) {
  if (!prompt) return [];
  const matches = prompt.match(/(?:src|lib|test|tests|config|middleware)\/[\w./-]+\.(?:js|ts|mjs|json)/g);
  return matches ? [...new Set(matches)] : [];
}
