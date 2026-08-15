import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type {
  IdempotencyAcceptedOutcome,
  IdempotencyCoordinator,
  IdempotencyExecution,
  IdempotencyOutcome,
  IdempotencyRejectedOutcome,
} from "./idempotencyCoordinator.ts";

type SqliteCoordinatorOptions = {
  sqlitePath: string;
  secret: string | Buffer;
  now: () => number;
  ttlMs: number;
  maxEntries: number;
  maxResultBytes: number;
  leaseMs: number;
  inFlightWaitMs: number;
  pollIntervalMs: number;
  normalizeKey: (value: unknown) => { ok: true; value: string } | { ok: false; message: string };
  createIdentity: (input: { request?: IdempotencyExecution<unknown>["request"]; route: string; key: string; secret: string | Buffer }) => string;
  createFingerprint: (payload: unknown) => string;
};

type EntryState = "in_flight" | "completed" | "oversized" | "failed" | "unknown";

type EntryRow = {
  identity: string;
  fingerprint: string;
  state: EntryState;
  lease_owner: string | null;
  lease_expires_at: number | null;
  expires_at: number;
  result_json: string | null;
};

type ClaimDecision<T> =
  | { kind: "owner"; leaseOwner: string }
  | { kind: "in_flight"; leaseExpiresAt: number }
  | { kind: "accepted"; outcome: IdempotencyAcceptedOutcome<T> }
  | { kind: "rejected"; outcome: IdempotencyRejectedOutcome };

const require = createRequire(import.meta.url);

