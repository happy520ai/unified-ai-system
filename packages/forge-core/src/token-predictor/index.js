/**
 * Token Predictor — estimates token usage before making LLM calls.
 *
 * Uses language-aware heuristics to approximate token counts without calling
 * a tokenizer API:
 *   - English text: ~4 characters per token
 *   - Source code:  ~2.5 characters per token (denser punctuation)
 *   - CJK text:     ~1 character per 1.5 tokens
 *
 * Also predicts output token counts based on historical averages per task
 * type, checks budget feasibility, and tracks prediction accuracy over a
 * rolling window.
 *
 * Usage:
 *   import { TokenPredictor } from './token-predictor/index.js';
 *
 *   const predictor = new TokenPredictor({ modelContextWindow: 128000 });
 *   const inputTokens = predictor.estimateTokens(promptText);
 *   const output = predictor.predictOutputTokens('implement', inputTokens);
 *   const check = predictor.wouldExceedBudget(inputTokens, output.predicted, budget);
 */

// ── Type definitions ──────────────────────────────────────────────────────

/**
 * @typedef {object} OutputPrediction
 * @property {number} predicted  — best-estimate output token count
 * @property {number} min        — lower bound estimate
 * @property {number} max        — upper bound estimate
 * @property {number} confidence — 0-1 confidence score based on sample size
 */

/**
 * @typedef {object} BudgetCheck
 * @property {boolean} exceeds        — true if projected usage exceeds budget
 * @property {number}  projectedCost  — estimated total cost in USD
 * @property {number}  projectedTokens — estimated total tokens (input + output)
 * @property {number}  remaining      — remaining tokens in budget
 */

/**
 * @typedef {object} Budget
 * @property {number} maxTokens         — maximum total tokens
 * @property {number} maxCost           — maximum cost in USD
 * @property {number} costPerInputToken — cost per input token
 * @property {number} costPerOutputToken — cost per output token
 */

/**
 * @typedef {object} AccuracyStats
 * @property {number} mape        — mean absolute percentage error
 * @property {number} predictions — total predictions recorded
 * @property {Record<string, { mape: number, count: number }>} accuracyByTaskType
 */

/**
 * @typedef {object} PromptSizeSuggestion
 * @property {number} maxInputTokens  — maximum input tokens for the budget
 * @property {number} maxOutputTokens — predicted output tokens
 * @property {number} estimatedCost   — estimated total cost
 */

/**
 * @typedef {object} UsageRecord
 * @property {string} taskType
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} timestamp
 */

// ── Constants ─────────────────────────────────────────────────────────────

/** Average characters per token for English prose. */
const CHARS_PER_TOKEN_ENGLISH = 4;

/** Average characters per token for source code (more punctuation). */
const CHARS_PER_TOKEN_CODE = 2.5;

/** Token multiplier for CJK characters (1 char ≈ 1.5 tokens). */
const CJK_TOKEN_MULTIPLIER = 1.5;

/** CJK Unicode range regex. */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}\u{2a700}-\u{2b73f}\u{2b740}-\u{2b81f}\u{2b820}-\u{2ceaf}\u{2ceb0}-\u{2ebef}\u{30000}-\u{3134f}\u3041-\u3096\u30a0-\u30ff\uac00-\ud7af]/gu;

