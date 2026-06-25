import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let retryWithBackoff, isTransientError, CircuitBreaker, AdaptiveTimeout;

before(async () => {
  const mod = await import('../src/resilience/index.js');
  retryWithBackoff = mod.retryWithBackoff;
  isTransientError = mod.isTransientError;
  CircuitBreaker = mod.CircuitBreaker;
  AdaptiveTimeout = mod.AdaptiveTimeout;
});

describe('Resilience', { concurrency: 1 }, () => {

  // ── Error Classification ──────────────────────────────────────────────

  describe('isTransientError', () => {
    it('should classify 429 as transient', () => {
      assert.ok(isTransientError(new Error('Provider returned 429: rate limit')));
    });
    it('should classify 502 as transient', () => {
      assert.ok(isTransientError(new Error('Provider returned 502: bad gateway')));
    });
    it('should classify 503 as transient', () => {
      assert.ok(isTransientError(new Error('HTTP status 503')));
    });
    it('should classify fetch failed as transient', () => {
      assert.ok(isTransientError(new Error('fetch failed')));
    });
    it('should classify ECONNREFUSED as transient', () => {
      assert.ok(isTransientError(new Error('ECONNREFUSED 127.0.0.1:3100')));
    });
    it('should classify ETIMEDOUT as transient', () => {
      assert.ok(isTransientError(new Error('ETIMEDOUT')));
    });
    it('should classify err.status property', () => {
      const err = new Error('bad');
      err.status = 500;
      assert.ok(isTransientError(err));
    });
    it('should NOT classify 400 as transient', () => {
      assert.ok(!isTransientError(new Error('Provider returned 400: bad request')));
    });
    it('should NOT classify 401 as transient', () => {
      assert.ok(!isTransientError(new Error('Provider returned 401: unauthorized')));
    });
    it('should NOT classify 404 as transient', () => {
      assert.ok(!isTransientError(new Error('Provider returned 404: not found')));
    });
    it('should handle null/undefined', () => {
      assert.ok(!isTransientError(null));
      assert.ok(!isTransientError(undefined));
    });
  });

  // ── Retry with Backoff ────────────────────────────────────────────────

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const result = await retryWithBackoff(async () => {
        attempts++;
        return 'ok';
      });
      assert.strictEqual(result, 'ok');
      assert.strictEqual(attempts, 1);
    });

    it('should retry on transient error and succeed', async () => {
      let attempts = 0;
      const result = await retryWithBackoff(async () => {
        attempts++;
        if (attempts < 3) throw new Error('fetch failed');
        return 'recovered';
      }, { maxAttempts: 5, baseDelay: 10, jitter: 0 });
      assert.strictEqual(result, 'recovered');
      assert.strictEqual(attempts, 3);
    });

    it('should not retry on permanent error', async () => {
      let attempts = 0;
      await assert.rejects(() => retryWithBackoff(async () => {
        attempts++;
        throw new Error('Provider returned 401: unauthorized');
      }, { maxAttempts: 3, baseDelay: 10 }), /401/);
      assert.strictEqual(attempts, 1);
    });

    it('should exhaust retries and throw', async () => {
      let attempts = 0;
      await assert.rejects(() => retryWithBackoff(async () => {
        attempts++;
        throw new Error('ECONNREFUSED');
      }, { maxAttempts: 3, baseDelay: 10, jitter: 0 }), /ECONNREFUSED/);
      assert.strictEqual(attempts, 3);
    });

    it('should call onRetry callback', async () => {
      const retries = [];
      await retryWithBackoff(async (attempt) => {
        if (attempt < 3) throw new Error('timeout');
        return 'ok';
      }, {
        maxAttempts: 5,
        baseDelay: 10,
        jitter: 0,
        onRetry: (err, attempt, delay) => retries.push({ attempt, delay }),
      });
      assert.strictEqual(retries.length, 2);
      assert.strictEqual(retries[0].attempt, 1);
      assert.strictEqual(retries[1].attempt, 2);
    });

    it('should apply exponential backoff', async () => {
      const delays = [];
      await retryWithBackoff(async (attempt) => {
        if (attempt < 4) throw new Error('ECONNRESET');
        return 'ok';
      }, {
        maxAttempts: 5,
        baseDelay: 100,
        jitter: 0,
        maxDelay: 10000,
        onRetry: (err, attempt, delay) => delays.push(delay),
      });
      // Delays should be ~100, ~200, ~400 (exponential)
      assert.ok(delays[0] >= 100 && delays[0] < 110, `delay[0]=${delays[0]}`);
      assert.ok(delays[1] >= 200 && delays[1] < 210, `delay[1]=${delays[1]}`);
      assert.ok(delays[2] >= 400 && delays[2] < 410, `delay[2]=${delays[2]}`);
    });

    it('should cap delay at maxDelay', async () => {
      const delays = [];
      await retryWithBackoff(async (attempt) => {
        if (attempt < 6) throw new Error('fetch failed');
        return 'ok';
      }, {
        maxAttempts: 7,
        baseDelay: 50,
        maxDelay: 500,
        jitter: 0,
        onRetry: (err, attempt, delay) => delays.push(delay),
      });
      for (const d of delays) {
        assert.ok(d <= 500, `delay ${d} exceeds maxDelay`);
      }
    });

    it('should use custom shouldRetry predicate', async () => {
      let attempts = 0;
      await assert.rejects(() => retryWithBackoff(async () => {
        attempts++;
        throw new Error('custom permanent error');
      }, {
        maxAttempts: 5,
        baseDelay: 10,
        shouldRetry: (err) => err.message.includes('retryable'),
      }), /custom permanent/);
      assert.strictEqual(attempts, 1);
    });
  });

  // ── Circuit Breaker ───────────────────────────────────────────────────

  describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
      const cb = new CircuitBreaker();
      assert.strictEqual(cb.state('provider-a'), 'closed');
      assert.ok(cb.allowRequest('provider-a'));
    });

    it('should open after failure threshold', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');
      assert.strictEqual(cb.state('p1'), 'closed');
      cb.recordFailure('p1');
      assert.strictEqual(cb.state('p1'), 'open');
      assert.ok(!cb.allowRequest('p1'));
    });

    it('should transition open → half-open after recovery period', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, recoveryMs: 50 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');
      assert.strictEqual(cb.state('p1'), 'open');

      await new Promise(r => setTimeout(r, 80));
      assert.strictEqual(cb.state('p1'), 'half-open');
      assert.ok(cb.allowRequest('p1'));
    });

    it('should close from half-open on success', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, recoveryMs: 50 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');
      await new Promise(r => setTimeout(r, 80));
      assert.strictEqual(cb.state('p1'), 'half-open');

      cb.recordSuccess('p1');
      assert.strictEqual(cb.state('p1'), 'closed');
    });

    it('should reopen from half-open on failure', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, recoveryMs: 50 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');
      await new Promise(r => setTimeout(r, 80));
      assert.strictEqual(cb.state('p1'), 'half-open');

      cb.recordFailure('p1');
      assert.strictEqual(cb.state('p1'), 'open');
    });

    it('should reset failure count on success', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');
      cb.recordSuccess('p1');
      // After success, failures should be reset
      cb.recordFailure('p1');
      cb.recordFailure('p1');
      assert.strictEqual(cb.state('p1'), 'closed'); // still closed, only 2 consecutive
    });

    it('should wrap async calls with call()', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      const result = await cb.call('p1', async () => 'success');
      assert.strictEqual(result, 'success');
    });

    it('should reject calls when circuit is open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');

      await assert.rejects(() => cb.call('p1', async () => 'never'), /Circuit breaker OPEN/);
    });

    it('should use fallback when circuit is open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure('p1');
      cb.recordFailure('p1');

      const result = await cb.call('p1', async () => 'never', async () => 'fallback');
      assert.strictEqual(result, 'fallback');
    });

    it('should reset circuits', () => {
      const cb = new CircuitBreaker({ failureThreshold: 1 });
      cb.recordFailure('p1');
      assert.strictEqual(cb.state('p1'), 'open');

      cb.reset('p1');
      assert.strictEqual(cb.state('p1'), 'closed');

      cb.recordFailure('p2');
      cb.reset(); // reset all
      assert.strictEqual(cb.state('p2'), 'closed');
    });

    it('should return getStatus() summary', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      cb.recordFailure('api-a');
      cb.recordFailure('api-a');
      cb.recordFailure('api-a');
      cb.recordSuccess('api-b');

      const status = cb.getStatus();
      assert.strictEqual(status.total, 2);
      assert.strictEqual(status.open, 1);
      assert.strictEqual(status.circuits['api-a'].state, 'open');
      assert.strictEqual(status.circuits['api-b'].state, 'closed');
      assert.strictEqual(status.circuits['api-a'].failures, 3);
    });
  });

  // ── Adaptive Timeout ──────────────────────────────────────────────────

  describe('AdaptiveTimeout', () => {
    it('should return default timeout with insufficient data', () => {
      const at = new AdaptiveTimeout({ minTimeout: 10000, maxTimeout: 120000 });
      at.record(5000);
      at.record(6000);
      const timeout = at.getTimeout();
      assert.ok(timeout >= 10000 && timeout <= 120000, `timeout=${timeout}`);
    });

    it('should adapt based on P95 latency', () => {
      const at = new AdaptiveTimeout({
        minTimeout: 5000,
        maxTimeout: 60000,
        multiplier: 2.0,
        margin: 1000,
      });

      // Simulate 20 calls with latencies around 2-4 seconds
      for (let i = 0; i < 20; i++) {
        at.record(2000 + Math.random() * 2000);
      }
      const timeout = at.getTimeout();
      // P95 of 2-4s range ≈ ~3.8s, timeout = 3.8*2 + 1 = ~8.6s
      assert.ok(timeout >= 5000 && timeout <= 15000, `timeout=${timeout}`);
    });

    it('should cap at maxTimeout', () => {
      const at = new AdaptiveTimeout({
        minTimeout: 1000,
        maxTimeout: 10000,
        multiplier: 10.0,
        margin: 0,
      });
      for (let i = 0; i < 10; i++) at.record(5000);
      assert.strictEqual(at.getTimeout(), 10000);
    });

    it('should floor at minTimeout', () => {
      const at = new AdaptiveTimeout({
        minTimeout: 5000,
        maxTimeout: 60000,
        multiplier: 0.1,
        margin: 0,
      });
      for (let i = 0; i < 10; i++) at.record(100);
      assert.strictEqual(at.getTimeout(), 5000);
    });

    it('should trim to maxSamples', () => {
      const at = new AdaptiveTimeout({ maxSamples: 10 });
      for (let i = 0; i < 50; i++) at.record(i * 100);
      const status = at.getStatus();
      assert.strictEqual(status.samples, 10);
    });

    it('should create AbortSignal with timeout', () => {
      const at = new AdaptiveTimeout({ minTimeout: 5000, maxTimeout: 10000 });
      for (let i = 0; i < 5; i++) at.record(3000);
      const { signal, timeoutMs } = at.createSignal();
      assert.ok(signal instanceof AbortSignal);
      assert.ok(timeoutMs >= 5000 && timeoutMs <= 10000);
    });

    it('should return getStatus() with P50/P95', () => {
      const at = new AdaptiveTimeout();
      for (let i = 1; i <= 100; i++) at.record(i * 100);
      const status = at.getStatus();
      assert.strictEqual(status.samples, 100);
      assert.ok(status.p50Ms > 0);
      assert.ok(status.p95Ms >= status.p50Ms);
      assert.ok(status.currentTimeout > 0);
    });

    it('should ignore zero/negative latencies', () => {
      const at = new AdaptiveTimeout();
      at.record(0);
      at.record(-100);
      at.record(5000);
      assert.strictEqual(at.getStatus().samples, 1);
    });
  });
});
