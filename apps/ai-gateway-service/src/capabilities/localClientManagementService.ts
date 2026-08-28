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

type UnknownRecord = Record<string, unknown>;
type LocalClientVerificationStatus = "unverified" | "declared" | "verified";
type LocalClientFeedbackStatus = "success" | "failure" | "error" | "timeout";

export interface LocalClientScope {
  tenantId: string;
  userId: string;
}

interface StoredClientHealth {
  status: LocalClientHealthStatus;
  latencyMs: number | null;
  lastError: string | null;
  updatedAt: string;
}

interface StoredClientLoad {
  cpu: number;
  memory: number;
  queueDepth: number;
}

interface StoredClientStats {
  attempts: number;
  successes: number;
  failures: number;
  ewmaSuccessRate: number | null;
  failureStreak: number;
  avgLatencyMs: number | null;
  lastFeedbackAt: string;
  lastTaskCapabilities: string[];
  lastFailureAt: string | null;
  lastFailureMessage: string | null;
}

interface StoredClientVerificationEvidence {
  evidenceVersion: typeof LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION;
  fingerprint: string;
  declarationFingerprint: string;
  verifiedAtMs: number;
  expiresAtMs: number;
}

interface StoredFeedbackAppliedEventMarker {
  eventFingerprint: string;
  admissionFingerprint: string;
}

interface StoredClientMetadata extends UnknownRecord {
  discoverSource?: string;
  discoveredBy?: string;
  processPid?: number | null;
  sourceRaw?: string;
  lastHeartbeatAt?: string;
  lastTaskId?: string;
  autoRiskFlag?: string | null;
  autoRiskAt?: string | null;
}

export interface StoredLocalClient {
  tenantId: string;
  clientId: string;
  stableKey: string;
  name: string;
  displayName: string;
  description: string;
  adapterId: string | null;
  adapterType: string | null;
  adapterVersion: string | null;
  manifestSha256: string | null;
  protocolVersion: string | null;
  executable: string | null;
  command: string | null;
  platform: string;
  endpoints: { primary: string; api: string; ws: string };
  capabilities: string[];
  tags: string[];
  metadata: StoredClientMetadata;
  revokedAt: string | null;
  revokedReason: string | null;
  /**
   * Internal crash-reconciliation markers. They are HMAC-covered by the
   * signed registry and are never projected through the public client DTO.
   */
  feedbackAppliedEventMarkers: StoredFeedbackAppliedEventMarker[];
  health: StoredClientHealth;
  verificationStatus: LocalClientVerificationStatus;
  verification: StoredClientVerificationEvidence | null;
  routable: boolean;
  trustLevel: string;
  load: StoredClientLoad;
  stats: StoredClientStats;
  priority: number;
  revision: number;
  enabled: boolean;
  preferred: boolean;
  discoveredAt: string;
  lastSeenAt: string;
  updatedAt: string;
}

export interface LocalClientRegistry {
  version: string;
  generation: number;
  updatedAt: string;
  createdAt: string;
  clients: StoredLocalClient[];
  integrity: null | {
    version: "local-client-registry-integrity-v1";
    hmacSha256: string;
  };
}

interface NestedHealthInput extends UnknownRecord {
  status?: unknown;
  latencyMs?: unknown;
  responseMs?: unknown;
  lastError?: unknown;
  updatedAt?: unknown;
}

interface NestedLoadInput extends UnknownRecord {
  cpu?: unknown;
  memory?: unknown;
  queueDepth?: unknown;
}

interface NestedStatsInput extends UnknownRecord {
  attempts?: unknown;
  successes?: unknown;
  failures?: unknown;
  ewmaSuccessRate?: unknown;
  failureStreak?: unknown;
  avgLatencyMs?: unknown;
  lastFeedbackAt?: unknown;
  lastTaskCapabilities?: unknown;
  lastFailureAt?: unknown;
  lastFailureMessage?: unknown;
}

