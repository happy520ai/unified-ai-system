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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "../..");
export const DEFAULT_REGISTRY_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "registry.json");
export const DEFAULT_EXECUTION_LOG_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "execution-log.jsonl");
export const DEFAULT_DISCOVERY_HINTS_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "discovery-hints.json");
export const REGISTRY_VERSION = "local-client-management-registry-v1";
export const REGISTRY_INTEGRITY_VERSION = "local-client-registry-integrity-v1" as const;
export const SERVICE_PHASE = "phase-local-client-management-v1";
const LOCAL_CLIENT_IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const LOCAL_CLIENT_SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
export const MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT = 256;
const MAX_VERIFICATION_EVIDENCE_TTL_MS = 24 * 60 * 60_000;
export const MAX_REGISTRY_FILE_BYTES = 16 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const WINDOWS_TASKLIST_MAX_ROWS = 4000;
const WINDOWS_TASKLIST_TIMEOUT_MS = 20_000;
const ADAPTIVE_RELIABILITY_ALPHA = 0.35;
const ADAPTIVE_RELIABILITY_INITIAL = 0.7;
const DEFAULT_UNKNOWN_TASK_CAPABILITIES = ["local_application"];
const FALLBACK_UNKNOWN_CAPABILITIES = ["local-process-control", "local-application"];
const AUTO_RISK_PENALTY = 20;
const DEFAULT_STALE_RECONCILIATION_MULTIPLIER = 3;
const DEFAULT_AUTO_RISK_RECOVERY_MAX_FAILURE_STREAK = 2;
const DEFAULT_AUTO_RISK_RECOVERY_MIN_AGE_MS = 3 * 60_000;
const DEFAULT_CRITICAL_HEALTH_SCORE = 22;
const DEFAULT_RISK_DISABLE_FAILURE_STREAK = 4;
const DISPATCHER_PROCESS_KEYWORDS = Object.freeze(new Set([
  "system",
  "system idle process",
  "secure system",
  "registry",
  "memory compression",
  "svchost",
  "csrss",
  "smss",
  "wininit",
  "winlogon",
  "fontdrvhost",
  "spoolsv",
  "ctfmon",
  "dwm",
  "lsass",
  "services",
  "runtimebroker",
  "sihost",
  "search",
  "rundll32",
  "conhost",
  "taskhostw",
  "backgroundtaskhost",
  "shellexperiencehost",
  "startmenuexperiencehost",
  "textinputhost",
  "lockapp",
  "wudfhost",
  "wmiprvse",
  "dllhost",
  "explorer",
]));
const STABLE_ID_NAMESPACE = "localclient";
const BUILTIN_DISCOVERY_HINTS: DiscoveryHintInput[] = [
  {
    processName: "chrome",
    capabilities: ["browser", "web_automation", "communication"],
    tags: ["browser", "discovered"],
    priority: 65,
    trustLevel: "high",
    displayName: "Chrome",
  },
  {
    processName: "msedge",
    capabilities: ["browser", "web_automation", "communication"],
    tags: ["browser", "discovered"],
    priority: 64,
    trustLevel: "high",
    displayName: "Microsoft Edge",
  },
  {
    processName: "firefox",
    capabilities: ["browser", "web_automation", "communication"],
    tags: ["browser", "discovered"],
    priority: 62,
    trustLevel: "high",
    displayName: "Firefox",
  },
  {
    processName: "code",
    capabilities: ["editor", "ide", "local_workflow", "file_operation", "terminal"],
    tags: ["editor", "discovered"],
    priority: 78,
    trustLevel: "high",
    displayName: "Visual Studio Code",
  },
  {
    processName: "idea64",
    capabilities: ["editor", "ide", "local_workflow", "file_operation"],
    tags: ["editor", "discovered"],
    priority: 76,
    trustLevel: "high",
    displayName: "IntelliJ IDEA",
  },
  {
    processName: "wechat",
    capabilities: ["chat", "communication", "notifications"],
    tags: ["chat", "discovered"],
    priority: 70,
    trustLevel: "medium",
    displayName: "WeChat",
  },
  {
    processName: "teams",
    capabilities: ["chat", "collaboration", "meeting"],
    tags: ["chat", "discovered"],
    priority: 68,
    trustLevel: "medium",
    displayName: "Microsoft Teams",
  },
  {
    processName: "slack",
    capabilities: ["chat", "communication", "collaboration"],
    tags: ["chat", "discovered"],
    priority: 69,
    trustLevel: "medium",
    displayName: "Slack",
  },
  {
    processName: "terminal",
    capabilities: ["terminal", "automation", "scripting"],
    tags: ["terminal", "discovered"],
    priority: 72,
    trustLevel: "high",
    displayName: "Terminal",
  },
  {
    processName: "powershell",
    capabilities: ["terminal", "automation", "scripting"],
    tags: ["terminal", "discovered"],
    priority: 70,
    trustLevel: "medium",
    displayName: "PowerShell",
  },
];

