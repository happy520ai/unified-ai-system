/**
 * DynamicRoleAssigner — dynamic role assignment based on task requirements and agent capabilities.
 *
 * Analyzes tasks to determine required roles, assigns agents based on availability
 * and capability, records outcomes for learning, and rebalances workload.
 *
 * Usage:
 *   import { DynamicRoleAssigner } from './dynamic-roles/index.js';
 *   const assigner = new DynamicRoleAssigner({ maxAgentsPerTask: 4 });
 *
 *   // Analyze a task
 *   const analysis = assigner.analyzeTask({
 *     type: 'implement',
 *     prompt: 'Add JWT authentication to the user module',
 *     allowedFiles: ['src/auth.js', 'src/user.js'],
 *   });
 *   // { roles: [{ role: 'coder', priority: 'primary', ... }], ... }
 *
 *   // Assign agents
 *   const result = assigner.assignAgents(task, availableAgents);
 *   // { assignments: [{ agentId, role, task }], unassigned: [...] }
 *
 *   // Record outcome for learning
 *   assigner.recordOutcome(taskId, agentId, 'coder', { success: true, duration: 5000, quality: 0.9 });
 *
 *   // Get agent stats
 *   const stats = assigner.getAgentStats('agent-1');
 *   // { tasksCompleted: 10, successRate: 0.9, avgDuration: 4500, bestRoles: [...] }
 */

import {
  TaskType as _TaskType,
  RolePriority as _RolePriority,
  Complexity as _Complexity,
  ROLE_TEMPLATES as _ROLE_TEMPLATES,
  uid as _uid,
  estimateComplexity as _estimateComplexity,
  isParallelizable as _isParallelizable,
  computeAgentStats as _computeAgentStats,
  scoreAgentCandidate as _scoreAgentCandidate,
} from './helpers.js';

// Re-export public enums so existing consumers keep working.
export { TaskType, RolePriority, Complexity } from './helpers.js';

// ── DynamicRoleAssigner class ─────────────────────────────────────────────────

/**
 * @typedef {object} Task
 * @property {string} type — one of TaskType
 * @property {string} prompt — task description
 * @property {string[]} [allowedFiles] — files the task may modify
 */

/**
 * @typedef {object} Agent
 * @property {string} agentId — unique agent identifier
 * @property {string} role — agent's current role
 * @property {string[]} capabilities — list of capability tags
 * @property {number} [load=0] — current task count
 * @property {string} [goalId] — goal the agent is working on
 */

/**
 * @typedef {object} Assignment
 * @property {string} agentId — assigned agent
 * @property {string} role — assigned role
 * @property {Task} task — the task being assigned
 */

/**
 * @typedef {object} TaskOutcome
 * @property {boolean} success — whether the task succeeded
 * @property {number} duration — task duration in milliseconds
 * @property {number} [quality=0.5] — quality score 0-1
 * @property {string[]} [issues] — any issues encountered
 */

export class DynamicRoleAssigner {
  /** @type {number} maximum agents that can be assigned to a single task */
  #maxAgentsPerTask;

  /** @type {number} workload imbalance threshold for rebalancing (0-1) */
  #rebalanceThreshold;

  /** @type {Map<string, object[]>} agent performance history keyed by agentId */
  #agentHistory = new Map();

