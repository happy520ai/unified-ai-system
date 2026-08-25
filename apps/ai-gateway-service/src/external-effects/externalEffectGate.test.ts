import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createExternalEffectGate, externalEffectGateInternals } from "./externalEffectGate.ts";

const temporaryDirectories: string[] = [];
const SHARED_SECRET = "external-effect-test-secret".padEnd(64, "x");

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createSqliteGate(dbPath: string) {
  return createExternalEffectGate({
    enabled: true,
    env: {
      AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
      AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: dbPath,
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: SHARED_SECRET,
      AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS: "60000",
      AI_GATEWAY_EXTERNAL_EFFECT_MAX_ENTRIES: "20",
    },
  });
}

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    effectKeyHash: digest("operation-1"),
    route: "/connectors/feishu/send",
    tenantId: "tenant-a",
    effectType: "webhook:feishu",
    payloadFingerprint: digest("payload-1"),
    ...overrides,
  };
}

describe("durable external-effect gate", () => {
  it("reserves once, validates a fence at reserve and commit, and rejects replay", async () => {
    const root = mkdtempSync(join(tmpdir(), "external-effect-gate-"));
    temporaryDirectories.push(root);
    const gate = createSqliteGate(join(root, "effects.sqlite"));
    const assertFence = vi.fn(async (phase: "reserve" | "commit") => Boolean(phase));

    const first = await gate.reserve(reservation({
      fenceRequired: true,
      fenceFingerprint: digest("fence-7"),
      assertFence,
    }));
    expect(first).toMatchObject({ reserved: true, bypassed: false });
    expect(first.reservationFingerprint).toMatch(/^[a-f0-9]{16}$/u);
    await first.commit();
    await first.commit();
    expect(assertFence.mock.calls.map(([phase]) => phase)).toEqual(["reserve", "commit"]);

    await expect(gate.reserve(reservation({
      fenceRequired: true,
      fenceFingerprint: digest("fence-7"),
      assertFence,
    }))).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_ALREADY_RESERVED", statusCode: 409 });
    await expect(gate.reserve(reservation({
      payloadFingerprint: digest("different-payload"),
      fenceRequired: true,
      fenceFingerprint: digest("fence-7"),
      assertFence,
    }))).rejects.toMatchObject({ code: "EXTERNAL_EFFECT_KEY_REUSED", statusCode: 409 });
    expect(gate.getHealth()).toMatchObject({
      mode: "sqlite",
      enabled: true,
      available: true,
      entries: 1,
      tombstones: 1,
    });
    await gate.close();
  });

  it("keeps the tombstone when the fence becomes stale at commit", async () => {
    const root = mkdtempSync(join(tmpdir(), "external-effect-fence-"));
    temporaryDirectories.push(root);
    const gate = createSqliteGate(join(root, "effects.sqlite"));
    const assertFence = vi.fn(async (phase: string) => phase === "reserve");
    const input = reservation({
      fenceRequired: true,
      fenceFingerprint: digest("fence-9"),
      assertFence,
    });

    const first = await gate.reserve(input);
    await expect(first.commit()).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_FENCE_INACTIVE",
      statusCode: 409,
    });
    await expect(gate.reserve(input)).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_ALREADY_RESERVED",
    });
    await gate.close();
  });

  it("coordinates the same operation across two SQLite gate instances", async () => {
    const root = mkdtempSync(join(tmpdir(), "external-effect-shared-"));
    temporaryDirectories.push(root);
    const dbPath = join(root, "effects.sqlite");
    const first = createSqliteGate(dbPath);
    const second = createSqliteGate(dbPath);

    await expect(first.reserve(reservation())).resolves.toMatchObject({ reserved: true });
    await expect(second.reserve(reservation())).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_ALREADY_RESERVED",
    });
    await Promise.all([first.close(), second.close()]);
  });

  it("fails closed when disabled, keyless, or missing a required fence", async () => {
    const disabled = createExternalEffectGate();
    await expect(disabled.reserve(reservation())).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_GATE_UNAVAILABLE",
      statusCode: 503,
    });

    const root = mkdtempSync(join(tmpdir(), "external-effect-invalid-"));
    temporaryDirectories.push(root);
    const gate = createSqliteGate(join(root, "effects.sqlite"));
    await expect(gate.reserve(reservation({ effectKeyHash: undefined }))).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_KEY_REQUIRED",
      statusCode: 400,
    });
    await expect(gate.reserve(reservation({ fenceRequired: true }))).rejects.toMatchObject({
      code: "EXTERNAL_EFFECT_FENCE_REQUIRED",
      statusCode: 409,
    });
    await gate.close();
  });

  it("requires PostgreSQL for multi-instance mode and the Workforce database target", () => {
    expect(() => createExternalEffectGate({
      enabled: true,
      env: {
        AI_GATEWAY_MULTI_INSTANCE: "true",
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: SHARED_SECRET,
      },
    })).toThrow(expect.objectContaining({ code: "EXTERNAL_EFFECT_CENTRAL_STORE_REQUIRED" }));

    expect(() => createExternalEffectGate({
      enabled: true,
      env: {
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "postgres",
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: SHARED_SECRET,
        AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL: "postgresql://gateway@db.example/effects?sslmode=verify-full",
        AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: "postgresql://gateway@db.example/workforce?sslmode=verify-full",
      },
    })).toThrow(expect.objectContaining({ code: "EXTERNAL_EFFECT_DATABASE_MISMATCH" }));

    expect(externalEffectGateInternals.samePostgresTarget(
      "postgresql://queue-user@db.example",
      "postgresql://effect-user@db.example",
    )).toBe(false);
    expect(externalEffectGateInternals.samePostgresTarget(
      "postgresql://gateway@db.example",
      "postgresql://gateway@db.example/gateway?sslmode=verify-full",
    )).toBe(true);
  });
});
