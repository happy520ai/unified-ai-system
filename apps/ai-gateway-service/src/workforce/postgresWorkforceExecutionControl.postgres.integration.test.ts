import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createWorkforceExecutionControl } from "./workforceExecutionControlFactory.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

function createControl(namespace: string) {
  return createWorkforceExecutionControl({
    env: {
      AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE: "postgres",
      AI_GATEWAY_WORKFORCE_CONTROL_CENTRAL_REQUIRED: "true",
      AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL: connectionString,
      AI_GATEWAY_WORKFORCE_CONTROL_NAMESPACE: namespace,
      AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_STATEMENT_TIMEOUT_MS: "5000",
      AI_GATEWAY_WORKFORCE_CONTROL_APPROVAL_TTL_MS: "60000",
      AI_GATEWAY_WORKFORCE_CONTROL_RETENTION_MS: "60000",
      AI_GATEWAY_WORKFORCE_CONTROL_MAX_APPROVALS: "20",
      AI_GATEWAY_WORKFORCE_CONTROL_MAX_EXECUTIONS: "20",
      AI_GATEWAY_WORKFORCE_CONTROL_MAX_STATE_BYTES: "65536",
    },
  });
}

const planDigest = "a".repeat(64);
const requiredScopes = ["workforce:execute"];

function approvalContext(overrides: Record<string, unknown> = {}) {
  return {
    planId: "shared-public-plan",
    tenantId: "tenant-a",
    userId: "alice@example.test",
    planDigest,
    requiredScopes,
    ...overrides,
  };
}

describePostgres("real PostgreSQL Workforce execution control", () => {
  it("atomically shares and single-consumes tenant-scoped approvals without raw identifiers", async () => {
    const namespace = `wf-control-${randomUUID()}`;
    const first = createControl(namespace);
    const second = createControl(namespace);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      await expect(first.checkHealth()).resolves.toMatchObject({ available: true, distributed: true });
      await first.approvalGate.approve({
        ...approvalContext(),
        approvedScopes: requiredScopes,
        note: "password=supersecret123",
      });

      await expect(second.approvalGate.check(approvalContext()))
        .resolves.toMatchObject({ approved: true, code: "APPROVAL_VALID" });
      await expect(second.approvalGate.check(approvalContext({ tenantId: "tenant-b" })))
        .resolves.toMatchObject({ approved: false, code: "APPROVAL_NOT_FOUND" });
      await expect(second.approvalGate.check(approvalContext({ userId: "mallory" })))
        .resolves.toMatchObject({ approved: false, code: "APPROVAL_SUBJECT_MISMATCH" });

      const consumed = await Promise.all([
        first.approvalGate.consume(approvalContext()),
        second.approvalGate.consume(approvalContext()),
      ]);
      expect(consumed.filter((result: any) => result.consumed === true)).toHaveLength(1);
      expect(consumed.filter((result: any) => result.approved === false)).toHaveLength(1);

      const rows = await inspector.query(`
        SELECT tenant_digest, plan_key, user_digest, note, status
        FROM public.ai_gateway_workforce_execution_approvals
        WHERE namespace = $1
      `, [namespace]);
      expect(rows.rows).toHaveLength(1);
      const persisted = JSON.stringify(rows.rows);
      expect(persisted).not.toContain("tenant-a");
      expect(persisted).not.toContain("shared-public-plan");
      expect(persisted).not.toContain("alice@example.test");
      expect(persisted).not.toContain("supersecret123");
      expect(rows.rows[0]).toMatchObject({ status: "consumed" });
      expect(rows.rows[0].note).toContain("****");
    } finally {
      await cleanupNamespace(inspector, namespace);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);

  it("shares versioned lifecycle cancellation and rejects corrupt central state", async () => {
    const namespace = `wf-lifecycle-${randomUUID()}`;
    const executionId = `wf-scope-${randomUUID()}`;
    const first = createControl(namespace);
    const second = createControl(namespace);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      await first.checkHealth();
      await second.checkHealth();
      await first.lifecycle.initialize(executionId, {
        publicPlanId: "plan-a",
        tenantFingerprint: `idfp_${"a".repeat(16)}`,
      });
      await second.lifecycle.start(executionId);
      await first.lifecycle.cancel(executionId, "remote operator cancellation");
      await expect(second.lifecycle.getStatus(executionId)).resolves.toMatchObject({
        status: "running",
        cancelRequested: true,
      });
      await second.lifecycle.onAgentCompleted(executionId, "backend-engineer", { success: true });
      await expect(first.lifecycle.getStatus(executionId)).resolves.toMatchObject({
        status: "cancelled",
        cancelRequested: false,
        completedAgents: 1,
      });

      const rows = await inspector.query(`
        SELECT execution_digest, execution_fingerprint, status, state_json, version
        FROM public.ai_gateway_workforce_execution_runs
        WHERE namespace = $1
      `, [namespace]);
      expect(rows.rows).toHaveLength(1);
      expect(JSON.stringify(rows.rows)).not.toContain(executionId);
      expect(rows.rows[0]).toMatchObject({ status: "cancelled" });
      expect(Number(rows.rows[0].version)).toBeGreaterThanOrEqual(4);

      await inspector.query(`
        UPDATE public.ai_gateway_workforce_execution_runs
        SET state_json = '{"tampered":true}'
        WHERE namespace = $1
      `, [namespace]);
      await expect(second.lifecycle.getStatus(executionId))
        .rejects.toMatchObject({ code: "WORKFORCE_LIFECYCLE_STATE_CORRUPT" });
      expect(second.lifecycle.getHealth()).toMatchObject({
        available: false,
        lastFailureCode: "WORKFORCE_LIFECYCLE_STATE_CORRUPT",
      });
    } finally {
      await cleanupNamespace(inspector, namespace);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);
});

async function cleanupNamespace(inspector: Pool, namespace: string) {
  await inspector.query(
    "DELETE FROM public.ai_gateway_workforce_execution_approvals WHERE namespace = $1",
    [namespace],
  ).catch(() => undefined);
  await inspector.query(
    "DELETE FROM public.ai_gateway_workforce_execution_runs WHERE namespace = $1",
    [namespace],
  ).catch(() => undefined);
}
