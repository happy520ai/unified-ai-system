import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimiter.js";
import { PostgresRateLimitStoreError } from "./postgresRateLimitStore.ts";

function createRequest(ip: string) {
  return { socket: { remoteAddress: ip } };
}

function createResponse() {
  return {
    body: "",
    headers: new Map<string, string>(),
    statusCode: 200,
    setHeader(name: string, value: string) { this.headers.set(name.toLowerCase(), String(value)); },
    writeHead(statusCode: number) { this.statusCode = statusCode; },
    end(body = "") { this.body = body; },
  };
}

function createStore(overrides = {}) {
  return {
    increment: async () => ({ count: 1, resetAfterMs: 30_000 }),
    cleanup: async () => undefined,
    getStats: () => ({
      activeBuckets: 1,
      available: true,
      distributed: true,
      maxBuckets: 100,
      statsUpdatedAt: Date.now(),
      storeMode: "postgres",
    }),
    checkHealth: async function checkHealth() { return this.getStats(); },
    close: async () => undefined,
    ...overrides,
  };
}

describe("PostgreSQL rate limiter contract", () => {
  it("requires an explicit database and shared HMAC secret", () => {
    expect(() => createRateLimiter({
      storeMode: "postgres",
      postgresSecret: "0123456789abcdef0123456789abcdef",
    })).toThrow(/POSTGRES_URL/);
    expect(() => createRateLimiter({
      storeMode: "postgres",
      postgresConnectionString: "postgresql://127.0.0.1/test",
      postgresSecret: "short",
    })).toThrow(/HMAC_SECRET/);
  });

  it("returns structured 503 without fail-open when the shared store is unavailable", async () => {
    const limiter = createRateLimiter({
      storeMode: "postgres",
      postgresStore: createStore({
        increment: async () => { throw new PostgresRateLimitStoreError("RATE_LIMIT_STORE_UNAVAILABLE", "down"); },
      }),
      storeNamespace: "test",
      whitelist: [],
    });
    const response = createResponse();

    await expect(limiter.apply(createRequest("10.0.0.1"), response)).resolves.toBe(response);
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toMatchObject({
      error: { code: "RATE_LIMIT_STORE_UNAVAILABLE", retryable: true },
    });
    await limiter.close();
  });

  it("distinguishes bounded-store capacity from connectivity failure", async () => {
    const limiter = createRateLimiter({
      storeMode: "postgres",
      postgresStore: createStore({
        increment: async () => { throw new PostgresRateLimitStoreError("RATE_LIMIT_STORE_CAPACITY", "full"); },
      }),
      storeNamespace: "test",
      whitelist: [],
    });
    const response = createResponse();

    await limiter.apply(createRequest("10.0.0.2"), response);
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)?.error?.code).toBe("RATE_LIMIT_STORE_CAPACITY");
    await limiter.close();
  });
});
