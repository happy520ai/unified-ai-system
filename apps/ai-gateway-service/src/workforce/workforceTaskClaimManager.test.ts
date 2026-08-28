import { describe, expect, it, vi } from "vitest";
import { createWorkforceTaskClaimManager } from "./workforceTaskClaimManager.ts";
import type {
  WorkforceClaimPostgresClient,
  WorkforceClaimPostgresPool,
} from "./postgresTaskClaimLease.ts";

function createHealthyPool(): WorkforceClaimPostgresPool {
  const query = async <Row = Record<string, unknown>>(text: string) => {
    const rows = text.includes("workforce-claim:stats")
      ? [{ count: "0" }]
      : [{ healthy: 1 }];
    return { rows: rows as Row[], rowCount: 1 };
  };
  const client: WorkforceClaimPostgresClient = {
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

describe("Workforce task claim manager selection", () => {
  it("keeps local preview on the bounded in-process fenced manager", () => {
    const manager = createWorkforceTaskClaimManager({ env: {} });
    expect(manager.getInfo()).toMatchObject({
      mode: "memory-fenced",
      distributed: false,
      rawTokenRetained: false,
      timerCount: 0,
    });
    void manager.close();
  });

  it("fails closed when real multi-instance Workforce execution lacks PostgreSQL claims", () => {
    expect(() => createWorkforceTaskClaimManager({
      env: {
        AI_GATEWAY_MULTI_INSTANCE: "true",
        WORKFORCE_EXECUTION_ENABLED: "true",
        AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "memory",
      },
    })).toThrow(expect.objectContaining({
      code: "WORKFORCE_CLAIM_DISTRIBUTED_STORE_REQUIRED",
    }));
  });

  it("requires verified TLS for non-loopback PostgreSQL claim stores", () => {
    const credentialBearingUrl = "postgresql://user:must-not-leak@db.example.test/gateway";
    let thrown: unknown;
    try {
      createWorkforceTaskClaimManager({
        env: {
          AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "postgres",
          AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL: credentialBearingUrl,
        },
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      code: "WORKFORCE_CLAIM_POSTGRES_TLS_VERIFY_REQUIRED",
    });
    expect(String((thrown as Error)?.message)).not.toContain("must-not-leak");
  });

  it("initializes an injected PostgreSQL pool without exposing connection details", async () => {
    const pool = createHealthyPool();
    const manager = createWorkforceTaskClaimManager({
      env: {
        AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "postgres",
        AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE: "integration-test",
      },
      postgresPool: pool,
    });

    await expect(manager.checkHealth()).resolves.toMatchObject({
      mode: "postgres-fenced",
      distributed: true,
      available: true,
      activeClaims: 0,
    });
    expect(manager.getInfo()).not.toHaveProperty("connectionString");
    await manager.close();
    expect(pool.end).not.toHaveBeenCalled();
  });
});
