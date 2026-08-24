import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createWorkforceExecutionControl,
  workforceExecutionControlFactoryInternals,
} from "./workforceExecutionControlFactory.ts";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("Workforce execution control store selection", () => {
  it("keeps local atomic state as the credential-free single-instance default", async () => {
    const executionDir = await mkdtemp(join(tmpdir(), "workforce-control-local-"));
    cleanupPaths.push(executionDir);
    const control = createWorkforceExecutionControl({ env: {}, executionDir });
    try {
      expect(control.getHealth()).toMatchObject({
        mode: "local-atomic-json",
        durable: true,
        distributed: false,
        available: true,
      });
      const approved = await control.approvalGate.approve({
        planId: "plan-a",
        tenantId: "tenant-a",
        userId: "alice",
        planDigest: "a".repeat(64),
        approvedScopes: ["workforce:execute"],
      });
      expect(approved).toMatchObject({ success: true, status: "approved" });
      await control.lifecycle.initialize("execution-a", {});
      await control.lifecycle.start("execution-a");
      await expect(control.lifecycle.getStatus("execution-a"))
        .resolves.toMatchObject({ status: "running" });
    } finally {
      await control.close();
    }
  });

  it("fails closed when multi-instance execution selects local control state", () => {
    expect(() => createWorkforceExecutionControl({
      env: {
        AI_GATEWAY_MULTI_INSTANCE: "true",
        WORKFORCE_EXECUTION_ENABLED: "true",
        AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE: "local",
      },
    })).toThrow(expect.objectContaining({ code: "WORKFORCE_CONTROL_CENTRAL_STORE_REQUIRED" }));
  });

  it("requires one PostgreSQL database for control, queue, and claims", () => {
    expect(() => createWorkforceExecutionControl({
      env: {
        AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE: "postgres",
        AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL: "postgresql://control@127.0.0.1/control",
        AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: "postgresql://queue@127.0.0.1/queue",
      },
    })).toThrow(expect.objectContaining({ code: "WORKFORCE_CONTROL_DATABASE_MISMATCH" }));
  });

  it("requires verify-full TLS for non-loopback databases", () => {
    expect(() => workforceExecutionControlFactoryInternals.assertSecurePostgresUrl(
      "postgresql://gateway@db.example.test/gateway?sslmode=require",
      {},
    )).toThrow(expect.objectContaining({ code: "WORKFORCE_CONTROL_POSTGRES_TLS_VERIFY_REQUIRED" }));
    expect(() => workforceExecutionControlFactoryInternals.assertSecurePostgresUrl(
      "postgresql://gateway@db.example.test/gateway?sslmode=verify-full",
      {},
    )).not.toThrow();
  });
});
