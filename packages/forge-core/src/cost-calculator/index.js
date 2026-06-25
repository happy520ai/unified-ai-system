/**
 * Cost Calculator — pre-flight cost estimation and cross-model comparison.
 *
 * While the BudgetTracker (src/budget-tracker/index.js) records actual usage
 * after the fact, the CostCalculator answers "what will this cost?" *before*
 * a request is sent. It maintains a registry of model pricing and exposes
 * helpers for:
 *
 *   - Estimating the cost of a single call (estimateCost)
 *   - Estimating the cost of a high-level task with confidence ranges (estimateTaskCost)
 *   - Comparing costs across all registered models (compareModels)
 *   - Finding the cheapest model for a given task type (getCheapestModel)
 *
 * All pricing is stored per 1 000 000 tokens (the industry-standard rate card
 * format) and converted internally for per-token arithmetic.
 *
 * Usage:
 *   const calc = new CostCalculator();
 *   const est  = calc.estimateCost({ model: 'mimo-v2.5-pro', inputTokens: 5000, outputTokens: 2000 });
 *   console.log(est.totalCost);            // 0.0027 (USD)
 *   console.log(CostCalculator.formatCost(est.totalCost)); // "$0.0027"
 */

// ── Type definitions ──────────────────────────────────────────────────────

/**
 * @typedef {object} ModelPricing
 * @property {number} input  — cost per 1 000 000 input tokens (USD)
 * @property {number} output — cost per 1 000 000 output tokens (USD)
 */

/**
 * @typedef {object} CostEstimate
 * @property {number} inputCost  — cost of the input tokens (USD)
 * @property {number} outputCost — cost of the output tokens (USD)
 * @property {number} totalCost  — inputCost + outputCost (USD)
 * @property {string} model      — model identifier used for the estimate
 */

/**
 * @typedef {object} TaskCostEstimate
 * @property {string} taskType      — task type identifier
 * @property {string} model         — model identifier used
 * @property {CostEstimate} estimate        — point estimate (1.0x multiplier)
 * @property {CostEstimate} low             — optimistic estimate (0.7x multiplier)
 * @property {CostEstimate} high            — pessimistic estimate (1.5x multiplier)
 * @property {{ inputTokens: number, outputTokens: number }} tokenEstimate — token counts used
 */

/**
 * @typedef {object} ModelComparison
 * @property {string} model     — model identifier
 * @property {number} totalCost — estimated total cost (USD)
 * @property {number} rank      — 1-based rank (1 = cheapest)
 */

// ── Constants ─────────────────────────────────────────────────────────────

/** Number of tokens that pricing rates are quoted against (1 million). */
const PER_MILLION = 1_000_000;

/**
 * Default model pricing registry (per 1M tokens in USD).
 * @type {Record<string, ModelPricing>}
 */
const DEFAULT_PRICING = {
  'mimo-v2.5-pro':                        { input: 0.30, output: 0.60 },
  'nvidia/llama-3.3-nemotron-super-49b-v1': { input: 0.20, output: 0.40 },
  'deepseek-v3':                          { input: 0.27, output: 1.10 },
  'qwen-2.5-72b':                         { input: 0.35, output: 0.70 },
  'default':                              { input: 1.00, output: 2.00 },
};

/**
 * Typical token-count heuristics per task type.
 * Used by estimateTaskCost when caller does not supply explicit token counts.
 * @type {Record<string, { inputTokens: number, outputTokens: number }>}
 */
const TASK_HEURISTICS = {
  implement: { inputTokens: 15000, outputTokens: 8000 },
  test:      { inputTokens: 10000, outputTokens: 4000 },
  refactor:  { inputTokens: 20000, outputTokens: 10000 },
  debug:     { inputTokens: 12000, outputTokens: 3000 },
  explore:   { inputTokens: 8000,  outputTokens: 2000 },
  review:    { inputTokens: 10000, outputTokens: 3000 },
};

/** Fallback heuristic when task type is unrecognised. */
const DEFAULT_HEURISTIC = { inputTokens: 10000, outputTokens: 5000 };

/**
 * Confidence-range multipliers applied to the point estimate.
 * @type {{ low: number, medium: number, high: number }}
 */
const CONFIDENCE_MULTIPLIERS = { low: 0.7, medium: 1.0, high: 1.5 };

// ── CostCalculator class ──────────────────────────────────────────────────

export class CostCalculator {
  /** @type {Record<string, ModelPricing>} */
  #pricing;

  /**
   * Create a new CostCalculator.
   *
   * @param {Record<string, ModelPricing>} [customPricing] — optional overrides
   *   merged on top of the built-in defaults. Keys are model identifiers;
   *   values are `{ input, output }` per 1M tokens in USD.
   */
  constructor(customPricing) {
    this.#pricing = { ...DEFAULT_PRICING };

    if (customPricing && typeof customPricing === 'object') {
      for (const [name, rates] of Object.entries(customPricing)) {
        this.#pricing[name] = { input: rates.input, output: rates.output };
      }
    }
  }

  // ── Estimation ────────────────────────────────────────────────────────

  /**
   * Estimate the cost of a single LLM call.
   *
   * Falls back to the `'default'` pricing entry when the requested model is
   * not registered.
   *
   * @param {object} params
   * @param {string} params.model       — model identifier
   * @param {number} params.inputTokens — expected number of input tokens
   * @param {number} params.outputTokens — expected number of output tokens
   * @returns {CostEstimate}
   */
  estimateCost({ model, inputTokens, outputTokens }) {
    const rates = this.#pricing[model] ?? this.#pricing['default'];

    const inputCost  = (inputTokens  / PER_MILLION) * rates.input;
    const outputCost = (outputTokens / PER_MILLION) * rates.output;
    const totalCost  = inputCost + outputCost;

    return { inputCost, outputCost, totalCost, model };
  }

