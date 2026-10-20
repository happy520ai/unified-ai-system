// Extracted verbatim from the assembly root (createGatewayApplication.js) so
// the local client validators cluster (receipt journal, onboarding receipt
// authority, POP registry, and every validateLocalClient* validator) lives
// beside its sibling application modules. Pure mechanical move; behaviour
// unchanged.
import { lstatSync } from "node:fs";
import { isAbsolute, join, parse, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createCredentialResolver } from "../credentials/credentialResolver.js";
import {
  createLocalClientSqliteExecutionReceiptJournal,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
} from "../capabilities/localClientExecutionReceiptReconciliation.ts";
import { createLocalClientExecutionReceiptJournalRegistry } from "../capabilities/localClientExecutionReceiptJournalRegistry.ts";
import { createLocalClientSqliteOnboardingReceiptAuthorityStore } from "../capabilities/localClientSqliteOnboardingReceiptAuthorityStore.ts";
import { createLocalClientLoopbackAdapter, createLocalClientLoopbackVerificationProbe } from "../capabilities/localClientLoopbackAdapter.ts";
import { resolveLocalClientLoopbackAdapterConfiguration } from "../capabilities/localClientLoopbackAdapterConfig.ts";
import {
  createConfiguredLocalClientPopReplayGuard,
  localClientPopReplayConfigError,
  readLocalClientPopReplayNamespace,
  readLocalClientPopReplayStoreMode,
  readStrictLocalClientPopReplayInteger,
  requireLocalClientPopReplayHostId,
  resolveLocalClientPopReplayPath,
} from "../capabilities/localClientPopReplayConfiguration.ts";
import { createManagedLocalClientPopIdentityAuthority, deriveManagedLocalClientPopKey } from "../capabilities/localClientPopIdentityAuthority.ts";
import {
  createNonOwningNativePopReplayGuardPort,
  isLocalClientNativePopReplayRuntime,
  prepareLocalClientNativePopReplayRuntime,
} from "../capabilities/localClientNativePopReplayRuntime.ts";
import {
  localClientAuthorityEpochConfigError,
  localClientExecutionClaimConfigError,
  readLocalClientAuthorityEpochNamespace,
  readLocalClientAuthorityEpochStoreMode,
  readLocalClientExecutionClaimNamespace,
  readLocalClientExecutionClaimStoreMode,
  readStrictBoundedInteger,
  readStrictLocalClientAuthorityEpochInteger,
  readStrictLocalClientExecutionClaimInteger,
  requireLocalClientAuthorityEpochHostId,
  requireLocalClientExecutionClaimHostId,
  resolveLocalClientAuthorityEpochPath,
  resolveLocalClientExecutionClaimPath,
} from "./localClientStoreConfiguration.js";
import {
  localClientExecutionFeedbackOutboxConfigError,
  localClientFeedbackDedupConfigError,
  readLocalClientExecutionFeedbackOutboxNamespace,
  readLocalClientExecutionFeedbackOutboxStoreMode,
  readLocalClientFeedbackDedupNamespace,
  readLocalClientFeedbackDedupStoreMode,
  readStrictLocalClientExecutionFeedbackOutboxBoolean,
  readStrictLocalClientExecutionFeedbackOutboxInteger,
  readStrictLocalClientFeedbackDedupInteger,
  requireLocalClientExecutionFeedbackOutboxHostId,
  requireLocalClientFeedbackDedupHostId,
  resolveLocalClientExecutionFeedbackOutboxPath,
  resolveLocalClientFeedbackDedupPath,
} from "./localClientFeedbackConfiguration.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

function createConfiguredLocalClientReceiptJournal({
  env,
  entry,
  sharedSecret,
  registryIntegrityKey,
}) {
  const directory = resolveLocalClientReceiptReconciliationDirectory(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR,
  );
  const bindingDigest = createHmac("sha256", registryIntegrityKey)
    .update("local-client-receipt-journal-file-v1\0", "utf8")
    .update(entry.tenantId, "utf8")
    .update("\0", "utf8")
    .update(entry.clientId, "utf8")
    .digest("hex");
  const keyContext = `${entry.tenantId}\0${entry.clientId}`;
  const deriveSharedProtocolKey = (domain) => createHmac("sha256", sharedSecret)
    .update(`${domain}\0`, "utf8")
    .update(keyContext, "utf8")
    .digest();
  const deriveGatewayAuthorityKey = (domain) => createHmac("sha256", registryIntegrityKey)
    .update(`${domain}\0`, "utf8")
    .update(keyContext, "utf8")
    .digest();
  // Only the wire-protocol key is shared with the managed client. Gateway
  // journal integrity and encrypted recovery context remain under the
  // gateway-only registry authority so a client cannot forge or decrypt the
  // gateway's restart state even when both processes run as the same user.
  const integrityKey = deriveGatewayAuthorityKey(
    "local-client-gateway-receipt-journal-integrity-v2",
  );
  const protocolKey = deriveSharedProtocolKey(
    LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
  );
  const recoveryEncryptionKey = deriveGatewayAuthorityKey(
    "local-client-gateway-receipt-recovery-encryption-v2",
  );
  try {
    return createLocalClientSqliteExecutionReceiptJournal({
      sqlitePath: join(directory, `${bindingDigest}.sqlite`),
      role: "gateway",
      hostId: requireLocalClientReceiptReconciliationHostId(
        env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID,
      ),
      integrityKey,
      protocolKey,
      recoveryEncryptionKey,
      namespace: readLocalClientReceiptReconciliationNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE,
      ),
      maxEntries: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES,
        2_000,
        1,
        100_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES",
      ),
      retentionMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS,
        7 * 24 * 60 * 60_000,
        1_000,
        365 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS",
      ),
      intentTtlMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS,
        60_000,
        1_000,
        10 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS",
      ),
      queryTtlMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS,
        30_000,
        1_000,
        60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS",
      ),
      allowedClockSkewMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS,
        5_000,
        0,
        60_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS",
      ),
      busyTimeoutMs: readStrictLocalClientReceiptReconciliationInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    integrityKey.fill(0);
    protocolKey.fill(0);
    recoveryEncryptionKey.fill(0);
  }
}

function readLocalClientReceiptReconciliationStoreMode(env) {
  const mode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE ?? "disabled",
  ).trim().toLowerCase();
  if (mode !== "disabled" && mode !== "sqlite") {
    throw localClientReceiptReconciliationConfigError(
      "STORE_MODE_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE must be disabled or sqlite.",
    );
  }
  return mode;
}

function resolveLocalClientReceiptReconciliationDirectory(value) {
  const path = String(value ?? "");
  if (
    !path.trim()
    || path !== path.trim()
    || path.length > 4_096
    || path.startsWith("\\\\")
    || path.startsWith("//")
    || /[\u0000-\u001f\u007f]/u.test(path)
  ) throw localClientReceiptReconciliationConfigError(
    "DIRECTORY_REQUIRED",
    "Receipt reconciliation requires an explicit bounded local directory.",
  );
  const absolute = resolve(repoRoot, path);
  const filesystemRoot = resolve(parse(absolute).root);
  if (
    normalizeLocalClientReceiptPath(absolute) === normalizeLocalClientReceiptPath(repoRoot)
    || normalizeLocalClientReceiptPath(absolute) === normalizeLocalClientReceiptPath(filesystemRoot)
    || absolute.startsWith("\\\\")
    || absolute.startsWith("//")
  ) {
    throw localClientReceiptReconciliationConfigError(
      "DIRECTORY_INVALID",
      "The receipt reconciliation directory must be a scoped local subdirectory.",
    );
  }
  try {
    const info = lstatSync(absolute, { throwIfNoEntry: false });
    if (info && (!info.isDirectory() || info.isSymbolicLink())) {
      throw localClientReceiptReconciliationConfigError(
        "DIRECTORY_INVALID",
        "The receipt reconciliation directory cannot be a file or reparse link.",
      );
    }
  } catch (error) {
    if (error?.code?.startsWith?.("LOCAL_CLIENT_RECEIPT_RECONCILIATION_")) throw error;
    if (error?.code !== "ENOENT") {
      throw localClientReceiptReconciliationConfigError(
        "DIRECTORY_INVALID",
        "The receipt reconciliation directory could not be verified.",
      );
    }
  }
  return absolute;
}

