import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createWorkforceTaskClaimManager } from "./workforceTaskClaimManager.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

function createManager(namespace: string, ttlMs = 2_000) {
  return createWorkforceTaskClaimManager({
    env: {
      AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "postgres",
      AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL: connectionString,
      AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE: namespace,
      AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_STATEMENT_TIMEOUT_MS: "5000",
    },
    ttlMs,
    maxClaims: 100,
  });
}

describePostgres("real PostgreSQL Workforce task claims", () => {
  it("enforces one cross-pool owner, validates identity, and never stores the bearer", async () => {
    const namespace = `claims-${randomUUID()}`;
    const first = createManager(namespace);
    const second = createManager(namespace);
    const isolated = createManager(`${namespace}-isolated`);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      const issued = await first.issue({
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-a",
      });
      expect(issued).toMatchObject({ success: true, code: "TASK_CLAIM_ISSUED" });
      if (!issued.success) throw new Error(issued.reason);

      await expect(second.issue({
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-b",
      })).resolves.toMatchObject({
        success: false,
        code: "TASK_ALREADY_CLAIMED",
      });
      await expect(second.validate(issued.token, {
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-a",
        fencingToken: issued.fencingToken,
      })).resolves.toMatchObject({ success: true, valid: true });
      await expect(second.validate(issued.token, {
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-b",
      })).resolves.toMatchObject({
        success: false,
        code: "TASK_CLAIM_AGENT_MISMATCH",
      });

      const persisted = await inspector.query<{
        token_digest: string;
        token_fingerprint: string;
        fencing_token: string;
      }>(`
        SELECT token_digest, token_fingerprint, fencing_token
        FROM public.ai_gateway_workforce_task_claims
        WHERE namespace = $1 AND plan_id = $2 AND task_id = $3
      `, [namespace, "plan-a", "task-a"]);
      expect(persisted.rows).toHaveLength(1);
      expect(persisted.rows[0].token_digest).toHaveLength(64);
      expect(persisted.rows[0].token_fingerprint).toHaveLength(16);
      expect(JSON.stringify(persisted.rows)).not.toContain(issued.token);
      expect(JSON.stringify(first.getInfo())).not.toContain(issued.token);

      const isolatedIssue = await isolated.issue({
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-isolated",
      });
      expect(isolatedIssue).toMatchObject({ success: true });

      const renewed = await second.renew(issued.token, {
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-a",
        fencingToken: issued.fencingToken,
      }, 3_000);
      expect(renewed).toMatchObject({
        success: true,
        code: "TASK_CLAIM_RENEWED",
        renewalCount: 1,
      });
      await expect(second.release(issued.token, {
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-a",
        fencingToken: issued.fencingToken,
      })).resolves.toMatchObject({
        success: true,
        code: "TASK_CLAIM_RELEASED",
      });

      const takeover = await first.issue({
        planId: "plan-a",
        taskId: "task-a",
        agentId: "agent-b",
      });
      expect(takeover).toMatchObject({ success: true });
      if (!takeover.success) throw new Error(takeover.reason);
      expect(BigInt(takeover.fencingToken)).toBeGreaterThan(BigInt(issued.fencingToken));
      await expect(first.checkHealth()).resolves.toMatchObject({
        mode: "postgres-fenced",
        distributed: true,
        available: true,
      });
    } finally {
      await first.revokeByPlanId("plan-a", "integration cleanup");
      await isolated.revokeByPlanId("plan-a", "integration cleanup");
      await first.close();
      await second.close();
      await isolated.close();
      await inspector.end();
    }
  }, 20_000);

  it("allows takeover only after database-clock expiry with a higher fence", async () => {
    const namespace = `claims-expiry-${randomUUID()}`;
    const first = createManager(namespace, 150);
    const second = createManager(namespace, 150);
    try {
      const original = await first.issue({
        planId: "plan-expiry",
        taskId: "task-expiry",
        agentId: "agent-old",
      });
      expect(original).toMatchObject({ success: true });
      if (!original.success) throw new Error(original.reason);

      await expect(second.issue({
        planId: "plan-expiry",
        taskId: "task-expiry",
        agentId: "agent-new",
      })).resolves.toMatchObject({ success: false, code: "TASK_ALREADY_CLAIMED" });

      await delay(225);
      const takeover = await second.issue({
        planId: "plan-expiry",
        taskId: "task-expiry",
        agentId: "agent-new",
      });
      expect(takeover).toMatchObject({ success: true });
      if (!takeover.success) throw new Error(takeover.reason);
      expect(BigInt(takeover.fencingToken)).toBeGreaterThan(BigInt(original.fencingToken));
      await expect(first.validate(original.token, {
        planId: "plan-expiry",
        taskId: "task-expiry",
        agentId: "agent-old",
      })).resolves.toMatchObject({
        success: false,
        code: "TASK_CLAIM_NOT_FOUND",
      });
    } finally {
      await second.revokeByPlanId("plan-expiry", "integration cleanup");
      await first.close();
      await second.close();
    }
  }, 20_000);
});
