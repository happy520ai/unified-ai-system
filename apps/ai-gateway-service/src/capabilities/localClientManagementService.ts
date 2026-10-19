// =============================================================================
// localClientManagementService.ts — 本地客户端管理服务（preflight + 工厂）
//
// 纯函数核心拆至 localClientManagementCore.ts；本文件保留 preflight 与工厂。
// 行为不变。
// =============================================================================

import { access, appendFile, chmod, mkdir, open, readFile, rename } from "node:fs/promises";
import { lstatSync, readFileSync } from "node:fs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type {
  LocalClientHealthStatus,
  LocalClientRegistryResult,
  LocalClientStatusResult,
  ManagedLocalClientSummary,
  PreviewLocalClientExecutionResult,
  RegisterLocalClientRequest,
  RegisterLocalClientResult,
  RouteLocalClientRequest,
  RouteLocalClientResult,
} from "@unified-ai-system/shared-contracts";
import {
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
  type LocalClientAdapterDescriptor,
  type VerifiedLocalClientAdapterTarget,
  type LocalClientAdapterRegistry,
} from "./localClientAdapterRegistry.ts";
import type { LocalClientExecutionReadiness } from "./localClientExecutionReadiness.ts";
import {
  LocalClientVerificationAuthorityEpochError,
  type LocalClientSqliteVerificationAuthorityEpochStore,
} from "./localClientSqliteVerificationAuthorityEpochStore.ts";
import type {
  LocalClientSqliteFeedbackDedupStore,
} from "./localClientSqliteFeedbackDedupStore.ts";
import {
  LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION,
  LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
  LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION,
  fingerprintLocalClientVerificationDeclaration,
  type LocalClientVerificationAdapterReference,
  type LocalClientVerificationDeclaration,
  type LocalClientVerificationEvidence,
  type LocalClientVerificationScope,
  type LocalClientVerificationStore,
  type VerifiedLocalClientPromotion,
} from "./localClientVerificationService.ts";

import {
  DEFAULT_DISCOVERY_HINTS_PATH,
  DEFAULT_EXECUTION_LOG_PATH,
  DEFAULT_REGISTRY_PATH,
  DurableNormalizedFeedbackRequest,
  LocalClientDisableInput,
  LocalClientDiscoverInput,
  LocalClientExecuteInput,
  LocalClientFeedbackInput,
  LocalClientHealthResult,
  LocalClientHeartbeatInput,
  LocalClientInput,
  LocalClientListInput,
  LocalClientMaintenanceInput,
  LocalClientManagementOptions,
  LocalClientRegisterInput,
  LocalClientRegistry,
  LocalClientRegistrySummary,
  LocalClientRevokeInput,
  LocalClientRouteInput,
  LocalClientScope,
  LocalClientSmartManageInput,
  LocalClientSystemDiscoverInput,
  MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT,
  MAX_REGISTRY_FILE_BYTES,
  REGISTRY_INTEGRITY_VERSION,
  REGISTRY_VERSION,
  ResolveVerifiedLocalClientTargetInput,
  ResolvedVerifiedLocalClientTarget,
  SERVICE_PHASE,
  StoredClientVerificationEvidence,
  StoredLocalClient,
  UnknownRecord,
  appendLogEntry,
  assertDurableFeedbackRequest,
  belongsToScope,
  buildBuiltInHintMap,
  buildDiscoveryCandidates,
  clampStatsAverage,
  classifyRiskProfile,
  cloneRegistryIntegrityKey,
  computeRegistryDigest,
  computeRegistryHmac,
  computeReliabilityScore,
  createDefaultRegistry,
  createError,
  descriptorSupportsClient,
  feedbackOutcomeUnknownError,
  fileExists,
  hasExactKeys,
  incrementClientRevision,
  incrementRegistryGeneration,
  isClientCurrentlyVerified,
  isRecord,
  isRegistryGeneration,
  isVerificationEvidenceFresh,
  listProcessRows,
  mergeHeartbeatCapabilities,
  mergeHeartbeatLoad,
  mergeHeartbeatTags,
  normalizeBoolean,
  normalizeCapability,
  normalizeClient,
  normalizeDisableInput,
  normalizeDiscoverInput,
  normalizeExecuteInput,
  normalizeFeedbackInput,
  normalizeHeartbeatInput,
  normalizeMaintenanceInput,
  normalizeProbeVerificationEvidence,
  normalizeRegisterInput,
  normalizeRevokeInput,
  normalizeRouteRequest,
  normalizeScope,
  normalizeSmartManageInput,
  normalizeStoredIdentifier,
  normalizeSystemDiscoverInput,
  normalizeVerificationScope,
  now,
  parsePositiveInt,
  rankCandidates,
  readDiscoveryHints,
  readJson,
  safeNumber,
  safeNumberOrNaN,
  safeSha256Equal,
  safeTrim,
  sameStringSet,
  saveJson,
  throwIfLocalClientAborted,
  toDeclaredVerificationProjection,
  toList,
  toPublicClient,
  updateOutcomeEwma,
  verifyRegistryIntegrity,
} from "./localClientManagementCore.js";

export type { ResolveVerifiedLocalClientTargetInput, ResolvedVerifiedLocalClientTarget } from "./localClientManagementCore.js";


export function preflightLocalClientRegistryIntegrity(options: {
  registryPath?: unknown;
  registryIntegrityKey: Uint8Array;
  epochStore?: Pick<
    LocalClientSqliteVerificationAuthorityEpochStore,
    "status" | "inspectSync" | "assertCurrentSync"
  >;
}) {
  if (
    !hasExactKeys(options, ["registryPath", "registryIntegrityKey"])
    && !hasExactKeys(options, ["registryPath", "registryIntegrityKey", "epochStore"])
  ) {
    throw createError(
      "local_client_registry_integrity_key_invalid",
      "Local client registry integrity preflight configuration is invalid.",
      { statusCode: 503, category: "configuration" },
    );
  }
  const key = cloneRegistryIntegrityKey(options.registryIntegrityKey);
  if (!key) {
    throw createError(
      "local_client_registry_integrity_key_invalid",
      "Local client registry integrity preflight requires a key.",
      { statusCode: 503, category: "configuration" },
    );
  }
  const registryPath = resolve(safeTrim(options.registryPath, DEFAULT_REGISTRY_PATH));
  const epochStore = options.epochStore;
  try {
    let stat;
    try {
      stat = lstatSync(registryPath);
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT") {
        const epochState = epochStore?.inspectSync();
        if (epochState?.recoveryRequired === true) {
          throw createError(
            "local_client_registry_epoch_pending",
            "The authority checkpoint has a pending generation; startup requires explicit registry recovery and finalization.",
            {
              statusCode: 503,
              category: "integrity",
              details: {
                currentGeneration: epochState.currentGeneration,
                pendingGeneration: epochState.pendingGeneration,
              },
            },
          );
        }
        if (epochState?.initialized === true) {
          throw createError(
            "local_client_registry_missing_for_checkpoint",
            "The signed local-client registry is missing while a finalized authority checkpoint exists.",
            {
              statusCode: 503,
              category: "integrity",
              details: { currentGeneration: epochState.currentGeneration },
            },
          );
        }
        return Object.freeze({
          available: true,
          durable: true,
          authenticated: true,
          distributed: false,
          existingRegistryVerified: false,
          storageMode: "hmac-fsync-atomic-json",
          monotonicCheckpoint: epochStore !== undefined,
          rollbackResistant: false,
          rollbackDetectionScope: epochStore?.status.rollbackDetectionScope ?? "none",
          currentGeneration: 0,
        });
      }
      throw error;
    }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_REGISTRY_FILE_BYTES) {
      throw new Error("invalid registry file");
    }
    const parsed = JSON.parse(readFileSync(registryPath, "utf8"));
    if (!isRecord(parsed) || !verifyRegistryIntegrity(key, parsed)) {
      throw new Error("registry integrity mismatch");
    }
    const generation = Number(parsed.generation);
    const registryDigest = computeRegistryDigest(parsed);
    epochStore?.assertCurrentSync(generation, registryDigest);
    return Object.freeze({
      available: true,
      durable: true,
      authenticated: true,
      distributed: false,
      existingRegistryVerified: true,
      storageMode: "hmac-fsync-atomic-json",
      monotonicCheckpoint: epochStore !== undefined,
      rollbackResistant: false,
      rollbackDetectionScope: epochStore?.status.rollbackDetectionScope ?? "none",
      currentGeneration: generation,
    });
  } catch (error) {
    if (
      error instanceof LocalClientVerificationAuthorityEpochError
      || (isRecord(error) && String(error.code ?? "").startsWith("local_client_registry_"))
    ) {
      throw error;
    }
    throw createError(
      "local_client_registry_corrupt",
      "Local client registry integrity preflight failed; startup is denied.",
      { statusCode: 503, category: "integrity" },
    );
  } finally {
    key.fill(0);
  }
}

