/**
 * Worker Failure Handling
 * Handles task failure result path and exception catch path
 */

/**
 * Handle task failure (result.success === false path).
 */
export function handleTaskFailure(s, goalId, task, userId, entry, tracker, result, assignmentId, startTime, workerRole) {
  s.store.incrementRetry(goalId, task.id);
  const taskData = s.store.getTask(goalId, task.id);

  s.errorPatternLearner.recordError({
    taskId: task.id, goalId, workerType: workerRole,
    errorType: result.error || 'task_failure',
    message: (result.error || result.output || 'Unknown error').slice(0, 500),
    context: { taskType: task.type, retryCount: taskData?.retry_count ?? 0 },
  });

  s.decisionTrace.record({
    goalId, taskId: task.id, workerType: workerRole,
    decision: 'task_completion', outcome: 'failure',
    context: { taskType: task.type, error: (result.error || '').slice(0, 200), durationMs: Date.now() - startTime },
  });

  s.adaptiveScaling.record({
    queueDepth: s.queue.length,
    activeWorkers: s.activeWorkers.size,
    avgExecutionTime: Date.now() - startTime,
    successRate: 0,
  });

  if (taskData && taskData.retry_count < taskData.max_retries) {
    s.store.updateTaskStatus(goalId, task.id, 'pending', {
      errorMessage: result.error || result.output || 'Unknown error',
    });
    s.queue.push({
      goalId, task, userId,
      priority: (entry.priority ?? 50) - 10,
      enqueuedAt: Date.now(),
    });
    s.store.logEvent(goalId, task.id, 'pool_task_retry', {
      assignmentId, retryCount: taskData.retry_count, maxRetries: taskData.max_retries,
    });
  } else {
    s.store.updateTaskStatus(goalId, task.id, 'failed', {
      errorMessage: result.error || result.output || 'Unknown error',
    });
    if (tracker) tracker.failedTasks++;
    s.store.logEvent(goalId, task.id, 'pool_task_failed', {
      assignmentId,
      error: result.error || result.output,
      retryCount: taskData?.retry_count ?? 0,
    });
  }

  s.eventEmitter.emit('task_failed', {
    assignmentId, goalId, taskId: task.id, userId,
    error: result.error || result.output || 'Unknown error',
    retried: taskData ? taskData.retry_count < taskData.max_retries : false,
    durationMs: Date.now() - startTime,
    workerType: task.type,
  });
  s.plugins?.runHook('onTaskFail', {
    goalId, taskId: task.id, task,
    error: result.error || result.output || 'Unknown error',
    retried: taskData ? taskData.retry_count < taskData.max_retries : false,
    durationMs: Date.now() - startTime,
    workerType: task.type,
  }).catch(() => {});

  s.metrics.recordTaskFailed({
    taskId: task.id, goalId, workerType: task.type,
    durationMs: Date.now() - startTime,
    error: result.error || result.output,
    retried: taskData ? taskData.retry_count < taskData.max_retries : false,
  });
}

/**
 * Handle unexpected exception during worker execution (catch block).
 */
export function handleWorkerException(s, goalId, task, userId, entry, tracker, err, assignmentId, startTime) {
  if (tracker?.cancelled) return false; // signal caller to skip cleanup

  s.store.incrementRetry(goalId, task.id);
  const taskData = s.store.getTask(goalId, task.id);

  if (taskData && taskData.retry_count < taskData.max_retries) {
    s.store.updateTaskStatus(goalId, task.id, 'pending', { errorMessage: err.message });
    s.queue.push({
      goalId, task, userId,
      priority: (entry.priority ?? 50) - 10,
      enqueuedAt: Date.now(),
    });
  } else {
    s.store.updateTaskStatus(goalId, task.id, 'failed', { errorMessage: err.message });
    if (tracker) tracker.failedTasks++;
  }

  s.eventEmitter.emit('task_failed', {
    assignmentId, goalId, taskId: task.id, userId,
    error: err.message,
    retried: taskData ? taskData.retry_count < taskData.max_retries : false,
    durationMs: Date.now() - startTime,
    workerType: task.type,
  });
  s.plugins?.runHook('onTaskFail', {
    goalId, taskId: task.id, task,
    error: err.message,
    retried: taskData ? taskData.retry_count < taskData.max_retries : false,
    durationMs: Date.now() - startTime,
    workerType: task.type,
  }).catch(() => {});

  s.metrics.recordTaskFailed({
    taskId: task.id, goalId, workerType: task.type,
    durationMs: Date.now() - startTime,
    error: err.message,
    retried: taskData ? taskData.retry_count < taskData.max_retries : false,
  });

  s.store.logEvent(goalId, task.id, 'pool_task_error', { assignmentId, error: err.message });
  return true;
}
