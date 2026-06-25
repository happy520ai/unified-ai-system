import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Dynamic imports following the existing project pattern
let bridge;

before(async () => {
  bridge = await import('../src/integration/bridge.js');
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
// bridge.js
// ===========================================================================

describe('bridge.js', () => {

  // ---- okResponse ----
  describe('okResponse()', () => {
    it('should wrap data in a standard ok envelope', () => {
      const data = { hello: 'world' };
      const result = bridge.okResponse(data);
      assert.strictEqual(result.status, 'ok');
      assert.deepStrictEqual(result.data, data);
      assert.ok(result.meta);
      assert.ok(result.meta.createdAt);
    });

    it('should forward meta fields such as requestId', () => {
      const result = bridge.okResponse({ x: 1 }, { requestId: 'req_abc' });
      assert.strictEqual(result.status, 'ok');
      assert.strictEqual(result.meta.requestId, 'req_abc');
    });
  });

  // ---- errResponse ----
  describe('errResponse()', () => {
    it('should wrap errors in a standard error envelope', () => {
      const result = bridge.errResponse('not_found', 'Resource missing');
      assert.strictEqual(result.status, 'error');
      assert.strictEqual(result.error.code, 'not_found');
      assert.strictEqual(result.error.message, 'Resource missing');
      assert.ok(result.meta);
    });

    it('should include optional category and retryable fields', () => {
      const result = bridge.errResponse('timeout', 'Timed out', {
        category: 'transient',
        retryable: true,
      });
      assert.strictEqual(result.error.category, 'transient');
      assert.strictEqual(result.error.retryable, true);
    });
  });

  // ---- forgeRequestId ----
  describe('forgeRequestId()', () => {
    it('should generate a unique request ID with forge prefix', () => {
      const id = bridge.forgeRequestId();
      assert.ok(id.startsWith('forge_'));
    });

    it('should support a custom prefix', () => {
      const id = bridge.forgeRequestId('custom');
      assert.ok(id.startsWith('custom_'));
    });

    it('should generate unique IDs on successive calls', () => {
      const a = bridge.forgeRequestId();
      const b = bridge.forgeRequestId();
      assert.notStrictEqual(a, b);
    });
  });

  // ---- adaptGoal ----
  describe('adaptGoal()', () => {
    it('should transform a goal record with snake_case fields', () => {
      const goal = {
        id: 'g1',
        goal: 'Build the API',
        status: 'running',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
      };
      const result = bridge.adaptGoal(goal);
      assert.strictEqual(result.goalId, 'g1');
      assert.strictEqual(result.text, 'Build the API');
      assert.strictEqual(result.status, 'running');
      assert.strictEqual(result.createdAt, '2025-01-01T00:00:00Z');
      assert.strictEqual(result.updatedAt, '2025-01-02T00:00:00Z');
      assert.strictEqual(result.completedAt, null);
      assert.strictEqual(result.tasks, undefined);
      assert.deepStrictEqual(result.metadata, {});
    });

    it('should transform a goal record with camelCase fields', () => {
      const goal = {
        id: 'g2',
        text: 'Write tests',
        status: 'completed',
        createdAt: '2025-03-01T00:00:00Z',
        updatedAt: '2025-03-02T00:00:00Z',
        completedAt: '2025-03-03T00:00:00Z',
      };
      const result = bridge.adaptGoal(goal);
      assert.strictEqual(result.goalId, 'g2');
      assert.strictEqual(result.text, 'Write tests');
      assert.strictEqual(result.completedAt, '2025-03-03T00:00:00Z');
    });

    it('should include task stats when provided', () => {
      const goal = { id: 'g3', goal: 'Deploy', status: 'running' };
      const taskStats = { totalTasks: 10, completedTasks: 7 };
      const result = bridge.adaptGoal(goal, taskStats);
      assert.deepStrictEqual(result.tasks, { total: 10, completed: 7 });
    });

    it('should leave tasks undefined when taskStats is not provided', () => {
      const goal = { id: 'g4', goal: 'Plan', status: 'pending' };
      const result = bridge.adaptGoal(goal);
      assert.strictEqual(result.tasks, undefined);
    });

    it('should pass through metadata from the goal', () => {
      const goal = { id: 'g5', goal: 'Research', status: 'pending', metadata: { priority: 'high' } };
      const result = bridge.adaptGoal(goal);
      assert.deepStrictEqual(result.metadata, { priority: 'high' });
    });
  });

  // ---- adaptPoolStatus ----
  describe('adaptPoolStatus()', () => {
    it('should transform a full pool status object', () => {
      const pool = {
        activeWorkers: 3,
        maxConcurrent: 5,
        utilization: 0.6,
        queueLength: 2,
        activeGoals: 4,
        maxGoals: 10,
        fileLocks: { 'file.js': true },
        workers: [
          { id: 'w1', type: 'coder', status: 'busy', currentGoal: 'g1', currentTask: 't1' },
        ],
        queue: [{ id: 'q1' }],
        budget: { remaining: 100 },
        verification: { pending: 1 },
      };
      const result = bridge.adaptPoolStatus(pool);
      assert.strictEqual(result.activeWorkers, 3);
      assert.strictEqual(result.maxConcurrent, 5);
      assert.strictEqual(result.utilization, 0.6);
      assert.strictEqual(result.queueLength, 2);
      assert.strictEqual(result.activeGoals, 4);
      assert.strictEqual(result.maxGoals, 10);
      assert.deepStrictEqual(result.fileLocks, { 'file.js': true });
      assert.strictEqual(result.workers.length, 1);
      assert.strictEqual(result.workers[0].id, 'w1');
      assert.strictEqual(result.workers[0].type, 'coder');
      assert.deepStrictEqual(result.queue, [{ id: 'q1' }]);
      assert.deepStrictEqual(result.budget, { remaining: 100 });
      assert.deepStrictEqual(result.verification, { pending: 1 });
    });

    it('should return defaults when poolStatus is null', () => {
      const result = bridge.adaptPoolStatus(null);
      assert.strictEqual(result.activeWorkers, 0);
      assert.strictEqual(result.maxConcurrent, 0);
      assert.strictEqual(result.utilization, 0);
    });

    it('should return defaults when poolStatus is undefined', () => {
      const result = bridge.adaptPoolStatus(undefined);
      assert.strictEqual(result.activeWorkers, 0);
      assert.strictEqual(result.maxConcurrent, 0);
      assert.strictEqual(result.utilization, 0);
    });

    it('should adapt workerType field to type on workers', () => {
      const pool = {
        workers: [{ id: 'w2', workerType: 'tester', status: 'idle' }],
      };
      const result = bridge.adaptPoolStatus(pool);
      assert.strictEqual(result.workers[0].type, 'tester');
      assert.strictEqual(result.workers[0].currentGoal, null);
      assert.strictEqual(result.workers[0].currentTask, null);
    });
  });

  // ---- adaptMetrics ----
  describe('adaptMetrics()', () => {
    it('should transform metrics with tasks and goals', () => {
      const metrics = {
        tasks: { completed: 10, failed: 2, avgDurationMs: 500, p95DurationMs: 1200, throughput: 5 },
        goals: { completed: 3, failed: 1, avgDurationMs: 3000 },
      };
      const result = bridge.adaptMetrics(metrics);
      assert.strictEqual(result.tasks.completed, 10);
      assert.strictEqual(result.tasks.failed, 2);
      assert.strictEqual(result.tasks.avgDurationMs, 500);
      assert.strictEqual(result.tasks.p95DurationMs, 1200);
      assert.strictEqual(result.tasks.throughput, 5);
      assert.strictEqual(result.goals.completed, 3);
      assert.strictEqual(result.goals.failed, 1);
      assert.strictEqual(result.goals.avgDurationMs, 3000);
    });

    it('should return null tasks/goals when metrics is null', () => {
      const result = bridge.adaptMetrics(null);
      assert.deepStrictEqual(result, { tasks: null, goals: null });
    });

    it('should return null for missing sub-objects', () => {
      const result = bridge.adaptMetrics({});
      assert.strictEqual(result.tasks, null);
      assert.strictEqual(result.goals, null);
    });
  });

  // ---- adaptResilience ----
  describe('adaptResilience()', () => {
    it('should transform resilience status with circuit breaker and adaptive timeout', () => {
      const resilience = {
        circuitBreaker: { circuits: { api: 'closed' }, totalCircuits: 3, openCircuits: 1 },
        adaptiveTimeout: { currentTimeoutMs: 5000, p95Ms: 4500, sampleCount: 50 },
      };
      const result = bridge.adaptResilience(resilience);
      assert.deepStrictEqual(result.circuitBreaker.circuits, { api: 'closed' });
      assert.strictEqual(result.circuitBreaker.totalCircuits, 3);
      assert.strictEqual(result.circuitBreaker.openCircuits, 1);
      assert.strictEqual(result.adaptiveTimeout.currentTimeoutMs, 5000);
      assert.strictEqual(result.adaptiveTimeout.p95Ms, 4500);
      assert.strictEqual(result.adaptiveTimeout.sampleCount, 50);
    });

    it('should return null fields when resilience is null', () => {
      const result = bridge.adaptResilience(null);
      assert.deepStrictEqual(result, { circuitBreaker: null, adaptiveTimeout: null });
    });

    it('should handle partial resilience data (only circuit breaker)', () => {
      const result = bridge.adaptResilience({
        circuitBreaker: { totalCircuits: 1 },
      });
      assert.ok(result.circuitBreaker);
      assert.strictEqual(result.adaptiveTimeout, null);
    });
  });

  // ---- adaptTracing ----
  describe('adaptTracing()', () => {
    it('should transform tracing status', () => {
      const tracing = { totalTraces: 100, totalSpans: 500, activeTraces: 5, evictedTraces: 2 };
      const result = bridge.adaptTracing(tracing);
      assert.strictEqual(result.totalTraces, 100);
      assert.strictEqual(result.totalSpans, 500);
      assert.strictEqual(result.activeTraces, 5);
      assert.strictEqual(result.evictedTraces, 2);
    });

    it('should return zeroed fields when tracing is null', () => {
      const result = bridge.adaptTracing(null);
      assert.deepStrictEqual(result, { totalTraces: 0, totalSpans: 0 });
    });

    it('should default missing fields to zero', () => {
      const result = bridge.adaptTracing({});
      assert.strictEqual(result.totalTraces, 0);
      assert.strictEqual(result.totalSpans, 0);
      assert.strictEqual(result.activeTraces, 0);
      assert.strictEqual(result.evictedTraces, 0);
    });
  });

  // ---- adaptSystemStatus ----
  describe('adaptSystemStatus()', () => {
    it('should transform a full system status object', () => {
      const params = {
        version: '1.0.0',
        uptime: 12345,
        stats: { activeGoals: 3, runningTasks: 2, completed: 10, poolUtil: 0.5 },
        pool: { activeWorkers: 2, maxConcurrent: 4 },
        knowledge: { totalEntries: 50 },
        gateway: { available: true },
        resilience: null,
        tracing: null,
        plugins: { count: 3 },
        metrics: null,
      };
      const result = bridge.adaptSystemStatus(params);
      assert.strictEqual(result.service, 'forge');
      assert.strictEqual(result.version, '1.0.0');
      assert.strictEqual(result.uptime, 12345);
      assert.strictEqual(result.health, 'healthy');
      assert.strictEqual(result.stats.activeGoals, 3);
      assert.strictEqual(result.stats.runningTasks, 2);
      assert.strictEqual(result.stats.completedGoals, 10);
      assert.strictEqual(result.stats.poolUtilization, 0.5);
      assert.ok(result.pool);
      assert.deepStrictEqual(result.knowledge, { totalEntries: 50 });
      assert.deepStrictEqual(result.gateway, { available: true });
      assert.deepStrictEqual(result.plugins, { count: 3 });
      assert.deepStrictEqual(result.metrics, { tasks: null, goals: null });
      assert.deepStrictEqual(result.resilience, { circuitBreaker: null, adaptiveTimeout: null });
      assert.deepStrictEqual(result.tracing, { totalTraces: 0, totalSpans: 0 });
    });

    it('should default version to 0.5.0 when not provided', () => {
      const result = bridge.adaptSystemStatus({ uptime: 1, stats: {} });
      assert.strictEqual(result.version, '0.5.0');
    });

    it('should handle empty params gracefully', () => {
      const result = bridge.adaptSystemStatus({});
      assert.strictEqual(result.service, 'forge');
      assert.strictEqual(result.version, '0.5.0');
      assert.strictEqual(result.stats.activeGoals, 0);
      assert.deepStrictEqual(result.plugins, { count: 0 });
      assert.deepStrictEqual(result.knowledge, { totalEntries: 0 });
      assert.deepStrictEqual(result.gateway, { available: false });
    });
  });

  // ---- resolveForgePermission ----
  describe('resolveForgePermission()', () => {
    it('should resolve an exact match for GET /forge/health', () => {
      const perm = bridge.resolveForgePermission('GET', '/forge/health');
      assert.strictEqual(perm, 'public:read');
    });

    it('should resolve an exact match for POST /forge/goals', () => {
      const perm = bridge.resolveForgePermission('POST', '/forge/goals');
      assert.strictEqual(perm, 'workflow:run');
    });

    it('should pattern-match parameterized routes like GET /forge/goals/abc123', () => {
      const perm = bridge.resolveForgePermission('GET', '/forge/goals/abc123');
      assert.strictEqual(perm, 'dashboard:read');
    });

    it('should pattern-match DELETE /forge/goals/:id', () => {
      const perm = bridge.resolveForgePermission('DELETE', '/forge/goals/xyz');
      assert.strictEqual(perm, 'workflow:run');
    });

    it('should return default dashboard:read for unknown forge routes', () => {
      const perm = bridge.resolveForgePermission('GET', '/forge/unknown/path');
      assert.strictEqual(perm, 'dashboard:read');
    });
  });

  // ---- FORGE_PERMISSIONS ----
  describe('FORGE_PERMISSIONS', () => {
    it('should be a non-empty object', () => {
      assert.ok(bridge.FORGE_PERMISSIONS);
      assert.strictEqual(typeof bridge.FORGE_PERMISSIONS, 'object');
      const keys = Object.keys(bridge.FORGE_PERMISSIONS);
      assert.ok(keys.length > 0);
    });

    it('should contain expected entries', () => {
      assert.strictEqual(bridge.FORGE_PERMISSIONS['GET /forge/health'], 'public:read');
      assert.strictEqual(bridge.FORGE_PERMISSIONS['POST /forge/goals'], 'workflow:run');
      assert.strictEqual(bridge.FORGE_PERMISSIONS['GET /forge/status'], 'dashboard:read');
      assert.strictEqual(bridge.FORGE_PERMISSIONS['GET /forge/security/audit'], 'audit:read');
    });
  });
});
