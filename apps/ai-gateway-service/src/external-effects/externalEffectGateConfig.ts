import { resolve } from "node:path";

import {
  createIdempotencyCoordinator,
  type IdempotencyCoordinator,
} from "../http/idempotencyCoordinator.ts";
import {
  isMultiInstanceEnabled,
  loadOrCreateSharedSecret,
} from "../http/multiInstanceConfig.js";

export type ExternalEffectRuntimeEnv = Record<string, string | undefined>;
export type ExternalEffectStoreMode = "disabled" | "sqlite" | "postgres";

const DEFAULT_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_MAX_ENTRIES = 100_000;
const DEFAULT_SQLITE_PATH = ".data/external-effects.sqlite";
const DEFAULT_SECRET_PATH = ".data/external-effects-hmac.key";

export function resolveExternalEffectGateResources({
  env,
  enabled,
  coordinator,
}: {
  env: ExternalEffectRuntimeEnv;
  enabled: boolean;
  coordinator?: IdempotencyCoordinator;
}) {
  const centralRequired = readBoolean(
    env.AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED,
    false,
    "AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED",
  ) || (enabled && isMultiInstanceEnabled(env));
  const mode = coordinator ? resolveInjectedMode(coordinator) : resolveMode(env);
  if (mode === "disabled") {
    throw configurationError(
      "EXTERNAL_EFFECT_DURABLE_STORE_REQUIRED",
      "Enabled irreversible external effects require a durable reservation store.",
    );
  }
  if (centralRequired && mode !== "postgres") {
    throw configurationError(
      "EXTERNAL_EFFECT_CENTRAL_STORE_REQUIRED",
      "Multi-instance irreversible effects require central PostgreSQL reservations.",
    );
  }
  const ttlMs = boundedInteger(
    env.AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS,
    DEFAULT_TTL_MS,
    60_000,
    24 * 60 * 60_000,
    "AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS",
  );
  const maxEntries = boundedInteger(
    env.AI_GATEWAY_EXTERNAL_EFFECT_MAX_ENTRIES,
    DEFAULT_MAX_ENTRIES,
    1,
    1_000_000,
    "AI_GATEWAY_EXTERNAL_EFFECT_MAX_ENTRIES",
  );
  const ownsCoordinator = !coordinator;
  const effectCoordinator = coordinator ?? createCoordinator({ env, mode, ttlMs, maxEntries });
  return { centralRequired, mode, ttlMs, maxEntries, ownsCoordinator, effectCoordinator };
}

function createCoordinator({
  env,
  mode,
  ttlMs,
  maxEntries,
}: {
  env: ExternalEffectRuntimeEnv;
  mode: Exclude<ExternalEffectStoreMode, "disabled">;
  ttlMs: number;
  maxEntries: number;
}) {
  const explicitSecret = String(env.AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET ?? "").trim() || undefined;
  if (explicitSecret && Buffer.byteLength(explicitSecret) < 32) {
    throw configurationError(
      "EXTERNAL_EFFECT_HMAC_SECRET_REQUIRED",
      `External-effect ${mode} mode requires a stable HMAC secret of at least 32 bytes.`,
    );
  }
  const secret = mode === "sqlite"
    ? loadOrCreateSharedSecret({
        env,
        explicitSecret: explicitSecret ?? null,
        secretPath: env.AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH ?? DEFAULT_SECRET_PATH,
      })
    : explicitSecret;
  if (!secret || Buffer.byteLength(String(secret)) < 32) {
    throw configurationError(
      "EXTERNAL_EFFECT_HMAC_SECRET_REQUIRED",
      `External-effect ${mode} mode requires a stable HMAC secret of at least 32 bytes.`,
    );
  }
  const postgresConnectionString = mode === "postgres"
    ? String(
        env.AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL
          ?? env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
          ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
          ?? env.AI_GATEWAY_IDEMPOTENCY_POSTGRES_URL
          ?? "",
      ).trim()
    : undefined;
  if (mode === "postgres" && !postgresConnectionString) {
    throw configurationError(
      "EXTERNAL_EFFECT_POSTGRES_URL_REQUIRED",
      "PostgreSQL external-effect mode requires a PostgreSQL URL.",
    );
  }
  const workforceUrl = String(
    env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
      ?? "",
  ).trim();
  if (
    mode === "postgres"
    && workforceUrl
    && postgresConnectionString
    && !samePostgresTarget(workforceUrl, postgresConnectionString)
  ) {
    throw configurationError(
      "EXTERNAL_EFFECT_DATABASE_MISMATCH",
      "External-effect reservations and Workforce claims must use the same PostgreSQL database.",
    );
  }
  return createIdempotencyCoordinator({
    env: {
      ...env,
      AI_GATEWAY_IDEMPOTENCY_POSTGRES_TLS_REQUIRED:
        env.AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_TLS_REQUIRED ?? "true",
    } as NodeJS.ProcessEnv,
    storeMode: mode,
    sqlitePath: mode === "sqlite"
      ? resolve(env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH ?? DEFAULT_SQLITE_PATH)
      : undefined,
    postgresConnectionString,
    secret,
    ttlMs,
    maxEntries,
    maxEntriesLimit: 1_000_000,
    maxResultBytes: 1,
    postgresStorageNamespace: "external-effect",
    leaseMs: 30_000,
    inFlightWaitMs: 0,
    pollIntervalMs: 25,
  });
}

function resolveMode(env: ExternalEffectRuntimeEnv): ExternalEffectStoreMode {
  const configured = String(env.AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE ?? "").trim().toLowerCase();
  if (configured === "sqlite" || configured === "postgres") return configured;
  if (configured === "disabled") return "disabled";
  if (configured) {
    throw configurationError(
      "EXTERNAL_EFFECT_STORE_MODE_INVALID",
      "AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE must be sqlite or postgres.",
    );
  }
  return String(
    env.AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
      ?? "",
  ).trim()
    ? "postgres"
    : "sqlite";
}

function resolveInjectedMode(coordinator: IdempotencyCoordinator): ExternalEffectStoreMode {
  const mode = coordinator.getStats().storeMode;
  if (mode === "sqlite" || mode === "postgres") return mode;
  throw configurationError(
    "EXTERNAL_EFFECT_COORDINATOR_NOT_DURABLE",
    "An injected external-effect coordinator must use SQLite or PostgreSQL.",
  );
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
      "EXTERNAL_EFFECT_CONFIGURATION_INVALID",
      `${name} must be an integer between ${minimum} and ${maximum}.`,
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
    "EXTERNAL_EFFECT_CONFIGURATION_INVALID",
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
      && effectivePostgresDatabase(a) === effectivePostgresDatabase(b);
  } catch {
    return false;
  }
}

function effectivePostgresDatabase(url: URL) {
  const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  // PostgreSQL defaults the database name to the connection user when the URL
  // omits a path. Comparing only "/" would incorrectly accept two users whose
  // connections actually land in different databases.
  return pathname || decodeURIComponent(url.username);
}

function configurationError(code: string, message: string) {
  return Object.assign(new Error(message), { code, category: "configuration" as const });
}

export const externalEffectGateConfigInternals = Object.freeze({
  resolveMode,
  samePostgresTarget,
});
