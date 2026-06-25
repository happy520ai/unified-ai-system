/**
 * ForgeDashboard -- single-file web dashboard for monitoring Forge execution.
 *
 * Generates a self-contained HTML dashboard with embedded CSS and JavaScript.
 * No external dependencies (no express, no react, no CDN resources).
 * Uses node:http only for the HTTP server.
 *
 * Dashboard sections:
 *   1. Header: "Forge Dashboard" + connection status indicator
 *   2. Goals Overview: active/completed/failed counts, recent goals list
 *   3. Active Goal Detail: current task, progress bar, ETA, phase
 *   4. Agent Pool: worker count, queue depth, active workers table
 *   5. Performance: success rate, avg duration, throughput chart (CSS-based)
 *   6. Cost: total spend, budget remaining, cost per goal
 *   7. Health: module health grid (green/yellow/red), active alerts
 *   8. Activity Log: last 20 events with timestamps
 *
 * Design:
 *   - Dark theme (background: #1a1a2e, cards: #16213e, accent: #0f3460)
 *   - CSS Grid layout, responsive
 *   - Auto-refresh via JS polling (no WebSocket required)
 *   - CSS-only bar charts for metrics
 *   - No external fonts, CDNs, or images
 *
 * Usage:
 *   import { ForgeDashboard } from './forge-dashboard/index.js';
 *
 *   const dash = new ForgeDashboard({ port: 3200 });
 *   const { url } = await dash.start({ pool, analytics, health, budget });
 *   console.log(`Dashboard at ${url}`);
 */

import { createServer } from 'node:http';
import {
  generateCSS,
  generateJS,
  renderGoalsOverview,
  renderActiveGoal,
  renderPool,
  renderPerformance,
  renderCost,
  renderHealth,
  renderActivityLog,
} from './helpers.js';

// ── Main Dashboard Class ────────────────────────────────────────────────────

/**
 * ForgeDashboard provides a self-contained web dashboard for monitoring
 * Forge execution, agent pool status, performance metrics, cost tracking,
 * system health, and activity logs.
 */
export class ForgeDashboard {
  /** @type {number} */ #port;
  /** @type {string} */ #host;
  /** @type {boolean} */ #enableWS;
  /** @type {object|null} */ #auth;
  /** @type {number} */ #refreshIntervalMs;
  /** @type {import('node:http').Server|null} */ #server;
  /** @type {number} */ #connections;
  /** @type {number} */ #lastRefresh;

  /**
   * Create a new ForgeDashboard instance.
   *
   * @param {object} [opts={}] - dashboard options
   * @param {number} [opts.port=3200] - HTTP server port
   * @param {string} [opts.host='127.0.0.1'] - HTTP server host
   * @param {boolean} [opts.enableWS=true] - reserved for future WebSocket support
   * @param {object|null} [opts.auth=null] - optional basic auth { user, pass }
   * @param {number} [opts.refreshIntervalMs=2000] - auto-refresh polling interval
   */
  constructor(opts = {}) {
    this.#port = opts.port ?? 3200;
    this.#host = opts.host ?? '127.0.0.1';
    this.#enableWS = opts.enableWS ?? true;
    this.#auth = opts.auth ?? null;
    this.#refreshIntervalMs = opts.refreshIntervalMs ?? 2000;
    this.#server = null;
    this.#connections = 0;
    this.#lastRefresh = 0;
  }

