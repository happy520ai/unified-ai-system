/**
 * Forge API Server Advanced Helpers — static file serving, WebSocket helpers,
 * and the main API route handler.
 *
 * Split from helpers.js to keep both files under 500 lines.
 */

import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { guardPath } from '../security/index.js';
import {
  MIME_TYPES, safeStringify, readBody, jsonResponse,
} from './helpers.js';

// ---- Static File Serving ----

/**
 * Serve static files from the public directory with path traversal protection.
 *
 * @param {string} urlPath - Request URL path.
 * @param {import('node:http').ServerResponse} res - HTTP response object.
 * @param {string} publicDir - Absolute path to public directory.
 * @param {Function} jsonFn - Function to send JSON responses.
 */
export async function serveStatic(urlPath, res, publicDir, jsonFn) {
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  // Path traversal protection: resolve and verify
  const { safe, resolved } = guardPath(publicDir, urlPath);
  if (!safe) {
    return jsonFn(res, 403, { error: 'Access denied' });
  }
  const filePath = resolved;
  const ext = extname(filePath);
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    // SPA fallback: serve index.html for any non-file path
    try {
      const content = await readFile(join(publicDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
}

// ---- WebSocket Helpers ----

/**
 * Encode and send a WebSocket text frame.
 *
 * @param {import('node:net').Socket} socket - WebSocket socket.
 * @param {string} data - UTF-8 string data to send.
 */
export function sendWsFrame(socket, data) {
  const buf = Buffer.from(data, 'utf-8');
  const len = buf.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x81; // FIN + text opcode
  socket.write(Buffer.concat([header, buf]));
}

/**
 * Send a structured WebSocket message (serializes to JSON first).
 *
 * @param {import('node:net').Socket} socket - WebSocket socket.
 * @param {object} data - Message object to serialize and send.
 */
export function sendWsMessage(socket, data) {
  sendWsFrame(socket, safeStringify(data));
}

/**
 * Broadcast a message to all connected WebSocket clients.
 *
 * @param {Set<import('node:net').Socket>} wsClients - Set of client sockets.
 * @param {object} data - Message to broadcast.
 */
export function broadcast(wsClients, data) {
  const msg = safeStringify(data);
  for (const ws of wsClients) {
    try { sendWsFrame(ws, msg); } catch { /* best-effort: one client failure must not break broadcast */ }
  }
}

/**
 * Handle WebSocket upgrade request and establish connection.
 *
 * Performs the RFC 6455 opening handshake, registers the socket for
 * broadcast, and sends an initial state snapshot to the client.
 *
 * @param {import('node:http').IncomingMessage} req - HTTP request.
 * @param {import('node:net').Socket} socket - Network socket.
 * @param {Buffer} head - Initial buffer.
 * @param {Set<import('node:net').Socket>} wsClients - Connected clients set.
 * @param {object} wsMsgHandler - WebSocketHandler instance.
 * @param {object|null} agentPool - AgentPoolManager instance (may be null).
 */
export function handleWebSocketUpgrade(req, socket, head, wsClients, wsMsgHandler, agentPool) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    '',
  ].join('\r\n');

  socket.write(headers);
  wsClients.add(socket);

  // Bidirectional: handle incoming frames from client
  socket.on('data', (chunk) => {
    try {
      const frame = wsMsgHandler.receiveFrame(socket, chunk);
      if (frame && frame.type === 'close') {
        wsClients.delete(socket);
        try {
          const closeResp = Buffer.alloc(2);
          closeResp[0] = 0x88; // FIN + close
          closeResp[1] = 0;
          socket.write(closeResp);
          socket.end();
        } catch { /* best-effort: socket may already be destroyed */ }
      }
    } catch {
      wsClients.delete(socket);
      try { socket.destroy(); } catch { /* best-effort */ }
    }
  });

  socket.on('close', () => wsClients.delete(socket));
  socket.on('error', () => wsClients.delete(socket));

  // Send initial state
  sendWsMessage(socket, {
    type: 'connected',
    status: agentPool?.getStatus(),
    timestamp: new Date().toISOString(),
  });
}

// ---- API Route Handler ----

/**
 * Context object passed to handleAPI containing all dependencies.
 * @typedef {object} ApiHandlerContext
 * @property {object} forge - Forge instance
 * @property {object|null} userMgr - UserManager instance
 * @property {object|null} agentPool - AgentPoolManager instance
 * @property {object|null} knowledge - KnowledgeBase instance
 * @property {object} transfer - GoalTransfer instance
 * @property {object|null} gateway - GatewayBridge instance
 * @property {object|null} config - ForgeConfig instance
 * @property {boolean} envelope - Envelope mode flag
 * @property {Function} jsonFn - JSON response function
 * @property {Function} readBodyFn - Request body reader function
 * @property {Function} broadcastFn - WebSocket broadcast function
 * @property {Function} listKnowledgeFn - Knowledge listing function
 */

/**
 * Handle API route requests.
 *
 * @param {ApiHandlerContext} ctx - Context with all dependencies.
 * @param {string} path - Request path.
 * @param {import('node:http').IncomingMessage} req - HTTP request.
 * @param {import('node:http').ServerResponse} res - HTTP response.
 * @param {object|null} user - Authenticated user (may be null).
 */
export async function handleAPI(ctx, path, req, res, user) {
  const { forge, userMgr, agentPool, knowledge, transfer, gateway, config, envelope, jsonFn, readBodyFn, broadcastFn, listKnowledgeFn } = ctx;

  // Goals
  if (path === '/api/goals' && req.method === 'GET') {
    const goals = forge.listGoals().map(g => {
      const tasks = forge.store.getTasksForGoal(g.id) || [];
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      return { ...g, totalTasks: tasks.length, completedTasks };
    });
    return jsonFn(res, 200, { goals });
  }

  if (path === '/api/goals' && req.method === 'POST') {
    const body = await readBodyFn(req);
    const { goal, options } = body;
    if (!goal) return jsonFn(res, 400, { error: 'goal text is required' });

    // Broadcast goal started event
    broadcastFn({ type: 'goal_started', goal: goal.substring(0, 100) });

    // Use pool-based execution if available, otherwise fall back to single-goal Orchestrator
    const executionFn = forge.submitGoal
      ? () => forge.submitGoal(goal, { ...(options || {}), userId: user?.id })
      : () => forge.run(goal, options || {});

    executionFn().then(report => {
      broadcastFn({
        type: 'goal_completed',
        goalId: report.goalId,
        status: report.status,
        completedTasks: report.completedTasks,
        failedTasks: report.failedTasks,
        duration: report.durationHuman,
      });
    }).catch(err => {
      broadcastFn({
        type: 'goal_failed',
        error: err.message,
      });
      console.error('[forge:api] Goal execution failed:', err.message);
    });

    return jsonFn(res, 202, { message: '目标已提交，正在后台执行', goal: goal.substring(0, 100) });
  }

  const goalMatch = path.match(/^\/api\/goals\/([^/]+)$/);
  if (goalMatch && req.method === 'GET') {
    const status = forge.getStatus(goalMatch[1]);
    if (!status) return jsonFn(res, 404, { error: 'Goal not found' });
    return jsonFn(res, 200, status);
  }

  if (goalMatch && req.method === 'DELETE') {
    const goalId = goalMatch[1];
    // Cancel if running
    agentPool?.cancelGoal(goalId);
    // Delete from database (tasks, events, goal record)
    const store = forge.store;
    try {
      store.db.prepare('DELETE FROM tasks WHERE goal_id = ?').run(goalId);
      store.db.prepare('DELETE FROM events WHERE goal_id = ?').run(goalId);
      const result = store.db.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
      if (result.changes === 0) return jsonFn(res, 404, { error: 'Goal not found' });
      return jsonFn(res, 200, { message: '目标已删除', goalId });
    } catch (err) {
      return jsonFn(res, 500, { error: err.message });
    }
  }

  // Goal resume
  const resumeMatch = path.match(/^\/api\/goals\/([^/]+)\/resume$/);
  if (resumeMatch && req.method === 'POST') {
    const report = await forge.resume(resumeMatch[1]);
    return jsonFn(res, 200, report);
  }

  // Goal export
  const exportMatch = path.match(/^\/api\/goals\/([^/]+)\/export$/);
  if (exportMatch && req.method === 'GET') {
    const data = transfer.exportGoal(exportMatch[1]);
    return jsonFn(res, 200, data);
  }

  // Goal import
  if (path === '/api/goals/import' && req.method === 'POST') {
    const body = await readBodyFn(req);
    const result = transfer.importGoal(body, { userId: user?.id });
    return jsonFn(res, 200, result);
  }

  // Agent Pool status (enhanced with queue, locks, budget)
  if (path === '/api/pool/status' && req.method === 'GET') {
    return jsonFn(res, 200, agentPool?.getStatus() || { activeWorkers: 0 });
  }

  // Pool queue details
  if (path === '/api/pool/queue' && req.method === 'GET') {
    const status = agentPool?.getStatus();
    return jsonFn(res, 200, {
      queue: status?.queue ?? [],
      queueLength: status?.queueLength ?? 0,
      activeGoals: status?.activeGoals ?? 0,
      maxGoals: status?.maxGoals ?? 0,
    });
  }

  // Pool file locks
  if (path === '/api/pool/locks' && req.method === 'GET') {
    const status = agentPool?.getStatus();
    return jsonFn(res, 200, {
      locks: status?.fileLocks ?? {},
      count: Object.keys(status?.fileLocks ?? {}).length,
    });
  }

  // Users — strip API keys from response for security
  if (path === '/api/users' && req.method === 'GET') {
    const users = (userMgr?.listUsers() || []).map(u => {
      const { api_key, ...safe } = u;
      return safe;
    });
    return jsonFn(res, 200, { users });
  }

  if (path === '/api/users' && req.method === 'POST') {
    const body = await readBodyFn(req);
    const created = userMgr?.createUser(body);
    return jsonFn(res, 201, { user: created });
  }

  // Auth: get current user
  if (path === '/api/auth/me' && req.method === 'GET') {
    return jsonFn(res, 200, { user });
  }

  // Knowledge
  if (path === '/api/knowledge' && req.method === 'GET') {
    const { category, q, limit } = Object.fromEntries(
      new URL(req.url, 'http://localhost').searchParams,
    );
    if (q) {
      const results = knowledge?.search(q, { category, limit: Number(limit) || 10 }) || [];
      return jsonFn(res, 200, { results });
    }
    const entries = knowledge
      ? listKnowledgeFn(knowledge, user, category, limit)
      : [];
    return jsonFn(res, 200, { entries });
  }

  if (path === '/api/knowledge' && req.method === 'POST') {
    const body = await readBodyFn(req);
    const entry = knowledge?.add({ ...body, userId: user?.id });
    return jsonFn(res, 201, { entry });
  }

  const knowledgeMatch = path.match(/^\/api\/knowledge\/([^/]+)$/);
  if (knowledgeMatch && req.method === 'GET') {
    const entry = knowledge?.search(knowledgeMatch[1], { limit: 1 })?.[0] || null;
    return jsonFn(res, 200, { entry });
  }

  if (knowledgeMatch && req.method === 'DELETE') {
    // KnowledgeBase does not yet expose a delete method; returns success without mutation
    return jsonFn(res, 200, { message: 'Deleted' });
  }

  // Knowledge stats
  if (path === '/api/knowledge/stats' && req.method === 'GET') {
    return jsonFn(res, 200, knowledge?.getStats() || { totalEntries: 0 });
  }

  // Gateway health
  if (path === '/api/gateway/health' && req.method === 'GET') {
    const health = await gateway?.health() || { available: false };
    return jsonFn(res, 200, health);
  }

  if (path === '/api/gateway/providers' && req.method === 'GET') {
    const providers = await gateway?.getProviders() || [];
    return jsonFn(res, 200, { providers });
  }

  // System status
  if (path === '/api/status' && req.method === 'GET') {
    const poolStatus = agentPool?.getStatus() || {};
    const goals = forge.listGoals() || [];
    const activeGoals = goals.filter(g => g.status === 'running').length;
    const completed = goals.filter(g => g.status === 'completed').length;

    return jsonFn(res, 200, {
      version: config?.server?.version ?? '0.4.0',
      uptime: process.uptime(),
      stats: {
        activeGoals,
        runningTasks: poolStatus.activeWorkers || 0,
        completed,
        poolUtil: poolStatus.utilization || 0,
      },
      pool: poolStatus,
      knowledge: knowledge?.getStats(),
      gateway: await gateway?.health(),
    });
  }

  // Performance metrics
  if (path === '/api/metrics' && req.method === 'GET') {
    return jsonFn(res, 200, agentPool?.getMetrics() || {});
  }

  // Configuration status
  if (path === '/api/config' && req.method === 'GET') {
    return jsonFn(res, 200, config?.getStatus() || { source: 'defaults' });
  }

  // Plugins status
  if (path === '/api/plugins' && req.method === 'GET') {
    return jsonFn(res, 200, agentPool?.getPlugins?.() || { count: 0, plugins: [], hooks: {}, middleware: [] });
  }

  // Resilience status (circuit breaker + adaptive timeout)
  if (path === '/api/resilience' && req.method === 'GET') {
    return jsonFn(res, 200, agentPool?.getResilience?.() || { circuitBreaker: null, adaptiveTimeout: null });
  }

  // Distributed tracing status
  if (path === '/api/tracing' && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const traceId = url.searchParams.get('trace');
    const goalId = url.searchParams.get('goal');
    if (traceId) {
      // Return span tree for a specific trace
      const tm = agentPool?.getTracingManager?.();
      return jsonFn(res, 200, tm?.getSpanTree(traceId) || { traceId, rootSpans: [], totalSpans: 0 });
    }
    if (goalId) {
      const tm = agentPool?.getTracingManager?.();
      const spans = tm?.getSpansForGoal(goalId) || [];
      return jsonFn(res, 200, { goalId, spans: spans.map(s => s.toJSON()) });
    }
    // Return overall tracing status
    return jsonFn(res, 200, agentPool?.getTracing?.() || { totalTraces: 0, totalSpans: 0, traces: {} });
  }

  jsonFn(res, 404, { error: 'Not Found' });
}
