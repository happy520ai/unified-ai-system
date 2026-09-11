/**
 * Pool Shutdown
 * Graceful shutdown with in-flight task draining and persistence
 */
import { GOVERNED_TERMINAL, governedIdentifier, governedGoalReport, governedPoolError, awaitGovernedControlPersistence } from './constants.js';
import { settleGovernedGoal } from './worker-failure.js';

/** Control is persisted by the server port. No slot is freed before execution settles. */
/** @param {object} s @param {string} goalId @param {string} userId @param {'pause'|'cancel'|'shutdown'} reason @param {string} [expectedBindingHash] */
export async function controlGovernedGoal(s, goalId, userId, reason, expectedBindingHash = undefined) {
  governedIdentifier(goalId, true); governedIdentifier(userId);
  if (!['pause', 'cancel', 'shutdown'].includes(reason)) throw governedPoolError('CONTROL_INVALID');
  const tracker = s.goalTrackers.get(goalId);
  if (!tracker || tracker.userId !== userId) throw governedPoolError('GOAL_NOT_FOUND');
  if (expectedBindingHash !== undefined && (typeof expectedBindingHash !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(expectedBindingHash)
    || tracker.pointer?.bindingHash !== expectedBindingHash)) throw governedPoolError('BINDING_CHANGED');
  if (!tracker.admitted && GOVERNED_TERMINAL.has(tracker.status)) return governedGoalReport(tracker);
  // Explicit operator controls outrank a service lifecycle drain.
  const ranks = { run: 0, shutdown: 1, pause: 2, cancel: 3 };
  if (ranks[reason] > ranks[tracker.control]) {
    tracker.control = reason;
    tracker.controlling = true;
    s.queue = s.queue.filter(entry => entry.goalId !== goalId);
    if (reason === 'cancel') {
      for (const assignment of s.activeWorkers.values()) if (assignment.goalId === goalId) {
        assignment.abortController.abort(governedPoolError('CANCEL_REQUESTED'));
      }
    }
    tracker.controlTail = tracker.controlTail.then(async () => {
      await tracker.admission;
      await s.governedChunkExecutor.cancel(Object.freeze({ goal: tracker.pointer, reason }));
    }).catch(error => { tracker.controlError ??= error; tracker.firstError ??= error; });
  }
  await awaitGovernedControlPersistence(tracker);
  if (tracker.admissionFailed) throw tracker.firstError;
  const active = [...s.activeWorkers.values()].filter(assignment => assignment.goalId === goalId);
  if (active.length) {
    await Promise.all(active.map(assignment => assignment.settlement));
  } else if (!tracker.finished || tracker.status === 'paused' && tracker.control === 'cancel') {
    settleGovernedGoal(s, tracker, { status: tracker.controlError ? 'unknown' : tracker.control === 'cancel' ? 'cancelled' : 'paused' }, tracker.firstError);
  }
  tracker.controlling = false;
  await s.governedProcessQueue();
  return governedGoalReport(tracker);
}

async function shutdownGovernedPool(s) {
  if (s.governedShutdown) return s.governedShutdown;
  s.shuttingDown = true;
  s.governedShutdown = (async () => {
    const controls = [...s.goalTrackers.values()].filter(tracker => tracker.admitted || tracker.controlling)
      .map(tracker => controlGovernedGoal(s, tracker.goalId, tracker.userId, 'shutdown'));
    const results = await Promise.allSettled(controls);
    await Promise.allSettled([...s.activeWorkers.values()].map(assignment => assignment.settlement));
    if (s.activeWorkers.size || s.queue.length) throw governedPoolError('SHUTDOWN_UNKNOWN');
    return Object.freeze({ status: 'stopped', activeWorkers: 0, queueLength: 0,
      outcomeUnknown: results.some(result => result.status === 'rejected' || result.value.status === 'unknown') });
  })();
  return s.governedShutdown;
}

