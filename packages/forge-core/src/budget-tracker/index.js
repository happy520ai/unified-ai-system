/**
 * Budget Tracker — monitors token usage and cost across an entire goal execution.
 *
 * Tracks three budget dimensions:
 *   1. Token usage (input + output tokens across all LLM calls)
 *   2. Cost incurred (based on per-model pricing)
 *   3. Elapsed wall-clock time
 *
 * Usage:
 *   const tracker = new BudgetTracker({ maxTokens: 500000, maxCost: 10.0, maxMinutes: 120 });
 *   tracker.recordUsage({ model: 'mimo-v2.5-pro', inputTokens: 1200, outputTokens: 800 });
 *   const status = tracker.checkBudget();
 *   if (!status.withinBudget) { console.warn(status.warnings); }
 */

/**
 * @typedef {object} BudgetLimits
 * @property {number} maxTokens — maximum total tokens (input + output)
 * @property {number} maxCost — maximum cost in USD
 * @property {number} maxMinutes — maximum wall-clock minutes
 */

/**
 * @typedef {object} UsageRecord
 * @property {number} tokensUsed — cumulative tokens consumed
 * @property {number} costIncurred — cumulative cost in USD
 * @property {number} startTime — epoch ms when tracking began
 */

/**
 * @typedef {object} CostRates
 * @property {number} input — cost per single input token
 * @property {number} output — cost per single output token
 */

/**
 * @typedef {object} BudgetCheckResult
 * @property {boolean} withinBudget — true if all dimensions are under limit
 * @property {string[]} warnings — human-readable warnings for approaching limits
 * @property {object} usage — current usage snapshot
 * @property {number} usage.tokensUsed
 * @property {number} usage.costIncurred
 * @property {number} usage.minutesElapsed
 * @property {object} usage.percentUsed — percentage of each budget dimension consumed
 * @property {number} usage.percentUsed.tokens
 * @property {number} usage.percentUsed.cost
 * @property {number} usage.percentUsed.time
 */

/** Warning threshold: emit a warning when usage exceeds this fraction of the budget. */
const WARNING_THRESHOLD = 0.8;

/** Critical threshold: usage above this fraction is flagged as critical. */
const CRITICAL_THRESHOLD = 0.95;

export class BudgetTracker {
  /** @type {BudgetLimits} */
  #budget;

  /** @type {UsageRecord} */
  #usage;

  /** @type {Record<string, CostRates>} */
  #costPerToken;

  /** @type {Array<{ timestamp: number, model: string, inputTokens: number, outputTokens: number, cost: number }>} */
  #history;

  /**
   * @param {Partial<BudgetLimits>} [budget={}] — budget limits (all optional, defaults applied)
   */
  constructor(budget = {}) {
    this.#budget = {
      maxTokens: budget.maxTokens ?? 500_000,
      maxCost: budget.maxCost ?? 10.0,
      maxMinutes: budget.maxMinutes ?? 120,
    };

