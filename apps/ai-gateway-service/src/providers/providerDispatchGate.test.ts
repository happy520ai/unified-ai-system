import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it } from "vitest";

import { createIdempotencyCoordinator } from "../http/idempotencyCoordinator.ts";
import {
  createProviderDispatchGate,
  type ProviderDispatchGate,
  type ProviderDispatchReservationInput,
} from "./providerDispatchGate.ts";

const temporaryDirectories: string[] = [];
const openGates: ProviderDispatchGate[] = [];

afterEach(async () => {
  await Promise.allSettled(openGates.splice(0).map((gate) => gate.close()));
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createSqliteEnvironment(overrides: Record<string, string | undefined> = {}) {
  const directory = mkdtempSync(join(tmpdir(), "provider-dispatch-"));
  temporaryDirectories.push(directory);
  return {
    directory,
    sqlitePath: join(directory, "dispatch.sqlite"),
    env: {
      AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "sqlite",
      AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH: join(directory, "dispatch.sqlite"),
      AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: "dispatch-secret-".padEnd(64, "x"),
      ...overrides,
    },
  };
}

function createTrackedGate(env: Record<string, string | undefined>) {
  const gate = createProviderDispatchGate({ env, realProviderEnabled: true });
  openGates.push(gate);
  return gate;
}

function reservation(overrides: ProviderDispatchReservationInput = {}): ProviderDispatchReservationInput {
  return {
    dispatchKeyHash: digest("client-operation-1"),
    route: "/v1/chat/completions",
    invocation: 1,
    attempt: 1,
    shadow: false,
    tenantId: "tenant-private",
    providerId: "provider-private",
    modelId: "model-private",
    requestFingerprint: digest("normalized-request-1"),
    ...overrides,
  };
}

describe("provider dispatch gate", () => {
  it("stays disabled for credential-free fake-provider mode", async () => {
    const gate = createProviderDispatchGate({ env: {}, realProviderEnabled: false });
    openGates.push(gate);

    await expect(gate.reserve({ dispatchKeyInvalid: true })).resolves.toEqual({
      reserved: false,
      bypassed: true,
      reservationFingerprint: null,
    });
    expect(gate.status).toMatchObject({ mode: "disabled", enabled: false, durable: false });
  });

  it("requires a valid client key before a real-provider reservation", async () => {
    const { env } = createSqliteEnvironment();
    const gate = createTrackedGate(env);

    await expect(gate.reserve(reservation({ dispatchKeyHash: undefined }))).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_KEY_REQUIRED",
      statusCode: 400,
      category: "validation",
    });
    await expect(gate.reserve(reservation({ dispatchKeyInvalid: true }))).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_KEY_INVALID",
      statusCode: 400,
      category: "validation",
    });
    expect(gate.getHealth()).toMatchObject({ entries: 0, tombstones: 0, available: true });
  });

  it("commits a durable tombstone and blocks duplicate or conflicting dispatch", async () => {
    const { env, sqlitePath } = createSqliteEnvironment();
    const gate = createTrackedGate(env);
    const input = reservation();

    const first = await gate.reserve(input);
    expect(first).toMatchObject({ reserved: true, bypassed: false });
    expect(first.reservationFingerprint).toMatch(/^[a-f0-9]{16}$/u);
    await expect(gate.reserve(input)).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
      statusCode: 409,
      retryable: false,
    });
    await expect(gate.reserve(reservation({ requestFingerprint: digest("changed-request") })))
      .rejects.toMatchObject({ code: "PROVIDER_DISPATCH_KEY_REUSED", statusCode: 409 });

    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    const rows = db.prepare(`
      SELECT identity, fingerprint, state, result_json
      FROM idempotency_entries
    `).all() as Array<Record<string, unknown>>;
    db.close();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: "oversized", result_json: null });
    const persisted = JSON.stringify(rows);
    expect(persisted).not.toContain("client-operation-1");
    expect(persisted).not.toContain("tenant-private");
    expect(persisted).not.toContain("provider-private");
    expect(persisted).not.toContain("model-private");
  });

  it("uses independent lanes for invocation, fallback attempt, and shadow traffic", async () => {
    const { env } = createSqliteEnvironment();
    const gate = createTrackedGate(env);

    await expect(gate.reserve(reservation())).resolves.toMatchObject({ reserved: true });
    await expect(gate.reserve(reservation({ invocation: 2 }))).resolves.toMatchObject({ reserved: true });
    await expect(gate.reserve(reservation({ attempt: 2 }))).resolves.toMatchObject({ reserved: true });
    await expect(gate.reserve(reservation({ shadow: true }))).resolves.toMatchObject({ reserved: true });
    expect(gate.getHealth()).toMatchObject({ entries: 4, tombstones: 4 });
  });

  it("blocks a replay after process restart", async () => {
    const { env } = createSqliteEnvironment();
    const first = createTrackedGate(env);
    await first.reserve(reservation());
    await first.close();
    openGates.splice(openGates.indexOf(first), 1);

    const restarted = createTrackedGate(env);
    await expect(restarted.reserve(reservation())).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
      statusCode: 409,
    });
  });

  it("allows only one owner across two SQLite gateway processes", async () => {
    const { env } = createSqliteEnvironment();
    const left = createTrackedGate(env);
    const right = createTrackedGate(env);

    const settled = await Promise.allSettled([
      left.reserve(reservation()),
      right.reserve(reservation()),
    ]);
    expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((entry) => entry.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "PROVIDER_DISPATCH_ALREADY_RESERVED" },
    });
  });

  it("supports an explicit compatibility bypass while reporting it", async () => {
    const { env } = createSqliteEnvironment({
      AI_GATEWAY_PROVIDER_DISPATCH_KEY_REQUIRED: "false",
    });
    const gate = createTrackedGate(env);

    await expect(gate.reserve(reservation({ dispatchKeyHash: undefined }))).resolves.toEqual({
      reserved: false,
      bypassed: true,
      reservationFingerprint: null,
    });
    expect(gate.status.required).toBe(false);
    expect(gate.getHealth()).toMatchObject({ entries: 0, available: true });
  });

  it("reports bounded-store capacity separately from a consumed key", async () => {
    const { env } = createSqliteEnvironment({ AI_GATEWAY_PROVIDER_DISPATCH_MAX_ENTRIES: "1" });
    const gate = createTrackedGate(env);
    await gate.reserve(reservation());

    await expect(gate.reserve(reservation({
      dispatchKeyHash: digest("client-operation-2"),
    }))).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_CAPACITY_REACHED",
      statusCode: 503,
      category: "persistence",
      retryable: true,
    });
  });

  it("honors the provider-specific capacity ceiling above HTTP replay defaults", () => {
    const { env } = createSqliteEnvironment({ AI_GATEWAY_PROVIDER_DISPATCH_MAX_ENTRIES: "200000" });
    const gate = createTrackedGate(env);
    expect(gate.getHealth()).toMatchObject({ maxEntries: 200_000 });
  });

  it("requires central PostgreSQL reservations for multi-instance real-provider mode", () => {
    const { env } = createSqliteEnvironment({ AI_GATEWAY_MULTI_INSTANCE: "true" });
    expect(() => createProviderDispatchGate({ env, realProviderEnabled: true })).toThrow(
      expect.objectContaining({ code: "PROVIDER_DISPATCH_CENTRAL_STORE_REQUIRED" }),
    );
  });

  it("rejects an explicitly weak secret instead of silently generating another one", () => {
    const { env } = createSqliteEnvironment({
      AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: "too-short",
    });
    expect(() => createProviderDispatchGate({ env, realProviderEnabled: true })).toThrow(
      expect.objectContaining({ code: "PROVIDER_DISPATCH_HMAC_SECRET_REQUIRED" }),
    );
  });

  it("requires verify-full TLS and database co-location for central reservations", () => {
    const secret = "central-dispatch-secret-".padEnd(64, "z");
    expect(() => createProviderDispatchGate({
      realProviderEnabled: true,
      env: {
        AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "postgres",
        AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL: "postgresql://gateway@db.example.test/gateway",
        AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: secret,
      },
    })).toThrow(expect.objectContaining({ code: "IDEMPOTENCY_POSTGRES_TLS_VERIFY_REQUIRED" }));

    expect(() => createProviderDispatchGate({
      realProviderEnabled: true,
      env: {
        AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "postgres",
        AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL: "postgresql://gateway@127.0.0.1/dispatch",
        AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL: "postgresql://gateway@127.0.0.1/usage",
        AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: secret,
      },
    })).toThrow(expect.objectContaining({ code: "PROVIDER_DISPATCH_DATABASE_MISMATCH" }));
  });

  it("rejects an injected in-memory coordinator as non-durable", async () => {
    const coordinator = createIdempotencyCoordinator();
    expect(() => createProviderDispatchGate({
      realProviderEnabled: true,
      coordinator,
    })).toThrow(expect.objectContaining({ code: "PROVIDER_DISPATCH_COORDINATOR_NOT_DURABLE" }));
    await coordinator.close();
  });

  it("fails closed when durable confirmation is lost", async () => {
    const coordinator = {
      async execute<T>() {
        return {
          accepted: true as const,
          status: "created-unconfirmed" as const,
          replayed: false,
          replayable: false,
          value: { reserved: true } as T,
        };
      },
      getStats() {
        return {
          entries: 1,
          inFlight: 1,
          replayable: 0,
          tombstones: 0,
          ttlMs: 60_000,
          maxEntries: 10,
          maxResultBytes: 1,
          storeMode: "sqlite" as const,
        };
      },
      close() {},
    };
    const gate = createProviderDispatchGate({
      realProviderEnabled: true,
      coordinator,
    });
    openGates.push(gate);

    await expect(gate.reserve(reservation())).rejects.toMatchObject({
      code: "PROVIDER_DISPATCH_RESERVATION_UNCONFIRMED",
      statusCode: 409,
      retryable: false,
    });
  });
});