function normalizeLocalClientReceiptPath(value) {
  const absolute = resolve(value);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function localClientReceiptPathsConflict(left, right) {
  const leftPath = normalizeLocalClientReceiptPath(left);
  const rightPath = normalizeLocalClientReceiptPath(right);
  return leftPath === rightPath
    || leftPath.startsWith(`${rightPath}${sep}`)
    || rightPath.startsWith(`${leftPath}${sep}`);
}

function requireLocalClientReceiptReconciliationHostId(value) {
  const hostId = String(value ?? "").trim();
  if (hostId.length < 8 || hostId.length > 256 || /[\u0000-\u001f\u007f]/u.test(hostId)) {
    throw localClientReceiptReconciliationConfigError(
      "HOST_ID_REQUIRED",
      "Receipt reconciliation requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID.",
    );
  }
  return hostId;
}

function readLocalClientReceiptReconciliationNamespace(value) {
  const namespace = String(value ?? "local-client-execution-receipts").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientReceiptReconciliationConfigError(
      "CONFIG_INVALID",
      "Receipt reconciliation namespace must be a portable identifier.",
    );
  }
  return namespace;
}

export function readStrictLocalClientReceiptReconciliationInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientReceiptReconciliationConfigError("CONFIG_INVALID", `${name} must be bounded.`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientReceiptReconciliationConfigError("CONFIG_INVALID", `${name} must be bounded.`);
  }
  return parsed;
}

function localClientReceiptReconciliationConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_RECEIPT_RECONCILIATION_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

export function projectLocalClientReceiptJournalReadinessStatus(status, fixtureCapability) {
  if (!fixtureCapability || status === null) return status;
  return Object.freeze({
    ...status,
    // Synthetic values exercise downstream HTTP orchestration only. The
    // application's public journal status remains false for both claims, and
    // this projection is reachable only through the private Vitest capability,
    // never through runtime environment or a public request.
    snapshotRollbackProtected: true,
    clientAtomicEffectReceiptVerified: true,
  });
}

export function hasConfiguredMcpUpstreams(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export function readBoundedNumber(value, fallback, minimum, maximum) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function createConfiguredLocalClientOnboardingReceiptAuthorityStore(env, enabled) {
  if (!enabled) return null;
  const rootKey = materializeLocalClientOnboardingRootKey(env);
  const dedicatedKey = createHmac("sha256", rootKey)
    .update("local-client-onboarding-receipt-authority-key-v1")
    .digest();
  rootKey.fill(0);
  try {
    return createLocalClientSqliteOnboardingReceiptAuthorityStore({
      sqlitePath: resolveLocalClientOnboardingReceiptAuthorityPath(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
      ),
      hostId: requireLocalClientOnboardingHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID),
      integrityKey: dedicatedKey,
      namespace: readLocalClientOnboardingReceiptAuthorityNamespace(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE,
      ),
      ttlMs: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS,
        30 * 24 * 60 * 60_000,
        10,
        365 * 24 * 60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS",
      ),
      leaseTtlMs: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS,
        10 * 60_000,
        10 * 60_000,
        60 * 60_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS",
      ),
      maxRows: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS,
        10_000,
        1,
        1_000_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS",
      ),
      busyTimeoutMs: readStrictLocalClientOnboardingInteger(
        env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS,
        5_000,
        100,
        30_000,
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS",
      ),
    });
  } finally {
    dedicatedKey.fill(0);
  }
}

export function registerConfiguredLocalClientAdapters(registry, env) {
  const configuration = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!configuration.enabled) return Object.freeze({
    probes: Object.freeze([]),
    registryIntegrityKey: null,
    ownershipBindings: Object.freeze([]),
    popAuthorityRegistry: null,
    receiptJournalRegistry: null,
    maxVerificationTtlMs: 5 * 60_000,
    status: configuration.status,
  });
  const credentialResolver = createCredentialResolver({ env });
  const registrySecret = materializeLocalClientLoopbackSecret(
    credentialResolver,
    configuration.registryIntegritySecretRef,
  );
  const registryIntegrityKey = createHmac("sha256", registrySecret)
    .update("local-client-registry-integrity-key-v1")
    .digest();
  let popReplayGuard = null;
  const probes = [];
  const popAuthorityBindings = [];
  const receiptJournalBindings = [];
  try {
    popReplayGuard = createConfiguredLocalClientPopReplayGuard(
      env,
      registryIntegrityKey,
    );
    const popReplayGuardPort = popReplayGuard
      ? createNonOwningLocalClientPopReplayGuardPort(popReplayGuard)
      : null;
    for (const entry of configuration.entries) {
      const secret = materializeLocalClientLoopbackSecret(credentialResolver, entry.secretRef);
      try {
        assertLocalClientGatewaySecretSeparated(registrySecret, secret);
        const sharedOptions = {
          adapterId: entry.adapterId,
          endpoint: entry.endpoint,
          expectedClientId: entry.clientId,
          expectedManifestSha256: entry.manifestSha256,
          sharedSecret: secret,
          timeoutMs: entry.timeoutMs,
          challengeTtlMs: entry.challengeTtlMs,
          maxResponseBytes: entry.maxResponseBytes,
        };
        registry.register(createLocalClientLoopbackAdapter(sharedOptions));
        probes.push(createLocalClientLoopbackVerificationProbe({
          ...sharedOptions,
          verificationTtlMs: entry.verificationTtlMs,
        }));
        const derivedPopKey = deriveManagedLocalClientPopKey({
          sharedSecret: secret,
          tenantId: entry.tenantId,
          clientId: entry.clientId,
        });
        popAuthorityBindings.push(Object.freeze({
          tenantId: entry.tenantId,
          clientId: entry.clientId,
          authority: createManagedLocalClientPopIdentityAuthority({
            key: derivedPopKey.key,
            keyId: derivedPopKey.keyId,
            ...(popReplayGuardPort ? { replayGuard: popReplayGuardPort } : {}),
          }),
        }));
        if (readLocalClientReceiptReconciliationStoreMode(env) === "sqlite") {
          receiptJournalBindings.push(Object.freeze({
            tenantId: entry.tenantId,
            clientId: entry.clientId,
            journal: createConfiguredLocalClientReceiptJournal({
              env,
              entry,
              sharedSecret: secret,
              registryIntegrityKey,
            }),
          }));
        }
      } finally {
        secret.fill(0);
      }
    }
    const popAuthorityRegistry = createLocalClientPopAuthorityRegistry(
      popAuthorityBindings,
      popReplayGuard,
    );
    const receiptJournalRegistry = receiptJournalBindings.length > 0
      ? createLocalClientExecutionReceiptJournalRegistry(receiptJournalBindings)
      : null;
    return Object.freeze({
      probes: Object.freeze(probes),
      registryIntegrityKey,
      popAuthorityRegistry,
      receiptJournalRegistry,
      ownershipBindings: Object.freeze(configuration.entries.map((entry) => Object.freeze({
        tenantId: entry.tenantId,
        clientId: entry.clientId,
        adapterId: entry.adapterId,
      }))),
      maxVerificationTtlMs: Math.max(...configuration.entries.map((entry) => entry.verificationTtlMs)),
      status: configuration.status,
    });
  } catch (error) {
    registryIntegrityKey.fill(0);
    for (const binding of popAuthorityBindings) {
      void binding.authority.close().catch(() => undefined);
    }
    for (const binding of receiptJournalBindings) {
      void binding.journal.close().catch(() => undefined);
    }
    if (popReplayGuard?.close) void Promise.resolve().then(() => popReplayGuard.close()).catch(() => undefined);
    throw error;
  } finally {
    registrySecret.fill(0);
  }
}

