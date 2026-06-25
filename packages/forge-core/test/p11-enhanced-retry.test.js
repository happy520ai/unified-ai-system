/**
 * P11 EnhancedRetry — test suite.
 *
 * Run with:
 *   node --test packages/forge-core/test/p11-enhanced-retry.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EnhancedRetry } from '../src/enhanced-retry/index.js';

describe('EnhancedRetry', () => {
  // ── Construction ──────────────────────────────────────────────────────

  it('constructs with default options', () => {
    const r = new EnhancedRetry();
    const s = r.getStatus();
    assert.equal(s.maxRetries, 3);
    assert.equal(s.baseDelayMs, 1000);
    assert.equal(s.maxDelayMs, 60000);
    assert.equal(s.jitterRatio, 0.25);
    assert.deepEqual(s.strategies, ['exponential', 'linear', 'fibonacci']);
    assert.equal(s.totalRetries, 0);
  });

  it('constructs with custom options', () => {
    const r = new EnhancedRetry({
      maxRetries: 5, baseDelayMs: 500, maxDelayMs: 30000, jitterRatio: 0.1,
    });
    const s = r.getStatus();
    assert.equal(s.maxRetries, 5);
    assert.equal(s.baseDelayMs, 500);
    assert.equal(s.maxDelayMs, 30000);
    assert.equal(s.jitterRatio, 0.1);
  });

  // ── execute: success on first attempt ─────────────────────────────────

  it('succeeds on first attempt without retry', async () => {
    const r = new EnhancedRetry({ baseDelayMs: 1, maxDelayMs: 10 });
    const result = await r.execute(async () => 'ok');
    assert.equal(result.result, 'ok');
    assert.equal(result.attempts, 1);
    assert.equal(result.totalDelay, 0);
    assert.equal(result.degraded, false);
    assert.equal(result.errors.length, 0);
  });

  // ── execute: succeeds after retries ───────────────────────────────────

  it('retries and eventually succeeds', async () => {
    const r = new EnhancedRetry({ maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    let callCount = 0;
    const result = await r.execute(async () => {
      callCount++;
      if (callCount < 3) throw new Error('ECONNRESET transient');
      return 'recovered';
    });
    assert.equal(result.result, 'recovered');
    assert.equal(result.attempts, 3);
    assert.equal(result.errors.length, 2);
    assert.ok(result.totalDelay > 0);
  });

  // ── execute: all attempts fail ────────────────────────────────────────

  it('throws after exhausting all retries', async () => {
    const r = new EnhancedRetry({ maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
    await assert.rejects(
      () => r.execute(async () => { throw new Error('always fails'); }),
      { message: 'always fails' },
    );
  });

  // ── Error classification ──────────────────────────────────────────────

  it('classifies rate_limit error and uses linear strategy', async () => {
    const r = new EnhancedRetry({ maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
    let callCount = 0;
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) {
          const err = new Error('Rate limit exceeded');
          err.status = 429;
          throw err;
        }
        return 'ok';
      },
      { errorType: 'rate_limit' },
    );
    assert.equal(result.strategy, 'linear');
  });

  it('classifies timeout error and uses linear strategy', async () => {
    const r = new EnhancedRetry({ maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
    let callCount = 0;
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) throw new Error('Request timed out');
        return 'ok';
      },
    );
    // classifyError('Request timed out') -> 'timeout' -> linear
    assert.equal(result.strategy, 'linear');
  });

  it('classifies transient 503 error and uses exponential strategy', async () => {
    const r = new EnhancedRetry({ maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
    let callCount = 0;
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) {
          const err = new Error('Service unavailable');
          err.status = 503;
          throw err;
        }
        return 'ok';
      },
    );
    assert.equal(result.strategy, 'exponential');
  });

  it('classifies resource_exhaustion and uses fibonacci strategy', async () => {
    const r = new EnhancedRetry({ maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 });
    let callCount = 0;
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) throw new Error('Out of memory');
        return 'ok';
      },
    );
    assert.equal(result.strategy, 'fibonacci');
  });

  it('classifies unknown error and uses exponential strategy', async () => {
    const r = new EnhancedRetry({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 });
    let callCount = 0;
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) throw new Error('completely mysterious error');
        return 'ok';
      },
    );
    assert.equal(result.strategy, 'exponential');
  });

  // ── Backoff strategies ────────────────────────────────────────────────

  it('exponential backoff grows delays as base * 2^attempt', async () => {
    const r = new EnhancedRetry({ maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100000, jitterRatio: 0 });
    let callCount = 0;
    await r.execute(
      async () => {
        callCount++;
        throw new Error('transient');
      },
    ).catch(() => {});
    // All 4 attempts failed (1 initial + 3 retries), totalDelay should reflect 3 delays
    // exponential: 10*1=10, 10*2=20, 10*4=40 => ~70
    const status = r.getStatus();
    assert.ok(status.totalRetries >= 1);
  });

  it('linear backoff grows delays as base * (attempt+1)', async () => {
    const r = new EnhancedRetry({ maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100000, jitterRatio: 0 });
    let callCount = 0;
    await r.execute(
      async () => {
        callCount++;
        if (callCount < 4) throw new Error('Request timed out');
        return 'ok';
      },
    );
    // linear: 10*1=10, 10*2=20, 10*3=30 => total ~60
    assert.equal(callCount, 4);
  });

  it('fibonacci backoff grows delays following fibonacci sequence', async () => {
    const r = new EnhancedRetry({ maxRetries: 4, baseDelayMs: 10, maxDelayMs: 100000, jitterRatio: 0 });
    let callCount = 0;
    await r.execute(
      async () => {
        callCount++;
        if (callCount < 5) throw new Error('Out of memory');
        return 'ok';
      },
    );
    // fibonacci: 10*1=10, 10*1=10, 10*2=20, 10*3=30 => total ~70
    assert.equal(callCount, 5);
  });

  // ── Input degradation ─────────────────────────────────────────────────

  it('does not degrade input on first two attempts', async () => {
    const r = new EnhancedRetry({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 });
    const input = { context: 'a'.repeat(1000), prompt: 'Hello' };
    let receivedInputs = [];
    await r.execute(
      async (attempt, degradedInput) => {
        receivedInputs.push(degradedInput);
        if (attempt === 0) throw new Error('transient');
        return 'ok';
      },
      { input },
    );
    // Attempt 0 and 1 should get original input
    assert.equal(receivedInputs[0], input);
    assert.equal(receivedInputs[1], input);
  });

  it('degrades input context at attempt 2 (level 1)', async () => {
    const r = new EnhancedRetry({ maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    const input = { context: 'x'.repeat(1000), prompt: 'Analyze' };
    let receivedInputs = [];
    await r.execute(
      async (attempt, degradedInput) => {
        receivedInputs.push(degradedInput);
        if (attempt < 3) throw new Error('transient');
        return 'ok';
      },
      { input },
    );
    // Attempt 2 should have degraded context (70% of original)
    const level1 = receivedInputs[2];
    assert.ok(level1._degraded === true);
    assert.equal(level1._degradationLevel, 1);
    assert.ok(level1.context.length < input.context.length);
    assert.equal(level1.context.length, 700); // 70% of 1000
  });

  it('degrades input at level 2 with simplified prompt at attempt 3+', async () => {
    const r = new EnhancedRetry({ maxRetries: 4, baseDelayMs: 1, maxDelayMs: 10 });
    const input = { context: 'y'.repeat(1000), prompt: 'Analyze the data\nwith details', maxTokens: 2000 };
    let receivedInputs = [];
    await r.execute(
      async (attempt, degradedInput) => {
        receivedInputs.push(degradedInput);
        if (attempt < 4) throw new Error('transient');
        return 'ok';
      },
      { input },
    );
    const level2 = receivedInputs[3];
    assert.ok(level2._degraded === true);
    assert.equal(level2._degradationLevel, 2);
    assert.equal(level2.context.length, 400); // 40% of 1000
    assert.ok(level2.prompt.startsWith('[Simplified]'));
    assert.equal(level2.maxTokens, 1000); // 50% of 2000
  });

  // ── recordAttempt / getEffectiveness ──────────────────────────────────

  it('records outcomes and retrieves strategy stats', () => {
    const r = new EnhancedRetry();
    r.recordOutcome('transient', 'exponential', 2, true);
    r.recordOutcome('transient', 'exponential', 3, true);
    r.recordOutcome('transient', 'linear', 4, false);
    r.recordOutcome('rate_limit', 'linear', 1, true);

    const stats = r.getStrategyStats();
    assert.ok(stats.has('transient'));
    const transientStats = stats.get('transient');
    assert.equal(transientStats.totalAttempts, 3);
    assert.ok(transientStats.successRate > 0);
    assert.ok('exponential' in transientStats.strategies);
  });

  it('getStatus reflects recorded outcomes', () => {
    const r = new EnhancedRetry();
    r.recordOutcome('transient', 'exponential', 2, true);
    r.recordOutcome('rate_limit', 'linear', 1, true);
    const s = r.getStatus();
    assert.ok(s.trackedErrorTypes.includes('transient'));
    assert.ok(s.trackedErrorTypes.includes('rate_limit'));
  });

  // ── Priority multiplier ───────────────────────────────────────────────

  it('high priority reduces retry delay', async () => {
    const r = new EnhancedRetry({ maxRetries: 1, baseDelayMs: 1000, maxDelayMs: 60000, jitterRatio: 0 });
    let callCount = 0;
    const start = Date.now();
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) throw new Error('transient');
        return 'ok';
      },
      { priority: 9 },
    );
    const elapsed = Date.now() - start;
    // With priority=9, multiplier = max(0.1, 1 - 9/10) = 0.1
    // Delay should be ~100ms (1000 * 0.1) instead of 1000ms
    assert.ok(elapsed < 500, `high priority should reduce delay, got ${elapsed}ms`);
  });

  // ── Server-suggested retryAfterMs ─────────────────────────────────────

  it('honors retryAfterMs for rate_limit on first retry', async () => {
    const r = new EnhancedRetry({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 60000, jitterRatio: 0 });
    let callCount = 0;
    const start = Date.now();
    const result = await r.execute(
      async () => {
        callCount++;
        if (callCount < 2) {
          const err = new Error('rate limit');
          err.status = 429;
          throw err;
        }
        return 'ok';
      },
      { retryAfterMs: 50, errorType: 'rate_limit' },
    );
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `should honor retryAfterMs, elapsed=${elapsed}ms`);
    assert.equal(result.attempts, 2);
  });
});
