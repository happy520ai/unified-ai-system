/**
 * Forge ↔ unified-ai-system Integration Bridge
 *
 * Adapts Forge's internal data structures to the standard
 * ResultEnvelope format used across the gateway ecosystem.
 *
 * Uses shared-utils (createOkEnvelope, createErrorEnvelope, createRequestId)
 * and shared-contracts (ErrorCategory type references).
 */

import { createOkEnvelope, createErrorEnvelope, createRequestId } from '@unified-ai-system/shared-utils';

// ---- Response Envelope Helpers ----

/**
 * Wrap data in a standard ok envelope.
 * @param {*} data - The response payload.
 * @param {object} [meta] - Optional meta (requestId, traceId, startedAt).
 * @returns {object} Standard ResultEnvelope { status: "ok", data, meta }
 */
export function okResponse(data, meta = {}) {
  return createOkEnvelope(data, meta);
}

/**
 * Wrap an error in a standard error envelope.
 * @param {string} code - Machine-readable error code.
 * @param {string} message - Human-readable message.
 * @param {object} [opts] - Additional options (category, retryable, details).
 * @returns {object} Standard ResultEnvelope { status: "error", error, meta }
 */
export function errResponse(code, message, opts = {}) {
  return createErrorEnvelope(code, message, opts);
}

/**
 * Generate a unique request ID for Forge operations.
 * @param {string} [prefix] - Optional prefix (default: "forge").
 * @returns {string}
 */
export function forgeRequestId(prefix = 'forge') {
  return createRequestId(prefix);
}

// ---- Data Adapters ----
// Transform Forge internal structures into gateway-compatible shapes.

/**
 * Adapt a Forge goal record to the gateway-compatible GoalDto shape.
 * @param {object} goal - Raw Forge goal record.
 * @param {object} [taskStats] - Optional { totalTasks, completedTasks }.
 * @returns {object}
 */
export function adaptGoal(goal, taskStats) {
  return {
    goalId: goal.id,
    text: goal.goal || goal.text,
    status: goal.status,
    createdAt: goal.created_at || goal.createdAt,
    updatedAt: goal.updated_at || goal.updatedAt,
    completedAt: goal.completed_at || goal.completedAt || null,
    tasks: taskStats ? {
      total: taskStats.totalTasks,
      completed: taskStats.completedTasks,
    } : undefined,
    metadata: goal.metadata || {},
  };
}

/**
 * Adapt Forge pool status to gateway-compatible PoolStatusDto shape.
 * @param {object} poolStatus - Raw pool status from AgentPoolManager.getStatus().
 * @returns {object}
 */
export function adaptPoolStatus(poolStatus) {
  if (!poolStatus) return { activeWorkers: 0, maxConcurrent: 0, utilization: 0 };
  return {
    activeWorkers: poolStatus.activeWorkers || 0,
    maxConcurrent: poolStatus.maxConcurrent || 0,
    utilization: poolStatus.utilization || 0,
    queueLength: poolStatus.queueLength || 0,
    activeGoals: poolStatus.activeGoals || 0,
    maxGoals: poolStatus.maxGoals || 0,
    fileLocks: poolStatus.fileLocks || {},
    workers: (poolStatus.workers || []).map(w => ({
      id: w.id,
      type: w.type || w.workerType,
      status: w.status,
      currentGoal: w.currentGoal || null,
      currentTask: w.currentTask || null,
    })),
    queue: poolStatus.queue || [],
    budget: poolStatus.budget || null,
    verification: poolStatus.verification || null,
  };
}

/**
 * Adapt Forge metrics to gateway-compatible MetricsDto shape.
 * @param {object} metrics - Raw metrics from AgentPoolManager.getMetrics().
 * @returns {object}
 */
export function adaptMetrics(metrics) {
  if (!metrics) return { tasks: null, goals: null };
  return {
    tasks: metrics.tasks ? {
      completed: metrics.tasks.completed || 0,
      failed: metrics.tasks.failed || 0,
      avgDurationMs: metrics.tasks.avgDurationMs || 0,
      p95DurationMs: metrics.tasks.p95DurationMs || 0,
      throughput: metrics.tasks.throughput || 0,
    } : null,
    goals: metrics.goals ? {
      completed: metrics.goals.completed || 0,
      failed: metrics.goals.failed || 0,
      avgDurationMs: metrics.goals.avgDurationMs || 0,
    } : null,
  };
}