function createNonOwningLocalClientPopReplayGuardPort(guard) {
  const nativePort = createNonOwningNativePopReplayGuardPort(guard);
  if (nativePort) return nativePort;
  return Object.freeze({
    get status() {
      return guard.status;
    },
    consumeOnce(input) {
      return guard.consumeOnce(input);
    },
  });
}

function createLocalClientPopAuthorityRegistry(rawBindings, ownedReplayGuard = null) {
  const bindings = new Map();
  for (const binding of rawBindings) {
    const key = `${binding.tenantId}\0${binding.clientId}`;
    if (bindings.has(key)) {
      for (const existing of bindings.values()) void existing.authority.close().catch(() => undefined);
      throw localClientAdapterConfigError("POP_BINDING_DUPLICATE");
    }
    bindings.set(key, binding);
  }
  const initialBindingCount = bindings.size;
  let closed = false;
  return Object.freeze({
    get status() {
      const authorityStatuses = [...bindings.values()].map((binding) => binding.authority.status);
      const replayStatuses = authorityStatuses.map((status) => status.replayGuard);
      const allReplay = (predicate) => replayStatuses.length > 0 && replayStatuses.every(predicate);
      const replayModes = [...new Set(replayStatuses.map((status) => status.mode))];
      const perScopeLimits = [...new Set(
        replayStatuses
          .map((status) => status.maxEntriesPerScope)
          .filter((value) => Number.isSafeInteger(value)),
      )];
      return Object.freeze({
        enabled: initialBindingCount > 0,
        available: !closed
          && authorityStatuses.length === initialBindingCount
          && authorityStatuses.every((status) => status.available === true),
        bindingCount: initialBindingCount,
        replayMode: replayModes.length === 1 ? replayModes[0] : replayModes.length === 0 ? "closed" : "mixed",
        durableReplayProtection: allReplay(
          (status) => status.available === true && status.durable === true,
        ),
        distributedReplayProtection: allReplay(
          (status) => status.available === true && status.distributed === true,
        ),
        authenticatedReplaySet: allReplay(
          (status) => status.authenticatedReplaySet === true,
        ),
        snapshotRollbackProtected: allReplay(
          (status) => status.snapshotRollbackProtected === true,
        ),
        defensiveEnabled: allReplay((status) => status.defensiveEnabled === true),
        capacityIsolatedByScope: allReplay(
          (status) => status.capacityIsolatedByScope === true,
        ),
        maxEntriesPerScope: perScopeLimits.length === 1 ? perScopeLimits[0] : null,
        perClientDerivedKeys: true,
        exactRawBodyBinding: true,
        bearerProofAloneGrantsAuthority: false,
      });
    },
    async verify({ expectedIdentity, request, proof }) {
      if (closed) throw localClientPopUnavailableError();
      const binding = bindings.get(`${expectedIdentity?.tenantId ?? ""}\0${expectedIdentity?.clientId ?? ""}`);
      if (!binding) throw localClientPopUnavailableError();
      return binding.authority.verify({ expectedIdentity, request, proof });
    },
    hasBinding(tenantId, clientId) {
      return !closed && bindings.has(`${tenantId ?? ""}\0${clientId ?? ""}`);
    },
    async prepareReplayProtection({ tenantId, clientId }) {
      if (closed || !bindings.has(`${tenantId ?? ""}\0${clientId ?? ""}`)) throw localClientPopUnavailableError();
      return isLocalClientNativePopReplayRuntime(ownedReplayGuard)
        ? prepareLocalClientNativePopReplayRuntime(ownedReplayGuard) : true;
    },
    get nativeReplayProtection() {
      if (!isLocalClientNativePopReplayRuntime(ownedReplayGuard)) return null;
      const status = ownedReplayGuard.status;
      return Object.freeze({ ready: !closed && status.available === true && status.snapshotRollbackProtected === true });
    },
    async close() {
      if (closed) return;
      closed = true;
      const results = await Promise.allSettled([
        ...[...bindings.values()].map((binding) => binding.authority.close()),
        ...(ownedReplayGuard?.close ? [Promise.resolve().then(() => ownedReplayGuard.close())] : []),
      ]);
      bindings.clear();
      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      if (failures.length > 0) {
        throw new AggregateError(failures, "The local-client PoP authority registry failed to close.");
      }
    },
  });
}

function localClientPopUnavailableError() {
  return Object.assign(new Error("A configured managed local-client proof authority is required."), {
    code: "LOCAL_CLIENT_POP_AUTHORITY_UNAVAILABLE",
    category: "auth",
    statusCode: 401,
    retryable: false,
  });
}

export function localClientProtocolPrincipalBindingError() {
  return Object.assign(new Error(
    "Every managed protocol principal must reference an exact configured loopback client.",
  ), {
    code: "LOCAL_CLIENT_PROTOCOL_PRINCIPAL_BINDING_INVALID",
    category: "configuration",
    statusCode: 503,
    retryable: false,
  });
}

function materializeLocalClientLoopbackSecret(credentialResolver, secretRef) {
  const materialized = credentialResolver.materializeCredentialRef(secretRef);
  if (materialized.materialized !== true || typeof materialized.secret !== "string") {
    throw localClientAdapterConfigError("SECRET_UNAVAILABLE");
  }
  return decodeLocalClientLoopbackSecret(materialized.secret);
}

export function validateLocalClientStaticConfiguration(env) {
  const executionRequested = readStrictBoolean(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED,
    false,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED",
  );
  const routePlanMode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim()
    .toLowerCase();
  if (routePlanMode !== "memory" && routePlanMode !== "sqlite") {
    throw Object.assign(new Error(
      "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE must be memory or sqlite.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE_INVALID",
      category: "configuration",
      statusCode: 503,
    });
  }
  if (routePlanMode === "sqlite") {
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
  }
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS, 60_000, 1, 300_000,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS",
  );
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES, 1_024, 1, 10_000,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_ENTRIES",
  );
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES, 65_536, 2, 65_536,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_MAX_INPUT_BYTES",
  );
  readStrictBoundedInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS, 5_000, 100, 30_000,
    "AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_BUSY_TIMEOUT_MS",
  );
  validateLocalClientSynchronousExecutionBackends(env, executionRequested, routePlanMode);
  validateLocalClientExecutionClaimConfiguration(env, executionRequested, routePlanMode);
  validateLocalClientIdempotencyConfiguration(env, executionRequested, routePlanMode);
  validateLocalClientAuthorityEpochConfiguration(env, executionRequested, routePlanMode);
  const loopbackConfiguration = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!loopbackConfiguration.enabled) return;
  const credentialResolver = createCredentialResolver({ env });
  const registrySecret = materializeLocalClientLoopbackSecret(
    credentialResolver,
    loopbackConfiguration.registryIntegritySecretRef,
  );
  try {
    for (const entry of loopbackConfiguration.entries) {
      const clientSecret = materializeLocalClientLoopbackSecret(
        credentialResolver,
        entry.secretRef,
      );
      try {
        assertLocalClientGatewaySecretSeparated(registrySecret, clientSecret);
      } finally {
        clientSecret.fill(0);
      }
    }
  } finally {
    registrySecret.fill(0);
  }
}