interface LocalClientInput extends UnknownRecord {
  tenantId?: unknown;
  clientId?: unknown;
  id?: unknown;
  name?: unknown;
  displayName?: unknown;
  description?: unknown;
  adapterId?: unknown;
  adapterType?: unknown;
  adapterVersion?: unknown;
  manifestSha256?: unknown;
  protocolVersion?: unknown;
  executable?: unknown;
  command?: unknown;
  platform?: unknown;
  endpoint?: unknown;
  apiEndpoint?: unknown;
  wsEndpoint?: unknown;
  endpoints?: { primary?: unknown; api?: unknown; ws?: unknown };
  capabilities?: unknown;
  capabilityIds?: unknown;
  tags?: unknown;
  metadata?: StoredClientMetadata;
  health?: NestedHealthInput;
  healthStatus?: unknown;
  healthLatencyMs?: unknown;
  trustLevel?: unknown;
  verificationStatus?: unknown;
  verification?: unknown;
  routable?: unknown;
  load?: NestedLoadInput;
  stats?: NestedStatsInput;
  priority?: unknown;
  revision?: unknown;
  enabled?: unknown;
  preferred?: unknown;
  stableKey?: unknown;
  discoveredAt?: unknown;
  lastSeenAt?: unknown;
}

interface NormalizeClientOptions {
  tenantId?: unknown;
  verificationStatus?: unknown;
  routable?: unknown;
  trustLevel?: unknown;
  preserveFeedbackAppliedEventMarkers?: boolean;
  preserveRevocation?: boolean;
}

export interface LocalClientListInput {
  includeDisabled?: unknown;
  enabledOnly?: unknown;
  capabilities?: unknown;
  offset?: unknown;
  limit?: unknown;
}

export interface LocalClientDiscoverInput extends UnknownRecord {
  source?: unknown;
  clients: unknown[];
  includeMissingAsDisabled?: unknown;
  strategy?: unknown;
  signal?: AbortSignal;
}

export interface LocalClientRegisterInput
  extends Omit<RegisterLocalClientRequest, "capabilityIds">, UnknownRecord {
  clientId: string;
  displayName?: string;
  description?: string;
  capabilityIds?: string[];
  adapterType?: string;
  adapterId?: string;
  adapterVersion?: string;
  manifestSha256?: string;
  protocolVersion?: string;
  name?: string;
  capabilities?: string[];
  tenantId?: unknown;
  enabled?: unknown;
  preferred?: unknown;
  priority?: unknown;
  trustLevel?: unknown;
  healthStatus?: unknown;
  lastSeenAt?: unknown;
  executable?: unknown;
  command?: unknown;
  endpoint?: unknown;
  metadata?: StoredClientMetadata;
}

export interface LocalClientSystemDiscoverInput extends UnknownRecord {
  source?: unknown;
  maxProcesses?: unknown;
  includeUnknown?: unknown;
  includeSystemProcesses?: unknown;
  dryRun?: unknown;
  includeDisabled?: unknown;
  includeMissingAsDisabled?: unknown;
  autoDiscoverAll?: unknown;
  signal?: AbortSignal;
}

export interface LocalClientHeartbeatInput extends UnknownRecord {
  clientId?: unknown;
  id?: unknown;
  upsert?: unknown;
  healthStatus?: unknown;
  health?: NestedHealthInput;
  latencyMs?: unknown;
  cpu?: unknown;
  memory?: unknown;
  queueDepth?: unknown;
  lastError?: unknown;
  errorCode?: unknown;
  capabilities?: unknown;
  preferred?: unknown;
  tags?: unknown;
}

export interface LocalClientFeedbackInput extends UnknownRecord {
  eventId?: unknown;
  clientId?: unknown;
  id?: unknown;
  taskId?: unknown;
  status?: unknown;
  latencyMs?: unknown;
  error?: unknown;
  errorCode?: unknown;
  requiredCapabilities?: unknown;
  observedAt?: unknown;
}

export interface LocalClientRouteInput extends RouteLocalClientRequest, UnknownRecord {
  task?: unknown;
  description?: unknown;
  includeDisabled?: unknown;
  requestContext?: unknown;
}

export interface LocalClientExecuteInput extends UnknownRecord {
  action?: unknown;
  taskText?: unknown;
  task?: unknown;
  requiredCapabilities?: unknown;
  preferredClientId?: unknown;
  clientId?: unknown;
  dryRun?: unknown;
  allowPartialExecution?: unknown;
  timeoutMs?: unknown;
  arguments?: unknown;
}

export interface LocalClientMaintenanceInput extends UnknownRecord {
  dryRun?: unknown;
  staleMultiplier?: unknown;
  staleAction?: unknown;
  riskAction?: unknown;
  criticalHealthScore?: unknown;
  riskDisableFailureStreak?: unknown;
  autoRiskRecover?: unknown;
  includeEnabledOnly?: unknown;
  includeDisabled?: unknown;
  autoRiskRecoveryFailureThreshold?: unknown;
  autoRiskRecoveryMinAgeMs?: unknown;
  limit?: unknown;
  maxCandidates?: unknown;
  signal?: AbortSignal;
}

