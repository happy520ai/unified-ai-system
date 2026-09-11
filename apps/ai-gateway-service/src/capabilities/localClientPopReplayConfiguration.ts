import { createHmac } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalClientSqlitePopReplayGuard, type LocalClientSqlitePopReplayGuardOptions } from "./localClientSqlitePopReplayGuard.ts";
import { createLocalClientNativePopReplayRuntime, enrollLocalClientNativePopReplayBaseline, readNativePopReplayConfiguration } from "./localClientNativePopReplayRuntime.ts";
import { resolveLocalClientLoopbackAdapterConfiguration } from "./localClientLoopbackAdapterConfig.ts";
import { createCredentialResolver } from "../credentials/credentialResolver.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export function createConfiguredLocalClientPopReplayGuard(env: Record<string, unknown>, registryIntegrityKey: Uint8Array | null) {
  return withConfiguredReplayOptions(env, registryIntegrityKey, (options, native) => native
    ? createLocalClientNativePopReplayRuntime({ ...options, ...native }) : createLocalClientSqlitePopReplayGuard(options));
}

export function enrollConfiguredLocalClientNativePopReplayBaseline(env: Record<string, unknown>, registryIntegrityKey: Uint8Array | null) {
  const operation = withConfiguredReplayOptions(env, registryIntegrityKey, (options, native) => {
    if (!native) throw localClientPopReplayConfigError("NATIVE_MODE_REQUIRED", "Explicit native protection configuration is required for enrollment.");
    return enrollLocalClientNativePopReplayBaseline({ ...options, ...native });
  });
  if (!operation) throw localClientPopReplayConfigError("NATIVE_MODE_REQUIRED", "Native enrollment requires SQLite replay storage.");
  return operation;
}

/** Management reuses the existing hex decoding and both domain-separated HMACs.
 * The returned private key must be cleared by its caller. */
export function materializeConfiguredLocalClientPopRegistryKey(env: Record<string, string | undefined>): Buffer {
  const configuration = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!configuration.enabled || !configuration.registryIntegritySecretRef) throw localClientPopReplayConfigError("LOOPBACK_REQUIRED", "An explicitly configured loopback client is required.");
  const resolver = createCredentialResolver({ env });
  const materialized = resolver.materializeCredentialRef(configuration.registryIntegritySecretRef);
  const matched = materialized.materialized === true && typeof materialized.secret === "string"
    ? /^hex:([a-f0-9]{64,128})$/iu.exec(materialized.secret.trim()) : null;
  if (!matched || matched[1].length % 2) throw localClientPopReplayConfigError("INTEGRITY_KEY_REQUIRED", "The configured registry integrity material is unavailable.");
  const secret = Buffer.from(matched[1], "hex");
  try { return createHmac("sha256", secret).update("local-client-registry-integrity-key-v1").digest(); }
  finally { secret.fill(0); }
}

function withConfiguredReplayOptions<T>(env: Record<string, unknown>, registryIntegrityKey: Uint8Array | null,
  operation: (options: LocalClientSqlitePopReplayGuardOptions, native: ReturnType<typeof readNativePopReplayConfiguration>) => T): T | null {
  const mode = readLocalClientPopReplayStoreMode(env);
  if (mode === "memory") return null;
  if (!(registryIntegrityKey instanceof Uint8Array)) {
    throw localClientPopReplayConfigError(
      "INTEGRITY_KEY_REQUIRED",
      "SQLite PoP replay protection requires authenticated local-client adapter material.",
    );
  }
  const dedicatedKey = createHmac("sha256", registryIntegrityKey)
    .update("local-client-pop-replay-integrity-key-v1")
    .digest();
  try {
    const maxEntries = readStrictLocalClientPopReplayInteger(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES,
      10_000,
      1,
      1_000_000,
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES",
    );
    const configuredPerScope = String(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE ?? "",
    ).trim();
    const options: LocalClientSqlitePopReplayGuardOptions = {
      sqlitePath: resolveLocalClientPopReplayPath(
        env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
      ),
      hostId: requireLocalClientPopReplayHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID),
      integrityKey: dedicatedKey,
      namespace: readLocalClientPopReplayNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE,
      ),
      maxEntries,
      ...(configuredPerScope
        ? {
            maxEntriesPerScope: readStrictLocalClientPopReplayInteger(
              configuredPerScope,
              1,
              1,
              maxEntries,
              "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE",
            ),
          }
        : {}),
      busyTimeoutMs: readStrictLocalClientPopReplayInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS",
      ),
    };
    // Both constructors and the explicit async enrollment copy this key before
    // returning to this frame. The source buffer is always cleared here.
    const native = readNativePopReplayConfiguration(env);
    if (native) assertNativePopReplayPathIsolation(env, options.sqlitePath);
    return operation(options, native);
  } finally {
    dedicatedKey.fill(0);
  }
}

/** Also used before the standalone management command materializes its key. */
export function assertNativePopReplayPathIsolation(env: Record<string, unknown>, replayPath: string): void {
  const paths: string[] = [];
  for (const name of Object.keys(env)) {
    if (name === "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH"
      || (!/^AI_GATEWAY_.*_SQLITE_PATH$/u.test(name) && name !== "AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH")) continue;
    const value = env[name];
    if (typeof value === "string" && value.trim()) paths.push(resolve(repoRoot, value));
  }
  for (const [modeName, pathName, fallback] of [
    ["AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE", "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH", ".data/local-clients/route-plans.sqlite"],
    ["AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE", "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH", ".data/local-clients/verification-authority-epoch.sqlite"],
  ]) {
    if (String(env[modeName] ?? "memory").trim().toLowerCase() === "sqlite" && !String(env[pathName] ?? "").trim()) paths.push(resolve(repoRoot, fallback));
  }
  if (paths.some(path => path.toLowerCase() === resolve(replayPath).toLowerCase())) {
    throw localClientPopReplayConfigError("SQLITE_PATH_CONFLICT", "Native PoP replay storage must be separate from every configured state store.");
  }
}

export function readLocalClientPopReplayStoreMode(env: Record<string, unknown>) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE ?? "memory",
  ).trim().toLowerCase();
  if (mode !== "memory" && mode !== "sqlite") {
    throw localClientPopReplayConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE must be memory or sqlite.",
    );
  }
  if (readNativePopReplayConfiguration(env) && mode !== "sqlite") {
    throw localClientPopReplayConfigError("CONFIG_INVALID", "Native PoP protection requires SQLite replay storage.");
  }
  return mode;
}

export function resolveLocalClientPopReplayPath(value: unknown) {
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
    throw localClientPopReplayConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite PoP replay protection requires an explicit bounded local database path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientPopReplayConfigError(
      "SQLITE_PATH_INVALID",
      "The PoP replay SQLite path must remain on this host.",
    );
  }
  return absolute;
}

export function requireLocalClientPopReplayHostId(value: unknown) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientPopReplayConfigError(
      "HOST_ID_REQUIRED",
      "SQLite PoP replay protection requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  return hostId;
}

export function readLocalClientPopReplayNamespace(value: unknown) {
  const namespace = String(value ?? "local-client-pop-replay").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientPopReplayConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

export function readStrictLocalClientPopReplayInteger(value: unknown, fallback: number, minimum: number, maximum: number, name: string) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientPopReplayConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientPopReplayConfigError("CONFIG_INVALID", `${name} must be a bounded integer.`);
  }
  return parsed;
}

export function localClientPopReplayConfigError(reason: string, message: string) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_POP_REPLAY_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}