function assertLocalClientGatewaySecretSeparated(registrySecret, clientSecret) {
  if (
    !(registrySecret instanceof Uint8Array)
    || !(clientSecret instanceof Uint8Array)
    || (
      registrySecret.byteLength === clientSecret.byteLength
      && timingSafeEqual(registrySecret, clientSecret)
    )
  ) {
    throw localClientAdapterConfigError("REGISTRY_SECRET_NOT_SEPARATE");
  }
}

export function validateLocalClientPopReplayConfiguration(env) {
  const mode = readLocalClientPopReplayStoreMode(env);
  const sqliteSpecificNames = [
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE",
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS",
  ];
  if (mode === "memory") {
    if (sqliteSpecificNames.some((name) => String(env[name] ?? "").trim())) {
      throw localClientPopReplayConfigError(
        "CONFIG_INVALID",
        "SQLite PoP replay settings require AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE=sqlite.",
      );
    }
    return;
  }
  if (!resolveLocalClientLoopbackAdapterConfiguration(env).enabled) {
    throw localClientPopReplayConfigError(
      "LOOPBACK_REQUIRED",
      "SQLite PoP replay protection requires an explicitly configured loopback client.",
    );
  }
  requireLocalClientPopReplayHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const replayPath = resolveLocalClientPopReplayPath(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
  );
  readLocalClientPopReplayNamespace(env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE);
  const maxEntries = readStrictLocalClientPopReplayInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES,
    10_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES",
  );
  const perScopeValue = String(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE ?? "",
  ).trim();
  if (perScopeValue) {
    const maxEntriesPerScope = readStrictLocalClientPopReplayInteger(
      perScopeValue,
      1,
      1,
      maxEntries,
      "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE",
    );
    if (maxEntries > 1 && maxEntriesPerScope >= maxEntries) {
      throw localClientPopReplayConfigError(
        "CONFIG_INVALID",
        "Per-scope PoP replay capacity must preserve global capacity for another client.",
      );
    }
  }
  readStrictLocalClientPopReplayInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS",
  );

  const comparedPaths = [];
  if (String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory").trim().toLowerCase() === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientExecutionFeedbackOutboxStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionFeedbackOutboxPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    ));
  }
  if (readLocalClientFeedbackDedupStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientFeedbackDedupPath(
      env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      comparedPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === replayPath.toLowerCase())) {
    throw localClientPopReplayConfigError(
      "SQLITE_PATH_CONFLICT",
      "PoP replay protection requires a path distinct from registry and every known state store.",
    );
  }
}

export function validateLocalClientFeedbackDedupConfiguration(env, executionRequested) {
  const mode = readLocalClientFeedbackDedupStoreMode(env);
  if (executionRequested && mode !== "sqlite") {
    throw localClientFeedbackDedupConfigError(
      "STORE_REQUIRED",
      "Local-client execution requires AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE=sqlite.",
    );
  }
  if (mode !== "sqlite") return;
  if (readStrictLocalClientFeedbackBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false)) {
    throw localClientFeedbackDedupConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "SQLite feedback dedup is single-host only and cannot be used in multi-instance mode.",
    );
  }
  requireLocalClientFeedbackDedupHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const feedbackPath = resolveLocalClientFeedbackDedupPath(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
  );
  readLocalClientFeedbackDedupNamespace(env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE);
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS,
    7 * 24 * 60 * 60_000,
    10,
    90 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS",
  );
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS,
    30_000,
    10,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS",
  );
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS,
    50_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS",
  );
  readStrictLocalClientFeedbackDedupInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS",
  );

  const comparedPaths = [];
  const routePlanMode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim().toLowerCase();
  if (routePlanMode === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientPopReplayStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientPopReplayPath(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
    ));
  }
  if (readLocalClientExecutionFeedbackOutboxStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionFeedbackOutboxPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      comparedPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === feedbackPath.toLowerCase())) {
    throw localClientFeedbackDedupConfigError(
      "SQLITE_PATH_CONFLICT",
      "Feedback dedup requires a path distinct from registry and every known SQLite store.",
    );
  }
}

export function validateLocalClientExecutionFeedbackOutboxConfiguration(env, executionRequested) {
  const mode = readLocalClientExecutionFeedbackOutboxStoreMode(env);
  const optionNames = [
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE",
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES",
  ];
  if (executionRequested && mode !== "sqlite") {
    throw localClientExecutionFeedbackOutboxConfigError(
      "STORE_REQUIRED",
      "Local-client execution requires a durable SQLite execution feedback outbox.",
    );
  }
  if (mode === "disabled") {
    if (optionNames.some((name) => String(env[name] ?? "").trim())) {
      throw localClientExecutionFeedbackOutboxConfigError(
        "CONFIG_INVALID",
        "Execution feedback outbox settings require STORE_MODE=sqlite.",
      );
    }
    return;
  }
  if (readLocalClientFeedbackDedupStoreMode(env) !== "sqlite") {
    throw localClientExecutionFeedbackOutboxConfigError(
      "AGGREGATE_REQUIRED",
      "The execution feedback outbox requires SQLite exactly-once feedback deduplication.",
    );
  }
  if (!resolveLocalClientLoopbackAdapterConfiguration(env).enabled) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "LOOPBACK_REQUIRED",
      "The execution feedback outbox requires an authenticated loopback client configuration.",
    );
  }
  if (readStrictLocalClientExecutionFeedbackOutboxBoolean(
    env.AI_GATEWAY_MULTI_INSTANCE,
    false,
    "AI_GATEWAY_MULTI_INSTANCE",
  )) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "The SQLite execution feedback outbox is single-host and cannot serve multi-instance mode.",
    );
  }
  requireLocalClientExecutionFeedbackOutboxHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const outboxPath = resolveLocalClientExecutionFeedbackOutboxPath(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
  );
  readLocalClientExecutionFeedbackOutboxNamespace(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE,
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS,
    7 * 24 * 60 * 60_000,
    10,
    90 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERED_TTL_MS",
  );
  const leaseTtlMs = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS,
    30_000,
    10,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS",
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS,
    50_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_EVENTS",
  );
  const maxBatchSize = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE,
    100,
    1,
    1_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_MAX_BATCH_SIZE",
  );
  const busyTimeoutMs = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_BUSY_TIMEOUT_MS",
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS,
    1_000,
    10,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS",
  );
  const deliveryTimeoutMs = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS,
    5_000,
    10,
    60_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS",
  );
  const dispatchBatchSize = readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE,
    4,
    1,
    1_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE",
  );
  readStrictLocalClientExecutionFeedbackOutboxInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES,
    4,
    1,
    100,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_MAX_BATCHES",
  );
  if (
    dispatchBatchSize > maxBatchSize
    || leaseTtlMs < (
      (dispatchBatchSize * deliveryTimeoutMs)
      + busyTimeoutMs
      + 1_000
    )
  ) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "DELIVERY_BUDGET_INVALID",
      "The outbox lease must exceed the bounded sequential delivery budget and batch limits.",
    );
  }

  const comparedPaths = [];
  if (String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory").trim().toLowerCase() === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientFeedbackDedupStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientFeedbackDedupPath(
      env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    ));
  }
  if (readLocalClientPopReplayStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientPopReplayPath(
      env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      comparedPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === outboxPath.toLowerCase())) {
    throw localClientExecutionFeedbackOutboxConfigError(
      "SQLITE_PATH_CONFLICT",
      "The execution feedback outbox requires a path distinct from every known state store.",
    );
  }
}

