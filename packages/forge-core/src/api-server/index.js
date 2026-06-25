import http from 'node:http';
import { URL } from 'node:url';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketHandler } from '../websocket/index.js';
import { applySecurityHeaders, sanitizeError } from '../security/index.js';
import { ForgeAuthAdapter } from '../integration/auth-adapter.js';
import {
  PUBLIC_GET, jsonResponse as _jsonResponse,
  authenticate as _authenticate,
  buildApiContext as _buildApiContext,
} from './helpers.js';
import {
  serveStatic as _serveStatic, sendWsMessage as _sendWsMessage,
  broadcast as _broadcast, handleWebSocketUpgrade as _handleWebSocketUpgrade,
  handleAPI as _handleAPI,
} from './helpers-advanced.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

/**
 * Forge API Server -- REST + WebSocket + static file serving.
 */
export class ForgeServer {
  #httpServer;
  #forge;          // Forge instance
  #userMgr;       // UserManager instance
  #agentPool;     // AgentPoolManager instance
  #knowledge;     // KnowledgeBase instance
  #transfer;      // GoalTransfer instance
  #gateway;       // GatewayBridge instance
  #config;        // ForgeConfig instance
  #wsClients;     // Set of WebSocket connections
  #wsMsgHandler;  // WebSocketHandler for bidirectional messaging
  #snapshotTimer; // Periodic state snapshot timer
  #port;
  #maxBodySize;   // Maximum request body size in bytes
  #envelope;      // If true, wrap responses in standard envelopes (gateway mode)
  #governanceService; // Injected enterprise governance service (from gateway)
  #authAdapter;   // ForgeAuthAdapter instance