export function createSqliteIdempotencyCoordinator(options: SqliteCoordinatorOptions): IdempotencyCoordinator {
  mkdirSync(dirname(options.sqlitePath), { recursive: true });
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  const db = new DatabaseSync(options.sqlitePath);
  db.exec("PRAGMA busy_timeout = 5000");
  try { db.exec("PRAGMA journal_mode = WAL"); } catch { /* WAL is an optimization; atomic transactions remain required. */ }
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_entries (
      identity TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('in_flight', 'completed', 'oversized', 'failed', 'unknown')),
      lease_owner TEXT,
      lease_expires_at INTEGER,
      expires_at INTEGER NOT NULL,
      result_json TEXT,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idempotency_entries_expiry_idx
      ON idempotency_entries (expires_at);
  `);
  try { chmodSync(options.sqlitePath, 0o600); } catch { /* Best effort on platforms without POSIX modes. */ }

  const selectEntry = db.prepare(`
    SELECT identity, fingerprint, state, lease_owner, lease_expires_at, expires_at, result_json
    FROM idempotency_entries WHERE identity = ?
  `);
  const insertEntry = db.prepare(`
    INSERT INTO idempotency_entries (
      identity, fingerprint, state, lease_owner, lease_expires_at, expires_at, result_json, updated_at
    ) VALUES (?, ?, 'in_flight', ?, ?, ?, NULL, ?)
  `);
  const expireLeases = db.prepare(`
    UPDATE idempotency_entries
    SET state = 'unknown', lease_owner = NULL, lease_expires_at = NULL,
        expires_at = CASE WHEN expires_at > ? THEN expires_at ELSE ? END,
        updated_at = ?
    WHERE state = 'in_flight' AND lease_expires_at <= ?
  `);
  const deleteExpired = db.prepare(`
    DELETE FROM idempotency_entries WHERE state <> 'in_flight' AND expires_at <= ?
  `);
  const countEntries = db.prepare("SELECT state, COUNT(*) AS count FROM idempotency_entries GROUP BY state");
  const renewLease = db.prepare(`
    UPDATE idempotency_entries
    SET lease_expires_at = ?, updated_at = ?
    WHERE identity = ? AND state = 'in_flight' AND lease_owner = ?
  `);
  const completeEntry = db.prepare(`
    UPDATE idempotency_entries
    SET state = ?, lease_owner = NULL, lease_expires_at = NULL, expires_at = ?, result_json = ?, updated_at = ?
    WHERE identity = ? AND state = 'in_flight' AND lease_owner = ?
  `);
  const failEntry = db.prepare(`
    UPDATE idempotency_entries
    SET state = 'failed', lease_owner = NULL, lease_expires_at = NULL, expires_at = ?, result_json = NULL, updated_at = ?
    WHERE identity = ? AND state = 'in_flight' AND lease_owner = ?
  `);

  let closed = false;

  return {
    async execute<T>({ request, route, payload, operation }: IdempotencyExecution<T>): Promise<IdempotencyOutcome<T>> {
      const rawKey = request?.headers?.["idempotency-key"];
      if (rawKey === undefined) return accepted("bypassed", false, false, await operation());

      const keyResult = options.normalizeKey(rawKey);
      if (!keyResult.ok) return rejected(400, "IDEMPOTENCY_KEY_INVALID", keyResult.message, false);

      const identity = options.createIdentity({ request, route, key: keyResult.value, secret: options.secret });
      const fingerprint = options.createFingerprint(payload);
      let decision: ClaimDecision<T>;
      try {
        decision = claimOrRead<T>(identity, fingerprint);
      } catch {
        return storeUnavailable();
      }

      if (decision.kind === "owner") {
        return executeOwned(identity, decision.leaseOwner, operation);
      }
      if (decision.kind === "in_flight") {
        return waitForOwner<T>(identity, fingerprint, decision.leaseExpiresAt);
      }
      return decision.outcome;
    },

    getStats() {
      if (closed) {
        return {
          entries: 0,
          inFlight: 0,
          replayable: 0,
          tombstones: 0,
          ttlMs: options.ttlMs,
          maxEntries: options.maxEntries,
          maxResultBytes: options.maxResultBytes,
          storeMode: "sqlite" as const,
        };
      }
      const counts = new Map<EntryState, number>();
      for (const row of countEntries.all() as Array<{ state: EntryState; count: number }>) {
        counts.set(row.state, Number(row.count));
      }
      return {
        entries: [...counts.values()].reduce((sum, value) => sum + value, 0),
        inFlight: counts.get("in_flight") ?? 0,
        replayable: counts.get("completed") ?? 0,
        tombstones: (counts.get("oversized") ?? 0) + (counts.get("failed") ?? 0) + (counts.get("unknown") ?? 0),
        ttlMs: options.ttlMs,
        maxEntries: options.maxEntries,
        maxResultBytes: options.maxResultBytes,
        storeMode: "sqlite" as const,
      };
    },

    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };

  function claimOrRead<T>(identity: string, fingerprint: string): ClaimDecision<T> {
    const timestamp = options.now();
    const leaseOwner = randomUUID();
    return immediateTransaction(() => {
      const expiryFloor = timestamp + options.ttlMs;
      expireLeases.run(expiryFloor, expiryFloor, timestamp, timestamp);
      deleteExpired.run(timestamp);

      const row = selectEntry.get(identity) as EntryRow | undefined;
      if (row) return decodeRow<T>(row, fingerprint);

      const total = Number((db.prepare("SELECT COUNT(*) AS count FROM idempotency_entries").get() as { count: number }).count);
      if (total >= options.maxEntries) {
        return {
          kind: "rejected",
          outcome: rejected(503, "IDEMPOTENCY_CAPACITY_REACHED", "The bounded idempotency store is full. Retry after prior entries expire.", true, 1),
        };
      }

      insertEntry.run(
        identity,
        fingerprint,
        leaseOwner,
        timestamp + options.leaseMs,
        timestamp + options.ttlMs,
        timestamp,
      );
      return { kind: "owner", leaseOwner };
    });
  }

  function decodeRow<T>(row: EntryRow, fingerprint: string): ClaimDecision<T> {
    if (row.fingerprint !== fingerprint) {
      return {
        kind: "rejected",
        outcome: rejected(409, "IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used with a different request payload.", false),
      };
    }
    if (row.state === "in_flight") {
      return { kind: "in_flight", leaseExpiresAt: Number(row.lease_expires_at ?? options.now()) };
    }
    if (row.state === "completed") {
      try {
        return { kind: "accepted", outcome: accepted("replayed", true, true, JSON.parse(row.result_json ?? "null") as T) };
      } catch {
        return { kind: "rejected", outcome: rejected(500, "IDEMPOTENCY_STORE_CORRUPT", "The stored idempotency result could not be decoded.", false) };
      }
    }
    if (row.state === "oversized") {
      return { kind: "rejected", outcome: rejected(409, "IDEMPOTENCY_RESULT_NOT_REPLAYABLE", "The original request completed, but its result exceeded the replay cache limit.", false) };
    }
    if (row.state === "failed") {
      return { kind: "rejected", outcome: rejected(409, "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED", "The original request failed after execution started and will not be run again with this key.", false) };
    }
    return { kind: "rejected", outcome: rejected(409, "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN", "A previous owner lost its lease before recording a result. Reconciliation is required before using a new key.", false) };
  }

  async function waitForOwner<T>(identity: string, fingerprint: string, leaseExpiresAt: number): Promise<IdempotencyOutcome<T>> {
    const waitDeadline = options.now() + options.inFlightWaitMs;
    while (options.now() < waitDeadline) {
      await delay(options.pollIntervalMs);
      try {
        const row = selectEntry.get(identity) as EntryRow | undefined;
        if (row && row.state !== "in_flight") {
          const decision = decodeRow<T>(row, fingerprint);
          return decision.kind === "accepted" || decision.kind === "rejected" ? decision.outcome : storeUnavailable();
        }
        if (!row || Number(row.lease_expires_at ?? 0) <= options.now()) {
          const decision = claimOrRead<T>(identity, fingerprint);
          return decision.kind === "accepted" || decision.kind === "rejected" ? decision.outcome :
            rejected(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS", "The original request is still in progress.", true, 1);
        }
        leaseExpiresAt = Number(row.lease_expires_at);
      } catch {
        return storeUnavailable();
      }
    }
    const remainingSeconds = Math.max(1, Math.ceil((leaseExpiresAt - options.now()) / 1000));
    return rejected(409, "IDEMPOTENCY_REQUEST_IN_PROGRESS", "The original request is still in progress.", true, remainingSeconds);
  }

  async function executeOwned<T>(identity: string, leaseOwner: string, operation: () => T | Promise<T>): Promise<IdempotencyOutcome<T>> {
    const heartbeatMs = Math.max(250, Math.floor(options.leaseMs / 3));
    const heartbeat = setInterval(() => {
      const timestamp = options.now();
      try { renewLease.run(timestamp + options.leaseMs, timestamp, identity, leaseOwner); } catch { /* Expiry becomes an unknown tombstone. */ }
    }, heartbeatMs);
    heartbeat.unref();

    try {
      const value = await operation();
      const encoded = encodeResult(value, options.maxResultBytes);
      const timestamp = options.now();
      try {
        const update = completeEntry.run(
          encoded.replayable ? "completed" : "oversized",
          timestamp + options.ttlMs,
          encoded.json,
          timestamp,
          identity,
          leaseOwner,
        );
        const durable = Number(update.changes) === 1;
        return accepted(durable ? "created" : "created-unconfirmed", false, durable && encoded.replayable, value);
      } catch {
        return accepted("created-unconfirmed", false, false, value);
      }
    } catch (error) {
      const timestamp = options.now();
      try { failEntry.run(timestamp + options.ttlMs, timestamp, identity, leaseOwner); } catch { /* Lease expiry remains fail-closed. */ }
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  function immediateTransaction<T>(operation: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = operation();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch { /* Preserve the original database error. */ }
      throw error;
    }
  }
}

function accepted<T>(
  status: IdempotencyAcceptedOutcome<T>["status"],
  replayed: boolean,
  replayable: boolean,
  value: T,
): IdempotencyAcceptedOutcome<T> {
  return { accepted: true, status, replayed, replayable, value };
}

function rejected(
  statusCode: number,
  code: string,
  message: string,
  retryable: boolean,
  retryAfterSeconds?: number,
): IdempotencyRejectedOutcome {
  return {
    accepted: false,
    status: "rejected",
    replayed: false,
    replayable: false,
    statusCode,
    code,
    message,
    retryable,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

function storeUnavailable(): IdempotencyRejectedOutcome {
  return rejected(503, "IDEMPOTENCY_STORE_UNAVAILABLE", "The shared idempotency store is unavailable.", true, 1);
}

function encodeResult(value: unknown, maxResultBytes: number): { replayable: boolean; json: string | null } {
  try {
    const json = JSON.stringify(value);
    if (json === undefined || Buffer.byteLength(json) > maxResultBytes) return { replayable: false, json: null };
    return { replayable: true, json };
  } catch {
    return { replayable: false, json: null };
  }
}