export function validateLocalClientReceiptReconciliationConfiguration(env, executionRequested) {
  const mode = readLocalClientReceiptReconciliationStoreMode(env);
  const optionNames = [
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE",
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS",
  ];
  if (executionRequested && mode !== "sqlite") {
    throw localClientReceiptReconciliationConfigError(
      "STORE_REQUIRED",
      "Governed local-client execution requires durable receipt reconciliation.",
    );
  }
  if (mode === "disabled") {
    if (optionNames.some((name) => String(env[name] ?? "").trim())) {
      throw localClientReceiptReconciliationConfigError(
        "CONFIG_INVALID",
        "Receipt reconciliation options require STORE_MODE=sqlite.",
      );
    }
    return;
  }
  const loopback = resolveLocalClientLoopbackAdapterConfiguration(env);
  if (!loopback.enabled) {
    throw localClientReceiptReconciliationConfigError(
      "LOOPBACK_REQUIRED",
      "Receipt reconciliation requires an authenticated loopback client.",
    );
  }
  if (readStrictLocalClientReceiptReconciliationBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false)) {
    throw localClientReceiptReconciliationConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "The SQLite receipt journal is single-host and cannot serve multi-instance execution.",
    );
  }
  requireLocalClientReceiptReconciliationHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const directory = resolveLocalClientReceiptReconciliationDirectory(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR,
  );
  readLocalClientReceiptReconciliationNamespace(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE,
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES,
    2_000,
    1,
    100_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_MAX_ENTRIES",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS,
    7 * 24 * 60 * 60_000,
    1_000,
    365 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_RETENTION_MS",
  );
  const intentTtlMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS,
    60_000,
    1_000,
    10 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS",
  );
  const clockSkewMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS,
    5_000,
    0,
    60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_SKEW_MS",
  );
  const queryTtlMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS,
    30_000,
    1_000,
    60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_BUSY_TIMEOUT_MS",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS,
    5_000,
    100,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_INTERVAL_MS",
  );
  readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE,
    32,
    1,
    1_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_BATCH_SIZE",
  );
  const recoveryGraceMs = readStrictLocalClientReceiptReconciliationInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS,
    120_000,
    0,
    24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS",
  );
  const maxAdapterTimeoutMs = Math.max(...loopback.entries.map((entry) => entry.timeoutMs));
  const minimumReconciliationWindowMs = maxAdapterTimeoutMs + clockSkewMs + 1_000;
  if (intentTtlMs < minimumReconciliationWindowMs) {
    throw localClientReceiptReconciliationConfigError(
      "INTENT_TTL_INVALID",
      "Receipt intent TTL must exceed adapter timeout plus clock skew and safety margin.",
    );
  }
  if (queryTtlMs < minimumReconciliationWindowMs) {
    throw localClientReceiptReconciliationConfigError(
      "QUERY_TTL_INVALID",
      "Receipt query TTL must cover adapter timeout plus clock skew and safety margin.",
    );
  }
  if (recoveryGraceMs < minimumReconciliationWindowMs) {
    throw localClientReceiptReconciliationConfigError(
      "RECOVERY_GRACE_INVALID",
      "Receipt recovery grace must cover adapter timeout plus clock skew and safety margin.",
    );
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
  ]) {
    if (
      typeof configuredPath === "string"
      && configuredPath.trim()
      && localClientReceiptPathsConflict(resolve(repoRoot, configuredPath), directory)
    ) {
      throw localClientReceiptReconciliationConfigError(
        "DIRECTORY_CONFLICT",
        "Receipt reconciliation requires a directory distinct from state files.",
      );
    }
  }
}

function readStrictLocalClientReceiptReconciliationBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientReceiptReconciliationConfigError(
    "CONFIG_INVALID",
    "AI_GATEWAY_MULTI_INSTANCE must be true or false for receipt reconciliation.",
  );
}

function readStrictLocalClientFeedbackBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientFeedbackDedupConfigError(
    "CONFIG_INVALID",
    "AI_GATEWAY_MULTI_INSTANCE must be true or false when feedback dedup is configured.",
  );
}

export function materializeLocalClientOnboardingRuntimeConfiguration(env, configuration) {
  if (!configuration.enabled) return configuration;
  const rootKey = materializeLocalClientOnboardingRootKey(env);
  try {
    const backupEncryptionKey = createHmac("sha256", rootKey)
      .update("local-client-onboarding-backup-encryption-key-v1")
      .digest();
    return Object.freeze({
      ...configuration,
      registryOptions: Object.freeze({
        ...configuration.registryOptions,
        backupEncryptionKey,
        committedRetentionMs: readStrictLocalClientOnboardingInteger(
          env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS,
          30 * 24 * 60 * 60_000,
          10,
          365 * 24 * 60 * 60_000,
          "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS",
        ),
      }),
    });
  } finally {
    rootKey.fill(0);
  }
}

function materializeLocalClientOnboardingRootKey(env) {
  const secretRef = String(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF ?? "",
  ).trim();
  if (!secretRef) {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_REQUIRED",
      "Governed onboarding requires AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF.",
    );
  }
  const credentialResolver = createCredentialResolver({ env });
  const materialized = credentialResolver.materializeCredentialRef(secretRef);
  if (materialized.materialized !== true || typeof materialized.secret !== "string") {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_UNAVAILABLE",
      "The governed onboarding root secret reference is unavailable.",
    );
  }
  const match = /^hex:([a-f0-9]{64,128})$/iu.exec(materialized.secret.trim());
  if (!match || match[1].length % 2 !== 0) {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_INVALID",
      "The governed onboarding root secret must be a 32-64 byte hex credential.",
    );
  }
  return Buffer.from(match[1], "hex");
}

function localClientOnboardingRootSecretFilePaths(env) {
  const secretRef = String(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF ?? "",
  ).trim();
  const match = /^file_key_path:(.+)$/u.exec(secretRef);
  if (!match) return [];
  const vaultRootRaw = String(env.CREDENTIAL_VAULT_DIR ?? "").trim();
  if (!vaultRootRaw) return [];
  const vaultRoot = resolve(vaultRootRaw);
  const candidate = resolve(vaultRoot, match[1]);
  if (candidate !== vaultRoot && !candidate.startsWith(`${vaultRoot}${sep}`)) {
    throw localClientOnboardingRuntimeConfigError(
      "ROOT_SECRET_INVALID",
      "The governed onboarding root secret path escapes the credential vault.",
    );
  }
  return [candidate];
}

export function zeroLocalClientOnboardingBackupKey(configuration) {
  if (configuration.enabled) {
    configuration.registryOptions.backupEncryptionKey?.fill(0);
  }
}

