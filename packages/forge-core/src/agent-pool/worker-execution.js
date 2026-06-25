/**
 * Worker Execution
 * Core execution flow for a single worker task
 */

import { CODE_MUTATING_TYPES } from './constants.js';
import { releaseFileLocks } from './file-locks.js';
import { runAutoVerification, runSelfLoopDecision } from './worker-verification.js';
import { handleTaskFailure, handleWorkerException } from './worker-failure.js';

/**
 * Execute a single worker task and handle completion/failure.
 *
 * @param {object} s - state object
 * @param {string} assignmentId
 * @param {object} entry — the queue entry
 * @param {object} worker — the instantiated worker
 * @param {object} task — the task record from the store
 * @param {object} callbacks - { cleanupAssignmentFn, enqueueNewlyReadyTasksFn, checkGoalCompletionFn, processQueueFn }
 */
export async function executeWorker(s, assignmentId, entry, worker, task, callbacks) {
  const { goalId, userId } = entry;
  const tracker = s.goalTrackers.get(goalId);
  let result;
  const startTime = Date.now();
  const workerRole = task.agent_role || task.agentRole;

  // Create worker-level trace span
  const workerSpan = s.tracing?.startSpan({
    traceId: goalId,
    operationName: 'worker_execution',
    goalId,
    taskId: task.id,
    attributes: { 'forge.pool.assignment_id': assignmentId, 'forge.pool.task_id': task.id, 'forge.pool.worker_type': workerRole }
  });

  try {
    // Self-loop: snapshot files before code-mutating tasks for rollback capability
    let fileSnapshot = null;
    if (CODE_MUTATING_TYPES.has(task.type)) {
      const targetFiles = (task.allowedFiles || task.allowed_files || [])
        .filter(f => !f.includes('*') && f.match(/\.(js|ts|mjs|cjs|json)$/));
      if (targetFiles.length > 0 && targetFiles.length <= 30) {
        try {
          fileSnapshot = await s.selfLoop.snapshotBefore(s.projectRoot, targetFiles);
        } catch (snapErr) {
          console.log(`[forge:pool] Snapshot failed (non-fatal): ${snapErr.message}`);
        }
      }
    }

    // P9: Self-healing pre-check
    if (s.selfHealing) {
      try {
        const healthReport = await s.selfHealing.checkAll();
        const unhealthy = healthReport.filter(r => !r.healthy);
        if (unhealthy.length > 0) {
          s.store.logEvent(goalId, task.id, 'pool_health_degraded', {
            unhealthyModules: unhealthy.map(r => r.moduleId),
          });
          for (const issue of unhealthy) {
            try {
              const healResult = await s.selfHealing.heal(issue.moduleId);
              if (healResult?.healed) {
                s.store.logEvent(goalId, task.id, 'pool_healing_success', {
                  module: issue.moduleId, action: healResult.action,
                });
              } else {
                s.store.logEvent(goalId, task.id, 'pool_healing_failed', {
                  module: issue.moduleId, reason: healResult?.reason || 'unknown',
                });
                if (['circuitBreaker', 'taskQueue'].includes(issue.moduleId)) {
                  const reduced = Math.max(1, s.maxConcurrent - 1);
                  if (reduced < s.maxConcurrent) {
                    s.maxConcurrent = reduced;
                    s.store.logEvent(goalId, task.id, 'pool_concurrency_reduced', {
                      from: reduced + 1, to: reduced,
                      reason: `Healing failed for ${issue.moduleId}`,
                    });
                  }
                }
              }
            } catch { /* heal failure is non-fatal */ }
          }
        }
      } catch { /* health check failure is non-fatal */ }
    }

    // P9: Graceful degradation
    if (s.gracefulDegradation) {
      const pressure = s.gracefulDegradation.evaluatePressure({
        queueDepth: s.queue.length,
        activeWorkers: s.activeWorkers.size,
        maxConcurrent: s.maxConcurrent,
        recentFailures: 0,
      });
      if (pressure !== 'normal') {
        s.store.logEvent(goalId, task.id, 'pool_pressure_detected', {
          pressure, queueDepth: s.queue.length, activeWorkers: s.activeWorkers.size,
        });
      }

      if (pressure !== 'normal') {
        if (pressure === 'moderate' || pressure === 'high' || pressure === 'critical') {
          if (s.gracefulDegradation.isModuleEnabled('multiAgentReview')) {
            s.gracefulDegradation.disableModule('multiAgentReview', 'pressure_cascade');
          }
          if (s.gracefulDegradation.isModuleEnabled('crossSessionStorage')) {
            s.gracefulDegradation.disableModule('crossSessionStorage', 'pressure_cascade');
          }
        }

        if (pressure === 'high' || pressure === 'critical') {
          if (s.gracefulDegradation.isModuleEnabled('semanticEnrichment')) {
            s.gracefulDegradation.disableModule('semanticEnrichment', 'pressure_cascade');
          }
          if (s.gracefulDegradation.isModuleEnabled('impactAnalysis')) {
            s.gracefulDegradation.disableModule('impactAnalysis', 'pressure_cascade');
          }
        }

        if (pressure === 'critical') {
          if (s.gracefulDegradation.isModuleEnabled('codeIntel')) {
            s.gracefulDegradation.disableModule('codeIntel', 'pressure_cascade');
          }
          if (s.gracefulDegradation.isModuleEnabled('checkpoint')) {
            s.gracefulDegradation.disableModule('checkpoint', 'pressure_cascade');
          }
        }
      }
    }

    // Wrap worker execution with circuit breaker + adaptive timeout
    const providerKey = task.type || 'default';
    const execStart = Date.now();
    const timeoutMs = s.adaptiveTimeout.getTimeout();

    result = await Promise.race([
      s.circuitBreaker.call(providerKey, async () => {
        return worker.execute(
          { ...task, allowed_files: task.allowedFiles, allowedFiles: task.allowedFiles },
          s.projectRoot,
          {}
        );
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Worker timeout: ${workerRole} exceeded ${timeoutMs}ms (adaptive)`)), timeoutMs)
      ),
    ]);

    s.adaptiveTimeout.record(Date.now() - execStart);

    s.adaptiveScaling.record({
      queueDepth: s.queue.length,
      activeWorkers: s.activeWorkers.size,
      avgExecutionTime: Date.now() - startTime,
      successRate: result.success ? 1 : 0,
      timestamp: Date.now(),
    });

    const scaling = s.adaptiveScaling.getRecommendedWorkers();
    if (scaling.action !== 'hold') {
      const applied = s.adaptiveScaling.applyScaling(scaling.recommended);
      s.maxConcurrent = applied.current;
      s.store.logEvent(goalId, task.id, 'pool_scaling_applied', {
        action: scaling.action, from: applied.previous, to: applied.current, reason: scaling.reason,
      });
    }

    if (s.budget && result.tokenUsage) {
      s.budget.recordUsage?.({
        model: result.tokenUsage.model || 'default',
        inputTokens: result.tokenUsage.inputTokens || 0,
        outputTokens: result.tokenUsage.outputTokens || 0,
        totalTokens: result.tokenUsage.totalTokens || 0,
      });
    }

    // Per-Goal Budget Hard Limit Check
    const goalBudget = s.goalBudgets.get(goalId);
    if (goalBudget && result.tokenUsage) {
      const tokensUsed = result.tokenUsage.totalTokens || 0;
      const costUsed = result.tokenUsage.cost || 0;
      goalBudget.usedTokens += tokensUsed;
      goalBudget.usedCost += costUsed;

      let exceededReason = null;
      if (goalBudget.maxTokens && goalBudget.usedTokens >= goalBudget.maxTokens) {
        exceededReason = `tokens: ${goalBudget.usedTokens.toLocaleString()} >= ${goalBudget.maxTokens.toLocaleString()}`;
      } else if (goalBudget.maxCost && goalBudget.usedCost >= goalBudget.maxCost) {
        exceededReason = `cost: $${goalBudget.usedCost.toFixed(4)} >= $${goalBudget.maxCost}`;
      } else if (goalBudget.maxMinutes) {
        const elapsedMinutes = (Date.now() - goalBudget.startedAt) / 60_000;
        if (elapsedMinutes >= goalBudget.maxMinutes) {
          exceededReason = `time: ${elapsedMinutes.toFixed(1)}min >= ${goalBudget.maxMinutes}min`;
        }
      }

      if (exceededReason) {
        console.log(`[forge:pool] Per-goal budget exceeded for ${goalId}: ${exceededReason}`);
        s.store.updateGoalStatus(goalId, 'budget_exceeded');
        s.store.logEvent(goalId, task.id, 'pool_goal_budget_exceeded', {
          reason: exceededReason,
          usedTokens: goalBudget.usedTokens,
          usedCost: goalBudget.usedCost,
          elapsedMinutes: ((Date.now() - goalBudget.startedAt) / 60_000).toFixed(1),
        });

        s.queue = s.queue.filter(e => e.goalId !== goalId);

        if (tracker && !tracker.resolved) {
          tracker.resolved = true;
          const report = {
            goalId, status: 'budget_exceeded',
            completedTasks: tracker.completedTasks,
            failedTasks: tracker.failedTasks,
            totalTasks: tracker.totalTasks,
            budget: {
              usedTokens: goalBudget.usedTokens,
              usedCost: goalBudget.usedCost,
              elapsedMinutes: parseFloat(((Date.now() - goalBudget.startedAt) / 60_000).toFixed(1)),
              reason: exceededReason,
            },
          };
          tracker.resolve?.(report);
        }

        s.eventEmitter.emit('goal_budget_exceeded', {
          goalId, reason: exceededReason,
          usedTokens: goalBudget.usedTokens,
          usedCost: goalBudget.usedCost,
        });
      }
    }

    worker.storePostExecutionLearnings?.(result, task);

    if (tracker?.cancelled) {
      callbacks.cleanupAssignmentFn(assignmentId);
      return;
    }

    // Run verification engine for verify-type tasks
    if (task.type === 'verify' && result.success && s.verifier) {
      try {
        const verifyResult = await s.verifier.verify(goalId, task.id, { maxTier: (s.config?.pool?.verifyMaxTier ?? 2) });
        result.verification = verifyResult;
        if (verifyResult.overall === 'FAIL') {
          const allChecks = verifyResult.tiers.flatMap(t => t.checks);
          const passed = allChecks.filter(c => c.status === 'PASS').length;
          const total = allChecks.length;
          const skipped = allChecks.filter(c => c.status === 'SKIP').length;

          for (const tier of verifyResult.tiers) {
            for (const check of tier.checks) {
              if (check.status === 'FAIL') {
                console.log(`[forge:pool:verify] Tier ${tier.tier} / ${check.name} FAILED: ${(check.output || '').slice(0, 200)}`);
              }
            }
          }

          if (passed > 0 || (passed === 0 && total === skipped)) {
            console.log(`[forge:pool] Verification partial: ${passed}/${total} passed — accepting with warnings`);
            result.verificationWarning = `Partial pass: ${passed}/${total} checks passed`;
          } else {
            result.success = false;
            result.error = `Verification failed: ${JSON.stringify(verifyResult.tiers.map(t => ({ tier: t.tier, status: t.status })))}`;
          }
        }
      } catch (verifyErr) {
        console.log(`[forge:pool] Verification engine error: ${verifyErr.message}`);
      }
    }

    // Run auto-verification for code-mutating tasks
    result = await runAutoVerification(s, goalId, task, userId, entry, result, tracker);

    // Run self-loop decision
    result = await runSelfLoopDecision(s, goalId, task, userId, entry, result, fileSnapshot, startTime);

    // Run code intelligence impact analysis
    if (result.success && s.codeIntel && result.filesModified?.length > 0) {
      try {
        const impact = await s.codeIntel.analyzeImpact?.(result.filesModified);
        if (impact) {
          result.impactAnalysis = impact;
          s.store.logEvent(goalId, task.id, 'pool_impact_analysis', {
            filesAnalyzed: impact.filesAffected?.length ?? 0,
            warnings: impact.warnings?.length ?? 0,
          });
        }
      } catch { /* Code intel is best-effort */ }
    }

    // Handle success/failure
    if (result.success) {
      s.store.updateTaskStatus(goalId, task.id, 'completed', {
        resultJson: JSON.stringify(result),
      });

      for (const fm of (result.filesModified ?? [])) {
        s.store.recordArtifact({ goalId, taskId: task.id, filePath: fm.path, action: fm.action });
      }

      if (tracker) tracker.completedTasks++;

      if (tracker?.checkpointAfter?.includes(task.id) && s.checkpoint) {
        try {
          const cpId = s.checkpoint.createCheckpoint(goalId, task.id, {
            summary: `Task ${task.id} (${task.type}) completed successfully`,
            keyDecisions: result.filesModified?.map(fm => `${fm.action}: ${fm.path}`) ?? [],
            budget: s.budget?.getStatus?.() ?? {},
          });
          console.log(`[forge:pool] Checkpoint created: ${cpId} after ${task.id}`);
        } catch (cpErr) {
          console.log(`[forge:pool] Checkpoint creation failed (non-fatal): ${cpErr.message}`);
        }
      }

      s.eventEmitter.emit('task_completed', {
        assignmentId, goalId, taskId: task.id, userId, result,
        durationMs: Date.now() - startTime,
        workerType: entry.task?.type || task.type,
      });

      s.liveStream.emit({
        type: 'task_complete', taskId: task.id, goalId,
        data: { durationMs: Date.now() - startTime, filesModified: result.filesModified?.length ?? 0 },
      });
      s.plugins?.runHook('onTaskComplete', {
        goalId, taskId: task.id, task, result,
        durationMs: Date.now() - startTime,
        workerType: entry.task?.type || task.type,
      }).catch(() => {});

      s.metrics.recordTaskCompleted({
        taskId: task.id, goalId,
        workerType: entry.task?.type || task.type,
        durationMs: Date.now() - startTime,
        filesModified: result.filesModified,
      });

      s.store.logEvent(goalId, task.id, 'pool_task_completed', {
        assignmentId, success: true,
        filesModified: result.filesModified?.length ?? 0,
      });

      s.completedTaskIds.add(task.id);

      s.progressEstimator.recordTaskCompletion(goalId, task.id, {
        durationMs: Date.now() - startTime, taskType: task.type,
      });

      if (result.tokenUsage) {
        s.costAttribution.record({
          goalId, taskId: task.id, workerType: workerRole,
          model: result.tokenUsage.model || 'default',
          inputTokens: result.tokenUsage.inputTokens || 0,
          outputTokens: result.tokenUsage.outputTokens || 0,
          cost: result.tokenUsage.cost || 0,
          duration: Date.now() - startTime,
        });
      }

      if (s.crossSessionMemory && result) {
        try {
          const taskDesc = task.name || task.prompt?.slice(0, 100) || task.id;
          if (result.success && result.summary) {
            s.crossSessionMemory.store('insights', {
              content: `[${task.type}] ${taskDesc}: ${result.summary.slice(0, 300)}`,
              source: `${goalId}/${task.id}`,
              tags: [task.type, result.success ? 'success' : 'failure'],
            });
          }
          if (!result.success && result.error) {
            s.crossSessionMemory.store('errorFixes', {
              content: `[${task.type}] ${taskDesc} failed: ${String(result.error).slice(0, 300)}`,
              source: `${goalId}/${task.id}`,
              tags: ['error', task.type],
            });
          }
        } catch { /* cross-session storage is non-critical */ }
      }

      s.decisionTrace.record({
        goalId, taskId: task.id, workerType: workerRole,
        decision: 'task_completion', outcome: 'success',
        context: { taskType: task.type, filesModified: result.filesModified?.length ?? 0, durationMs: Date.now() - startTime },
      });

      s.adaptiveScaling.record({
        queueDepth: s.queue.length,
        activeWorkers: s.activeWorkers.size,
        avgExecutionTime: Date.now() - startTime,
        successRate: 1,
      });
    } else {
      handleTaskFailure(s, goalId, task, userId, entry, tracker, result, assignmentId, startTime, workerRole);
    }
  } catch (err) {
    if (!handleWorkerException(s, goalId, task, userId, entry, tracker, err, assignmentId, startTime)) {
      callbacks.cleanupAssignmentFn(assignmentId);
      return;
    }
  } finally {
    if (workerSpan) {
      const spanStatus = result?.success ? 'ok' : 'error';
      s.tracing?.endSpan(workerSpan.id, spanStatus, {
        'forge.pool.duration_ms': Date.now() - startTime,
      });
    }

    releaseFileLocks(s.fileLocks, goalId, task.id);

    const duration = Date.now() - startTime;
    s.store.logEvent(goalId, task.id, 'pool_task_duration', { assignmentId, durationMs: duration });

    callbacks.cleanupAssignmentFn(assignmentId);
    callbacks.enqueueNewlyReadyTasksFn(goalId, userId);
    callbacks.checkGoalCompletionFn(goalId);

    if (s.gracefulDegradation) {
      const currentPressure = s.gracefulDegradation.evaluatePressure({
        queueDepth: s.queue.length,
        activeWorkers: s.activeWorkers.size,
        maxConcurrent: s.maxConcurrent,
      });

      if (currentPressure === 'normal') {
        s.gracefulDegradation.restoreAll();
      } else if (currentPressure === 'moderate') {
        s.gracefulDegradation.reenableModule('semanticEnrichment');
        s.gracefulDegradation.reenableModule('impactAnalysis');
        s.gracefulDegradation.reenableModule('codeIntel');
        s.gracefulDegradation.reenableModule('checkpoint');
      }
    }

    callbacks.processQueueFn();
  }
}
