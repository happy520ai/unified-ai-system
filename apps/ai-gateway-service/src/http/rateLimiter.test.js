import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rateLimiter.js";

describe("rate-limiter", () => {
  it("allows requests within limit", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
    const r1 = limiter.check("10.0.0.1");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(4);
  });

  it("blocks requests exceeding limit", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });
    limiter.check("10.0.0.2");
    limiter.check("10.0.0.2");
    const r3 = limiter.check("10.0.0.2");
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.retryAfterMs).toBeGreaterThan(0);
  });

  it("whitelists localhost", () => {
    const limiter = createRateLimiter({ windowMs: 1, maxRequests: 0 });
    const r = limiter.check("127.0.0.1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(0); // maxRequests=0 but whitelisted
  });

  it("tracks separate buckets per IP", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
    limiter.check("10.0.0.3");
    const r = limiter.check("10.0.0.4");
    expect(r.allowed).toBe(true);
  });

  it("resets after window expires", async () => {
    const limiter = createRateLimiter({ windowMs: 50, maxRequests: 1 });
    limiter.check("10.0.0.5");
    const blocked = limiter.check("10.0.0.5");
    expect(blocked.allowed).toBe(false);
    await new Promise((r) => setTimeout(r, 60));
    const after = limiter.check("10.0.0.5");
    expect(after.allowed).toBe(true);
  });

  it("returns stats", () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 100 });
    limiter.check("10.0.0.6");
    const stats = limiter.getStats();
    expect(stats.activeBuckets).toBe(1);
    expect(stats.maxRequests).toBe(100);
  });
});