export function validateLocalClientOnboardingGovernanceConfiguration(env, configuration) {
  if (!configuration.enabled) return;
  if (readStrictLocalClientOnboardingBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false)) {
    throw localClientOnboardingRuntimeConfigError(
      "MULTI_INSTANCE_UNSUPPORTED",
      "Governed onboarding currently supports one local gateway instance only.",
    );
  }
  requireLocalClientOnboardingHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const receiptAuthorityPath = resolveLocalClientOnboardingReceiptAuthorityPath(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH,
  );
  readLocalClientOnboardingReceiptAuthorityNamespace(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE,
  );
  const receiptTtlMs = readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS,
    30 * 24 * 60 * 60_000,
    15 * 60_000,
    365 * 24 * 60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS",
  );
  const receiptLeaseTtlMs = readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS,
    10 * 60_000,
    10 * 60_000,
    60 * 60_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS",
  );
  if (receiptTtlMs < receiptLeaseTtlMs + 5 * 60_000) {
    throw localClientOnboardingRuntimeConfigError(
      "RECEIPT_RETENTION_INVALID",
      "Onboarding receipt retention must exceed the rollback claim lease by at least five minutes.",
    );
  }
  readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS,
    10_000,
    1,
    1_000_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS",
  );
  readStrictLocalClientOnboardingInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS",
  );
  const configuredControlMode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE
      ?? "",
  ).trim().toLowerCase();
  const controlPostgresUrl = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL
      ?? "",
  ).trim();
  const controlMode = configuredControlMode || (controlPostgresUrl ? "postgres" : "local");
  if (controlMode !== "local") {
    throw localClientOnboardingRuntimeConfigError(
      "LOCAL_CONTROL_REQUIRED",
      "Governed onboarding currently requires local atomic approval and lifecycle control.",
    );
  }
  if (String(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE ?? "").trim().toLowerCase() !== "sqlite") {
    throw localClientOnboardingRuntimeConfigError(
      "IDEMPOTENCY_SQLITE_REQUIRED",
      "Governed onboarding requires AI_GATEWAY_IDEMPOTENCY_STORE_MODE=sqlite.",
    );
  }
  const idempotencyPath = resolveLocalClientIdempotencyPath(
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
  );
  const idempotencySecret = env.AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET;
  if (typeof idempotencySecret !== "string" || Buffer.byteLength(idempotencySecret) < 32) {
    throw localClientOnboardingRuntimeConfigError(
      "IDEMPOTENCY_SECRET_REQUIRED",
      "Governed onboarding requires a stable idempotency HMAC secret of at least 32 bytes.",
    );
  }
  if (String(env.AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE ?? "").trim().toLowerCase() !== "sqlite") {
    throw localClientOnboardingRuntimeConfigError(
      "EXTERNAL_EFFECT_SQLITE_REQUIRED",
      "Governed onboarding requires AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE=sqlite.",
    );
  }
  const externalEffectPath = resolveLocalClientGovernedMutationPath(
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
    "AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH",
  );
  const externalEffectSecret = String(env.AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET ?? "").trim();
  let externalEffectSecretPath = null;
  if (externalEffectSecret) {
    if (Buffer.byteLength(externalEffectSecret) < 32) {
      throw localClientOnboardingRuntimeConfigError(
        "EXTERNAL_EFFECT_SECRET_REQUIRED",
        "Governed onboarding requires a stable external-effect HMAC secret of at least 32 bytes.",
      );
    }
  } else {
    const secretPath = String(env.AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH ?? "").trim();
    if (!secretPath) {
      throw localClientOnboardingRuntimeConfigError(
        "EXTERNAL_EFFECT_SECRET_REQUIRED",
        "Governed onboarding requires a stable external-effect HMAC secret or explicit secret path.",
      );
    }
    externalEffectSecretPath = resolveLocalClientGovernedMutationPath(
      secretPath,
      "AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH",
    );
  }
  if (
    idempotencyPath.toLowerCase() === externalEffectPath.toLowerCase()
    || receiptAuthorityPath.toLowerCase() === idempotencyPath.toLowerCase()
    || receiptAuthorityPath.toLowerCase() === externalEffectPath.toLowerCase()
  ) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_CONFLICT",
      "Governed onboarding idempotency and external-effect state require distinct SQLite paths.",
    );
  }
  const peerPaths = [];
  const routePlanMode = String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE ?? "memory")
    .trim().toLowerCase();
  if (routePlanMode === "sqlite") {
    peerPaths.push(resolve(
      repoRoot,
      String(env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
        ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite")),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    peerPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (readLocalClientAuthorityEpochStoreMode(env) === "sqlite") {
    peerPaths.push(resolveLocalClientAuthorityEpochPath(
      env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
    ));
  }
  if (readLocalClientFeedbackDedupStoreMode(env) === "sqlite") {
    peerPaths.push(resolveLocalClientFeedbackDedupPath(
      env.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
    ));
  }
  for (const configuredPath of [
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
    env.AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH,
  ]) {
    if (typeof configuredPath === "string" && configuredPath.trim()) {
      peerPaths.push(resolve(repoRoot, configuredPath));
    }
  }
  if (peerPaths.some((peerPath) => (
    peerPath.toLowerCase() === idempotencyPath.toLowerCase()
    || peerPath.toLowerCase() === externalEffectPath.toLowerCase()
  ))) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_CONFLICT",
      "Governed onboarding stores require paths distinct from registry and every configured SQLite subsystem.",
    );
  }
  if (peerPaths.some((peerPath) => peerPath.toLowerCase() === receiptAuthorityPath.toLowerCase())) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_CONFLICT",
      "Onboarding receipt authority requires a path distinct from every configured SQLite subsystem.",
    );
  }
  const governancePaths = [
    idempotencyPath,
    externalEffectPath,
    receiptAuthorityPath,
    ...peerPaths,
    ...(externalEffectSecretPath === null ? [] : [externalEffectSecretPath]),
    ...localClientOnboardingRootSecretFilePaths(env),
  ];
  assertLocalClientOnboardingPathGraph(configuration, governancePaths);
  const onboardingRootKey = materializeLocalClientOnboardingRootKey(env);
  onboardingRootKey.fill(0);
  const allStorePaths = governancePaths.map((path) => path.toLowerCase());
  const profiles = configuration.registryOptions.version === 2
    ? configuration.registryOptions.profiles.map((entry) => entry.paths)
    : Object.values(configuration.registryOptions.profiles);
  for (const profile of profiles) {
    const targetPath = resolve(profile.targetPath).toLowerCase();
    const journalPath = resolve(profile.journalPath).toLowerCase();
    const backupDir = resolve(profile.backupDir).toLowerCase();
    if (allStorePaths.some((storePath) => (
      storePath === targetPath
      || storePath === journalPath
      || storePath === backupDir
      || storePath.startsWith(`${backupDir}${sep}`.toLowerCase())
    ))) {
      throw localClientOnboardingRuntimeConfigError(
        "SQLITE_PATH_CONFLICT",
        "Governance stores must not overlap any lazy onboarding target, journal, or backup location.",
      );
    }
  }
}

