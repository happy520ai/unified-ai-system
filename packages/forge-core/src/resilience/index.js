/**
 * Resilience Module — retry policies, circuit breakers, and adaptive timeouts.
 *
 * Components:
 *   1. retryWithBackoff()  — exponential backoff with jitter for transient errors
 *   2. CircuitBreaker      — per-key circuit breaker (closed → open → half-open)
 *   3. AdaptiveTimeout     — P95-based dynamic timeout adjustment
 */

// ── Error Classification ──────────────────────────────────────────────────

/** HTTP status codes considered transient (worth retrying). */
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Error message patterns considered transient. */
const TRANSIENT_PATTERNS = [
  'fetch failed', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'EAI_AGAIN', 'socket hang up', 'network', 'timeout',
  'ENOTFOUND', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET', 'aborted',
];

/**
 * Classify an error as transient (retryable) or permanent.
 * @param {Error} err
 * @returns {boolean} true if the error is transient
 */
export function isTransientError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();

  // Check HTTP status code embedded in message (e.g., "returned 429: ...")
  const statusMatch = msg.match(/(?:returned|status|http)\s*(\d{3})/);
  if (statusMatch && TRANSIENT_STATUSES.has(parseInt(statusMatch[1]))) {
    return true;
  }

  // Check status code property
  if (err.status && TRANSIENT_STATUSES.has(err.status)) return true;
  if (err.statusCode && TRANSIENT_STATUSES.has(err.statusCode)) return true;

  // Check message patterns
  return TRANSIENT_PATTERNS.some(p => msg.includes(p.toLowerCase()));
}

// ── Retry with Exponential Backoff ────────────────────────────────────────

/**
 * Retry an async function with exponential backoff and jitter.
 *
 * @param {Function} fn — async function to retry
 * @param {object} [opts]
 * @param {number} [opts.maxAttempts=3] — maximum number of attempts
 * @param {number} [opts.baseDelay=1000] — base delay in ms (doubles each attempt)
 * @param {number} [opts.maxDelay=30000] — maximum delay cap
 * @param {number} [opts.jitter=1000] — random jitter range in ms
 * @param {Function} [opts.shouldRetry] — custom retry predicate (err) => bool
 * @param {Function} [opts.onRetry] — callback before each retry (err, attempt, delay) => void
 * @returns {Promise<*>} — result of fn()
 */
export async function retryWithBackoff(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = 1000,
    shouldRetry = isTransientError,
    onRetry = null,
  } = opts;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err;
      }

      // Exponential backoff: baseDelay * 2^(attempt-1) + random jitter
      const exponential = baseDelay * Math.pow(2, attempt - 1);
      const jitterMs = Math.floor(Math.random() * jitter);
      const delay = Math.min(exponential + jitterMs, maxDelay);

      if (onRetry) {
        try { onRetry(err, attempt, delay); } catch { /* ignore callback errors */ }
      }

      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── Circuit Breaker ───────────────────────────────────────────────────────

const CB_CLOSED = 'closed';
const CB_OPEN = 'open';
const CB_HALF_OPEN = 'half-open';

/**
 * Per-key circuit breaker.
 *
 * States:
 *   closed    — normal operation, failures are counted
 *   open      — all calls rejected immediately (fast-fail)
 *   half-open — one probe call is allowed through; success → closed, failure → open
 *
 * @param {object} [opts]
 * @param {number} [opts.failureThreshold=5] — consecutive failures to open circuit
 * @param {number} [opts.recoveryMs=60000] — time before open → half-open
 * @param {number} [opts.halfOpenMax=1] — max probe calls in half-open state
 */
export class CircuitBreaker {
  #circuits = new Map();  // key → { state, failures, openedAt, halfOpenCalls }
  #opts;

