/**
 * Extracted enumerations, constants, and pure helpers for DynamicRoleAssigner.
 *
 * These were moved out of index.js to keep the class module under 500 lines.
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

/**
 * Task types that can be analyzed.
 * @readonly
 * @enum {string}
 */
export const TaskType = Object.freeze({
  IMPLEMENT: 'implement',
  TEST: 'test',
  VERIFY: 'verify',
  DEBUG: 'debug',
  REVIEW: 'review',
  REFACTOR: 'refactor',
});

/**
 * Role priority levels.
 * @readonly
 * @enum {string}
 */
export const RolePriority = Object.freeze({
  PRIMARY: 'primary',
  SUPPORT: 'support',
});

/**
 * Estimated complexity levels.
 * @readonly
 * @enum {string}
 */
export const Complexity = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

/** All valid task types as an array. */
export const ALL_TASK_TYPES = Object.values(TaskType);

// ── Role requirement templates ────────────────────────────────────────────────

/**
 * @type {Record<string, Array<{ role: string, priority: string, reason: string }>>}
 */
export const ROLE_TEMPLATES = Object.freeze({
  [TaskType.IMPLEMENT]: [
    { role: 'coder', priority: RolePriority.PRIMARY, reason: 'Implementation requires code writing.' },
    { role: 'architect', priority: RolePriority.SUPPORT, reason: 'Architecture guidance for complex implementations.' },
  ],
  [TaskType.TEST]: [
    { role: 'tester', priority: RolePriority.PRIMARY, reason: 'Test writing and execution.' },
    { role: 'coder', priority: RolePriority.SUPPORT, reason: 'Test helper implementation if needed.' },
  ],
  [TaskType.VERIFY]: [
    { role: 'verifier', priority: RolePriority.PRIMARY, reason: 'Verification of correctness.' },
    { role: 'tester', priority: RolePriority.SUPPORT, reason: 'Test coverage validation.' },
  ],
  [TaskType.DEBUG]: [
    { role: 'debugger', priority: RolePriority.PRIMARY, reason: 'Bug investigation and root cause analysis.' },
    { role: 'code-archaeologist', priority: RolePriority.SUPPORT, reason: 'Historical context for bug origin.' },
  ],
  [TaskType.REVIEW]: [
    { role: 'reviewer', priority: RolePriority.PRIMARY, reason: 'Code review and quality assessment.' },
    { role: 'architect', priority: RolePriority.SUPPORT, reason: 'Architecture conformance check.' },
  ],
  [TaskType.REFACTOR]: [
    { role: 'architect', priority: RolePriority.PRIMARY, reason: 'Refactoring requires architectural decisions.' },
    { role: 'coder', priority: RolePriority.SUPPORT, reason: 'Code restructuring implementation.' },
    { role: 'tester', priority: RolePriority.SUPPORT, reason: 'Regression test validation.' },
  ],
});

// ── Pure helper functions ─────────────────────────────────────────────────────

/**
 * Generate a short unique identifier.
 * @param {string} [prefix='id'] — optional prefix
 * @returns {string}
 */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Estimate task complexity based on prompt length, file count, and task type.
 * @param {object} task
 * @returns {string} one of Complexity values
 */
export function estimateComplexity(task) {
  const promptLength = (task.prompt ?? '').length;
  const fileCount = Array.isArray(task.allowedFiles) ? task.allowedFiles.length : 0;
  const taskType = task.type ?? TaskType.IMPLEMENT;

  // Base complexity from task type
  let score = 0;
  switch (taskType) {
    case TaskType.REFACTOR: score += 3; break;
    case TaskType.IMPLEMENT: score += 2; break;
    case TaskType.DEBUG: score += 2; break;
    case TaskType.REVIEW: score += 1; break;
    case TaskType.TEST: score += 1; break;
    case TaskType.VERIFY: score += 1; break;
    default: score += 1;
  }

  // Adjust for prompt length
  if (promptLength > 500) score += 2;
  else if (promptLength > 200) score += 1;

  // Adjust for file count
  if (fileCount > 10) score += 2;
  else if (fileCount > 5) score += 1;

  // Map score to complexity
  if (score >= 5) return Complexity.HIGH;
  if (score >= 3) return Complexity.MEDIUM;
  return Complexity.LOW;
}

/**
 * Determine if a task type is parallelizable.
 * @param {string} taskType
 * @param {string} complexity
 * @returns {boolean}
 */
export function isParallelizable(taskType, complexity) {
  // Refactor and debug are generally sequential
  if (taskType === TaskType.REFACTOR || taskType === TaskType.DEBUG) {
    return false;
  }
  // High complexity tasks benefit from parallel work
  if (complexity === Complexity.HIGH) {
    return true;
  }
  // Test and verify can be parallelized
  return taskType === TaskType.TEST || taskType === TaskType.VERIFY;
}

/**
 * Compute performance statistics from an agent history array.
 * @param {object[]} history
 * @returns {{ tasksCompleted: number, successRate: number, avgDuration: number, bestRoles: Array<{role: string, score: number}>, strengths: string[] }}
 */
export function computeAgentStats(history) {
  if (!history || history.length === 0) {
    return {
      tasksCompleted: 0,
      successRate: 0,
      avgDuration: 0,
      bestRoles: [],
      strengths: [],
    };
  }

  const tasksCompleted = history.length;
  const successCount = history.filter((h) => h.success).length;
  const successRate = Math.round((successCount / tasksCompleted) * 100) / 100;
  const avgDuration = Math.round(
    history.reduce((sum, h) => sum + h.duration, 0) / tasksCompleted
  );

  // Compute role performance scores
  /** @type {Record<string, { totalScore: number, count: number }>} */
  const roleScores = {};
  for (const entry of history) {
    if (!roleScores[entry.role]) {
      roleScores[entry.role] = { totalScore: 0, count: 0 };
    }
    // Score = success (0.5) + quality (0.5)
    const score = (entry.success ? 0.5 : 0) + entry.quality * 0.5;
    roleScores[entry.role].totalScore += score;
    roleScores[entry.role].count += 1;
  }

  const bestRoles = Object.entries(roleScores)
    .map(([role, data]) => ({
      role,
      score: Math.round((data.totalScore / data.count) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score);

  // Identify strengths (roles with score > 0.7 and at least 2 tasks)
  const strengths = bestRoles
    .filter((r) => r.score > 0.7 && (roleScores[r.role].count >= 2))
    .map((r) => r.role);

  return {
    tasksCompleted,
    successRate,
    avgDuration,
    bestRoles,
    strengths,
  };
}

/**
 * Score a single agent candidate for a required role.
 * @param {object} agent
 * @param {string} requiredRole
 * @param {object} stats — result of computeAgentStats
 * @param {object} task
 * @returns {number}
 */
export function scoreAgentCandidate(agent, requiredRole, stats, task) {
  let score = 0;

  // Role match
  if (agent.role === requiredRole) score += 3;

  // Capability match
  const capabilities = agent.capabilities ?? [];
  if (capabilities.includes(requiredRole)) score += 2;

  // Past performance on this role
  if (stats.tasksCompleted > 0) {
    score += stats.successRate * 2; // 0 to 2 points

    // Bonus for having this role in bestRoles
    const roleEntry = stats.bestRoles.find((r) => r.role === requiredRole);
    if (roleEntry) score += roleEntry.score;
  }

  // Load penalty
  score -= (agent.load ?? 0) * 1;

  // Goal affinity bonus
  if (agent.goalId && task.allowedFiles?.length > 0) {
    score += 1; // Agents on the same goal get a small bonus
  }

  return score;
}
