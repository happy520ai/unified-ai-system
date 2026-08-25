import { createHash, randomUUID } from "node:crypto";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createExternalEffectGate } from "./externalEffectGate.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL?.trim();
const describePostgres = connectionString ? describe : describe.skip;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describePostgres("real PostgreSQL external-effect integration", () => {
  it("allows one cross-replica owner and isolates redacted tombstones in dedicated objects", async () => {
    if (!connectionString) throw new Error("AI_GATEWAY_TEST_POSTGRES_URL is required.");
    const secret = "external-effect-postgres-integration-secret".padEnd(64, "x");
    const env = {
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "postgres",
      AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL: connectionString,
      AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: connectionString,
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: secret,
      AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS: "60000",
    };
    const left = createExternalEffectGate({ env, enabled: true });
    const right = createExternalEffectGate({ env, enabled: true });
    const pool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
    const rawKey = `external-effect-raw-${randomUUID()}`;
    const rawTenant = `tenant-private-${randomUUID()}`;
    const input = {
      effectKeyHash: digest(rawKey),
      route: "/connectors/feishu/send",
      tenantId: rawTenant,
      effectType: "webhook:feishu-private",
      payloadFingerprint: digest("private-payload"),
    };
    let createdIdentities: string[] = [];

    try {
      await expect(left.checkHealth()).resolves.toMatchObject({
        mode: "postgres",
        enabled: true,
        durable: true,
        distributed: true,
        available: true,
      });
      const baseline = await pool.query<{ identity: string }>(`
        SELECT identity FROM public.ai_gateway_external_effect_entries
      `);
      const baselineIdentities = new Set(baseline.rows.map((row) => row.identity));

      const settled = await Promise.allSettled([left.reserve(input), right.reserve(input)]);
      expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
      expect(settled.filter((entry) => entry.status === "rejected")).toHaveLength(1);
      expect(settled.find((entry) => entry.status === "rejected")).toMatchObject({
        status: "rejected",
        reason: { code: "EXTERNAL_EFFECT_ALREADY_RESERVED" },
      });
      const owner = settled.find((entry) => entry.status === "fulfilled");
      if (owner?.status === "fulfilled") await owner.value.commit();

      const restarted = createExternalEffectGate({ env, enabled: true });
      try {
        await expect(restarted.reserve(input)).rejects.toMatchObject({
          code: "EXTERNAL_EFFECT_ALREADY_RESERVED",
          statusCode: 409,
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
        FROM public.ai_gateway_external_effect_entries
      `);
      const createdRows = after.rows.filter((row) => !baselineIdentities.has(row.identity));
      createdIdentities = createdRows.map((row) => row.identity);
      expect(createdRows).toHaveLength(1);
      expect(createdRows[0]).toMatchObject({ state: "oversized", result_json: null });
      const persisted = JSON.stringify(createdRows);
      expect(persisted).not.toContain(rawKey);
      expect(persisted).not.toContain(rawTenant);
      expect(persisted).not.toContain("feishu-private");

      for (const table of [
        "public.ai_gateway_idempotency_entries",
        "public.ai_gateway_provider_dispatch_entries",
      ]) {
        const exists = await pool.query<{ table_name: string | null }>(
          `SELECT to_regclass($1)::text AS table_name`,
          [table],
        );
        if (!exists.rows[0]?.table_name) continue;
        const leaked = await pool.query<{ count: string }>(`
          SELECT COUNT(*)::text AS count FROM ${table}
          WHERE identity = ANY($1::text[])
        `, [createdIdentities]);
        expect(leaked.rows[0]?.count).toBe("0");
      }

      const objects = await pool.query<{
        effect_table: string | null;
        effect_sequence: string | null;
      }>(`
        SELECT
          to_regclass('public.ai_gateway_external_effect_entries')::text AS effect_table,
          to_regclass('public.ai_gateway_external_effect_fencing_seq')::text AS effect_sequence
      `);
      expect(objects.rows[0]).toEqual({
        effect_table: "ai_gateway_external_effect_entries",
        effect_sequence: "ai_gateway_external_effect_fencing_seq",
      });
    } finally {
      if (createdIdentities.length > 0) {
        await pool.query(`
          DELETE FROM public.ai_gateway_external_effect_entries
          WHERE identity = ANY($1::text[])
        `, [createdIdentities]).catch(() => undefined);
      }
      await Promise.allSettled([left.close(), right.close()]);
      await pool.end();
    }
  }, 20_000);
});
