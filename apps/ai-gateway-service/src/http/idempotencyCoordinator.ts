import { createHash, createHmac, randomBytes } from "node:crypto";
import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import { createSqliteIdempotencyCoordinator } from "./sqliteIdempotencyCoordinator.ts";

type IdempotencyRequest = {
  headers?: IncomingHttpHeaders;
  socket?: { remoteAddress?: string | null };
};

type IdempotencyResponse = Pick<ServerResponse, "getHeader" | "setHeader">;

export type IdempotencyAcceptedOutcome<T> = {
  accepted: true;
  status: "bypassed" | "created" | "created-unconfirmed" | "replayed";
  replayed: boolean;
  replayable: boolean;
  value: T;
};

export type IdempotencyRejectedOutcome = {
  accepted: false;
  status: "rejected";
  replayed: false;
  statusCode: number;
  code: string;
  message: string;
  retryable: boolean;
  replayable: false;
  retryAfterSeconds?: number;
};

export type IdempotencyOutcome<T> = IdempotencyAcceptedOutcome<T> | IdempotencyRejectedOutcome;

export type IdempotencyExecution<T> = {
  request?: IdempotencyRequest;
  route: string;
  payload: unknown;
  operation: () => T | Promise<T>;
};

export type IdempotencyCoordinatorOptions = {
  env?: NodeJS.ProcessEnv;
  now?: () => number;
  secret?: string | Buffer;
  ttlMs?: number;
  maxEntries?: number;
  maxResultBytes?: number;
  storeMode?: "memory" | "sqlite";
  sqlitePath?: string;
  leaseMs?: number;
  inFlightWaitMs?: number;
  pollIntervalMs?: number;
};

type StoredOutcome =
  | { type: "value"; value: unknown }
  | { type: "oversized" }
  | { type: "failed" };

type Entry = {
  fingerprint: string;
  expiresAt: number;
  outcome: StoredOutcome | null;
  promise: Promise<unknown> | null;
};

export type IdempotencyCoordinator = {
  execute<T>(execution: IdempotencyExecution<T>): Promise<IdempotencyOutcome<T>>;
  getStats(): {
    entries: number;
    inFlight: number;
    replayable: number;
    tombstones: number;
    ttlMs: number;
    maxEntries: number;
    maxResultBytes: number;
    storeMode: "memory" | "sqlite";
  };
  close(): void;
};

export const IDEMPOTENCY_RESPONSE_HEADERS = Object.freeze({
  status: "Idempotency-Status",
  replayed: "Idempotency-Replayed",
  replayable: "Idempotency-Replayable",
});

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 1_000;
const DEFAULT_MAX_RESULT_BYTES = 1_048_576;
const MAX_KEY_LENGTH = 255;

export function createIdempotencyCoordinator(options: IdempotencyCoordinatorOptions = {}): IdempotencyCoordinator {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const storeMode = options.storeMode ?? normalizeStoreMode(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE);
  const ttlMs = readBoundedNumber(
    options.ttlMs ?? env.AI_GATEWAY_IDEMPOTENCY_TTL_MS,
    DEFAULT_TTL_MS,
    1_000,
    24 * 60 * 60 * 1000,
  );
  const maxEntries = readBoundedNumber(
    options.maxEntries ?? env.AI_GATEWAY_IDEMPOTENCY_MAX_ENTRIES,
    DEFAULT_MAX_ENTRIES,
    1,
    100_000,
  );
  const maxResultBytes = readBoundedNumber(
    options.maxResultBytes ?? env.AI_GATEWAY_IDEMPOTENCY_MAX_RESULT_BYTES,
    DEFAULT_MAX_RESULT_BYTES,
    1,
    16 * 1_048_576,
  );
  if (storeMode === "sqlite") {
    const sqlitePath = options.sqlitePath ?? env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH;
    const secret = options.secret ?? env.AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET;
    if (!sqlitePath) {
      throw new Error("AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH is required when the idempotency store mode is sqlite.");
    }
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new Error("AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET must contain at least 32 bytes in sqlite mode.");
    }
    return createSqliteIdempotencyCoordinator({
      sqlitePath,
      secret,
      now,
      ttlMs,
      maxEntries,
      maxResultBytes,
      leaseMs: readBoundedNumber(options.leaseMs ?? env.AI_GATEWAY_IDEMPOTENCY_LEASE_MS, 300_000, 1_000, 30 * 60 * 1000),
      inFlightWaitMs: readBoundedNumber(options.inFlightWaitMs ?? env.AI_GATEWAY_IDEMPOTENCY_WAIT_MS, 30_000, 0, 120_000),
      pollIntervalMs: readBoundedNumber(options.pollIntervalMs ?? env.AI_GATEWAY_IDEMPOTENCY_POLL_MS, 50, 10, 1_000),
      normalizeKey,
      createIdentity,
      createFingerprint,
    });
  }
  const secret = options.secret ?? randomBytes(32);
  const entries = new Map<string, Entry>();

  return {
    async execute<T>({ request, route, payload, operation }: IdempotencyExecution<T>): Promise<IdempotencyOutcome<T>> {
      const rawKey = request?.headers?.["idempotency-key"];
      if (rawKey === undefined) {
        return accepted("bypassed", false, await operation(), false);
      }

      const keyResult = normalizeKey(rawKey);
      if (!keyResult.ok) {
        return rejected(400, "IDEMPOTENCY_KEY_INVALID", keyResult.message, false);
      }

      pruneExpired(entries, now());
      const identity = createIdentity({ request, route, key: keyResult.value, secret });
      const fingerprint = createFingerprint(payload);
      const existing = entries.get(identity);

      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return rejected(
            409,
            "IDEMPOTENCY_KEY_REUSED",
            "The idempotency key was already used with a different request payload.",
            false,
          );
        }
        return replayExisting<T>(existing);
      }

      if (entries.size >= maxEntries) {
        return rejected(
          503,
          "IDEMPOTENCY_CAPACITY_REACHED",
          "The bounded idempotency store is full. Retry after prior entries expire.",
          true,
          1,
        );
      }

      const entry = {
        fingerprint,
        expiresAt: Number.POSITIVE_INFINITY,
        outcome: null,
        promise: null,
      };
      entry.promise = Promise.resolve()
        .then(operation)
        .then((value) => {
          entry.expiresAt = now() + ttlMs;
          entry.outcome = createStoredOutcome(value, maxResultBytes);
          entry.promise = null;
          return value;
        })
        .catch((error) => {
          entry.expiresAt = now() + ttlMs;
          entry.outcome = { type: "failed" };
          entry.promise = null;
          throw error;
        });
      entries.set(identity, entry);

      const value = await entry.promise as T;
      return accepted("created", false, value, entry.outcome?.type === "value");
    },

    getStats() {
      pruneExpired(entries, now());
      let inFlight = 0;
      let replayable = 0;
      let tombstones = 0;
      for (const entry of entries.values()) {
        if (entry.promise) inFlight += 1;
        else if (entry.outcome?.type === "value") replayable += 1;
        else tombstones += 1;
      }
      return { entries: entries.size, inFlight, replayable, tombstones, ttlMs, maxEntries, maxResultBytes, storeMode: "memory" };
    },

    close() {},
  };
}

