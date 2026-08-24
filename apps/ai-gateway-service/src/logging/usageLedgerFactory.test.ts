import { describe, expect, it, vi } from "vitest";
import { createUsageLedger } from "./usageLedgerFactory.ts";
import type {
  UsageLedgerPostgresClient,
  UsageLedgerPostgresPool,
} from "./postgresUsageLedger.ts";

function createHealthyPool(): UsageLedgerPostgresPool {
  const query = async <Row = Record<string, unknown>>(text: string) => {
    const rows = text.includes("usage-ledger:stats")
      ? [{ row_count: "0" }]
      : [{ healthy: 1 }];
    return { rows: rows as Row[], rowCount: 1 };
  };
  const client: UsageLedgerPostgresClient = {
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

describe("usage ledger selection", () => {
  it("keeps credential-free local preview on the bounded file logger", async () => {
    const ledger = createUsageLedger({ env: {}, realProviderEnabled: false });
    expect(ledger.getHealth()).toMatchObject({
      persistence: "bounded-local-file",
      durableWritesRequired: false,
    });
    await ledger.close();
  });

  it("requires a central ledger for multi-instance real-provider execution", () => {
    expect(() => createUsageLedger({
      env: {
        AI_GATEWAY_MULTI_INSTANCE: "true",
        AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "file",
      },
      realProviderEnabled: true,
    })).toThrow(expect.objectContaining({
      code: "USAGE_LEDGER_CENTRAL_STORE_REQUIRED",
    }));
  });

  it("requires verified TLS for a non-loopback central ledger", () => {
    const credentialBearingUrl = "postgresql://user:must-not-leak@db.example.test/gateway";
    let thrown: unknown;
    try {
      createUsageLedger({
        env: {
          AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "postgres",
          AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL: credentialBearingUrl,
        },
        realProviderEnabled: true,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ code: "USAGE_LEDGER_POSTGRES_TLS_VERIFY_REQUIRED" });
    expect(String((thrown as Error)?.message)).not.toContain("must-not-leak");
  });

  it("reports an injected central pool without exposing connection details", async () => {
    const pool = createHealthyPool();
    const ledger = createUsageLedger({
      env: {
        AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "postgres",
        AI_GATEWAY_USAGE_LEDGER_NAMESPACE: "unit-test",
      },
      realProviderEnabled: true,
      postgresPool: pool,
    });
    await expect(ledger.assertDurable()).resolves.toBe(true);
    expect(ledger.getHealth()).toMatchObject({
      status: "ready",
      persistence: "postgres-central",
      distributed: true,
      available: true,
    });
    expect(ledger.getHealth()).not.toHaveProperty("connectionString");
    await ledger.close();
    expect(pool.end).not.toHaveBeenCalled();
  });
});
