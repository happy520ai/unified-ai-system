/**
 * PluginManager — extensible hook & middleware system for Forge.
 *
 * Plugins can register lifecycle hooks and task-execution middleware:
 *
 *   Hooks:        beforeGoal → afterCompile → beforeTask → afterTask →
 *                 beforeVerify → afterVerify → afterGoal
 *   Events:       onTaskStart, onTaskComplete, onTaskFail, onGoalComplete
 *   Middleware:    Koa-style (ctx, next) wrappers around worker.execute()
 *
 * Plugin shape:
 *   {
 *     name: 'my-plugin',
 *     version?: '1.0.0',
 *     hooks: { beforeGoal: async (ctx) => {}, afterTask: async (ctx) => {}, ... },
 *     middleware?: async (ctx, next) => { ... await next() ... },
 *   }
 *
 * Priority:  lower number runs first (default 100).
 */

import { EventEmitter } from 'node:events';

// ── Valid hook names ──────────────────────────────────────────────────────

const VALID_HOOKS = new Set([
  // Goal lifecycle
  'beforeGoal', 'afterCompile', 'afterGoal',
  // Task lifecycle
  'beforeTask', 'afterTask',
  // Verification
  'beforeVerify', 'afterVerify',
  // Fire-and-forget events (no error propagation)
  'onTaskStart', 'onTaskComplete', 'onTaskFail', 'onGoalComplete', 'onGoalFail',
]);

/**
 * Hooks that swallow errors (logged but not propagated).
 * Lifecycle hooks (beforeXxx/afterXxx) DO propagate errors so they can abort execution.
 */
const FIRE_AND_FORGET = new Set([
  'onTaskStart', 'onTaskComplete', 'onTaskFail', 'onGoalComplete', 'onGoalFail',
]);

// ── PluginManager class ───────────────────────────────────────────────────

export class PluginManager extends EventEmitter {
  #plugins = new Map();          // name → { plugin, priority, hooks, middleware }
  #hookChains = {};              // hookName → sorted array of { name, fn }
  #middlewareChain = [];          // sorted array of { name, fn }
  #dirty = true;                // chains need rebuild

  /**
   * Register a plugin.
   *
   * @param {string} name — unique plugin name (used for unregister)
   * @param {object} plugin — plugin object with hooks and/or middleware
   * @param {object} [opts]
   * @param {number} [opts.priority=100] — lower runs first
   */
  register(name, plugin, { priority = 100 } = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Plugin name is required (string)');
    }
    if (this.#plugins.has(name)) {
      throw new Error(`Plugin "${name}" is already registered. Unregister first.`);
    }

    const entry = {
      plugin,
      priority,
      hooks: {},
      middleware: null,
    };

    // Extract hooks
    if (plugin.hooks && typeof plugin.hooks === 'object') {
      for (const [hookName, fn] of Object.entries(plugin.hooks)) {
        if (!VALID_HOOKS.has(hookName)) {
          console.warn(`[plugins] Plugin "${name}" registered unknown hook "${hookName}" — ignoring`);
          continue;
        }
        if (typeof fn !== 'function') {
          console.warn(`[plugins] Plugin "${name}" hook "${hookName}" is not a function — ignoring`);
          continue;
        }
        entry.hooks[hookName] = fn;
      }
    }

    // Extract middleware
    if (typeof plugin.middleware === 'function') {
      entry.middleware = plugin.middleware;
    }

    this.#plugins.set(name, entry);
    this.#dirty = true;
    this.emit('register', { name, priority, hooks: Object.keys(entry.hooks), hasMiddleware: !!entry.middleware });