export function now(): string {
  return new Date().toISOString();
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeNumber(value: unknown, fallback: null): number | null;
export function safeNumber(value: unknown, fallback?: number): number;
export function safeNumber(value: unknown, fallback: number | null = 0): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeTrim(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeTaskText(value: unknown): string {
  const text = safeTrim(value);
  return text.toLowerCase();
}

function safeTrimOrNull(value: unknown): string | null {
  const trimmed = safeTrim(value, "");
  return trimmed || null;
}

export function normalizeStoredIdentifier(value: unknown): string | null {
  return typeof value === "string" && LOCAL_CLIENT_IDENTIFIER_PATTERN.test(value) ? value : null;
}

function normalizeStoredSemver(value: unknown): string | null {
  return typeof value === "string" && LOCAL_CLIENT_SEMVER_PATTERN.test(value) ? value : null;
}

function normalizeStoredSha256(value: unknown): string | null {
  return typeof value === "string" && SHA256_PATTERN.test(value) ? value : null;
}

function normalizeStoredIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const canonical = new Date(timestamp).toISOString();
  return canonical === value ? canonical : null;
}

function normalizeStoredRevocationReason(value: unknown): string | null {
  return typeof value === "string"
    && new Set(["manual_revoke", "credential_compromise", "identity_mismatch", "security_incident"]).has(value)
    ? value
    : null;
}

function normalizeFeedbackAppliedEventMarkers(value: unknown): StoredFeedbackAppliedEventMarker[] {
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

function normalizeStoredVerificationEvidence(value: unknown): StoredClientVerificationEvidence | null {
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

function isFakeAdapterReference(adapterId: string | null, adapterType: string | null): boolean {
  return adapterId === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID
    || adapterType === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE;
}

function verifiedClientDeclarationFingerprint(client: StoredLocalClient): string | null {
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

function parseOptionalDeclarationIdentifier(value: unknown, field: string): string | null {
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

function parseOptionalDeclarationSemver(value: unknown): string | null {
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

function parseOptionalDeclarationSha256(value: unknown): string | null {
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

export function toList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const next: string[] = [];
  for (const item of value) {
    const text = safeTrim(item);
    if (text) next.push(text.toLowerCase());
  }
  return Array.from(new Set(next));
}

function createClientId(value: unknown): string {
  const id = safeTrim(value);
  if (id) return id;
  return `client_${Math.random().toString(16).slice(2, 10)}_${Date.now().toString(36)}`;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createStableClientId(namespace: string, value: unknown): string {
  const normalized = safeTrim(value, "client").toLowerCase();
  const hash = stableHash(`${namespace}:${normalized}`);
  const safe = normalized.replace(/[^a-z0-9._-]+/gu, "_").replace(/_+/gu, "_").replace(/^_|_$/gu, "");
  return `client_${safe || "unknown"}_${hash}`;
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
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

export function normalizeCapability(value: unknown): string {
  return safeTrim(value, "")
    .toLowerCase()
    .replace(/[-\s]+/gu, "_");
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

function normalizeHealthStatus(value: unknown): LocalClientHealthStatus {
  const normalized = safeTrim(value, "unknown").toLowerCase();
  if (normalized === "healthy" || normalized === "degraded" || normalized === "unhealthy") return normalized;
  return "unknown";
}

const SAFE_DIAGNOSTIC_CODES = new Set([
  "cancelled",
  "client_reported_error",
  "healthcheck_failed",
  "protocol_error",
  "rate_limited",
  "timeout",
  "unavailable",
  "unknown",
]);

function normalizeDiagnosticCode(value: unknown, fallback: string): string;
function normalizeDiagnosticCode(value: unknown, fallback?: null): string | null;
function normalizeDiagnosticCode(value: unknown, fallback: string | null = null): string | null {
  const normalized = safeTrim(value).toLowerCase().replace(/[-\s]+/gu, "_");
  return SAFE_DIAGNOSTIC_CODES.has(normalized) ? normalized : fallback;
}

function normalizeOperationId(value: unknown): string {
  const normalized = safeTrim(value);
  return /^[A-Za-z0-9._:-]{1,128}$/u.test(normalized) ? normalized : "";
}

function normalizeAbortSignal(value: unknown): AbortSignal | undefined {
  if (value === undefined) return undefined;
  if (!(value instanceof AbortSignal)) {
    throw createError(
      "local_client_abort_signal_invalid",
      "The internal local-client cancellation signal is invalid.",
      { statusCode: 400, category: "validation" },
    );
  }
  return value;
}

export function throwIfLocalClientAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw createError(
    "local_client_operation_aborted",
    "The local-client management operation was cancelled.",
    { statusCode: 499, category: "cancellation" },
  );
}

export function parsePositiveInt(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function parseOptionalPositiveInt(value: unknown, fallback: null, minimum?: number, maximum?: number): number | null;
function parseOptionalPositiveInt(value: unknown, fallback: number, minimum?: number, maximum?: number): number;
function parseOptionalPositiveInt(
  value: unknown,
  fallback: number | null,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function safeNumberOrNull(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true, () => false);
}

export function createError(code: string, message: string, options: LocalClientErrorOptions = {}): LocalClientServiceError {
  const error = new Error(message) as LocalClientServiceError;
  error.code = code;
  error.statusCode = options.statusCode ?? 422;
  error.category = options.category ?? "validation";
  if (options.details) {
    error.details = options.details;
  }
  return error;
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

export function hasExactKeys(value: unknown, expected: readonly string[]): value is UnknownRecord {
  if (!isRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length
    && keys.every((key) => typeof key === "string" && expected.includes(key))
    && expected.every((key) => Object.hasOwn(value, key));
}

export function safeSha256Equal(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !SHA256_PATTERN.test(left)
    || !SHA256_PATTERN.test(right)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
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

export function normalizeSystemDiscoverInput(input: LocalClientSystemDiscoverInput | null | undefined) {
  if (!input || typeof input !== "object") {
    return {
      source: "local-process-scan",
      maxProcesses: 200,
      includeUnknown: false,
      includeSystemProcesses: false,
      dryRun: false,
      includeDisabled: false,
      includeMissingAsDisabled: false,
      autoDiscoverAll: false,
      signal: undefined,
    };
  }
  const includeDisabled = normalizeBoolean(input.includeDisabled, false);
  const autoDiscoverAll = normalizeBoolean(input.autoDiscoverAll, false);
  const effectiveMaxProcesses = autoDiscoverAll ? WINDOWS_TASKLIST_MAX_ROWS : 200;
  const includeMissingAsDisabled = normalizeBoolean(
    input.includeMissingAsDisabled,
    includeDisabled || autoDiscoverAll,
  );
  return {
    source: safeTrim(input.source, "local-process-scan"),
    maxProcesses: parseOptionalPositiveInt(input.maxProcesses, effectiveMaxProcesses, 1, 10_000),
    includeUnknown: autoDiscoverAll ? true : normalizeBoolean(input.includeUnknown, false),
    includeSystemProcesses: normalizeBoolean(input.includeSystemProcesses, false),
    dryRun: normalizeBoolean(input.dryRun, false),
    includeDisabled,
    includeMissingAsDisabled,
    autoDiscoverAll,
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

function normalizeFeedbackObservedAt(value: unknown): string | null {
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

function computeHealthScore(client: StoredLocalClient, nowTs: number, staleThresholdMs: number): number {
  const lastSeenAt = Date.parse(client.lastSeenAt || "") || nowTs;
  const staleMs = Math.max(0, nowTs - lastSeenAt);
  const stalePenalty = Math.min(40, staleMs / staleThresholdMs * 40);
  const baseByStatus = client.health.status === "healthy"
    ? 50
    : client.health.status === "degraded"
      ? 20
      : client.health.status === "unknown"
        ? 10
        : 0;
  const latencyPenalty = Math.min(10, safeNumber(client.health.latencyMs) / 500);
  const loadPenalty = Math.min(10, (safeNumber(client.load.queueDepth) / 20) * 10);
  return Math.max(0, Math.round((baseByStatus - stalePenalty - latencyPenalty - loadPenalty) * 100) / 100);
}

export function computeReliabilityScore(
  stats: StoredClientStats,
  _nowTs?: number,
  _staleThresholdMs?: number,
): number {
  const attempts = safeNumber(stats.attempts, 0);
  const staleFactor = computeStaleReliabilityPenalty(stats, attempts);
  const ewmaSuccessRate = safeNumber(stats.ewmaSuccessRate, null);
  const ewmaScore = ewmaSuccessRate !== null && Number.isFinite(ewmaSuccessRate)
    ? Math.max(0, Math.min(100, ewmaSuccessRate * 100))
    : null;
  const failureStreakPenalty = Math.min(25, safeNumber(stats.failureStreak, 0) * 4);

  const base = attempts <= 0 ? 40 : computeRatioReliability(stats, attempts);
  if (ewmaScore === null) {
    return Math.max(0, Math.min(100, base - staleFactor - failureStreakPenalty));
  }
  const blended = Math.round((ewmaScore * 0.65 + base * 0.35) * 100) / 100;
  return Math.max(0, Math.min(100, blended - staleFactor - failureStreakPenalty));
}

function computeRatioReliability(stats: StoredClientStats, attempts = safeNumber(stats.attempts, 0)): number {
  if (attempts <= 0) return 40;
  const successes = Math.min(attempts, safeNumber(stats.successes, 0));
  const failures = Math.min(attempts, safeNumber(stats.failures, 0));
  const ratio = attempts > 0 ? successes / attempts : 0;
  const failurePenalty = (failures / attempts) * 15;
  const score = Math.min(100, Math.max(0, ratio * 100 - failurePenalty));
  return Math.round(score * 100) / 100;
}

function computeStaleReliabilityPenalty(stats: StoredClientStats, attempts = safeNumber(stats.attempts, 0)): number {
  const feedbackAt = Date.parse(stats.lastFeedbackAt || "");
  if (!Number.isFinite(feedbackAt) || attempts <= 0) return 0;
  const staleMs = Date.now() - feedbackAt;
  return Math.min(25, (staleMs / (5 * 60_000)) * 15);
}

export function updateOutcomeEwma(
  previousValue: number | null | undefined,
  latestOutcome: boolean,
  alpha = ADAPTIVE_RELIABILITY_ALPHA,
): number {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : ADAPTIVE_RELIABILITY_ALPHA;
  const previous = typeof previousValue === "number" && Number.isFinite(previousValue)
    ? previousValue
    : ADAPTIVE_RELIABILITY_INITIAL;
  const normalizedOutcome = Number(latestOutcome === true ? 1 : 0);
  return (safeAlpha * normalizedOutcome) + ((1 - safeAlpha) * previous);
}

function trustLevelBonus(level: string): number {
  if (level === "high") return 12;
  if (level === "critical") return 20;
  if (level === "low") return -12;
  return 0;
}

function matchCapabilities(requestCapabilities: string[], clientCapabilities: string[]) {
  const set = new Set(clientCapabilities);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const capability of requestCapabilities) {
    if (set.has(capability)) {
      matched.push(capability);
    } else {
      missing.push(capability);
    }
  }
  return { matched, missing };
}

export function rankCandidates(
  clients: StoredLocalClient[],
  routeRequest: ReturnType<typeof normalizeRouteRequest>,
  staleThresholdMs: number,
  nowTs: number,
): RankedLocalClient[] {
  const scored = clients.map((client) => {
    const { matched, missing } = matchCapabilities(routeRequest.requiredCapabilities, client.capabilities);
    const neededCount = routeRequest.requiredCapabilities.length || 1;
    const matchRatio = matched.length / neededCount;
    const preferredBonus = routeRequest.preferredClientId && routeRequest.preferredClientId === client.clientId ? 30 : 0;
    const enabledBonus = client.enabled ? 10 : -99;
    const priorityBonus = client.priority ? Math.max(0, client.priority - 50) / 10 : 0;
    const reliabilityScore = computeReliabilityScore(client.stats || {}, nowTs, staleThresholdMs);
    const trustBonus = trustLevelBonus(client.trustLevel);
    const healthScore = computeHealthScore(client, nowTs, staleThresholdMs);
    const stalePenalty = client.lastSeenAt
      ? Math.min(40, Math.max(0, (nowTs - Date.parse(client.lastSeenAt || "")) / staleThresholdMs * 40))
      : 0;
    const autoRiskPenalty = client?.metadata?.autoRiskFlag ? AUTO_RISK_PENALTY : 0;
    const base = matchRatio * 100 + enabledBonus + preferredBonus + priorityBonus + healthScore + reliabilityScore / 10 + trustBonus;
    const failurePenalty = Math.min(25, safeNumber(client.stats?.failureStreak, 0) * 4);
    const penalty = (missing.length * 12) + failurePenalty + autoRiskPenalty;
    return {
      ...client,
      matchedCapabilities: matched,
      missingCapabilities: missing,
      score: Math.max(0, Math.round((base - penalty - stalePenalty) * 100) / 100),
      reasonFactors: {
        matchRatio: Math.round(matchRatio * 100) / 100,
        reliability: reliabilityScore,
        trustLevel: client.trustLevel,
        stalePenalty: Math.round(stalePenalty * 100) / 100,
        failureStreak: safeNumber(client.stats?.failureStreak, 0),
        autoRiskPenalty,
        requestedCapabilityCount: routeRequest.requiredCapabilities.length,
      },
      reasons: [
        routeRequest.requiredCapabilities.length ? `Required capability match: ${matched.length}/${neededCount}` : "No explicit required capabilities.",
        `Health score: ${healthScore.toFixed(2)}.`,
        `Reliability: ${reliabilityScore.toFixed(2)}.`,
      ].filter(Boolean),
    };
  });
  return scored.sort((left, right) => {
    const leftIsFullMatch = left.missingCapabilities.length === 0;
    const rightIsFullMatch = right.missingCapabilities.length === 0;
    if (leftIsFullMatch !== rightIsFullMatch) {
      return rightIsFullMatch ? 1 : -1;
    }
    return right.score - left.score;
  });
}

export function classifyRiskProfile(
  client: StoredLocalClient,
  nowTs: number,
  staleThresholdMs: number,
  maintenanceRequest: ReturnType<typeof normalizeMaintenanceInput>,
) {
  const lastSeenAt = Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || "");
  const staleMs = Number.isFinite(lastSeenAt) ? nowTs - lastSeenAt : null;
  const failureStreak = safeNumber(client.stats?.failureStreak, 0);
  const healthScore = computeHealthScore(client, nowTs, staleThresholdMs);
  const reliabilityScore = computeReliabilityScore(client.stats || {}, nowTs, staleThresholdMs);
  const autoRiskFlag = Boolean(safeTrim(client.metadata?.autoRiskFlag));
  const reasons = [];
  if (autoRiskFlag) reasons.push("auto-risk-flag");
  if (!Number.isFinite(staleMs)) reasons.push("missing-last-seen");
  if (failureStreak > 0) reasons.push(`failure-streak:${failureStreak}`);
  if (client.health.status === "degraded") reasons.push("health:degraded");
  if (client.health.status === "unhealthy") reasons.push("health:unhealthy");

  const isCritical = autoRiskFlag
    || client.health.status === "unhealthy"
    || failureStreak >= maintenanceRequest.riskDisableFailureStreak
    || healthScore <= maintenanceRequest.criticalHealthScore;
  const isWarning = !isCritical && (
    client.health.status === "degraded"
    || (staleMs !== null && Number.isFinite(staleMs) && staleMs > staleThresholdMs * 2)
    || healthScore < Math.max(maintenanceRequest.criticalHealthScore + 8, maintenanceRequest.criticalHealthScore * 1.25)
  );
  return {
    isCritical,
    isWarning,
    healthScore,
    reliabilityScore,
    failureStreak,
    staleMs,
    reasons,
    level: isCritical ? "critical" : isWarning ? "warning" : "stable",
    compositeScore: Math.max(0, Math.round(((healthScore * 0.7) + (reliabilityScore * 0.3)) * 100) / 100),
  };
}

function parseCsvLine(line: unknown): string[] {
  const normalized = safeTrim(line, "");
  if (!normalized) return [];
  const values: string[] = [];
  let inQuotes = false;
  let current = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function normalizeProcessName(raw: unknown): string {
  const safe = safeTrim(raw, "").toLowerCase();
  if (!safe) return "";
  return safe.replace(/\.exe$/u, "");
}

function toStableHintMap(rawHints: unknown): Map<string, DiscoveryHint> {
  const map = new Map<string, DiscoveryHint>();
  const list: unknown[] = Array.isArray(rawHints) ? rawHints : [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const rawHint = item as DiscoveryHintInput;
    const processName = normalizeProcessName(rawHint?.processName || rawHint?.name || rawHint?.executable || rawHint?.id);
    if (!processName) {
      continue;
    }
    const capabilities = toList(rawHint?.capabilities).map(normalizeCapability);
    const tags = toList(rawHint?.tags).map(normalizeCapability);
    const priority = parsePositiveInt(rawHint?.priority, 50, 0, 100);
    const trustLevel = safeTrim(rawHint?.trustLevel, "medium");
    const clientId = safeTrim(rawHint?.clientId);
    const aliases = new Set<string>([processName]);
    if (Array.isArray(rawHint?.aliases)) {
      for (const alias of rawHint.aliases) {
        const normalizedAlias = normalizeProcessName(alias);
        if (normalizedAlias) aliases.add(normalizedAlias);
      }
    }
    const record: DiscoveryHint = {
      processName,
      displayName: safeTrim(rawHint?.displayName, processName),
      description: safeTrim(rawHint?.description),
      capabilities: capabilities.length ? capabilities : FALLBACK_UNKNOWN_CAPABILITIES,
      tags,
      preferred: normalizeBoolean(rawHint?.preferred, false),
      priority,
      trustLevel,
      clientId,
      aliases: Array.from(aliases.values()),
    };
    for (const alias of aliases) {
      map.set(alias, record);
    }
  }
  return map;
}

export function buildBuiltInHintMap(): Map<string, DiscoveryHint> {
  return toStableHintMap(BUILTIN_DISCOVERY_HINTS);
}

function isSystemProcessRow(
  row: NormalizedProcessRow,
  includeSystemProcesses: boolean,
): boolean {
  if (includeSystemProcesses) return false;
  if (DISPATCHER_PROCESS_KEYWORDS.has(row.processName)) return true;
  if (process.platform !== "win32") return false;
  const userName = row.userName.toLowerCase();
  return row.sessionId === 0
    || row.sessionName.toLowerCase() === "services"
    || /^(?:nt authority\\)?(?:system|local service|network service)$/u.test(userName);
}

function inferCapabilitiesByName(processName: unknown): string[] {
  const normalized = normalizeProcessName(processName);
  if (!normalized) return FALLBACK_UNKNOWN_CAPABILITIES;
  if (normalized.includes("chrome") || normalized.includes("firefox") || normalized.includes("edge")) {
    return ["browser", "web_automation"];
  }
  if (normalized.includes("code") || normalized.includes("idea") || normalized.includes("sublime") || normalized.includes("editor")) {
    return ["editor", "ide", "file_operation"];
  }
  if (normalized.includes("pycharm") || normalized.includes("clion") || normalized.includes("intellij")) {
    return ["editor", "ide", "file_operation", "local_workflow"];
  }
  if (normalized.includes("wechat") || normalized.includes("wechatwork") || normalized.includes("dingtalk") || normalized.includes("telegram")) {
    return ["chat", "communication"];
  }
  if (normalized.includes("feishu") || normalized.includes("lark") || normalized.includes("wec") || normalized.includes("wxc")) {
    return ["chat", "communication"];
  }
  if (normalized.includes("slack") || normalized.includes("wechat") || normalized.includes("teams") || normalized.includes("discord")) {
    return ["chat", "communication"];
  }
  if (normalized.includes("notepad") || normalized.includes("vim") || normalized.includes("nano")) {
    return ["text", "editor"];
  }
  if (normalized.includes("terminal") || normalized.includes("cmd") || normalized.includes("powershell")) {
    return ["terminal", "automation", "scripting"];
  }
  return FALLBACK_UNKNOWN_CAPABILITIES;
}

function inferTaskCapabilities(taskText: unknown): string[] {
  const normalized = normalizeTaskText(taskText);
  if (!normalized) {
    return [];
  }
  const inferred = new Set<string>();
  const add = (keywords: string[], capabilities: string[]) => {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      for (const capability of capabilities) {
        inferred.add(capability);
      }
    }
  };
  add([
    "浏览器", "网页", "browser", "web", "网站", "网址", "搜索",
  ], ["web_automation", "browser", "local_workflow"]);
  if (normalized.includes("浏览器") || normalized.includes("网页") || normalized.includes("browser") || normalized.includes("web")) {
    inferred.add("web_automation");
    inferred.add("browser");
  }
  if (normalized.includes("编辑") || normalized.includes("写") || normalized.includes("markdown") || normalized.includes("代码") || normalized.includes("code")
    || normalized.includes("vscode") || normalized.includes("pycharm") || normalized.includes("idea") || normalized.includes("editor")) {
    inferred.add("editor");
    inferred.add("file_operation");
    inferred.add("local_workflow");
  }
  add([
    "终端", "shell", "cmd", "powershell", "terminal", "运行", "执行", "自动化", "automate", "脚本",
  ], ["terminal", "automation", "scripting", "local_workflow"]);
  if (normalized.includes("终端") || normalized.includes("shell") || normalized.includes("cmd") || normalized.includes("powershell") || normalized.includes("terminal")
    || normalized.includes("执行") || normalized.includes("自动化") || normalized.includes("automate")) {
    inferred.add("automation");
    inferred.add("terminal");
    inferred.add("scripting");
  }
  add([
    "聊天", "沟通", "消息", "chat", "wechat", "teams", "slack", "discord", "飞书", "dingtalk", "钉钉",
  ], ["chat", "communication"]);
  if (normalized.includes("聊天") || normalized.includes("沟通") || normalized.includes("消息") || normalized.includes("chat") || normalized.includes("wechat")
    || normalized.includes("teams") || normalized.includes("slack") || normalized.includes("discord")) {
    inferred.add("chat");
    inferred.add("communication");
  }
  add(["文件", "文档", "folder", "目录", "导出", "导入", "excel", "word", "ppt", "pdf", "markdown"], ["file_operation", "local_workflow"]);
  if (normalized.includes("文件") || normalized.includes("文档") || normalized.includes("folder") || normalized.includes("目录") || normalized.includes("导出") || normalized.includes("导入")) {
    inferred.add("file_operation");
  }
  add(["通知", "提醒", "提醒事项", "提醒我", "闹钟", "deadline"], ["notifications", "calendar"]);
  if (normalized.includes("通知") || normalized.includes("提醒") || normalized.includes("提醒事项")) {
    inferred.add("notifications");
  }
  add(["视频", "图片", "截图", "录屏", "摄像头", "画图"], ["media_capture", "automation"]);
  if (inferred.size === 0) {
    return DEFAULT_UNKNOWN_TASK_CAPABILITIES.slice();
  }
  return Array.from(inferred);
}

function normalizeProcessRow(lineOrObject: ProcessRow | null | undefined): NormalizedProcessRow | null {
  if (!lineOrObject) return null;
  const imageName = safeTrim(lineOrObject.imageName || lineOrObject.name || lineOrObject.processName);
  const normalized = normalizeProcessName(imageName);
  if (!normalized) return null;
  return {
    processName: normalized,
    executable: safeTrimOrNull(lineOrObject.executablePath || lineOrObject.path) || normalized,
    pid: parseOptionalPositiveInt(lineOrObject.pid, null, 1, Number.MAX_SAFE_INTEGER),
    sessionName: safeTrim(lineOrObject.sessionName, ""),
    sessionId: parseOptionalPositiveInt(lineOrObject.sessionId, null, 0, Number.MAX_SAFE_INTEGER),
    userName: safeTrim(lineOrObject.userName, ""),
  };
}

function buildDiscoverableClient(
  hint: DiscoveryHint | undefined,
  processName: string,
  request: ReturnType<typeof normalizeSystemDiscoverInput>,
  rawProcess: NormalizedProcessRow,
): LocalClientInput & { clientId: string } {
  const discoveredName = safeTrim(hint?.displayName, processName);
  const capabilities = Array.isArray(hint?.capabilities) && hint.capabilities.length ? hint.capabilities : inferCapabilitiesByName(processName);
  const tags: string[] = Array.isArray(hint?.tags) ? hint.tags : [];
  const metadata: StoredClientMetadata = {
    discoveredBy: "local-process-scan",
    discoverSource: request.source,
    processPid: rawProcess?.pid,
    sourceRaw: processName,
  };
  return {
    // The observation source is audit metadata, not client identity. Manual
    // discovery and smart-management rounds must converge on one stable record.
    clientId: hint?.clientId || createStableClientId(STABLE_ID_NAMESPACE, `system-scan:${processName}`),
    name: discoveredName,
    displayName: discoveredName,
    description: hint?.description ?? `Auto-discovered local process ${processName}`,
    executable: safeTrimOrNull(rawProcess?.executable) || null,
    platform: process.platform,
    capabilities: toList(capabilities).map(normalizeCapability),
    tags: Array.from(new Set(["auto-discovery", "system-scan", ...tags.map((item) => normalizeCapability(item))])),
    metadata,
    health: {
      status: "unknown",
      latencyMs: null,
      lastError: null,
      updatedAt: now(),
    },
    trustLevel: safeTrim(hint?.trustLevel, "medium"),
    load: {
      cpu: NaN,
      memory: NaN,
      queueDepth: 0,
    },
    priority: parsePositiveInt(hint?.priority, 50, 0, 100),
    preferred: normalizeBoolean(hint?.preferred, false),
    stableKey: createStableClientId(STABLE_ID_NAMESPACE, `${processName}:${process.platform}`),
    discoveredAt: now(),
    lastSeenAt: now(),
    updatedAt: now(),
  };
}

export async function readDiscoveryHints(pathHint: string): Promise<Map<string, DiscoveryHint>> {
  if (!pathHint) return new Map<string, DiscoveryHint>();
  if (!await fileExists(pathHint)) return new Map();
  try {
    const raw = await readJson(pathHint);
    if (Array.isArray(raw)) {
      return toStableHintMap(raw);
    }
    if (isRecord(raw)) {
      return toStableHintMap(
        Object.entries(raw).map(([name, item]) => {
          if (!isRecord(item)) {
            return { processName: name, capabilities: item };
          }
          return { processName: safeTrim(item.processName, name), ...item };
        }),
      );
    }
  } catch {
    return new Map<string, DiscoveryHint>();
  }
  return new Map<string, DiscoveryHint>();
}

export function safeNumberOrNaN(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export async function listProcessRows(
  maxRows = WINDOWS_TASKLIST_MAX_ROWS,
  signal?: AbortSignal,
): Promise<ProcessRow[]> {
  throwIfLocalClientAborted(signal);
  const safeMaxRows = Math.min(Math.max(1, maxRows), WINDOWS_TASKLIST_MAX_ROWS);
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync("tasklist", ["/v", "/fo", "csv", "/nh"], {
      timeout: WINDOWS_TASKLIST_TIMEOUT_MS,
      maxBuffer: 2 * 1024 * 1024,
      signal,
    });
    throwIfLocalClientAborted(signal);
    return stdout
      .split(/\r?\n/)
      .slice(0, safeMaxRows)
      .map(parseCsvLine)
      .map((cells) => ({
        imageName: cells[0],
        pid: cells[1],
        sessionName: cells[2],
        sessionId: cells[3],
        userName: cells[6],
      }))
      .filter((item) => item.imageName);
  }
  const { stdout } = await execFileAsync("ps", ["-eo", "comm="], {
    timeout: 6_000,
    maxBuffer: 2 * 1024 * 1024,
    signal,
  });
  throwIfLocalClientAborted(signal);
  return stdout
    .split(/\r?\n/)
    .slice(0, safeMaxRows)
    .map((line) => safeTrim(line))
    .filter(Boolean)
    .map((line) => ({ imageName: line }));
}

export function buildDiscoveryCandidates(
  processRows: ProcessRow[],
  hintsMap: Map<string, DiscoveryHint>,
  request: ReturnType<typeof normalizeSystemDiscoverInput>,
) {
  const candidates: Array<LocalClientInput & { clientId: string }> = [];
  const seenClientIds = new Set<string>();
  const seenProcesses = new Set<string>();
  const dropped = {
    filteredSystemProcessCount: 0,
    filteredUnknownCount: 0,
    duplicateProcessCount: 0,
  };

  for (const processRow of processRows) {
    const normalized = normalizeProcessRow(processRow);
    if (!normalized) continue;
    const processName = normalized.processName;
    if (seenProcesses.has(processName)) {
      dropped.duplicateProcessCount += 1;
      continue;
    }
    if (isSystemProcessRow(normalized, request.includeSystemProcesses)) {
      dropped.filteredSystemProcessCount += 1;
      continue;
    }
    const matchedHint = hintsMap.get(processName);
    if (!matchedHint && !request.includeUnknown) {
      dropped.filteredUnknownCount += 1;
      continue;
    }
    const hint = matchedHint || {
      processName,
      capabilities: FALLBACK_UNKNOWN_CAPABILITIES,
      tags: ["auto-discovery", "unknown"],
      priority: 40,
      trustLevel: "low",
      preferred: false,
      displayName: processName,
    };
    const discoverable = buildDiscoverableClient(hint, processName, request, normalized);
    if (seenClientIds.has(discoverable.clientId)) {
      dropped.duplicateProcessCount += 1;
      continue;
    }
    seenClientIds.add(discoverable.clientId);
    seenProcesses.add(processName);
    candidates.push(discoverable);
  }

  return { candidates, dropped };
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

export function verifyRegistryIntegrity(key: Buffer, data: UnknownRecord): boolean {
  if (
    data.version !== REGISTRY_VERSION
    || !isRegistryGeneration(data.generation, false)
    || typeof data.createdAt !== "string"
    || typeof data.updatedAt !== "string"
    || !Array.isArray(data.clients)
    || !hasExactKeys(data.integrity, ["version", "hmacSha256"])
    || data.integrity.version !== REGISTRY_INTEGRITY_VERSION
    || typeof data.integrity.hmacSha256 !== "string"
    || !SHA256_PATTERN.test(data.integrity.hmacSha256)
  ) return false;
  try {
    const expected = computeRegistryHmac(key, {
      version: data.version,
      generation: data.generation,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      clients: data.clients,
    });
    return safeSha256Equal(expected, data.integrity.hmacSha256);
  } catch {
    return false;
  }
}

export function computeRegistryHmac(key: Buffer, payload: object): string {
  return createHmac("sha256", key)
    .update(REGISTRY_INTEGRITY_VERSION)
    .update("\0")
    .update(canonicalRegistryJson(payload))
    .digest("hex");
}

export function computeRegistryDigest(snapshot: LocalClientRegistry | UnknownRecord): string {
  return createHash("sha256")
    .update("local-client-signed-registry-checkpoint-v1\0", "utf8")
    .update(canonicalRegistryJson(snapshot), "utf8")
    .digest("hex");
}

export function isRegistryGeneration(value: unknown, allowZero: boolean): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && (allowZero ? value >= 0 : value > 0);
}

export function incrementRegistryGeneration(value: unknown): number {
  if (!isRegistryGeneration(value, true) || value >= Number.MAX_SAFE_INTEGER) {
    throw createError(
      "local_client_registry_generation_exhausted",
      "The signed local-client registry generation cannot be incremented safely.",
      { statusCode: 503, category: "integrity" },
    );
  }
  return value + 1;
}

function canonicalRegistryJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite registry value");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalRegistryJson).join(",")}]`;
  if (!isRecord(value)) throw new Error("unsupported registry value");
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalRegistryJson(value[key])}`
  )).join(",")}}`;
}

export async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed : null;
}

export async function saveJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await chmod(dirname(filePath), 0o700).catch(() => undefined);
  const serial = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp`;
  const handle = await open(tmpPath, "w", 0o600);
  try {
    await handle.writeFile(serial, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmpPath, filePath);
  await chmod(filePath, 0o600).catch(() => undefined);
  const directoryHandle = await open(dirname(filePath), "r").catch(() => null);
  if (directoryHandle) {
    try {
      await directoryHandle.sync().catch(() => undefined);
    } finally {
      await directoryHandle.close();
    }
  }
}

export async function appendLogEntry(filePath: string, entry: UnknownRecord): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await chmod(dirname(filePath), 0o700).catch(() => undefined);
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(filePath, line, "utf8");
  await chmod(filePath, 0o600).catch(() => undefined);
}

