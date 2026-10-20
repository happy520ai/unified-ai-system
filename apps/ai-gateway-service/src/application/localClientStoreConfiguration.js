// Extracted verbatim from the assembly root (createGatewayApplication.js) so
// the local client authority epoch/route plan/execution claim store
// configuration cluster lives beside its sibling application modules. Pure
// mechanical move; behaviour unchanged.
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalClientRoutePlanStore } from "../capabilities/localClientRoutePlanStore.ts";
import { createLocalClientSqliteRoutePlanStore } from "../capabilities/localClientSqliteRoutePlanStore.ts";
import { createLocalClientSqliteExecutionClaimStore } from "../capabilities/localClientSqliteExecutionClaimStore.ts";
import { createLocalClientSqliteVerificationAuthorityEpochStore } from "../capabilities/localClientSqliteVerificationAuthorityEpochStore.ts";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export function createConfiguredLocalClientAuthorityEpochStore(env, registryIntegrityKey) {
  const mode = readLocalClientAuthorityEpochStoreMode(env);
  if (mode === "disabled") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientAuthorityEpochConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "The SQLite authority checkpoint requires a dedicated key derived from authenticated local-client adapter material.",
    );
  }
  const hostId = requireLocalClientAuthorityEpochHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-verification-authority-epoch-key-v1")
    .digest();
  try {
    return createLocalClientSqliteVerificationAuthorityEpochStore({
      sqlitePath: resolveLocalClientAuthorityEpochPath(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
      ),
      hostId,
      integrityKey: dedicatedKey,
      namespace: readLocalClientAuthorityEpochNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE,
      ),
      maxCheckpoints: readStrictLocalClientAuthorityEpochInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS,
        32,
        2,
        4_096,
        "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS",
      ),
      busyTimeoutMs: readStrictLocalClientAuthorityEpochInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

export function readLocalClientAuthorityEpochStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientAuthorityEpochConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

export function requireLocalClientAuthorityEpochHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientAuthorityEpochConfigError(
      "HOST_ID_REQUIRED",
      "The SQLite authority checkpoint requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID as a stable bounded non-secret identifier.",
    );
  }
  return hostId;
}

export function resolveLocalClientAuthorityEpochPath(value) {
  const path = String(
    value ?? resolve(repoRoot, ".data/local-clients/verification-authority-epoch.sqlite"),
  );
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientAuthorityEpochConfigError(
      "SQLITE_PATH_INVALID",
      "The authority checkpoint SQLite path must be a bounded local file path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientAuthorityEpochConfigError(
      "SQLITE_PATH_INVALID",
      "The authority checkpoint SQLite path must remain on this host.",
    );
  }
  return absolute;
}

export function readLocalClientAuthorityEpochNamespace(value) {
  const namespace = String(value ?? "local-client-verification-authority").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientAuthorityEpochConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

export function readStrictLocalClientAuthorityEpochInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientAuthorityEpochConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientAuthorityEpochConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

export function localClientAuthorityEpochConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_AUTHORITY_EPOCH_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

export function createConfiguredLocalClientRoutePlanStore(env) {
  const mode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim()
    .toLowerCase();
  if (mode === "memory") return createLocalClientRoutePlanStore();
  if (mode !== "sqlite") {
    throw Object.assign(new Error(
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE must be memory or sqlite.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE_INVALID",
      category: "configuration",
      statusCode: 503,
    });
  }
  const hostId = String(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID ?? "").trim();
  if (!hostId) {
    throw Object.assign(new Error(
      "SQLite local-client route plans require AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_HOST_ID_REQUIRED",
      category: "configuration",
      statusCode: 503,
    });
  }
  return createLocalClientSqliteRoutePlanStore({
    sqlitePath: String(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
    ),
    hostId,
    ttlMs: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS, 60_000, 1, 300_000,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS",
    ),
    maxEntries: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES, 1_024, 1, 10_000,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES",
    ),
    maxInputBytes: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES, 65_536, 2, 65_536,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES",
    ),
    busyTimeoutMs: readStrictBoundedInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS, 5_000, 100, 30_000,
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS",
    ),
  });
}

export function createConfiguredLocalClientExecutionClaimStore(env) {
  const mode = readLocalClientExecutionClaimStoreMode(env);
  if (mode === "disabled") return null;
  const hostId = requireLocalClientExecutionClaimHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const sqlitePath = resolveLocalClientExecutionClaimPath(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
  );
  return createLocalClientSqliteExecutionClaimStore({
    sqlitePath,
    hostId,
    namespace: readLocalClientExecutionClaimNamespace(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE,
    ),
    ttlMs: readStrictLocalClientExecutionClaimInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS,
      60_000,
      10,
      300_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS",
    ),
    maxClaims: readStrictLocalClientExecutionClaimInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS,
      1_024,
      1,
      100_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS",
    ),
    busyTimeoutMs: readStrictLocalClientExecutionClaimInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS,
      5_000,
      100,
      30_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS",
    ),
  });
}

export function readLocalClientExecutionClaimStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientExecutionClaimConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

export function requireLocalClientExecutionClaimHostId(value) {
  const hostId = String(value ?? "").trim();
  if (!hostId) {
    throw localClientExecutionClaimConfigError(
      "HOST_ID_REQUIRED",
      "SQLite local-client execution claims require AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientExecutionClaimConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_HOST_ID must be a stable bounded non-secret identifier.",
    );
  }
  return hostId;
}

export function resolveLocalClientExecutionClaimPath(value) {
  const path = String(value ?? "");
  if (!path.trim()) {
    throw localClientExecutionClaimConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite local-client execution claims require an explicit database path.",
    );
  }
  if (
    path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientExecutionClaimConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client execution claim SQLite path must be a bounded local file path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientExecutionClaimConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client execution claim SQLite path must remain on this host.",
    );
  }
  return absolute;
}

export function readLocalClientExecutionClaimNamespace(value) {
  const namespace = String(value ?? "local-client-execution").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientExecutionClaimConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

export function readStrictLocalClientExecutionClaimInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientExecutionClaimConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientExecutionClaimConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

export function localClientExecutionClaimConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_EXECUTION_CLAIM_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

export function readStrictBoundedInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) throw localClientRoutePlanConfigError(name);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientRoutePlanConfigError(name);
  }
  return parsed;
}

function localClientRoutePlanConfigError(name) {
  return Object.assign(new Error(`${name} must be a bounded integer.`), {
    code: "LOCAL_CLIENT_ROUTE_PLAN_CONFIG_INVALID",
    category: "configuration",
    statusCode: 503,
  });
}
