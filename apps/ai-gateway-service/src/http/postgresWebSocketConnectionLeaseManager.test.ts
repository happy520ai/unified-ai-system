import { describe, expect, it, vi } from "vitest";
import type {
  PostgresClientLike,
  PostgresPoolLike,
  PostgresQueryResult,
} from "./postgresIdempotencyCoordinator.ts";
import {
  createPostgresWebSocketConnectionLeaseManager,
  WebSocketConnectionLeaseUnavailableError,
} from "./postgresWebSocketConnectionLeaseManager.ts";

const SECRET = "0123456789abcdef0123456789abcdef";

type FakeLease = {
  namespace: string;
  subjectHash: string;
  leaseId: string;
  fencingToken: string;
  expiresAt: number;
};

class FakePostgresPool implements PostgresPoolLike {
  leases: FakeLease[] = [];
  capturedValues: unknown[][] = [];
  now = 1_000_000;
  failInitialization = false;
  failRenewals = false;
  failAllQueries = false;
  malformedInsert = false;
  ended = false;
  private nextFencingToken = 1;
  private lockTail = Promise.resolve();

  async query<Row = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    return this.execute<Row>(text, values);
  }

  async connect(): Promise<PostgresClientLike> {
    if (this.failAllQueries) throw new Error("database unavailable");
    return new FakePostgresClient(this);
  }

  async end(): Promise<void> {
    this.ended = true;
  }

  advance(milliseconds: number): void {
    this.now += milliseconds;
  }

  async acquireLock(): Promise<() => void> {
    const previous = this.lockTail;
    let release!: () => void;
    this.lockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }

  async execute<Row = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    this.capturedValues.push([...values]);
    if (this.failAllQueries) throw new Error("database unavailable");
    if (text.includes("websocket-lease:init")) {
      if (this.failInitialization) throw new Error("database unavailable");
      return result<Row>();
    }
    if (text.includes("websocket-lease:delete-expired")) {
      this.leases = this.leases.filter((lease) => lease.expiresAt > this.now);
      return result<Row>();
    }
    if (text.includes("websocket-lease:count")) {
      const namespace = String(values[0]);
      const subjectHash = String(values[1]);
      const active = this.leases.filter((lease) => lease.expiresAt > this.now);
      return result<Row>([{
        all_count: String(active.length),
        namespace_count: String(active.filter((lease) => lease.namespace === namespace).length),
        subject_count: String(active.filter(
          (lease) => lease.namespace === namespace && lease.subjectHash === subjectHash,
        ).length),
      } as Row]);
    }
    if (text.includes("websocket-lease:insert")) {
      if (this.malformedInsert) return result<Row>();
      const fencingToken = String(this.nextFencingToken++);
      this.leases.push({
        namespace: String(values[0]),
        subjectHash: String(values[1]),
        leaseId: String(values[2]),
        fencingToken,
        expiresAt: this.now + Number(values[3]),
      });
      return result<Row>([{ fencing_token: fencingToken } as Row], 1);
    }
    if (text.includes("websocket-lease:renew")) {
      if (this.failRenewals) throw new Error("renewal unavailable");
      const lease = this.findLease(values[1], values[2], values[3], values[4]);
      if (!lease || lease.expiresAt <= this.now) return result<Row>();
      lease.expiresAt = this.now + Number(values[0]);
      return result<Row>([], 1);
    }
    if (text.includes("websocket-lease:release")) {
      const lease = this.findLease(values[0], values[1], values[2], values[3]);
      if (!lease) return result<Row>();
      this.leases = this.leases.filter((candidate) => candidate !== lease);
      return result<Row>([], 1);
    }
    if (text.includes("websocket-lease:health")) return result<Row>([{ healthy: 1 } as Row], 1);
    return result<Row>();
  }

  private findLease(namespace: unknown, subjectHash: unknown, leaseId: unknown, fencingToken: unknown): FakeLease | undefined {
    return this.leases.find((lease) => (
      lease.namespace === String(namespace)
      && lease.subjectHash === String(subjectHash)
      && lease.leaseId === String(leaseId)
      && lease.fencingToken === String(fencingToken)
    ));
  }
}

class FakePostgresClient implements PostgresClientLike {
  private releaseTransactionLock: (() => void) | null = null;

  constructor(private readonly pool: FakePostgresPool) {}

  async query<Row = Record<string, unknown>>(
    text: string,
    values: unknown[] = [],
  ): Promise<PostgresQueryResult<Row>> {
    if (text.includes("websocket-lease:acquire-lock")) {
      this.releaseTransactionLock = await this.pool.acquireLock();
      return result<Row>();
    }
    if (text === "COMMIT" || text === "ROLLBACK") {
      this.releaseTransactionLock?.();
      this.releaseTransactionLock = null;
      return result<Row>();
    }
    return this.pool.execute<Row>(text, values);
  }

  release(): void {
    this.releaseTransactionLock?.();
    this.releaseTransactionLock = null;
  }
}

