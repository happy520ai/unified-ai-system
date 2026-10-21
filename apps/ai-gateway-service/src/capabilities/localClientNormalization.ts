// Extracted verbatim from localClientManagementCore.ts so the normalize/input
// cluster and its transitive helper/const closure live beside the core
// module. The core imports these symbols back; the moved set depends only on
// the scoring primitives, the discovery module, the types file, and node
// builtins, so there is no runtime cycle. Pure mechanical move; behaviour
// unchanged.
import { SHA256_PATTERN, safeSha256Equal } from "./localClientRegistryIo.ts";
import type { StoredFeedbackAppliedEventMarker, StoredClientVerificationEvidence, StoredLocalClient, LocalClientInput, NormalizeClientOptions, LocalClientVerificationStatus, LocalClientRegisterInput, LocalClientScope, LocalClientDiscoverInput, LocalClientHeartbeatInput, LocalClientFeedbackInput, LocalClientFeedbackStatus, LocalClientRouteInput, NormalizedRouteRequest, LocalClientExecuteInput, LocalClientMaintenanceInput, LocalClientSmartManageInput, LocalClientDisableInput, LocalClientRevokeInput } from "./localClientManagementCore.types.ts";
import { isRecord, createError, toList, normalizeCapability, normalizeBoolean, parsePositiveInt, safeTrimOrNull, createStableClientId, STABLE_ID_NAMESPACE, normalizeAbortSignal, inferTaskCapabilities, parseOptionalPositiveInt, normalizeSystemDiscoverInput, safeNumberOrNaN } from "./localClientDiscovery.ts";
import { LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION, fingerprintLocalClientVerificationDeclaration, LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION, type LocalClientVerificationEvidence } from "./localClientVerificationService.ts";
import { BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID, BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE } from "./localClientAdapterRegistry.ts";
import { safeTrim, now, safeNumber } from "./localClientScoring.ts";
import type { LocalClientHealthStatus } from "@unified-ai-system/shared-contracts";

export const LOCAL_CLIENT_IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;

export const LOCAL_CLIENT_SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;

export const MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT = 256;

export const MAX_VERIFICATION_EVIDENCE_TTL_MS = 24 * 60 * 60_000;

export const DEFAULT_STALE_RECONCILIATION_MULTIPLIER = 3;

export const DEFAULT_AUTO_RISK_RECOVERY_MAX_FAILURE_STREAK = 2;

export const DEFAULT_AUTO_RISK_RECOVERY_MIN_AGE_MS = 3 * 60_000;

export const DEFAULT_CRITICAL_HEALTH_SCORE = 22;

export const DEFAULT_RISK_DISABLE_FAILURE_STREAK = 4;

export function normalizeStoredIdentifier(value: unknown): string | null {
  return typeof value === "string" && LOCAL_CLIENT_IDENTIFIER_PATTERN.test(value) ? value : null;
}

export function normalizeStoredSemver(value: unknown): string | null {
  return typeof value === "string" && LOCAL_CLIENT_SEMVER_PATTERN.test(value) ? value : null;
}

export function normalizeStoredSha256(value: unknown): string | null {
  return typeof value === "string" && SHA256_PATTERN.test(value) ? value : null;
}

export function normalizeStoredIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

export function normalizeStoredRevocationReason(value: unknown): string | null {
  return typeof value === "string"
    && new Set(["manual_revoke", "credential_compromise", "identity_mismatch", "security_incident"]).has(value)
    ? value
    : null;
}

