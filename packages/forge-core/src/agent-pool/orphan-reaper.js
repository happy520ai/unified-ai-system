/**
 * Orphan Task Reaper
 * Scans for tasks that are stuck in 'running' state with no active worker
 */

/**
 * A3: 孤儿任务收割机
 *
 * 扫描数据库中所有 status='running' 的任务,如果:
 *   1. 该任务不在 activeWorkers 中(没有活跃的 worker 在跑),或
 *   2. 任务运行时间超过 taskTimeoutMs
 * 则标记为 failed,防止任务永远卡住。
 */
export async function reapOrphanTasks(s) {
  if (!s.store) return;

  let orphaned = [];
  try {
    const runningTasks = s.store.getTasksByStatus
      ? s.store.getTasksByStatus('running')
      : [];
    const now = Date.now();
    const activeAssignmentIds = new Set([...s.activeWorkers.values()].map(w => w.taskId));

    for (const task of runningTasks) {
      const startedAt = task.started_at ? new Date(task.started_at).getTime() : 0;
      const runtimeMs = now - startedAt;
      const isActive = activeAssignmentIds.has(task.id);

      const isTimedOut = startedAt > 0 && runtimeMs > s.taskTimeoutMs;
      const isOrphan = !isActive && startedAt > 0;

      if (isTimedOut || isOrphan) {
        orphaned.push({
          goalId: task.goal_id,
          taskId: task.id,
          name: task.name,
          runtimeMs,
          reason: isTimedOut ? 'timeout' : 'orphan',
        });
      }
    }
  } catch (err) {
    console.error('[forge:pool] Orphan reaper: failed to query tasks:', err);
    return;
  }

  if (orphaned.length === 0) return;

  for (const orphan of orphaned) {
    try {
      const runtimeMin = Math.round(orphan.runtimeMs / 60_000);

      let filesExist = false;
      try {
        const taskData = s.store.getTask(orphan.goalId, orphan.taskId);
        if (taskData?.allowed_files) {
          const files = typeof taskData.allowed_files === 'string'
            ? JSON.parse(taskData.allowed_files)
            : taskData.allowed_files;
          if (Array.isArray(files) && files.length > 0) {
            const fs = await import('node:fs/promises');
            const checks = await Promise.all(files.map(f => fs.access(f).then(() => true).catch(() => false)));
            filesExist = checks.some(c => c);
          }
        }
      } catch { /* 文件检查失败,继续走 failed 路径 */ }

      const reason = orphan.reason === 'timeout'
        ? `Task timed out after ${runtimeMin} minutes`
        : `Task became orphaned`;

      if (filesExist) {
        s.store.updateTaskStatus(orphan.goalId, orphan.taskId, 'completed', {
          errorMessage: null,
          resultJson: JSON.stringify({
            success: true,
            note: `Recovered by orphan-reaper: ${reason}, but target files exist. Marked completed.`,
            recoveredAt: new Date().toISOString(),
          }),
        });
        s.store.logEvent(orphan.goalId, orphan.taskId, 'pool_orphan_recovered', {
          reason: orphan.reason,
          runtimeMs: orphan.runtimeMs,
          filesVerified: true,
        });
        console.log(`[forge:pool:reaper] RECOVERED ${orphan.reason} task ${orphan.taskId} (${orphan.name}) — files exist, marked completed`);
      } else {
        s.store.updateTaskStatus(orphan.goalId, orphan.taskId, 'failed', {
          errorMessage: `[orphan-reaper] ${reason} after ${runtimeMin}min`,
        });
        s.store.logEvent(orphan.goalId, orphan.taskId, 'pool_orphan_reaped', {
          taskId: orphan.taskId,
          reason: orphan.reason,
          runtimeMs: orphan.runtimeMs,
          runtimeMinutes: runtimeMin,
        });
        console.log(`[forge:pool:reaper] Reaped ${orphan.reason} task ${orphan.taskId} (${orphan.name}) after ${runtimeMin}min`);
      }
    } catch (err) {
      console.error(`[forge:pool:reaper] Failed to reap task ${orphan.taskId}:`, err);
    }
  }
}
