import { describe, expect, it } from "vitest";
import {
  createIdempotencyCoordinator,
  type IdempotencyCoordinatorOptions,
} from "./idempotencyCoordinator.ts";
import type {
  PostgresClientLike,
  PostgresPoolLike,
  PostgresQueryResult,
} from "./postgresIdempotencyCoordinator.ts";

const SHARED_SECRET = "0123456789abcdef0123456789abcdef";

type FakeEntry = {
  identity: string;
  fingerprint: string;
  state: "in_flight" | "completed" | "oversized" | "failed" | "unknown";
  leaseOwner: string | null;
  fencingToken: string;
  leaseExpiresAt: number | null;
  expiresAt: number;
  result: unknown;
};

class FakePostgresPool implements PostgresPoolLike {
  entry: FakeEntry | null = null;
  failInitialization = false;
  rejectCompletion = false;
  ended = false;
  private nextFencingToken = 1;
  private lockTail = Promise.resolve();

  async query<Row = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    return this.execute<Row>(text, values);
  }

  async connect(): Promise<PostgresClientLike> {
    return new FakePostgresClient(this);
  }

  async end(): Promise<void> {
    this.ended = true;
  }

  async acquireClaimLock(): Promise<() => void> {
    const previous = this.lockTail;
    let release!: () => void;
    this.lockTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    return release;
  }

  async execute<Row = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    if (text.includes("idempotency:init")) {
      if (this.failInitialization) throw new Error("database unavailable");
      return result<Row>();
    }
    if (text.includes("idempotency:expire-leases")) {
      if (this.entry?.state === "in_flight" && Number(this.entry.leaseExpiresAt) <= Date.now()) {
        this.entry.state = "unknown";
        this.entry.leaseOwner = null;
        this.entry.leaseExpiresAt = null;
      }
      return result<Row>();
    }
    if (text.includes("idempotency:delete-expired")) {
      if (this.entry && this.entry.state !== "in_flight" && this.entry.expiresAt <= Date.now()) this.entry = null;
      return result<Row>();
    }
    if (text.includes("idempotency:read-entry")) {
      if (!this.entry || this.entry.identity !== values[0]) return result<Row>();
      return result<Row>([{
        identity: this.entry.identity,
        fingerprint: this.entry.fingerprint,
        state: this.entry.state,
        lease_owner: this.entry.leaseOwner,
        fencing_token: this.entry.fencingToken,
        lease_remaining_ms: this.entry.leaseExpiresAt === null ? null : Math.max(0, this.entry.leaseExpiresAt - Date.now()),
        result_json: this.entry.result,
      } as Row]);
    }
    if (text.includes("idempotency:count")) {
      return result<Row>([{ count: this.entry ? "1" : "0" } as Row]);
    }
    if (text.includes("idempotency:insert")) {
      if (this.entry) return result<Row>();
      const token = String(this.nextFencingToken++);
      this.entry = {
        identity: String(values[0]),
        fingerprint: String(values[1]),
        state: "in_flight",
        leaseOwner: String(values[2]),
        fencingToken: token,
        leaseExpiresAt: Date.now() + Number(values[3]),
        expiresAt: Date.now() + Number(values[4]),
        result: null,
      };
      return result<Row>([{ fencing_token: token } as Row], 1);
    }
    if (text.includes("idempotency:renew")) {
      const matches = this.matchesOwner(values[1], values[2], values[3]);
      if (matches) this.entry!.leaseExpiresAt = Date.now() + Number(values[0]);
      return result<Row>([], matches ? 1 : 0);
    }
    if (text.includes("idempotency:complete")) {
      const matches = !this.rejectCompletion && this.matchesOwner(values[3], values[4], values[5]);
      if (matches) {
        this.entry!.state = String(values[0]) as FakeEntry["state"];
        this.entry!.leaseOwner = null;
        this.entry!.leaseExpiresAt = null;
        this.entry!.expiresAt = Date.now() + Number(values[1]);
        this.entry!.result = values[2] === null ? null : JSON.parse(String(values[2]));
      }
      return result<Row>([], matches ? 1 : 0);
    }
    if (text.includes("idempotency:fail")) {
      const matches = this.matchesOwner(values[1], values[2], values[3]);
      if (matches) {
        this.entry!.state = "failed";
        this.entry!.leaseOwner = null;
        this.entry!.leaseExpiresAt = null;
      }
      return result<Row>([], matches ? 1 : 0);
    }
    if (text.includes("idempotency:mark-unknown")) {
      const entry = this.entry;
      if (entry && entry.identity === values[1] && entry.state === "in_flight") {
        entry.state = "unknown";
        entry.leaseOwner = null;
        entry.leaseExpiresAt = null;
      }
      return result<Row>();
    }
    if (text.includes("idempotency:stats")) {
      return this.entry ? result<Row>([{ state: this.entry.state, count: "1" } as Row]) : result<Row>();
    }
    return result<Row>();
  }

  private matchesOwner(identity: unknown, owner: unknown, fencingToken: unknown): boolean {
    return Boolean(
      this.entry
      && this.entry.identity === identity
      && this.entry.state === "in_flight"
      && this.entry.leaseOwner === owner
      && this.entry.fencingToken === String(fencingToken)
      && Number(this.entry.leaseExpiresAt) > Date.now(),
    );
  }
}

