/**
 * Pool Status & Getters
 * Builds status reports and provides accessor methods
 */

import { MAX_VERIFY_RETRIES } from './constants.js';

/**
 * Get current pool status.
 */
export function getStatus(s, self) {
  const activeGoalIds = new Set([...s.activeWorkers.values()].map(w => w.goalId));
  const queuedGoalIds = new Set(s.queue.map(e => e.goalId));

  return {
    activeWorkers: s.activeWorkers.size,
    maxConcurrent: s.maxConcurrent,
    maxGoals: s.options.maxGoals,
    queueLength: s.queue.length,
    activeGoals: activeGoalIds.size,
    workers: [...s.activeWorkers.values()].map(w => ({
      goalId: w.goalId,
      taskId: w.taskId,
      userId: w.userId,
      workerType: w.workerType,
      startedAt: w.startedAt,
      files: w.files?.length ?? 0,
    })),
    goals: [...s.goalTrackers.entries()].map(([goalId, t]) => ({
      goalId,
      totalTasks: t.totalTasks,
      completedTasks: t.completedTasks,
      failedTasks: t.failedTasks,
      cancelled: t.cancelled,
      budget: getGoalBudget(s, goalId),
    })),
    queue: s.queue.slice(0, 10).map(e => ({
      goalId: e.goalId,
      taskId: e.task.id,
      taskName: e.task.name?.substring(0, 60),
      type: e.task.type,
      priority: e.priority,
    })),
    fileLocks: Object.fromEntries(
      [...s.fileLocks.entries()].map(([file, lock]) => [file, { goalId: lock.goalId, taskId: lock.taskId }])
    ),
    budget: s.budget?.getStatus?.() ?? null,
    verification: {
      enabled: !!s.verifier,
      autoVerify: s.options.enableAutoVerify !== false,
      ...s.verificationStats,
      retryQueue: s.queue.filter(e => (e.verifyRetryCount ?? 0) > 0).length,
    },
    metrics: s.metrics.getSummary(),
    selfLoop: getSelfLoop(s),
    costCalculator: {
      models: s.costCalculator?.getModels() || [],
    },
    deadLetterQueue: s.deadLetterQueue?.getStatus() || null,
    progress: s.progressEstimator?.getStatus() || null,
    memory: s.memoryEngine?.getStatus() || null,
    health: s.healthDashboard?.getStatus() || null,
    costAttribution: s.costAttribution?.getStatus() || null,
    adaptiveScaling: s.adaptiveScaling?.getStatus() || null,
    errorPatterns: s.errorPatternLearner?.getStatus() || null,
    knowledgeGraph: s.knowledgeGraph?.getStatus() || null,
    semanticMemory: s.semanticMemory?.getStats() || null,
    promptRegistry: s.promptRegistry?.getStatus() || null,
    multiAgentReview: s.multiAgentReview?.getStatus() || null,
    sandbox: s.sandboxExecutor?.getStatus() || null,
    liveStream: s.liveStream?.getStatus() || null,
    injectionDefense: s.injectionDefense?.getStatus() || null,
    selfHealing: s.selfHealing?.getStatus() || null,
    gracefulDegradation: s.gracefulDegradation?.getStatus() || null,
    crossSessionMemory: s.crossSessionMemory?.getStatus() || null,
    configHub: s.configHub?.getStatus() || null,
    config: {
      maxConcurrent: s.maxConcurrent,
      maxGoals: s.options.maxGoals,
      enableAutoVerify: s.options.enableAutoVerify,
      maxVerifyRetries: (s.config?.pool?.maxVerifyRetries ?? MAX_VERIFY_RETRIES),
      verifyMaxTier: (s.config?.pool?.verifyMaxTier ?? 2),
    },
  };
}

export function getMetrics(s) {
  return s.metrics.getMetrics();
}

export function getPlugins(s) {
  return s.plugins?.getStatus() || null;
}

export function getResilience(s) {
  return {
    circuitBreaker: s.circuitBreaker?.getStatus() || null,
    adaptiveTimeout: s.adaptiveTimeout?.getStatus() || null,
  };
}

export function getSelfLoop(s) {
  return {
    enabled: !!s.selfLoop,
    maxLoops: s.config?.selfLoop?.maxLoops ?? 4,
    defaultTier: s.config?.selfLoop?.defaultTier ?? 2,
    evolution: s.evolution?.getStats() || null,
  };
}

export function getCostCalculator(s) {
  return {
    models: s.costCalculator?.getModels() || [],
  };
}

export function getDeadLetterQueue(s) {
  return s.deadLetterQueue?.getStatus() || null;
}

export function getProgressEstimator(s) {
  return s.progressEstimator?.getStatus() || null;
}

export function getMemoryEngine(s) {
  return {
    hot: s.memoryEngine?.getHotMemory?.() || [],
    warm: s.memoryEngine?.getWarmMemory?.() || {},
    stats: s.memoryEngine?.getStats?.() || {},
  };
}

export function getGoalProgress(s, goalId) {
  const tracker = s.goalTrackers.get(goalId);
  if (!tracker) return null;
  return {
    goalId,
    totalTasks: tracker.totalTasks,
    completedTasks: tracker.completedTasks,
    failedTasks: tracker.failedTasks,
    cancelled: tracker.cancelled,
  };
}

export function getGoalBudget(s, goalId) {
  const gb = s.goalBudgets.get(goalId);
  if (!gb) return null;
  const elapsedMinutes = (Date.now() - gb.startedAt) / 60_000;
  const exceeded =
    (gb.maxTokens && gb.usedTokens >= gb.maxTokens) ||
    (gb.maxCost && gb.usedCost >= gb.maxCost) ||
    (gb.maxMinutes && elapsedMinutes >= gb.maxMinutes);
  const reason = exceeded
    ? (gb.maxTokens && gb.usedTokens >= gb.maxTokens ? 'tokens' :
       gb.maxCost && gb.usedCost >= gb.maxCost ? 'cost' : 'time')
    : null;
  return {
    maxTokens: gb.maxTokens,
    maxCost: gb.maxCost,
    maxMinutes: gb.maxMinutes,
    usedTokens: gb.usedTokens,
    usedCost: gb.usedCost,
    elapsedMinutes: parseFloat(elapsedMinutes.toFixed(1)),
    exceeded,
    reason,
  };
}

export function getTracing(s) {
  return s.tracing?.getStatus() || null;
}

export function getTracingManager(s) {
  return s.tracing || null;
}
