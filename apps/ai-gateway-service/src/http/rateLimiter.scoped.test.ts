import { describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "./rateLimiter.js";
import { PostgresRateLimitStoreError } from "./postgresRateLimitStore.ts";

function createSharedStore() {
  const counts = new Map<string, number>();
  return {
    increment: vi.fn(async (namespace: string, subject: string) => {
      const key = `${namespace}\0${subject}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return { count, resetAfterMs: 30_000 };
    }),
    cleanup: vi.fn(async () => undefined),
    getStats: () => ({
      activeBuckets: counts.size,
      available: true,
      distributed: true as const,
      maxBuckets: 100,
      statsUpdatedAt: Date.now(),
      storeMode: "postgres" as const,
    }),
    checkHealth: async function checkHealth() { return this.getStats(); },
    close: vi.fn(async () => undefined),
  };
}

describe("scoped rate limiters", () => {
  it("shares one PostgreSQL namespace and quota across gateway instances", async () => {
    const store = createSharedStore();
    const first = createRateLimiter({
      storeMode: "postgres",
      postgresStore: store,
      storeNamespace: "http:global",
      whitelist: [],
    });
    const second = createRateLimiter({
      storeMode: "postgres",
      postgresStore: store,
      storeNamespace: "http:global",
      whitelist: [],
    });
    const firstMessages = first.createScopedLimiter("websocket-messages", {
      windowMs: 60_000,
      maxRequests: 2,
      whitelist: [],
    });
    const secondMessages = second.createScopedLimiter("websocket-messages", {
      windowMs: 60_000,
      maxRequests: 2,
      whitelist: [],
    });

    await expect(firstMessages.check("tenant-a:alice")).resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(secondMessages.check("tenant-a:alice")).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(firstMessages.check("tenant-a:alice")).resolves.toMatchObject({ allowed: false, remaining: 0 });
    expect(store.increment).toHaveBeenCalledWith(
      "http:global:websocket-messages",
      "tenant-a:alice",
      60_000,
    );
    expect(first.getStats().scoped["websocket-messages"]).toMatchObject({
      distributed: true,
      maxRequests: 2,
      storeMode: "postgres",
    });

    await first.close();
    await second.close();
    expect(store.close).not.toHaveBeenCalled();
  });

  it("fails closed when a scoped distributed store cannot prove the increment", async () => {
    const store = createSharedStore();
    store.increment.mockRejectedValueOnce(
      new PostgresRateLimitStoreError("RATE_LIMIT_STORE_UNAVAILABLE", "down"),
    );
    const parent = createRateLimiter({
      storeMode: "postgres",
      postgresStore: store,
      storeNamespace: "http:global",
      whitelist: [],
    });
    const messages = parent.createScopedLimiter("websocket-messages", {
      windowMs: 60_000,
      maxRequests: 60,
      whitelist: [],
    });

    await expect(messages.check("tenant-a:alice")).resolves.toMatchObject({
      allowed: false,
      statusCode: 503,
      code: "RATE_LIMIT_STORE_UNAVAILABLE",
    });
    await parent.close();
  });

  it("returns the same scoped limiter and rejects conflicting or unsafe scope definitions", async () => {
    const parent = createRateLimiter({ whitelist: [] });
    const first = parent.createScopedLimiter("websocket-messages", {
      windowMs: 60_000,
      maxRequests: 60,
      whitelist: [],
    });
    expect(parent.createScopedLimiter("websocket-messages", {
      windowMs: 60_000,
      maxRequests: 60,
      whitelist: [],
    })).toBe(first);
    expect(() => parent.createScopedLimiter("websocket-messages", {
      windowMs: 60_000,
      maxRequests: 61,
      whitelist: [],
    })).toThrow(/conflicting limits/);
    expect(() => parent.createScopedLimiter("../escape", {})).toThrow(/Scoped rate-limit names/);
    await parent.close();
    expect(() => parent.createScopedLimiter("late", {})).toThrow(/parent limiter is closed/);
  });
});
