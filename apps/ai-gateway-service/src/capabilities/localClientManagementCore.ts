// =============================================================================
// localClientManagementCore.ts — 本地客户端管理的纯函数核心
//
// 从 localClientManagementService.ts 机械拆出（T-073 延续）：常量、类型与
// 99 个模块级纯函数。行为不变：service 以具名导入回这些符号。
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
import type {
  UnknownRecord,
  LocalClientVerificationStatus,
  LocalClientFeedbackStatus,
  LocalClientScope,
  StoredClientHealth,
  StoredClientLoad,
  StoredClientStats,
  StoredClientVerificationEvidence,
  StoredFeedbackAppliedEventMarker,
  StoredClientMetadata,
  StoredLocalClient,
  LocalClientRegistry,
  NestedHealthInput,
  NestedLoadInput,
  NestedStatsInput,
  LocalClientInput,
  NormalizeClientOptions,
  LocalClientListInput,
  LocalClientDiscoverInput,
  LocalClientRegisterInput,
  LocalClientSystemDiscoverInput,
  LocalClientHeartbeatInput,
  LocalClientFeedbackInput,
  LocalClientRouteInput,
  LocalClientExecuteInput,
  LocalClientMaintenanceInput,
  LocalClientSmartManageInput,
  LocalClientDisableInput,
  LocalClientRevokeInput,
  ProcessRow,
  NormalizedProcessRow,
  DiscoveryHint,
  DiscoveryHintInput,
  LocalClientManagementOptions,
  ResolveVerifiedLocalClientTargetInput,
  ResolvedVerifiedLocalClientTarget,
  LocalClientServiceError,
  LocalClientErrorOptions,
  RankedLocalClient,
  NormalizedRouteRequest,
  LocalClientRegistrySummary,
  LocalClientHealthResult,
} from "./localClientManagementCore.types.ts";

// Re-exports: the management types moved to
// localClientManagementCore.types.ts; existing importers keep working
// unchanged.
export type {
  UnknownRecord,
  LocalClientScope,
  StoredClientVerificationEvidence,
  StoredLocalClient,
  LocalClientRegistry,
  LocalClientInput,
  LocalClientListInput,
  LocalClientDiscoverInput,
  LocalClientRegisterInput,
  LocalClientSystemDiscoverInput,
  LocalClientHeartbeatInput,
  LocalClientFeedbackInput,
  LocalClientRouteInput,
  LocalClientExecuteInput,
  LocalClientMaintenanceInput,
  LocalClientSmartManageInput,
  LocalClientDisableInput,
  LocalClientRevokeInput,
  LocalClientManagementOptions,
  ResolveVerifiedLocalClientTargetInput,
  ResolvedVerifiedLocalClientTarget,
  LocalClientRegistrySummary,
  LocalClientHealthResult,
} from "./localClientManagementCore.types.ts";
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
import { now, safeNumber, safeTrim } from "./localClientScoring.ts";
import {
  isRecord,
  toList,
  normalizeCapability,
  parsePositiveInt,
  normalizeBoolean,
  normalizeTaskText,
  safeTrimOrNull,
  parseOptionalPositiveInt,
  normalizeSystemDiscoverInput,
  createStableClientId,
  fileExists,
  readJson,
  throwIfLocalClientAborted,
  normalizeAbortSignal,
  stableHash,
  createError,
  buildBuiltInHintMap,
  readDiscoveryHints,
  safeNumberOrNaN,
  listProcessRows,
  buildDiscoveryCandidates,
  inferTaskCapabilities,
  FALLBACK_UNKNOWN_CAPABILITIES,
  BUILTIN_DISCOVERY_HINTS,
  DISPATCHER_PROCESS_KEYWORDS,
  DEFAULT_UNKNOWN_TASK_CAPABILITIES,
  STABLE_ID_NAMESPACE,
  WINDOWS_TASKLIST_MAX_ROWS,
  execFileAsync,
  WINDOWS_TASKLIST_TIMEOUT_MS,
} from "./localClientDiscovery.ts";
import {
  hasExactKeys,
  safeSha256Equal,
  REGISTRY_VERSION,
  SHA256_PATTERN,
} from "./localClientRegistryIo.ts";
import {
  normalizeStoredIdentifier,
  normalizeStoredSha256,
  isFakeAdapterReference,
  isClientCurrentlyVerified,
} from "./localClientNormalization.ts";
export type { DurableNormalizedFeedbackRequest } from "./localClientNormalization.ts";

