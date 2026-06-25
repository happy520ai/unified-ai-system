import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rateLimiter.js";

describe("rate-limiter", () => {
  it("allows requests within limit", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
    const r1 = limiter.check("10.0.0.1");
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 4);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
    limiter.check("10.0.0.2");
    limiter.check("10.0.0.2");
    const r3 = limiter.check("10.0.0.2");
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
    assert.ok(r3.retryAfterMs > 0);
  });

  it("whitelists localhost", () => {
    const limiter = createRateLimiter({ windowMs: 1, maxRequests: 0 });
    const r = limiter.check("127.0.0.1");
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 0); // maxRequests=0 but whitelisted
  });

  it("tracks separate buckets per IP", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
    limiter.check("10.0.0.3");
    const r = limiter.check("10.0.0.4");
    assert.equal(r.allowed, true);
  });

  it("resets after window expires", async () => {
    const limiter = createRateLimiter({ windowMs: 50, maxRequests: 1 });
    limiter.check("10.0.0.5");
    const blocked = limiter.check("10.0.0.5");
    assert.equal(blocked.allowed, false);
    await new Promise((r) => setTimeout(r, 60));
    const after = limiter.check("10.0.0.5");
    assert.equal(after.allowed, true);
  });

  it("returns stats", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 100 });
    limiter.check("10.0.0.6");
    const stats = limiter.getStats();
    assert.equal(stats.activeBuckets, 1);
    assert.equal(stats.maxRequests, 100);
  });
});