export interface LocalClientSmartManageInput extends UnknownRecord {
  dryRun?: unknown;
  discover?: LocalClientSystemDiscoverInput;
  discovery?: LocalClientSystemDiscoverInput;
  maintenance?: LocalClientMaintenanceInput;
  includeDiscoveryOnly?: unknown;
  includeRegistrySnapshot?: unknown;
  maxRecommendations?: unknown;
  signal?: AbortSignal;
}

export interface LocalClientDisableInput extends UnknownRecord {
  clientId?: unknown;
  id?: unknown;
  reason?: unknown;
  dryRun?: unknown;
  includeHealthReset?: unknown;
}

export interface LocalClientRevokeInput extends UnknownRecord {
  clientId?: unknown;
  id?: unknown;
  expectedRevision?: unknown;
  reason?: unknown;
  dryRun?: unknown;
}

interface ProcessRow extends UnknownRecord {
  imageName?: string;
  name?: string;
  processName?: string;
  executablePath?: string;
  path?: string;
  executable?: string | null;
  pid?: string | number | null;
  sessionName?: string | null;
  sessionId?: string | number | null;
  userName?: string | null;
}

interface NormalizedProcessRow {
  processName: string;
  executable: string;
  pid: number | null;
  sessionName: string;
  sessionId: number | null;
  userName: string;
}

interface DiscoveryHint extends UnknownRecord {
  processName?: string;
  displayName?: string;
  description?: string;
  capabilities?: string[];
  tags?: string[];
  preferred?: boolean;
  priority?: number;
  trustLevel?: string;
  clientId?: string;
  aliases?: string[];
}

interface DiscoveryHintInput extends UnknownRecord {
  processName?: unknown;
  name?: unknown;
  executable?: unknown;
  id?: unknown;
  displayName?: unknown;
  description?: unknown;
  capabilities?: unknown;
  tags?: unknown;
  preferred?: unknown;
  priority?: unknown;
  trustLevel?: unknown;
  clientId?: unknown;
  aliases?: unknown;
}

export interface LocalClientManagementOptions {
  env?: Record<string, string | undefined>;
  repoRoot?: unknown;
  registryPath?: unknown;
  executionLogPath?: unknown;
  discoveryHintsPath?: unknown;
  adapterRegistry?: Pick<LocalClientAdapterRegistry, "list">;
  executionReadiness?: LocalClientExecutionReadiness;
  processRowsProvider?: (maxRows?: number, signal?: AbortSignal) => Promise<ProcessRow[]>;
  staleClientThresholdMs?: unknown;
  executionEnabled?: unknown;
  maxAlternatives?: unknown;
  registryIntegrityKey?: Uint8Array;
  epochStore?: Pick<
    LocalClientSqliteVerificationAuthorityEpochStore,
    | "status"
    | "inspectSync"
    | "assertCurrent"
    | "assertCurrentSync"
    | "reserveNextGeneration"
    | "finalize"
    | "close"
  >;
  feedbackDedupStore?: Pick<
    LocalClientSqliteFeedbackDedupStore,
    "status" | "admitAndClaim" | "acknowledgeApplied" | "releaseClaim" | "checkHealth" | "close"
  >;
}

export interface ResolveVerifiedLocalClientTargetInput {
  readonly identity: LocalClientVerificationScope;
  readonly clientId: string;
}

export interface ResolvedVerifiedLocalClientTarget extends VerifiedLocalClientAdapterTarget {
  readonly revision: number;
}

type LocalClientServiceError = Error & {
  code: string;
  statusCode: number;
  category: string;
  details?: UnknownRecord;
};

interface LocalClientErrorOptions {
  statusCode?: number;
  category?: string;
  details?: UnknownRecord;
}

interface RankedLocalClient extends StoredLocalClient {
  matchedCapabilities: string[];
  missingCapabilities: string[];
  score: number;
  reasonFactors: {
    matchRatio: number;
    reliability: number;
    trustLevel: string;
    stalePenalty: number;
    failureStreak: number;
    autoRiskPenalty: number;
    requestedCapabilityCount: number;
  };
  reasons: string[];
}

interface NormalizedRouteRequest {
  taskText: string;
  requiredCapabilities: string[];
  capabilitySource: "explicit" | "inferred" | "none";
  preferredClientId: string | null;
  includeDisabled: boolean;
  maxCandidates: number;
  requestContext: string;
}

