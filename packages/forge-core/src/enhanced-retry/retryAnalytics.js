/**
 * EnhancedRetry — pure analytics, classification, and degradation helpers.
 *
 * Extracted from enhanced-retry/index.js to keep the class module
 * under the 500-line limit (分层律).
 */

/**
 * Known error type categories and their optimal retry strategies.
 * @type {Object<string, { strategy: string, description: string }>}
 */
export const ERROR_TYPE_MAP = {
  transient: {
    strategy: 'exponential',
    description: 'Temporary failures (network timeout, 503). Fast exponential recovery.',
  },
  rate_limit: {
    strategy: 'linear',
    description: 'Rate-limited (429, too many requests). Linear backoff aligned to retry-after.',
  },
  resource_exhaustion: {
    strategy: 'fibonacci',
    description: 'Resource limits hit (OOM, connection pool full). Slow fibonacci growth.',
  },
  model_overload: {
    strategy: 'exponential',
    description: 'AI model overloaded (529, queue full). Exponential with circuit breaker delay.',
  },
  timeout: {
    strategy: 'linear',
    description: 'Operation timed out. Linear retry with context reduction.',
  },
  unknown: {
    strategy: 'exponential',
    description: 'Unclassified error. Default exponential backoff.',
  },
};

/**
 * Classify an error into a retry strategy category.
 * @param {Error|string} error — error object or message
 * @returns {string} — error type key
 */
export function classifyError(error) {
  const msg = typeof error === 'string' ? error : (error?.message ?? '');
  const lower = msg.toLowerCase();
  const status = error?.status ?? error?.statusCode ?? null;

  // Rate limit detection
  if (status === 429 || lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('throttl')) {
    return 'rate_limit';
  }

  // Resource exhaustion
  if (lower.includes('out of memory') || lower.includes('oom') || lower.includes('resource') ||
      lower.includes('connection pool') || lower.includes('no available') || status === 507) {
    return 'resource_exhaustion';
  }

  // Model overload
  if (status === 529 || lower.includes('overloaded') || lower.includes('queue full') ||
      lower.includes('capacity') || lower.includes('model_overload')) {
    return 'model_overload';
  }

  // Timeout
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('deadline') ||
      status === 408 || status === 504) {
    return 'timeout';
  }

  // Transient / network
  if (status === 502 || status === 503 || status === 500 ||
      lower.includes('econnreset') || lower.includes('econnrefused') ||
      lower.includes('socket hang up') || lower.includes('network') ||
      lower.includes('unavailable') || lower.includes('transient')) {
    return 'transient';
  }

  return 'unknown';
}

/**
 * Compute the n-th Fibonacci number (1-indexed: fib(1)=1, fib(2)=1, fib(3)=2, ...).
 * @param {number} n
 * @returns {number}
 */