/**
 * Adapt Forge resilience status to gateway-compatible shape.
 * @param {object} resilience - Raw resilience status.
 * @returns {object}
 */
export function adaptResilience(resilience) {
  if (!resilience) return { circuitBreaker: null, adaptiveTimeout: null };
  return {
    circuitBreaker: resilience.circuitBreaker ? {
      circuits: resilience.circuitBreaker.circuits || {},
      totalCircuits: resilience.circuitBreaker.totalCircuits || 0,
      openCircuits: resilience.circuitBreaker.openCircuits || 0,
    } : null,
    adaptiveTimeout: resilience.adaptiveTimeout ? {
      currentTimeoutMs: resilience.adaptiveTimeout.currentTimeoutMs || 0,
      p95Ms: resilience.adaptiveTimeout.p95Ms || 0,
      sampleCount: resilience.adaptiveTimeout.sampleCount || 0,
    } : null,
  };
}

/**
 * Adapt Forge tracing status to gateway-compatible shape.
 * @param {object} tracing - Raw tracing status.
 * @returns {object}
 */
export function adaptTracing(tracing) {
  if (!tracing) return { totalTraces: 0, totalSpans: 0 };
  return {
    totalTraces: tracing.totalTraces || 0,
    totalSpans: tracing.totalSpans || 0,
    activeTraces: tracing.activeTraces || 0,
    evictedTraces: tracing.evictedTraces || 0,
  };
}

/**
 * Adapt Forge system status to gateway-compatible SystemHealthDto.
 * @param {object} params - Aggregated status data.
 * @returns {object}
 */
export function adaptSystemStatus(params) {
  const { version, uptime, stats, pool, knowledge, gateway, resilience, tracing, plugins, metrics } = params;
  return {
    service: 'forge',
    version: version || '0.5.0',
    uptime,
    health: 'healthy',
    stats: {
      activeGoals: stats?.activeGoals || 0,
      runningTasks: stats?.runningTasks || 0,
      completedGoals: stats?.completed || 0,
      poolUtilization: stats?.poolUtil || 0,
    },
    pool: adaptPoolStatus(pool),
    metrics: adaptMetrics(metrics),
    resilience: adaptResilience(resilience),
    tracing: adaptTracing(tracing),
    plugins: plugins || { count: 0 },
    knowledge: knowledge || { totalEntries: 0 },
    gateway: gateway || { available: false },
  };
}

// ---- Permission Mapping ----
// Map Forge operations to gateway RBAC permissions.

export const FORGE_PERMISSIONS = {
  'GET /forge/health':           'public:read',
  'GET /forge/goals':            'dashboard:read',
  'POST /forge/goals':           'workflow:run',
  'GET /forge/goals/:id':        'dashboard:read',
  'DELETE /forge/goals/:id':     'workflow:run',
  'POST /forge/goals/:id/resume':'workflow:run',
  'GET /forge/goals/:id/export': 'dashboard:read',
  'POST /forge/goals/import':    'workflow:run',
  'GET /forge/pool/status':      'dashboard:read',
  'GET /forge/pool/queue':       'dashboard:read',
  'GET /forge/pool/locks':       'dashboard:read',
  'GET /forge/status':           'dashboard:read',
  'GET /forge/metrics':          'dashboard:read',
  'GET /forge/config':           'provider:read',
  'GET /forge/plugins':          'dashboard:read',
  'GET /forge/resilience':       'dashboard:read',
  'GET /forge/tracing':          'dashboard:read',
  'GET /forge/security/audit':   'audit:read',
  'GET /forge/dashboard':        'public:read',
};

/**
 * Resolve the gateway permission string for a Forge route.
 * @param {string} method - HTTP method.
 * @param {string} path - URL path (with /forge/ prefix).
 * @returns {string} Permission string.
 */
export function resolveForgePermission(method, path) {
  const key = `${method} ${path}`;
  if (FORGE_PERMISSIONS[key]) return FORGE_PERMISSIONS[key];

  // Pattern matching for parameterized routes
  for (const [pattern, perm] of Object.entries(FORGE_PERMISSIONS)) {
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '[^/]+') + '$');
    if (regex.test(key)) return perm;
  }

  return 'dashboard:read'; // Default for unknown forge routes
}
