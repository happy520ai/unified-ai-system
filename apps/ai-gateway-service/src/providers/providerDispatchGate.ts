import { createHash } from "node:crypto";
import { resolve } from "node:path";

import {
  createIdempotencyCoordinator,
  type IdempotencyCoordinator,
} from "../http/idempotencyCoordinator.ts";
import {
  isMultiInstanceEnabled,
  loadOrCreateSharedSecret,
} from "../http/multiInstanceConfig.js";

type RuntimeEnv = Record<string, string | undefined>;
type StoreMode = "disabled" | "sqlite" | "postgres";

export type ProviderDispatchReservationInput = {
  dispatchKeyHash?: unknown;
  dispatchKeyInvalid?: boolean;
  route?: unknown;
  invocation?: unknown;
  attempt?: unknown;
  shadow?: boolean;
  tenantId?: unknown;
  providerId?: unknown;
  modelId?: unknown;
  requestFingerprint?: unknown;
};

export type ProviderDispatchGate = {
  readonly status: {
    mode: StoreMode;
    enabled: boolean;
    required: boolean;
    durable: boolean;
    distributed: boolean;
    centralRequired: boolean;
    ttlMs: number;
    maxEntries: number;
  };
  reserve(input: ProviderDispatchReservationInput): Promise<{
    reserved: boolean;
    bypassed: boolean;
    reservationFingerprint: string | null;
  }>;
  getHealth(): Record<string, unknown>;
  checkHealth(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
};

const DEFAULT_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_MAX_ENTRIES = 100_000;
const DEFAULT_SQLITE_PATH = ".data/provider-dispatch.sqlite";
const DEFAULT_SECRET_PATH = ".data/provider-dispatch-hmac.key";

export function createProviderDispatchGate({
  env = process.env,
  realProviderEnabled = false,
  coordinator,
}: {
  env?: RuntimeEnv;
  realProviderEnabled?: boolean;
  coordinator?: IdempotencyCoordinator;
} = {}): ProviderDispatchGate {
  if (!realProviderEnabled && !coordinator) return createDisabledGate();

  const required = readBoolean(
    env.AI_GATEWAY_PROVIDER_DISPATCH_KEY_REQUIRED,
    true,
    "AI_GATEWAY_PROVIDER_DISPATCH_KEY_REQUIRED",
  );
  const centralRequired = readBoolean(
    env.AI_GATEWAY_PROVIDER_DISPATCH_CENTRAL_REQUIRED,
    false,
    "AI_GATEWAY_PROVIDER_DISPATCH_CENTRAL_REQUIRED",
  ) || (realProviderEnabled && isMultiInstanceEnabled(env));
  const mode = coordinator ? resolveInjectedMode(coordinator) : resolveMode(env);
  if (mode === "disabled") {
    throw configurationError(
      "PROVIDER_DISPATCH_DURABLE_STORE_REQUIRED",
      "Real-provider execution requires a durable provider dispatch reservation store.",
    );
  }
  if (centralRequired && mode !== "postgres") {
    throw configurationError(
      "PROVIDER_DISPATCH_CENTRAL_STORE_REQUIRED",
      "Multi-instance real-provider execution requires central PostgreSQL dispatch reservations.",
    );
  }
  const ttlMs = boundedInteger(
    env.AI_GATEWAY_PROVIDER_DISPATCH_TTL_MS,
    DEFAULT_TTL_MS,
    60_000,
    24 * 60 * 60_000,
    "AI_GATEWAY_PROVIDER_DISPATCH_TTL_MS",
  );
  const maxEntries = boundedInteger(
    env.AI_GATEWAY_PROVIDER_DISPATCH_MAX_ENTRIES,
    DEFAULT_MAX_ENTRIES,
    1,
    1_000_000,
    "AI_GATEWAY_PROVIDER_DISPATCH_MAX_ENTRIES",
  );
  const ownsCoordinator = !coordinator;
  const dispatchCoordinator = coordinator ?? createCoordinator({
    env,
    mode,
    ttlMs,
    maxEntries,
  });
  const status = Object.freeze({
    mode,
    enabled: true,
    required,
    durable: true,
    distributed: mode === "postgres",
    centralRequired,
    ttlMs,
    maxEntries,
  });

  return {
    status,
    async reserve(input) {
      if (input.dispatchKeyInvalid === true) {
        throw dispatchError(
          "PROVIDER_DISPATCH_KEY_INVALID",
          "Idempotency-Key must be 1-255 visible ASCII characters.",
          400,
          "validation",
        );
      }
      const dispatchKeyHash = optionalDigest(input.dispatchKeyHash);
      if (!dispatchKeyHash) {
        if (required) {
          throw dispatchError(
            "PROVIDER_DISPATCH_KEY_REQUIRED",
            "Real-provider execution requires an Idempotency-Key header.",
            400,
            "validation",
          );
        }
        return { reserved: false, bypassed: true, reservationFingerprint: null };
      }
      const route = boundedText(input.route ?? "/internal", "route", 2_048);
      const invocation = boundedReservationInteger(input.invocation, 1, 1, 10_000, "invocation");
      const attempt = boundedReservationInteger(input.attempt, 1, 1, 100, "attempt");
      const tenantId = boundedText(input.tenantId ?? "default", "tenantId", 256);
      const providerId = boundedText(input.providerId, "providerId", 256);
      const modelId = boundedText(input.modelId, "modelId", 256);
      const requestFingerprint = requiredDigest(input.requestFingerprint, "requestFingerprint");
      const routeHash = createHash("sha256").update(route).digest("hex").slice(0, 24);
      const tenantFingerprint = createHash("sha256").update(tenantId).digest("hex");
      const reservationRoute = [
        "/__provider-dispatch",
        routeHash,
        String(invocation),
        String(attempt),
        input.shadow === true ? "shadow" : "primary",
      ].join("/");
      let outcome;
      try {
        outcome = await dispatchCoordinator.execute({
          request: {
            headers: {
              "idempotency-key": dispatchKeyHash,
              authorization: `Bearer pd-${tenantFingerprint}`,
            },
            socket: { remoteAddress: "127.0.0.1" },
          },
          route: reservationRoute,
          payload: {
            requestFingerprint,
            providerId,
            modelId,
          },
          // maxResultBytes=1 makes the durable terminal state a tombstone. The
          // first caller receives this value, while every replay fails closed
          // instead of re-running an external provider call.
          operation: async () => ({ reserved: true }),
        });
      } catch (error) {
        throw dispatchError(
          "PROVIDER_DISPATCH_STORE_UNAVAILABLE",
          "The durable provider dispatch reservation could not be committed.",
          503,
          "persistence",
          true,
          error,
        );
      }
      if (!outcome.accepted) throw mapRejectedOutcome(outcome);
      if (outcome.status !== "created") {
        throw dispatchError(
          "PROVIDER_DISPATCH_RESERVATION_UNCONFIRMED",
          "The provider dispatch reservation was not durably confirmed.",
          409,
          "persistence",
          false,
        );
      }
      return {
        reserved: true,
        bypassed: false,
        reservationFingerprint: createHash("sha256")
          .update([
            "provider-dispatch-log-v1",
            dispatchKeyHash,
            requestFingerprint,
            tenantFingerprint,
            reservationRoute,
            providerId,
            modelId,
          ].join("\0"))
          .digest("hex")
          .slice(0, 16),
      };
    },
    getHealth() {
      const snapshot = dispatchCoordinator.getStats();
      return safeHealth(status, snapshot);
    },
    async checkHealth() {
      const snapshot = dispatchCoordinator.checkHealth
        ? await dispatchCoordinator.checkHealth()
        : dispatchCoordinator.getStats();
      return safeHealth(status, snapshot);
    },
    async close() {
      if (ownsCoordinator) await dispatchCoordinator.close();
    },
  };
}

function createCoordinator({
  env,
  mode,
  ttlMs,
  maxEntries,
}: {
  env: RuntimeEnv;
  mode: Exclude<StoreMode, "disabled">;
  ttlMs: number;
  maxEntries: number;
}) {
  const explicitSecret = String(env.AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET ?? "").trim()
    || undefined;
  if (explicitSecret && Buffer.byteLength(explicitSecret) < 32) {
    throw configurationError(
      "PROVIDER_DISPATCH_HMAC_SECRET_REQUIRED",
      `Provider dispatch ${mode} mode requires a stable HMAC secret of at least 32 bytes.`,
    );
  }
  const secret = mode === "sqlite"
      ? loadOrCreateSharedSecret({
        env,
        explicitSecret: explicitSecret ?? null,
        secretPath: env.AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET_PATH
          ?? DEFAULT_SECRET_PATH,
      })
    : explicitSecret;
  if (!secret || Buffer.byteLength(String(secret)) < 32) {
    throw configurationError(
      "PROVIDER_DISPATCH_HMAC_SECRET_REQUIRED",
      `Provider dispatch ${mode} mode requires a stable HMAC secret of at least 32 bytes.`,
    );
  }
  const postgresConnectionString = mode === "postgres"
    ? String(
        env.AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL
          ?? env.AI_GATEWAY_IDEMPOTENCY_POSTGRES_URL
          ?? env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL
          ?? "",
      ).trim()
    : undefined;
  if (mode === "postgres" && !postgresConnectionString) {
    throw configurationError(
      "PROVIDER_DISPATCH_POSTGRES_URL_REQUIRED",
      "PostgreSQL provider dispatch mode requires a PostgreSQL URL.",
    );
  }
  const usageUrl = String(env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL ?? "").trim();
  if (
    mode === "postgres"
    && usageUrl
    && postgresConnectionString
    && !samePostgresTarget(usageUrl, postgresConnectionString)
  ) {
    throw configurationError(
      "PROVIDER_DISPATCH_DATABASE_MISMATCH",
      "Provider dispatch reservations and the central usage ledger must use the same PostgreSQL database.",
    );
  }
  return createIdempotencyCoordinator({
    env: {
      ...env,
      AI_GATEWAY_IDEMPOTENCY_POSTGRES_TLS_REQUIRED:
        env.AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_TLS_REQUIRED ?? "true",
    } as NodeJS.ProcessEnv,
    storeMode: mode,
    sqlitePath: mode === "sqlite"
      ? resolve(env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH ?? DEFAULT_SQLITE_PATH)
      : undefined,
    postgresConnectionString,
    secret,
    ttlMs,
    maxEntries,
    maxEntriesLimit: 1_000_000,
    maxResultBytes: 1,
    postgresStorageNamespace: "provider-dispatch",
    leaseMs: 30_000,
    inFlightWaitMs: 0,
    pollIntervalMs: 25,
  });
}

function resolveMode(env: RuntimeEnv): StoreMode {
  const configured = String(env.AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  if (configured === "sqlite" || configured === "postgres") return configured;
  if (configured === "disabled") return "disabled";
  if (configured) {
    throw configurationError(
      "PROVIDER_DISPATCH_STORE_MODE_INVALID",
      "AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE must be sqlite or postgres.",
    );
  }
  return String(
    env.AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL
      ?? env.AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL
      ?? "",
  ).trim()
    ? "postgres"
    : "sqlite";
}

function resolveInjectedMode(coordinator: IdempotencyCoordinator): StoreMode {
  const mode = coordinator.getStats().storeMode;
  if (mode === "sqlite" || mode === "postgres") return mode;
  throw configurationError(
    "PROVIDER_DISPATCH_COORDINATOR_NOT_DURABLE",
    "An injected provider dispatch coordinator must use SQLite or PostgreSQL.",
  );
}

function mapRejectedOutcome(outcome: {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}) {
  if (outcome.code === "IDEMPOTENCY_KEY_REUSED") {
    return dispatchError(
      "PROVIDER_DISPATCH_KEY_REUSED",
      "The provider dispatch key was already used with a different request.",
      409,
      "validation",
    );
  }
  if (outcome.code === "IDEMPOTENCY_STORE_UNAVAILABLE") {
    return dispatchError(
      "PROVIDER_DISPATCH_STORE_UNAVAILABLE",
      "The durable provider dispatch store is unavailable.",
      503,
      "persistence",
      true,
    );
  }
  if (outcome.code === "IDEMPOTENCY_CAPACITY_REACHED") {
    return dispatchError(
      "PROVIDER_DISPATCH_CAPACITY_REACHED",
      "The bounded provider dispatch reservation store is full.",
      503,
      "persistence",
      true,
    );
  }
  if (new Set([
    "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
    "IDEMPOTENCY_REQUEST_IN_PROGRESS",
  ]).has(outcome.code)) {
    return dispatchError(
      "PROVIDER_DISPATCH_ALREADY_RESERVED",
      "This provider dispatch key has already been consumed; the prior external outcome may be unknown.",
      409,
      "concurrency",
      false,
    );
  }
  return dispatchError(
    "PROVIDER_DISPATCH_STORE_UNAVAILABLE",
    "The durable provider dispatch store returned an unsafe state.",
    503,
    "persistence",
    outcome.retryable === true,
  );
}

function safeHealth(status: ProviderDispatchGate["status"], snapshot: Record<string, unknown>) {
  return Object.freeze({
    ...status,
    ttlMs: Number(snapshot.ttlMs ?? status.ttlMs),
    maxEntries: Number(snapshot.maxEntries ?? status.maxEntries),
    available: snapshot.available !== false,
    entries: Number(snapshot.entries ?? 0),
    inFlight: Number(snapshot.inFlight ?? 0),
    tombstones: Number(snapshot.tombstones ?? 0),
    statsUpdatedAt: snapshot.statsUpdatedAt ?? null,
  });
}

function createDisabledGate(): ProviderDispatchGate {
  const status = Object.freeze({
    mode: "disabled" as const,
    enabled: false,
    required: false,
    durable: false,
    distributed: false,
    centralRequired: false,
    ttlMs: 0,
    maxEntries: 0,
  });
  return {
    status,
    async reserve() {
      return { reserved: false, bypassed: true, reservationFingerprint: null };
    },
    getHealth() {
      return Object.freeze({ ...status, available: true, entries: 0, inFlight: 0, tombstones: 0 });
    },
    async checkHealth() {
      return this.getHealth();
    },
    async close() {},
  };
}

function optionalDigest(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return requiredDigest(value, "dispatchKeyHash");
}

function requiredDigest(value: unknown, name: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw dispatchError(
      "PROVIDER_DISPATCH_INPUT_INVALID",
      `${name} must be a SHA-256 digest.`,
      400,
      "validation",
    );
  }
  return normalized;
}

function boundedText(value: unknown, name: string, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw dispatchError(
      "PROVIDER_DISPATCH_INPUT_INVALID",
      `${name} is missing, too long, or contains control characters.`,
      400,
      "validation",
    );
  }
  return normalized;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(
      "PROVIDER_DISPATCH_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function boundedReservationInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw dispatchError(
      "PROVIDER_DISPATCH_INPUT_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
      400,
      "validation",
    );
  }
  return parsed;
}

function readBoolean(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configurationError(
    "PROVIDER_DISPATCH_CONFIGURATION_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function samePostgresTarget(left: string, right: string) {
  try {
    const a = new URL(left);
    const b = new URL(right);
    return a.protocol.replace("postgresql:", "postgres:") === b.protocol.replace("postgresql:", "postgres:")
      && a.hostname.toLowerCase() === b.hostname.toLowerCase()
      && (a.port || "5432") === (b.port || "5432")
      && a.pathname === b.pathname;
  } catch {
    return false;
  }
}

function configurationError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    category: "configuration" as const,
  });
}

function dispatchError(
  code: string,
  message: string,
  statusCode: number,
  category: string,
  retryable = false,
  cause?: unknown,
) {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    category,
    retryable,
    ...(cause ? { cause } : {}),
  });
}

export const providerDispatchGateInternals = Object.freeze({
  resolveMode,
  samePostgresTarget,
});
