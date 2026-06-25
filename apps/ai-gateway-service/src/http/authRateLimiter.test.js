import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

let createAuthRateLimiter;

before(async () => {
  const mod = await import("./authRateLimiter.js");
  createAuthRateLimiter = mod.createAuthRateLimiter;
});

describe("AuthRateLimiter — basic flow", () => {
  it("allows requests when no failures recorded", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 5 });
    const result = limiter.check("10.0.0.1");
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 5);
  });

  it("tracks failure count", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 5 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");
    const result = limiter.check("10.0.0.1");
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 3);
  });

  it("locks after maxAttempts failures", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 3, lockoutMs: 60_000 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");
    const r3 = limiter.recordFailure("10.0.0.1");
    assert.strictEqual(r3.locked, true);
    assert.ok(r3.lockedUntil > Date.now());

    const checkResult = limiter.check("10.0.0.1");
    assert.strictEqual(checkResult.allowed, false);
    assert.strictEqual(checkResult.remaining, 0);
    assert.ok(checkResult.retryAfterMs > 0);
  });

  it("success clears failure record", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 5 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");
    limiter.recordSuccess("10.0.0.1");

    const result = limiter.check("10.0.0.1");
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 5);
  });

  it("tracks different keys independently", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 3 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");

    // 10.0.0.1 is locked
    assert.strictEqual(limiter.check("10.0.0.1").allowed, false);
    // 10.0.0.2 is not
    assert.strictEqual(limiter.check("10.0.0.2").allowed, true);
  });

  it("auto-unlocks after lockout expires", async () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 2, lockoutMs: 50, windowMs: 1000 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");

    assert.strictEqual(limiter.check("10.0.0.1").allowed, false);

    // Wait for lockout to expire
    await new Promise(r => setTimeout(r, 80));

    const result = limiter.check("10.0.0.1");
    assert.strictEqual(result.allowed, true);
  });

  it("resets failure count after window expires", async () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 3, windowMs: 50, lockoutMs: 10000 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1");

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 80));

    limiter.recordFailure("10.0.0.1");
    // Should only count as 1 failure (window reset)
    const result = limiter.check("10.0.0.1");
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.remaining, 2);
  });

  it("getStats reports correct counts", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 2 });
    limiter.recordFailure("10.0.0.1");
    limiter.recordFailure("10.0.0.1"); // locked
    limiter.recordFailure("10.0.0.2"); // not locked

    const stats = limiter.getStats();
    assert.strictEqual(stats.trackedKeys, 2);
    assert.strictEqual(stats.lockedKeys, 1);
    assert.strictEqual(stats.maxAttempts, 2);
  });

  it("recordFailure returns correct remaining count", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 5 });
    const r1 = limiter.recordFailure("10.0.0.1");
    assert.strictEqual(r1.remaining, 4);
    assert.strictEqual(r1.locked, false);

    const r5 = limiter.recordFailure("10.0.0.1");
    // After 2nd failure: remaining = 3
    assert.strictEqual(r5.remaining, 3);
  });
});

describe("AuthRateLimiter — edge cases", () => {
  it("handles maxAttempts=1 (immediate lockout)", () => {
    const limiter = createAuthRateLimiter({ maxAttempts: 1, lockoutMs: 60_000 });
    const r = limiter.recordFailure("10.0.0.1");
    assert.strictEqual(r.locked, true);
    assert.strictEqual(limiter.check("10.0.0.1").allowed, false);
  });

  it("handles recordSuccess on unknown key gracefully", () => {
    const limiter = createAuthRateLimiter();
    // Should not throw
    limiter.recordSuccess("unknown-key");
    assert.strictEqual(limiter.check("unknown-key").allowed, true);
  });
});
