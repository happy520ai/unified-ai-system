/**
 * Built-in plugins — small, useful plugins that ship with Forge.
 *
 * 1. LoggerPlugin   — structured console logging for all lifecycle events
 * 2. AuditPlugin    — writes audit trail to the TaskStore (goal/task lifecycle)
 * 3. RateLimitPlugin — simple token-bucket rate limiter for task dispatch
 */

// ── Logger Plugin ─────────────────────────────────────────────────────────

export class LoggerPlugin {
  #prefix;
  #verbose;

  constructor({ prefix = '[forge:log]', verbose = false } = {}) {
    this.#prefix = prefix;
    this.#verbose = verbose;
  }

  get name() { return 'logger'; }
  get version() { return '1.0.0'; }

  get plugin() {
    const prefix = this.#prefix;
    const verbose = this.#verbose;

    return {
      name: 'logger',
      version: '1.0.0',
      hooks: {
        beforeGoal(ctx) {
          console.log(`${prefix} Goal starting: ${ctx.goalId}`);
        },
        afterGoal(ctx) {
          const dur = ctx.durationMs ? ` (${(ctx.durationMs / 1000).toFixed(1)}s)` : '';
          console.log(`${prefix} Goal ${ctx.status || 'done'}: ${ctx.goalId}${dur}`);
        },
        beforeTask(ctx) {
          console.log(`${prefix} Task ${ctx.task?.id || '?'} (${ctx.task?.agent_role || '?'}) starting`);
        },
        afterTask(ctx) {
          const ok = ctx.result?.success ? 'OK' : 'FAIL';
          const files = ctx.result?.filesModified?.length ?? 0;
          console.log(`${prefix} Task ${ctx.task?.id || '?'} ${ok}` +
            (files > 0 ? ` — ${files} file(s) modified` : ''));
        },
        onTaskStart(ctx) {
          if (verbose) console.log(`${prefix} >> task_started ${ctx.taskId || ctx.task?.id}`);
        },
        onTaskComplete(ctx) {
          if (verbose) console.log(`${prefix} >> task_completed ${ctx.taskId || ctx.task?.id}`);
        },
        onTaskFail(ctx) {
          console.warn(`${prefix} >> task_failed ${ctx.taskId || ctx.task?.id}: ${ctx.error || 'unknown'}`);
        },
        onGoalComplete(ctx) {
          if (verbose) console.log(`${prefix} >> goal_completed ${ctx.goalId}`);
        },
      },
    };
  }
}

// ── Audit Plugin ──────────────────────────────────────────────────────────

/**
 * Writes structured audit records to the TaskStore via logEvent().
 *
 * Each audit entry includes: timestamp, plugin source, action, and metadata.
 */
export class AuditPlugin {
  #store;

  constructor({ store }) {
    if (!store) throw new Error('AuditPlugin requires a TaskStore instance');
    this.#store = store;
  }

  get name() { return 'audit'; }
  get version() { return '1.0.0'; }

  get plugin() {
    const store = this.#store;

    const audit = (goalId, taskId, action, meta) => {
      try {
        store.logEvent(goalId, taskId, `audit:${action}`, {
          plugin: 'audit',
          action,
          timestamp: new Date().toISOString(),
          ...meta,
        });
      } catch {
        // Audit failures should never crash execution
      }
    };

    return {
      name: 'audit',
      version: '1.0.0',
      hooks: {
        beforeGoal(ctx) {
          audit(ctx.goalId, null, 'goal_start', { goal: ctx.goal?.text });
        },
        afterGoal(ctx) {
          audit(ctx.goalId, null, 'goal_end', {
            status: ctx.status,
            durationMs: ctx.durationMs,
            tasksCompleted: ctx.tasksCompleted,
          });
        },
        beforeTask(ctx) {
          audit(ctx.goalId, ctx.task?.id, 'task_start', {
            name: ctx.task?.name,
            role: ctx.task?.agent_role,
            type: ctx.task?.type,
          });
        },
        afterTask(ctx) {
          audit(ctx.goalId, ctx.task?.id, 'task_end', {
            success: ctx.result?.success,
            filesModified: ctx.result?.filesModified?.length ?? 0,
          });
        },
        onTaskFail(ctx) {
          audit(ctx.goalId, ctx.taskId || ctx.task?.id, 'task_fail', {
            error: ctx.error,
            retries: ctx.retries,
          });
        },
      },
    };
  }
}

// ── Rate Limit Plugin ─────────────────────────────────────────────────────

/**
 * Simple token-bucket rate limiter as middleware.
 *
 * Limits how many tasks can be dispatched within a time window.
 * If the bucket is empty, waits until a token becomes available.
 */
export class RateLimitPlugin {
  #maxPerMinute;
  #tokens;
  #lastRefill;
  #queue;

  constructor({ maxPerMinute = 10 } = {}) {
    this.#maxPerMinute = maxPerMinute;
    this.#tokens = maxPerMinute;
    this.#lastRefill = Date.now();
    this.#queue = [];
  }

  get name() { return 'rate-limiter'; }
  get version() { return '1.0.0'; }

  get plugin() {
    const self = this;

    return {
      name: 'rate-limiter',
      version: '1.0.0',
      priority: 10, // Run early in the middleware chain
      async middleware(ctx, next) {
        await self.#acquire();
        try {
          return await next();
        } finally {
          // Token is consumed, no release needed (refill is time-based)
        }
      },
    };
  }

  async #acquire() {
    this.#refill();
    if (this.#tokens > 0) {
      this.#tokens--;
      return;
    }
    // Wait for next refill
    const waitMs = Math.ceil(60000 / this.#maxPerMinute);
    await new Promise(r => setTimeout(r, waitMs));
    this.#refill();
    this.#tokens = Math.max(0, this.#tokens - 1);
  }

  #refill() {
    const now = Date.now();
    const elapsed = now - this.#lastRefill;
    const refilled = Math.floor((elapsed / 60000) * this.#maxPerMinute);
    if (refilled > 0) {
      this.#tokens = Math.min(this.#maxPerMinute, this.#tokens + refilled);
      this.#lastRefill = now;
    }
  }

  getStatus() {
    this.#refill();
    return {
      maxPerMinute: this.#maxPerMinute,
      availableTokens: this.#tokens,
    };
  }
}
