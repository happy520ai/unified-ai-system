/**
 * Process Queue
 * Assigns idle worker slots to queued tasks with cross-goal fair scheduling
 */

import crypto from 'node:crypto';
import { WORKER_MAP, extractFilesFromPrompt } from './constants.js';
import { extractTaskFiles, checkFileConflict, acquireFileLocks } from './file-locks.js';

/**
 * Process the queue: assign idle worker slots to queued tasks.
 *
 * Runs after every state change (task submitted, task completed, task cancelled).
 * Dequeues the highest-priority task, instantiates the correct worker, records
 * the assignment, and fires off execution asynchronously.
 */
export async function processQueue(s, { executeWorkerFn, checkGoalCompletionFn, cleanupAssignmentFn }) {
  if (s.shuttingDown) return;
  console.log(`[forge:pool:debug] processQueue called — queue=${s.queue.length}, activeWorkers=${s.activeWorkers.size}, maxConcurrent=${s.maxConcurrent}`);

  // P10: Self-healing health gate — pause queue if critical modules are unhealthy
  if (s.selfHealing) {
    try {
      const healthReport = await s.selfHealing.checkAll();
      console.log(`[forge:pool:debug] Health gate: ${JSON.stringify(healthReport.map(r => `${r.moduleId}:${r.healthy ? 'ok' : r.health}`).join(', '))}`);
      const criticalFailures = healthReport.filter(r =>
        r.health === 'critical' && ['circuitBreaker', 'taskQueue'].includes(r.moduleId)
      );
      if (criticalFailures.length > 0) {
        console.log(`[forge:pool:debug] Critical failures detected: ${criticalFailures.map(r => r.moduleId).join(', ')}`);
        s.store.logEvent?.('system', null, 'pool_health_gate_paused', {
          failures: criticalFailures.map(r => r.moduleId),
        });
        await new Promise(r => setTimeout(r, 5000));
        const recheck = await s.selfHealing.checkAll();
        const stillBad = recheck.filter(r =>
          r.health === 'critical' && ['circuitBreaker', 'taskQueue'].includes(r.moduleId)
        );
        if (stillBad.length > 0) {
          console.log(`[forge:pool:debug] Health gate still critical after pause, aborting this cycle`);
          return;
        }
        console.log(`[forge:pool:debug] Health gate recovered after pause`);
      }
    } catch (err) {
      console.log(`[forge:pool:debug] Health check threw: ${err.message}`);
    }
  }

  console.log(`[forge:pool:debug] Entering dequeue loop — activeWorkers=${s.activeWorkers.size}, maxConcurrent=${s.maxConcurrent}, queueLength=${s.queue.length}`);
  while (s.activeWorkers.size < s.maxConcurrent && s.queue.length > 0) {
    // Check global budget before scheduling more work
    if (s.budget) {
      try {
        s.budget.checkBudget?.();
      } catch {
        console.log('[forge:pool] Global budget exceeded, pausing queue');
        break;
      }
    }

    // Cross-goal fair scheduling: round-robin across goals, priority within each goal.
    let selectedIndex = -1;

    const goalEntries = new Map();
    for (let i = 0; i < s.queue.length; i++) {
      const entry = s.queue[i];
      const tracker = s.goalTrackers.get(entry.goalId);
      if (tracker?.cancelled) {
        s.queue.splice(i, 1);
        i--;
        continue;
      }
      if (!goalEntries.has(entry.goalId)) {
        goalEntries.set(entry.goalId, []);
      }
      goalEntries.get(entry.goalId).push({ index: i, entry });
    }

    const uniqueGoals = [...goalEntries.keys()];
    if (uniqueGoals.length > 0) {
      if (s.rrGoalIndex >= uniqueGoals.length) s.rrGoalIndex = 0;

      for (let g = 0; g < uniqueGoals.length; g++) {
        const goalIdx = (s.rrGoalIndex + g) % uniqueGoals.length;
        const goalId = uniqueGoals[goalIdx];

        // Skip goals whose per-goal budget is already exceeded
        const goalBudget = s.goalBudgets.get(goalId);
        if (goalBudget) {
          const elapsedMinutes = (Date.now() - goalBudget.startedAt) / 60_000;
          const budgetExceeded =
            (goalBudget.maxTokens && goalBudget.usedTokens >= goalBudget.maxTokens) ||
            (goalBudget.maxCost && goalBudget.usedCost >= goalBudget.maxCost) ||
            (goalBudget.maxMinutes && elapsedMinutes >= goalBudget.maxMinutes);
          if (budgetExceeded) {
            s.queue = s.queue.filter(e => e.goalId !== goalId);
            continue;
          }
        }

        const entries = goalEntries.get(goalId);
        for (const { index, entry } of entries) {
          // DAG dependency check
          if (entry.task.dependsOn && Array.isArray(entry.task.dependsOn) && entry.task.dependsOn.length > 0) {
            const allDepsComplete = entry.task.dependsOn.every(depId =>
              s.completedTaskIds.has(depId)
            );
            if (!allDepsComplete) continue;
          }

          const taskFiles = extractTaskFiles(entry.task);
          const conflict = checkFileConflict(s.fileLocks, taskFiles, goalId);
          if (!conflict) {
            selectedIndex = index;
            s.rrGoalIndex = (goalIdx + 1) % uniqueGoals.length;
            break;
          }
        }
        if (selectedIndex !== -1) break;
      }
    }

    if (selectedIndex === -1) break;

    const entry = s.queue.splice(selectedIndex, 1)[0];
    const { goalId, task, userId } = entry;
    console.log(`[forge:pool:debug] Selected task ${task.id} (${task.type}/${task.agent_role || task.agentRole}) from goal ${goalId}`);

    const tracker = s.goalTrackers.get(goalId);
    if (tracker?.cancelled) continue;

    // Resolve worker factory
    const workerRole = task.agent_role || task.agentRole;
    const workerFactory = WORKER_MAP[workerRole];
    if (!workerFactory) {
      s.store.logEvent(goalId, task.id, 'pool_worker_not_found', {
        role: workerRole,
        error: `No worker registered for role: ${workerRole}`,
      });
      s.store.updateTaskStatus(goalId, task.id, 'failed', {
        errorMessage: `No worker registered for role: ${workerRole}`,
      });
      if (tracker) {
        tracker.failedTasks++;
        checkGoalCompletionFn(goalId);
      }
      continue;
    }

    // Create assignment
    const assignmentId = `assign-${crypto.randomUUID().slice(0, 12)}`;
    const abortController = new AbortController();
    const worker = workerFactory();
    worker.setMemoryEngine?.(s.memoryEngine);
    worker.setSemanticMemory?.(s.semanticMemory);
    worker.setKnowledgeGraph?.(s.knowledgeGraph);
    worker.setErrorPatternLearner?.(s.errorPatternLearner);
    worker.setPromptRegistry?.(s.promptRegistry);
    worker.setInjectionDefense?.(s.injectionDefense);
    worker.setContextEngine?.(s.contextEngine);
    worker.setCrossSessionMemory?.(s.crossSessionMemory);

    // Expand allowedFiles for mutation tasks
    let allowedFiles;
    if (typeof task.allowed_files === 'string') {
      try { allowedFiles = JSON.parse(task.allowed_files); } catch { allowedFiles = []; }
    } else {
      allowedFiles = task.allowed_files || [];
    }
    if (!Array.isArray(allowedFiles)) allowedFiles = [];
    const mutationTypes = new Set(['implement', 'test', 'refactor']);
    if (mutationTypes.has(task.type)) {
      const promptFiles = task.prompt ? extractFilesFromPrompt(task.prompt) : [];
      const expanded = new Set([
        ...allowedFiles, ...promptFiles,
        'src/**/*.js', 'src/**/*.ts', 'src/**/*.mjs',
        'lib/**/*.js', 'lib/**/*.ts',
        'test/**/*.js', 'test/**/*.ts', 'tests/**/*.js', 'tests/**/*.ts',
      ]);
      for (const coreFile of ['src/server.js', 'src/index.js', 'src/app.js', 'src/main.js', 'src/router.js', 'src/config.js']) {
        expanded.add(coreFile);
      }
      allowedFiles = [...expanded];
    }
    task.allowedFiles = allowedFiles;
    task.allowed_files = allowedFiles;

    // Acquire file locks
    const taskFilesForLock = extractTaskFiles(task);
    const lockedFiles = acquireFileLocks(s.fileLocks, taskFilesForLock, goalId, task.id);

    s.activeWorkers.set(assignmentId, {
      worker, goalId, taskId: task.id, userId,
      workerType: workerRole,
      startedAt: new Date().toISOString(),
      abortController,
      files: lockedFiles,
    });

    s.store.logEvent(goalId, task.id, 'pool_assignment_created', {
      assignmentId, workerType: workerRole, userId,
    });
    s.store.updateTaskStatus(goalId, task.id, 'running');

    s.eventEmitter.emit('task_started', {
      assignmentId, goalId, taskId: task.id, userId, workerType: workerRole,
    });
    s.plugins?.runHook('onTaskStart', { goalId, taskId: task.id, task, workerType: workerRole }).catch(() => {});

    s.metrics.recordTaskStart({
      taskId: task.id, workerType: workerRole, enqueuedAt: entry.enqueuedAt,
    });

    // Fire and forget: execute the task asynchronously
    executeWorkerFn(assignmentId, entry, worker, task).catch((err) => {
      console.error(`[forge:pool] CRITICAL: executeWorker threw outside its try/catch for ${task.id}:`, err);
      try {
        s.store.updateTaskStatus(goalId, task.id, 'failed', {
          errorMessage: `Worker execution crashed: ${err instanceof Error ? err.message : String(err)}`,
        });
        s.store.logEvent(goalId, task.id, 'pool_worker_crash', {
          assignmentId,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      } catch (cleanupErr) {
        console.error(`[forge:pool] Failed to cleanup crashed task ${task.id}:`, cleanupErr);
      }
      cleanupAssignmentFn(assignmentId);
    });
  }
}