export function fibonacci(n) {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  let a = 1, b = 1;
  for (let i = 3; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  return b;
}

/**
 * Progressively degrade input on repeated failures.
 *
 * @param {object} input — original input object
 * @param {number} attempt — current attempt number (0-based)
 * @param {string} errorType — classified error type
 * @returns {object} — potentially degraded input
 */
export function degradeInput(input, attempt, errorType) {
  if (attempt <= 1) return input;
  if (!input || typeof input !== 'object') return input;

  const degraded = { ...input };

  if (attempt === 2) {
    if (degraded.context && typeof degraded.context === 'string') {
      const targetLen = Math.floor(degraded.context.length * 0.7);
      degraded.context = degraded.context.substring(0, targetLen);
      degraded._degraded = true;
      degraded._degradationLevel = 1;
    }
    if (Array.isArray(degraded.contextItems)) {
      const keepCount = Math.max(1, Math.floor(degraded.contextItems.length * 0.7));
      degraded.contextItems = degraded.contextItems.slice(0, keepCount);
      degraded._degraded = true;
      degraded._degradationLevel = 1;
    }
    if (typeof degraded.maxTokens === 'number') {
      degraded.maxTokens = Math.floor(degraded.maxTokens * 0.8);
    }
  } else if (attempt >= 3) {
    if (degraded.context && typeof degraded.context === 'string') {
      const targetLen = Math.floor(degraded.context.length * 0.4);
      degraded.context = degraded.context.substring(0, targetLen);
      degraded._degraded = true;
      degraded._degradationLevel = 2;
    }
    if (Array.isArray(degraded.contextItems)) {
      const keepCount = Math.max(1, Math.floor(degraded.contextItems.length * 0.4));
      degraded.contextItems = degraded.contextItems.slice(0, keepCount);
      degraded._degraded = true;
      degraded._degradationLevel = 2;
    }
    if (typeof degraded.maxTokens === 'number') {
      degraded.maxTokens = Math.floor(degraded.maxTokens * 0.5);
    }
    if (typeof degraded.prompt === 'string') {
      degraded._originalPrompt = degraded.prompt;
      degraded.prompt = `[Simplified] ${degraded.prompt.split('\n')[0]}`;
      degraded._degraded = true;
      degraded._degradationLevel = 2;
    }
  }

  return degraded;
}

/**
 * Select the best retry strategy for an error type, using historical
 * effectiveness data to override defaults when evidence supports it.
 *
 * @param {string} errorType
 * @param {Map} outcomes — Map<errorType, Array<{strategy, succeeded}>>
 * @param {string[]} strategies — available strategy names
 * @returns {string}
 */
export function selectStrategy(errorType, outcomes, strategies) {
  const defaultStrategy = ERROR_TYPE_MAP[errorType]?.strategy ?? 'exponential';

  const history = outcomes.get(errorType);
  if (!history || history.length < 10) return defaultStrategy;

  const strategyStats = new Map();
  for (const outcome of history) {
    if (!strategyStats.has(outcome.strategy)) {
      strategyStats.set(outcome.strategy, { total: 0, succeeded: 0 });
    }
    const stats = strategyStats.get(outcome.strategy);
    stats.total++;
    if (outcome.succeeded) stats.succeeded++;
  }

  let bestStrategy = defaultStrategy;
  let bestRate = 0;
  for (const [strat, stats] of strategyStats) {
    if (stats.total < 5) continue;
    const rate = stats.succeeded / stats.total;
    if (rate > bestRate) {
      bestRate = rate;
      bestStrategy = strat;
    }
  }

  return strategies.includes(bestStrategy) ? bestStrategy : defaultStrategy;
}

/**
 * Compute strategy effectiveness statistics from outcome data.
 *
 * @param {Map} outcomes — Map<errorType, Array<{strategy, attempts, succeeded}>>
 * @returns {Map}
 */
export function getStrategyStats(outcomes) {
  const result = new Map();

  for (const [errorType, outcomeList] of outcomes) {
    const strategyMap = new Map();
    let totalAttempts = 0;
    let totalSuccess = 0;

    for (const outcome of outcomeList) {
      if (!strategyMap.has(outcome.strategy)) {
        strategyMap.set(outcome.strategy, { total: 0, succeeded: 0, totalAttempts: 0 });
      }
      const stats = strategyMap.get(outcome.strategy);
      stats.total++;
      stats.totalAttempts += outcome.attempts;
      if (outcome.succeeded) {
        stats.succeeded++;
        totalSuccess++;
      }
      totalAttempts += outcome.attempts;
    }

    let bestStrategy = 'unknown';
    let bestRate = 0;
    const strategies = {};
    for (const [strat, stats] of strategyMap) {
      const rate = stats.total > 0 ? stats.succeeded / stats.total : 0;
      strategies[strat] = {
        attempts: stats.total,
        successRate: +rate.toFixed(3),
        avgAttemptsPerTry: +(stats.totalAttempts / stats.total).toFixed(2),
      };
      if (rate > bestRate) {
        bestRate = rate;
        bestStrategy = strat;
      }
    }

    result.set(errorType, {
      bestStrategy,
      strategies,
      avgAttempts: +(totalAttempts / outcomeList.length).toFixed(2),
      successRate: +(totalSuccess / outcomeList.length).toFixed(3),
      totalAttempts: outcomeList.length,
    });
  }

  return result;
}
