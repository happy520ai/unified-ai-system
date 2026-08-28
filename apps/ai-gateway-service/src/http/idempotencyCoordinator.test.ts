import { describe, expect, it } from "vitest";
import { createIdempotencyCoordinator } from "./idempotencyCoordinator.ts";

function request(key: string, authorization = "Bearer tenant-a") {
  return {
    headers: { "idempotency-key": key, authorization },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

describe("idempotency coordinator", () => {
  it("requires verify-full TLS for non-loopback PostgreSQL", () => {
    expect(() => createIdempotencyCoordinator({
      env: {
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "postgres",
        AI_GATEWAY_IDEMPOTENCY_POSTGRES_URL: "postgresql://gateway@db.example.test/gateway",
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "x".repeat(64),
      },
    })).toThrow(expect.objectContaining({
      code: "IDEMPOTENCY_POSTGRES_TLS_VERIFY_REQUIRED",
    }));
  });

  it("coalesces concurrent requests and replays one result", async () => {
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret" });
    let calls = 0;
    let release!: (value: { statusCode: number }) => void;
    const pending = new Promise<{ statusCode: number }>((resolve) => { release = resolve; });
    const operation = async () => {
      calls += 1;
      return pending;
    };

    const first = coordinator.execute({ request: request("idem-1"), route: "/chat", payload: { prompt: "hello" }, operation });
    const second = coordinator.execute({ request: request("idem-1"), route: "/chat", payload: { prompt: "hello" }, operation });
    release({ statusCode: 200 });

    await expect(first).resolves.toMatchObject({ status: "created", replayed: false });
    await expect(second).resolves.toMatchObject({ status: "replayed", replayed: true });
    expect(calls).toBe(1);
  });

  it("treats canonical object key order as the same payload", async () => {
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret" });
    let calls = 0;
    const operation = async () => ({ call: ++calls });

    await coordinator.execute({ request: request("idem-2"), route: "/chat", payload: { a: 1, b: 2 }, operation });
    const replay = await coordinator.execute({ request: request("idem-2"), route: "/chat", payload: { b: 2, a: 1 }, operation });

    expect(replay).toMatchObject({ status: "replayed", replayed: true, value: { call: 1 } });
    expect(calls).toBe(1);
  });

  it("rejects reuse with a different payload", async () => {
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret" });
    let calls = 0;
    const operation = async () => ({ call: ++calls });

    await coordinator.execute({ request: request("idem-3"), route: "/chat", payload: { prompt: "one" }, operation });
    const conflict = await coordinator.execute({ request: request("idem-3"), route: "/chat", payload: { prompt: "two" }, operation });

    expect(conflict).toMatchObject({ accepted: false, statusCode: 409, code: "IDEMPOTENCY_KEY_REUSED" });
    expect(calls).toBe(1);
  });

  it("scopes the same key to the authenticated caller", async () => {
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret" });
    let calls = 0;
    const operation = async () => ({ call: ++calls });

    await coordinator.execute({ request: request("shared-key", "Bearer tenant-a"), route: "/chat", payload: {}, operation });
    await coordinator.execute({ request: request("shared-key", "Bearer tenant-b"), route: "/chat", payload: {}, operation });

    expect(calls).toBe(2);
  });

  it("expires entries and permits a new operation", async () => {
    let timestamp = 1_000;
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret", ttlMs: 1_000, now: () => timestamp });
    let calls = 0;
    const operation = async () => ({ call: ++calls });

    await coordinator.execute({ request: request("idem-4"), route: "/chat", payload: {}, operation });
    timestamp = 2_001;
    const next = await coordinator.execute({ request: request("idem-4"), route: "/chat", payload: {}, operation });

    expect(next).toMatchObject({ status: "created", value: { call: 2 } });
  });

  it("keeps a tombstone when a result is too large to replay", async () => {
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret", maxResultBytes: 16 });
    let calls = 0;
    const operation = async () => ({ body: "a result larger than sixteen bytes", call: ++calls });

    await coordinator.execute({ request: request("idem-5"), route: "/chat", payload: {}, operation });
    const replay = await coordinator.execute({ request: request("idem-5"), route: "/chat", payload: {}, operation });

    expect(replay).toMatchObject({ accepted: false, statusCode: 409, code: "IDEMPOTENCY_RESULT_NOT_REPLAYABLE" });
    expect(calls).toBe(1);
  });

  it("rejects invalid keys before the operation starts", async () => {
    const coordinator = createIdempotencyCoordinator({ secret: "test-secret" });
    let calls = 0;
    const result = await coordinator.execute({
      request: request("contains a space"),
      route: "/chat",
      payload: {},
      operation: async () => ({ call: ++calls }),
    });

    expect(result).toMatchObject({ accepted: false, statusCode: 400, code: "IDEMPOTENCY_KEY_INVALID" });
    expect(calls).toBe(0);
  });

  it("uses the first untrusted client in a configured proxy chain for network identity", async () => {
    const coordinator = createIdempotencyCoordinator({
      secret: "0123456789abcdef0123456789abcdef",
      trustedProxyCidrs: ["10.0.0.0/8"],
    });
    let calls = 0;
    const proxiedRequest = (client: string) => ({
      headers: { "idempotency-key": "proxied-key", "x-forwarded-for": client },
      socket: { remoteAddress: "10.0.0.5" },
    });

    await coordinator.execute({ request: proxiedRequest("198.51.100.1"), route: "/chat", payload: {}, operation: async () => ({ call: ++calls }) });
    await coordinator.execute({ request: proxiedRequest("198.51.100.2"), route: "/chat", payload: {}, operation: async () => ({ call: ++calls }) });
    const replay = await coordinator.execute({ request: proxiedRequest("198.51.100.1"), route: "/chat", payload: {}, operation: async () => ({ call: ++calls }) });

    expect(calls).toBe(2);
    expect(replay).toMatchObject({ status: "replayed", value: { call: 1 } });
  });

  it("ignores spoofed forwarding headers from an untrusted direct peer", async () => {
    const coordinator = createIdempotencyCoordinator({
      secret: "0123456789abcdef0123456789abcdef",
      trustedProxyCidrs: ["10.0.0.0/8"],
    });
    let calls = 0;
    const untrustedRequest = (spoofedClient: string) => ({
      headers: { "idempotency-key": "spoofed-key", "x-forwarded-for": spoofedClient },
      socket: { remoteAddress: "203.0.113.9" },
    });

    await coordinator.execute({ request: untrustedRequest("198.51.100.1"), route: "/chat", payload: {}, operation: async () => ({ call: ++calls }) });
    const replay = await coordinator.execute({ request: untrustedRequest("198.51.100.2"), route: "/chat", payload: {}, operation: async () => ({ call: ++calls }) });

    expect(calls).toBe(1);
    expect(replay).toMatchObject({ status: "replayed", value: { call: 1 } });
  });
});
