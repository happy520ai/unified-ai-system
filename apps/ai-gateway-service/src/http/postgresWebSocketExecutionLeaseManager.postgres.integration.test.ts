import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  createPostgresWebSocketConnectionLeaseManager,
  type WebSocketConnectionLease,
  type WebSocketConnectionLeaseDecision,
} from "./postgresWebSocketConnectionLeaseManager.ts";

const connectionString = process.env.AI_GATEWAY_TEST_POSTGRES_URL?.trim();
const describePostgres = connectionString ? describe : describe.skip;
const TABLE = "public.ai_gateway_websocket_connection_leases";
const SECRET = "postgres-websocket-execution-lease-test-secret";

describePostgres("PostgreSQL WebSocket execution leases", () => {
  it("enforces subject and global execution limits across pools without consuming connection capacity", async () => {
    const fixture = createFixture();
    const leases: WebSocketConnectionLease[] = [];
    try {
      const connectionLease = acquired(await fixture.first.acquire("tenant-a:alice", {
        maxConnections: 1,
        maxConnectionsPerSubject: 1,
      }));
      leases.push(connectionLease);

      const firstExecution = acquired(await fixture.first.acquireExecution("tenant-a:alice", {
        maxInFlightMessages: 2,
        maxInFlightPerSubject: 1,
      }));
      leases.push(firstExecution);
      await expect(fixture.second.acquireExecution("tenant-a:alice", {
        maxInFlightMessages: 2,
        maxInFlightPerSubject: 1,
      })).resolves.toMatchObject({ acquired: false, scope: "subject" });

      const secondExecution = acquired(await fixture.second.acquireExecution("tenant-a:bob", {
        maxInFlightMessages: 2,
        maxInFlightPerSubject: 1,
      }));
      leases.push(secondExecution);
      await expect(fixture.second.acquireExecution("tenant-a:carol", {
        maxInFlightMessages: 2,
        maxInFlightPerSubject: 1,
      })).resolves.toMatchObject({ acquired: false, scope: "global" });

      const persisted = await fixture.inspection.query<{
        namespace: string;
        subject_hash: string;
      }>(`SELECT namespace, subject_hash FROM ${TABLE} WHERE namespace = ANY($1::text[])`, [
        [fixture.namespace, `${fixture.namespace}:execution`],
      ]);
      expect(persisted.rows).toHaveLength(3);
      expect(persisted.rows.filter((row) => row.namespace === fixture.namespace)).toHaveLength(1);
      expect(persisted.rows.filter((row) => row.namespace === `${fixture.namespace}:execution`)).toHaveLength(2);
      expect(persisted.rows.every((row) => /^[a-f0-9]{64}$/.test(row.subject_hash))).toBe(true);
      expect(JSON.stringify(persisted.rows)).not.toContain("alice");
      expect(JSON.stringify(persisted.rows)).not.toContain("bob");

      await firstExecution.release();
      const replacement = acquired(await fixture.second.acquireExecution("tenant-a:carol", {
        maxInFlightMessages: 2,
        maxInFlightPerSubject: 1,
      }));
      leases.push(replacement);
      expect(replacement.isValid()).toBe(true);
      expect(fixture.first.getStats()).toMatchObject({
        executionLeasesSupported: true,
        executionAcquired: 1,
        executionDenied: 0,
      });
      expect(fixture.second.getStats()).toMatchObject({
        executionLeasesSupported: true,
        executionAcquired: 2,
        executionDenied: 2,
      });
    } finally {
      await Promise.allSettled(leases.map((lease) => lease.release()));
      await fixture.close();
    }
  }, 20_000);

  it("fences an expired execution owner and permits one replacement", async () => {
    const fixture = createFixture();
    const leases: WebSocketConnectionLease[] = [];
    try {
      const stale = acquired(await fixture.first.acquireExecution("tenant-a:alice", {
        maxInFlightMessages: 1,
        maxInFlightPerSubject: 1,
      }));
      leases.push(stale);
      await fixture.inspection.query(`
        UPDATE ${TABLE}
        SET lease_expires_at = clock_timestamp() - interval '1 second'
        WHERE namespace = $1
      `, [`${fixture.namespace}:execution`]);

      const replacement = acquired(await fixture.second.acquireExecution("tenant-a:alice", {
        maxInFlightMessages: 1,
        maxInFlightPerSubject: 1,
      }));
      leases.push(replacement);
      await expect(stale.renewNow()).resolves.toBe(false);
      await expect(replacement.renewNow()).resolves.toBe(true);

      const rows = await fixture.inspection.query<{ lease_count: string; fences: string }>(`
        SELECT COUNT(*)::text AS lease_count,
               COUNT(DISTINCT fencing_token)::text AS fences
        FROM ${TABLE}
        WHERE namespace = $1
      `, [`${fixture.namespace}:execution`]);
      expect(rows.rows[0]).toEqual({ lease_count: "1", fences: "1" });
    } finally {
      await Promise.allSettled(leases.map((lease) => lease.release()));
      await fixture.close();
    }
  }, 20_000);
});

function acquired(decision: WebSocketConnectionLeaseDecision): WebSocketConnectionLease {
  expect(decision.acquired).toBe(true);
  if (!decision.acquired) throw new Error(`Expected an acquired lease, received ${decision.scope}.`);
  return decision.lease;
}

function createFixture() {
  if (!connectionString) throw new Error("AI_GATEWAY_TEST_POSTGRES_URL is required.");
  const namespace = `ws-exec-${randomUUID()}`;
  const firstPool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
  const secondPool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
  const inspection = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
  const options = { secret: SECRET, namespace, leaseMs: 5_000, maxRows: 100 };
  const first = createPostgresWebSocketConnectionLeaseManager({ ...options, pool: firstPool });
  const second = createPostgresWebSocketConnectionLeaseManager({ ...options, pool: secondPool });
  return {
    namespace,
    first,
    second,
    inspection,
    async close() {
      await Promise.allSettled([first.close(), second.close()]);
      await inspection.query(`DELETE FROM ${TABLE} WHERE namespace = ANY($1::text[])`, [
        [namespace, `${namespace}:execution`],
      ]).catch(() => undefined);
      await Promise.allSettled([firstPool.end(), secondPool.end(), inspection.end()]);
    },
  };
}
