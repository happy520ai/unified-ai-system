import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Dynamic imports following the existing project pattern
let forgeRoutes;

before(async () => {
  forgeRoutes = await import('../src/integration/forge-routes.js');
});

// ---------------------------------------------------------------------------
// Helper: mock response object that captures writeHead / end output
// ---------------------------------------------------------------------------
function createMockRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      res.statusCode = status;
      res.headers = headers;
    },
    end(body) {
      res.body = body;
    },
  };
  return res;
}

/** Parse the captured JSON body from a mock response */
function parseBody(res) {
  return JSON.parse(res.body);
}

// ===========================================================================
// forge-routes.js
// ===========================================================================

describe('forge-routes.js', () => {

  // Shared mock objects
  let mockForge, mockAgentPool, handlers;

  before(() => {
    mockForge = {
      listGoals: () => [
        { id: 'g1', goal: 'Build feature', status: 'running', created_at: '2025-01-01', updated_at: '2025-01-02' },
        { id: 'g2', goal: 'Fix bug', status: 'completed', created_at: '2025-01-03', updated_at: '2025-01-04' },
      ],
      store: {
        getTasksForGoal: () => [],
      },
    };

    mockAgentPool = {
      getStatus: () => ({
        activeWorkers: 2,
        maxConcurrent: 5,
        utilization: 0.4,
        queueLength: 1,
        activeGoals: 2,
        maxGoals: 10,
        fileLocks: {},
        workers: [],
        queue: [],
      }),
      getPlugins: () => null,
      getResilience: () => null,
      getTracing: () => null,
      getMetrics: () => null,
    };

    const ctx = {
      forge: mockForge,
      agentPool: mockAgentPool,
      knowledge: null,
      transfer: null,
      gateway: null,
      config: { server: { version: '0.5.0' } },
    };

    handlers = forgeRoutes.createForgeRouteHandlers(ctx);
  });

  // ---- createForgeRouteHandlers ----
  describe('createForgeRouteHandlers()', () => {
    it('should return a handlers map (object)', () => {
      assert.ok(handlers);
      assert.strictEqual(typeof handlers, 'object');
    });

    it('should contain expected route keys', () => {
      assert.ok(handlers['GET /forge/health']);
      assert.ok(handlers['GET /forge/goals']);
      assert.ok(handlers['POST /forge/goals']);
      assert.ok(handlers['GET /forge/pool/status']);
      assert.ok(handlers['GET /forge/status']);
    });

    it('should have functions as handler values', () => {
      for (const [key, handler] of Object.entries(handlers)) {
        assert.strictEqual(typeof handler, 'function', `Handler for ${key} should be a function`);
      }
    });
  });

  // ---- matchForgeRoute ----
  describe('matchForgeRoute()', () => {
    it('should return exact match for GET /forge/health', () => {
      const result = forgeRoutes.matchForgeRoute(handlers, 'GET', '/forge/health');
      assert.ok(result);
      assert.strictEqual(typeof result.handler, 'function');
      assert.deepStrictEqual(result.params, {});
    });

    it('should return parameterized match for GET /forge/goals/:id', () => {
      const result = forgeRoutes.matchForgeRoute(handlers, 'GET', '/forge/goals/abc123');
      assert.ok(result);
      assert.strictEqual(typeof result.handler, 'function');
      assert.strictEqual(result.params.id, 'abc123');
    });

    it('should return null when no route matches', () => {
      const result = forgeRoutes.matchForgeRoute(handlers, 'GET', '/forge/nonexistent');
      assert.strictEqual(result, null);
    });

    it('should return null on method mismatch', () => {
      // PATCH /forge/health is not defined
      const result = forgeRoutes.matchForgeRoute(handlers, 'PATCH', '/forge/health');
      assert.strictEqual(result, null);
    });

    it('should match exact routes before parameterized ones', () => {
      // GET /forge/goals is exact; should not match the parameterized pattern
      const result = forgeRoutes.matchForgeRoute(handlers, 'GET', '/forge/goals');
      assert.ok(result);
      assert.deepStrictEqual(result.params, {});
    });
  });

  // ---- Handler: GET /forge/health ----
  describe('Handler: GET /forge/health', () => {
    it('should return ok envelope with health data', async () => {
      const res = createMockRes();
      const handler = handlers['GET /forge/health'];
      await handler({}, res);

      assert.strictEqual(res.statusCode, 200);
      const body = parseBody(res);
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.data.service, 'forge');
      assert.strictEqual(body.data.health, 'healthy');
      assert.strictEqual(body.data.version, '0.5.0');
      assert.strictEqual(typeof body.data.activeGoals, 'number');
      assert.strictEqual(typeof body.data.completedGoals, 'number');
      assert.strictEqual(typeof body.data.activeWorkers, 'number');
      assert.strictEqual(typeof body.data.uptime, 'number');
      assert.ok(body.meta.requestId);
    });
  });

  // ---- Handler: GET /forge/goals ----
  describe('Handler: GET /forge/goals', () => {
    it('should return ok envelope with adapted goals list', async () => {
      const res = createMockRes();
      const handler = handlers['GET /forge/goals'];
      await handler({}, res);

      assert.strictEqual(res.statusCode, 200);
      const body = parseBody(res);
      assert.strictEqual(body.status, 'ok');
      assert.ok(Array.isArray(body.data.goals));
      assert.strictEqual(body.data.total, 2);

      // Verify adapted goal shape
      const first = body.data.goals[0];
      assert.strictEqual(first.goalId, 'g1');
      assert.strictEqual(first.text, 'Build feature');
      assert.strictEqual(first.status, 'running');
      assert.ok(first.tasks);
      assert.strictEqual(first.tasks.total, 0);
      assert.strictEqual(first.tasks.completed, 0);
      assert.ok(body.meta.requestId);
    });
  });

  // ---- Handler: POST /forge/goals (validation) ----
  describe('Handler: POST /forge/goals', () => {
    it('should return 400 error envelope when goal text is missing', async () => {
      const res = createMockRes();
      const handler = handlers['POST /forge/goals'];
      const readJson = () => Promise.resolve({});
      await handler({}, res, readJson);

      assert.strictEqual(res.statusCode, 400);
      const body = parseBody(res);
      assert.strictEqual(body.status, 'error');
      assert.strictEqual(body.error.code, 'validation_error');
      assert.strictEqual(body.error.message, 'goal text is required');
    });
  });

  // ---- Handler: GET /forge/pool/status ----
  describe('Handler: GET /forge/pool/status', () => {
    it('should return ok envelope with adapted pool status', async () => {
      const res = createMockRes();
      const handler = handlers['GET /forge/pool/status'];
      await handler({}, res);

      assert.strictEqual(res.statusCode, 200);
      const body = parseBody(res);
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.data.activeWorkers, 2);
      assert.strictEqual(body.data.maxConcurrent, 5);
      assert.strictEqual(body.data.utilization, 0.4);
      assert.strictEqual(body.data.queueLength, 1);
      assert.ok(body.meta.requestId);
    });
  });

  // ---- Handler: GET /forge/status ----
  describe('Handler: GET /forge/status', () => {
    it('should return ok envelope with system status', async () => {
      const res = createMockRes();
      const handler = handlers['GET /forge/status'];
      await handler({}, res);

      assert.strictEqual(res.statusCode, 200);
      const body = parseBody(res);
      assert.strictEqual(body.status, 'ok');
      assert.strictEqual(body.data.service, 'forge');
      assert.strictEqual(body.data.version, '0.5.0');
      assert.strictEqual(body.data.health, 'healthy');
      assert.ok(body.data.stats);
      assert.strictEqual(typeof body.data.stats.activeGoals, 'number');
      assert.strictEqual(typeof body.data.stats.runningTasks, 'number');
      assert.strictEqual(typeof body.data.stats.completedGoals, 'number');
      assert.ok(body.data.pool);
      assert.ok(body.meta.requestId);
    });
  });
});
