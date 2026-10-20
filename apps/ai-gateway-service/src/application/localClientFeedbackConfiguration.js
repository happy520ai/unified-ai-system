// Extracted verbatim from the assembly root (createGatewayApplication.js) so
// the local client feedback dedup/outbox configuration cluster lives beside
// its sibling application modules. Pure mechanical move; behaviour unchanged.
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalClientSqliteFeedbackDedupStore } from "../capabilities/localClientSqliteFeedbackDedupStore.ts";
import { LocalClientSqliteExecutionFeedbackOutbox } from "../capabilities/localClientSqliteExecutionFeedbackOutbox.ts";
import { createLocalClientExecutionFeedbackDispatcher } from "../capabilities/localClientExecutionFeedbackDispatcher.ts";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export function createConfiguredLocalClientFeedbackDedupStore(env, registryIntegrityKey) {
  const mode = readLocalClientFeedbackDedupStoreMode(env);
  if (mode === "disabled") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientFeedbackDedupConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "The feedback dedup store requires a dedicated key derived from authenticated local-client adapter material.",
    );
  }
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-feedback-dedup-key-v1")
    .digest();
  try {
    return createLocalClientSqliteFeedbackDedupStore({
      sqlitePath: resolveLocalClientFeedbackDedupPath(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
      ),
      hostId: requireLocalClientFeedbackDedupHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID),
      integrityKey: dedicatedKey,
      namespace: readLocalClientFeedbackDedupNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE,
      ),
      ttlMs: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS,
        7 * 24 * 60 * 60_000,
        10,
        90 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS",
      ),
      leaseTtlMs: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS,
        30_000,
        10,
        60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS",
      ),
      maxEvents: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS,
        50_000,
        1,
        1_000_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS",
      ),
      busyTimeoutMs: readStrictLocalClientFeedbackDedupInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

export function readLocalClientFeedbackDedupStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientFeedbackDedupConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

export function resolveLocalClientFeedbackDedupPath(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientFeedbackDedupConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite feedback dedup requires an explicit bounded local database path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientFeedbackDedupConfigError(
      "SQLITE_PATH_INVALID",
      "The feedback dedup SQLite path must remain on this host.",
    );
  }
  return absolute;
}

export function requireLocalClientFeedbackDedupHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientFeedbackDedupConfigError(
      "HOST_ID_REQUIRED",
      "SQLite feedback dedup requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID as a stable bounded identifier.",
    );
  }
  return hostId;
}

export function readLocalClientFeedbackDedupNamespace(value) {
  const namespace = String(value ?? "local-client-feedback-dedup").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientFeedbackDedupConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

export function readStrictLocalClientFeedbackDedupInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientFeedbackDedupConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientFeedbackDedupConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

export function localClientFeedbackDedupConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_FEEDBACK_DEDUP_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

export function createConfiguredLocalClientExecutionFeedbackOutbox(env, registryIntegrityKey) {
  const mode = readLocalClientExecutionFeedbackOutboxStoreMode(env);
  if (mode === "disabled") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "The execution feedback outbox requires authenticated local-client adapter material.",
    );
  }
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-execution-feedback-outbox-key-v1")
    .digest();
  try {
    return new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath: resolveLocalClientExecutionFeedbackOutboxPath(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
      ),
      hostId: requireLocalClientExecutionFeedbackOutboxHostId(
        env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID,
      ),
      integrityKey: dedicatedKey,
      namespace: readLocalClientExecutionFeedbackOutboxNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE,
      ),
      deliveredTtlMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS,
        7 * 24 * 60 * 60_000,
        10,
        90 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS",
      ),
      leaseTtlMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS,
        30_000,
        10,
        60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS",
      ),
      maxEvents: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS,
        50_000,
        1,
        1_000_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS",
      ),
      maxBatchSize: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE,
        100,
        1,
        1_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE",
      ),
      busyTimeoutMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

export function createConfiguredLocalClientExecutionFeedbackDispatcher(env, outbox, aggregateSink) {
  if (!outbox) return null;
  if (!aggregateSink) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "AGGREGATE_REQUIRED",
      "The execution feedback outbox requires the exactly-once feedback aggregate.",
    );
  }
  return createLocalClientExecutionFeedbackDispatcher({
    outbox,
    aggregateSink,
    intervalMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS,
      1_000,
      10,
      60 * 60_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS",
    ),
    deliveryTimeoutMs: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS,
      5_000,
      10,
      60_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS",
    ),
    batchSize: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE,
      4,
      1,
      1_000,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE",
    ),
    maxBatchesPerRun: readStrictLocalClientExecutionFeedbackOutboxInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES,
      4,
      1,
      100,
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES",
    ),
  });
}

export function readLocalClientExecutionFeedbackOutboxStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientExecutionFeedbackOutboxConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

export function resolveLocalClientExecutionFeedbackOutboxPath(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path === ":memory:"
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "SQLITE_PATH_REQUIRED",
      "The execution feedback outbox requires an explicit bounded local SQLite path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "SQLITE_PATH_INVALID",
      "The execution feedback outbox SQLite path must remain on this host.",
    );
  }
  return absolute;
}

export function requireLocalClientExecutionFeedbackOutboxHostId(value) {
  const hostId = String(value ?? "").trim();
  if (hostId.length < 8 || hostId.length > 256 || /[\u0000-\u001f\u007f]/u.test(hostId)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "HOST_ID_REQUIRED",
      "The execution feedback outbox requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  return hostId;
}

export function readLocalClientExecutionFeedbackOutboxNamespace(value) {
  const namespace = String(value ?? "local-client-execution-feedback-outbox").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE must be portable.",
    );
  }
  return namespace;
}

export function readStrictLocalClientExecutionFeedbackOutboxInteger(
  value,
  fallback,
  minimum,
  maximum,
  name,
) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  return parsed;
}

export function localClientExecutionFeedbackOutboxConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

export function readStrictLocalClientExecutionFeedbackOutboxBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientExecutionFeedbackOutboxConfigError(
    "CONFIG_INVALID",
    `${name} must be true or false when the execution feedback outbox is configured.`,
  );
}
