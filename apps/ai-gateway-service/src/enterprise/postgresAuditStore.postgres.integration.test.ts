import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createPostgresAuditStore } from "./postgresAuditStore.ts";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;
const KEY = Buffer.from("53".repeat(32), "hex");

function createStore(namespace: string, overrides = {}) {
  return createPostgresAuditStore({
    connectionString,
    namespace,
    hmacKey: KEY,
    maxRows: 1_000,
    poolMax: 2,
    statementTimeoutMs: 5_000,
    ...overrides,
  });
}

function event(id: string, tenantId: string, path = "/integration") {
  return {
    id,
    timestamp: new Date().toISOString(),
    outcome: "allowed",
    method: "POST",
    path,
    permission: "audit:test",
    statusCode: 200,
    userId: "integration-user",
    tenantId,
    role: "admin",
    details: {
      promptContentRecorded: false,
      credentialRecorded: false,
    },
  };
}

async function cleanupNamespace(pool: Pool, namespace: string) {
  await pool.query(
    "DELETE FROM public.ai_gateway_enterprise_audit_entries WHERE namespace = $1",
    [namespace],
  ).catch(() => undefined);
  await pool.query(
    "DELETE FROM public.ai_gateway_enterprise_audit_state WHERE namespace = $1",
    [namespace],
  ).catch(() => undefined);
}

describePostgres("real PostgreSQL enterprise audit chain", () => {
  it("serializes independent pools, verifies HMACs, and detects tampering", async () => {
    const namespace = `audit-${randomUUID()}`;
    const first = createStore(namespace);
    const second = createStore(namespace);
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    try {
      const repeatedEvent = event(`audit-${randomUUID()}`, "tenant-a", "/idempotent");
      const initial = await first.append(repeatedEvent);
      const replay = await second.append(repeatedEvent);
      expect(replay.distributedIntegrity.sequence).toBe(
        initial.distributedIntegrity.sequence,
      );
      await expect(second.append({
        ...repeatedEvent,
        path: "/conflicting-evidence",
      })).rejects.toMatchObject({ code: "AUDIT_POSTGRES_EVENT_ID_CONFLICT" });

      const entries = await Promise.all(Array.from({ length: 20 }, (_, index) => (
        (index % 2 === 0 ? first : second).append(event(
          `audit-${randomUUID()}`,
          index % 3 === 0 ? "tenant-b" : "tenant-a",
          `/concurrent/${index}`,
        ))
      )));
      const sequences = [initial, ...entries]
        .map((entry) => entry.distributedIntegrity.sequence)
        .sort((left, right) => left - right);
      expect(sequences).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));

      const tenantA = await first.readEntries({ limit: 100, tenantId: "tenant-a" });
      expect(tenantA.length).toBeGreaterThan(1);
      expect(tenantA.every((entry) => entry.tenantId === "tenant-a")).toBe(true);
      await expect(first.verify()).resolves.toMatchObject({
        valid: true,
        distributed: true,
        verifiedEntries: 21,
        sequence: 21,
        externalRetentionVerified: false,
      });

      const floor = await inspector.query<{ entry_hash: string }>(`
        SELECT entry_hash
        FROM public.ai_gateway_enterprise_audit_entries
        WHERE namespace = $1 AND sequence = 10
      `, [namespace]);
      const anchored = createStore(namespace, {
        minimumSequence: 10,
        trustedHash: floor.rows[0].entry_hash,
      });
      await expect(anchored.checkHealth()).resolves.toMatchObject({
        status: "ready",
        sequence: 21,
        trustedHashConfigured: true,
      });
      await anchored.close();

      const stored = await inspector.query<{
        entry_hmac: string;
        state_hmac: string;
        event_json: unknown;
      }>(`
        SELECT entry.entry_hmac, state.state_hmac, entry.event_json
        FROM public.ai_gateway_enterprise_audit_entries AS entry
        JOIN public.ai_gateway_enterprise_audit_state AS state
          ON state.namespace = entry.namespace
        WHERE entry.namespace = $1
        ORDER BY entry.sequence ASC
        LIMIT 1
      `, [namespace]);
      expect(JSON.stringify(stored.rows)).not.toContain(KEY.toString("hex"));
      expect(JSON.stringify(stored.rows)).not.toMatch(/authorization|credentialValue|promptText/i);

      await inspector.query(`
        UPDATE public.ai_gateway_enterprise_audit_entries
        SET event_json = jsonb_set(event_json, '{path}', '"/tampered"'::jsonb)
        WHERE namespace = $1 AND sequence = 1
      `, [namespace]);
      await expect(first.verify()).resolves.toMatchObject({
        valid: false,
        code: "AUDIT_POSTGRES_ENTRY_HMAC_INVALID",
      });
    } finally {
      await first.close();
      await second.close();
      await cleanupNamespace(inspector, namespace);
      await inspector.end();
    }
  }, 25_000);

  it("uses PostgreSQL as the canonical tenant audit source through governance", async () => {
    const namespace = `audit-governance-${randomUUID()}`;
    const root = await mkdtemp(join(tmpdir(), "postgres-audit-governance-"));
    const inspector = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
    const service = createEnterpriseGovernanceService({
      env: {
        PME_AUDIT_STORE_MODE: "postgres",
        PME_AUDIT_POSTGRES_URL: connectionString,
        PME_AUDIT_POSTGRES_NAMESPACE: namespace,
        PME_AUDIT_POSTGRES_HMAC_KEY: `hex:${KEY.toString("hex")}`,
        PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
      },
      auditLogPath: join(root, "audit.jsonl"),
    });
    const actorIdentity = {
      userId: "tenant-admin",
      tenantId: "tenant-a",
      role: "admin",
    };
    try {
      const recorded = await service.recordAudit({
        outcome: "allowed",
        method: "GET",
        path: "/central-audit",
        permission: "audit:test",
        statusCode: 200,
        identity: actorIdentity,
      });
      expect(recorded).toMatchObject({
        distributedIntegrity: {
          mode: "postgres-hmac-chain",
          sequence: 1,
          previousHash: "GENESIS",
          externalRetentionVerified: false,
        },
        integrity: { sequence: 1 },
      });
      const listed = await service.listAudit({ limit: 10, actorIdentity });
      expect(listed.entries).toHaveLength(1);
      expect(listed.entries[0]).toMatchObject({
        path: "/central-audit",
        tenantId: "tenant-a",
        distributedIntegrity: { sequence: 1 },
      });
      await expect(service.verifyAuditIntegrity()).resolves.toMatchObject({
        valid: true,
        central: { valid: true, sequence: 1 },
      });
      expect(service.getHealth().audit).toMatchObject({
        mode: "postgres-hmac-chain-plus-local-mirror",
        central: { status: "ready", sequence: 1 },
      });
      expect(JSON.stringify(service.getPublicHealth())).not.toContain(connectionString);
    } finally {
      await service.close();
      await cleanupNamespace(inspector, namespace);
      await inspector.end();
      await rm(root, { recursive: true, force: true });
    }
  }, 25_000);
});