export function normalizeFeedbackAppliedEventMarkers(value: unknown): StoredFeedbackAppliedEventMarker[] {
  if (!Array.isArray(value)) return [];
  const normalized: StoredFeedbackAppliedEventMarker[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item)
      || Reflect.ownKeys(item).length !== 2
      || !Object.hasOwn(item, "eventFingerprint")
      || !Object.hasOwn(item, "admissionFingerprint")
    ) continue;
    const eventFingerprint = normalizeStoredSha256(item.eventFingerprint);
    const admissionFingerprint = normalizeStoredSha256(item.admissionFingerprint);
    if (eventFingerprint === null || admissionFingerprint === null) continue;
    const key = `${eventFingerprint}:${admissionFingerprint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ eventFingerprint, admissionFingerprint });
  }
  return normalized.slice(-MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT);
}

export function normalizeStoredVerificationEvidence(value: unknown): StoredClientVerificationEvidence | null {
  if (!isRecord(value)) return null;
  const expectedKeys = [
    "evidenceVersion",
    "fingerprint",
    "declarationFingerprint",
    "verifiedAtMs",
    "expiresAtMs",
  ];
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    || value.evidenceVersion !== LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION
    || normalizeStoredSha256(value.fingerprint) === null
    || normalizeStoredSha256(value.declarationFingerprint) === null
    || !Number.isSafeInteger(value.verifiedAtMs)
    || Number(value.verifiedAtMs) < 0
    || !Number.isSafeInteger(value.expiresAtMs)
    || Number(value.expiresAtMs) <= Number(value.verifiedAtMs)
  ) {
    return null;
  }
  return {
    evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
    fingerprint: String(value.fingerprint),
    declarationFingerprint: String(value.declarationFingerprint),
    verifiedAtMs: Number(value.verifiedAtMs),
    expiresAtMs: Number(value.expiresAtMs),
  };
}

export function isVerificationEvidenceFresh<T extends Pick<LocalClientVerificationEvidence, "verifiedAtMs" | "expiresAtMs">>(
  evidence: T | null,
  nowMs: number,
): evidence is T {
  return evidence !== null
    && Number.isSafeInteger(nowMs)
    && nowMs >= 0
    && evidence.verifiedAtMs <= nowMs
    && evidence.expiresAtMs > nowMs
    && evidence.expiresAtMs - evidence.verifiedAtMs <= MAX_VERIFICATION_EVIDENCE_TTL_MS;
}

export function isFakeAdapterReference(adapterId: string | null, adapterType: string | null): boolean {
  return adapterId === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID
    || adapterType === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE;
}

export function verifiedClientDeclarationFingerprint(client: StoredLocalClient): string | null {
  if (
    client.revision <= 1
    || normalizeStoredIdentifier(client.clientId) === null
    || client.adapterId === null
    || client.adapterType === null
    || client.adapterVersion === null
    || client.manifestSha256 === null
    || client.capabilities.length < 1
    || client.capabilities.some((capability) => normalizeStoredIdentifier(capability) === null)
    || new Set(client.capabilities).size !== client.capabilities.length
  ) {
    return null;
  }
  try {
    return fingerprintLocalClientVerificationDeclaration({
      declarationVersion: LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION,
      tenantId: client.tenantId,
      clientId: client.clientId,
      revision: client.revision - 1,
      state: "declared",
      enabled: true,
      adapter: {
        id: client.adapterId,
        type: client.adapterType,
        version: client.adapterVersion,
      },
      manifestSha256: client.manifestSha256,
      capabilityIds: [...client.capabilities].sort(),
    });
  } catch {
    return null;
  }
}

export function isClientCurrentlyVerified(client: StoredLocalClient, nowMs: number): boolean {
  const declarationFingerprint = verifiedClientDeclarationFingerprint(client);
  return client.revokedAt === null
    && client.enabled === true
    && client.verificationStatus === "verified"
    && client.adapterId !== null
    && client.adapterType !== null
    && normalizeStoredIdentifier(client.adapterType) !== null
    && client.adapterVersion !== null
    && client.manifestSha256 !== null
    && !isFakeAdapterReference(client.adapterId, client.adapterType)
    && isVerificationEvidenceFresh(client.verification, nowMs)
    && declarationFingerprint !== null
    && safeSha256Equal(client.verification.declarationFingerprint, declarationFingerprint);
}

export function parseOptionalDeclarationIdentifier(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = normalizeStoredIdentifier(value);
  if (normalized === null) {
    throw createError(
      "local_client_register_adapter_binding_invalid",
      `register ${field} is invalid.`,
    );
  }
  return normalized;
}

export function parseOptionalDeclarationSemver(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = normalizeStoredSemver(value);
  if (normalized === null) {
    throw createError(
      "local_client_register_adapter_binding_invalid",
      "register adapterVersion must be an exact semantic version.",
    );
  }
  return normalized;
}

export function parseOptionalDeclarationSha256(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = normalizeStoredSha256(value);
  if (normalized === null) {
    throw createError(
      "local_client_register_adapter_binding_invalid",
      "register manifestSha256 must be a lowercase SHA-256 digest.",
    );
  }
  return normalized;
}

export function createClientId(value: unknown): string {
  const id = safeTrim(value);
  if (id) return id;
  return `client_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function normalizeHealthStatus(value: unknown): LocalClientHealthStatus {
  const normalized = safeTrim(value, "unknown").toLowerCase();
  if (normalized === "healthy" || normalized === "degraded" || normalized === "unhealthy") return normalized;
  return "unknown";
}

