import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createProviderDispatchGate } from "./providerDispatchGate.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL?.trim();
const describePostgres = connectionString ? describe : describe.skip;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describePostgres("real PostgreSQL provider dispatch integration", () => {
  it("allows one cross-replica owner, persists a redacted tombstone, and isolates its table", async () => {
    if (!connectionString) throw new Error("AI_GATEWAY_TEST_POSTGRES_URL is required.");
    const secret = "provider-dispatch-postgres-integration-secret".padEnd(64, "x");
    const env = {
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "postgres",
      AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL: connectionString,
      AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: secret,
      AI_GATEWAY_PROVIDER_DISPATCH_TTL_MS: "60000",
    };
    const left = createProviderDispatchGate({ env, realProviderEnabled: true });
    const right = createProviderDispatchGate({ env, realProviderEnabled: true });
    const pool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
    const rawKey = `provider-dispatch-raw-${randomUUID()}`;
    const rawTenant = `tenant-private-${randomUUID()}`;
    const input = {
      dispatchKeyHash: digest(rawKey),
      route: "/v1/chat/completions",
      invocation: 1,
      attempt: 1,
      shadow: false,
      tenantId: rawTenant,
      providerId: "provider-private",
      modelId: "model-private",
      requestFingerprint: digest("request-private"),
    };
    let createdIdentities: string[] = [];

    try {
      await expect(left.checkHealth()).resolves.toMatchObject({
        mode: "postgres",
        enabled: true,
        required: true,
        durable: true,
        distributed: true,
        available: true,
      });
      const baseline = await pool.query<{ identity: string }>(`
        SELECT identity FROM public.ai_gateway_provider_dispatch_entries
      `);
      const baselineIdentities = new Set(baseline.rows.map((row) => row.identity));

      const settled = await Promise.allSettled([
        left.reserve(input),
        right.reserve(input),
      ]);
      expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
      expect(settled.filter((entry) => entry.status === "rejected")).toHaveLength(1);
      expect(settled.find((entry) => entry.status === "rejected")).toMatchObject({
        status: "rejected",
        reason: { code: "PROVIDER_DISPATCH_ALREADY_RESERVED" },
      });

      const restarted = createProviderDispatchGate({ env, realProviderEnabled: true });
      try {
        await expect(restarted.reserve(input)).rejects.toMatchObject({
          code: "PROVIDER_DISPATCH_ALREADY_RESERVED",
          statusCode: 409,
        });
        await expect(restarted.reserve({ ...input, invocation: 2 })).resolves.toMatchObject({
          reserved: true,
          bypassed: false,
        });
      } finally {
        await restarted.close();
      }

      const after = await pool.query<{
        identity: string;
        fingerprint: string;
        state: string;
        result_json: unknown;
      }>(`
        SELECT identity, fingerprint, state, result_json
        FROM public.ai_gateway_provider_dispatch_entries
      `);
      const createdRows = after.rows.filter((row) => !baselineIdentities.has(row.identity));
      createdIdentities = createdRows.map((row) => row.identity);
      expect(createdRows).toHaveLength(2);
      expect(createdRows.every((row) => row.state === "oversized" && row.result_json === null)).toBe(true);
      const persisted = JSON.stringify(createdRows);
      expect(persisted).not.toContain(rawKey);
      expect(persisted).not.toContain(rawTenant);
      expect(persisted).not.toContain("provider-private");
      expect(persisted).not.toContain("model-private");

      const httpTable = await pool.query<{ table_name: string | null }>(`
        SELECT to_regclass('public.ai_gateway_idempotency_entries')::text AS table_name
      `);
      if (httpTable.rows[0]?.table_name) {
        const leakedIntoHttpTable = await pool.query<{ count: string }>(`
          SELECT COUNT(*)::text AS count
          FROM public.ai_gateway_idempotency_entries
          WHERE identity = ANY($1::text[])
        `, [createdIdentities]);
        expect(leakedIntoHttpTable.rows[0]?.count).toBe("0");
      }

      const objects = await pool.query<{
        provider_table: string | null;
        provider_sequence: string | null;
      }>(`
        SELECT
          to_regclass('public.ai_gateway_provider_dispatch_entries')::text AS provider_table,
          to_regclass('public.ai_gateway_provider_dispatch_fencing_seq')::text AS provider_sequence
      `);
      expect(objects.rows[0]).toEqual({
        provider_table: "ai_gateway_provider_dispatch_entries",
        provider_sequence: "ai_gateway_provider_dispatch_fencing_seq",
      });
    } finally {
      if (createdIdentities.length > 0) {
        await pool.query(`
          DELETE FROM public.ai_gateway_provider_dispatch_entries
          WHERE identity = ANY($1::text[])
        `, [createdIdentities]).catch(() => undefined);
      }
      await Promise.allSettled([left.close(), right.close()]);
      await pool.end();
    }
  }, 20_000);
});