class FakePostgresClient implements PostgresClientLike {
  private releaseLock: (() => void) | null = null;
  private readonly pool: FakePostgresPool;

  constructor(pool: FakePostgresPool) {
    this.pool = pool;
  }

  async query<Row = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<PostgresQueryResult<Row>> {
    if (text.includes("idempotency:claim-lock")) {
      this.releaseLock = await this.pool.acquireClaimLock();
      return result<Row>();
    }
    if (text === "COMMIT" || text === "ROLLBACK") {
      this.releaseLock?.();
      this.releaseLock = null;
      return result<Row>();
    }
    if (text === "BEGIN") return result<Row>();
    return this.pool.execute<Row>(text, values);
  }

  release(): void {
    this.releaseLock?.();
    this.releaseLock = null;
  }
}

function result<Row>(rows: Row[] = [], rowCount = rows.length): PostgresQueryResult<Row> {
  return { rows, rowCount };
}

function options(pool: PostgresPoolLike, overrides: Partial<IdempotencyCoordinatorOptions> = {}): IdempotencyCoordinatorOptions {
  return {
    storeMode: "postgres",
    postgresPool: pool,
    secret: SHARED_SECRET,
    leaseMs: 1_000,
    inFlightWaitMs: 1_000,
    pollIntervalMs: 10,
    ...overrides,
  };
}

function request(key: string) {
  return {
    headers: { "idempotency-key": key, authorization: "Bearer shared-tenant" },
    socket: { remoteAddress: "127.0.0.1" },
  };
}

describe("PostgreSQL idempotency coordinator", () => {
  it("requires an explicit connection and shared HMAC secret", () => {
    expect(() => createIdempotencyCoordinator({ storeMode: "postgres", secret: SHARED_SECRET })).toThrow(/POSTGRES_URL/);
    expect(() => createIdempotencyCoordinator({
      storeMode: "postgres",
      postgresPool: new FakePostgresPool(),
      secret: "short",
    })).toThrow(/HMAC_SECRET/);
  });

  it("coalesces one provider operation across coordinators", async () => {
    const pool = new FakePostgresPool();
    const owner = createIdempotencyCoordinator(options(pool));
    const duplicate = createIdempotencyCoordinator(options(pool));
    let calls = 0;
    let markStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const execution = {
      request: request("distributed-key"),
      route: "/chat",
      payload: { messages: [{ role: "user", content: "one operation" }] },
    };

    const first = owner.execute({
      ...execution,
      operation: async () => {
        calls += 1;
        markStarted();
        await pending;
        return { statusCode: 200, payload: { response: "one" } };
      },
    });
    await started;
    const second = duplicate.execute({
      ...execution,
      operation: async () => ({ call: ++calls }),
    });
    release();

    await expect(first).resolves.toMatchObject({ status: "created", replayed: false, replayable: true });
    await expect(second).resolves.toMatchObject({ status: "replayed", replayed: true, replayable: true });
    expect(calls).toBe(1);
    await owner.close();
    await duplicate.close();
  });

  it("fails closed before provider execution when the store is unavailable", async () => {
    const pool = new FakePostgresPool();
    pool.failInitialization = true;
    const coordinator = createIdempotencyCoordinator(options(pool));
    let calls = 0;

    const outcome = await coordinator.execute({
      request: request("unavailable-key"),
      route: "/chat",
      payload: {},
      operation: async () => ({ call: ++calls }),
    });

    expect(outcome).toMatchObject({
      accepted: false,
      statusCode: 503,
      code: "IDEMPOTENCY_STORE_UNAVAILABLE",
      retryable: true,
    });
    expect(calls).toBe(0);
    await coordinator.close();
  });

  it("returns an unconfirmed result when the fencing completion write loses ownership", async () => {
    const pool = new FakePostgresPool();
    pool.rejectCompletion = true;
    const coordinator = createIdempotencyCoordinator(options(pool));

    const outcome = await coordinator.execute({
      request: request("lost-fence-key"),
      route: "/chat",
      payload: {},
      operation: async () => ({ statusCode: 200 }),
    });

    expect(outcome).toMatchObject({
      accepted: true,
      status: "created-unconfirmed",
      replayable: false,
    });
    await coordinator.close();
  });
});
