import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  createPostgresWebSocketConnectionLeaseManager,
  type WebSocketConnectionLease,
  type WebSocketConnectionLeaseDecision,
  type WebSocketConnectionLeaseManager,
} from "./postgresWebSocketConnectionLeaseManager.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL;
const SHARED_SECRET = "0123456789abcdef0123456789abcdef";
const TABLE = "public.ai_gateway_websocket_connection_leases";
const describePostgres = connectionString ? describe : describe.skip;

function createManager(namespace: string, leaseMs = 5_000): WebSocketConnectionLeaseManager {
  return createPostgresWebSocketConnectionLeaseManager({
    connectionString,
    secret: SHARED_SECRET,
    namespace,
    leaseMs,
    maxRows: 100_000,
    poolMax: 2,
    statementTimeoutMs: 5_000,
  });
}

function requireLease(decision: WebSocketConnectionLeaseDecision): WebSocketConnectionLease {
  expect(decision.acquired).toBe(true);
  if (!decision.acquired) throw new Error("Expected a PostgreSQL WebSocket lease owner.");
  return decision.lease;
}

function createInspectionPool(): Pool {
  return new Pool({
    connectionString,
    max: 2,
    statement_timeout: 5_000,
    application_name: "unified-ai-gateway-websocket-lease-integration",
    allowExitOnIdle: true,
  });
}

async function cleanupNamespace(pool: Pool, namespace: string): Promise<void> {
  await pool.query(`DELETE FROM ${TABLE} WHERE namespace = $1`, [namespace]).catch(() => undefined);
}

describePostgres("real PostgreSQL WebSocket connection leases", () => {
  it("atomically enforces subject and global limits across independent pools", async () => {
    const namespace = `ws-shared:${randomUUID()}`;
    const first = createManager(namespace);
    const second = createManager(namespace);
    const inspection = createInspectionPool();
    const limits = { maxConnections: 2, maxConnectionsPerSubject: 1 };
    const rawSubject = `sensitive-tenant:operator-${randomUUID()}@example.test`;

    try {
      const contenders = await Promise.all([
        first.acquire(rawSubject, limits),
        second.acquire(rawSubject, limits),
      ]);
      const owners = contenders.filter((decision) => decision.acquired);
      const rejected = contenders.filter((decision) => !decision.acquired);
      expect(owners).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ acquired: false, scope: "subject" });

      const secondSubject = await first.acquire(`tenant:second-${randomUUID()}`, limits);
      expect(secondSubject).toMatchObject({ acquired: true });
      await expect(second.acquire(`tenant:third-${randomUUID()}`, limits)).resolves.toMatchObject({
        acquired: false,
        scope: "global",
      });

      await requireLease(owners[0]).release();
      const replacement = await second.acquire(`tenant:replacement-${randomUUID()}`, limits);
      expect(replacement).toMatchObject({ acquired: true });

      const rows = await inspection.query<{
        subject_hash: string;
        lease_id: string;
        fencing_token: string;
      }>(`SELECT subject_hash, lease_id::text, fencing_token::text
          FROM ${TABLE}
          WHERE namespace = $1
          ORDER BY lease_id`, [namespace]);
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows.every((row) => /^[a-f0-9]{64}$/.test(row.subject_hash))).toBe(true);
      expect(JSON.stringify(rows.rows)).not.toContain(rawSubject);
      await expect(first.checkHealth()).resolves.toMatchObject({
        storeMode: "postgres",
        available: true,
        distributed: true,
      });
      expect(first.getStats()).not.toHaveProperty("connectionString");
      expect(first.getStats()).not.toHaveProperty("namespace");
    } finally {
      await first.close();
      await second.close();
      await cleanupNamespace(inspection, namespace);
      await inspection.end();
    }
  }, 20_000);

  it("recovers a crashed owner after the real database TTL", async () => {
    const namespace = `ws-ttl:${randomUUID()}`;
    const crashed = createManager(namespace);
    const successor = createManager(namespace);
    const inspection = createInspectionPool();
    const limits = { maxConnections: 1, maxConnectionsPerSubject: 1 };

    try {
      const abandoned = await crashed.acquire(`tenant:abandoned-${randomUUID()}`, limits);
      const abandonedLease = requireLease(abandoned);
      await delay(5_250);

      const takeover = await successor.acquire(`tenant:successor-${randomUUID()}`, limits);
      const successorLease = requireLease(takeover);
      await expect(abandonedLease.renewNow()).resolves.toBe(false);
      expect(successorLease.isValid()).toBe(true);

      const rows = await inspection.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${TABLE} WHERE namespace = $1`,
        [namespace],
      );
      expect(rows.rows[0]?.count).toBe("1");
    } finally {
      await crashed.close();
      await successor.close();
      await cleanupNamespace(inspection, namespace);
      await inspection.end();
    }
  }, 20_000);

  it("fences a stale owner after another replica acquires the expired slot", async () => {
    const namespace = `ws-fencing:${randomUUID()}`;
    const staleOwner = createManager(namespace);
    const newOwner = createManager(namespace);
    const inspection = createInspectionPool();
    const limits = { maxConnections: 1, maxConnectionsPerSubject: 1 };

    try {
      const staleDecision = await staleOwner.acquire(`tenant:stale-${randomUUID()}`, limits);
      const staleLease = requireLease(staleDecision);
      await inspection.query(
        `UPDATE ${TABLE}
         SET lease_expires_at = clock_timestamp() - interval '1 second'
         WHERE namespace = $1`,
        [namespace],
      );

      const replacementDecision = await newOwner.acquire(`tenant:new-${randomUUID()}`, limits);
      const replacementLease = requireLease(replacementDecision);
      await expect(staleLease.renewNow()).resolves.toBe(false);
      await expect(replacementLease.renewNow()).resolves.toBe(true);

      const rows = await inspection.query<{ count: string; distinct_tokens: string }>(
        `SELECT COUNT(*)::text AS count,
                COUNT(DISTINCT fencing_token)::text AS distinct_tokens
         FROM ${TABLE}
         WHERE namespace = $1`,
        [namespace],
      );
      expect(rows.rows[0]).toEqual({ count: "1", distinct_tokens: "1" });
    } finally {
      await staleOwner.close();
      await newOwner.close();
      await cleanupNamespace(inspection, namespace);
      await inspection.end();
    }
  }, 20_000);
});