export interface LocalClientRegistrySummary extends Record<string, number> {
  total: number;
  enabled: number;
  disabled: number;
  healthy: number;
  degraded: number;
  unknown: number;
  unhealthy: number;
}

export interface LocalClientHealthResult {
  phase: string;
  status: "healthy" | "degraded" | "unhealthy";
  checksAt: string;
  summary: LocalClientRegistrySummary;
  staleClientThresholdMs: number;
  staleClients: number;
  staleClientCount: number;
  unhealthyEnabledClients: number;
  degradedEnabledClients: number;
  clients: Array<{
    clientId: string;
    displayName: string;
    enabled: boolean;
    routable: boolean;
    state: ManagedLocalClientSummary["state"];
    health: LocalClientHealthStatus;
    staleMs: number | null;
    latencyMs: number | null;
  }>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = resolve(__dirname, "../..");
const DEFAULT_REGISTRY_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "registry.json");
const DEFAULT_EXECUTION_LOG_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "execution-log.jsonl");
const DEFAULT_DISCOVERY_HINTS_PATH = join(DEFAULT_REPO_ROOT, ".data", "local-clients", "discovery-hints.json");
const REGISTRY_VERSION = "local-client-management-registry-v1";
const REGISTRY_INTEGRITY_VERSION = "local-client-registry-integrity-v1" as const;
const SERVICE_PHASE = "phase-local-client-management-v1";
const LOCAL_CLIENT_IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const LOCAL_CLIENT_SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_PENDING_FEEDBACK_MARKERS_PER_CLIENT = 256;
const MAX_VERIFICATION_EVIDENCE_TTL_MS = 24 * 60 * 60_000;
const MAX_REGISTRY_FILE_BYTES = 16 * 1024 * 1024;
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