  constructor({ forge, userMgr, agentPool, knowledge, transfer, gateway, port, config, maxBodySize, envelope, governanceService, authAdapter }) {
    this.#forge = forge;
    this.#userMgr = userMgr;
    this.#agentPool = agentPool;
    this.#knowledge = knowledge;
    this.#transfer = transfer;
    this.#gateway = gateway;
    this.#config = config || null;
    this.#wsClients = new Set();
    this.#wsMsgHandler = new WebSocketHandler();
    this.#snapshotTimer = null;
    this.#port = port ?? config?.server?.port ?? 4500;
    this.#maxBodySize = maxBodySize ?? 1048576; // 1 MB default
    this.#envelope = envelope ?? false;
    this.#governanceService = governanceService || null;
    this.#authAdapter = authAdapter || new ForgeAuthAdapter({
      governanceService: governanceService || null,
      userManager: userMgr || null,
    });
  }

  /**
   * Start the server.
   */
  start() {
    // Build API handler context once per start
    const apiCtx = _buildApiContext({
      forge: this.#forge,
      userMgr: this.#userMgr,
      agentPool: this.#agentPool,
      knowledge: this.#knowledge,
      transfer: this.#transfer,
      gateway: this.#gateway,
      config: this.#config,
      envelope: this.#envelope,
      broadcastFn: (data) => _broadcast(this.#wsClients, data),
    });

    this.#httpServer = http.createServer(async (req, res) => {
      // CORS headers
      const corsOrigin = this.#config?.server?.corsOrigin ?? '*';
      res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Api-Key,Authorization');

      // Security headers
      applySecurityHeaders(res);

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;

      try {
        // API routes
        if (path.startsWith('/api/')) {
          // Authenticate API requests
          const user = _authenticate(req, this.#authAdapter, this.#userMgr);

          const isPublicGet = req.method === 'GET' && PUBLIC_GET.some(p => path === p || path.startsWith(p + '/'));

          if (!user && !isPublicGet && !path.startsWith('/api/auth')) {
            return _jsonResponse(res, 401, { error: 'Authentication required' });
          }

          await _handleAPI(apiCtx, path, req, res, user);
          return;
        }

        // Static file serving for Web Console
        await _serveStatic(path, res, PUBLIC_DIR, _jsonResponse);
      } catch (err) {
        console.error('[forge:api] Error:', err.message);
        _jsonResponse(res, err.status || 500, sanitizeError(err));
      }
    });

    // WebSocket upgrade handling
    this.#httpServer.on('upgrade', (req, socket, head) => {
      _handleWebSocketUpgrade(req, socket, head, this.#wsClients, this.#wsMsgHandler, this.#agentPool);
    });

    // Subscribe to agent pool events and broadcast via WebSocket
    if (this.#agentPool) {
      this.#agentPool.on('task_started', (data) => _broadcast(this.#wsClients, { type: 'task_started', ...data }));
      this.#agentPool.on('task_completed', (data) => _broadcast(this.#wsClients, { type: 'task_completed', ...data }));
      this.#agentPool.on('task_failed', (data) => _broadcast(this.#wsClients, { type: 'task_failed', ...data }));
      this.#agentPool.on('goal_completed', (data) => _broadcast(this.#wsClients, { type: 'goal_completed', ...data }));
      this.#agentPool.on('goal_cancelled', (data) => _broadcast(this.#wsClients, { type: 'goal_cancelled', ...data }));
      this.#agentPool.on('verification_started', (data) => _broadcast(this.#wsClients, { type: 'verification_started', ...data }));
      this.#agentPool.on('verification_passed', (data) => _broadcast(this.#wsClients, { type: 'verification_passed', ...data }));
      this.#agentPool.on('verification_failed', (data) => _broadcast(this.#wsClients, { type: 'verification_failed', ...data }));
    }

    // Wire bidirectional WebSocket message handler
    this.#wsMsgHandler.on('ping', (socket) => {
      _sendWsMessage(socket, { type: 'pong', timestamp: new Date().toISOString() });
    });
    this.#wsMsgHandler.on('refresh_goals', () => {
      // Goals must be fetched via REST — broadcast a nudge
      _broadcast(this.#wsClients, { type: 'goals_changed' });
    });
    this.#wsMsgHandler.on('refresh_status', (socket) => {
      const poolStatus = this.#agentPool?.getStatus() || {};
      _sendWsMessage(socket, {
        type: 'status_update',
        stats: {
          activeGoals: (this.#forge.listGoals() || []).filter(g => g.status === 'running').length,
          runningTasks: poolStatus.activeWorkers || 0,
          completed: (this.#forge.listGoals() || []).filter(g => g.status === 'completed').length,
          poolUtil: poolStatus.utilization || 0,
          queueLength: poolStatus.queueLength || 0,
        },
      });
    });
    this.#wsMsgHandler.on('refresh_scheduler', (socket) => {
      const d = this.#agentPool?.getStatus() || {};
      _sendWsMessage(socket, { type: 'scheduler_update', data: d });
    });
    this.#wsMsgHandler.on('refresh_pool', (socket) => {
      const d = this.#agentPool?.getStatus() || {};
      _sendWsMessage(socket, { type: 'pool_update', data: d });
    });

    // Periodic state snapshot broadcast — interval from config (default 5s)
    const snapshotMs = this.#config?.server?.snapshotInterval ?? 5000;
    this.#snapshotTimer = setInterval(() => {
      if (this.#wsClients.size === 0) return;
      const poolStatus = this.#agentPool?.getStatus() || {};
      const goals = this.#forge.listGoals() || [];
      _broadcast(this.#wsClients, {
        type: 'snapshot',
        pool: {
          goals: poolStatus.goals || [],
          queue: poolStatus.queue || [],
          fileLocks: poolStatus.fileLocks || {},
          budget: poolStatus.budget || null,
          maxGoals: poolStatus.maxGoals || 3,
          maxConcurrent: poolStatus.maxConcurrent || 4,
          activeWorkers: poolStatus.activeWorkers || 0,
          verification: poolStatus.verification || null,
        },
        stats: {
          activeGoals: goals.filter(g => g.status === 'running').length,
          runningTasks: poolStatus.activeWorkers || 0,
          completed: goals.filter(g => g.status === 'completed').length,
          poolUtil: poolStatus.utilization || 0,
          queueLength: poolStatus.queueLength || 0,
          workers: poolStatus.workers || [],
        },
        metrics: this.#agentPool?.getMetrics()?.tasks || null,
        resilience: this.#agentPool?.getResilience?.() || null,
        tracing: this.#agentPool?.getTracing?.() || null,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }, snapshotMs);

    this.#httpServer.listen(this.#port, () => {
      console.log(`[forge] API Server running on http://localhost:${this.#port}`);
      console.log(`[forge] Web Console: http://localhost:${this.#port}/`);
    });

    return this.#httpServer;
  }

  /**
   * Stop the server.
   */
  stop() {
    if (this.#snapshotTimer) {
      clearInterval(this.#snapshotTimer);
      this.#snapshotTimer = null;
    }
    for (const ws of this.#wsClients) {
      try {
        const closeFrame = Buffer.alloc(2);
        closeFrame[0] = 0x88; // FIN + close opcode
        closeFrame[1] = 0;
        ws.write(closeFrame);
        ws.end();
      } catch { /* best-effort: socket may already be closed */ }
    }
    this.#wsClients.clear();
    this.#httpServer?.close();
  }
}