  /**
   * Generate the complete dashboard HTML with embedded CSS and JS.
   *
   * @param {object} data - aggregated dashboard data
   * @param {Array} [data.goals] - list of goal objects
   * @param {object} [data.pool] - agent pool status
   * @param {object} [data.analytics] - performance analytics
   * @param {object} [data.health] - health dashboard data
   * @param {object} [data.cost] - cost/budget data
   * @param {Array} [data.events] - recent activity events
   * @returns {string} complete HTML document string
   */
  generateDashboard(data) {
    const d = data || {};
    const css = generateCSS();
    const js = generateJS(this.#refreshIntervalMs);

    const html = '<!DOCTYPE html>\n'
      + '<html lang="en"><head><meta charset="UTF-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
      + '<title>Forge Dashboard</title>'
      + '<style>' + css + '</style>'
      + '</head><body>'
      + '<div class="header">'
      + '<h1>Forge Dashboard</h1>'
      + '<div>'
      + '<span id="conn-dot" class="status-dot connected"></span>'
      + '<span id="conn-label" class="status-label">Connected</span>'
      + '</div></div>'
      + '<div class="grid">'
      + renderGoalsOverview(d)
      + renderActiveGoal(d)
      + renderPool(d)
      + renderPerformance(d)
      + renderCost(d)
      + renderHealth(d)
      + renderActivityLog(d)
      + '</div>'
      + '<div class="footer">Forge Dashboard &middot; Auto-refresh every '
      + (this.#refreshIntervalMs / 1000) + 's</div>'
      + '<script>' + js + '</script>'
      + '</body></html>';

    return html;
  }

  /**
   * Collect and aggregate data from various Forge modules for the dashboard.
   *
   * @param {object} modules - connected Forge modules
   * @param {object} [modules.pool] - AgentPoolManager instance
   * @param {object} [modules.analytics] - MetricsCollector instance
   * @param {object} [modules.health] - HealthDashboard instance
   * @param {object} [modules.budget] - BudgetTracker instance
   * @param {object} [modules.progress] - ProgressReporter instance
   * @param {object} [modules.forge] - Forge instance (for goal listing)
   * @returns {object} structured data object suitable for generateDashboard()
   */
  collectData(modules) {
    const m = modules || {};
    const data = {
      goals: [],
      pool: {},
      analytics: {},
      health: {},
      cost: {},
      events: [],
    };

    // Collect goals from Forge instance or store
    if (m.forge && typeof m.forge.listGoals === 'function') {
      try {
        data.goals = m.forge.listGoals({ limit: 20 }) || [];
      } catch {
        data.goals = [];
      }
    }

    // Collect pool status
    if (m.pool && typeof m.pool.getStatus === 'function') {
      try {
        const ps = m.pool.getStatus();
        data.pool = {
          workerCount: ps.totalWorkers || ps.workerCount || 0,
          activeWorkers: ps.activeWorkers || ps.busyWorkers || 0,
          queueDepth: ps.queueDepth || ps.pendingGoals || 0,
          maxConcurrent: ps.maxConcurrent || 0,
          workers: ps.workers || [],
        };
      } catch {
        data.pool = {};
      }
    }

    // Collect analytics
    if (m.analytics && typeof m.analytics.getSummary === 'function') {
      try {
        const a = m.analytics.getSummary();
        data.analytics = {
          successRate: a.successRate ?? 0,
          avgDurationMs: a.avgDurationMs ?? null,
          throughput: a.throughput ?? 0,
          throughputSeries: a.throughputSeries || [],
        };
      } catch {
        data.analytics = {};
      }
    }

    // Collect health
    if (m.health && typeof m.health.getSnapshot === 'function') {
      try {
        const h = m.health.getSnapshot();
        data.health = {
          overall: h.status || h.overall || 'healthy',
          modules: h.modules || {},
          alerts: h.alerts || [],
        };
      } catch {
        data.health = {};
      }
    }

    // Collect cost/budget
    if (m.budget && typeof m.budget.getStatus === 'function') {
      try {
        const b = m.budget.getStatus();
        data.cost = {
          totalSpend: b.totalCost ?? b.costIncurred ?? 0,
          budgetMax: b.maxCost ?? b.budgetMax ?? 0,
          costPerGoal: b.costPerGoal ?? b.avgCost ?? 0,
          tokensUsed: b.tokensUsed ?? b.totalTokens ?? 0,
        };
      } catch {
        data.cost = {};
      }
    }

    // Collect recent events from Forge store
    if (m.forge && m.forge.store && typeof m.forge.store.getRecentEvents === 'function') {
      try {
        data.events = m.forge.store.getRecentEvents({ limit: 20 }) || [];
      } catch {
        data.events = [];
      }
    }

    this.#lastRefresh = Date.now();
    return data;
  }

  /**
   * Create an HTTP request handler for serving the dashboard and API endpoints.
   *
   * Routes:
   *   - GET /           → dashboard HTML
   *   - GET /api/status → JSON aggregated status
   *   - GET /api/goals  → JSON goals list
   *   - GET /api/analytics → JSON analytics
   *   - GET /api/health → JSON health
   *
   * @param {object} modules - connected Forge modules (same shape as collectData)
   * @returns {function(import('node:http').IncomingMessage, import('node:http').ServerResponse)} HTTP handler
   */
  createHandler(modules) {
    const self = this;

    /**
     * Handle incoming HTTP requests.
     * @param {import('node:http').IncomingMessage} req
     * @param {import('node:http').ServerResponse} res
     */
    return function handler(req, res) {
      // Basic auth check
      if (self.#auth) {
        const authHeader = req.headers.authorization || '';
        const expected = 'Basic ' + Buffer.from(
          self.#auth.user + ':' + self.#auth.pass,
        ).toString('base64');
        if (authHeader !== expected) {
          res.writeHead(401, {
            'Content-Type': 'text/plain',
            'WWW-Authenticate': 'Basic realm="Forge Dashboard"',
          });
          res.end('Unauthorized');
          return;
        }
      }

      const url = (req.url || '/').split('?')[0];
      const method = (req.method || 'GET').toUpperCase();

      if (method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
      }

      try {
        if (url === '/' || url === '/index.html') {
          const data = self.collectData(modules);
          const html = self.generateDashboard(data);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          });
          res.end(html);
        } else if (url === '/api/status') {
          const data = self.collectData(modules);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
          res.end(JSON.stringify(data));
        } else if (url === '/api/goals') {
          const goals = [];
          if (modules.forge && typeof modules.forge.listGoals === 'function') {
            try { goals.push(...(modules.forge.listGoals({ limit: 50 }) || [])); } catch { /* ignore */ }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ goals }));
        } else if (url === '/api/analytics') {
          let analytics = {};
          if (modules.analytics && typeof modules.analytics.getSummary === 'function') {
            try { analytics = modules.analytics.getSummary(); } catch { /* ignore */ }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ analytics }));
        } else if (url === '/api/health') {
          let health = {};
          if (modules.health && typeof modules.health.getSnapshot === 'function') {
            try { health = modules.health.getSnapshot(); } catch { /* ignore */ }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ health }));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: ' + (err.message || 'unknown'));
      }
    };
  }

  /**
   * Start the dashboard HTTP server.
   *
   * @param {object} [modules={}] - connected Forge modules
   * @returns {Promise<{ url: string, port: number }>} server info
   */
  async start(modules = {}) {
    if (this.#server) {
      throw new Error('Dashboard server is already running');
    }

    const handler = this.createHandler(modules);

    return new Promise((resolve, reject) => {
      const server = createServer(handler);

      server.on('connection', () => {
        this.#connections++;
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.#port} is already in use. Use a different port.`));
        } else {
          reject(err);
        }
      });

      server.listen(this.#port, this.#host, () => {
        this.#server = server;
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : this.#port;
        const url = 'http://' + this.#host + ':' + port;
        resolve({ url, port });
      });
    });
  }

  /**
   * Stop the dashboard HTTP server.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.#server) return;

    return new Promise((resolve, reject) => {
      this.#server.close((err) => {
        this.#server = null;
        this.#connections = 0;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get the current dashboard status.
   *
   * @returns {{ running: boolean, url: string|null, port: number, connections: number, lastRefresh: number }}
   */
  getStatus() {
    const running = this.#server !== null;
    const url = running ? 'http://' + this.#host + ':' + this.#port : null;
    return {
      running,
      url,
      port: this.#port,
      connections: this.#connections,
      lastRefresh: this.#lastRefresh,
    };
  }
}