export function applyIdempotencyResponseHeaders(
  response: IdempotencyResponse | undefined,
  outcome: IdempotencyOutcome<unknown>,
): void {
  if (!response || outcome?.status === "bypassed") return;
  response.setHeader(IDEMPOTENCY_RESPONSE_HEADERS.status, outcome?.accepted ? outcome.status : "rejected");
  response.setHeader(IDEMPOTENCY_RESPONSE_HEADERS.replayed, String(outcome?.replayed === true));
  response.setHeader(IDEMPOTENCY_RESPONSE_HEADERS.replayable, String(outcome?.accepted === true && outcome.replayable));

  const existing = response.getHeader?.("Access-Control-Expose-Headers");
  const exposed = new Set(
    String(existing ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  for (const header of Object.values(IDEMPOTENCY_RESPONSE_HEADERS)) exposed.add(header);
  response.setHeader("Access-Control-Expose-Headers", [...exposed].join(", "));
}

function accepted<T>(
  status: IdempotencyAcceptedOutcome<T>["status"],
  replayed: boolean,
  value: T,
  replayable = true,
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
    statusCode,
    code,
    message,
    retryable,
    replayable: false,
    ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
  };
}

async function replayExisting<T>(entry: Entry): Promise<IdempotencyOutcome<T>> {
  if (entry.promise) {
    return accepted("replayed", true, await entry.promise as T);
  }
  if (entry.outcome?.type === "value") {
    return accepted("replayed", true, entry.outcome.value as T);
  }
  if (entry.outcome?.type === "oversized") {
    return rejected(
      409,
      "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
      "The original request completed, but its result exceeded the replay cache limit.",
      false,
    );
  }
  return rejected(
    409,
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
    "The original request failed after execution started and will not be run again with this key.",
    false,
  );
}

function createStoredOutcome(value: unknown, maxResultBytes: number): StoredOutcome {
  try {
    const bytes = Buffer.byteLength(JSON.stringify(value));
    return bytes <= maxResultBytes ? { type: "value", value } : { type: "oversized" };
  } catch {
    return { type: "oversized" };
  }
}

function normalizeKey(rawKey: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (typeof rawKey !== "string") {
    return { ok: false, message: "Idempotency-Key must contain exactly one string value." };
  }
  if (rawKey.length < 1 || rawKey.length > MAX_KEY_LENGTH) {
    return { ok: false, message: `Idempotency-Key must contain between 1 and ${MAX_KEY_LENGTH} characters.` };
  }
  if (!/^[\x21-\x7E]+$/.test(rawKey)) {
    return { ok: false, message: "Idempotency-Key must contain visible ASCII characters without spaces." };
  }
  return { ok: true, value: rawKey };
}

function createIdentity({
  request,
  route,
  key,
  secret,
}: {
  request?: IdempotencyRequest;
  route: string;
  key: string;
  secret: string | Buffer;
}): string {
  const credential = request?.headers?.authorization ?? request?.headers?.["x-api-key"];
  const caller = typeof credential === "string" && credential
    ? `credential:${credential}`
    : `network:${request?.socket?.remoteAddress ?? "anonymous"}`;
  return createHmac("sha256", secret)
    .update(String(route ?? ""))
    .update("\0")
    .update(caller)
    .update("\0")
    .update(key)
    .digest("hex");
}

function createFingerprint(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const fields = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${fields.join(",")}}`;
}

function pruneExpired(entries: Map<string, Entry>, timestamp: number): void {
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= timestamp) entries.delete(key);
  }
}

function readBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function normalizeStoreMode(value: string | undefined): "memory" | "sqlite" {
  if (value === undefined || value === "" || value === "memory") return "memory";
  if (value === "sqlite") return "sqlite";
  throw new Error(`Unsupported idempotency store mode: ${value}`);
}
