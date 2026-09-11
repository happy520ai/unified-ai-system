/**
 * Goal Lifecycle Management
 * submitGoal, checkGoalCompletion, cancelGoal, resumeGoal, recoverInterruptedGoals, enqueueNewlyReadyTasks
 */

import { TYPE_PRIORITY, GOVERNED_HISTORY_LIMIT, GOVERNED_TERMINAL, governedIdentifier, governedRecord,
  governedPoolError, readGovernedGoalPointer, emitGovernedPoolEvent, awaitGovernedControlPersistence } from './constants.js';
import { getGoalBudget } from './pool-status.js';
import { releaseFileLocks } from './file-locks.js';
import { settleGovernedGoal } from './worker-failure.js';

/**
 * Submit a goal's tasks to the pool for execution.
 */
export async function submitGoal(s, goalId, userId, options = {}, processQueueFn) {
  if (s.governedChunkExecutor) {
    governedRecord(options, []);
    const accepted = await enqueueGovernedGoal(s, goalId, userId, 'submit', processQueueFn);
    return accepted.completion;
  }
  const { budget } = options;
  if (s.shuttingDown) {
    throw new Error('Cannot submit goals: pool is shutting down');
  }

  // Check max parallel goals limit
  const activeGoals = new Set([...s.activeWorkers.values()].map(w => w.goalId));
  const queuedGoals = new Set(s.queue.map(e => e.goalId));
  const allActiveGoalIds = new Set([...activeGoals, ...queuedGoals, ...s.goalTrackers.keys()]);
  if (allActiveGoalIds.size >= s.options.maxGoals && !allActiveGoalIds.has(goalId)) {
    console.log(`[forge:pool] Max parallel goals (${s.options.maxGoals}) reached, queuing ${goalId}`);
  }

  // Check global budget
  if (s.budget) {
    const budgetStatus = s.budget.getStatus?.() || {};
    if (budgetStatus.exceeded) {
      throw new Error(`Global budget exceeded: ${budgetStatus.reason || 'limits reached'}`);
    }
  }

  // Initialize per-goal budget tracking if a budget is provided
  if (budget && (budget.maxTokens || budget.maxCost || budget.maxMinutes)) {
    const existing = s.goalBudgets.get(goalId);
    if (existing) {
      existing.maxTokens = budget.maxTokens ?? existing.maxTokens;
      existing.maxCost = budget.maxCost ?? existing.maxCost;
      existing.maxMinutes = budget.maxMinutes ?? existing.maxMinutes;
    } else {
      s.goalBudgets.set(goalId, {
        maxTokens: budget.maxTokens ?? null,
        maxCost: budget.maxCost ?? null,
        maxMinutes: budget.maxMinutes ?? null,
        usedTokens: 0,
        usedCost: 0,
        startedAt: Date.now(),
      });
    }
    console.log(`[forge:pool] Per-goal budget set for ${goalId}: maxTokens=${budget.maxTokens ?? '∞'}, maxCost=${budget.maxCost ?? '∞'}, maxMinutes=${budget.maxMinutes ?? '∞'}`);
  }

  const goal = s.store.getGoal(goalId);
  if (!goal) {
    throw new Error(`Goal ${goalId} not found`);
  }

  // Create goal-level trace span
  const goalSpan = s.tracing?.startSpan({
    traceId: goalId,
    operationName: 'goal_submission',
    goalId,
    attributes: { 'forge.pool.goal_id': goalId, 'forge.pool.user_id': userId || null }
  });
  if (goalSpan) s.goalSpans.set(goalId, goalSpan);

  // Get all ready tasks for this goal
  const readyTasks = s.store.getReadyTasks(goalId);
  if (readyTasks.length === 0) {
    const allTasks = s.store.getTasksForGoal(goalId);
    const pending = allTasks.filter(t => t.status === 'pending');
    if (pending.length === 0 && allTasks.every(t => t.status === 'completed')) {
      return { goalId, status: 'completed', completedTasks: allTasks.length, failedTasks: 0, totalTasks: allTasks.length };
    }
  }

  // Initialize or update goal tracker
  let tracker = s.goalTrackers.get(goalId);
  if (!tracker) {
    let checkpointAfter = [];
    if (goal.compiled_dag) {
      try {
        const dag = JSON.parse(goal.compiled_dag);
        if (dag.checkpoints) {
          checkpointAfter = dag.checkpoints
            .filter(c => typeof c === 'string' && c.startsWith('after_'))
            .map(c => c.replace('after_', ''));
        }
      } catch { /* use defaults */ }
    }

    const allTasks = s.store.getTasksForGoal(goalId);
    const alreadyCompleted = allTasks.filter(t => t.status === 'completed').length;
    const alreadyFailed = allTasks.filter(t => t.status === 'failed').length;

    tracker = {
      totalTasks: allTasks.length,
      completedTasks: alreadyCompleted,
      failedTasks: alreadyFailed,
      cancelled: false,
      resolved: false,
      checkpointAfter,
      resolve: null,
      reject: null,
      promise: null,
    };
    tracker.promise = new Promise((resolve, reject) => {
      tracker.resolve = resolve;
      tracker.reject = reject;
    });
    s.goalTrackers.set(goalId, tracker);
  }

  // Enqueue ready tasks with priority
  const now = Date.now();
  for (const task of readyTasks) {
    const priority = (task.priority ?? 0) + (TYPE_PRIORITY[task.type] ?? 50);
    s.queue.push({ goalId, task, userId, priority, enqueuedAt: now });
  }

  // Sort queue by priority descending, then by enqueue time (FIFO within same priority)
  s.queue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.enqueuedAt - b.enqueuedAt;
  });

  // Update total task count
  const allTasks = s.store.getTasksForGoal(goalId);
  tracker.totalTasks = allTasks.length;

  // Log submission event
  s.store.logEvent(goalId, null, 'pool_goal_submitted', {
    userId,
    readyTaskCount: readyTasks.length,
    totalTaskCount: allTasks.length,
    queueLength: s.queue.length,
  });

  // Start processing within trace context
  const { runWithTrace } = await import('../tracing/index.js');
  return runWithTrace(goalId, goalSpan?.id || null, async () => {
    await processQueueFn().catch(err => {
      console.error(`[forge:pool] processQueue error: ${err.message}\n${err.stack}`);
    });
    return tracker.promise;
  });
}

