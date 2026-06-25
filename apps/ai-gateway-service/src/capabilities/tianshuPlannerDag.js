// =============================================================================
// 天枢规划器 — DAG 算法工具
// Tianshu Planner — Pure DAG algorithm functions
// =============================================================================

/**
 * 构建执行 DAG：使用 Kahn 算法进行拓扑排序，
 * 并识别可并行执行的任务分组
 *
 * @param {import("./tianshuPlannerConstants.js").SubTask[]} subTasks
 * @param {function} logFn - logging callback (level, message)
 * @returns {import("./tianshuPlannerConstants.js").ExecutionDAG}
 */
export function buildExecutionDAG(subTasks, logFn) {
  if (subTasks.length === 0) {
    return { executionOrder: [], maxDepth: 0, parallelismFactor: 0 };
  }

  const taskIds = new Set(subTasks.map((t) => t.id));
  const inDegree = new Map();
  const adjacency = new Map();

  for (const task of subTasks) {
    inDegree.set(task.id, task.dependencies.filter((d) => taskIds.has(d)).length);
    adjacency.set(task.id, []);
  }

  for (const task of subTasks) {
    for (const depId of task.dependencies) {
      if (adjacency.has(depId)) {
        adjacency.get(depId).push(task.id);
      }
    }
  }

  /** @type {string[][]} */
  const executionOrder = [];
  let queue = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let processedCount = 0;

  while (queue.length > 0) {
    executionOrder.push([...queue]);
    processedCount += queue.length;

    const nextQueue = [];
    for (const id of queue) {
      for (const neighbor of (adjacency.get(id) || [])) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    queue = nextQueue;
  }

  if (processedCount < subTasks.length) {
    if (logFn) logFn("warn", `DAG contains cycles — ${subTasks.length - processedCount} tasks unreachable. Forcing remaining tasks.`);

    const processedIds = new Set(executionOrder.flat());
    const remaining = subTasks.map((t) => t.id).filter((id) => !processedIds.has(id));

    if (remaining.length > 0) {
      executionOrder.push(remaining);
      processedCount += remaining.length;
    }
  }

  const maxDepth = executionOrder.length;
  const parallelismFactor = subTasks.length > 0
    ? Math.round((subTasks.length / maxDepth) * 100) / 100
    : 0;

  return { executionOrder, maxDepth, parallelismFactor };
}

/**
 * 估算 DAG 总耗时（每个并行组取最长任务的预估时间）
 *
 * @param {import("./tianshuPlannerConstants.js").SubTask[]} subTasks
 * @param {import("./tianshuPlannerConstants.js").ExecutionDAG} dag
 * @returns {number} 预估总耗时 (ms)
 */
export function estimateDAGDuration(subTasks, dag) {
  const taskMap = new Map(subTasks.map((t) => [t.id, t]));
  let total = 0;

  for (const group of dag.executionOrder) {
    let groupMax = 0;
    for (const taskId of group) {
      const task = taskMap.get(taskId);
      if (task) {
        groupMax = Math.max(groupMax, task.estimatedDuration || 10_000);
      }
    }
    total += groupMax;
  }

  return total;
}

/**
 * 防御性移除子任务列表中的循环依赖
 *
 * @param {import("./tianshuPlannerConstants.js").SubTask[]} subTasks
 */
export function removeCycles(subTasks) {
  const idSet = new Set(subTasks.map((t) => t.id));
  const visited = new Set();
  const inStack = new Set();
  const taskMap = new Map(subTasks.map((t) => [t.id, t]));

  function dfs(id) {
    visited.add(id);
    inStack.add(id);

    const task = taskMap.get(id);
    if (!task) return;

    const safeDeps = [];
    for (const depId of task.dependencies) {
      if (!idSet.has(depId)) continue;
      if (inStack.has(depId)) continue;
      if (!visited.has(depId)) {
        dfs(depId);
      }
      safeDeps.push(depId);
    }

    task.dependencies = safeDeps;
    inStack.delete(id);
  }

  for (const task of subTasks) {
    if (!visited.has(task.id)) {
      dfs(task.id);
    }
  }
}