/** Code-detection regex (common programming tokens). */
const CODE_REGEX = /[{}();=<>+\-*/&|^~%!@#$[\]?:]|\b(function|const|let|var|import|export|return|class|if|else|for|while|def|async|await)\b/g;

/** Default historical averages for output tokens by task type. */
const DEFAULT_TASK_AVERAGES = {
  explore: { avgOutput: 800, ratio: 0.6 },
  implement: { avgOutput: 2500, ratio: 1.2 },
  test: { avgOutput: 2000, ratio: 1.0 },
  verify: { avgOutput: 600, ratio: 0.4 },
  review: { avgOutput: 1500, ratio: 0.8 },
  refactor: { avgOutput: 1800, ratio: 0.9 },
  document: { avgOutput: 1200, ratio: 0.7 },
  debug: { avgOutput: 1000, ratio: 0.5 },
};

/** Minimum confidence when no history exists. */
const MIN_CONFIDENCE = 0.3;

/** Maximum confidence with sufficient history. */
const MAX_CONFIDENCE = 0.95;

// ── TokenPredictor class ──────────────────────────────────────────────────

export class TokenPredictor {
  /** @type {number} */ #historyWindow;
  /** @type {number} */ #modelContextWindow;

  /** @type {UsageRecord[]} */ #history = [];

  /** @type {Record<string, { totalInput: number, totalOutput: number, count: number }>} */
  #taskStats = {};

  /** @type {{ predicted: number, actual: number, taskType: string }[]} */
  #predictionLog = [];

  /** @type {number} */ #predictionCount = 0;

  /**
   * Create a new token predictor.
   *
   * @param {object} [opts]
   * @param {number} [opts.historyWindow=100]        — rolling window for accuracy tracking
   * @param {number} [opts.modelContextWindow=128000] — model's maximum context size
   */
  constructor(opts = {}) {
    this.#historyWindow = opts.historyWindow ?? 100;
    this.#modelContextWindow = opts.modelContextWindow ?? 128_000;
  }

  // ── Public API: estimateTokens ────────────────────────────────────────

  /**
   * Estimate the number of tokens in a text string without calling an API.
   *
   * Uses language-aware heuristics:
   *   - English text: ~4 chars per token
   *   - Code:         ~2.5 chars per token
   *   - CJK:          1 char per ~1.5 tokens
   *
   * @param {string} text — input text to estimate
   * @returns {number} — estimated token count (always >= 1 for non-empty text)
   */
  estimateTokens(text) {
    if (!text || text.length === 0) return 0;

    // Count CJK characters.
    const cjkMatches = text.match(CJK_REGEX);
    const cjkCount = cjkMatches ? cjkMatches.length : 0;
    const cjkTokens = Math.ceil(cjkCount * CJK_TOKEN_MULTIPLIER);

    // Remaining non-CJK text.
    const nonCjkLength = text.length - cjkCount;
    if (nonCjkLength <= 0) return Math.max(1, cjkTokens);

    // Detect whether the text is predominantly code.
    const codeMatches = text.match(CODE_REGEX);
    const codeDensity = codeMatches ? codeMatches.length / Math.max(1, nonCjkLength / 20) : 0;

    // Blend between English and code rates based on code density.
    const charsPerToken =
      codeDensity > 0.5
        ? CHARS_PER_TOKEN_CODE
        : CHARS_PER_TOKEN_ENGLISH - (CHARS_PER_TOKEN_ENGLISH - CHARS_PER_TOKEN_CODE) * Math.min(1, codeDensity);

    const nonCjkTokens = Math.ceil(nonCjkLength / charsPerToken);

    return Math.max(1, cjkTokens + nonCjkTokens);
  }

  // ── Public API: predictOutputTokens ───────────────────────────────────

  /**
   * Predict the number of output tokens based on task type and input size.
   *
   * Uses historical averages when available, falling back to built-in
   * defaults.  The prediction is adjusted by the input-to-output ratio:
   * larger inputs tend to produce proportionally larger outputs.
   *
   * @param {string} taskType    — one of: explore, implement, test, verify, review, refactor, document, debug
   * @param {number} inputTokens — estimated input token count
   * @returns {OutputPrediction}
   */
  predictOutputTokens(taskType, inputTokens) {
    const stats = this.#taskStats[taskType];
    const defaults = DEFAULT_TASK_AVERAGES[taskType] ?? DEFAULT_TASK_AVERAGES.explore;

    let baseOutput;
    let confidence;

    if (stats && stats.count >= 3) {
      // Use historical average when we have enough data.
      baseOutput = Math.round(stats.totalOutput / stats.count);
      confidence = Math.min(MAX_CONFIDENCE, MIN_CONFIDENCE + stats.count * 0.05);
    } else {
      baseOutput = defaults.avgOutput;
      confidence = MIN_CONFIDENCE;
    }

    // Adjust by input token ratio: more input → typically more output.
    const ratioMultiplier = defaults.ratio > 0
      ? 1 + (inputTokens / 4000) * (defaults.ratio - 1)
      : 1;
    const adjusted = Math.round(baseOutput * Math.max(0.5, ratioMultiplier));

    // Confidence bounds: min is 40% of predicted, max is 180%.
    const min = Math.round(adjusted * 0.4);
    const max = Math.round(adjusted * 1.8);

    return { predicted: adjusted, min, max, confidence };
  }

  // ── Public API: wouldExceedBudget ─────────────────────────────────────

  /**
   * Check whether a projected LLM call would exceed the given budget.
   *
   * @param {number} inputTokens    — estimated input tokens
   * @param {number} predictedOutput — predicted output tokens
   * @param {Budget} budget
   * @returns {BudgetCheck}
   */
  wouldExceedBudget(inputTokens, predictedOutput, budget) {
    const totalTokens = inputTokens + predictedOutput;
    const inputCost = inputTokens * (budget.costPerInputToken ?? 0);
    const outputCost = predictedOutput * (budget.costPerOutputToken ?? 0);
    const projectedCost = inputCost + outputCost;

    const exceedsTokens = budget.maxTokens != null && totalTokens > budget.maxTokens;
    const exceedsCost = budget.maxCost != null && projectedCost > budget.maxCost;
    const exceedsContext = totalTokens > this.#modelContextWindow;

    const remaining = budget.maxTokens != null
      ? Math.max(0, budget.maxTokens - totalTokens)
      : Infinity;

    return {
      exceeds: exceedsTokens || exceedsCost || exceedsContext,
      projectedCost: Math.round(projectedCost * 1_000_000) / 1_000_000,
      projectedTokens: totalTokens,
      remaining,
    };
  }

  // ── Public API: recordUsage ───────────────────────────────────────────

  /**
   * Record actual usage data for calibration and accuracy tracking.
   *
   * @param {string} taskType     — task type label
   * @param {number} inputTokens  — actual input tokens consumed
   * @param {number} outputTokens — actual output tokens consumed
   */
  recordUsage(taskType, inputTokens, outputTokens) {
    const record = {
      taskType,
      inputTokens,
      outputTokens,
      timestamp: Date.now(),
    };

    this.#history.push(record);

    // Trim to history window.
    if (this.#history.length > this.#historyWindow) {
      this.#history = this.#history.slice(-this.#historyWindow);
    }

    // Update per-task rolling stats.
    if (!this.#taskStats[taskType]) {
      this.#taskStats[taskType] = { totalInput: 0, totalOutput: 0, count: 0 };
    }
    const stats = this.#taskStats[taskType];
    stats.totalInput += inputTokens;
    stats.totalOutput += outputTokens;
    stats.count++;
  }

  // ── Public API: recordActual ──────────────────────────────────────────

  /**
   * Record actual usage from an LLM response. Convenience wrapper around
   * recordUsage() that accepts the object shape used by llm-client.js.
   *
   * @param {object} usage
   * @param {number} [usage.inputTokens=0]
   * @param {number} [usage.outputTokens=0]
   * @param {number} [usage.totalTokens=0]
   * @param {string} [usage.model]
   * @param {string} [usage.taskType='general']
   */
  recordActual({ inputTokens = 0, outputTokens = 0, totalTokens = 0, model, taskType = 'general' } = {}) {
    const inp = inputTokens || (totalTokens > 0 ? Math.round(totalTokens * 0.6) : 0);
    const out = outputTokens || (totalTokens > 0 ? totalTokens - inp : 0);
    this.recordUsage(taskType, inp, out);
  }

  // ── Public API: getAccuracy ───────────────────────────────────────────

  /**
   * Return prediction accuracy statistics over the history window.
   *
   * @returns {AccuracyStats}
   */
  getAccuracy() {
    if (this.#predictionLog.length === 0) {
      return { mape: 0, predictions: 0, accuracyByTaskType: {} };
    }

    let totalError = 0;
    /** @type {Record<string, { totalError: number, count: number }>} */
    const byType = {};

    for (const entry of this.#predictionLog) {
      const error = entry.actual > 0
        ? Math.abs(entry.predicted - entry.actual) / entry.actual
        : 0;
      totalError += error;

      if (!byType[entry.taskType]) {
        byType[entry.taskType] = { totalError: 0, count: 0 };
      }
      byType[entry.taskType].totalError += error;
      byType[entry.taskType].count++;
    }

    const mape = totalError / this.#predictionLog.length;

    const accuracyByTaskType = {};
    for (const [type, data] of Object.entries(byType)) {
      accuracyByTaskType[type] = {
        mape: data.count > 0 ? data.totalError / data.count : 0,
        count: data.count,
      };
    }

    return {
      mape,
      predictions: this.#predictionLog.length,
      accuracyByTaskType,
    };
  }

  /**
   * Record a prediction-versus-actual data point for accuracy tracking.
   *
   * @param {string} taskType
   * @param {number} predicted — predicted output tokens
   * @param {number} actual    — actual output tokens
   */
  recordPrediction(taskType, predicted, actual) {
    this.#predictionLog.push({ taskType, predicted, actual });
    this.#predictionCount++;

    // Trim to history window.
    if (this.#predictionLog.length > this.#historyWindow) {
      this.#predictionLog = this.#predictionLog.slice(-this.#historyWindow);
    }
  }

  // ── Public API: suggestPromptSize ─────────────────────────────────────

  /**
   * Given budget constraints, suggest the maximum input token size.
   *
   * @param {string} taskType — task type for output prediction
   * @param {Budget} budget   — budget constraints
   * @returns {PromptSizeSuggestion}
   */
  suggestPromptSize(taskType, budget) {
    const prediction = this.predictOutputTokens(taskType, 0);
    const outputCost = prediction.predicted * (budget.costPerOutputToken ?? 0);
    const remainingCost = Math.max(0, (budget.maxCost ?? Infinity) - outputCost);
    const costPerInput = budget.costPerInputToken || 0.00003;

    const maxByCost = costPerInput > 0
      ? Math.floor(remainingCost / costPerInput)
      : Infinity;
    const maxByTokens = budget.maxTokens != null
      ? Math.max(0, budget.maxTokens - prediction.predicted)
      : Infinity;
    const maxByContext = Math.max(0, this.#modelContextWindow - prediction.predicted);

    const maxInputTokens = Math.min(maxByCost, maxByTokens, maxByContext);
    const estimatedCost =
      maxInputTokens * costPerInput + outputCost;

    return {
      maxInputTokens: Math.max(0, Math.round(maxInputTokens)),
      maxOutputTokens: prediction.predicted,
      estimatedCost: Math.round(estimatedCost * 1_000_000) / 1_000_000,
    };
  }

  // ── Public API: getStatus ─────────────────────────────────────────────

  /**
   * Return a compact status summary.
   *
   * @returns {{ predictionCount: number, avgAccuracy: number, modelContextWindow: number, trackedTaskTypes: string[] }}
   */
  getStatus() {
    const accuracy = this.getAccuracy();

    return {
      predictionCount: this.#predictionCount,
      avgAccuracy: accuracy.mape > 0 ? 1 - accuracy.mape : 0,
      modelContextWindow: this.#modelContextWindow,
      trackedTaskTypes: Object.keys(this.#taskStats),
    };
  }
}