export function createLocalClientManagementService({
  env = {},
  repoRoot,
  registryPath,
  executionLogPath,
  discoveryHintsPath,
  adapterRegistry,
  executionReadiness,
  registryIntegrityKey: configuredRegistryIntegrityKey,
  epochStore,
  feedbackDedupStore,
  processRowsProvider = listProcessRows,
  staleClientThresholdMs: configuredStaleClientThresholdMs = parsePositiveInt(env.AI_GATEWAY_LOCAL_CLIENT_STALE_THRESHOLD_MS, 5 * 60_000, 30_000, 6 * 60 * 60_000),
  executionEnabled: configuredExecutionEnabled = normalizeBoolean(env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED, false),
  maxAlternatives: configuredMaxAlternatives = parsePositiveInt(env.AI_GATEWAY_LOCAL_CLIENT_MAX_ALTERNATIVES, 5, 1, 20),
}: LocalClientManagementOptions = {}) {
  const staleClientThresholdMs = parsePositiveInt(
    configuredStaleClientThresholdMs,
    5 * 60_000,
    30_000,
    6 * 60 * 60_000,
  );
  const executionEnabled = normalizeBoolean(configuredExecutionEnabled, false);
  const registryIntegrityKey = cloneRegistryIntegrityKey(configuredRegistryIntegrityKey);
  if (epochStore !== undefined && registryIntegrityKey === null) {
    throw createError(
      "local_client_registry_epoch_integrity_key_required",
      "The monotonic local-client authority checkpoint requires authenticated registry integrity.",
      { statusCode: 503, category: "configuration" },
    );
  }
  if (feedbackDedupStore !== undefined && registryIntegrityKey === null) {
    throw createError(
      "local_client_feedback_registry_integrity_required",
      "Durable feedback reconciliation requires an authenticated local-client registry.",
      { statusCode: 503, category: "configuration" },
    );
  }
  if (
    feedbackDedupStore !== undefined
    && (
      feedbackDedupStore.status.available !== true
      || feedbackDedupStore.status.durable !== true
      || feedbackDedupStore.status.deliveryMode !== "exclusive-leased-acknowledged"
    )
  ) {
    throw createError(
      "local_client_feedback_dedup_unavailable",
      "The durable feedback delivery-claim store is unavailable.",
      { statusCode: 503, category: "configuration" },
    );
  }
  const maxAlternatives = parsePositiveInt(configuredMaxAlternatives, 5, 1, 20);
  void repoRoot;
  const resolvedRegistryPath = safeTrim(registryPath, DEFAULT_REGISTRY_PATH);
  const resolvedExecutionLogPath = safeTrim(
    executionLogPath,
    DEFAULT_EXECUTION_LOG_PATH,
  );
  const resolvedDiscoveryHintsPath = safeTrim(discoveryHintsPath, DEFAULT_DISCOVERY_HINTS_PATH);
  const resolveProcessRows = typeof processRowsProvider === "function" ? processRowsProvider : listProcessRows;
  const adapterDescriptors: readonly LocalClientAdapterDescriptor[] = typeof adapterRegistry?.list === "function"
    ? adapterRegistry.list()
    : [];
  const adapterDescriptorsById = new Map(adapterDescriptors.map((descriptor) => [descriptor.id, descriptor]));
  const fakeAdapterConfigured = adapterDescriptors.some((descriptor) => descriptor.type === "fake");
  const governedAdapterConfigured = adapterDescriptors.some((descriptor) => descriptor.type !== "fake");
  const resolvedExecutionReadiness = executionReadiness ?? Object.freeze({
    requested: executionEnabled,
    ready: false,
    mode: executionEnabled ? "blocked" as const : "preview-only" as const,
    multiInstance: false,
    governedAdapterCount: 0,
    blockers: Object.freeze(executionEnabled ? ["execution_runtime_not_composed"] : []),
    boundaries: Object.freeze({
      realExecutionDefault: false as const,
      requiresDurableRoutePlan: true as const,
      requiresSubjectBoundApproval: true as const,
      requiresDurableLifecycle: true as const,
      requiresExclusiveClaim: true as const,
      requiresDurableExternalEffectGate: true as const,
      requiresDurableIdempotency: true as const,
      requiresAuthenticatedVerificationAuthority: true as const,
      requiresMonotonicCheckpoint: true as const,
      requiresRollbackResistanceByDefault: true as const,
      multiInstanceRequiresDistributedState: true as const,
    }),
  });
  let registryCache: LocalClientRegistry | null = null;
  let registryLoadPromise: Promise<LocalClientRegistry> | null = null;
  let persistenceTail: Promise<void> = Promise.resolve();
  let executionLogTail: Promise<void> = Promise.resolve();
  let feedbackMutationTail: Promise<void> = Promise.resolve();
  let registryAuthorityFailure: unknown = null;

  function assertRegistryAuthorityUsable(): void {
    if (registryAuthorityFailure !== null) throw registryAuthorityFailure;
  }

  async function loadRegistry(): Promise<LocalClientRegistry> {
    assertRegistryAuthorityUsable();
    if (registryCache) {
      return registryCache;
    }
    if (!registryLoadPromise) {
      registryLoadPromise = (async () => {
        if (!await fileExists(resolvedRegistryPath)) {
          const epochState = epochStore?.inspectSync();
          if (epochState?.recoveryRequired === true) {
            throw createError(
              "local_client_registry_epoch_pending",
              "The authority checkpoint has a pending generation; registry recovery must be completed explicitly.",
              {
                statusCode: 503,
                category: "integrity",
                details: {
                  currentGeneration: epochState.currentGeneration,
                  pendingGeneration: epochState.pendingGeneration,
                },
              },
            );
          }
          if (epochState?.initialized === true) {
            throw createError(
              "local_client_registry_missing_for_checkpoint",
              "The signed registry is missing while a finalized authority checkpoint exists.",
              {
                statusCode: 503,
                category: "integrity",
                details: { currentGeneration: epochState.currentGeneration },
              },
            );
          }
          registryCache = createDefaultRegistry();
          return registryCache;
        }

        try {
          const parsed = await readJson(resolvedRegistryPath);
          const data = isRecord(parsed) ? parsed : {};
          const integrityValid = registryIntegrityKey !== null
            && verifyRegistryIntegrity(registryIntegrityKey, data);
          if (registryIntegrityKey !== null && !integrityValid) {
            throw Object.assign(new Error("registry integrity mismatch"), {
              code: "registry_integrity_mismatch",
            });
          }
          const generation = isRegistryGeneration(data.generation, false)
            ? data.generation
            : 0;
          if (epochStore !== undefined) {
            await epochStore.assertCurrent(generation, computeRegistryDigest(data));
          }
          const normalizedClients = Array.isArray(data.clients)
            ? data.clients.map((item) => {
              const rawClient = isRecord(item) ? item as LocalClientInput : {};
              return normalizeClient(rawClient, now(), {
                verificationStatus: integrityValid
                  ? rawClient.verificationStatus
                  : rawClient.verificationStatus === "verified"
                    ? "declared"
                    : rawClient.verificationStatus,
                preserveFeedbackAppliedEventMarkers: integrityValid,
                preserveRevocation: integrityValid,
              });
            })
            : [];
          registryCache = {
            version: REGISTRY_VERSION,
            generation,
            createdAt: safeTrim(data.createdAt, now()),
            updatedAt: safeTrim(data.updatedAt, now()),
            clients: normalizedClients,
            integrity: integrityValid
              ? {
                version: REGISTRY_INTEGRITY_VERSION,
                hmacSha256: String((data.integrity as UnknownRecord).hmacSha256),
              }
              : null,
          };
          return registryCache;
        } catch (error) {
          if (error instanceof LocalClientVerificationAuthorityEpochError) throw error;
          throw createError(
            "local_client_registry_corrupt",
            "Local client registry could not be loaded; refusing to replace it automatically.",
            {
              statusCode: 503,
              category: "integrity",
              details: { reason: safeTrim(isRecord(error) ? error.code : undefined, "invalid_registry") },
            },
          );
        }
      })().finally(() => {
        registryLoadPromise = null;
      });
    }
    return registryLoadPromise;
  }

  async function saveRegistry(): Promise<void> {
    if (!registryCache) return;
    const persist = async () => {
      assertRegistryAuthorityUsable();
      if (!registryCache) return;
      try {
        const expectedGeneration = registryCache.generation;
        const generation = epochStore === undefined
          ? incrementRegistryGeneration(expectedGeneration)
          : (await epochStore.reserveNextGeneration(expectedGeneration)).generation;
        const unsignedPayload = JSON.parse(JSON.stringify({
          updatedAt: now(),
          createdAt: registryCache.createdAt,
          clients: registryCache.clients.map((item) => ({ ...item })),
          version: REGISTRY_VERSION,
          generation,
        })) as Omit<LocalClientRegistry, "integrity">;
        const integrity = registryIntegrityKey === null
          ? null
          : {
            version: REGISTRY_INTEGRITY_VERSION,
            hmacSha256: computeRegistryHmac(registryIntegrityKey, unsignedPayload),
          };
        const snapshot = { ...unsignedPayload, integrity } as LocalClientRegistry;
        await saveJson(resolvedRegistryPath, snapshot);
        if (epochStore !== undefined) {
          await epochStore.finalize(generation, computeRegistryDigest(snapshot));
        }
        registryCache.generation = generation;
        registryCache.updatedAt = unsignedPayload.updatedAt;
        registryCache.integrity = integrity;
      } catch (error) {
        if (epochStore !== undefined) registryAuthorityFailure = error;
        throw error;
      }
    };
    const current = persistenceTail.then(persist, persist);
    persistenceTail = current.then(() => undefined, () => undefined);
    await current;
  }

  async function appendExecutionLog(entry: UnknownRecord): Promise<void> {
    const payload = {
      phase: SERVICE_PHASE,
      timestamp: now(),
      ...entry,
    };
    const append = () => appendLogEntry(resolvedExecutionLogPath, payload);
    const current = executionLogTail.then(append, append);
    executionLogTail = current.then(() => undefined, () => undefined);
    await current;
  }

  async function readVerificationDeclaration(
    rawScope: LocalClientVerificationScope,
    clientId: string,
  ): Promise<LocalClientVerificationDeclaration | null> {
    const scope = normalizeVerificationScope(rawScope);
    const normalizedClientId = normalizeStoredIdentifier(clientId);
    if (normalizedClientId === null) return null;
    const registry = await loadRegistry();
    const target = registry.clients.find((client) => (
      client.tenantId === scope.tenantId && client.clientId === normalizedClientId
    ));
    if (!target) return null;
    const declaration = toDeclaredVerificationProjection(target);
    if (
      !declaration
      || !descriptorSupportsClient(adapterDescriptorsById.get(declaration.adapter.id), target)
    ) {
      return null;
    }
    return declaration;
  }

  async function promoteVerificationExact(
    rawRequest: Parameters<LocalClientVerificationStore["promoteExact"]>[0],
  ): Promise<VerifiedLocalClientPromotion | null> {
    if (!hasExactKeys(rawRequest, [
      "scope",
      "expected",
      "declarationFingerprint",
      "evidence",
    ])) {
      return null;
    }
    const scope = normalizeVerificationScope(rawRequest.scope);
    const evidence = normalizeProbeVerificationEvidence(rawRequest.evidence);
    if (!isVerificationEvidenceFresh(evidence, Date.now())) return null;

    let expectedFingerprint: string;
    try {
      expectedFingerprint = fingerprintLocalClientVerificationDeclaration(rawRequest.expected);
    } catch {
      return null;
    }
    if (
      rawRequest.expected.tenantId !== scope.tenantId
      || !safeSha256Equal(rawRequest.declarationFingerprint, expectedFingerprint)
    ) {
      return null;
    }

    const registry = await loadRegistry();
    const targetIndex = registry.clients.findIndex((client) => (
      client.tenantId === scope.tenantId
      && client.clientId === rawRequest.expected.clientId
    ));
    if (targetIndex < 0) return null;
    const target = registry.clients[targetIndex]!;
    const current = toDeclaredVerificationProjection(target);
    if (!current) return null;
    const descriptor = adapterDescriptorsById.get(current.adapter.id);
    if (!descriptorSupportsClient(descriptor, target)) return null;
    const currentFingerprint = fingerprintLocalClientVerificationDeclaration(current);
    if (
      !safeSha256Equal(currentFingerprint, expectedFingerprint)
      || !safeSha256Equal(currentFingerprint, rawRequest.declarationFingerprint)
    ) {
      return null;
    }

    const previous = {
      verificationStatus: target.verificationStatus,
      verification: target.verification,
      trustLevel: target.trustLevel,
      revision: target.revision,
      updatedAt: target.updatedAt,
    } as const;
    const promotedRevision = incrementClientRevision(target.revision);
    const promotedEvidence: StoredClientVerificationEvidence = {
      evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
      fingerprint: evidence.fingerprint,
      declarationFingerprint: currentFingerprint,
      verifiedAtMs: evidence.verifiedAtMs,
      expiresAtMs: evidence.expiresAtMs,
    };

    // No await is permitted between the final comparison above and this state
    // transition: this is the in-process compare-and-set boundary.
    target.verificationStatus = "verified";
    target.verification = promotedEvidence;
    target.trustLevel = "verified";
    target.revision = promotedRevision;
    target.updatedAt = now();
    registry.updatedAt = target.updatedAt;

    try {
      await saveRegistry();
    } catch {
      if (
        registry.clients[targetIndex] === target
        && target.verificationStatus === "verified"
        && target.revision === promotedRevision
        && safeSha256Equal(target.verification?.fingerprint, promotedEvidence.fingerprint)
      ) {
        target.verificationStatus = previous.verificationStatus;
        target.verification = previous.verification;
        target.trustLevel = previous.trustLevel;
        target.revision = previous.revision;
        target.updatedAt = previous.updatedAt;
        registry.updatedAt = now();
        await saveRegistry().catch(() => {});
      }
      throw createError(
        "local_client_verification_persistence_failed",
        "Verified local-client promotion could not be persisted safely.",
        { statusCode: 503, category: "integrity" },
      );
    }

    if (
      registry.clients[targetIndex] !== target
      || !isClientCurrentlyVerified(target, Date.now())
      || target.revision !== promotedRevision
      || !safeSha256Equal(target.verification?.fingerprint, promotedEvidence.fingerprint)
    ) {
      return null;
    }

    return Object.freeze({
      promotionVersion: LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION,
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: target.clientId,
      revision: promotedRevision,
      state: "verified",
      trustDecision: "verified",
      adapter: Object.freeze({
        id: descriptor.id,
        type: descriptor.type,
        version: descriptor.version,
      }),
      manifestSha256: target.manifestSha256!,
      capabilityIds: Object.freeze([...target.capabilities].sort()),
      verification: Object.freeze({
        evidenceVersion: promotedEvidence.evidenceVersion,
        fingerprint: promotedEvidence.fingerprint,
        verifiedAtMs: promotedEvidence.verifiedAtMs,
        expiresAtMs: promotedEvidence.expiresAtMs,
      }),
    });
  }

  const verificationStore: LocalClientVerificationStore = Object.freeze({
    readCurrent: readVerificationDeclaration,
    promoteExact: promoteVerificationExact,
  });

  async function resolveVerifiedTarget(
    input: ResolveVerifiedLocalClientTargetInput,
  ): Promise<ResolvedVerifiedLocalClientTarget> {
    if (!hasExactKeys(input, ["identity", "clientId"])) {
      throw createError(
        "local_client_verified_target_request_invalid",
        "Verified local-client target resolution request is invalid.",
      );
    }
    const scope = normalizeVerificationScope(input.identity);
    const clientId = normalizeStoredIdentifier(input.clientId);
    if (clientId === null) {
      throw createError(
        "local_client_verified_target_request_invalid",
        "Verified local-client target resolution request is invalid.",
      );
    }
    const registry = await loadRegistry();
    const target = registry.clients.find((client) => (
      client.tenantId === scope.tenantId && client.clientId === clientId
    ));
    if (!target) {
      throw createError(
        "local_client_verified_target_not_found",
        "No verified local client exists in the authenticated tenant scope.",
        { statusCode: 404, category: "not_found" },
      );
    }
    if (!isClientCurrentlyVerified(target, Date.now())) {
      throw createError(
        "local_client_verified_target_unavailable",
        "The local client does not have fresh verified execution authority.",
        { statusCode: 409, category: "auth" },
      );
    }
    const descriptor = target.adapterId
      ? adapterDescriptorsById.get(target.adapterId)
      : undefined;
    if (!descriptorSupportsClient(descriptor, target)) {
      throw createError(
        "local_client_verified_target_adapter_mismatch",
        "The verified local-client adapter no longer matches the registered adapter.",
        { statusCode: 409, category: "integrity" },
      );
    }
    return Object.freeze({
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: target.clientId,
      revision: target.revision,
      state: "verified",
      trustDecision: "verified",
      adapter: Object.freeze({
        id: descriptor.id,
        type: descriptor.type,
        version: descriptor.version,
      }),
      capabilityIds: Object.freeze([...target.capabilities].sort()),
    });
  }

  async function list(
    input: LocalClientListInput,
    rawScope: LocalClientScope,
  ): Promise<LocalClientRegistryResult> {
    const scope = normalizeScope(rawScope);
    const registry = await loadRegistry();
    const includeDisabled = normalizeBoolean(input.includeDisabled, false);
    const enabledOnly = normalizeBoolean(input.enabledOnly, !includeDisabled);
    const capabilitiesFilter = toList(input.capabilities).map(normalizeCapability);
    const offset = Math.max(0, parsePositiveInt(input.offset, 0, 0, Number.MAX_SAFE_INTEGER));
    const limit = Math.min(100, Math.max(1, parsePositiveInt(input.limit, 50, 1, 200)));
    const nowTs = Date.now();
    const filtered = registry.clients.filter((client) => {
      if (!belongsToScope(client, scope)) {
        return false;
      }
      if (enabledOnly && !client.enabled) {
        return false;
      }
      if (capabilitiesFilter.length === 0) return true;
      return capabilitiesFilter.some((capability) => client.capabilities.includes(capability));
    });
    const total = filtered.length;
    const clients = filtered.slice(offset, offset + limit).map((client) => toPublicClient(client, nowTs));
    return {
      phase: SERVICE_PHASE,
      total,
      clients,
      pagination: {
        offset,
        limit,
        returned: clients.length,
        includeDisabled,
      },
    };
  }

  async function discover(input: LocalClientDiscoverInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeDiscoverInput(input, scope);
    throwIfLocalClientAborted(request.signal);
    const registry = await loadRegistry();
    throwIfLocalClientAborted(request.signal);
    const nowTime = now();
    const index = new Map();
    registry.clients.forEach((item, i) => {
      if (belongsToScope(item, scope)) index.set(item.clientId, i);
    });
    const inserted = [];
    const updated = [];

    for (const discovered of request.clients) {
      throwIfLocalClientAborted(request.signal);
      const existingIndex = index.get(discovered.clientId);
      if (existingIndex === undefined) {
        registry.clients.push({
          ...discovered,
          discoveredAt: nowTime,
          enabled: true,
        });
        inserted.push(discovered.clientId);
        continue;
      }
      const existing = registry.clients[existingIndex];
      const declared = existing.verificationStatus !== "unverified";
      const merged = {
        ...existing,
        name: declared ? existing.name : discovered.name,
        displayName: declared ? existing.displayName : discovered.displayName,
        description: declared ? existing.description : discovered.description,
        executable: discovered.executable || existing.executable,
        platform: discovered.platform || existing.platform,
        clientId: existing.clientId,
        capabilities: declared
          ? existing.capabilities
          : Array.from(new Set([...existing.capabilities, ...discovered.capabilities])),
        tags: Array.from(new Set([...existing.tags, ...discovered.tags])),
        metadata: {
          ...existing.metadata,
          ...discovered.metadata,
        },
        verificationStatus: existing.verificationStatus,
        routable: existing.routable,
        trustLevel: existing.trustLevel,
        health: existing.health,
        load: existing.load,
        stats: existing.stats,
        preferred: existing.preferred,
        priority: existing.priority,
        updatedAt: nowTime,
        lastSeenAt: nowTime,
        enabled: existing.enabled,
      };
      registry.clients[existingIndex] = merged;
      updated.push(discovered.clientId);
    }

    if (request.includeMissingAsDisabled) {
      const discoveredSet = new Set(request.clients.map((item) => item.clientId));
      const nowStaleAt = Date.now();
      for (const client of registry.clients) {
        throwIfLocalClientAborted(request.signal);
        if (!belongsToScope(client, scope)) continue;
        const belongsToSource = client.metadata?.discoverSource === request.source;
        if (belongsToSource && !discoveredSet.has(client.clientId) && client.lastSeenAt && nowStaleAt - Date.parse(client.lastSeenAt) > staleClientThresholdMs) {
          client.enabled = false;
          client.health = { ...client.health, status: "unhealthy", updatedAt: nowTime, lastError: "stale_discovery" };
        }
      }
    }

    registry.updatedAt = nowTime;
    throwIfLocalClientAborted(request.signal);
    await saveRegistry();
    await appendExecutionLog({
      op: "discover",
      source: request.source,
      discovered: request.clients.length,
      insertedCount: inserted.length,
      updatedCount: updated.length,
      strategy: request.strategy,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });
    return {
      phase: SERVICE_PHASE,
      source: request.source,
      strategy: request.strategy,
      discovered: request.clients.length,
      inserted,
      updated,
      registry: await list({ enabledOnly: false, limit: maxAlternatives }, scope),
    };
  }

  async function discoverFromSystem(input: LocalClientSystemDiscoverInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeSystemDiscoverInput(input);
    throwIfLocalClientAborted(request.signal);
    const processRows = await resolveProcessRows(request.maxProcesses, request.signal);
    throwIfLocalClientAborted(request.signal);
    const fileHints = await readDiscoveryHints(resolvedDiscoveryHintsPath);
    throwIfLocalClientAborted(request.signal);
    const builtinHints = buildBuiltInHintMap();
    const mergedHints = new Map();
    for (const [name, item] of builtinHints.entries()) {
      mergedHints.set(name, item);
    }
    for (const [name, item] of fileHints.entries()) {
      mergedHints.set(name, item);
    }

    const { candidates, dropped } = buildDiscoveryCandidates(processRows, mergedHints, request);
    const systemScanRequest = {
      source: request.source,
      clients: candidates,
      includeMissingAsDisabled: request.includeMissingAsDisabled,
      strategy: "system-scan",
      signal: request.signal,
    };
    if (request.dryRun) {
      return {
        phase: SERVICE_PHASE,
        source: request.source,
        strategy: "system-scan",
        dryRun: true,
        discovered: candidates.length,
        includedSystemProcesses: request.includeSystemProcesses,
        includeUnknown: request.includeUnknown,
        includeMissingAsDisabled: request.includeMissingAsDisabled,
        autoDiscoverAll: request.autoDiscoverAll,
        maxProcesses: request.maxProcesses,
        dropped,
        candidates: candidates.slice(0, maxAlternatives).map((client) => toPublicClient(normalizeClient(client, now(), {
          tenantId: scope.tenantId,
          verificationStatus: "unverified",
          routable: false,
          trustLevel: "low",
        }))),
      };
    }

    const discoveredResult = await discover(systemScanRequest, scope);
    return {
      ...discoveredResult,
      strategy: "system-scan",
      source: request.source,
      includeUnknown: request.includeUnknown,
      includedSystemProcesses: request.includeSystemProcesses,
      autoDiscoverAll: request.autoDiscoverAll,
      maxProcesses: request.maxProcesses,
      dropped,
      dryRun: false,
    };
  }

  async function register(
    input: LocalClientRegisterInput,
    rawScope: LocalClientScope,
  ): Promise<RegisterLocalClientResult> {
    const scope = normalizeScope(rawScope);
    const client = normalizeRegisterInput(input, scope);
    const registry = await loadRegistry();
    const nowTime = now();
    const index = registry.clients.findIndex((item) => belongsToScope(item, scope) && item.clientId === client.clientId);
    let action: RegisterLocalClientResult["action"] = "created";
    if (index >= 0) {
      const previous = registry.clients[index];
      if (previous.revokedAt !== null) {
        throw createError(
          "local_client_register_revoked",
          "A revoked local client cannot be registered again.",
          { statusCode: 409, category: "conflict" },
        );
      }
      const preserveExactBinding = !Object.hasOwn(input, "adapterId")
        && !Object.hasOwn(input, "adapterType")
        && !Object.hasOwn(input, "adapterVersion")
        && !Object.hasOwn(input, "manifestSha256");
      const nextAdapterId = preserveExactBinding ? previous.adapterId : client.adapterId;
      const nextAdapterType = preserveExactBinding ? previous.adapterType : client.adapterType;
      const nextAdapterVersion = preserveExactBinding ? previous.adapterVersion : client.adapterVersion;
      const nextManifestSha256 = preserveExactBinding ? previous.manifestSha256 : client.manifestSha256;
      const declarationChanged = previous.verificationStatus === "unverified"
        || previous.adapterId !== nextAdapterId
        || previous.adapterType !== nextAdapterType
        || previous.adapterVersion !== nextAdapterVersion
        || previous.manifestSha256 !== nextManifestSha256
        || !sameStringSet(previous.capabilities, client.capabilities)
        || (previous.verificationStatus === "verified" && !isClientCurrentlyVerified(previous, Date.now()));
      const nextRevision = declarationChanged
        ? incrementClientRevision(previous.revision)
        : previous.revision;
      registry.clients[index] = {
        ...previous,
        clientId: previous.clientId,
        name: client.name,
        displayName: client.displayName,
        description: client.description,
        adapterId: nextAdapterId,
        adapterType: nextAdapterType,
        adapterVersion: nextAdapterVersion,
        manifestSha256: nextManifestSha256,
        protocolVersion: Object.hasOwn(input, "protocolVersion")
          ? client.protocolVersion
          : previous.protocolVersion,
        capabilities: client.capabilities,
        verificationStatus: declarationChanged ? "declared" : previous.verificationStatus,
        verification: declarationChanged ? null : previous.verification,
        routable: true,
        trustLevel: declarationChanged ? "medium" : previous.trustLevel,
        revision: nextRevision,
        updatedAt: nowTime,
      };
      action = "updated";
    } else {
      registry.clients.push(client);
    }
    registry.updatedAt = nowTime;
    await saveRegistry();
    await appendExecutionLog({
      op: "register",
      action,
      clientId: client.clientId,
      capabilityCount: client.capabilities.length,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });
    const storedClient = registry.clients.find((item) => belongsToScope(item, scope) && item.clientId === client.clientId);
    if (!storedClient) {
      throw createError("local_client_register_persistence_failed", "Registered client could not be reloaded.", {
        statusCode: 500,
        category: "integrity",
      });
    }
    return {
      phase: SERVICE_PHASE,
      action,
      client: toPublicClient(storedClient),
    };
  }

  async function disable(input: LocalClientDisableInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeDisableInput(input);
    if (request.dryRun) {
      return {
        phase: SERVICE_PHASE,
        mode: "preview",
        request,
        allowed: true,
        note: "preview mode; call with dryRun:false to apply",
      };
    }
    const registry = await loadRegistry();
    const target = registry.clients.find((item) => belongsToScope(item, scope) && item.clientId === request.clientId);
    if (!target) {
      throw createError("local_client_disable_not_found", `No client found for id ${request.clientId}.`, {
        statusCode: 404,
        category: "not_found",
      });
    }
    target.enabled = false;
    target.updatedAt = now();
    target.health = {
      ...target.health,
      status: request.includeHealthReset ? "unknown" : target.health.status,
      updatedAt: now(),
      lastError: request.reason,
    };
    registry.updatedAt = now();
    await saveRegistry();
    await appendExecutionLog({
      op: "disable",
      clientId: request.clientId,
      reason: request.reason,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });
    return {
      phase: SERVICE_PHASE,
      mode: "applied",
      action: "disabled",
      client: toPublicClient(target),
    };
  }

  async function revoke(input: LocalClientRevokeInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeRevokeInput(input);
    if (registryIntegrityKey === null) {
      throw createError(
        "local_client_revoke_authority_unavailable",
        "Revocation requires an authenticated local-client registry authority.",
        { statusCode: 503, category: "configuration" },
      );
    }
    const registry = await loadRegistry();
    const target = registry.clients.find((item) => (
      belongsToScope(item, scope) && item.clientId === request.clientId
    ));
    if (!target) {
      throw createError("local_client_revoke_not_found", `No client found for id ${request.clientId}.`, {
        statusCode: 404,
        category: "not_found",
      });
    }
    if (target.revokedAt !== null) {
      return {
        phase: SERVICE_PHASE,
        mode: "applied",
        action: "already-revoked",
        client: toPublicClient(target),
      };
    }
    if (target.revision !== request.expectedRevision) {
      throw createError(
        "local_client_revoke_revision_conflict",
        "The local client revision changed before revocation.",
        { statusCode: 409, category: "conflict" },
      );
    }
    if (request.dryRun) {
      return {
        phase: SERVICE_PHASE,
        mode: "preview",
        action: "revoke-preview",
        expectedRevision: request.expectedRevision,
        client: toPublicClient(target),
        writesPerformed: false,
      };
    }

    const revokedAt = now();
    target.enabled = false;
    target.routable = false;
    target.preferred = false;
    target.trustLevel = "low";
    target.verificationStatus = "unverified";
    target.verification = null;
    target.revision = incrementClientRevision(target.revision);
    target.revokedAt = revokedAt;
    target.revokedReason = request.reason;
    target.updatedAt = revokedAt;
    target.health = {
      ...target.health,
      status: "unknown",
      updatedAt: revokedAt,
      lastError: request.reason,
    };
    registry.updatedAt = revokedAt;
    await saveRegistry();
    await appendExecutionLog({
      op: "revoke",
      clientId: request.clientId,
      reason: request.reason,
      previousRevision: request.expectedRevision,
      revision: target.revision,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });
    return {
      phase: SERVICE_PHASE,
      mode: "applied",
      action: "revoked",
      client: toPublicClient(target),
    };
  }

  async function heartbeat(input: LocalClientHeartbeatInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeHeartbeatInput(input);
    const registry = await loadRegistry();
    const nowTime = now();
    const targetIndex = registry.clients.findIndex((item) => belongsToScope(item, scope) && item.clientId === request.clientId);
    let mode = "updated";
    let client = null;

    if (targetIndex >= 0) {
      client = registry.clients[targetIndex];
      mergeHeartbeatLoad(client, request);
      if (client.verificationStatus === "unverified") {
        mergeHeartbeatCapabilities(client, request);
        mergeHeartbeatTags(client, request);
      }
      client.health = {
        ...client.health,
        status: request.healthStatus,
        latencyMs: request.latencyMs,
        lastError: request.lastError || null,
        updatedAt: nowTime,
      };
      client.lastSeenAt = nowTime;
      client.updatedAt = nowTime;
      client.metadata = {
        ...client.metadata,
        lastHeartbeatAt: nowTime,
      };
    } else {
      if (!request.upsert) {
        throw createError("local_client_heartbeat_not_found", `No client found for id ${request.clientId}.`, {
          statusCode: 404,
          category: "not_found",
        });
      }
      const clientInput = {
        clientId: request.clientId,
        capabilities: request.capabilities,
        tags: request.tags,
        health: {
          status: request.healthStatus,
          latencyMs: request.latencyMs,
          lastError: request.lastError || null,
          updatedAt: nowTime,
        },
        load: {
          cpu: request.cpu,
          memory: request.memory,
          queueDepth: request.queueDepth,
        },
        metadata: {
          discoveredBy: "heartbeat",
          discoverSource: "heartbeat",
          lastHeartbeatAt: nowTime,
        },
        preferred: request.preferred,
      };
      client = normalizeClient(clientInput, nowTime, {
        tenantId: scope.tenantId,
        verificationStatus: "unverified",
        routable: false,
        trustLevel: "low",
      });
      client.enabled = true;
      registry.clients.push(client);
      mode = "created";
    }

    if (!client) {
      throw createError("local_client_heartbeat_internal_error", "Heartbeat processing failed to build client state.", {
        statusCode: 500,
        category: "service",
      });
    }

    registry.updatedAt = nowTime;
    await saveRegistry();
    await appendExecutionLog({
      op: "heartbeat",
      clientId: request.clientId,
      mode,
      healthStatus: request.healthStatus,
      upsert: request.upsert,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });
    return {
      phase: SERVICE_PHASE,
      mode,
      clientId: client.clientId,
      name: client.name,
      health: client.health,
      load: client.load,
      stats: client.stats,
      enabled: client.enabled,
      verificationStatus: client.verificationStatus,
      routable: client.routable,
      upserted: mode === "created",
      lastSeenAt: client.lastSeenAt,
      registrySummary: summarizeClients(registry.clients.filter((item) => belongsToScope(item, scope))),
    };
  }

  async function feedback(input: LocalClientFeedbackInput, rawScope: LocalClientScope) {
    const operation = () => processFeedback(input, rawScope);
    const current = feedbackMutationTail.then(operation, operation);
    feedbackMutationTail = current.then(() => undefined, () => undefined);
    return current;
  }

  async function processFeedback(input: LocalClientFeedbackInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeFeedbackInput(input);
    if (feedbackDedupStore !== undefined) assertDurableFeedbackRequest(request);
    const registry = await loadRegistry();
    const nowTime = now();
    const targetIndex = registry.clients.findIndex((item) => (
      belongsToScope(item, scope) && item.clientId === request.clientId
    ));
    if (targetIndex < 0) {
      throw createError("local_client_feedback_not_found", `No client found for id ${request.clientId}.`, {
        statusCode: 404,
        category: "not_found",
      });
    }
    const target = registry.clients[targetIndex]!;

    if (feedbackDedupStore === undefined) {
      applyFeedbackAggregate(target, request, nowTime, request.error || "task_failed");
      registry.updatedAt = nowTime;
      await saveRegistry();
      await appendExecutionLog({
        op: "feedback",
        clientId: request.clientId,
        taskId: request.taskId,
        status: request.status,
        latencyMs: request.latencyMs,
        requiredCapabilities: request.requiredCapabilities,
        tenantId: scope.tenantId,
        userId: scope.userId,
        deduplication: "disabled",
      });
      return buildFeedbackResult(registry, target, request, scope, {
        mode: "disabled",
        exactlyOnce: false,
        state: "applied",
        replayed: false,
        reclaimed: false,
        reconciled: false,
        auditLogPersisted: true,
      });
    }

    const durableRequest = request as DurableNormalizedFeedbackRequest;
    const claim = await feedbackDedupStore.admitAndClaim({
      tenantId: scope.tenantId,
      clientId: durableRequest.clientId,
      eventId: durableRequest.eventId,
      taskId: durableRequest.taskId,
      outcome: durableRequest.status,
      latencyMs: durableRequest.latencyMs,
      capabilities: durableRequest.requiredCapabilities,
      observedAt: durableRequest.observedAt,
    });
    if (claim.state === "pending") {
      throw createError(
        "local_client_feedback_event_in_progress",
        "This feedback event is already being applied by another request.",
        {
          statusCode: 409,
          category: "concurrency",
          details: {
            retryable: true,
            leaseExpiresAt: claim.leaseExpiresAt,
          },
        },
      );
    }
    if (claim.state === "applied") {
      if (removeFeedbackMarkers(target, claim.eventFingerprint)) {
        registry.updatedAt = nowTime;
        await saveRegistry();
      }
      return buildFeedbackResult(registry, target, request, scope, {
        mode: "sqlite-feedback-dedup",
        exactlyOnce: true,
        state: "applied-replay",
        replayed: true,
        reclaimed: false,
        reconciled: false,
        auditLogPersisted: false,
      });
    }

    const claimReference = {
      leaseToken: claim.lease.token,
      fencingToken: claim.lease.fencingToken,
      eventFingerprint: claim.eventFingerprint,
      contentFingerprint: claim.contentFingerprint,
    };
    const markerAlreadyPersisted = hasFeedbackMarker(
      target,
      claim.eventFingerprint,
      claim.admissionFingerprint,
    );
    if (markerAlreadyPersisted) {
      try {
        await feedbackDedupStore.acknowledgeApplied(claimReference);
        removeFeedbackMarkers(target, claim.eventFingerprint, claim.admissionFingerprint);
        registry.updatedAt = now();
        await saveRegistry();
      } catch (error) {
        await feedbackDedupStore.releaseClaim(claimReference).catch(() => undefined);
        throw feedbackOutcomeUnknownError(error);
      }
      return buildFeedbackResult(registry, target, request, scope, {
        mode: "sqlite-feedback-dedup",
        exactlyOnce: true,
        state: "reconciled",
        replayed: true,
        reclaimed: claim.reclaimed,
        reconciled: true,
        auditLogPersisted: false,
      });
    }
    // The same event identifier may be admitted again only after the durable
    // dedup row has retired. A marker from that older admission generation must
    // not suppress the newly admitted sample.
    removeFeedbackMarkers(target, claim.eventFingerprint);
    if (
      target.feedbackAppliedEventMarkers.length
      >= MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT
    ) {
      await feedbackDedupStore.releaseClaim(claimReference).catch(() => undefined);
      throw createError(
        "local_client_feedback_reconciliation_capacity",
        "Too many feedback events are awaiting durable reconciliation for this client.",
        { statusCode: 503, category: "capacity" },
      );
    }

    const before = structuredClone(target);
    let registryPersisted = false;
    try {
      applyFeedbackAggregate(
        target,
        request,
        nowTime,
        request.status === "timeout" ? "timeout" : "client_reported_error",
      );
      target.feedbackAppliedEventMarkers.push({
        eventFingerprint: claim.eventFingerprint,
        admissionFingerprint: claim.admissionFingerprint,
      });
      registry.updatedAt = nowTime;
      await saveRegistry();
      registryPersisted = true;
      await feedbackDedupStore.acknowledgeApplied(claimReference);
      removeFeedbackMarkers(target, claim.eventFingerprint, claim.admissionFingerprint);
      registry.updatedAt = now();
      await saveRegistry();
    } catch (error) {
      if (!registryPersisted) registry.clients[targetIndex] = before;
      await feedbackDedupStore.releaseClaim(claimReference).catch(() => undefined);
      if (registryPersisted) throw feedbackOutcomeUnknownError(error);
      throw error;
    }

    let auditLogPersisted = true;
    try {
      await appendExecutionLog({
        op: "feedback",
        clientId: request.clientId,
        taskId: request.taskId,
        status: request.status,
        latencyMs: request.latencyMs,
        requiredCapabilities: request.requiredCapabilities,
        tenantId: scope.tenantId,
        userId: scope.userId,
        deduplication: claim.reclaimed ? "reclaimed" : "claimed",
      });
    } catch {
      auditLogPersisted = false;
    }
    return buildFeedbackResult(registry, target, request, scope, {
      mode: "sqlite-feedback-dedup",
      exactlyOnce: true,
      state: "applied",
      replayed: false,
      reclaimed: claim.reclaimed,
      reconciled: false,
      auditLogPersisted,
    });
  }

  function applyFeedbackAggregate(
    target: StoredLocalClient,
    request: ReturnType<typeof normalizeFeedbackInput>,
    nowTime: string,
    failureDiagnostic: string,
  ): void {
    const previousAttempts = safeNumber(target.stats?.attempts, 0);
    const isSuccess = request.status === "success";
    target.stats = {
      ...target.stats,
      attempts: previousAttempts + 1,
      successes: safeNumber(target.stats?.successes, 0),
      failures: safeNumber(target.stats?.failures, 0),
      failureStreak: safeNumber(target.stats?.failureStreak, 0),
      avgLatencyMs: safeNumberOrNaN(target.stats?.avgLatencyMs),
      ewmaSuccessRate: updateOutcomeEwma(target.stats?.ewmaSuccessRate, isSuccess),
      lastFeedbackAt: nowTime,
      lastTaskCapabilities: request.requiredCapabilities.length
        ? request.requiredCapabilities
        : Array.isArray(target.stats?.lastTaskCapabilities)
          ? target.stats.lastTaskCapabilities
          : [],
      lastFailureAt: request.status !== "success" ? nowTime : target.stats?.lastFailureAt,
      lastFailureMessage: request.status !== "success" ? failureDiagnostic : target.stats?.lastFailureMessage,
    };
    if (isSuccess) {
      target.stats.successes += 1;
      target.stats.failureStreak = 0;
      if (target.metadata?.autoRiskFlag) {
        target.metadata = {
          ...target.metadata,
          autoRiskFlag: null,
          autoRiskAt: null,
        };
      }
      if (request.latencyMs !== null) {
        target.stats.avgLatencyMs = clampStatsAverage(
          safeNumber(target.stats?.avgLatencyMs, NaN),
          previousAttempts,
          request.latencyMs,
        );
      }
      target.health = {
        ...target.health,
        status: target.health.status === "unhealthy" ? "degraded" : "healthy",
        lastError: null,
        updatedAt: nowTime,
      };
      if (request.latencyMs !== null) {
        target.health.latencyMs = request.latencyMs;
      }
    } else {
      target.stats.failures += 1;
      target.stats.failureStreak += 1;
      target.health = {
        ...target.health,
        status: "degraded",
        updatedAt: nowTime,
        lastError: failureDiagnostic,
      };
      if (target.stats.failureStreak >= 5 && target.enabled) {
        target.metadata = {
          ...target.metadata,
          autoRiskFlag: "failure_streak",
          autoRiskAt: nowTime,
        };
      }
    }
    target.lastSeenAt = nowTime;
    target.updatedAt = nowTime;
    if (request.taskId) {
      target.metadata = {
        ...target.metadata,
        lastTaskId: request.taskId,
      };
    }
  }

  function buildFeedbackResult(
    registry: LocalClientRegistry,
    target: StoredLocalClient,
    request: ReturnType<typeof normalizeFeedbackInput>,
    scope: LocalClientScope,
    deduplication: Readonly<{
      mode: "disabled" | "sqlite-feedback-dedup";
      exactlyOnce: boolean;
      state: "applied" | "applied-replay" | "reconciled";
      replayed: boolean;
      reclaimed: boolean;
      reconciled: boolean;
      auditLogPersisted: boolean;
    }>,
  ) {
    return {
      phase: SERVICE_PHASE,
      clientId: target.clientId,
      status: request.status,
      taskId: request.taskId,
      attempts: target.stats.attempts,
      successes: target.stats.successes,
      failures: target.stats.failures,
      avgLatencyMs: target.stats.avgLatencyMs,
      lastFailureAt: target.stats.lastFailureAt,
      lastFailureMessage: target.stats.lastFailureMessage,
      health: target.health,
      deduplication,
      registrySummary: summarizeClients(registry.clients.filter((item) => belongsToScope(item, scope))),
    };
  }

  function hasFeedbackMarker(
    target: StoredLocalClient,
    eventFingerprint: string,
    admissionFingerprint: string,
  ): boolean {
    return target.feedbackAppliedEventMarkers.some((marker) => (
      marker.eventFingerprint === eventFingerprint
      && marker.admissionFingerprint === admissionFingerprint
    ));
  }

  function removeFeedbackMarkers(
    target: StoredLocalClient,
    eventFingerprint: string,
    admissionFingerprint?: string,
  ): boolean {
    const before = target.feedbackAppliedEventMarkers.length;
    target.feedbackAppliedEventMarkers = target.feedbackAppliedEventMarkers.filter(
      (marker) => marker.eventFingerprint !== eventFingerprint
        || (
          admissionFingerprint !== undefined
          && marker.admissionFingerprint !== admissionFingerprint
        ),
    );
    return target.feedbackAppliedEventMarkers.length !== before;
  }

  function summarizeClients(clients: StoredLocalClient[]): LocalClientRegistrySummary {
    const totals: LocalClientRegistrySummary = {
      total: clients.length,
      enabled: 0,
      disabled: 0,
      healthy: 0,
      degraded: 0,
      unknown: 0,
      unhealthy: 0,
    };
    for (const client of clients) {
      if (client.enabled) totals.enabled += 1;
      else totals.disabled += 1;
      if (client.health.status === "healthy") totals.healthy += 1;
      else if (client.health.status === "degraded") totals.degraded += 1;
      else if (client.health.status === "unhealthy") totals.unhealthy += 1;
      else totals.unknown += 1;
    }
    return totals;
  }

  async function getIntelligence(rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const registry = await loadRegistry();
    const nowTs = Date.now();
    const scopedClients = registry.clients.filter((client) => belongsToScope(client, scope));
    const summary = summarizeClients(scopedClients);
    const staleClients = scopedClients
      .filter((client) => {
        const staleMs = nowTs - Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || "");
        return Number.isFinite(staleMs) && staleMs > staleClientThresholdMs;
      })
      .map((client) => ({
        clientId: client.clientId,
        name: client.name,
        staleMs: nowTs - Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || ""),
        health: client.health.status,
      }));

    const byCapabilityCoverage = new Map();
    for (const client of scopedClients) {
      const reliability = computeReliabilityScore(client.stats || {}, nowTs, staleClientThresholdMs);
      const enabled = Boolean(client.enabled);
      for (const capability of client.capabilities) {
        const normalizedCapability = safeTrim(capability, "unknown");
        if (!byCapabilityCoverage.has(normalizedCapability)) {
          byCapabilityCoverage.set(normalizedCapability, {
            enabled: 0,
            total: 0,
            healthy: 0,
            reliabilitySum: 0,
            reliabilityCount: 0,
          });
        }
        const row = byCapabilityCoverage.get(normalizedCapability);
        row.total += 1;
        if (enabled) row.enabled += 1;
        if (enabled && client.health.status === "healthy") row.healthy += 1;
        row.reliabilitySum += reliability;
        row.reliabilityCount += 1;
      }
    }

    const capabilityCoverage = Array.from(byCapabilityCoverage.entries())
      .map(([capability, item]) => ({
        capability,
        total: item.total,
        enabled: item.enabled,
        healthyEnabled: item.healthy,
        reliabilityAvg: item.reliabilityCount
          ? Math.round((item.reliabilitySum / item.reliabilityCount) * 100) / 100
          : 0,
      }))
      .sort((left, right) => right.total - left.total || right.reliabilityAvg - left.reliabilityAvg);

    const topPerformers = scopedClients
      .map((client) => ({
        clientId: client.clientId,
        name: client.name,
        enabled: Boolean(client.enabled),
        health: client.health.status,
        reliability: computeReliabilityScore(client.stats || {}, nowTs, staleClientThresholdMs),
        failureStreak: safeNumber(client.stats?.failureStreak, 0),
        capabilities: client.capabilities,
      }))
      .sort((left, right) => right.reliability - left.reliability)
      .slice(0, 10);

    const recoveredClients = scopedClients
      .filter((client) => {
        return client.enabled
          && client.health.status === "healthy"
          && safeNumber(client.stats?.failureStreak, 0) < 2
          && client.stats?.failureStreak !== null;
      })
      .map((client) => ({
        clientId: client.clientId,
        name: client.name,
        reliability: computeReliabilityScore(client.stats || {}, nowTs, staleClientThresholdMs),
        failureStreak: safeNumber(client.stats?.failureStreak, 0),
      }))
      .sort((left, right) => right.reliability - left.reliability)
      .slice(0, 10);

    const observedCapabilities = new Set(Array.from(byCapabilityCoverage.keys()));
    const coreCapabilityChecks = [
      "browser",
      "web_automation",
      "terminal",
      "automation",
      "scripting",
      "editor",
      "file_operation",
      "chat",
      "communication",
      "notifications",
      "local_workflow",
    ];
    const capabilityGaps = coreCapabilityChecks
      .filter((capability) => !observedCapabilities.has(capability))
      .map((capability) => ({ capability, severity: "medium" }));

    const recommendations = [];
    if (summary.total === 0) {
      recommendations.push({
        type: "discover",
        priority: "high",
        action: "POST /local-clients/discover/system with includeMissingAsDisabled=true and includeUnknown=true",
        rationale: "No客户端已发现，本地应用管理尚未启动。",
      });
    }
    if (staleClients.length > 0) {
      recommendations.push({
        type: "refresh",
        priority: "medium",
        action: "POST /local-clients/discover/system with includeMissingAsDisabled=true for stale revalidation",
        rationale: `${staleClients.length}个客户端超过阈值未上报，建议立即刷新。`,
      });
    }
    if (summary.unhealthy > 0) {
      recommendations.push({
        type: "stability",
        priority: "medium",
        action: "POST /local-clients/route with taskText='状态检查' to触发可用候选评估",
        rationale: `${summary.unhealthy}个客户端状态异常，建议优先使用高可靠客户端替代。`,
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        type: "stability",
        priority: "low",
        action: "定期执行一次 discover/system",
        rationale: "当前状态健康，可保持定期扫描以获取新应用。",
      });
    }

    const risks = scopedClients
      .filter((client) => safeNumber(client.stats?.failureStreak, 0) >= 3)
      .slice(0, 10)
      .map((client) => ({
        clientId: client.clientId,
        name: client.name,
        failureStreak: safeNumber(client.stats?.failureStreak, 0),
        reliability: computeReliabilityScore(client.stats || {}, nowTs, staleClientThresholdMs),
        lastFailureAt: client.stats?.lastFailureAt,
      }));

    return {
      phase: SERVICE_PHASE,
      intelligenceMode: "adaptive-local-client-scoring",
      summary,
      staleClients,
      capabilityCoverage,
      topPerformers,
      recoveredClients,
      capabilityGaps,
      risks,
      recommendations,
      generatedAt: now(),
    };
  }

  async function maintenanceInternal(input: LocalClientMaintenanceInput, scope: LocalClientScope) {
    const request = normalizeMaintenanceInput(input);
    throwIfLocalClientAborted(request.signal);
    const registry = await loadRegistry();
    throwIfLocalClientAborted(request.signal);
    const scopedClients = registry.clients.filter((client) => belongsToScope(client, scope));
    const nowTime = now();
    const nowTs = Date.now();
    const staleThresholdMs = Math.max(staleClientThresholdMs, 1) * request.staleMultiplier;
    let staleDisabledCount = 0;
    let autoRiskRecoveredCount = 0;
    let autoRiskMarkedForReviewCount = 0;
    let riskDisabledCount = 0;
    let riskMarkedCount = 0;
    const staleClients = [];
    const autoRiskRecoveries = [];
    const riskAssessments = [];
    const appliedChanges = [];

    for (const client of scopedClients) {
      throwIfLocalClientAborted(request.signal);
      if (!request.includeDisabled && !client.enabled) {
        continue;
      }
      if (request.includeEnabledOnly && !client.enabled) {
        continue;
      }
      const lastSeenAt = Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || "");
      const staleMs = Number.isFinite(lastSeenAt) ? nowTs - lastSeenAt : null;
      const isStale = staleMs !== null && Number.isFinite(staleMs) && staleMs > staleThresholdMs;
      const riskFlag = safeTrim(client.metadata?.autoRiskFlag);
      const shouldAttemptAutoRiskRecovery = request.autoRiskRecover && Boolean(riskFlag) && safeNumber(client.stats?.failureStreak, 0) <= request.autoRiskRecoveryFailureThreshold;
      const autoRiskAt = Date.parse(client.metadata?.autoRiskAt || "");
      const autoRiskCanRecover = shouldAttemptAutoRiskRecovery
        && (!Number.isFinite(autoRiskAt) || (nowTs - autoRiskAt) >= request.autoRiskRecoveryMinAgeMs);
      const riskProfile = classifyRiskProfile(client, nowTs, staleThresholdMs, request);
      if (isStale) {
        staleClients.push({
          clientId: client.clientId,
          name: client.name,
          staleMs,
          enabled: client.enabled,
          health: client.health.status,
          autoRiskFlag: client.metadata?.autoRiskFlag ?? null,
        });
      }
      if (riskProfile.level !== "stable") {
        riskAssessments.push({
          clientId: client.clientId,
          name: client.name,
          level: riskProfile.level,
          healthScore: riskProfile.healthScore,
          reliabilityScore: riskProfile.reliabilityScore,
          staleMs: riskProfile.staleMs,
          failureStreak: riskProfile.failureStreak,
          reasons: riskProfile.reasons,
          compositeScore: riskProfile.compositeScore,
        });
      }

      if (autoRiskCanRecover && client.metadata?.autoRiskFlag) {
        autoRiskMarkedForReviewCount += 1;
        autoRiskRecoveries.push({
          clientId: client.clientId,
          name: client.name,
          failureStreak: safeNumber(client.stats?.failureStreak, 0),
          autoRiskFlag: client.metadata.autoRiskFlag,
          autoRiskAt: client.metadata.autoRiskAt,
          decision: request.dryRun ? "planned" : "cleared",
        });
      }

      if (!request.dryRun) {
        if (isStale && request.staleAction === "disable" && client.enabled) {
          client.enabled = false;
          client.health = {
            ...client.health,
            status: "unhealthy",
            updatedAt: nowTime,
            lastError: "stale_discovery",
          };
          staleDisabledCount += 1;
          appliedChanges.push({
            clientId: client.clientId,
            name: client.name,
            action: "stale-disable",
          });
        } else if (isStale && request.staleAction === "mark") {
          appliedChanges.push({
            clientId: client.clientId,
            name: client.name,
            action: "stale-mark",
            staleMs,
          });
        }
        if (request.riskAction === "disable" && riskProfile.isCritical && client.enabled) {
          client.enabled = false;
          client.health = {
            ...client.health,
            status: "unhealthy",
            updatedAt: nowTime,
            lastError: "risk_disable",
          };
          riskDisabledCount += 1;
          appliedChanges.push({
            clientId: client.clientId,
            name: client.name,
            action: "risk-disable",
            reason: riskProfile.level,
          });
        } else if (request.riskAction === "mark" && riskProfile.level !== "stable" && client.enabled) {
          riskMarkedCount += 1;
          appliedChanges.push({
            clientId: client.clientId,
            name: client.name,
            action: "risk-mark",
            reason: riskProfile.level,
          });
        }

        if (autoRiskCanRecover && client.metadata?.autoRiskFlag) {
          client.metadata = {
            ...client.metadata,
            autoRiskFlag: null,
            autoRiskAt: null,
          };
          autoRiskRecoveredCount += 1;
          appliedChanges.push({
            clientId: client.clientId,
            name: client.name,
            action: "auto-risk-clear",
          });
        }
      }

    }

    if (!request.dryRun) {
      throwIfLocalClientAborted(request.signal);
      registry.updatedAt = nowTime;
      await saveRegistry();
      await appendExecutionLog({
        op: "maintenance",
        dryRun: request.dryRun,
        staleAction: request.staleAction,
        staleMultiplier: request.staleMultiplier,
        riskAction: request.riskAction,
        criticalHealthScore: request.criticalHealthScore,
        riskDisableFailureStreak: request.riskDisableFailureStreak,
        staleDisabledCount,
        autoRiskRecoveredCount,
        riskDisabledCount,
        riskMarkedCount,
        tenantId: scope.tenantId,
        userId: scope.userId,
      });
    }

    return {
      phase: SERVICE_PHASE,
      action: request.staleAction,
      dryRun: request.dryRun,
      staleMultiplier: request.staleMultiplier,
      staleThresholdMs,
      staleAction: request.staleAction,
      includeEnabledOnly: request.includeEnabledOnly,
        includeDisabled: request.includeDisabled,
        autoRiskRecover: request.autoRiskRecover,
        riskAction: request.riskAction,
        criticalHealthScore: request.criticalHealthScore,
        riskDisableFailureStreak: request.riskDisableFailureStreak,
      summary: {
        totalClients: scopedClients.length,
        staleCandidates: staleClients.length,
        autoRiskRecoveries: autoRiskRecoveries.length,
        riskCandidates: riskAssessments.length,
        riskActions: riskDisabledCount + riskMarkedCount,
        appliedChanges: appliedChanges.length,
      },
      counts: {
        staleDisabledCount,
        autoRiskRecoveredCount,
        autoRiskMarkedForReviewCount,
        riskDisabledCount,
        riskMarkedCount,
      },
      staleClients: staleClients.slice(0, request.maxCandidates),
      autoRiskRecoveries: autoRiskRecoveries.slice(0, request.maxCandidates),
      riskAssessments: riskAssessments.slice(0, request.maxCandidates),
      riskSummary: {
        critical: riskAssessments.filter((client) => client.level === "critical").length,
        warning: riskAssessments.filter((client) => client.level === "warning").length,
      },
      appliedChanges: request.dryRun ? [] : appliedChanges.slice(0, request.maxCandidates),
      generatedAt: now(),
    };
  }

  async function maintenance(input: LocalClientMaintenanceInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    return maintenanceInternal(input, scope);
  }

  async function smartManage(input: LocalClientSmartManageInput, rawScope: LocalClientScope) {
    const scope = normalizeScope(rawScope);
    const request = normalizeSmartManageInput(input);
    throwIfLocalClientAborted(request.signal);
    const discovery = await discoverFromSystem(request.discover, scope);
    throwIfLocalClientAborted(request.signal);
    const maintenanceResult = request.includeDiscoveryOnly
      ? null
      : await maintenanceInternal(request.maintenance, scope);
    throwIfLocalClientAborted(request.signal);
    let registrySnapshot: Awaited<ReturnType<typeof getIntelligence>>["topPerformers"] = [];
    if (request.includeRegistrySnapshot) {
      const status = await getIntelligence(scope);
      throwIfLocalClientAborted(request.signal);
      const top = status.topPerformers || [];
      registrySnapshot = top;
    }
    const recommendations = [];
    if (maintenanceResult && maintenanceResult.counts) {
      if (maintenanceResult.counts.staleDisabledCount > 0) {
        recommendations.push(`Auto-disabled ${maintenanceResult.counts.staleDisabledCount} stale clients.`);
      }
      if (maintenanceResult.counts.autoRiskRecoveredCount > 0) {
        recommendations.push(`Cleared ${maintenanceResult.counts.autoRiskRecoveredCount} auto-risk markers after stabilization window.`);
      }
      if (maintenanceResult.summary && maintenanceResult.summary.autoRiskRecoveries > maintenanceResult.counts.autoRiskRecoveredCount) {
        recommendations.push("Some auto-risk flagged clients remain flagged because recovery window/threshold not yet met.");
      }
    }
    if (discovery.autoDiscoverAll) {
      recommendations.push(`System discovery scanned all local processes with maxProcesses=${discovery.maxProcesses || "default"}.`);
    }
    if (discovery.dryRun) {
      recommendations.push("Discovery and maintenance were executed in dry-run mode; no registry changes were persisted.");
    }

    if (!request.dryRun) {
      await appendExecutionLog({
        op: "smart-manage",
        dryRun: request.dryRun,
        includeDiscoveryOnly: request.includeDiscoveryOnly,
        includeRegistrySnapshot: request.includeRegistrySnapshot,
        discovered: discovery.discovered,
        discoveryDryRun: discovery.dryRun,
        autoDiscoverAll: discovery.autoDiscoverAll,
        includeUnknown: discovery.includeUnknown,
        staleDisabledCount: maintenanceResult?.counts?.staleDisabledCount || 0,
        autoRiskRecoveredCount: maintenanceResult?.counts?.autoRiskRecoveredCount || 0,
        tenantId: scope.tenantId,
        userId: scope.userId,
      });
    }

    return {
      phase: SERVICE_PHASE,
      action: "smart-manage",
      dryRun: request.dryRun,
      includeDiscoveryOnly: request.includeDiscoveryOnly,
      discovery: {
        phase: discovery.phase,
        source: discovery.source,
        dryRun: discovery.dryRun,
        discovered: discovery.discovered,
        includeUnknown: discovery.includeUnknown,
        includeMissingAsDisabled: discovery.includeMissingAsDisabled,
        includeSystemProcesses: discovery.includedSystemProcesses,
        autoDiscoverAll: discovery.autoDiscoverAll,
        dropped: discovery.dropped,
      },
      maintenance: maintenanceResult ? {
        dryRun: maintenanceResult.dryRun,
        staleCandidates: maintenanceResult.summary?.staleCandidates || 0,
        autoRiskRecoveries: maintenanceResult.summary?.autoRiskRecoveries || 0,
        summary: maintenanceResult.summary,
        counts: maintenanceResult.counts,
      } : null,
      recommendations: recommendations.slice(0, request.maxRecommendations),
      registrySnapshot: request.includeRegistrySnapshot ? registrySnapshot : [],
      generatedAt: now(),
      executedAt: now(),
    };
  }

  async function route(
    input: LocalClientRouteInput,
    rawScope: LocalClientScope,
  ): Promise<RouteLocalClientResult> {
    const scope = normalizeScope(rawScope);
    const request = normalizeRouteRequest(input);
    const registry = await loadRegistry();
    const nowTs = Date.now();
    const scopedClients = registry.clients.filter((client) => belongsToScope(client, scope));
    const baseCandidates = scopedClients.filter((client) => {
      const lastSeenAt = Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || "");
      const fresh = Number.isFinite(lastSeenAt) && nowTs - lastSeenAt <= staleClientThresholdMs;
      return (client.verificationStatus === "declared" || client.verificationStatus === "verified")
        && client.routable === true
        && client.enabled === true
        && client.health.status !== "unhealthy"
        && client.metadata?.autoRiskFlag == null
        && fresh;
    });
    const ranked = rankCandidates(baseCandidates, request, staleClientThresholdMs, nowTs);
    const top = ranked.slice(0, request.maxCandidates);
    const selected = top[0] || null;
    const status: RouteLocalClientResult["status"] = !selected
      ? "no-client"
      : selected.missingCapabilities.length === 0
        ? "route-ready"
        : "partial-route";
    const result = {
      phase: SERVICE_PHASE,
      status,
      selected: selected ? {
        clientId: selected.clientId,
        displayName: selected.displayName,
        score: selected.score,
        matchedCapabilities: selected.matchedCapabilities,
        reasons: selected.reasons,
        missingCapabilities: selected.missingCapabilities,
      } : null,
      alternatives: top.slice(0, maxAlternatives).map((client) => ({
        clientId: client.clientId,
        displayName: client.displayName,
        score: client.score,
        matchedCapabilities: client.matchedCapabilities,
        missingCapabilities: client.missingCapabilities,
        reasons: client.reasons,
      })),
      request: {
        requiredCapabilities: request.requiredCapabilities,
        capabilitySource: request.capabilitySource,
        maxCandidates: request.maxCandidates,
      },
    };
    await appendExecutionLog({
      op: "route",
      status,
      taskTextLength: request.taskText.length,
      requiredCapabilities: request.requiredCapabilities,
      selectedClientId: selected?.clientId || null,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });
    return result;
  }

  async function healthCheck(rawScope: LocalClientScope): Promise<LocalClientHealthResult> {
    const scope = normalizeScope(rawScope);
    const registry = await loadRegistry();
    const nowTs = Date.now();
    const nowText = now();
    const scopedClients = registry.clients.filter((client) => belongsToScope(client, scope));
    const details = scopedClients.map((client) => {
      const staleMs = nowTs - Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || "");
      const publicClient = toPublicClient(client, nowTs);
      return {
        clientId: client.clientId,
        displayName: client.displayName,
        enabled: !!client.enabled,
        routable: client.routable,
        state: publicClient.state,
        health: client.health.status,
        staleMs: Number.isFinite(staleMs) ? staleMs : null,
        latencyMs: client.health.latencyMs,
      };
    });
    const totals = summarizeClients(scopedClients);
    const staleClients = details.filter((client) => client.staleMs !== null && client.staleMs > staleClientThresholdMs).length;
    const enabledClients = details.filter((client) => client.enabled);
    const unhealthyEnabledClients = enabledClients.filter((client) => client.health === "unhealthy").length;
    const degradedEnabledClients = enabledClients.filter((client) => client.health === "degraded").length;
    const status = totals.enabled === 0
      ? "degraded"
      : unhealthyEnabledClients === enabledClients.length
        ? "unhealthy"
        : staleClients > totals.enabled / 2 || unhealthyEnabledClients > 0 || degradedEnabledClients > 0
        ? "degraded"
        : "healthy";
    return {
      phase: SERVICE_PHASE,
      status,
      checksAt: nowText,
      summary: totals,
      staleClientThresholdMs,
      staleClients,
      staleClientCount: staleClients,
      unhealthyEnabledClients,
      degradedEnabledClients,
      clients: details,
    };
  }

  async function execute(
    input: LocalClientExecuteInput,
    rawScope: LocalClientScope,
  ): Promise<PreviewLocalClientExecutionResult> {
    const scope = normalizeScope(rawScope);
    const request = normalizeExecuteInput(input);
    const routing = await route({
      taskText: request.taskText,
      requiredCapabilities: request.requiredCapabilities,
      preferredClientId: request.clientId || request.preferredClientId,
      includeDisabled: false,
      maxCandidates: 1,
      requestContext: "execute",
    }, scope);
    if (!routing.selected) {
      throw createError("local_client_route_no_target", "No available client can satisfy this task route request.", {
        statusCode: 409,
        category: "routing",
      });
    }
    if (!request.allowPartialExecution && routing.status === "partial-route") {
      throw createError("local_client_route_partial_target", "No client fully matches requested capabilities; partial route generated.", {
        statusCode: 409,
        category: "routing",
        details: {
          missingCapabilities: routing.selected.missingCapabilities,
          alternatives: routing.alternatives,
        },
      });
    }

    const executionResult: Omit<PreviewLocalClientExecutionResult, "note"> = {
      phase: SERVICE_PHASE,
      executionEnabled: false,
      dryRun: true,
      selectedClientId: routing.selected.clientId,
      selectedClientName: routing.selected.displayName,
      route: routing,
      status: "preview-only",
    };

    await appendExecutionLog({
      op: "execute",
      action: request.action,
      executionEnabled,
      dryRun: executionResult.dryRun,
      clientId: routing.selected.clientId,
      requestedCapabilities: request.requiredCapabilities,
      tenantId: scope.tenantId,
      userId: scope.userId,
    });

    if (!executionEnabled || request.dryRun) {
      return {
        ...executionResult,
        note: executionEnabled ? "Execution disabled from config or dryRun=true." : "Execution is currently disabled by default in service policy.",
      };
    }

    if (request.clientId && routing.selected.clientId !== request.clientId) {
      throw createError("local_client_execute_client_mismatch", "Requested clientId does not match route result.", {
        statusCode: 409,
        category: "routing",
      });
    }

    throw createError(
      "local_client_execution_adapter_unavailable",
      "No governed local client execution adapter is available.",
      {
        statusCode: 501,
        category: "not_implemented",
      },
    );
  }

  async function getStatus(rawScope: LocalClientScope): Promise<LocalClientStatusResult> {
    const scope = normalizeScope(rawScope);
    const registry = await loadRegistry();
    const scopedClients = registry.clients.filter((client) => belongsToScope(client, scope));
    const check = await healthCheck(scope);
    return {
      phase: SERVICE_PHASE,
      status: check.status === "healthy"
        ? (resolvedExecutionReadiness.ready ? "ready" : "preview-ready")
        : "degraded",
      executionEnabled,
      boundaries: {
        previewOnly: !resolvedExecutionReadiness.ready,
        tenantScoped: true,
        observedApplicationsRoutable: false,
        executionAdapterConfigured: governedAdapterConfigured,
        fakeAdapterConfigured,
        executionRequested: resolvedExecutionReadiness.requested,
        executionReady: resolvedExecutionReadiness.ready,
        executionMode: resolvedExecutionReadiness.mode,
        executionBlockers: [...resolvedExecutionReadiness.blockers],
        gatewayAuthoritySecretRequired: true,
        gatewayClientSecretReuseForbidden: true,
      },
      registrySummary: summarizeClients(scopedClients),
      health: {
        status: check.status,
        staleClients: check.staleClients,
      },
      feedbackDeduplication: {
        enabled: feedbackDedupStore !== undefined,
        mode: feedbackDedupStore === undefined ? "disabled" : "sqlite-feedback-dedup",
        durable: feedbackDedupStore?.status.durable === true,
        distributed: false,
        exactlyOnceAdmission: feedbackDedupStore?.status.exactlyOnceAdmission === true,
        deliveryMode: feedbackDedupStore?.status.deliveryMode
          ?? "disabled",
      },
    };
  }

  return {
    feedbackDedupStatus: feedbackDedupStore?.status ?? Object.freeze({
      mode: "disabled",
      storageMode: "none",
      available: true,
      durable: false,
      distributed: false,
      exactlyOnceAdmission: false,
      deliveryMode: "disabled",
      aggregateMutationPerformed: false,
      routingDecisionPerformed: false,
    }),
    verificationAuthorityStatus: Object.freeze({
      available: true,
      durable: registryIntegrityKey !== null,
      authenticated: registryIntegrityKey !== null,
      distributed: false,
      singleProcess: true,
      monotonicCheckpoint: epochStore?.status.monotonicCheckpoint === true,
      rollbackResistant: false,
      rollbackDetectionScope: epochStore?.status.rollbackDetectionScope ?? "none",
      storageMode: registryIntegrityKey === null
        ? "unsigned-atomic-json"
        : "hmac-fsync-atomic-json",
    }),
    verificationStore,
    resolveVerifiedTarget,
    getStatus,
    list,
    discover,
    discoverFromSystem,
    register,
    disable,
    revoke,
    heartbeat,
    feedback,
    getIntelligence,
    maintenance,
    smartManage,
    route,
    healthCheck,
    execute,
    async close() {
      await Promise.allSettled([persistenceTail, executionLogTail, feedbackMutationTail]);
      await feedbackDedupStore?.close();
      await epochStore?.close();
      registryIntegrityKey?.fill(0);
    },
    getConfig(rawScope: LocalClientScope) {
      normalizeScope(rawScope);
      return {
        phase: SERVICE_PHASE,
        executionEnabled,
        staleClientThresholdMs,
        maxAlternatives,
        fakeAdapterConfigured,
      };
    },
  };
}

export type LocalClientManagementService = ReturnType<typeof createLocalClientManagementService>;