/** Admission is separate from completion so a caller cannot acknowledge an unqueued goal.
 * @returns {Promise<{goalId:string,status:'queued',completion:Promise<import('./constants.js').GovernedChunkOutcome>}>} */
export async function enqueueGovernedGoal(s, goalId, userId, mode, processQueueFn) {
  if (!s.governedChunkExecutor) throw governedPoolError('GOVERNED_EXECUTOR_REQUIRED');
  if (s.shuttingDown) throw governedPoolError('SHUTTING_DOWN');
  governedIdentifier(goalId, true); governedIdentifier(userId);
  if (!['submit', 'resume'].includes(mode)) throw governedPoolError('ADMISSION_MODE_INVALID');
  const previous = s.goalTrackers.get(goalId);
  if (previous?.admitted || previous?.controlling) throw governedPoolError('GOAL_BUSY');
  if (previous && previous.userId !== userId) throw governedPoolError('IDENTITY_INVALID');
  if (previous && GOVERNED_TERMINAL.has(previous.status)) throw governedPoolError(previous.status === 'unknown' ? 'OUTCOME_UNKNOWN' : 'GOAL_TERMINAL');
  const trackers = [...s.goalTrackers.values()];
  if (trackers.filter(value => value.admitted).length >= s.options.maxGoals) throw governedPoolError('MAX_GOALS');
  const waiting = s.queue.length + trackers.filter(value => value.admitted && value.status === 'admitting').length;
  if (waiting >= s.options.maxQueuedGoals + Math.max(0, s.maxConcurrent - s.activeWorkers.size)) throw governedPoolError('QUEUE_CAPACITY');
  if (!previous && s.goalTrackers.size >= GOVERNED_HISTORY_LIMIT) {
    const expired = [...s.goalTrackers].find(([, value]) => !value.admitted);
    if (expired) s.goalTrackers.delete(expired[0]);
  }
  const tracker = { goalId, userId, pointer: null, status: 'admitting', admitted: true,
    control: 'run', controlTail: Promise.resolve(), controlError: null, firstError: null, errorCode: null,
    completedChunks: previous?.completedChunks ?? 0, finished: false };
  tracker.completion = new Promise((resolve, reject) => { tracker.resolve = resolve; tracker.reject = reject; });
  void tracker.completion.catch(() => {});
  s.goalTrackers.set(goalId, tracker);
  tracker.admission = Promise.resolve().then(() => s.governedChunkExecutor.admit(Object.freeze({ goalId, userId, mode })))
    .then(value => {
      tracker.pointer = readGovernedGoalPointer(value, goalId, userId, previous?.pointer);
      return tracker.pointer;
    });
  try {
    await tracker.admission;
    if (tracker.control !== 'run' || s.shuttingDown) {
      if (tracker.control === 'run') tracker.control = 'shutdown';
      await awaitGovernedControlPersistence(tracker);
      if (!tracker.finished) settleGovernedGoal(s, tracker, { status: tracker.control === 'cancel' ? 'cancelled' : 'paused' });
      throw governedPoolError(tracker.status === 'unknown' ? 'OUTCOME_UNKNOWN' : 'ADMISSION_STOPPED', tracker.firstError);
    }
    tracker.status = 'queued';
    s.queue.push({ goalId, userId, goal: tracker.pointer,
      task: Object.freeze({ id: tracker.pointer.taskId, type: 'governed-chunk', agent_role: 'governed-chunk' }),
      priority: 0, enqueuedAt: Date.now() });
    emitGovernedPoolEvent(s, 'goal_queued', { goalId, taskId: tracker.pointer.taskId, mode });
    await processQueueFn();
    return Object.freeze({ goalId, status: 'queued', completion: tracker.completion });
  } catch (error) {
    if (tracker.status === 'admitting') {
      tracker.admissionFailed = true; tracker.status = 'failed'; tracker.admitted = false; tracker.finished = true; tracker.firstError ??= error;
      if (s.goalTrackers.get(goalId) === tracker) {
        if (previous) s.goalTrackers.set(goalId, previous); else s.goalTrackers.delete(goalId);
      }
      tracker.reject(error);
    }
    throw error;
  }
}