function result<Row>(rows: Row[] = [], rowCount = rows.length): PostgresQueryResult<Row> {
  return { rows, rowCount };
}

function createManager(pool: FakePostgresPool, namespace = "cluster-a") {
  return createPostgresWebSocketConnectionLeaseManager({
    pool,
    secret: SECRET,
    namespace,
    leaseMs: 9_000,
    maxRows: 8,
  });
}

describe("PostgreSQL WebSocket connection leases", () => {
  it("atomically enforces subject and global limits across replicas", async () => {
    const pool = new FakePostgresPool();
    const firstReplica = createManager(pool);
    const secondReplica = createManager(pool);
    const limits = { maxConnections: 3, maxConnectionsPerSubject: 2 };

    const [first, second] = await Promise.all([
      firstReplica.acquire("tenant-a:user-a", limits),
      secondReplica.acquire("tenant-a:user-a", limits),
    ]);
    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(true);
    await expect(secondReplica.acquire("tenant-a:user-a", limits)).resolves.toMatchObject({
      acquired: false,
      scope: "subject",
    });
    await expect(firstReplica.acquire("tenant-a:user-b", limits)).resolves.toMatchObject({ acquired: true });
    await expect(secondReplica.acquire("tenant-a:user-c", limits)).resolves.toMatchObject({
      acquired: false,
      scope: "global",
    });

    if (first.acquired) await first.lease.release();
    await expect(secondReplica.acquire("tenant-a:user-c", limits)).resolves.toMatchObject({ acquired: true });
    await firstReplica.close();
    await secondReplica.close();
  });

  it("renews with fencing ownership and recovers an abandoned lease after TTL", async () => {
    const pool = new FakePostgresPool();
    const crashedReplica = createManager(pool);
    const survivor = createManager(pool);
    const limits = { maxConnections: 1, maxConnectionsPerSubject: 1 };
    const acquired = await crashedReplica.acquire("tenant-a:user-a", limits);
    expect(acquired.acquired).toBe(true);
    if (!acquired.acquired) throw new Error("Expected the first lease to be acquired.");

    pool.advance(6_000);
    await expect(acquired.lease.renewNow()).resolves.toBe(true);
    pool.advance(6_000);
    await expect(survivor.acquire("tenant-a:user-b", limits)).resolves.toMatchObject({
      acquired: false,
      scope: "global",
    });

    pool.advance(3_001);
    await expect(survivor.acquire("tenant-a:user-b", limits)).resolves.toMatchObject({ acquired: true });
    await crashedReplica.close();
    await survivor.close();
  });

  it("marks a live transport lease lost when renewal cannot be proven", async () => {
    const pool = new FakePostgresPool();
    const manager = createManager(pool);
    const acquired = await manager.acquire("tenant-a:user-a", {
      maxConnections: 2,
      maxConnectionsPerSubject: 1,
    });
    if (!acquired.acquired) throw new Error("Expected a lease.");
    const onLost = vi.fn();
    acquired.lease.start(onLost);
    pool.failRenewals = true;

    await expect(acquired.lease.renewNow()).resolves.toBe(false);
    await Promise.resolve();
    expect(acquired.lease.isValid()).toBe(false);
    expect(onLost).toHaveBeenCalledTimes(1);
    await acquired.lease.release();
    await manager.close();
  });

  it("fails closed on initialization and malformed durable results", async () => {
    const unavailablePool = new FakePostgresPool();
    unavailablePool.failInitialization = true;
    const unavailableManager = createManager(unavailablePool);
    await expect(unavailableManager.acquire("tenant-a:user-a", {
      maxConnections: 2,
      maxConnectionsPerSubject: 1,
    })).rejects.toBeInstanceOf(WebSocketConnectionLeaseUnavailableError);

    const malformedPool = new FakePostgresPool();
    malformedPool.malformedInsert = true;
    const malformedManager = createManager(malformedPool);
    await expect(malformedManager.acquire("tenant-a:user-a", {
      maxConnections: 2,
      maxConnectionsPerSubject: 1,
    })).rejects.toBeInstanceOf(WebSocketConnectionLeaseUnavailableError);
    await unavailableManager.close();
    await malformedManager.close();
  });

  it("stores only HMAC subjects and keeps namespaces isolated", async () => {
    const pool = new FakePostgresPool();
    const first = createManager(pool, "cluster-a");
    const second = createManager(pool, "cluster-b");
    const rawSubject = "sensitive-tenant:operator@example.test";
    const limits = { maxConnections: 1, maxConnectionsPerSubject: 1 };

    await expect(first.acquire(rawSubject, limits)).resolves.toMatchObject({ acquired: true });
    await expect(second.acquire(rawSubject, limits)).resolves.toMatchObject({ acquired: true });
    expect(pool.capturedValues.flat().map(String)).not.toContain(rawSubject);
    expect(pool.leases).toHaveLength(2);
    expect(pool.leases[0].subjectHash).toMatch(/^[a-f0-9]{64}$/);
    await first.close();
    await second.close();
  });
});