function assertLocalClientOnboardingPathGraph(configuration, governancePaths) {
  const exclusiveFiles = governancePaths.map((path, index) => (
    localClientOnboardingPathFact(path, `governance:${index}`)
  ));
  const backupDirectories = [];
  const profiles = configuration.registryOptions.version === 2
    ? configuration.registryOptions.profiles.map((entry) => [entry.profileId, entry.paths])
    : Object.entries(configuration.registryOptions.profiles);
  for (const [profileName, profile] of profiles) {
    exclusiveFiles.push(
      localClientOnboardingPathFact(profile.targetPath, `${profileName}:target`),
      localClientOnboardingPathFact(profile.journalPath, `${profileName}:journal`),
    );
    backupDirectories.push(
      localClientOnboardingPathFact(profile.backupDir, `${profileName}:backup`),
    );
  }
  const server = configuration.registryOptions.serverDefinition;
  exclusiveFiles.push(localClientOnboardingPathFact(server.command, "server:command"));
  for (const [index, argument] of server.args.entries()) {
    if (isAbsolute(argument)) {
      exclusiveFiles.push(localClientOnboardingPathFact(argument, `server:arg:${index}`));
    }
  }
  const cwd = server.cwd === undefined
    ? null
    : localClientOnboardingPathFact(server.cwd, "server:cwd");

  for (let leftIndex = 0; leftIndex < exclusiveFiles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < exclusiveFiles.length; rightIndex += 1) {
      if (sameLocalClientOnboardingPathFact(
        exclusiveFiles[leftIndex],
        exclusiveFiles[rightIndex],
      )) {
        throw localClientOnboardingRuntimeConfigError(
          "PATH_CONFLICT",
          "Governed onboarding paths for configuration, governance, and runtime entry files must be distinct.",
        );
      }
    }
  }
  for (const backup of backupDirectories) {
    for (const candidate of [...exclusiveFiles, ...(cwd === null ? [] : [cwd])]) {
      if (
        backup.canonicalPath === candidate.canonicalPath
        || localClientOnboardingPathContains(backup.canonicalPath, candidate.canonicalPath)
      ) {
        throw localClientOnboardingRuntimeConfigError(
          "PATH_CONFLICT",
          "No governance, target, or runtime entry path may overlap an onboarding backup directory.",
        );
      }
    }
  }
  if (cwd && exclusiveFiles.some((candidate) => sameLocalClientOnboardingPathFact(cwd, candidate))) {
    throw localClientOnboardingRuntimeConfigError(
      "PATH_CONFLICT",
      "The onboarding runtime working directory must not be a governed file path.",
    );
  }
}

function localClientOnboardingPathFact(rawPath, role) {
  const absolutePath = resolve(rawPath);
  if (absolutePath.startsWith("\\\\") || absolutePath.startsWith("//")) {
    throw localClientOnboardingRuntimeConfigError(
      "PATH_UNSAFE",
      "Governed onboarding paths must remain on this host.",
    );
  }
  const root = parse(absolutePath).root;
  const relativeParts = absolutePath.slice(root.length).split(/[\\/]+/u).filter(Boolean);
  let cursor = root;
  let finalStat = null;
  for (let index = 0; index < relativeParts.length; index += 1) {
    cursor = resolve(cursor, relativeParts[index]);
    try {
      const stat = lstatSync(cursor, { bigint: true });
      if (stat.isSymbolicLink()) {
        throw localClientOnboardingRuntimeConfigError(
          "PATH_UNSAFE",
          "Governed onboarding paths must not traverse a symlink or junction.",
        );
      }
      if (index === relativeParts.length - 1) finalStat = stat;
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
  return Object.freeze({
    role,
    canonicalPath: process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath,
    identity: finalStat === null
      ? null
      : Object.freeze({ device: finalStat.dev, inode: finalStat.ino }),
  });
}

function sameLocalClientOnboardingPathFact(left, right) {
  return left.canonicalPath === right.canonicalPath
    || (
      left.identity !== null
      && right.identity !== null
      && left.identity.inode !== 0n
      && left.identity.device === right.identity.device
      && left.identity.inode === right.identity.inode
    );
}

function localClientOnboardingPathContains(parentPath, candidatePath) {
  const prefix = parentPath.endsWith(sep) ? parentPath : `${parentPath}${sep}`;
  return candidatePath.startsWith(prefix);
}

function readStrictLocalClientOnboardingBoolean(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientOnboardingRuntimeConfigError(
    "CONFIG_INVALID",
    "AI_GATEWAY_MULTI_INSTANCE must be true or false when governed onboarding is enabled.",
  );
}

function readStrictLocalClientOnboardingInteger(value, fallback, minimum, maximum, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9][0-9]*)$/u.test(normalized)) {
    throw localClientOnboardingRuntimeConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw localClientOnboardingRuntimeConfigError(
      "CONFIG_INVALID",
      `${name} must be a bounded integer.`,
    );
  }
  return parsed;
}

function resolveLocalClientGovernedMutationPath(value, name) {
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
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_REQUIRED",
      `${name} must be an explicit bounded local file path.`,
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientOnboardingRuntimeConfigError(
      "SQLITE_PATH_INVALID",
      `${name} must remain on this host.`,
    );
  }
  return absolute;
}

function resolveLocalClientOnboardingReceiptAuthorityPath(value) {
  return resolveLocalClientGovernedMutationPath(
    value,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH",
  );
}

function requireLocalClientOnboardingHostId(value) {
  const hostId = String(value ?? "").trim();
  if (
    hostId.length < 8
    || hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(hostId)
  ) {
    throw localClientOnboardingRuntimeConfigError(
      "HOST_ID_REQUIRED",
      "Governed onboarding receipt authority requires AI_GATEWAY_LOCAL_CLIENT_HOST_ID as a stable bounded identifier.",
    );
  }
  return hostId;
}

function readLocalClientOnboardingReceiptAuthorityNamespace(value) {
  const namespace = String(value ?? "local-client-onboarding-receipt-authority").trim();
  if (!/^[a-z][a-z0-9._-]{0,127}$/u.test(namespace)) {
    throw localClientOnboardingRuntimeConfigError(
      "CONFIG_INVALID",
      "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE must be a portable identifier.",
    );
  }
  return namespace;
}

function localClientOnboardingRuntimeConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_ONBOARDING_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function validateLocalClientAuthorityEpochConfiguration(env, executionRequested, routePlanMode) {
  const mode = readLocalClientAuthorityEpochStoreMode(env);
  if (executionRequested && mode !== "sqlite") {
    throw localClientAuthorityEpochConfigError(
      "STORE_REQUIRED",
      "Local-client execution requires AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE=sqlite.",
    );
  }
  if (mode !== "sqlite") return;

  requireLocalClientAuthorityEpochHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const authorityPath = resolveLocalClientAuthorityEpochPath(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH,
  );
  readLocalClientAuthorityEpochNamespace(env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE);
  readStrictLocalClientAuthorityEpochInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS,
    32,
    2,
    4_096,
    "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS",
  );
  readStrictLocalClientAuthorityEpochInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS",
  );

  const comparedPaths = [];
  if (routePlanMode === "sqlite") {
    comparedPaths.push(resolve(
      repoRoot,
      String(
        env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
          ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
      ),
    ));
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    comparedPaths.push(resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    ));
  }
  if (String(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE ?? "").trim().toLowerCase() === "sqlite") {
    comparedPaths.push(resolveLocalClientIdempotencyPath(env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH));
  }
  for (const candidate of [
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH,
    env.AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      comparedPaths.push(resolve(repoRoot, candidate));
    }
  }
  if (comparedPaths.some((candidate) => candidate.toLowerCase() === authorityPath.toLowerCase())) {
    throw localClientAuthorityEpochConfigError(
      "SQLITE_PATH_CONFLICT",
      "The authority checkpoint requires a database path distinct from registry, route-plan, claim, idempotency, and external-effect state.",
    );
  }
}