// Re-exports: the normalize/input cluster and its helper/const closure moved
// to localClientNormalization.ts; existing importers of this module keep
// working unchanged.
export {
  createClientId,
  normalizeHealthStatus,
  normalizeStoredIsoTimestamp,
  normalizeStoredRevocationReason,
  normalizeStoredIdentifier,
  normalizeStoredSemver,
  normalizeStoredSha256,
  normalizeStoredVerificationEvidence,
  isFakeAdapterReference,
  isVerificationEvidenceFresh,
  normalizeFeedbackAppliedEventMarkers,
  safeNumberOrNull,
  isClientCurrentlyVerified,
  parseOptionalDeclarationIdentifier,
  parseOptionalDeclarationSemver,
  parseOptionalDeclarationSha256,
  normalizeDiagnosticCode,
  normalizeOperationId,
  verifiedClientDeclarationFingerprint,
  normalizeClient,
  normalizeRegisterInput,
  normalizeDiscoverInput,
  normalizeHeartbeatInput,
  normalizeFeedbackInput,
  assertDurableFeedbackRequest,
  normalizeFeedbackObservedAt,
  normalizeRouteRequest,
  normalizeExecuteInput,
  normalizeMaintenanceInput,
  normalizeSmartManageInput,
  normalizeDisableInput,
  normalizeRevokeInput,
  clampStatsAverage,
  mergeHeartbeatLoad,
  mergeHeartbeatCapabilities,
  mergeHeartbeatTags,
  DEFAULT_STALE_RECONCILIATION_MULTIPLIER,
  DEFAULT_CRITICAL_HEALTH_SCORE,
  DEFAULT_RISK_DISABLE_FAILURE_STREAK,
  DEFAULT_AUTO_RISK_RECOVERY_MAX_FAILURE_STREAK,
  DEFAULT_AUTO_RISK_RECOVERY_MIN_AGE_MS,
  LOCAL_CLIENT_IDENTIFIER_PATTERN,
  LOCAL_CLIENT_SEMVER_PATTERN,
  MAX_VERIFICATION_EVIDENCE_TTL_MS,
  MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT,
  SAFE_DIAGNOSTIC_CODES,
} from "./localClientNormalization.ts";

// Re-exports: the registry integrity/IO cluster and its helpers/consts moved
// to localClientRegistryIo.ts; existing importers of this module keep working
// unchanged.
export {
  hasExactKeys,
  safeSha256Equal,
  verifyRegistryIntegrity,
  computeRegistryHmac,
  computeRegistryDigest,
  isRegistryGeneration,
  incrementRegistryGeneration,
  canonicalRegistryJson,
  saveJson,
  appendLogEntry,
  REGISTRY_VERSION,
  REGISTRY_INTEGRITY_VERSION,
  SHA256_PATTERN,
} from "./localClientRegistryIo.ts";

// Re-exports: the discovery cluster and its helper/const closure moved to
// localClientDiscovery.ts; existing importers of this module keep working
// unchanged.
export {
  isRecord, toList, normalizeCapability, parsePositiveInt, normalizeBoolean,
  normalizeTaskText, safeTrimOrNull, parseOptionalPositiveInt,
  normalizeSystemDiscoverInput, createStableClientId, fileExists, readJson,
  throwIfLocalClientAborted, normalizeAbortSignal, stableHash, createError,
  buildBuiltInHintMap, readDiscoveryHints, safeNumberOrNaN, listProcessRows,
  buildDiscoveryCandidates, inferTaskCapabilities,
  FALLBACK_UNKNOWN_CAPABILITIES, BUILTIN_DISCOVERY_HINTS,
  DISPATCHER_PROCESS_KEYWORDS, DEFAULT_UNKNOWN_TASK_CAPABILITIES,
  STABLE_ID_NAMESPACE, WINDOWS_TASKLIST_MAX_ROWS, WINDOWS_TASKLIST_TIMEOUT_MS,
} from "./localClientDiscovery.ts";