/**
 * Shutdown the pool gracefully.
 *
 * Stops accepting new goals, waits for in-flight workers to finish (up to
 * a timeout), then cancels any remaining active workers and clears the queue.
 */
export async function shutdown(s, { timeoutMs = 30_000 } = {}) {
  if (s.governedChunkExecutor) return shutdownGovernedPool(s);
  s.shuttingDown = true;

  // A3: 清理孤儿检测定时器
  if (s.orphanCheckInterval) {
    clearInterval(s.orphanCheckInterval);
    s.orphanCheckInterval = null;
  }

  console.log(`[forge:pool] Shutting down: ${s.activeWorkers.size} active workers, ${s.queue.length} queued tasks`);

  // Clear the queue — but tasks remain in SQLite as 'pending' for recovery
  const droppedTasks = s.queue.length;
  s.queue = [];

  // Wait for active workers to finish, with a timeout
  if (s.activeWorkers.size > 0) {
    const startTime = Date.now();
    const pollInterval = 500;

    while (s.activeWorkers.size > 0 && (Date.now() - startTime) < timeoutMs) {
      console.log(`[forge:pool] Waiting for ${s.activeWorkers.size} worker(s) to finish... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Force-cancel remaining workers — but reset tasks to 'pending' for recovery
    if (s.activeWorkers.size > 0) {
      console.log(`[forge:pool] Timeout reached, interrupting ${s.activeWorkers.size} remaining worker(s)`);
      for (const [assignmentId, worker] of s.activeWorkers) {
        worker.abortController.abort();
        s.store.updateTaskStatus(worker.goalId, worker.taskId, 'pending', {
          errorMessage: 'Interrupted by pool shutdown',
        });
        s.store.logEvent(worker.goalId, worker.taskId, 'pool_shutdown_interrupted', {
          assignmentId,
        });
        s.activeWorkers.delete(assignmentId);
      }
    }
  }

  // Keep goals in 'running' status — they'll be recovered on next startup
  const interruptedGoalIds = [];
  for (const [goalId, tracker] of s.goalTrackers) {
    if (!tracker.resolved) {
      tracker.resolved = true;
      interruptedGoalIds.push(goalId);
      tracker.resolve?.({
        goalId,
        status: 'interrupted',
        completedTasks: tracker.completedTasks,
        failedTasks: tracker.failedTasks,
        totalTasks: tracker.totalTasks,
      });
    }
  }
  s.goalTrackers.clear();
  s.goalSpans.clear();

  // Remove all event listeners
  s.eventEmitter.removeAllListeners();

  // Save memory engine state to disk for cross-session persistence
  if (s.memoryEngine) {
    try { await s.memoryEngine.save(); } catch { /* ignore */ }
  }
  if (s.costAttribution) {
    try { await s.costAttribution.save(); } catch { /* ignore */ }
  }
  if (s.decisionTrace) {
    try { await s.decisionTrace.save(); } catch { /* ignore */ }
  }
  if (s.errorPatternLearner) {
    try { await s.errorPatternLearner.save(); } catch { /* ignore */ }
  }
  if (s.promptRegistry) {
    try { await s.promptRegistry.save(); } catch { /* ignore */ }
  }
  if (s.selfHealing) {
    try { s.selfHealing.stop(); } catch { /* ignore */ }
  }
  if (s.crossSessionMemory) {
    try { await s.crossSessionMemory.save(); } catch { /* ignore */ }
  }

  // Close SQLite database connection
  if (s.store?.close) {
    try { s.store.close(); } catch { /* ignore */ }
  }

  if (interruptedGoalIds.length > 0) {
    console.log(`[forge:pool] Shutdown complete. ${interruptedGoalIds.length} goal(s) preserved for recovery: ${interruptedGoalIds.join(', ')}`);
  } else {
    console.log(`[forge:pool] Shutdown complete. Dropped ${droppedTasks} queued task(s).`);
  }
}