/**
 * After a task completes, check if any downstream tasks have become ready
 * and enqueue them.
 */
export function enqueueNewlyReadyTasks(s, goalId, userId) {
  const tracker = s.goalTrackers.get(goalId);
  if (tracker?.cancelled) return;

  const newlyReady = s.store.getReadyTasks(goalId);
  if (newlyReady.length === 0) return;

  const queuedTaskIds = new Set(s.queue.map(e => e.task.id));
  const activeTaskIds = new Set(
    [...s.activeWorkers.values()].filter(w => w.goalId === goalId).map(w => w.taskId)
  );

  const now = Date.now();
  for (const task of newlyReady) {
    if (queuedTaskIds.has(task.id) || activeTaskIds.has(task.id)) continue;
    const priority = (task.priority ?? 0) + (TYPE_PRIORITY[task.type] ?? 50);
    s.queue.push({ goalId, task, userId, priority, enqueuedAt: now });
  }

  s.queue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.enqueuedAt - b.enqueuedAt;
  });
}

/**
 * Check if all tasks for a goal are done and resolve/reject the goal promise.
 */
export function checkGoalCompletion(s, goalId) {
  const tracker = s.goalTrackers.get(goalId);
  if (!tracker || tracker.cancelled || tracker.resolved) return;

  const activeForGoal = [...s.activeWorkers.values()].filter(w => w.goalId === goalId);
  if (activeForGoal.length > 0) return;

  const queuedForGoal = s.queue.filter(e => e.goalId === goalId);
  if (queuedForGoal.length > 0) return;

  const allTasks = s.store.getTasksForGoal(goalId);
  const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'running');
  const failed = allTasks.filter(t => t.status === 'failed');
  const completed = allTasks.filter(t => t.status === 'completed');

  if (pending.length > 0) {
    for (const t of pending) {
      s.store.updateTaskStatus(goalId, t.id, 'blocked', {
        errorMessage: 'Dependencies failed or no worker available',
      });
    }
  }

  s.selfLoop?.cleanup(goalId);
  const evolutionResult = s.evolution?.evolve();
  if (evolutionResult?.summary?.patterns?.length > 0) {
    for (const p of evolutionResult.summary.patterns) {
      console.log(`[forge:pool:evolution] Pattern: ${p.insight}`);
    }
  }

  const goalBudgetSummary = getGoalBudget(s, goalId);
  s.goalBudgets.delete(goalId);

  const finalStatus = failed.length > 0 ? 'failed' : 'completed';
  tracker.resolved = true;

  const goalSpan = s.goalSpans.get(goalId);
  if (goalSpan) {
    s.tracing?.endSpan(goalSpan.id, finalStatus === 'completed' ? 'ok' : 'error', {
      'forge.pool.goal_status': finalStatus,
      'forge.pool.completed_tasks': completed.length,
      'forge.pool.failed_tasks': failed.length,
    });
    s.goalSpans.delete(goalId);
  }

  s.store.updateGoalStatus(goalId, finalStatus);
  s.store.logEvent(goalId, null, 'pool_goal_completed', {
    status: finalStatus,
    completedTasks: completed.length,
    failedTasks: failed.length,
    totalTasks: allTasks.length,
  });

  s.eventEmitter.emit('goal_completed', {
    goalId, status: finalStatus,
    completedTasks: completed.length,
    failedTasks: failed.length,
    totalTasks: allTasks.length,
    budget: goalBudgetSummary,
  });
  if (finalStatus === 'completed') {
    s.plugins?.runHook('onGoalComplete', { goalId, status: finalStatus, completedTasks: completed.length }).catch(() => {});
  } else {
    s.plugins?.runHook('onGoalFail', { goalId, status: finalStatus, failedTasks: failed.length }).catch(() => {});
  }

  s.metrics.recordGoalCompleted({
    goalId, status: finalStatus,
    completedTasks: completed.length,
    failedTasks: failed.length,
    totalTasks: allTasks.length,
  });

  const report = {
    goalId, status: finalStatus,
    completedTasks: completed.length,
    failedTasks: failed.length,
    totalTasks: allTasks.length,
  };

  if (finalStatus === 'failed') {
    tracker.reject?.(Object.assign(new Error(`Goal ${goalId} failed: ${failed.length} task(s) failed`), report));
  } else {
    tracker.resolve?.(report);
  }

  setTimeout(() => { s.goalTrackers.delete(goalId); }, 5000);
}

