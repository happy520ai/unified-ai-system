import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimiter.js";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const SHARED_SECRET = "0123456789abcdef0123456789abcdef";
const describePostgres = connectionString ? describe : describe.skip;

function options(namespace: string, overrides = {}) {
  return {
    windowMs: 60_000,
    maxRequests: 3,
    whitelist: [],
    storeMode: "postgres",
    storeNamespace: namespace,
    postgresConnectionString: connectionString,
    postgresSecret: SHARED_SECRET,
    postgresPoolMax: 2,
    postgresStatementTimeoutMs: 5_000,
    postgresMaxBuckets: 100_000,
    ...overrides,
  };
}

describePostgres("real PostgreSQL distributed rate limiting", () => {
  it("fails closed when the bounded bucket store reaches capacity", async () => {
    const namespace = `capacity:${randomUUID()}`;
    const limiter = createRateLimiter(options(namespace, { maxRequests: 10, postgresMaxBuckets: 1 }));

    await expect(limiter.check("10.10.0.1")).resolves.toMatchObject({ allowed: true, remaining: 9 });
    await expect(limiter.check("10.10.0.2")).resolves.toMatchObject({
      allowed: false,
      statusCode: 503,
      code: "RATE_LIMIT_STORE_CAPACITY",
    });
    await limiter.close();
  }, 15_000);

  it("enforces one atomic quota across independent pools and isolates namespaces", async () => {
    const namespace = `shared:${randomUUID()}`;
    const isolatedNamespace = `isolated:${randomUUID()}`;
    const first = createRateLimiter(options(namespace));
    const second = createRateLimiter(options(namespace));
    const isolated = createRateLimiter(options(isolatedNamespace));

    const firstPair = await Promise.all([
      first.check("10.20.0.1"),
      second.check("10.20.0.1"),
    ]);
    expect(firstPair.every((result) => result.allowed)).toBe(true);
    await expect(first.check("10.20.0.1")).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(second.check("10.20.0.1")).resolves.toMatchObject({ allowed: false, remaining: 0 });
    await expect(isolated.check("10.20.0.1")).resolves.toMatchObject({ allowed: true, remaining: 2 });
    await expect(first.checkHealth()).resolves.toMatchObject({
      storeMode: "postgres",
      available: true,
      distributed: true,
    });

    await first.close();
    await second.close();
    await isolated.close();
  }, 15_000);
});