  /**
   * Estimate the cost of a high-level task, including a confidence range.
   *
   * If `estimatedInputTokens` / `estimatedOutputTokens` are omitted the
   * calculator uses built-in heuristics for the given `taskType`.
   *
   * The confidence range is derived from fixed multipliers:
   *   - low  = 0.7x (optimistic)
   *   - estimate = 1.0x (point estimate)
   *   - high = 1.5x (pessimistic)
   *
   * @param {object} params
   * @param {string}  params.taskType — one of: implement, test, refactor,
   *   debug, explore, review (unrecognised types use a generic default)
   * @param {number}  [params.estimatedInputTokens]  — override heuristic
   * @param {number}  [params.estimatedOutputTokens] — override heuristic
   * @param {string}  [params.model='default']       — model identifier
   * @returns {TaskCostEstimate}
   */
  estimateTaskCost({ taskType, estimatedInputTokens, estimatedOutputTokens, model = 'default' }) {
    const heuristic = TASK_HEURISTICS[taskType] ?? DEFAULT_HEURISTIC;

    const inputTokens  = estimatedInputTokens  ?? heuristic.inputTokens;
    const outputTokens = estimatedOutputTokens ?? heuristic.outputTokens;

    const buildEstimate = (multiplier) => {
      return this.estimateCost({
        model,
        inputTokens:  Math.round(inputTokens  * multiplier),
        outputTokens: Math.round(outputTokens * multiplier),
      });
    };

    return {
      taskType,
      model,
      tokenEstimate: { inputTokens, outputTokens },
      estimate: buildEstimate(CONFIDENCE_MULTIPLIERS.medium),
      low:      buildEstimate(CONFIDENCE_MULTIPLIERS.low),
      high:     buildEstimate(CONFIDENCE_MULTIPLIERS.high),
    };
  }

  // ── Comparison ────────────────────────────────────────────────────────

  /**
   * Compare estimated costs across all registered models for a given token
   * profile.  Results are sorted cheapest-first and include a 1-based rank.
   *
   * The `'default'` fallback entry is excluded from comparisons because it is
   * not a real model.
   *
   * @param {object} params
   * @param {number} params.inputTokens  — expected input tokens
   * @param {number} params.outputTokens — expected output tokens
   * @returns {ModelComparison[]}
   */
  compareModels({ inputTokens, outputTokens }) {
    const results = [];

    for (const model of Object.keys(this.#pricing)) {
      if (model === 'default') continue;

      const { totalCost } = this.estimateCost({ model, inputTokens, outputTokens });
      results.push({ model, totalCost });
    }

    // Sort ascending by cost (cheapest first).
    results.sort((a, b) => a.totalCost - b.totalCost);

    // Assign 1-based rank.
    return results.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  }

  /**
   * Return the name of the cheapest model for a given task type.
   *
   * Uses the task-type heuristics to derive typical token ratios, then
   * picks the registered model (excluding `'default'`) with the lowest
   * estimated total cost.
   *
   * @param {string} [taskType] — optional task type for heuristic token counts
   * @returns {string} — model identifier with the lowest cost
   */
  getCheapestModel(taskType) {
    const heuristic = TASK_HEURISTICS[taskType] ?? DEFAULT_HEURISTIC;
    const comparison = this.compareModels(heuristic);

    if (comparison.length === 0) {
      return 'default';
    }

    return comparison[0].model;
  }

  // ── Registry management ───────────────────────────────────────────────

  /**
   * Register (or update) pricing for a model.
   *
   * @param {string} name   — model identifier
   * @param {ModelPricing} pricing — `{ input, output }` per 1M tokens in USD
   */
  addModel(name, pricing) {
    this.#pricing[name] = { input: pricing.input, output: pricing.output };
  }

  /**
   * Remove a model from the registry.
   *
   * The built-in `'default'` entry cannot be removed; attempts to do so are
   * silently ignored.
   *
   * @param {string} name — model identifier to remove
   * @returns {boolean} — true if the model existed and was removed
   */
  removeModel(name) {
    if (name === 'default') return false;
    if (!(name in this.#pricing)) return false;

    delete this.#pricing[name];
    return true;
  }

  /**
   * Return the names of all registered models (including `'default'`).
   *
   * @returns {string[]}
   */
  getModels() {
    return Object.keys(this.#pricing);
  }

  /**
   * Return the raw pricing entry for a model (per 1M tokens in USD).
   *
   * Falls back to the `'default'` entry if the model is not found.
   *
   * @param {string} model — model identifier
   * @returns {ModelPricing & { model: string, isFallback?: boolean }}
   */
  getPricing(model) {
    if (model in this.#pricing) {
      return { ...this.#pricing[model], model };
    }

    return { ...this.#pricing['default'], model, isFallback: true };
  }

  // ── Static helpers ────────────────────────────────────────────────────

  /**
   * Format a USD cost value as a human-readable string.
   *
   * - Costs below $0.01 are shown with four decimal places (e.g. "$0.0012").
   * - Costs of $0.01 or more are shown with two decimal places (e.g. "$1.23").
   * - Zero is rendered as "$0.00".
   *
   * @param {number} costUsd — cost in US dollars
   * @returns {string} — formatted string such as "$0.0012" or "$1.23"
   */
  static formatCost(costUsd) {
    if (costUsd === 0) return '$0.00';

    if (Math.abs(costUsd) < 0.01) {
      return `$${costUsd.toFixed(4)}`;
    }

    return `$${costUsd.toFixed(2)}`;
  }
}