/**
 * Cancel all workers and queued tasks for a specific goal.
 */
export function cancelGoal(s, goalId) {
  const tracker = s.goalTrackers.get(goalId);
  if (tracker) tracker.cancelled = true;

  let cancelledWorkers = 0;
  for (const [assignmentId, worker] of s.activeWorkers) {
    if (worker.goalId === goalId) {
      worker.abortController.abort();
      releaseFileLocks(s.fileLocks, goalId, worker.taskId);
      s.activeWorkers.delete(assignmentId);
      cancelledWorkers++;

      s.store.updateTaskStatus(goalId, worker.taskId, 'failed', {
        errorMessage: 'Cancelled by user',
      });
      s.store.logEvent(goalId, worker.taskId, 'pool_task_cancelled', {
        assignmentId, reason: 'goal_cancelled',
      });
    }
  }

  const beforeLength = s.queue.length;
  s.queue = s.queue.filter(e => e.goalId !== goalId);
  const cancelledQueued = beforeLength - s.queue.length;

  if (tracker && !tracker.resolved) {
    tracker.resolved = true;
    const goalSpan = s.goalSpans.get(goalId);
    if (goalSpan) {
      s.tracing?.endSpan(goalSpan.id, 'error', {
        'forge.pool.goal_status': 'cancelled',
        'forge.pool.cancelled_workers': cancelledWorkers,
        'forge.pool.cancelled_queued': cancelledQueued,
      });
      s.goalSpans.delete(goalId);
    }

    const report = {
      goalId, status: 'cancelled',
      completedTasks: tracker.completedTasks,
      failedTasks: tracker.failedTasks,
      totalTasks: tracker.totalTasks,
    };
    tracker.reject?.(Object.assign(new Error(`Goal ${goalId} was cancelled`), report));
  }

  s.store.logEvent(goalId, null, 'pool_goal_cancelled', { cancelledWorkers, cancelledQueued });
  s.eventEmitter.emit('goal_cancelled', { goalId, cancelledWorkers, cancelledQueued });

  return { cancelledWorkers, cancelledQueued };
}