function now(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeNumber(value: unknown, fallback: null): number | null;
function safeNumber(value: unknown, fallback?: number): number;
function safeNumber(value: unknown, fallback: number | null = 0): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeTrim(value: unknown, fallback = ""): string {
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

function normalizeStoredIdentifier(value: unknown): string | null {
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

function normalizeProbeVerificationEvidence(value: unknown): LocalClientVerificationEvidence | null {
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

function isVerificationEvidenceFresh<T extends Pick<LocalClientVerificationEvidence, "verifiedAtMs" | "expiresAtMs">>(
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

function isClientCurrentlyVerified(client: StoredLocalClient, nowMs: number): boolean {
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

function toList(value: unknown): string[] {
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

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function cloneRegistryIntegrityKey(value: unknown): Buffer | null {
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

function normalizeCapability(value: unknown): string {
  return safeTrim(value, "")
    .toLowerCase()
    .replace(/[-\s]+/gu, "_");
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function incrementClientRevision(value: unknown): number {
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

function throwIfLocalClientAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw createError(
    "local_client_operation_aborted",
    "The local-client management operation was cancelled.",
    { statusCode: 499, category: "cancellation" },
  );
}

function parsePositiveInt(value: unknown, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
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

function fileExists(filePath: string): Promise<boolean> {
  return access(filePath).then(() => true, () => false);
}

function createError(code: string, message: string, options: LocalClientErrorOptions = {}): LocalClientServiceError {
  const error = new Error(message) as LocalClientServiceError;
  error.code = code;
  error.statusCode = options.statusCode ?? 422;
  error.category = options.category ?? "validation";
  if (options.details) {
    error.details = options.details;
  }
  return error;
}

function feedbackOutcomeUnknownError(_cause: unknown): LocalClientServiceError {
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

function normalizeScope(scope: unknown): LocalClientScope {
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

function belongsToScope(client: StoredLocalClient, scope: LocalClientScope): boolean {
  return client.tenantId === scope.tenantId;
}

function normalizeVerificationScope(scope: unknown): LocalClientVerificationScope {
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

function toDeclaredVerificationProjection(
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

function hasExactKeys(value: unknown, expected: readonly string[]): value is UnknownRecord {
  if (!isRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length
    && keys.every((key) => typeof key === "string" && expected.includes(key))
    && expected.every((key) => Object.hasOwn(value, key));
}

function safeSha256Equal(left: unknown, right: unknown): boolean {
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

function descriptorSupportsClient(
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

function toPublicClient(client: StoredLocalClient, nowTs = Date.now()): ManagedLocalClientSummary {
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

function createDefaultRegistry(): LocalClientRegistry {
  return {
    version: REGISTRY_VERSION,
    generation: 0,
    updatedAt: now(),
    createdAt: now(),
    clients: [],
    integrity: null,
  };
}

function normalizeClient(
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

function normalizeRegisterInput(
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

function normalizeDiscoverInput(
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

function normalizeSystemDiscoverInput(input: LocalClientSystemDiscoverInput | null | undefined) {
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

function normalizeHeartbeatInput(input: LocalClientHeartbeatInput | null | undefined) {
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

function normalizeFeedbackInput(input: LocalClientFeedbackInput | null | undefined) {
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
type DurableNormalizedFeedbackRequest = Omit<
  NormalizedFeedbackRequest,
  "eventId" | "taskId" | "latencyMs" | "observedAt"
> & Readonly<{
  eventId: string;
  taskId: string;
  latencyMs: number;
  observedAt: string;
}>;

function assertDurableFeedbackRequest(
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

function normalizeRouteRequest(input: LocalClientRouteInput | null | undefined): NormalizedRouteRequest {
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

function normalizeExecuteInput(input: LocalClientExecuteInput | null | undefined) {
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

function normalizeMaintenanceInput(input: LocalClientMaintenanceInput | null | undefined) {
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

function normalizeSmartManageInput(input: LocalClientSmartManageInput | null | undefined) {
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

function normalizeDisableInput(input: LocalClientDisableInput | null | undefined) {
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

function normalizeRevokeInput(input: LocalClientRevokeInput | null | undefined) {
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

function computeReliabilityScore(
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

function updateOutcomeEwma(
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

function rankCandidates(
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

function classifyRiskProfile(
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

function buildBuiltInHintMap(): Map<string, DiscoveryHint> {
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

async function readDiscoveryHints(pathHint: string): Promise<Map<string, DiscoveryHint>> {
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

function safeNumberOrNaN(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

async function listProcessRows(
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

function buildDiscoveryCandidates(
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

function clampStatsAverage(previousAverage: number, previousCount: number, latestValue: number): number {
  if (!Number.isFinite(previousAverage)) {
    return latestValue;
  }
  const count = Math.max(1, previousCount);
  return Math.round((((previousAverage * count) + latestValue) / (count + 1)) * 100) / 100;
}

function mergeHeartbeatLoad(target: StoredLocalClient, request: ReturnType<typeof normalizeHeartbeatInput>): void {
  if (request.cpu !== null) target.load.cpu = safeNumberOrNaN(request.cpu);
  if (request.memory !== null) target.load.memory = safeNumberOrNaN(request.memory);
  if (request.queueDepth !== null) target.load.queueDepth = safeNumberOrNaN(request.queueDepth);
}

function mergeHeartbeatCapabilities(target: StoredLocalClient, request: ReturnType<typeof normalizeHeartbeatInput>): void {
  if (request.capabilities.length === 0) return;
  target.capabilities = Array.from(new Set([...target.capabilities, ...request.capabilities]));
}

function mergeHeartbeatTags(target: StoredLocalClient, request: ReturnType<typeof normalizeHeartbeatInput>): void {
  if (request.tags.length === 0) return;
  target.tags = Array.from(new Set([...target.tags, ...request.tags]));
}

function verifyRegistryIntegrity(key: Buffer, data: UnknownRecord): boolean {
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

function computeRegistryHmac(key: Buffer, payload: object): string {
  return createHmac("sha256", key)
    .update(REGISTRY_INTEGRITY_VERSION)
    .update("\0")
    .update(canonicalRegistryJson(payload))
    .digest("hex");
}

function computeRegistryDigest(snapshot: LocalClientRegistry | UnknownRecord): string {
  return createHash("sha256")
    .update("local-client-signed-registry-checkpoint-v1\0", "utf8")
    .update(canonicalRegistryJson(snapshot), "utf8")
    .digest("hex");
}

function isRegistryGeneration(value: unknown, allowZero: boolean): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && (allowZero ? value >= 0 : value > 0);
}

function incrementRegistryGeneration(value: unknown): number {
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

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? parsed : null;
}

async function saveJson(filePath: string, data: unknown): Promise<void> {
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

async function appendLogEntry(filePath: string, entry: UnknownRecord): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await chmod(dirname(filePath), 0o700).catch(() => undefined);
  const line = `${JSON.stringify(entry)}\n`;
  await appendFile(filePath, line, "utf8");
  await chmod(filePath, 0o600).catch(() => undefined);
}

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
