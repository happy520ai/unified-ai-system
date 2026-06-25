import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProviderCircuitBreaker, createCircuitBreakerRegistry, STATE } from "./providerCircuitBreaker.js";

describe("providerCircuitBreaker", () => {
  it("starts in closed state", () => {
    const cb = createProviderCircuitBreaker({ providerId: "test" });
    assert.equal(cb.getState(), STATE.CLOSED);
  });

  it("passes through successful calls in closed state", async () => {
    const cb = createProviderCircuitBreaker({ providerId: "test" });
    const result = await cb.execute(() => Promise.resolve("ok"));
    assert.equal(result, "ok");
    assert.equal(cb.getState(), STATE.CLOSED);
  });

  it("opens after reaching failure threshold", async () => {
    const cb = createProviderCircuitBreaker({ providerId: "test", failureThreshold: 3 });
    const fail = () => Promise.reject(new Error("provider down"));
    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => cb.execute(fail), { message: "provider down" });
    }
    assert.equal(cb.getState(), STATE.OPEN);
  });

  it("rejects calls immediately when open", async () => {
    const cb = createProviderCircuitBreaker({ providerId: "test", failureThreshold: 2 });
    const fail = () => Promise.reject(new Error("fail"));
    await assert.rejects(() => cb.execute(fail));
    await assert.rejects(() => cb.execute(fail));
    assert.equal(cb.getState(), STATE.OPEN);
    // Next call should be rejected with circuit_breaker_open
    await assert.rejects(() => cb.execute(() => Promise.resolve("ok")), { code: "circuit_breaker_open" });
  });

  it("transitions to half-open after reset timeout", async () => {
    let fakeNow = 1000;
    const cb = createProviderCircuitBreaker({
      providerId: "test",
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      now: () => fakeNow,
    });
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail"))));
    assert.equal(cb.getState(), STATE.OPEN);
    // Not yet expired
    fakeNow = 5999;
    assert.equal(cb.getState(), STATE.OPEN);
    // Expired → half-open
    fakeNow = 6001;
    assert.equal(cb.getState(), STATE.HALF_OPEN);
  });

  it("closes after successThreshold successes in half-open", async () => {
    let fakeNow = 1000;
    const cb = createProviderCircuitBreaker({
      providerId: "test",
      failureThreshold: 1,
      successThreshold: 2,
      halfOpenMaxCalls: 3,
      resetTimeoutMs: 5000,
      now: () => fakeNow,
    });
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail"))));
    assert.equal(cb.getState(), STATE.OPEN);
    fakeNow = 6001;
    assert.equal(cb.getState(), STATE.HALF_OPEN);
    // First success
    await cb.execute(() => Promise.resolve("ok"));
    assert.equal(cb.getState(), STATE.HALF_OPEN);
    // Second success → closes
    await cb.execute(() => Promise.resolve("ok"));
    assert.equal(cb.getState(), STATE.CLOSED);
  });

  it("reopens on any failure in half-open", async () => {
    let fakeNow = 1000;
    const cb = createProviderCircuitBreaker({
      providerId: "test",
      failureThreshold: 1,
      resetTimeoutMs: 5000,
      now: () => fakeNow,
    });
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail"))));
    fakeNow = 6001;
    assert.equal(cb.getState(), STATE.HALF_OPEN);
    // Failure in half-open → reopen
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail again"))));
    assert.equal(cb.getState(), STATE.OPEN);
  });

  it("limits half-open probe calls", async () => {
    const cb = createProviderCircuitBreaker({
      providerId: "test",
      failureThreshold: 1,
      resetTimeoutMs: 0,
      halfOpenMaxCalls: 1,
    });
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail"))));
    // resetTimeoutMs=0 → immediately half-open
    assert.equal(cb.getState(), STATE.HALF_OPEN);
    // First probe call — make it hang (simulate with slow promise)
    let resolveProbe;
    const probePromise = new Promise((r) => { resolveProbe = r; });
    const execPromise = cb.execute(() => probePromise);
    // Second probe call should be rejected
    await assert.rejects(() => cb.execute(() => Promise.resolve("ok")), { code: "circuit_breaker_half_open_limit" });
    resolveProbe("done");
    await execPromise;
  });

  it("resets consecutive failure count on success in closed state", async () => {
    const cb = createProviderCircuitBreaker({ providerId: "test", failureThreshold: 3 });
    const fail = () => Promise.reject(new Error("fail"));
    await assert.rejects(() => cb.execute(fail));
    await assert.rejects(() => cb.execute(fail));
    // Success resets counter
    await cb.execute(() => Promise.resolve("ok"));
    await assert.rejects(() => cb.execute(fail));
    await assert.rejects(() => cb.execute(fail));
    // Still closed — only 2 consecutive failures
    assert.equal(cb.getState(), STATE.CLOSED);
  });

  it("reset() returns to closed state", async () => {
    const cb = createProviderCircuitBreaker({ providerId: "test", failureThreshold: 1 });
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail"))));
    assert.equal(cb.getState(), STATE.OPEN);
    cb.reset();
    assert.equal(cb.getState(), STATE.CLOSED);
  });

  it("getStats returns comprehensive metrics", async () => {
    const cb = createProviderCircuitBreaker({ providerId: "my-provider", failureThreshold: 2 });
    await cb.execute(() => Promise.resolve("ok"));
    await assert.rejects(() => cb.execute(() => Promise.reject(new Error("fail"))));
    const stats = cb.getStats();
    assert.equal(stats.providerId, "my-provider");
    assert.equal(stats.state, STATE.CLOSED);
    assert.equal(stats.failureCount, 1);
    assert.equal(stats.totalRequests, 2);
    assert.equal(stats.totalFailures, 1);
    assert.equal(stats.totalRejected, 0);
    assert.equal(stats.failureThreshold, 2);
  });
});

describe("circuitBreakerRegistry", () => {
  it("creates and reuses breakers by providerId", () => {
    const reg = createCircuitBreakerRegistry({ failureThreshold: 3 });
    const a = reg.getOrCreate("openai");
    const b = reg.getOrCreate("openai");
    assert.equal(a, b);
    const c = reg.getOrCreate("anthropic");
    assert.notEqual(a, c);
  });

  it("getStats returns all registered breakers", async () => {
    const reg = createCircuitBreakerRegistry({ failureThreshold: 1 });
    await reg.getOrCreate("p1").execute(() => Promise.resolve("ok"));
    await assert.rejects(() => reg.getOrCreate("p2").execute(() => Promise.reject(new Error("fail"))));
    const stats = reg.getStats();
    assert.equal(stats.p1.state, STATE.CLOSED);
    assert.equal(stats.p2.state, STATE.OPEN);
  });

  it("resetAll resets every registered breaker", async () => {
    const reg = createCircuitBreakerRegistry({ failureThreshold: 1 });
    await assert.rejects(() => reg.getOrCreate("p1").execute(() => Promise.reject(new Error("fail"))));
    await assert.rejects(() => reg.getOrCreate("p2").execute(() => Promise.reject(new Error("fail"))));
    assert.equal(reg.getOrCreate("p1").getState(), STATE.OPEN);
    assert.equal(reg.getOrCreate("p2").getState(), STATE.OPEN);
    reg.resetAll();
    assert.equal(reg.getOrCreate("p1").getState(), STATE.CLOSED);
    assert.equal(reg.getOrCreate("p2").getState(), STATE.CLOSED);
  });
});