function validateLocalClientSynchronousExecutionBackends(env, executionRequested, routePlanMode) {
  if (!executionRequested) return;
  if (routePlanMode !== "sqlite") {
    throw Object.assign(new Error(
      "Local-client execution requires the durable SQLite route-plan store.",
    ), {
      code: "LOCAL_CLIENT_ROUTE_PLAN_DURABLE_REQUIRED",
      category: "configuration",
      statusCode: 503,
    });
  }
  const configuredControlMode = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE
      ?? "",
  ).trim().toLowerCase();
  const controlPostgresUrl = String(
    env.AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL
      ?? "",
  ).trim();
  const controlMode = configuredControlMode || (controlPostgresUrl ? "postgres" : "local");
  if (controlMode !== "local") {
    throw Object.assign(new Error(
      "This synchronous single-host local-client runtime currently requires local atomic approval/lifecycle control; PostgreSQL readiness wiring is not yet available.",
    ), {
      code: "LOCAL_CLIENT_CONTROL_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      category: "configuration",
      statusCode: 503,
    });
  }
  const configuredEffectMode = String(env.AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE ?? "")
    .trim()
    .toLowerCase();
  const effectPostgresUrl = String(
    env.AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL
      ?? env.AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL
      ?? "",
  ).trim();
  const effectMode = configuredEffectMode || (effectPostgresUrl ? "postgres" : "sqlite");
  if (effectMode !== "sqlite") {
    throw Object.assign(new Error(
      "This synchronous single-host local-client runtime currently requires SQLite external-effect reservations; PostgreSQL readiness wiring is not yet available.",
    ), {
      code: "LOCAL_CLIENT_EXTERNAL_EFFECT_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      category: "configuration",
      statusCode: 503,
    });
  }
}

function validateLocalClientIdempotencyConfiguration(env, executionRequested, routePlanMode) {
  if (!executionRequested) return;
  const mode = String(env.AI_GATEWAY_IDEMPOTENCY_STORE_MODE ?? "memory").trim().toLowerCase();
  if (mode !== "sqlite" && mode !== "postgres") {
    throw localClientIdempotencyConfigError(
      "DURABLE_STORE_REQUIRED",
      "Local-client execution requires AI_GATEWAY_IDEMPOTENCY_STORE_MODE=sqlite or postgres.",
    );
  }
  if (mode === "postgres") {
    throw localClientIdempotencyConfigError(
      "POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      "This synchronous single-host local-client runtime currently requires SQLite idempotency; PostgreSQL readiness wiring is not yet available.",
    );
  }
  const secret = env.AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET;
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw localClientIdempotencyConfigError(
      "HMAC_SECRET_REQUIRED",
      "Local-client execution requires a stable idempotency HMAC secret of at least 32 bytes.",
    );
  }
  const idempotencyPath = resolveLocalClientIdempotencyPath(
    env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
  );
  if (routePlanMode === "sqlite") {
    const routePlanPath = resolve(
      repoRoot,
      String(
        env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
          ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
      ),
    );
    if (idempotencyPath.toLowerCase() === routePlanPath.toLowerCase()) {
      throw localClientIdempotencyConfigError(
        "SQLITE_PATH_CONFLICT",
        "Local-client idempotency and route plans require separate SQLite files.",
      );
    }
  }
  if (readLocalClientExecutionClaimStoreMode(env) === "sqlite") {
    const claimPath = resolveLocalClientExecutionClaimPath(
      env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
    );
    if (idempotencyPath.toLowerCase() === claimPath.toLowerCase()) {
      throw localClientIdempotencyConfigError(
        "SQLITE_PATH_CONFLICT",
        "Local-client idempotency and execution claims require separate SQLite files.",
      );
    }
  }
}

function resolveLocalClientIdempotencyPath(value) {
  const path = String(value ?? "");
  if (!path.trim()) {
    throw localClientIdempotencyConfigError(
      "SQLITE_PATH_REQUIRED",
      "SQLite local-client idempotency requires AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH.",
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
    throw localClientIdempotencyConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client idempotency SQLite path must be a bounded local file path.",
    );
  }
  const absolute = resolve(repoRoot, path);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) {
    throw localClientIdempotencyConfigError(
      "SQLITE_PATH_INVALID",
      "The local-client idempotency SQLite path must remain on this host.",
    );
  }
  return absolute;
}

function localClientIdempotencyConfigError(reason, message) {
  return Object.assign(new Error(message), {
    code: `LOCAL_CLIENT_IDEMPOTENCY_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function validateLocalClientExecutionClaimConfiguration(env, executionRequested, routePlanMode) {
  const mode = readLocalClientExecutionClaimStoreMode(env);
  const multiInstance = readStrictLocalClientExecutionClaimBoolean(
    env.AI_GATEWAY_MULTI_INSTANCE,
    false,
    "AI_GATEWAY_MULTI_INSTANCE",
  );
  if (executionRequested && multiInstance) {
    const error = localClientExecutionClaimConfigError(
      "DISTRIBUTED_REQUIRED",
      "Multi-instance local-client execution requires a distributed claim store; SQLite is single-host only.",
    );
    error.blockers = Object.freeze(["claim_not_distributed"]);
    throw error;
  }
  if (executionRequested && mode !== "sqlite") {
    throw localClientExecutionClaimConfigError(
      "STORE_REQUIRED",
      "Single-host local-client execution requires the explicit SQLite fenced claim store.",
    );
  }
  if (mode !== "sqlite") return;

  requireLocalClientExecutionClaimHostId(env.AI_GATEWAY_LOCAL_CLIENT_HOST_ID);
  const claimPath = resolveLocalClientExecutionClaimPath(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH,
  );
  readLocalClientExecutionClaimNamespace(env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE);
  readStrictLocalClientExecutionClaimInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS,
    60_000,
    10,
    300_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS",
  );
  readStrictLocalClientExecutionClaimInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS,
    1_024,
    1,
    100_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS",
  );
  readStrictLocalClientExecutionClaimInteger(
    env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS,
    5_000,
    100,
    30_000,
    "AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS",
  );

  if (routePlanMode === "sqlite") {
    const routePlanPath = resolve(
      repoRoot,
      String(
        env.AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH
          ?? resolve(repoRoot, ".data/local-clients/route-plans.sqlite"),
      ),
    );
    if (routePlanPath.toLowerCase() === claimPath.toLowerCase()) {
      throw localClientExecutionClaimConfigError(
        "SQLITE_PATH_CONFLICT",
        "Route plans and execution claims require distinct SQLite database paths.",
      );
    }
  }
}

function readStrictLocalClientExecutionClaimBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientExecutionClaimConfigError(
    "CONFIG_INVALID",
    `${name} must be true or false when configured.`,
  );
}

export function readStrictBoolean(value, fallback, name) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw localClientAdapterConfigError(`${name}_INVALID`);
}

function decodeLocalClientLoopbackSecret(value) {
  const normalized = String(value ?? "").trim();
  const match = /^hex:([a-f0-9]{64,128})$/iu.exec(normalized);
  if (!match || match[1].length % 2 !== 0) throw localClientAdapterConfigError("SECRET_FORMAT_INVALID");
  return Buffer.from(match[1], "hex");
}

function localClientAdapterConfigError(reason) {
  return Object.assign(new Error("Local-client loopback adapter configuration is incomplete or invalid."), {
    code: `LOCAL_CLIENT_LOOPBACK_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}