  constructor(opts = {}) {
    this.#opts = {
      failureThreshold: opts.failureThreshold ?? 5,
      recoveryMs: opts.recoveryMs ?? 60000,
      halfOpenMax: opts.halfOpenMax ?? 1,
    };
  }

  /**
   * Get or create circuit state for a key.
   */
  #get(key) {
    if (!this.#circuits.has(key)) {
      this.#circuits.set(key, { state: CB_CLOSED, failures: 0, openedAt: 0, halfOpenCalls: 0 });
    }
    return this.#circuits.get(key);
  }

  /**
   * Check if a call is allowed for the given key.
   * @returns {'closed'|'open'|'half-open'}
   */
  state(key) {
    const c = this.#get(key);
    if (c.state === CB_OPEN) {
      // Check if recovery period has elapsed → transition to half-open
      if (Date.now() - c.openedAt >= this.#opts.recoveryMs) {
        c.state = CB_HALF_OPEN;
        c.halfOpenCalls = 0;
      }
    }
    return c.state;
  }

  /**
   * Returns true if the circuit allows a call.
   */
  allowRequest(key) {
    const s = this.state(key);
    if (s === CB_CLOSED) return true;
    if (s === CB_HALF_OPEN) {
      const c = this.#get(key);
      return c.halfOpenCalls < this.#opts.halfOpenMax;
    }
    return false; // open
  }

  /**
   * Record a successful call — resets failure count, closes circuit.
   */
  recordSuccess(key) {
    const c = this.#get(key);
    c.failures = 0;
    if (c.state === CB_HALF_OPEN) {
      c.state = CB_CLOSED;
    }
  }

  /**
   * Record a failed call — increments failure count, may open circuit.
   */
  recordFailure(key) {
    const c = this.#get(key);
    c.failures++;
    if (c.state === CB_HALF_OPEN) {
      // Any failure in half-open → reopen
      c.state = CB_OPEN;
      c.openedAt = Date.now();
    } else if (c.state === CB_CLOSED && c.failures >= this.#opts.failureThreshold) {
      c.state = CB_OPEN;
      c.openedAt = Date.now();
    }
    if (c.state === CB_HALF_OPEN) {
      c.halfOpenCalls++;
    }
  }

  /**
   * Wrap an async call with circuit breaker protection.
   *
   * @param {string} key — circuit key (e.g., provider name)
   * @param {Function} fn — async function to execute
   * @param {Function} [fallback] — optional fallback if circuit is open
   * @returns {Promise<*>}
   */
  async call(key, fn, fallback = null) {
    if (!this.allowRequest(key)) {
      if (fallback) return fallback();
      const err = new Error(`Circuit breaker OPEN for "${key}" — ${this.#opts.recoveryMs}ms recovery`);
      err.code = 'CIRCUIT_OPEN';
      throw err;
    }

    const c = this.#get(key);
    if (c.state === CB_HALF_OPEN) c.halfOpenCalls++;

    try {
      const result = await fn();
      this.recordSuccess(key);
      return result;
    } catch (err) {
      if (isTransientError(err)) {
        this.recordFailure(key);
      }
      throw err;
    }
  }

  /**
   * Force reset a circuit to closed state.
   */
  reset(key) {
    if (key) {
      this.#circuits.delete(key);
    } else {
      this.#circuits.clear();
    }
  }

  /**
   * Get status summary of all circuits.
   */
  getStatus() {
    const circuits = {};
    for (const [key, c] of this.#circuits) {
      this.state(key); // refresh state
      circuits[key] = {
        state: c.state,
        failures: c.failures,
        openedAt: c.openedAt ? new Date(c.openedAt).toISOString() : null,
        threshold: this.#opts.failureThreshold,
        recoveryMs: this.#opts.recoveryMs,
      };
    }
    return {
      total: this.#circuits.size,
      open: [...this.#circuits.values()].filter(c => c.state === CB_OPEN).length,
      circuits,
    };
  }
}

// ── Adaptive Timeout ──────────────────────────────────────────────────────

/**
 * Dynamically adjusts timeout based on observed P95 latency.
 *
 * Formula: timeout = max(minTimeout, min(maxTimeout, P95 * multiplier + margin))
 */
export class AdaptiveTimeout {
  #latencies = [];    // sliding window of observed latencies (ms)
  #maxSamples;
  #minTimeout;
  #maxTimeout;
  #multiplier;
  #margin;

  /**
   * @param {object} [opts]
   * @param {number} [opts.minTimeout=10000] — minimum timeout floor (ms)
   * @param {number} [opts.maxTimeout=120000] — maximum timeout cap (ms)
   * @param {number} [opts.multiplier=2.0] — P95 multiplier
   * @param {number} [opts.margin=5000] — fixed margin added to computed timeout (ms)
   * @param {number} [opts.maxSamples=200] — sliding window size
   */
  constructor(opts = {}) {
    this.#minTimeout = opts.minTimeout ?? 10000;
    this.#maxTimeout = opts.maxTimeout ?? 120000;
    this.#multiplier = opts.multiplier ?? 2.0;
    this.#margin = opts.margin ?? 5000;
    this.#maxSamples = opts.maxSamples ?? 200;
  }

  /**
   * Record a successful call latency.
   * @param {number} latencyMs
   */
  record(latencyMs) {
    if (latencyMs <= 0) return;
    this.#latencies.push(latencyMs);
    if (this.#latencies.length > this.#maxSamples) {
      this.#latencies = this.#latencies.slice(-this.#maxSamples);
    }
  }

  /**
   * Get the current adaptive timeout value.
   * @returns {number} timeout in ms
   */
  getTimeout() {
    if (this.#latencies.length < 3) {
      // Not enough data — use default (midpoint of min/max)
      return Math.min(this.#maxTimeout, Math.max(this.#minTimeout, 60000));
    }

    const sorted = [...this.#latencies].sort((a, b) => a - b);
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Idx];

    const computed = Math.round(p95 * this.#multiplier + this.#margin);
    return Math.max(this.#minTimeout, Math.min(this.#maxTimeout, computed));
  }

  /**
   * Create an AbortSignal with the current adaptive timeout.
   * @returns {{ signal: AbortSignal, timeoutMs: number }}
   */
  createSignal() {
    const timeoutMs = this.getTimeout();
    return { signal: AbortSignal.timeout(timeoutMs), timeoutMs };
  }

  /**
   * Get status summary.
   */
  getStatus() {
    const sorted = [...this.#latencies].sort((a, b) => a - b);
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : null;
    const p95 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : null;

    return {
      samples: this.#latencies.length,
      currentTimeout: this.getTimeout(),
      p50Ms: p50,
      p95Ms: p95,
      minTimeout: this.#minTimeout,
      maxTimeout: this.#maxTimeout,
    };
  }
}
