import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import { createIdempotencyCoordinator } from "./idempotencyCoordinator.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const SHARED_SECRET = "0123456789abcdef0123456789abcdef";
const describePostgres = connectionString ? describe : describe.skip;

function options(overrides = {}) {
  return {
    storeMode: "postgres" as const,
    postgresConnectionString: connectionString,
    secret: SHARED_SECRET,
    leaseMs: 1_000,
    inFlightWaitMs: 3_000,
    pollIntervalMs: 25,
    postgresPoolMax: 2,
    postgresStatementTimeoutMs: 5_000,
    ...overrides,
  };
}

function request(key: string) {
  return {
    headers: { "idempotency-key": key, authorization: "Bearer ci-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

describePostgres("real PostgreSQL idempotency integration", () => {
  it("atomically coalesces and durably replays across independent pools", async () => {
    const key = `postgres-integration-${randomUUID()}`;
    const owner = createIdempotencyCoordinator(options());
    const duplicate = createIdempotencyCoordinator(options());
    let calls = 0;
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const execution = {
      request: request(key),
      route: "/chat",
      payload: { messages: [{ role: "user", content: "execute exactly once" }] },
    };

    const firstPromise = owner.execute({
      ...execution,
      operation: async () => {
        calls += 1;
        markStarted();
        await pending;
        return { statusCode: 200, payload: { provider: "fake", response: "one" } };
      },
    });
    await started;
    const duplicatePromise = duplicate.execute({
      ...execution,
      operation: async () => ({ call: ++calls }),
    });
    await delay(100);
    release();
    const [first, second] = await Promise.all([firstPromise, duplicatePromise]);

    expect(first).toMatchObject({ status: "created", replayed: false, replayable: true });
    expect(second).toMatchObject({ status: "replayed", replayed: true, replayable: true, value: first.value });
    expect(calls).toBe(1);
    await owner.close();
    await duplicate.close();

    const successor = createIdempotencyCoordinator(options());
    const replay = await successor.execute({
      ...execution,
      operation: async () => ({ call: ++calls }),
    });
    const health = await successor.checkHealth?.();
    expect(replay).toMatchObject({ status: "replayed", replayed: true, replayable: true, value: first.value });
    expect(health).toMatchObject({ storeMode: "postgres", available: true, distributed: true });
    expect(calls).toBe(1);
    await successor.close();
  }, 15_000);

  it("turns an expired owner lease into an unknown tombstone without re-execution", async () => {
    const key = `postgres-expired-owner-${randomUUID()}`;
    const owner = createIdempotencyCoordinator(options());
    const successor = createIdempotencyCoordinator(options());
    let calls = 0;
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const execution = {
      request: request(key),
      route: "/chat",
      payload: { messages: [{ role: "user", content: "unknown outcome" }] },
    };

    const ownerPromise = owner.execute({
      ...execution,
      operation: async () => {
        calls += 1;
        markStarted();
        await pending;
        return { statusCode: 200 };
      },
    });
    await started;
    await owner.close();
    await delay(1_150);

    const outcome = await successor.execute({
      ...execution,
      operation: async () => ({ call: ++calls }),
    });
    expect(outcome).toMatchObject({
      accepted: false,
      statusCode: 409,
      code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
      retryable: false,
    });
    expect(calls).toBe(1);

    release();
    await expect(ownerPromise).resolves.toMatchObject({ status: "created-unconfirmed", replayable: false });
    await successor.close();
  }, 15_000);
});
