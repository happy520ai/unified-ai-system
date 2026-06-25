/**
 * Forge Route Handlers for Gateway Integration
 *
 * This module exports a factory function that the gateway's httpServer.js
 * can call to obtain all Forge route handlers. Each handler follows the
 * gateway's pattern: (request, response, readJson) → void.
 *
 * Routes are prefixed with /forge/* in the gateway.
 */

import { okResponse, errResponse, forgeRequestId, adaptGoal, adaptPoolStatus, adaptMetrics, adaptResilience, adaptTracing, adaptSystemStatus } from './bridge.js';

/**
 * Create Forge route handlers bound to a Forge application context.
 *
 * @param {object} ctx - Forge application context:
 *   @param {object} ctx.forge - Forge instance (Orchestrator or AgentPoolManager wrapper)
 *   @param {object} ctx.agentPool - AgentPoolManager instance
 *   @param {object} ctx.knowledge - KnowledgeBase instance
 *   @param {object} ctx.transfer - GoalTransfer instance
 *   @param {object} ctx.gateway - GatewayBridge instance
 *   @param {object} ctx.config - ForgeConfig instance
 * @returns {object} Map of route handlers keyed by method+path pattern
 */
export function createForgeRouteHandlers(ctx) {
  const { forge, agentPool, knowledge, transfer, gateway, config } = ctx;

  /**
   * Send a JSON response in the gateway's envelope format.
   */
  function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  /**
   * Read JSON body from request (gateway-compatible).
   * Falls back to internal reader if readJson is not provided.
   */
  async function readBody(req, readJson) {
    if (typeof readJson === 'function') {
      return readJson(req);
    }
    const MAX_BODY = 1024 * 1024; // 1 MB
    return new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY) {
          req.destroy();
          reject(new Error('Request body too large (max 1 MB)'));
          return;
        }
        data += chunk;
      });
      req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });
  }

  return {

    // ---- Health ----
    'GET /forge/health': async (req, res) => {
      const poolStatus = agentPool?.getStatus() || {};
      const goals = forge?.listGoals() || [];
      sendJson(res, 200, okResponse({
        service: 'forge',
        version: config?.server?.version ?? '0.5.0',
        health: 'healthy',
        activeGoals: goals.filter(g => g.status === 'running').length,
        completedGoals: goals.filter(g => g.status === 'completed').length,
        activeWorkers: poolStatus.activeWorkers || 0,
        uptime: process.uptime(),
      }, { requestId: forgeRequestId() }));
    },

    // ---- Goals ----
    'GET /forge/goals': async (req, res) => {
      const goals = (forge?.listGoals() || []).map(g => {
        const tasks = forge.store?.getTasksForGoal(g.id) || [];
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        return adaptGoal(g, { totalTasks: tasks.length, completedTasks });
      });
      sendJson(res, 200, okResponse({ goals, total: goals.length }, { requestId: forgeRequestId() }));
    },

    'POST /forge/goals': async (req, res, readJson) => {
      try {
        const body = await readBody(req, readJson);
        const { goal, options } = body;
        if (!goal) {
          return sendJson(res, 400, errResponse('validation_error', 'goal text is required', { category: 'validation' }));
        }

        const executionFn = forge.submitGoal
          ? () => forge.submitGoal(goal, { ...(options || {}), userId: req.enterpriseIdentity?.userId })
          : () => forge.run(goal, options || {});

        executionFn().catch(err => {
          console.error('[forge:gateway] Goal execution failed:', err.message);
        });

        sendJson(res, 202, okResponse({
          message: '目标已提交，正在后台执行',
          goal: goal.substring(0, 100),
        }, { requestId: forgeRequestId() }));
      } catch (err) {
        sendJson(res, 400, errResponse('bad_request', err.message, { category: 'validation' }));
      }
    },

    'GET /forge/goals/:id': async (req, res, readJson, params) => {
      const goalId = params?.id;
      if (!goalId) return sendJson(res, 400, errResponse('validation_error', 'goal id is required'));
      const status = forge?.getStatus(goalId);
      if (!status) return sendJson(res, 404, errResponse('not_found', 'Goal not found'));
      sendJson(res, 200, okResponse(status, { requestId: forgeRequestId() }));
    },

    'DELETE /forge/goals/:id': async (req, res, readJson, params) => {
      const goalId = params?.id;
      if (!goalId) return sendJson(res, 400, errResponse('validation_error', 'goal id is required'));
      agentPool?.cancelGoal(goalId);
      try {
        const store = forge.store;
        store.db.prepare('DELETE FROM tasks WHERE goal_id = ?').run(goalId);
        store.db.prepare('DELETE FROM events WHERE goal_id = ?').run(goalId);
        const result = store.db.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
        if (result.changes === 0) {
          return sendJson(res, 404, errResponse('not_found', 'Goal not found'));
        }
        sendJson(res, 200, okResponse({ goalId, deleted: true }, { requestId: forgeRequestId() }));
      } catch (err) {
        sendJson(res, 500, errResponse('internal_error', err.message, { category: 'internal' }));
      }
    },

    'POST /forge/goals/:id/resume': async (req, res, readJson, params) => {
      const goalId = params?.id;
      if (!goalId) return sendJson(res, 400, errResponse('validation_error', 'goal id is required'));
      try {
        const report = await forge.resume(goalId);
        sendJson(res, 200, okResponse(report, { requestId: forgeRequestId() }));
      } catch (err) {
        sendJson(res, 500, errResponse('resume_failed', err.message, { category: 'internal' }));
      }
    },

    'GET /forge/goals/:id/export': async (req, res, readJson, params) => {
      const goalId = params?.id;
      if (!goalId) return sendJson(res, 400, errResponse('validation_error', 'goal id is required'));
      try {
        const data = transfer.exportGoal(goalId);
        sendJson(res, 200, okResponse(data, { requestId: forgeRequestId() }));
      } catch (err) {
        sendJson(res, 500, errResponse('export_failed', err.message));
      }
    },

    'POST /forge/goals/import': async (req, res, readJson) => {
      try {
        const body = await readBody(req, readJson);
        const result = transfer.importGoal(body, { userId: req.enterpriseIdentity?.userId });
        sendJson(res, 200, okResponse(result, { requestId: forgeRequestId() }));
      } catch (err) {
        sendJson(res, 400, errResponse('import_failed', err.message, { category: 'validation' }));
      }
    },

    // ---- Pool Status ----
    'GET /forge/pool/status': async (req, res) => {
      const poolStatus = agentPool?.getStatus() || { activeWorkers: 0 };
      sendJson(res, 200, okResponse(adaptPoolStatus(poolStatus), { requestId: forgeRequestId() }));
    },

    'GET /forge/pool/queue': async (req, res) => {
      const status = agentPool?.getStatus();
      sendJson(res, 200, okResponse({
        queue: status?.queue ?? [],
        queueLength: status?.queueLength ?? 0,
        activeGoals: status?.activeGoals ?? 0,
        maxGoals: status?.maxGoals ?? 0,
      }, { requestId: forgeRequestId() }));
    },

    'GET /forge/pool/locks': async (req, res) => {
      const status = agentPool?.getStatus();
      sendJson(res, 200, okResponse({
        locks: status?.fileLocks ?? {},
        count: Object.keys(status?.fileLocks ?? {}).length,
      }, { requestId: forgeRequestId() }));
    },

    // ---- System Status ----
    'GET /forge/status': async (req, res) => {
      const poolStatus = agentPool?.getStatus() || {};
      const goals = forge?.listGoals() || [];
      sendJson(res, 200, okResponse(adaptSystemStatus({
        version: config?.server?.version ?? '0.5.0',
        uptime: process.uptime(),
        stats: {
          activeGoals: goals.filter(g => g.status === 'running').length,
          runningTasks: poolStatus.activeWorkers || 0,
          completed: goals.filter(g => g.status === 'completed').length,
          poolUtil: poolStatus.utilization || 0,
        },
        pool: poolStatus,
        knowledge: knowledge?.getStats(),
        gateway: await gateway?.health(),
        resilience: agentPool?.getResilience?.(),
        tracing: agentPool?.getTracing?.(),
        plugins: agentPool?.getPlugins?.(),
        metrics: agentPool?.getMetrics(),
      }), { requestId: forgeRequestId() }));
    },

    // ---- Metrics ----
    'GET /forge/metrics': async (req, res) => {
      sendJson(res, 200, okResponse(adaptMetrics(agentPool?.getMetrics()), { requestId: forgeRequestId() }));
    },

    // ---- Config ----
    'GET /forge/config': async (req, res) => {
      sendJson(res, 200, okResponse(config?.getStatus() || { source: 'defaults' }, { requestId: forgeRequestId() }));
    },

    // ---- Plugins ----
    'GET /forge/plugins': async (req, res) => {
      sendJson(res, 200, okResponse(
        agentPool?.getPlugins?.() || { count: 0, plugins: [], hooks: {}, middleware: [] },
        { requestId: forgeRequestId() },
      ));
    },

    // ---- Resilience ----
    'GET /forge/resilience': async (req, res) => {
      sendJson(res, 200, okResponse(adaptResilience(agentPool?.getResilience?.()), { requestId: forgeRequestId() }));
    },

    // ---- Tracing ----
    'GET /forge/tracing': async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const traceId = url.searchParams.get('trace');
      const goalId = url.searchParams.get('goal');

      if (traceId) {
        const tm = agentPool?.getTracingManager?.();
        const tree = tm?.getSpanTree(traceId) || { traceId, rootSpans: [], totalSpans: 0 };
        return sendJson(res, 200, okResponse(tree, { requestId: forgeRequestId() }));
      }
      if (goalId) {
        const tm = agentPool?.getTracingManager?.();
        const spans = tm?.getSpansForGoal(goalId) || [];
        return sendJson(res, 200, okResponse({ goalId, spans: spans.map(s => s.toJSON()) }, { requestId: forgeRequestId() }));
      }
      sendJson(res, 200, okResponse(adaptTracing(agentPool?.getTracing?.()), { requestId: forgeRequestId() }));
    },

    // ---- Knowledge ----
    'GET /forge/knowledge': async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const { category, q, limit } = Object.fromEntries(url.searchParams);
      if (q) {
        const results = knowledge?.search(q, { category, limit: Number(limit) || 10 }) || [];
        return sendJson(res, 200, okResponse({ results, total: results.length }, { requestId: forgeRequestId() }));
      }
      sendJson(res, 200, okResponse(knowledge?.getStats() || { totalEntries: 0 }, { requestId: forgeRequestId() }));
    },

    'GET /forge/knowledge/stats': async (req, res) => {
      sendJson(res, 200, okResponse(knowledge?.getStats() || { totalEntries: 0 }, { requestId: forgeRequestId() }));
    },
  };
}

/**
 * Match a request to a Forge route handler.
 * Supports parameterized routes like /forge/goals/:id.
 *
 * @param {object} handlers - Route handlers map from createForgeRouteHandlers().
 * @param {string} method - HTTP method.
 * @param {string} path - URL path.
 * @returns {{ handler: Function, params: object } | null}
 */
export function matchForgeRoute(handlers, method, path) {
  // Exact match first
  const exactKey = `${method} ${path}`;
  if (handlers[exactKey]) return { handler: handlers[exactKey], params: {} };

  // Parameterized match
  for (const [pattern, handler] of Object.entries(handlers)) {
    const [patternMethod, patternPath] = pattern.split(' ');
    if (patternMethod !== method) continue;

    const paramNames = [];
    const regexStr = patternPath.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });
    const regex = new RegExp(`^${regexStr}$`);
    const match = path.match(regex);
    if (match) {
      const params = {};
      paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
      return { handler, params };
    }
  }

  return null;
}