/**
 * Resume a previously interrupted goal.
 */
export function resumeGoal(s, goalId, userId, submitGoalFn) {
  if (s.shuttingDown) {
    throw new Error('Cannot resume goals: pool is shutting down');
  }

  const goal = s.store.getGoal(goalId);
  if (!goal) throw new Error(`Goal ${goalId} not found`);

  const allTasks = s.store.getTasksForGoal(goalId);
  const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'blocked');
  if (pending.length === 0) {
    console.log(`[forge:pool] Goal ${goalId} has no pending tasks to resume`);
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const failed = allTasks.filter(t => t.status === 'failed').length;
    return Promise.resolve({ goalId, status: completed === allTasks.length ? 'completed' : 'failed', completedTasks: completed, failedTasks: failed, totalTasks: allTasks.length });
  }

  for (const t of pending) {
    if (t.status === 'blocked') {
      s.store.updateTaskStatus(goalId, t.id, 'pending');
    }
  }

  s.store.updateGoalStatus(goalId, 'running');
  console.log(`[forge:pool] Resuming goal ${goalId}: ${pending.length} pending tasks out of ${allTasks.length}`);
  s.store.logEvent(goalId, null, 'pool_goal_resumed', {
    pendingTasks: pending.length, totalTasks: allTasks.length,
  });

  return submitGoalFn(goalId, userId);
}

/**
 * Recover all interrupted goals after a server restart.
 */
export async function recoverInterruptedGoals(s, userId, resumeGoalFn) {
  const runningGoals = s.store.listGoals({ status: 'running' }) ?? [];
  if (runningGoals.length === 0) {
    console.log('[forge:pool] No interrupted goals to recover');
    return [];
  }

  console.log(`[forge:pool] Found ${runningGoals.length} interrupted goal(s) to recover`);
  const recovered = [];

  for (const goal of runningGoals) {
    try {
      const allTasks = s.store.getTasksForGoal(goal.id);
      const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'blocked' || t.status === 'running');

      if (pending.length === 0) {
        const failed = allTasks.filter(t => t.status === 'failed').length;
        s.store.updateGoalStatus(goal.id, failed > 0 ? 'failed' : 'completed');
        console.log(`[forge:pool] Goal ${goal.id} already finished, marked as ${failed > 0 ? 'failed' : 'completed'}`);
        continue;
      }

      for (const t of pending) {
        if (t.status === 'running') {
          s.store.updateTaskStatus(goal.id, t.id, 'pending', { errorMessage: null });
        }
      }

      await resumeGoalFn(goal.id, userId);
      recovered.push(goal.id);
      console.log(`[forge:pool] Recovered goal ${goal.id}`);
    } catch (err) {
      console.error(`[forge:pool] Failed to recover goal ${goal.id}: ${err.message}`);
    }
  }

  return recovered;
}