export const SAFE_DIAGNOSTIC_CODES = new Set([
  "cancelled",
  "client_reported_error",
  "healthcheck_failed",
  "protocol_error",
  "rate_limited",
  "timeout",
  "unavailable",
  "unknown",
]);

export function normalizeDiagnosticCode(value: unknown, fallback: string): string;
export function normalizeDiagnosticCode(value: unknown, fallback?: null): string | null;
export function normalizeDiagnosticCode(value: unknown, fallback: string | null = null): string | null {
  const normalized = safeTrim(value).toLowerCase().replace(/[-\s]+/gu, "_");
  return SAFE_DIAGNOSTIC_CODES.has(normalized) ? normalized : fallback;
}

export function normalizeOperationId(value: unknown): string {
  const normalized = safeTrim(value);
  return /^[A-Za-z0-9._:-]{1,128}$/u.test(normalized) ? normalized : "";
}

export function safeNumberOrNull(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function normalizeClient(
  rawClient: LocalClientInput,
  nowTime: string,
  options: NormalizeClientOptions = {},
): StoredLocalClient {
  const clientId = createClientId(
    safeTrim(rawClient?.clientId ?? rawClient?.id ?? rawClient?.name),
  );
  const normalizedCapabilities = toList(rawClient?.capabilities ?? rawClient?.capabilityIds).map((item) => normalizeCapability(item)).filter(Boolean);
  const normalizedTags = toList(rawClient?.tags).map((item) => normalizeCapability(item)).filter(Boolean);
  const command = safeTrim(rawClient?.command);
  const executable = safeTrim(rawClient?.executable);
  const healthStatus = normalizeHealthStatus(rawClient?.healthStatus ?? rawClient?.health?.status);
  const lastSeenAt = safeTrim(rawClient?.lastSeenAt, nowTime);
  const discoveredAt = safeTrim(rawClient?.discoveredAt, nowTime);
  const revokedAt = options.preserveRevocation === true
    ? normalizeStoredIsoTimestamp(rawClient?.revokedAt)
    : null;
  const revokedReason = revokedAt === null
    ? null
    : normalizeStoredRevocationReason(rawClient?.revokedReason) ?? "manual_revoke";
  const enabled = revokedAt === null && rawClient?.enabled !== false;
  const preferred = normalizeBoolean(rawClient?.preferred, false);
  const priority = parsePositiveInt(rawClient?.priority, 50, 0, 100);
  const tenantId = safeTrim(options.tenantId ?? rawClient?.tenantId, "__unscoped__");
  const adapterId = normalizeStoredIdentifier(rawClient?.adapterId);
  const adapterType = safeTrimOrNull(rawClient?.adapterType);
  const adapterVersion = normalizeStoredSemver(rawClient?.adapterVersion);
  const manifestSha256 = normalizeStoredSha256(rawClient?.manifestSha256);
  const storedVerification = normalizeStoredVerificationEvidence(rawClient?.verification);
  const requestedVerificationStatus = safeTrim(
    options.verificationStatus ?? rawClient?.verificationStatus,
    "unverified",
  ).toLowerCase();
  const verifiedStorageState = requestedVerificationStatus === "verified"
    && enabled
    && adapterId !== null
    && adapterType !== null
    && normalizeStoredIdentifier(adapterType) !== null
    && adapterVersion !== null
    && manifestSha256 !== null
    && !isFakeAdapterReference(adapterId, adapterType)
    && isVerificationEvidenceFresh(storedVerification, Date.now());
  const verificationStatus: LocalClientVerificationStatus = verifiedStorageState
    ? "verified"
    : requestedVerificationStatus === "declared" || requestedVerificationStatus === "verified"
      ? "declared"
      : "unverified";
  const routable = verificationStatus !== "unverified"
    && normalizeBoolean(options.routable ?? rawClient?.routable, false);
  const trustLevel = verificationStatus === "unverified"
    ? "low"
    : verificationStatus === "verified"
      ? "verified"
    : safeTrim(options.trustLevel ?? rawClient?.trustLevel, "medium");

  const normalizedClient: StoredLocalClient = {
    tenantId,
    clientId,
    stableKey: safeTrimOrNull(rawClient?.stableKey) || createStableClientId(STABLE_ID_NAMESPACE, clientId),
    name: safeTrim(rawClient?.name, clientId),
    displayName: safeTrim(rawClient?.displayName, safeTrim(rawClient?.name, clientId)),
    description: safeTrim(rawClient?.description),
    adapterId,
    adapterType,
    adapterVersion,
    manifestSha256,
    protocolVersion: safeTrimOrNull(rawClient?.protocolVersion),
    executable: executable || null,
    command: command || null,
    platform: safeTrim(rawClient?.platform, "unknown"),
    endpoints: {
      primary: rawClient?.endpoint ? safeTrim(rawClient.endpoint) : safeTrim(rawClient?.endpoints?.primary),
      api: safeTrim(rawClient?.apiEndpoint ?? rawClient?.endpoints?.api),
      ws: safeTrim(rawClient?.wsEndpoint ?? rawClient?.endpoints?.ws),
    },
    capabilities: normalizedCapabilities,
    tags: normalizedTags,
    metadata: typeof rawClient?.metadata === "object" && rawClient?.metadata ? rawClient.metadata : {},
    revokedAt,
    revokedReason,
    feedbackAppliedEventMarkers: options.preserveFeedbackAppliedEventMarkers === true
      ? normalizeFeedbackAppliedEventMarkers(rawClient?.feedbackAppliedEventMarkers)
      : [],
    health: {
      status: healthStatus,
      latencyMs: safeNumber(rawClient?.healthLatencyMs ?? rawClient?.health?.latencyMs ?? rawClient?.health?.responseMs, null),
      lastError: safeTrim(rawClient?.health?.lastError),
      updatedAt: safeTrim(rawClient?.health?.updatedAt, nowTime),
    },
    verificationStatus,
    verification: verificationStatus === "verified" ? storedVerification : null,
    routable,
    trustLevel,
    load: {
      cpu: safeNumber(rawClient?.load?.cpu),
      memory: safeNumber(rawClient?.load?.memory),
      queueDepth: safeNumber(rawClient?.load?.queueDepth),
    },
    stats: {
      attempts: safeNumber(rawClient?.stats?.attempts, 0),
      successes: safeNumber(rawClient?.stats?.successes, 0),
      failures: safeNumber(rawClient?.stats?.failures, 0),
      ewmaSuccessRate: safeNumberOrNull(rawClient?.stats?.ewmaSuccessRate),
      failureStreak: safeNumber(rawClient?.stats?.failureStreak, 0),
      avgLatencyMs: safeNumberOrNull(rawClient?.stats?.avgLatencyMs, null),
      lastFeedbackAt: safeTrim(rawClient?.stats?.lastFeedbackAt, nowTime),
      lastTaskCapabilities: toList(rawClient?.stats?.lastTaskCapabilities)
        .map(normalizeCapability)
        .slice(0, 64),
      lastFailureAt: safeTrimOrNull(rawClient?.stats?.lastFailureAt),
      lastFailureMessage: safeTrimOrNull(rawClient?.stats?.lastFailureMessage),
    },
    priority,
    revision: parsePositiveInt(rawClient?.revision, 1, 1, Number.MAX_SAFE_INTEGER),
    enabled,
    preferred,
    discoveredAt,
    lastSeenAt,
    updatedAt: nowTime,
  };
  if (
    normalizedClient.verificationStatus === "verified"
    && !isClientCurrentlyVerified(normalizedClient, Date.now())
  ) {
    normalizedClient.verificationStatus = "declared";
    normalizedClient.verification = null;
    normalizedClient.trustLevel = "medium";
  }
  return normalizedClient;
}

export function normalizeRegisterInput(
  input: LocalClientRegisterInput | null | undefined,
  scope: LocalClientScope,
): StoredLocalClient {
  if (!input || typeof input !== "object") {
    throw createError("local_client_invalid_payload", "register input must be an object.");
  }
  const clientId = safeTrim(input.clientId ?? input.id);
  if (!clientId) {
    throw createError("local_client_register_client_missing", "register requires clientId.");
  }
  const capabilityIds = toList(input.capabilityIds ?? input.capabilities).map(normalizeCapability).filter(Boolean);
  if (capabilityIds.length === 0) {
    throw createError("local_client_register_capabilities_missing", "register requires at least one capabilityId.");
  }
  const adapterId = parseOptionalDeclarationIdentifier(input.adapterId, "adapterId");
  const exactBindingRequested = adapterId !== null
    || input.adapterVersion !== undefined
    || input.manifestSha256 !== undefined;
  const adapterType = exactBindingRequested
    ? parseOptionalDeclarationIdentifier(input.adapterType, "adapterType")
    : safeTrimOrNull(input.adapterType);
  const adapterVersion = parseOptionalDeclarationSemver(input.adapterVersion);
  const manifestSha256 = parseOptionalDeclarationSha256(input.manifestSha256);
  if (
    [adapterId, adapterVersion, manifestSha256].some((value) => value !== null)
    && [adapterId, adapterType, adapterVersion, manifestSha256].some((value) => value === null)
  ) {
    throw createError(
      "local_client_register_adapter_binding_incomplete",
      "A verifiable declaration requires adapterId, adapterType, adapterVersion, and manifestSha256 together.",
    );
  }
  const descriptor = {
    clientId,
    name: safeTrim(input.name, clientId),
    displayName: safeTrim(input.displayName, safeTrim(input.name, clientId)),
    description: safeTrim(input.description),
    adapterId,
    adapterType,
    adapterVersion,
    manifestSha256,
    protocolVersion: safeTrimOrNull(input.protocolVersion),
    capabilityIds,
    enabled: true,
    preferred: false,
    priority: 50,
    trustLevel: "medium",
    healthStatus: "unknown",
  };
  return normalizeClient(descriptor, now(), {
    tenantId: scope.tenantId,
    verificationStatus: "declared",
    routable: true,
  });
}

export function normalizeDiscoverInput(
  input: LocalClientDiscoverInput | null | undefined,
  scope: LocalClientScope,
) {
  if (!input || typeof input !== "object") {
    throw createError("local_client_invalid_payload", "discover input must be an object.");
  }
  if (!Array.isArray(input.clients)) {
    throw createError("local_client_discover_clients_missing", "discover input must include a clients array.");
  }
  const source = safeTrim(input.source, "local-discover");
  return {
    source,
    clients: input.clients.map((item) => {
      const client = normalizeClient(isRecord(item) ? item as LocalClientInput : {}, now(), {
        tenantId: scope.tenantId,
        verificationStatus: "unverified",
        routable: false,
        trustLevel: "low",
      });
      return {
        ...client,
        metadata: {
          ...client.metadata,
          discoverSource: source,
        },
      };
    }),
    includeMissingAsDisabled: normalizeBoolean(input.includeMissingAsDisabled, false),
    strategy: safeTrim(input.strategy, "upsert"),
    signal: normalizeAbortSignal(input.signal),
  };
}


export function normalizeHeartbeatInput(input: LocalClientHeartbeatInput | null | undefined) {
  if (!input || typeof input !== "object") {
    throw createError("local_client_heartbeat_invalid_payload", "heartbeat input must be an object.");
  }
  const clientId = safeTrim(input.clientId ?? input.id);
  if (!clientId) {
    throw createError("local_client_heartbeat_client_missing", "heartbeat requires clientId.");
  }
  return {
    clientId,
    upsert: normalizeBoolean(input.upsert, false),
    healthStatus: normalizeHealthStatus(input.healthStatus ?? input.health?.status),
    latencyMs: safeNumberOrNull(input.latencyMs, null),
    cpu: safeNumberOrNull(input.cpu, null),
    memory: safeNumberOrNull(input.memory, null),
    queueDepth: safeNumberOrNull(input.queueDepth, null),
    lastError: input.lastError == null
      ? null
      : normalizeDiagnosticCode(input.errorCode ?? input.lastError, "client_reported_error"),
    capabilities: toList(input.capabilities).map(normalizeCapability),
    preferred: input.preferred,
    tags: toList(input.tags).map(normalizeCapability),
  };
}

export function normalizeFeedbackInput(input: LocalClientFeedbackInput | null | undefined) {
  if (!input || typeof input !== "object") {
    throw createError("local_client_feedback_invalid_payload", "feedback input must be an object.");
  }
  const clientId = safeTrim(input.clientId ?? input.id);
  if (!clientId) {
    throw createError("local_client_feedback_client_missing", "feedback requires clientId.");
  }
  const status = safeTrim(input.status, "success").toLowerCase();
  if (status !== "success" && status !== "failure" && status !== "error" && status !== "timeout") {
    throw createError("local_client_feedback_status_invalid", "feedback status must be one of success, failure, error, timeout.");
  }
  return {
    eventId: normalizeOperationId(input.eventId),
    clientId,
    taskId: normalizeOperationId(input.taskId),
    status: status as LocalClientFeedbackStatus,
    latencyMs: safeNumberOrNull(input.latencyMs),
    error: input.error == null
      ? null
      : normalizeDiagnosticCode(input.errorCode ?? input.error, "client_reported_error"),
    requiredCapabilities: [...new Set(toList(input.requiredCapabilities).map(normalizeCapability))],
    observedAt: normalizeFeedbackObservedAt(input.observedAt),
  };
}

type NormalizedFeedbackRequest = ReturnType<typeof normalizeFeedbackInput>;
export type DurableNormalizedFeedbackRequest = Omit<
  NormalizedFeedbackRequest,
  "eventId" | "taskId" | "latencyMs" | "observedAt"
> & Readonly<{
  eventId: string;
  taskId: string;
  latencyMs: number;
  observedAt: string;
}>;

export function assertDurableFeedbackRequest(
  request: NormalizedFeedbackRequest,
): asserts request is DurableNormalizedFeedbackRequest {
  if (!request.eventId) {
    throw createError(
      "local_client_feedback_event_id_required",
      "Durable feedback requires a stable eventId.",
    );
  }
  if (!request.taskId) {
    throw createError(
      "local_client_feedback_task_id_required",
      "Durable feedback requires a stable taskId.",
    );
  }
  if (
    request.latencyMs === null
    || !Number.isSafeInteger(request.latencyMs)
    || request.latencyMs < 0
    || request.latencyMs > 24 * 60 * 60_000
  ) {
    throw createError(
      "local_client_feedback_latency_invalid",
      "Durable feedback requires an integer latencyMs between 0 and 86400000.",
    );
  }
  if (request.observedAt === null) {
    throw createError(
      "local_client_feedback_observed_at_required",
      "Durable feedback requires a canonical ISO observedAt timestamp.",
    );
  }
  if (request.requiredCapabilities.length > 64) {
    throw createError(
      "local_client_feedback_capabilities_invalid",
      "Durable feedback accepts at most 64 distinct capabilities.",
    );
  }
}

export function normalizeFeedbackObservedAt(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64 || value !== value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const canonical = new Date(parsed).toISOString();
  return canonical === value ? canonical : null;
}

export function normalizeRouteRequest(input: LocalClientRouteInput | null | undefined): NormalizedRouteRequest {
  if (!input || typeof input !== "object") {
    return {
      taskText: "",
      requiredCapabilities: [],
      capabilitySource: "none",
      preferredClientId: null,
      includeDisabled: false,
      maxCandidates: 3,
      requestContext: "local-management",
    };
  }
  const requiredCapabilities = toList(input.requiredCapabilities).map(normalizeCapability);
  const inferredCapabilities = requiredCapabilities.length === 0
    ? inferTaskCapabilities(input.taskText ?? input.task ?? input.description)
    : [];
  return {
    taskText: safeTrim(input.taskText ?? input.task ?? input.description),
    requiredCapabilities: requiredCapabilities.length ? requiredCapabilities : inferredCapabilities,
    capabilitySource: requiredCapabilities.length ? "explicit" : (inferredCapabilities.length ? "inferred" : "none"),
    preferredClientId: safeTrim(input.preferredClientId),
    includeDisabled: normalizeBoolean(input.includeDisabled, false),
    maxCandidates: Math.max(1, Math.min(20, parsePositiveInt(input.maxCandidates, 3, 1, 20))),
    requestContext: safeTrim(input.requestContext, "local-management"),
  };
}

export function normalizeExecuteInput(input: LocalClientExecuteInput | null | undefined) {
  if (!input || typeof input !== "object") {
    throw createError("local_client_execute_invalid_payload", "execute input must be an object.");
  }
  return {
    action: safeTrim(input.action, "invoke"),
    taskText: safeTrim(input.taskText ?? input.task ?? ""),
    requiredCapabilities: toList(input.requiredCapabilities).map(normalizeCapability),
    preferredClientId: safeTrim(input.preferredClientId),
    clientId: safeTrim(input.clientId),
    dryRun: normalizeBoolean(input.dryRun, true),
    allowPartialExecution: normalizeBoolean(input.allowPartialExecution, false),
    timeoutMs: parsePositiveInt(input.timeoutMs, 30_000, 1_000, 120_000),
    arguments: typeof input.arguments === "object" && input.arguments !== null ? input.arguments : {},
  };
}

export function normalizeMaintenanceInput(input: LocalClientMaintenanceInput | null | undefined) {
  if (!input || typeof input !== "object") {
    return {
      dryRun: true,
      staleMultiplier: DEFAULT_STALE_RECONCILIATION_MULTIPLIER,
      staleAction: "disable",
      riskAction: "none",
      criticalHealthScore: DEFAULT_CRITICAL_HEALTH_SCORE,
      riskDisableFailureStreak: DEFAULT_RISK_DISABLE_FAILURE_STREAK,
      autoRiskRecover: true,
      includeEnabledOnly: true,
      includeDisabled: false,
      autoRiskRecoveryFailureThreshold: DEFAULT_AUTO_RISK_RECOVERY_MAX_FAILURE_STREAK,
      autoRiskRecoveryMinAgeMs: DEFAULT_AUTO_RISK_RECOVERY_MIN_AGE_MS,
      limit: 200,
      maxCandidates: 50,
      signal: undefined,
    };
  }
  const staleAction = safeTrim(input.staleAction, "disable").toLowerCase();
  const riskAction = safeTrim(input.riskAction, "none").toLowerCase();
  const requestedRiskAction = riskAction === "disable" ? "disable" : riskAction === "mark" ? "mark" : "none";
  const includeDisabled = normalizeBoolean(input.includeDisabled, false);
  return {
    dryRun: normalizeBoolean(input.dryRun, true),
    staleMultiplier: Math.max(1, Math.min(24, parseOptionalPositiveInt(input.staleMultiplier, DEFAULT_STALE_RECONCILIATION_MULTIPLIER, 1, 24))),
    staleAction: staleAction === "disable" ? "disable" : staleAction === "mark" ? "mark" : "disable",
    riskAction: requestedRiskAction,
    criticalHealthScore: Math.max(1, Math.min(100, parseOptionalPositiveInt(input.criticalHealthScore, DEFAULT_CRITICAL_HEALTH_SCORE, 1, 100))),
    riskDisableFailureStreak: Math.max(1, Math.min(20, parsePositiveInt(input.riskDisableFailureStreak, DEFAULT_RISK_DISABLE_FAILURE_STREAK, 1, 20))),
    autoRiskRecover: normalizeBoolean(input.autoRiskRecover, true),
    includeEnabledOnly: normalizeBoolean(
      input.includeEnabledOnly,
      true,
    ),
    includeDisabled,
    autoRiskRecoveryFailureThreshold: parsePositiveInt(input.autoRiskRecoveryFailureThreshold, DEFAULT_AUTO_RISK_RECOVERY_MAX_FAILURE_STREAK, 1, 10),
    autoRiskRecoveryMinAgeMs: parsePositiveInt(input.autoRiskRecoveryMinAgeMs, DEFAULT_AUTO_RISK_RECOVERY_MIN_AGE_MS, 30_000, 24 * 60 * 60_000),
    limit: Math.max(1, Math.min(200, parsePositiveInt(input.limit, 200, 1, 500))),
    maxCandidates: Math.max(1, Math.min(50, parsePositiveInt(input.maxCandidates, 50, 1, 200))),
    signal: normalizeAbortSignal(input.signal),
  };
}

export function normalizeSmartManageInput(input: LocalClientSmartManageInput | null | undefined) {
  const fallbackDiscoverInput = {
    autoDiscoverAll: true,
    includeUnknown: true,
    includeMissingAsDisabled: true,
  };
  const fallbackMaintenanceInput = {
    staleMultiplier: DEFAULT_STALE_RECONCILIATION_MULTIPLIER,
    staleAction: "disable",
    autoRiskRecover: true,
    includeEnabledOnly: true,
  };
  if (!input || typeof input !== "object") {
    return {
      dryRun: true,
      discover: normalizeSystemDiscoverInput({
        ...fallbackDiscoverInput,
        dryRun: true,
      }),
      maintenance: normalizeMaintenanceInput({
        ...fallbackMaintenanceInput,
        dryRun: true,
      }),
      includeDiscoveryOnly: false,
      includeRegistrySnapshot: false,
      maxRecommendations: 10,
      signal: undefined,
    };
  }
  const discoverInput = input.discover ?? input.discovery ?? {};
  const maintenanceInput = input.maintenance ?? {};
  const dryRun = normalizeBoolean(input.dryRun, true);
  return {
    dryRun,
    discover: normalizeSystemDiscoverInput({
      ...fallbackDiscoverInput,
      ...discoverInput,
      dryRun,
      source: safeTrim(discoverInput.source, "local-management-cycle"),
      autoDiscoverAll: normalizeBoolean(discoverInput.autoDiscoverAll, true),
      includeUnknown: discoverInput.autoDiscoverAll ? true : normalizeBoolean(discoverInput.includeUnknown, true),
      includeMissingAsDisabled: normalizeBoolean(discoverInput.includeMissingAsDisabled, true),
      signal: normalizeAbortSignal(input.signal),
    }),
    maintenance: normalizeMaintenanceInput({
      ...fallbackMaintenanceInput,
      ...maintenanceInput,
      dryRun,
      signal: normalizeAbortSignal(input.signal),
    }),
    includeDiscoveryOnly: normalizeBoolean(input.includeDiscoveryOnly, false),
    includeRegistrySnapshot: normalizeBoolean(input.includeRegistrySnapshot, false),
    maxRecommendations: Math.max(1, Math.min(30, parsePositiveInt(input.maxRecommendations, 10, 1, 30))),
    signal: normalizeAbortSignal(input.signal),
  };
}

export function normalizeDisableInput(input: LocalClientDisableInput | null | undefined) {
  if (!input || typeof input !== "object") {
    throw createError("local_client_disable_invalid_payload", "disable input must be an object.");
  }
  const clientId = safeTrim(input.clientId ?? input.id);
  if (!clientId) {
    throw createError("local_client_disable_client_missing", "disable requires clientId.");
  }
  const requestedReason = safeTrim(input.reason, "manual_disable").toLowerCase().replace(/[-\s]+/gu, "_");
  const reason = new Set(["manual_disable", "maintenance", "security_review"])
    .has(requestedReason)
    ? requestedReason
    : "manual_disable";
  return {
    clientId,
    reason,
    dryRun: normalizeBoolean(input.dryRun, false),
    includeHealthReset: normalizeBoolean(input.includeHealthReset, true),
  };
}

export function normalizeRevokeInput(input: LocalClientRevokeInput | null | undefined) {
  if (!input || typeof input !== "object") {
    throw createError("local_client_revoke_invalid_payload", "revoke input must be an object.");
  }
  const clientId = safeTrim(input.clientId ?? input.id);
  if (!clientId) {
    throw createError("local_client_revoke_client_missing", "revoke requires clientId.");
  }
  const expectedRevision = Number(input.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
    throw createError(
      "local_client_revoke_revision_required",
      "revoke requires the exact current expectedRevision.",
    );
  }
  const requestedReason = safeTrim(input.reason, "manual_revoke")
    .toLowerCase()
    .replace(/[-\s]+/gu, "_");
  const reason = new Set([
    "manual_revoke",
    "credential_compromise",
    "identity_mismatch",
    "security_incident",
  ]).has(requestedReason)
    ? requestedReason
    : "manual_revoke";
  return Object.freeze({
    clientId,
    expectedRevision,
    reason,
    dryRun: normalizeBoolean(input.dryRun, false),
  });
}


export function clampStatsAverage(previousAverage: number, previousCount: number, latestValue: number): number {
  if (!Number.isFinite(previousAverage)) {
    return latestValue;
  }
  const count = Math.max(1, previousCount);
  return Math.round((((previousAverage * count) + latestValue) / (count + 1)) * 100) / 100;
}

export function mergeHeartbeatLoad(target: StoredLocalClient, request: ReturnType<typeof normalizeHeartbeatInput>): void {
  if (request.cpu !== null) target.load.cpu = safeNumberOrNaN(request.cpu);
  if (request.memory !== null) target.load.memory = safeNumberOrNaN(request.memory);
  if (request.queueDepth !== null) target.load.queueDepth = safeNumberOrNaN(request.queueDepth);
}

export function mergeHeartbeatCapabilities(target: StoredLocalClient, request: ReturnType<typeof normalizeHeartbeatInput>): void {
  if (request.capabilities.length === 0) return;
  target.capabilities = Array.from(new Set([...target.capabilities, ...request.capabilities]));
}

export function mergeHeartbeatTags(target: StoredLocalClient, request: ReturnType<typeof normalizeHeartbeatInput>): void {
  if (request.tags.length === 0) return;
  target.tags = Array.from(new Set([...target.tags, ...request.tags]));
}
