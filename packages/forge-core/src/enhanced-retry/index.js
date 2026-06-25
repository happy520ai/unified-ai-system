/**
 * Enhanced Retry Module — advanced retry strategies beyond simple backoff.
 *
 * Provides intelligent retry with multiple backoff strategies:
 *   - Exponential: base * 2^attempt + jitter (fast recovery for transient errors)
 *   - Linear: base * (attempt + 1) + jitter (steady recovery for rate limits)
 *   - Fibonacci: base * fib(attempt + 1) + jitter (slow growth for resource exhaustion)
 *
 * Strategy selection is automatic based on error type classification.
 * Repeated failures trigger input degradation (context reduction, prompt
 * simplification) to increase the chance of success.
 *
 * Pure Node.js, no external dependencies.
 *
 * @module enhanced-retry
 */

import {
  classifyError, fibonacci,
  degradeInput as _degradeInput,
  selectStrategy as _selectStrategy,
  getStrategyStats as _getStrategyStats,
} from './retryAnalytics.js';

// ── EnhancedRetry ───────────────────────────────────────────────────────────

/**
 * Advanced retry engine with strategy selection and input degradation.
 *
 * Automatically selects the best backoff strategy based on error type,
 * applies jitter to avoid thundering-herd effects, and progressively
 * degrades inputs on repeated failures.
 *
 * @example
 *   const retry = new EnhancedRetry({ maxRetries: 4, baseDelayMs: 500 });
 *   const result = await retry.execute(
 *     async () => await fetchModel(prompt),
 *     { errorType: 'rate_limit', taskType: 'chat' }
 *   );
 *   console.log(result.attempts, result.strategy);
 */
export class EnhancedRetry {
  /** @type {number} Maximum retry attempts */
  #maxRetries;

  /** @type {string[]} Available strategies */
  #strategies;

  /** @type {number} Base delay in ms */
  #baseDelayMs;

  /** @type {number} Maximum delay cap in ms */
  #maxDelayMs;

  /** @type {number} Jitter ratio (0-1) */
  #jitterRatio;

  /** @type {Map<string, Array<{ strategy: string, attempts: number, succeeded: boolean }>>} */
  #outcomes = new Map();

  /** @type {number} Total retry operations performed */
  #totalRetries = 0;

  /** @type {number} Total successful retries */
  #successfulRetries = 0;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxRetries=3] — maximum retry attempts
   * @param {string[]} [opts.strategies] — available strategy names
   * @param {number} [opts.baseDelayMs=1000] — base delay between retries
   * @param {number} [opts.maxDelayMs=60000] — max delay cap
   * @param {number} [opts.jitterRatio=0.25] — jitter as fraction of delay
   */
  constructor(opts = {}) {
    this.#maxRetries = opts.maxRetries ?? 3;
    this.#strategies = opts.strategies ?? ['exponential', 'linear', 'fibonacci'];
    this.#baseDelayMs = opts.baseDelayMs ?? 1000;
    this.#maxDelayMs = opts.maxDelayMs ?? 60000;
    this.#jitterRatio = opts.jitterRatio ?? 0.25;
  }

  // ── Execute with Retry ──────────────────────────────────────────────────

  /**
   * Execute a function with intelligent retry.
   *
   * Selects the best strategy based on the error type, generates appropriate
   * backoff delays with jitter, and applies input degradation on repeated
   * failures.
   *
   * @param {Function} fn — async function to execute. Receives (attempt, degradedInput)
   * @param {object} [context]
   * @param {string} [context.errorType] — hint for strategy selection
   * @param {string} [context.taskType] — task type for tracking
   * @param {number} [context.priority] — task priority (higher = faster retry)
   * @param {object} [context.input] — original input for degradation
   * @param {number} [context.retryAfterMs] — server-suggested retry delay
   * @returns {Promise<{ result: any, attempts: number, strategy: string,
   *   totalDelay: number, degraded: boolean, errors: Array }>}
   */
  async execute(fn, context = {}) {
    const maxAttempts = this.#maxRetries + 1; // +1 for the initial attempt
    const taskType = context.taskType ?? 'unknown';
    const priorityMultiplier = context.priority ? Math.max(0.1, 1 - (context.priority / 10)) : 1;

    let lastError = null;
    let strategy = 'exponential';
    let totalDelay = 0;
    let degraded = false;
    const errors = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Determine input for this attempt (may be degraded)
        const input = context.input
          ? _degradeInput(context.input, attempt, classifyError(lastError))
          : undefined;

        if (attempt > 0 && input !== context.input) {
          degraded = true;
        }

        // Execute the function
        const result = await fn(attempt, input);

        // Record successful outcome
        if (attempt > 0) {
          this.#totalRetries++;
          this.#successfulRetries++;
          this.#recordOutcome(classifyError(lastError), strategy, attempt, true);
        }

        return {
          result,
          attempts: attempt + 1,
          strategy,
          totalDelay,
          degraded,
          errors,
        };
      } catch (err) {
        lastError = err;
        const errorType = context.errorType ?? classifyError(err);
        strategy = _selectStrategy(errorType, this.#outcomes, this.#strategies);

        errors.push({
          attempt: attempt + 1,
          error: err.message || String(err),
          errorType,
          strategy,
          timestamp: Date.now(),
        });

        // Don't delay after the last attempt
        if (attempt >= maxAttempts - 1) break;

        // Calculate delay
        let delay;
        if (context.retryAfterMs && attempt === 0 && errorType === 'rate_limit') {
          // Honor server-suggested retry-after for rate limits
          delay = context.retryAfterMs;
        } else {
          const delays = this.#generateDelays(strategy, maxAttempts - 1);
          delay = delays[attempt] ?? this.#baseDelayMs;
        }

        // Apply priority multiplier
        delay = Math.round(delay * priorityMultiplier);

        // Cap at max delay
        delay = Math.min(delay, this.#maxDelayMs);

        totalDelay += delay;

        // Wait before retry
        await this.#sleep(delay);
      }
    }

    // All attempts failed
    this.#totalRetries++;
    this.#recordOutcome(classifyError(lastError), strategy, maxAttempts, false);

    throw lastError;
  }