    this.#usage = {
      tokensUsed: 0,
      costIncurred: 0,
      startTime: Date.now(),
    };

    /** Default cost rates per 1K tokens by model (input / output in USD). */
    this.#costPerToken = {
      'mimo-v2.5-pro': {
        input: 0.0003 / 1000,
        output: 0.0006 / 1000,
      },
      'nvidia/llama-3.3-nemotron-super-49b-v1': {
        input: 0.0002 / 1000,
        output: 0.0004 / 1000,
      },
      'default': {
        input: 0.001 / 1000,
        output: 0.002 / 1000,
      },
    };

    /** Detailed per-call history for auditing. */
    this.#history = [];
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Record token usage from an LLM call.
   *
   * @param {object} params
   * @param {string} params.model — model identifier (used to look up cost rates)
   * @param {number} params.inputTokens — number of prompt / input tokens
   * @param {number} params.outputTokens — number of completion / output tokens
   * @returns {{ tokensAdded: number, costAdded: number }} — what was recorded
   */
  recordUsage({ model, inputTokens = 0, outputTokens = 0 }) {
    const rates = this.#costPerToken[model] ?? this.#costPerToken['default'];

    const cost = (inputTokens * rates.input) + (outputTokens * rates.output);
    const totalTokens = inputTokens + outputTokens;

    this.#usage.tokensUsed += totalTokens;
    this.#usage.costIncurred += cost;

    this.#history.push({
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      cost,
    });

    return { tokensAdded: totalTokens, costAdded: cost };
  }

  /**
   * Check whether usage is within budget, with warnings for approaching limits.
   *
   * @returns {BudgetCheckResult}
   */
  checkBudget() {
    const minutesElapsed = (Date.now() - this.#usage.startTime) / 60_000;

    const tokenPct = this.#usage.tokensUsed / this.#budget.maxTokens;
    const costPct = this.#usage.costIncurred / this.#budget.maxCost;
    const timePct = minutesElapsed / this.#budget.maxMinutes;

    const warnings = [];

    // Token warnings
    if (tokenPct >= 1) {
      warnings.push(`BUDGET EXCEEDED: Token limit reached (${this.#usage.tokensUsed}/${this.#budget.maxTokens}).`);
    } else if (tokenPct >= CRITICAL_THRESHOLD) {
      warnings.push(`CRITICAL: Token usage at ${(tokenPct * 100).toFixed(1)}% (${this.#usage.tokensUsed}/${this.#budget.maxTokens}).`);
    } else if (tokenPct >= WARNING_THRESHOLD) {
      warnings.push(`WARNING: Token usage at ${(tokenPct * 100).toFixed(1)}% (${this.#usage.tokensUsed}/${this.#budget.maxTokens}).`);
    }

    // Cost warnings
    if (costPct >= 1) {
      warnings.push(`BUDGET EXCEEDED: Cost limit reached ($${this.#usage.costIncurred.toFixed(4)}/$${this.#budget.maxCost}).`);
    } else if (costPct >= CRITICAL_THRESHOLD) {
      warnings.push(`CRITICAL: Cost at ${(costPct * 100).toFixed(1)}% ($${this.#usage.costIncurred.toFixed(4)}/$${this.#budget.maxCost}).`);
    } else if (costPct >= WARNING_THRESHOLD) {
      warnings.push(`WARNING: Cost at ${(costPct * 100).toFixed(1)}% ($${this.#usage.costIncurred.toFixed(4)}/$${this.#budget.maxCost}).`);
    }

    // Time warnings
    if (timePct >= 1) {
      warnings.push(`BUDGET EXCEEDED: Time limit reached (${minutesElapsed.toFixed(1)}/${this.#budget.maxMinutes} minutes).`);
    } else if (timePct >= CRITICAL_THRESHOLD) {
      warnings.push(`CRITICAL: Time at ${(timePct * 100).toFixed(1)}% (${minutesElapsed.toFixed(1)}/${this.#budget.maxMinutes} minutes).`);
    } else if (timePct >= WARNING_THRESHOLD) {
      warnings.push(`WARNING: Time at ${(timePct * 100).toFixed(1)}% (${minutesElapsed.toFixed(1)}/${this.#budget.maxMinutes} minutes).`);
    }

    const withinBudget = tokenPct < 1 && costPct < 1 && timePct < 1;

    return {
      withinBudget,
      warnings,
      usage: {
        tokensUsed: this.#usage.tokensUsed,
        costIncurred: this.#usage.costIncurred,
        minutesElapsed: Math.round(minutesElapsed * 100) / 100,
        percentUsed: {
          tokens: Math.round(tokenPct * 10000) / 100,
          cost: Math.round(costPct * 10000) / 100,
          time: Math.round(timePct * 10000) / 100,
        },
      },
    };
  }

  /**
   * Get a lightweight status snapshot suitable for logging or display.
   *
   * @returns {{ tokensUsed: number, costIncurred: string, minutesElapsed: string, budget: BudgetLimits, callCount: number }}
   */
  getStatus() {
    const minutesElapsed = (Date.now() - this.#usage.startTime) / 60_000;

    return {
      tokensUsed: this.#usage.tokensUsed,
      costIncurred: this.#usage.costIncurred,
      minutesElapsed: parseFloat(minutesElapsed.toFixed(1)),
      budget: { ...this.#budget },
      callCount: this.#history.length,
    };
  }

  /**
   * Estimate remaining capacity in each budget dimension.
   *
   * @returns {{ tokensRemaining: number, costRemaining: number, minutesRemaining: number, canContinue: boolean }}
   */
  estimateRemaining() {
    const minutesElapsed = (Date.now() - this.#usage.startTime) / 60_000;

    const tokensRemaining = Math.max(0, this.#budget.maxTokens - this.#usage.tokensUsed);
    const costRemaining = Math.max(0, this.#budget.maxCost - this.#usage.costIncurred);
    const minutesRemaining = Math.max(0, this.#budget.maxMinutes - minutesElapsed);

    return {
      tokensRemaining,
      costRemaining: Math.round(costRemaining * 10000) / 10000,
      minutesRemaining: Math.round(minutesRemaining * 100) / 100,
      canContinue: tokensRemaining > 0 && costRemaining > 0 && minutesRemaining > 0,
    };
  }

  /**
   * Register custom cost rates for a model (or override existing ones).
   *
   * @param {string} model — model identifier
   * @param {CostRates} rates — { input, output } cost per single token
   */
  setCostRate(model, rates) {
    this.#costPerToken[model] = {
      input: rates.input,
      output: rates.output,
    };
  }

  /**
   * Get the full per-call history for auditing or export.
   *
   * @returns {Array<{ timestamp: number, model: string, inputTokens: number, outputTokens: number, cost: number }>}
   */
  getHistory() {
    return [...this.#history];
  }

  /**
   * Reset all counters (e.g. for a new goal).
   */
  reset() {
    this.#usage = {
      tokensUsed: 0,
      costIncurred: 0,
      startTime: Date.now(),
    };
    this.#history = [];
  }
}