  /** @type {Map<string, object>} active assignments keyed by taskId */
  #activeAssignments = new Map();

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxAgentsPerTask=4] — max agents per task
   * @param {number} [opts.rebalanceThreshold=0.3] — workload imbalance threshold
   */
  constructor(opts = {}) {
    this.#maxAgentsPerTask = opts.maxAgentsPerTask ?? 4;
    this.#rebalanceThreshold = opts.rebalanceThreshold ?? 0.3;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Task Analysis ──────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Analyze a task and determine required roles.
   *
   * Based on task.type, task.prompt, and task.allowedFiles:
   *   - 'implement' → primary: coder, support: architect (if complex)
   *   - 'test' → primary: tester, support: coder (for test helpers)
   *   - 'verify' → primary: verifier, support: tester
   *   - 'debug' → primary: debugger, support: code-archaeologist
   *   - 'review' → primary: reviewer, support: architect
   *   - 'refactor' → primary: architect, support: coder + tester
   *
   * @param {Task} task — the task to analyze
   * @returns {{
   *   roles: Array<{ role: string, priority: string, reason: string }>,
   *   estimatedComplexity: string,
   *   parallelizable: boolean,
   * }}
   */
  analyzeTask(task) {
    const taskType = task.type ?? _TaskType.IMPLEMENT;
    const template = _ROLE_TEMPLATES[taskType] ?? _ROLE_TEMPLATES[_TaskType.IMPLEMENT];

    // Estimate complexity based on prompt length and file count
    const complexity = _estimateComplexity(task);

    // Determine if the task is parallelizable
    const parallelizable = _isParallelizable(taskType, complexity);

    // Filter roles based on complexity
    let roles = [...template];
    if (complexity === _Complexity.LOW) {
      // For low complexity, only keep primary roles
      roles = roles.filter((r) => r.priority === _RolePriority.PRIMARY);
    }

    return {
      roles,
      estimatedComplexity: complexity,
      parallelizable,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Agent Assignment ───────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Assign agents to a task based on availability and capability.
   *
   * Matching considers:
   *   - agent's current load (prefer less-loaded agents)
   *   - past performance on similar tasks
   *   - role compatibility (agent's role matches required role)
   *   - goal affinity (agents working on the same goal)
   *
   * @param {Task & { taskId?: string }} task — the task to assign
   * @param {Agent[]} availableAgents — list of available agents
   * @returns {{
   *   assignments: Assignment[],
   *   unassigned: Array<{ role: string, reason: string }>,
   * }}
   */
  assignAgents(task, availableAgents) {
    const analysis = this.analyzeTask(task);
    const requiredRoles = analysis.roles;

    /** @type {Assignment[]} */
    const assignments = [];
    /** @type {Array<{ role: string, reason: string }>} */
    const unassigned = [];

    // Sort agents by load (ascending) to prefer less-loaded agents
    const sortedAgents = [...availableAgents].sort((a, b) => (a.load ?? 0) - (b.load ?? 0));

    // Track which agents have been assigned
    const assignedAgentIds = new Set();

    for (const requiredRole of requiredRoles) {
      if (assignments.length >= this.#maxAgentsPerTask) {
        unassigned.push({
          role: requiredRole.role,
          reason: `Maximum agents per task (${this.#maxAgentsPerTask}) reached.`,
        });
        continue;
      }

      // Find the best matching agent
      const candidate = this.#findBestAgent(
        requiredRole.role,
        sortedAgents,
        assignedAgentIds,
        task
      );

      if (candidate) {
        assignments.push({
          agentId: candidate.agentId,
          role: requiredRole.role,
          task,
        });
        assignedAgentIds.add(candidate.agentId);
      } else {
        unassigned.push({
          role: requiredRole.role,
          reason: 'No available agent with matching capability.',
        });
      }
    }

    // Record the assignment
    const taskId = task.taskId ?? _uid('task');
    this.#activeAssignments.set(taskId, {
      taskId,
      task,
      assignments,
      assignedAt: Date.now(),
    });

    return { assignments, unassigned };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Outcome Recording & Learning ───────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Record a task outcome for learning and future assignment improvement.
   *
   * @param {string} taskId — the task identifier
   * @param {string} agentId — the agent who performed the task
   * @param {string} role — the role the agent was assigned to
   * @param {TaskOutcome} outcome — the outcome details
   */
  recordOutcome(taskId, agentId, role, outcome) {
    if (!this.#agentHistory.has(agentId)) {
      this.#agentHistory.set(agentId, []);
    }

    this.#agentHistory.get(agentId).push({
      taskId,
      role,
      success: Boolean(outcome.success),
      duration: Number(outcome.duration ?? 0),
      quality: Math.max(0, Math.min(1, Number(outcome.quality ?? 0.5))),
      issues: Array.isArray(outcome.issues) ? outcome.issues : [],
      timestamp: Date.now(),
    });

    // Remove from active assignments if this was the last agent
    const assignment = this.#activeAssignments.get(taskId);
    if (assignment) {
      this.#activeAssignments.delete(taskId);
    }
  }

  /**
   * Get performance statistics for an agent.
   *
   * @param {string} agentId — the agent to query
   * @returns {{
   *   tasksCompleted: number,
   *   successRate: number,
   *   avgDuration: number,
   *   bestRoles: Array<{ role: string, score: number }>,
   *   strengths: string[],
   * }}
   */
  getAgentStats(agentId) {
    const history = this.#agentHistory.get(agentId);
    return _computeAgentStats(history);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Workload Rebalancing ───────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Rebalance workload across agents.
   *
   * If some agents are overloaded (many tasks) and others idle:
   *   - Reassign support tasks from busy to idle agents
   *   - Keep primary role assignments stable
   *
   * @param {Array<{ agentId: string, load: number, tasks: Assignment[] }>} currentAssignments
   * @returns {{
   *   newAssignments: Array<{ agentId: string, load: number, tasks: Assignment[] }>,
   *   movedCount: number,
   * }}
   */
  rebalance(currentAssignments) {
    if (currentAssignments.length < 2) {
      return { newAssignments: currentAssignments, movedCount: 0 };
    }

    // Calculate average load
    const totalLoad = currentAssignments.reduce((sum, a) => sum + a.load, 0);
    const avgLoad = totalLoad / currentAssignments.length;

    // Identify overloaded and underloaded agents
    const overloaded = currentAssignments.filter(
      (a) => a.load > avgLoad * (1 + this.#rebalanceThreshold)
    );
    const underloaded = currentAssignments.filter(
      (a) => a.load < avgLoad * (1 - this.#rebalanceThreshold)
    );

    if (overloaded.length === 0 || underloaded.length === 0) {
      return { newAssignments: currentAssignments, movedCount: 0 };
    }

    // Clone assignments for mutation
    const newAssignments = currentAssignments.map((a) => ({
      agentId: a.agentId,
      load: a.load,
      tasks: [...a.tasks],
    }));

    let movedCount = 0;

    // Move support tasks from overloaded to underloaded
    for (const overloadedAgent of overloaded) {
      const agentEntry = newAssignments.find((a) => a.agentId === overloadedAgent.agentId);
      if (!agentEntry) continue;

      // Find support tasks that can be moved
      const movableTasks = agentEntry.tasks.filter(
        (t) => t.role !== 'primary' && t.task?.type !== _TaskType.VERIFY
      );

      for (const task of movableTasks) {
        if (underloaded.length === 0) break;

        // Find the least-loaded underloaded agent
        const target = underloaded.reduce((min, a) => {
          const entry = newAssignments.find((na) => na.agentId === a.agentId);
          return entry && entry.load < min.load ? entry : min;
        }, { load: Infinity, agentId: '' });

        if (!target.agentId) break;

        const targetEntry = newAssignments.find((a) => a.agentId === target.agentId);
        if (!targetEntry) break;

        // Move the task
        agentEntry.tasks = agentEntry.tasks.filter((t) => t !== task);
        agentEntry.load -= 1;
        targetEntry.tasks.push(task);
        targetEntry.load += 1;
        movedCount++;

        // Update underloaded list
        const idx = underloaded.findIndex((a) => a.agentId === target.agentId);
        if (idx >= 0) underloaded.splice(idx, 1);
        if (targetEntry.load >= avgLoad) {
          // No longer underloaded
        }
      }
    }

    return { newAssignments, movedCount };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Status ─────────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Get overall status of the role assigner.
   *
   * @returns {{
   *   agentCount: number,
   *   assignmentCount: number,
   *   avgLoad: number,
   *   roleUtilization: Record<string, number>,
   * }}
   */
  getStatus() {
    const agentCount = this.#agentHistory.size;
    const assignmentCount = this.#activeAssignments.size;

    // Calculate role utilization from history
    /** @type {Record<string, number>} */
    const roleCounts = {};
    let totalEntries = 0;

    for (const history of this.#agentHistory.values()) {
      for (const entry of history) {
        roleCounts[entry.role] = (roleCounts[entry.role] ?? 0) + 1;
        totalEntries++;
      }
    }

    const roleUtilization = {};
    for (const [role, count] of Object.entries(roleCounts)) {
      roleUtilization[role] = totalEntries > 0
        ? Math.round((count / totalEntries) * 100) / 100
        : 0;
    }

    // Calculate average load from active assignments
    let avgLoad = 0;
    if (assignmentCount > 0) {
      let totalTasks = 0;
      for (const assignment of this.#activeAssignments.values()) {
        totalTasks += assignment.assignments.length;
      }
      avgLoad = Math.round((totalTasks / Math.max(agentCount, 1)) * 100) / 100;
    }

    return {
      agentCount,
      assignmentCount,
      avgLoad,
      roleUtilization,
    };
  }

  /**
   * Clear all history and active assignments.
   */
  clear() {
    this.#agentHistory.clear();
    this.#activeAssignments.clear();
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── Internal Helpers ───────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Find the best agent for a required role.
   *
   * Scoring:
   *   - role match: +3
   *   - capability match: +1 per matching capability
   *   - past performance: +0 to +2 based on success rate
   *   - load penalty: -1 per active task
   *
   * @param {string} requiredRole — the role needed
   * @param {Agent[]} agents — sorted agent list (by load ascending)
   * @param {Set<string>} assignedIds — already-assigned agent ids
   * @param {Task} task — the task being assigned
   * @returns {Agent|null}
   */
  #findBestAgent(requiredRole, agents, assignedIds, task) {
    let bestAgent = null;
    let bestScore = -Infinity;

    for (const agent of agents) {
      if (assignedIds.has(agent.agentId)) continue;

      const stats = _computeAgentStats(this.#agentHistory.get(agent.agentId));
      const score = _scoreAgentCandidate(agent, requiredRole, stats, task);

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }
}
