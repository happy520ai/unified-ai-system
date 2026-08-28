import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createEnterpriseAuditStore } from "./enterpriseAuditStoreFactory.ts";
import type {
  AuditPostgresClient,
  AuditPostgresPool,
} from "./postgresAuditStore.ts";

const KEY_HEX = "42".repeat(32);
const KEY = Buffer.from(KEY_HEX, "hex");

function createHealthyPool(namespace: string): AuditPostgresPool {
  const stateHmac = createHmac("sha256", KEY)
    .update(`enterprise-audit-state:v1:${namespace}:0:GENESIS`)
    .digest("hex");
  const query = async <Row = Record<string, unknown>>(text: string) => {
    let rows: unknown[] = [];
    if (text.includes("enterprise-audit:init-count")) rows = [{ count: "0" }];
    if (text.includes("enterprise-audit:state") && !text.includes("state-lock")) {
      rows = [{ last_sequence: "0", last_hash: "GENESIS", state_hmac: stateHmac }];
    }
    return { rows: rows as Row[], rowCount: rows.length };
  };
  const client: AuditPostgresClient = {
    query,
    release: vi.fn(),
  };
  return {
    query,
    connect: vi.fn(async () => client),
    end: vi.fn(async () => undefined),
    on: vi.fn(),
  };
}

describe("enterprise audit store selection", () => {
  it("keeps the local signed chain as the single-process default", () => {
    expect(createEnterpriseAuditStore({ env: {} })).toEqual({
      mode: "file",
      required: false,
      store: null,
    });
  });

  it("requires a central audit store for multi-instance real-provider execution", () => {
    expect(() => createEnterpriseAuditStore({
      env: {
        AI_GATEWAY_MULTI_INSTANCE: "true",
        PME_AUDIT_STORE_MODE: "file",
      },
      realProviderEnabled: true,
    })).toThrow(expect.objectContaining({
      code: "AUDIT_CENTRAL_STORE_REQUIRED",
    }));
  });

  it("requires verified TLS without exposing a credential-bearing URL", () => {
    const connectionString = "postgresql://audit:must-not-leak@db.example.test/gateway";
    let thrown: unknown;
    try {
      createEnterpriseAuditStore({
        env: {
          PME_AUDIT_STORE_MODE: "postgres",
          PME_AUDIT_POSTGRES_URL: connectionString,
          PME_AUDIT_POSTGRES_HMAC_KEY: `hex:${KEY_HEX}`,
        },
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: "AUDIT_POSTGRES_TLS_VERIFY_REQUIRED" });
    expect(String((thrown as Error)?.message)).not.toContain("must-not-leak");
  });

  it("initializes an injected HMAC-backed store with a safe health snapshot", async () => {
    const namespace = "unit-test";
    const pool = createHealthyPool(namespace);
    const handle = createEnterpriseAuditStore({
      env: {
        PME_AUDIT_STORE_MODE: "postgres",
        PME_AUDIT_POSTGRES_NAMESPACE: namespace,
        PME_AUDIT_POSTGRES_HMAC_KEY: `hex:${KEY_HEX}`,
      },
      postgresPool: pool,
    });
    expect(handle.store).not.toBeNull();
    await expect(handle.store?.checkHealth()).resolves.toMatchObject({
      status: "ready",
      mode: "postgres-hmac-chain",
      distributed: true,
      sequence: 0,
      externalRetentionVerified: false,
    });
    expect(handle.store?.getHealth()).not.toHaveProperty("connectionString");
    await handle.store?.close();
    expect(pool.end).not.toHaveBeenCalled();
  });
});