    return this;
  }

  /**
   * Unregister a plugin by name.
   */
  unregister(name) {
    if (!this.#plugins.has(name)) return false;
    this.#plugins.delete(name);
    this.#dirty = true;
    this.emit('unregister', { name });
    return true;
  }

  /**
   * Check if a plugin is registered.
   */
  has(name) {
    return this.#plugins.has(name);
  }

  /**
   * Get list of registered plugins.
   */
  list() {
    return [...this.#plugins.entries()].map(([name, entry]) => ({
      name,
      version: entry.plugin.version || '0.0.0',
      priority: entry.priority,
      hooks: Object.keys(entry.hooks),
      hasMiddleware: !!entry.middleware,
    }));
  }

  // ── Hook execution ────────────────────────────────────────────────────

  /**
   * Run all registered hooks for a given event name.
   *
   * - Lifecycle hooks (beforeXxx/afterXxx) run sequentially and propagate errors.
   * - Event hooks (on*) run in parallel and swallow errors (log only).
   *
   * @param {string} hookName — e.g., 'beforeTask'
   * @param {object} context — hook context (varies by hook)
   * @returns {object} — the (possibly mutated) context
   */
  async runHook(hookName, context = {}) {
    this.#rebuildChains();

    const chain = this.#hookChains[hookName];
    if (!chain || chain.length === 0) return context;

    const isFireForget = FIRE_AND_FORGET.has(hookName);

    if (isFireForget) {
      // Run all in parallel, swallow errors
      await Promise.allSettled(chain.map(async ({ name, fn }) => {
        try {
          await fn(context);
        } catch (err) {
          console.warn(`[plugins] Event hook "${hookName}" in "${name}" threw: ${err.message}`);
          this.emit('hook-error', { hookName, plugin: name, error: err });
        }
      }));
    } else {
      // Run sequentially, propagate errors
      for (const { name, fn } of chain) {
        try {
          const result = await fn(context);
          // If hook returns a modified context, merge it back
          if (result && typeof result === 'object' && result !== context) {
            Object.assign(context, result);
          }
        } catch (err) {
          this.emit('hook-error', { hookName, plugin: name, error: err });
          throw new Error(`Plugin "${name}" hook "${hookName}" failed: ${err.message}`);
        }
      }
    }

    return context;
  }

  // ── Middleware execution ──────────────────────────────────────────────

  /**
   * Run the middleware chain around a task execution.
   *
   * Each middleware receives (ctx, next) — Koa-style.
   * The innermost function is the actual worker.execute() call.
   *
   * @param {object} ctx — middleware context { goalId, task, projectRoot, ... }
   * @param {Function} executeFn — the actual execution function: () => Promise<result>
   * @returns {object} — execution result
   */
  async runMiddleware(ctx, executeFn) {
    this.#rebuildChains();

    if (this.#middlewareChain.length === 0) {
      return executeFn();
    }

    // Build Koa-style onion: outermost middleware wraps the next one
    let idx = -1;
    let lastResult;  // captures result from innermost call

    const dispatch = async (i) => {
      if (i <= idx) throw new Error('next() called multiple times');
      idx = i;

      if (i === this.#middlewareChain.length) {
        // Innermost: call the actual execute function
        lastResult = await executeFn();
        return lastResult;
      }

      const { name, fn } = this.#middlewareChain[i];
      try {
        const mwResult = await fn(ctx, () => dispatch(i + 1));
        // If middleware returns a value, use it; otherwise use lastResult
        return mwResult !== undefined ? mwResult : lastResult;
      } catch (err) {
        this.emit('middleware-error', { plugin: name, error: err, task: ctx.task?.id });
        throw err;
      }
    };

    return dispatch(0);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  /**
   * Rebuild hook chains and middleware chain if plugins changed.
   */
  #rebuildChains() {
    if (!this.#dirty) return;
    this.#dirty = false;

    // Sort plugins by priority (lower = earlier)
    const sorted = [...this.#plugins.entries()]
      .sort(([, a], [, b]) => a.priority - b.priority);

    // Rebuild hook chains
    this.#hookChains = {};
    for (const hookName of VALID_HOOKS) {
      const chain = [];
      for (const [name, entry] of sorted) {
        if (entry.hooks[hookName]) {
          chain.push({ name, fn: entry.hooks[hookName] });
        }
      }
      if (chain.length > 0) {
        this.#hookChains[hookName] = chain;
      }
    }

    // Rebuild middleware chain
    this.#middlewareChain = sorted
      .filter(([, entry]) => entry.middleware)
      .map(([name, entry]) => ({ name, fn: entry.middleware }));
  }

  /**
   * Return a serializable status summary.
   */
  getStatus() {
    this.#rebuildChains();
    return {
      count: this.#plugins.size,
      plugins: this.list(),
      hooks: Object.fromEntries(
        Object.entries(this.#hookChains).map(([k, v]) => [k, v.map(h => h.name)])
      ),
      middleware: this.#middlewareChain.map(m => m.name),
    };
  }
}

// ── Built-in Plugins ───────────────────────────────────────────────────────

/**
 * LoggerPlugin — logs goal & task lifecycle events to console.
 */
export class LoggerPlugin {
  #verbose;
  constructor({ verbose = false } = {}) {
    this.#verbose = verbose;
    this.name = 'logger';
    this.plugin = {
      version: '1.0.0',
      hooks: {
        beforeGoal: async (ctx) => {
          if (this.#verbose) console.log(`[forge:logger] Goal starting: ${ctx.goalId}`);
        },
        afterGoal: async (ctx) => {
          if (this.#verbose) console.log(`[forge:logger] Goal ${ctx.goalId} finished: ${ctx.status} (${ctx.durationMs}ms)`);
        },
        beforeTask: async (ctx) => {
          if (this.#verbose) console.log(`[forge:logger] Task ${ctx.task?.id} starting (${ctx.task?.agent_role})`);
        },
        afterTask: async (ctx) => {
          if (this.#verbose) console.log(`[forge:logger] Task ${ctx.task?.id} done: success=${ctx.result?.success}`);
        },
      },
    };
  }
}

/**
 * AuditPlugin — writes audit events to the store for compliance.
 */
export class AuditPlugin {
  #store;
  constructor({ store } = {}) {
    this.#store = store;
    this.name = 'audit';
    this.plugin = {
      version: '1.0.0',
      hooks: {
        beforeGoal: async (ctx) => {
          this.#store?.logEvent?.(ctx.goalId, null, 'audit:goal_start', { text: ctx.goal?.text });
        },
        afterGoal: async (ctx) => {
          this.#store?.logEvent?.(ctx.goalId, null, 'audit:goal_end', { status: ctx.status, durationMs: ctx.durationMs });
        },
        beforeTask: async (ctx) => {
          this.#store?.logEvent?.(ctx.goalId, ctx.task?.id, 'audit:task_start', { name: ctx.task?.name, agent_role: ctx.task?.agent_role, type: ctx.task?.type });
        },
        afterTask: async (ctx) => {
          this.#store?.logEvent?.(ctx.goalId, ctx.task?.id, 'audit:task_end', { success: ctx.result?.success, filesModified: ctx.result?.filesModified?.length || 0 });
        },
      },
    };
  }
}

/**
 * RateLimitPlugin — middleware-based rate limiter for task execution.
 */
export class RateLimitPlugin {
  #maxPerMinute;
  #timestamps = [];
  constructor({ maxPerMinute = 60 } = {}) {
    this.#maxPerMinute = maxPerMinute;
    this.name = 'rate-limiter';
    this.plugin = {
      version: '1.0.0',
      middleware: async (ctx, next) => {
        const now = Date.now();
        // Remove entries older than 1 minute
        this.#timestamps = this.#timestamps.filter(t => now - t < 60000);
        if (this.#timestamps.length >= this.#maxPerMinute) {
          throw new Error(`Rate limit exceeded: ${this.#maxPerMinute} executions per minute`);
        }
        this.#timestamps.push(now);
        return next();
      },
    };
  }
}