  // ── Delay Generation ────────────────────────────────────────────────────

  /**
   * Generate backoff delay sequence for a given strategy.
   *
   * @param {string} strategy — 'exponential', 'linear', or 'fibonacci'
   * @param {number} maxRetries — number of retries to generate delays for
   * @returns {number[]} — array of delays in ms
   * @private
   */
  #generateDelays(strategy, maxRetries) {
    const delays = [];
    const jitterRange = this.#baseDelayMs * this.#jitterRatio;

    for (let i = 0; i < maxRetries; i++) {
      let baseDelay;

      switch (strategy) {
        case 'exponential':
          // base * 2^attempt
          baseDelay = this.#baseDelayMs * Math.pow(2, i);
          break;

        case 'linear':
          // base * (attempt + 1)
          baseDelay = this.#baseDelayMs * (i + 1);
          break;

        case 'fibonacci':
          // base * fib(attempt + 1)
          baseDelay = this.#baseDelayMs * fibonacci(i + 1);
          break;

        default:
          baseDelay = this.#baseDelayMs * Math.pow(2, i);
      }

      // Add jitter (random between -jitterRange and +jitterRange)
      const jitter = (Math.random() * 2 - 1) * jitterRange;
      const finalDelay = Math.max(0, Math.round(baseDelay + jitter));

      // Cap at max delay
      delays.push(Math.min(finalDelay, this.#maxDelayMs));
    }

    return delays;
  }

  // ── Sleep ───────────────────────────────────────────────────────────────

  /**
   * Async sleep.
   * @param {number} ms
   * @returns {Promise<void>}
   * @private
   */
  #sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Outcome Tracking ────────────────────────────────────────────────────

  /**
   * Record a retry outcome for strategy tuning.
   *
   * @param {string} errorType — classified error type
   * @param {string} strategy — strategy used
   * @param {number} attempts — total attempts before success/failure
   * @param {boolean} succeeded — whether the operation eventually succeeded
   */
  recordOutcome(errorType, strategy, attempts, succeeded) {
    this.#recordOutcome(errorType, strategy, attempts, succeeded);
  }

  /**
   * Internal outcome recording.
   * @private
   */
  #recordOutcome(errorType, strategy, attempts, succeeded) {
    if (!this.#outcomes.has(errorType)) {
      this.#outcomes.set(errorType, []);
    }
    this.#outcomes.get(errorType).push({
      strategy,
      attempts,
      succeeded,
      timestamp: Date.now(),
    });

    // Keep only last 200 outcomes per error type
    const outcomes = this.#outcomes.get(errorType);
    if (outcomes.length > 200) {
      outcomes.splice(0, outcomes.length - 200);
    }
  }

  // ── Strategy Stats ──────────────────────────────────────────────────────

  /**
   * Get strategy effectiveness statistics.
   *
   * @returns {Map<string, { bestStrategy: string, strategies: object,
   *   avgAttempts: number, successRate: number, totalAttempts: number }>}
   */
  getStrategyStats() {
    return _getStrategyStats(this.#outcomes);
  }

  // ── Status ──────────────────────────────────────────────────────────────

  /**
   * Get current EnhancedRetry status summary.
   *
   * @returns {{ totalRetries: number, successRate: number, avgAttempts: number,
   *   maxRetries: number, baseDelayMs: number, maxDelayMs: number,
   *   jitterRatio: number, strategies: string[],
   *   trackedErrorTypes: string[] }}
   */
  getStatus() {
    const totalOps = this.#totalRetries;
    const successRate = totalOps > 0 ? this.#successfulRetries / totalOps : 0;

    // Compute average attempts across all outcomes
    let totalAttemptsSum = 0;
    let totalOutcomeCount = 0;
    for (const outcomes of this.#outcomes.values()) {
      for (const o of outcomes) {
        totalAttemptsSum += o.attempts;
        totalOutcomeCount++;
      }
    }

    return {
      totalRetries: totalOps,
      successfulRetries: this.#successfulRetries,
      successRate: +successRate.toFixed(3),
      avgAttempts: totalOutcomeCount > 0 ? +(totalAttemptsSum / totalOutcomeCount).toFixed(2) : 0,
      maxRetries: this.#maxRetries,
      baseDelayMs: this.#baseDelayMs,
      maxDelayMs: this.#maxDelayMs,
      jitterRatio: this.#jitterRatio,
      strategies: [...this.#strategies],
      trackedErrorTypes: [...this.#outcomes.keys()],
    };
  }
}
