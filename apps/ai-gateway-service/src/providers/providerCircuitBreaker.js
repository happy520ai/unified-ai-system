/**
 * Provider Circuit Breaker
 *
 * Protects against cascading failures when a provider is consistently failing.
 * Three states: closed (normal), open (failing fast), half-open (probing).
 *
 * Usage:
 *   const breaker = createProviderCircuitBreaker({ providerId: "openai" });
 *   const result = await breaker.execute(() => adapter.generate(request));
 */

export const STATE = Object.freeze({
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half-open",
});

export function createProviderCircuitBreaker(options = {}) {
  const {
    providerId = "unknown",
    failureThreshold = 5,
    successThreshold = 2,
    resetTimeoutMs = 30_000,
    halfOpenMaxCalls = 1,
    now = Date.now,
  } = options;

  let state = STATE.CLOSED;
  let failureCount = 0;
  let successCount = 0;
  let halfOpenCalls = 0;
  let lastFailureAt = 0;
  let lastStateChangeAt = now();
  let totalRequests = 0;
  let totalFailures = 0;
  let totalRejected = 0;

  function _transitionTo(newState) {
    const prev = state;
    state = newState;
    lastStateChangeAt = now();
    if (newState === STATE.HALF_OPEN) {
      halfOpenCalls = 0;
      successCount = 0;
    }
    if (newState === STATE.CLOSED) {
      failureCount = 0;
      successCount = 0;
    }
    return prev;
  }

  function _isOpenExpired() {
    return now() - lastStateChangeAt >= resetTimeoutMs;
  }

  function getState() {
    // Auto-transition from open → half-open when timeout expires
    if (state === STATE.OPEN && _isOpenExpired()) {
      _transitionTo(STATE.HALF_OPEN);
    }
    return state;
  }

  async function execute(fn) {
    const currentState = getState();
    totalRequests++;

    if (currentState === STATE.OPEN) {
      totalRejected++;
      const retryAfterMs = Math.max(0, resetTimeoutMs - (now() - lastStateChangeAt));
      const err = new Error(`Circuit breaker open for provider "${providerId}". Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
      err.code = "circuit_breaker_open";
      err.retryable = true;
      err.retryAfterMs = retryAfterMs;
      err.providerId = providerId;
      throw err;
    }

    if (currentState === STATE.HALF_OPEN) {
      if (halfOpenCalls >= halfOpenMaxCalls) {
        totalRejected++;
        const err = new Error(`Circuit breaker half-open: max probe calls reached for "${providerId}".`);
        err.code = "circuit_breaker_half_open_limit";
        err.retryable = true;
        err.retryAfterMs = resetTimeoutMs;
        err.providerId = providerId;
        throw err;
      }
      halfOpenCalls++;
    }

    try {
      const result = await fn();
      _onSuccess();
      return result;
    } catch (error) {
      _onFailure();
      throw error;
    }
  }

  function _onSuccess() {
    if (state === STATE.HALF_OPEN) {
      successCount++;
      if (successCount >= successThreshold) {
        _transitionTo(STATE.CLOSED);
      }
    } else if (state === STATE.CLOSED) {
      // Reset consecutive failure count on success
      failureCount = 0;
    }
  }

  function _onFailure() {
    totalFailures++;
    lastFailureAt = now();

    if (state === STATE.HALF_OPEN) {
      // Any failure in half-open → reopen immediately
      _transitionTo(STATE.OPEN);
    } else if (state === STATE.CLOSED) {
      failureCount++;
      if (failureCount >= failureThreshold) {
        _transitionTo(STATE.OPEN);
      }
    }
  }

  function reset() {
    _transitionTo(STATE.CLOSED);
    failureCount = 0;
    successCount = 0;
    halfOpenCalls = 0;
    lastFailureAt = 0;
  }

  function getStats() {
    return {
      providerId,
      state: getState(),
      failureCount,
      successCount,
      halfOpenCalls,
      lastFailureAt,
      lastStateChangeAt,
      totalRequests,
      totalFailures,
      totalRejected,
      failureThreshold,
      successThreshold,
      resetTimeoutMs,
    };
  }

  return {
    execute,
    getState,
    getStats,
    reset,
  };
}

/**
 * Registry that manages circuit breakers for multiple providers.
 */
export function createCircuitBreakerRegistry(options = {}) {
  const breakers = new Map();

  function getOrCreate(providerId) {
    if (!breakers.has(providerId)) {
      breakers.set(providerId, createProviderCircuitBreaker({ ...options, providerId }));
    }
    return breakers.get(providerId);
  }

  function getStats() {
    const stats = {};
    for (const [id, breaker] of breakers) {
      stats[id] = breaker.getStats();
    }
    return stats;
  }

  function resetAll() {
    for (const breaker of breakers.values()) {
      breaker.reset();
    }
  }

  return { getOrCreate, getStats, resetAll };
}
