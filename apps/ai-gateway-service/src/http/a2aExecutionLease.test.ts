import { describe, expect, it } from "vitest";
import {
  a2aExecutionLeaseInternals,
  createA2AExecutionLeaseManager,
} from "./a2aExecutionLease.ts";

describe("A2A execution lease configuration", () => {
  it("keeps local task execution disabled and healthy by default", async () => {
    const manager = createA2AExecutionLeaseManager({ env: {} });
    expect(manager.status).toMatchObject({
      mode: "disabled",
      enabled: false,
      distributed: false,
      required: false,
    });
    expect(manager.getHealth()).toMatchObject({
      available: true,
      activeLeases: 0,
    });
    await manager.close();
  });

  it("fails closed if PostgreSQL task state is paired with a disabled lease", () => {
    expect(() => createA2AExecutionLeaseManager({
      env: {
        AI_GATEWAY_A2A_TASK_STORE_MODE: "postgres",
        AI_GATEWAY_A2A_EXECUTION_LEASE_MODE: "disabled",
      },
    })).toThrow(expect.objectContaining({
      code: "A2A_EXECUTION_LEASE_REQUIRED",
    }));
  });

  it("requires verified TLS for a remote lease database", () => {
    expect(() => createA2AExecutionLeaseManager({
      env: {
        AI_GATEWAY_A2A_EXECUTION_LEASE_MODE: "postgres",
        AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_URL: "postgresql://db.example.test/a2a",
      },
    })).toThrow(expect.objectContaining({
      code: "A2A_EXECUTION_LEASE_POSTGRES_TLS_REQUIRED",
    }));
  });

  it("rejects task state and execution fences configured on different databases", () => {
    expect(() => createA2AExecutionLeaseManager({
      env: {
        AI_GATEWAY_A2A_TASK_STORE_MODE: "postgres",
        AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL: "postgresql://gateway@127.0.0.1/tasks",
        AI_GATEWAY_A2A_EXECUTION_LEASE_POSTGRES_URL: "postgresql://gateway@127.0.0.1/leases",
      },
    })).toThrow(expect.objectContaining({
      code: "A2A_EXECUTION_LEASE_DATABASE_MISMATCH",
    }));
  });

  it("derives stable, tenant-and-owner-bound opaque scope identifiers", () => {
    const first = a2aExecutionLeaseInternals.createScopeId({
      tenant: "tenant-a",
      owner: "alice",
    });
    expect(first).toBe(a2aExecutionLeaseInternals.createScopeId({
      tenant: "tenant-a",
      owner: "alice",
    }));
    expect(first).not.toBe(a2aExecutionLeaseInternals.createScopeId({
      tenant: "tenant-b",
      owner: "alice",
    }));
    expect(first).not.toContain("tenant-a");
    expect(first).not.toContain("alice");
  });
});
