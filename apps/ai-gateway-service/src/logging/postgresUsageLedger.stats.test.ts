import { describe, expect, it } from "vitest";
import {
  createPostgresUsageLedger,
  type UsageLedgerPostgresPool,
} from "./postgresUsageLedger.ts";

describe("PostgreSQL usage statistics completeness", () => {
  it("marks by-Agent aggregates partial instead of silently dropping records past 10000", async () => {
    const rows = Array.from({ length: 10_001 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      event_timestamp_ms: index,
      usage_attempt_id: null,
      usage_event_type: null,
      tenant_id: "tenant-a",
      agent_id: "agt_postgres_truncated",
      agent_run_id: null,
      agent_policy_hash: `sha256:${"a".repeat(64)}`,
      method: "POST",
      path: "/agent-exec/run",
      status_code: 200,
      latency_ms: 1,
      provider: "provider-a",
      model: "model-a",
      input_tokens: 1,
      output_tokens: 0,
      total_tokens: 1,
      estimated_cost_usd: 0,
      cost_source: "provider-reported",
      cost_estimate_available: true,
      cache_hit: false,
      fallback_used: false,
      fallback_from: null,
      shadow: false,
      provider_call_attempted: true,
      billable: true,
      error_text: null,
      trace_id: null,
    }));
    const pool: UsageLedgerPostgresPool = {
      async connect() {
        return {
          async query() { return { rows: [], rowCount: 0 }; },
          release() {},
        };
      },
      async query<Row = Record<string, unknown>>(text: string) {
        if (text.includes("usage-ledger:stats")) {
          return { rows: [{ row_count: rows.length }] as unknown as Row[], rowCount: 1 };
        }
        if (text.includes("usage-ledger:query")) {
          return { rows: rows as unknown as Row[], rowCount: rows.length };
        }
        if (text.includes("usage-ledger:health")) {
          return { rows: [{ healthy: 1 }] as unknown as Row[], rowCount: 1 };
        }
        throw new Error("unexpected usage-ledger mock query");
      },
      async end() {},
    };
    const ledger = createPostgresUsageLedger({
      pool,
      namespace: "stats-test",
      maxRows: 20_000,
      retentionDays: 30,
      poolMax: 1,
      statementTimeoutMs: 5_000,
    });

    await expect(ledger.getStats({ tenantId: "tenant-a", agentId: "agt_postgres_truncated" }))
      .resolves.toMatchObject({
        totalRequests: 10_000,
        partial: true,
        truncated: true,
        recordsConsidered: 10_000,
        recordLimit: 10_000,
        scope: "retained-postgres-window",
        byAgent: {
          agt_postgres_truncated: { count: 10_000, tokens: 10_000, cost: 0, errors: 0 },
        },
      });
    await ledger.close();
  });
});