// Re-exports: the scoring cluster and the shared primitives moved to
// localClientScoring.ts; existing importers of this module keep working
// unchanged.
export { computeReliabilityScore, rankCandidates, classifyRiskProfile, updateOutcomeEwma, now, safeNumber, safeTrim } from "./localClientScoring.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "../..");
export const DEFAULT_REGISTRY_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "registry.json");
export const DEFAULT_EXECUTION_LOG_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "execution-log.jsonl");
export const DEFAULT_DISCOVERY_HINTS_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "discovery-hints.json");
export const SERVICE_PHASE = "phase-local-client-management-v1";
export const MAX_REGISTRY_FILE_BYTES = 16 * 1024 * 1024;










export function normalizeProbeVerificationEvidence(value: unknown): LocalClientVerificationEvidence | null {
  if (!isRecord(value)) return null;
  const expectedKeys = ["evidenceVersion", "fingerprint", "verifiedAtMs", "expiresAtMs"];
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    || value.evidenceVersion !== LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION
    || normalizeStoredSha256(value.fingerprint) === null
    || !Number.isSafeInteger(value.verifiedAtMs)
    || Number(value.verifiedAtMs) < 0
    || !Number.isSafeInteger(value.expiresAtMs)
    || Number(value.expiresAtMs) <= Number(value.verifiedAtMs)
  ) {
    return null;
  }
  return Object.freeze({
    evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
    fingerprint: String(value.fingerprint),
    verifiedAtMs: Number(value.verifiedAtMs),
    expiresAtMs: Number(value.expiresAtMs),
  });
}














export function cloneRegistryIntegrityKey(value: unknown): Buffer | null {
  if (value === undefined || value === null) return null;
  if (!(value instanceof Uint8Array) || value.byteLength < 32 || value.byteLength > 64) {
    throw createError(
      "local_client_registry_integrity_key_invalid",
      "Local client registry integrity requires a 32-64 byte key.",
      { statusCode: 503, category: "configuration" },
    );
  }
  return Buffer.from(value);
}


export function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

export function incrementClientRevision(value: unknown): number {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 1 || revision >= Number.MAX_SAFE_INTEGER) {
    throw createError(
      "local_client_revision_exhausted",
      "The local-client declaration revision cannot be incremented safely.",
      { statusCode: 409, category: "integrity" },
    );
  }
  return revision + 1;
}












export function feedbackOutcomeUnknownError(_cause: unknown): LocalClientServiceError {
  return createError(
    "local_client_feedback_outcome_unknown",
    "The feedback aggregate may be durable but its delivery acknowledgement is incomplete; retry only with the same eventId and identical content.",
    {
      statusCode: 503,
      category: "integrity",
      details: {
        outcome: "unknown-reconcile-required",
        retrySameEventId: true,
      },
    },
  );
}

export function normalizeScope(scope: unknown): LocalClientScope {
  if (!isRecord(scope)) {
    throw createError("local_client_scope_required", "Local client operations require an authenticated tenant scope.", {
      statusCode: 401,
      category: "auth",
    });
  }
  const tenantId = safeTrim(scope.tenantId);
  const userId = safeTrim(scope.userId);
  if (!tenantId || !userId) {
    throw createError("local_client_scope_invalid", "Local client operations require tenantId and userId.", {
      statusCode: 401,
      category: "auth",
    });
  }
  return { tenantId, userId };
}

export function belongsToScope(client: StoredLocalClient, scope: LocalClientScope): boolean {
  return client.tenantId === scope.tenantId;
}

