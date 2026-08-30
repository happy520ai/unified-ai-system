import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createProviderStatementReconciliationService } from "../billing/providerStatementReconciliationService.ts";
import { createUsageLedger } from "./usageLedgerFactory.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

function createLedger(namespace: string, maxRows = 100) {
  return createUsageLedger({
    env: {
      AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "postgres",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL: connectionString,
      AI_GATEWAY_USAGE_LEDGER_NAMESPACE: namespace,
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_MAX_ROWS: String(maxRows),
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_RETENTION_DAYS: "30",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_STATEMENT_TIMEOUT_MS: "5000",
    },
    realProviderEnabled: true,
  });
}

describePostgres("real PostgreSQL central usage ledger", () => {
  it("commits one idempotent lifecycle across pools and preserves tenant accounting", async () => {
    const namespace = `usage-${randomUUID()}`;
    const attemptId = randomUUID();
    const unresolvedAttemptId = randomUUID();
    const periodStart = new Date(Date.now() - 60_000).toISOString();
    const first = createLedger(namespace);
    const second = createLedger(namespace);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    const started = {
      usageAttemptId: attemptId,
      usageEventType: "attempt-started" as const,
      tenantId: "tenant-a",
      agentId: "agt_postgres_usage",
      agentRunId: "agr_postgres_usage_run",
      agentPolicyHash: `sha256:${"a".repeat(64)}`,
      method: "POST",
      path: "/v1/chat/completions",
      statusCode: 102,
      provider: "provider-a",
      model: "model-a",
      providerCallAttempted: true,
      billable: true,
      costEstimateAvailable: false,
    };
    try {
      await first.assertDurable();
      await first.log(started);
      await second.log(started);
      await second.log({
        usageAttemptId: attemptId,
        usageEventType: "attempt-completed",
        tenantId: "tenant-a",
        agentId: "agt_postgres_usage",
        agentRunId: "agr_postgres_usage_run",
        agentPolicyHash: `sha256:${"a".repeat(64)}`,
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
        latencyMs: 125,
        provider: "provider-a",
        model: "model-a",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        estimatedCostUsd: 0.0015,
        costSource: "provider-reported",
        costEstimateAvailable: true,
        providerCallAttempted: true,
        billable: true,
      });

      await expect(first.query({ tenantId: "tenant-a" })).resolves.toHaveLength(2);
      await expect(first.query({ agentId: "agt_postgres_usage" })).resolves.toHaveLength(2);
      await expect(first.query({ tenantId: "tenant-b" })).resolves.toHaveLength(0);
      await expect(first.getStats({ tenantId: "tenant-a" })).resolves.toMatchObject({
        totalRequests: 1,
        totalTokens: 15,
        totalCostUsd: 0.0015,
        unresolvedBillableAttempts: 0,
        byAgent: {
          agt_postgres_usage: { count: 1, tokens: 15, cost: 0.0015, errors: 0 },
        },
        partial: false,
        truncated: false,
        scope: "retained-postgres-window",
      });
      const reconciliation = createProviderStatementReconciliationService({
        requestLogger: first,
      });
      const reconciled = await reconciliation.reconcile({
        tenantId: "tenant-a",
        statement: {
          statementId: `statement-${randomUUID()}`,
          provider: "provider-a",
          currency: "USD",
          periodStart,
          periodEnd: new Date(Date.now() + 60_000).toISOString(),
          absoluteToleranceUsd: "0.000001",
          relativeToleranceBps: 0,
          lines: [{
            statementLineId: "line-1",
            usageAttemptId: attemptId,
            model: "model-a",
            occurredAt: new Date().toISOString(),
            totalTokens: 15,
            billedCostUsd: "0.0015",
          }],
        },
      });
      expect(reconciled).toMatchObject({
        status: "balanced",
        tenantId: "tenant-a",
        provider: "provider-a",
        summary: {
          statementLineCount: 1,
          exactMatchLineCount: 1,
          gatewayOnlyAttemptCount: 0,
        },
        boundaries: {
          sourceAuthenticated: false,
          providerApiCalled: false,
          legalInvoice: false,
        },
      });

      await expect(first.log({
        ...started,
        usageEventType: "attempt-failed",
        statusCode: 500,
      })).rejects.toMatchObject({ code: "USAGE_LEDGER_CONFLICT" });

      await first.log({
        ...started,
        usageAttemptId: unresolvedAttemptId,
      });
      await expect(second.getStats({ tenantId: "tenant-a" })).resolves.toMatchObject({
        totalRequests: 1,
        unresolvedBillableAttempts: 1,
        unknownCostRecords: 1,
      });

      const persisted = await inspector.query<{ record_count: string }>(`
        SELECT COUNT(*)::text AS record_count
        FROM public.ai_gateway_usage_ledger
        WHERE namespace = $1
      `, [namespace]);
      const columns = await inspector.query<{ body_columns: string }>(`
        SELECT string_agg(column_name, ',') AS body_columns
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_gateway_usage_ledger'
      `);
      expect(persisted.rows[0]?.record_count).toBe("3");
      expect(columns.rows[0]?.body_columns ?? "").not.toMatch(
        /prompt|request_body|response_body|credential|authorization/i,
      );
      expect(JSON.stringify(await first.query({ tenantId: "tenant-a" })))
        .not.toContain("Authorization");
      expect(first.getHealth()).toMatchObject({
        status: "ready",
        persistence: "postgres-central",
        available: true,
      });
    } finally {
      await inspector.query(
        "DELETE FROM public.ai_gateway_usage_ledger WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_usage_ledger_namespaces WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await first.close();
      await second.close();
      await inspector.end();
    }
  }, 20_000);

  it("fails closed when the bounded namespace reaches capacity", async () => {
    const namespace = `usage-capacity-${randomUUID()}`;
    const ledger = createLedger(namespace, 1);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      await ledger.log({
        tenantId: "tenant-a",
        method: "GET",
        path: "/first",
        statusCode: 200,
      });
      await expect(ledger.log({
        tenantId: "tenant-a",
        method: "GET",
        path: "/second",
        statusCode: 200,
      })).rejects.toMatchObject({
        code: "USAGE_LEDGER_CAPACITY_REACHED",
      });
    } finally {
      await inspector.query(
        "DELETE FROM public.ai_gateway_usage_ledger WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await inspector.query(
        "DELETE FROM public.ai_gateway_usage_ledger_namespaces WHERE namespace = $1",
        [namespace],
      ).catch(() => undefined);
      await ledger.close();
      await inspector.end();
    }
  }, 20_000);
});
