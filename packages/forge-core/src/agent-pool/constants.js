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

// Governed mode keeps only server-issued identifiers and scheduling cursors.
// The executor owns signed state, authorization, budgets and verification.
/** @typedef {{goalId:string, taskId:string, userId:string, tenantId:string, projectId:string, agentId:string,
 * profileHash:string, reviewHash:string, planHash:string, residentAuthorizationHash:string, bindingHash:string,
 * revision:number}} GovernedGoalPointer */
/** @typedef {{goalId:string, taskId:string, bindingHash:string, revision:number,
 * status:'continue'|'paused'|'completed'|'failed'|'cancelled'|'unknown', errorCode?:string}} GovernedChunkOutcome */
/** @typedef {{admit:(input:{goalId:string,userId:string,mode:'submit'|'resume'})=>Promise<GovernedGoalPointer>,
 * executeChunk:(input:{goal:Readonly<GovernedGoalPointer>,assignmentId:string,signal:AbortSignal})=>Promise<GovernedChunkOutcome>,
 * cancel:(input:{goal:Readonly<GovernedGoalPointer>,reason:'pause'|'cancel'|'shutdown'})=>Promise<void>,
 * recoverableGoals?:()=>Promise<Array<{goalId:string,userId:string}>>}} GovernedChunkExecutor */
export const GOVERNED_GOAL_POINTER_KEYS = Object.freeze([
  'goalId', 'taskId', 'userId', 'tenantId', 'projectId', 'agentId',
  'profileHash', 'reviewHash', 'planHash', 'residentAuthorizationHash', 'bindingHash', 'revision',
]);
export const GOVERNED_TERMINAL = new Set(['completed', 'failed', 'cancelled', 'unknown']);
export const GOVERNED_HISTORY_LIMIT = 128;
const GOVERNED_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const GOVERNED_HASH = /^sha256:[a-f0-9]{64}$/u;

export function governedPoolError(code, cause) {
  return Object.assign(new Error(`The governed Agent pool cannot continue: ${code}.`, cause === undefined ? undefined : { cause }), {
    code: `FORGE_POOL_${code}`, statusCode: ['MAX_GOALS', 'QUEUE_CAPACITY'].includes(code) ? 429 : 409,
    outcomeUnknown: code.includes('UNKNOWN'), retrySafe: false,
  });
}
export function governedRecord(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw governedPoolError('CONTRACT_INVALID');
  const keys = Reflect.ownKeys(value), result = {};
  if (required.some(key => !keys.includes(key))) throw governedPoolError('CONTRACT_INVALID');
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || ![...required, ...optional].includes(key)
      || !property?.enumerable || !('value' in property)) throw governedPoolError('CONTRACT_INVALID');
    result[key] = property.value;
  }
  return result;
}
export function governedIdentifier(value, uuid = false) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value || value.length > 256
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value) || (uuid && !GOVERNED_UUID.test(value))) throw governedPoolError('IDENTITY_INVALID');
  return value;
}
/** @returns {Readonly<GovernedChunkExecutor>} */
export function readGovernedChunkExecutor(value) {
  const source = governedRecord(value, ['admit', 'executeChunk', 'cancel'], ['recoverableGoals']);
  const result = {};
  for (const [name, method] of Object.entries(source)) {
    if (name === 'recoverableGoals' && method === undefined) continue;
    if (typeof method !== 'function') throw governedPoolError('EXECUTOR_REQUIRED');
    result[name] = method.bind(value);
  }
  return Object.freeze(result);
}
export async function awaitGovernedControlPersistence(tracker) {
  for (;;) {
    const tail = tracker.controlTail;
    await tail;
    if (tail === tracker.controlTail) return;
  }
}
/** @returns {Readonly<GovernedGoalPointer>} */
export function readGovernedGoalPointer(value, goalId, userId, previous) {
  const pointer = governedRecord(value, GOVERNED_GOAL_POINTER_KEYS);
  if (pointer.goalId !== governedIdentifier(goalId, true) || pointer.taskId !== goalId
    || pointer.userId !== governedIdentifier(userId) || typeof pointer.agentId !== 'string' || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(pointer.agentId)
    || !Number.isSafeInteger(pointer.revision) || pointer.revision < 0) throw governedPoolError('BINDING_INVALID');
  for (const key of ['tenantId', 'projectId']) governedIdentifier(pointer[key]);
  for (const key of ['profileHash', 'reviewHash', 'planHash', 'residentAuthorizationHash', 'bindingHash']) {
    if (typeof pointer[key] !== 'string' || !GOVERNED_HASH.test(pointer[key])) throw governedPoolError('BINDING_INVALID');
  }
  if (previous && (pointer.revision < previous.revision || ['goalId', 'taskId', 'userId', 'tenantId', 'projectId', 'agentId', 'profileHash', 'reviewHash', 'planHash']
    .some(key => pointer[key] !== previous[key]))) throw governedPoolError('BINDING_CHANGED');
  return Object.freeze(pointer);
}
/** @returns {Readonly<GovernedChunkOutcome>} */
export function readGovernedChunkOutcome(value, pointer) {
  const outcome = governedRecord(value, ['goalId', 'taskId', 'bindingHash', 'revision', 'status'], ['errorCode']);
  if (outcome.goalId !== pointer.goalId || outcome.taskId !== pointer.taskId || outcome.bindingHash !== pointer.bindingHash
    || !Number.isSafeInteger(outcome.revision) || outcome.revision < pointer.revision
    || !['continue', 'paused', 'completed', 'failed', 'cancelled', 'unknown'].includes(outcome.status)
    || outcome.status === 'continue' && outcome.revision <= pointer.revision
    || outcome.errorCode !== undefined && (typeof outcome.errorCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(outcome.errorCode))) {
    throw governedPoolError('OUTCOME_UNKNOWN');
  }
  return Object.freeze(outcome);
}
export function governedGoalReport(tracker) {
  return Object.freeze({ ...(tracker.pointer ?? { goalId: tracker.goalId, userId: tracker.userId }),
    status: tracker.status, completedChunks: tracker.completedChunks, controlRequested: tracker.control === 'run' ? null : tracker.control,
    outcomeUnknown: tracker.status === 'unknown',
    ...(tracker.errorCode ? { errorCode: tracker.errorCode } : {}), retryAllowed: false });
}
export function emitGovernedPoolEvent(s, name, value) {
  try { s.eventEmitter.emit(name, Object.freeze(value)); }
  catch { s.governedMetrics.notificationErrors++; }
}
