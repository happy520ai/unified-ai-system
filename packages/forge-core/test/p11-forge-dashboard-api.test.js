/**
 * P11 ForgeDashboard Test Suite - API Routes & Lifecycle
 *
 * Tests for:
 *   - ForgeDashboard API route definitions (createHandler)
 *   - ForgeDashboard start()/stop() lifecycle
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ForgeDashboard } from '../src/forge-dashboard/index.js';

// ---------------------------------------------------------------------------
// Mock helpers for HTTP request/response simulation
// ---------------------------------------------------------------------------

/**
 * Create mock req/res objects that mimic node:http IncomingMessage/ServerResponse.
 * @param {string} method - HTTP method
 * @param {string} url - request URL
 * @returns {{ req: object, res: object }}
 */
function createMockRequestResponse(method, url) {
  const req = {
    method,
    url,
    headers: {},
  };

  const res = {
    statusCode: null,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      if (headers) {
        Object.assign(this.headers, headers);
      }
    },
    end(data) {
      if (data != null) {
        this.body = typeof data === 'string' ? data : String(data);
      }
    },
  };

  return { req, res };
}

// ---------------------------------------------------------------------------
// API route definitions (createHandler)
// ---------------------------------------------------------------------------

describe('ForgeDashboard', () => {
  describe('API route definitions (createHandler)', () => {
    it('should create a handler function', () => {
      const dash = new ForgeDashboard();
      const handler = dash.createHandler({});
      assert.equal(typeof handler, 'function');
    });

    it('should handle GET /api/status and return JSON', async () => {
      const dash = new ForgeDashboard();
      const handler = dash.createHandler({});

      const { req, res } = createMockRequestResponse('GET', '/api/status');
      handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['Content-Type']?.includes('application/json'));
      const body = JSON.parse(res.body);
      assert.ok('goals' in body);
      assert.ok('pool' in body);
      assert.ok('analytics' in body);
      assert.ok('health' in body);
    });

    it('should handle GET /api/goals and return goals array', async () => {
      const dash = new ForgeDashboard();
      const mockForge = {
        listGoals: () => [{ id: 'g1', text: 'Test goal', status: 'running' }],
      };
      const handler = dash.createHandler({ forge: mockForge });

      const { req, res } = createMockRequestResponse('GET', '/api/goals');
      handler(req, res);

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok(Array.isArray(body.goals));
      assert.equal(body.goals.length, 1);
    });

    it('should handle GET /api/analytics and return analytics object', () => {
      const dash = new ForgeDashboard();
      const mockAnalytics = {
        getSummary: () => ({ successRate: 0.95, avgDurationMs: 1200, throughput: 2.5 }),
      };
      const handler = dash.createHandler({ analytics: mockAnalytics });

      const { req, res } = createMockRequestResponse('GET', '/api/analytics');
      handler(req, res);

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok('analytics' in body);
      assert.equal(body.analytics.successRate, 0.95);
    });

    it('should handle GET /api/health and return health object', () => {
      const dash = new ForgeDashboard();
      const mockHealth = {
        getSnapshot: () => ({ status: 'healthy', modules: {}, alerts: [] }),
      };
      const handler = dash.createHandler({ health: mockHealth });

      const { req, res } = createMockRequestResponse('GET', '/api/health');
      handler(req, res);

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.ok('health' in body);
      assert.equal(body.health.status, 'healthy');
    });

    it('should return 404 for unknown routes', () => {
      const dash = new ForgeDashboard();
      const handler = dash.createHandler({});

      const { req, res } = createMockRequestResponse('GET', '/api/unknown');
      handler(req, res);

      assert.equal(res.statusCode, 404);
    });

    it('should return 405 for non-GET methods', () => {
      const dash = new ForgeDashboard();
      const handler = dash.createHandler({});

      const { req, res } = createMockRequestResponse('POST', '/api/status');
      handler(req, res);

      assert.equal(res.statusCode, 405);
    });

    it('should return 401 when auth is configured and credentials are missing', () => {
      const dash = new ForgeDashboard({ auth: { user: 'admin', pass: 'pass' } });
      const handler = dash.createHandler({});

      const { req, res } = createMockRequestResponse('GET', '/api/status');
      handler(req, res);

      assert.equal(res.statusCode, 401);
    });

    it('should return 200 when valid basic auth credentials are provided', () => {
      const dash = new ForgeDashboard({ auth: { user: 'admin', pass: 'pass' } });
      const handler = dash.createHandler({});

      const { req, res } = createMockRequestResponse('GET', '/api/status');
      req.headers.authorization = 'Basic ' + Buffer.from('admin:pass').toString('base64');
      handler(req, res);

      assert.equal(res.statusCode, 200);
    });

    it('should serve dashboard HTML on GET /', () => {
      const dash = new ForgeDashboard();
      const handler = dash.createHandler({});

      const { req, res } = createMockRequestResponse('GET', '/');
      handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.headers['Content-Type']?.includes('text/html'));
      assert.ok(res.body.includes('Forge Dashboard'));
    });
  });

  describe('start()/stop() lifecycle', () => {
    let dash;
    let port;

    before(() => {
      port = 19000 + Math.floor(Math.random() * 1000);
      dash = new ForgeDashboard({ port });
    });

    it('should start the server and return url and port', async () => {
      const result = await dash.start({});
      assert.ok(result.url);
      assert.equal(result.port, port);
      assert.ok(result.url.includes(String(port)));
    });

    it('should report running status after start', () => {
      const status = dash.getStatus();
      assert.equal(status.running, true);
      assert.ok(status.url);
      assert.equal(status.port, port);
    });

    it('should throw when starting an already running server', async () => {
      await assert.rejects(
        () => dash.start({}),
        { message: /already running/ },
      );
    });

    it('should stop the server cleanly', async () => {
      await dash.stop();
      const status = dash.getStatus();
      assert.equal(status.running, false);
      assert.equal(status.url, null);
    });

    it('should allow restart after stop', async () => {
      const result = await dash.start({});
      assert.ok(result.url);
      await dash.stop();
      const status = dash.getStatus();
      assert.equal(status.running, false);
    });
  });
});