export function normalizeVerificationScope(scope: unknown): LocalClientVerificationScope {
  if (!hasExactKeys(scope, ["tenantId", "subjectId"])) {
    throw createError(
      "local_client_verification_scope_required",
      "Verified local-client resolution requires tenantId and subjectId.",
      { statusCode: 401, category: "auth" },
    );
  }
  const tenantId = safeTrim(scope.tenantId);
  const subjectId = safeTrim(scope.subjectId);
  if (
    tenantId.length < 1
    || tenantId.length > 128
    || subjectId.length < 1
    || subjectId.length > 128
    || /[\u0000-\u001f\u007f]/u.test(tenantId)
    || /[\u0000-\u001f\u007f]/u.test(subjectId)
  ) {
    throw createError(
      "local_client_verification_scope_required",
      "Verified local-client resolution requires tenantId and subjectId.",
      { statusCode: 401, category: "auth" },
    );
  }
  return Object.freeze({ tenantId, subjectId });
}

export function toDeclaredVerificationProjection(
  client: StoredLocalClient,
): LocalClientVerificationDeclaration | null {
  if (
    client.enabled !== true
    || client.verificationStatus !== "declared"
    || normalizeStoredIdentifier(client.clientId) === null
    || client.adapterId === null
    || client.adapterType === null
    || normalizeStoredIdentifier(client.adapterType) === null
    || client.adapterVersion === null
    || client.manifestSha256 === null
    || isFakeAdapterReference(client.adapterId, client.adapterType)
    || client.capabilities.length < 1
    || client.capabilities.some((capability) => normalizeStoredIdentifier(capability) === null)
    || new Set(client.capabilities).size !== client.capabilities.length
  ) {
    return null;
  }
  return Object.freeze({
    declarationVersion: LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION,
    tenantId: client.tenantId,
    clientId: client.clientId,
    revision: client.revision,
    state: "declared",
    enabled: true,
    adapter: Object.freeze({
      id: client.adapterId,
      type: client.adapterType,
      version: client.adapterVersion,
    }),
    manifestSha256: client.manifestSha256,
    capabilityIds: Object.freeze([...client.capabilities].sort()),
  });
}



export function descriptorSupportsClient(
  descriptor: LocalClientAdapterDescriptor | undefined,
  client: Pick<StoredLocalClient, "adapterId" | "adapterType" | "adapterVersion" | "capabilities">,
): descriptor is LocalClientAdapterDescriptor {
  if (
    !descriptor
    || client.adapterId === null
    || client.adapterType === null
    || client.adapterVersion === null
    || isFakeAdapterReference(client.adapterId, client.adapterType)
    || descriptor.id !== client.adapterId
    || descriptor.type !== client.adapterType
    || descriptor.version !== client.adapterVersion
  ) {
    return false;
  }
  const supportedCapabilities = new Set(descriptor.actions.map((action) => action.capabilityId));
  return client.capabilities.every((capability) => supportedCapabilities.has(capability));
}

export function toPublicClient(client: StoredLocalClient, nowTs = Date.now()): ManagedLocalClientSummary {
  const verified = isClientCurrentlyVerified(client, nowTs);
  const state = client.revokedAt !== null
    ? "revoked"
    : client.enabled === false
    ? "disabled"
    : verified
      ? "verified"
      : client.verificationStatus === "declared" || client.verificationStatus === "verified"
      ? "declared"
      : "observed";
  return {
    clientId: client.clientId,
    displayName: client.displayName,
    state,
    enabled: client.enabled,
    routable: client.routable,
    adapterId: client.adapterId,
    adapterType: client.adapterType,
    adapterVersion: client.adapterVersion,
    manifestSha256: client.manifestSha256,
    protocolVersion: client.protocolVersion,
    capabilityIds: client.capabilities,
    health: {
      status: client.health.status,
      latencyMs: client.health.latencyMs,
      lastSeenAt: client.lastSeenAt,
      leaseExpiresAt: verified && client.verification
        ? new Date(client.verification.expiresAtMs).toISOString()
        : null,
    },
    trustDecision: client.revokedAt !== null
      ? "rejected"
      : verified
      ? "verified"
      : client.verificationStatus === "declared" || client.verificationStatus === "verified"
        ? "declared"
        : "unverified",
    revision: client.revision,
  };
}

export function createDefaultRegistry(): LocalClientRegistry {
  return {
    version: REGISTRY_VERSION,
    generation: 0,
    updatedAt: now(),
    createdAt: now(),
    clients: [],
    integrity: null,
  };
}



