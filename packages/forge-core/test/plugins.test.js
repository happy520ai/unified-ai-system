import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let PluginManager, LoggerPlugin, AuditPlugin, RateLimitPlugin;

before(async () => {
  const mod = await import('../src/plugins/index.js');
  PluginManager = mod.PluginManager;
  const builtins = await import('../src/plugins/builtins.js');
  LoggerPlugin = builtins.LoggerPlugin;
  AuditPlugin = builtins.AuditPlugin;
  RateLimitPlugin = builtins.RateLimitPlugin;
});

describe('PluginManager', { concurrency: 1 }, () => {

  // ── Export & Creation ────────────────────────────────────────────────

  it('should export PluginManager class', () => {
    assert.ok(PluginManager);
    assert.strictEqual(typeof PluginManager, 'function');
  });

  it('should create an empty instance', () => {
    const pm = new PluginManager();
    assert.ok(pm);
    assert.deepStrictEqual(pm.list(), []);
  });

  // ── Registration ───────────────────────────────────────────────────

  it('should register a plugin', () => {
    const pm = new PluginManager();
    pm.register('test', { name: 'test', version: '1.0.0', hooks: {} });
    assert.ok(pm.has('test'));
    assert.strictEqual(pm.list().length, 1);
    assert.strictEqual(pm.list()[0].name, 'test');
    assert.strictEqual(pm.list()[0].version, '1.0.0');
  });

  it('should reject duplicate registration', () => {
    const pm = new PluginManager();
    pm.register('dup', { hooks: {} });
    assert.throws(() => pm.register('dup', { hooks: {} }), /already registered/);
  });

  it('should require a name', () => {
    const pm = new PluginManager();
    assert.throws(() => pm.register('', { hooks: {} }), /required/);
  });

  it('should unregister a plugin', () => {
    const pm = new PluginManager();
    pm.register('rem', { hooks: {} });
    assert.ok(pm.has('rem'));
    assert.strictEqual(pm.unregister('rem'), true);
    assert.ok(!pm.has('rem'));
    assert.strictEqual(pm.unregister('nonexistent'), false);
  });

  // ── Hook Execution ─────────────────────────────────────────────────

  it('should run lifecycle hooks sequentially', async () => {
    const pm = new PluginManager();
    const order = [];

    pm.register('a', { hooks: { beforeTask: async () => { order.push('a'); } } }, { priority: 1 });
    pm.register('b', { hooks: { beforeTask: async () => { order.push('b'); } } }, { priority: 2 });
    pm.register('c', { hooks: { beforeTask: async () => { order.push('c'); } } }, { priority: 3 });

    await pm.runHook('beforeTask', {});
    assert.deepStrictEqual(order, ['a', 'b', 'c']);
  });

  it('should respect priority ordering', async () => {
    const pm = new PluginManager();
    const order = [];

    pm.register('low', { hooks: { beforeGoal: async () => { order.push('low'); } } }, { priority: 200 });
    pm.register('high', { hooks: { beforeGoal: async () => { order.push('high'); } } }, { priority: 1 });
    pm.register('mid', { hooks: { beforeGoal: async () => { order.push('mid'); } } }, { priority: 100 });

    await pm.runHook('beforeGoal', {});
    assert.deepStrictEqual(order, ['high', 'mid', 'low']);
  });

  it('should propagate errors from lifecycle hooks', async () => {
    const pm = new PluginManager();
    pm.register('bad', { hooks: { beforeTask: async () => { throw new Error('hook failed'); } } });

    await assert.rejects(() => pm.runHook('beforeTask', {}), /hook failed/);
  });

  it('should swallow errors from fire-and-forget hooks', async () => {
    const pm = new PluginManager();
    pm.register('noisy', { hooks: { onTaskStart: async () => { throw new Error('oops'); } } });

    // Should not throw
    await pm.runHook('onTaskStart', { taskId: 't1' });
  });

  it('should allow hooks to mutate context', async () => {
    const pm = new PluginManager();
    pm.register('enricher', {
      hooks: {
        beforeTask: async (ctx) => {
          ctx.enriched = true;
          ctx.tag = 'test';
        },
      },
    });

    const ctx = { goalId: 'g1', task: { id: 't1' } };
    const result = await pm.runHook('beforeTask', ctx);
    assert.strictEqual(result.enriched, true);
    assert.strictEqual(result.tag, 'test');
  });

  it('should return context unchanged when no hooks registered', async () => {
    const pm = new PluginManager();
    const ctx = { foo: 'bar' };
    const result = await pm.runHook('beforeGoal', ctx);
    assert.strictEqual(result, ctx);
  });

  it('should warn on unknown hooks', () => {
    const pm = new PluginManager();
    // Should not throw, just warn
    pm.register('weird', { hooks: { unknownHook: async () => {} } });
    const listed = pm.list();
    assert.strictEqual(listed[0].hooks.length, 0);
  });

  // ── Middleware ──────────────────────────────────────────────────────

  it('should execute middleware in Koa-style onion order', async () => {
    const pm = new PluginManager();
    const order = [];

    pm.register('outer', {
      middleware: async (ctx, next) => {
        order.push('outer-before');
        await next();
        order.push('outer-after');
      },
    }, { priority: 1 });

    pm.register('inner', {
      middleware: async (ctx, next) => {
        order.push('inner-before');
        await next();
        order.push('inner-after');
      },
    }, { priority: 2 });

    const result = await pm.runMiddleware({}, async () => {
      order.push('execute');
      return { success: true };
    });

    assert.deepStrictEqual(order, [
      'outer-before', 'inner-before', 'execute', 'inner-after', 'outer-after',
    ]);
    assert.strictEqual(result.success, true);
  });

  it('should allow middleware to modify context and result', async () => {
    const pm = new PluginManager();

    pm.register('timer', {
      middleware: async (ctx, next) => {
        ctx.startTime = Date.now();
        const result = await next();
        result.durationMs = Date.now() - ctx.startTime;
        return result;
      },
    });

    const ctx = { task: { id: 't1' } };
    const result = await pm.runMiddleware(ctx, async () => ({ success: true, output: 'done' }));

    assert.ok(typeof result.durationMs === 'number');
    assert.strictEqual(result.success, true);
  });

  it('should skip middleware chain when no middleware registered', async () => {
    const pm = new PluginManager();
    pm.register('hook-only', { hooks: { beforeTask: async () => {} } });

    const result = await pm.runMiddleware({}, async () => ({ ok: true }));
    assert.strictEqual(result.ok, true);
  });

  it('should propagate middleware errors', async () => {
    const pm = new PluginManager();
    pm.register('breaker', {
      middleware: async (ctx, next) => {
        throw new Error('middleware broke');
      },
    });

    await assert.rejects(() => pm.runMiddleware({}, async () => ({})), /middleware broke/);
  });

  it('should reject double next() calls', async () => {
    const pm = new PluginManager();
    pm.register('double', {
      middleware: async (ctx, next) => {
        await next();
        await next(); // should throw
      },
    });

    await assert.rejects(() => pm.runMiddleware({}, async () => ({})), /multiple times/);
  });

  // ── getStatus ──────────────────────────────────────────────────────

  it('should return a getStatus() summary', () => {
    const pm = new PluginManager();
    pm.register('alpha', {
      version: '2.0.0',
      hooks: { beforeGoal: async () => {}, afterTask: async () => {} },
      middleware: async (ctx, next) => next(),
    }, { priority: 5 });
    pm.register('beta', {
      hooks: { onTaskStart: async () => {} },
    });

    const status = pm.getStatus();
    assert.strictEqual(status.count, 2);
    assert.strictEqual(status.plugins.length, 2);
    assert.strictEqual(status.plugins[0].name, 'alpha'); // lower priority = first
    assert.ok(status.hooks.beforeGoal.includes('alpha'));
    assert.ok(status.hooks.afterTask.includes('alpha'));
    assert.ok(status.hooks.onTaskStart.includes('beta'));
    assert.deepStrictEqual(status.middleware, ['alpha']);
  });

  // ── Built-in Plugins ──────────────────────────────────────────────

  it('should export LoggerPlugin', () => {
    assert.ok(LoggerPlugin);
    const logger = new LoggerPlugin({ verbose: true });
    assert.strictEqual(logger.name, 'logger');
    assert.ok(logger.plugin.hooks.beforeGoal);
    assert.ok(logger.plugin.hooks.afterGoal);
    assert.ok(logger.plugin.hooks.beforeTask);
    assert.ok(logger.plugin.hooks.afterTask);
  });

  it('should register LoggerPlugin with PluginManager', async () => {
    const pm = new PluginManager();
    const logger = new LoggerPlugin();
    pm.register(logger.name, logger.plugin);
    assert.ok(pm.has('logger'));

    // Hooks should run without error
    await pm.runHook('beforeGoal', { goalId: 'g1' });
    await pm.runHook('afterGoal', { goalId: 'g1', status: 'completed', durationMs: 5000 });
    await pm.runHook('beforeTask', { task: { id: 't1', agent_role: 'coder' } });
    await pm.runHook('afterTask', { task: { id: 't1' }, result: { success: true, filesModified: [] } });
  });

  it('should export AuditPlugin', () => {
    assert.ok(AuditPlugin);
    const mockStore = { logEvent: () => {} };
    const audit = new AuditPlugin({ store: mockStore });
    assert.strictEqual(audit.name, 'audit');
    assert.ok(audit.plugin.hooks.beforeGoal);
    assert.ok(audit.plugin.hooks.afterGoal);
    assert.ok(audit.plugin.hooks.beforeTask);
    assert.ok(audit.plugin.hooks.afterTask);
  });

  it('AuditPlugin should write to store on hooks', async () => {
    const events = [];
    const mockStore = { logEvent: (g, t, type, meta) => events.push({ g, t, type, meta }) };
    const audit = new AuditPlugin({ store: mockStore });
    const pm = new PluginManager();
    pm.register('audit', audit.plugin);

    await pm.runHook('beforeGoal', { goalId: 'g1', goal: { text: 'test' } });
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'audit:goal_start');

    await pm.runHook('beforeTask', { goalId: 'g1', task: { id: 't1', name: 'impl', agent_role: 'coder', type: 'implement' } });
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[1].type, 'audit:task_start');
  });

  it('should export RateLimitPlugin with middleware', async () => {
    assert.ok(RateLimitPlugin);
    const rl = new RateLimitPlugin({ maxPerMinute: 100 });
    assert.strictEqual(rl.name, 'rate-limiter');
    assert.ok(typeof rl.plugin.middleware === 'function');

    const pm = new PluginManager();
    pm.register(rl.name, rl.plugin);

    // Middleware should pass through
    const result = await pm.runMiddleware({}, async () => ({ ok: true }));
    assert.strictEqual(result.ok, true);
  });

  // ── Event emitter ──────────────────────────────────────────────────

  it('should emit register/unregister events', () => {
    const pm = new PluginManager();
    const events = [];
    pm.on('register', (e) => events.push({ type: 'register', ...e }));
    pm.on('unregister', (e) => events.push({ type: 'unregister', ...e }));

    pm.register('evt-test', { hooks: { beforeGoal: async () => {} } });
    pm.unregister('evt-test');

    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].type, 'register');
    assert.strictEqual(events[0].name, 'evt-test');
    assert.strictEqual(events[1].type, 'unregister');
  });

  it('should emit hook-error on fire-and-forget failures', async () => {
    const pm = new PluginManager();
    let errorEvent = null;
    pm.on('hook-error', (e) => { errorEvent = e; });

    pm.register('fail-plugin', {
      hooks: { onTaskComplete: async () => { throw new Error('event-fail'); } },
    });

    await pm.runHook('onTaskComplete', { taskId: 't1' });
    assert.ok(errorEvent);
    assert.strictEqual(errorEvent.plugin, 'fail-plugin');
    assert.ok(errorEvent.error.message.includes('event-fail'));
  });
});
