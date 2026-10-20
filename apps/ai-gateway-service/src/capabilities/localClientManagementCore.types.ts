// Extracted verbatim from localClientManagementCore.ts so the management
// types live beside the core module (agentGovernanceService.types.ts pattern).
// Pure mechanical move; no runtime behaviour.
import type {
  LocalClientHealthStatus,
  ManagedLocalClientSummary,
  RegisterLocalClientRequest,
  RouteLocalClientRequest,
} from "@unified-ai-system/shared-contracts";
import type { LocalClientAdapterRegistry, VerifiedLocalClientAdapterTarget } from "./localClientAdapterRegistry.ts";
import type { LocalClientExecutionReadiness } from "./localClientExecutionReadiness.ts";
import type { LocalClientSqliteFeedbackDedupStore } from "./localClientSqliteFeedbackDedupStore.ts";
import type { LocalClientSqliteVerificationAuthorityEpochStore } from "./localClientSqliteVerificationAuthorityEpochStore.ts";
import { LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION } from "./localClientVerificationService.ts";
import type { LocalClientVerificationScope } from "./localClientVerificationService.ts";

export type UnknownRecord = Record<string, unknown>;
export type LocalClientVerificationStatus = "unverified" | "declared" | "verified";
export type LocalClientFeedbackStatus = "success" | "failure" | "error" | "timeout";

export interface LocalClientScope {
  tenantId: string;
  userId: string;
}

export interface StoredClientHealth {
  status: LocalClientHealthStatus;
  latencyMs: number | null;
  lastError: string | null;
  updatedAt: string;
}

export interface StoredClientLoad {
  cpu: number;
  memory: number;
  queueDepth: number;
}

export interface StoredClientStats {
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

export interface StoredClientVerificationEvidence {
  evidenceVersion: typeof LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION;
  fingerprint: string;
  declarationFingerprint: string;
  verifiedAtMs: number;
  expiresAtMs: number;
}

export interface StoredFeedbackAppliedEventMarker {
  eventFingerprint: string;
  admissionFingerprint: string;
}

export interface StoredClientMetadata extends UnknownRecord {
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

export interface NestedHealthInput extends UnknownRecord {
  status?: unknown;
  latencyMs?: unknown;
  responseMs?: unknown;
  lastError?: unknown;
  updatedAt?: unknown;
}

export interface NestedLoadInput extends UnknownRecord {
  cpu?: unknown;
  memory?: unknown;
  queueDepth?: unknown;
}

export interface NestedStatsInput extends UnknownRecord {
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

export interface LocalClientInput extends UnknownRecord {
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

export interface NormalizeClientOptions {
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

export interface ProcessRow extends UnknownRecord {
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

export interface NormalizedProcessRow {
  processName: string;
  executable: string;
  pid: number | null;
  sessionName: string;
  sessionId: number | null;
  userName: string;
}

export interface DiscoveryHint extends UnknownRecord {
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

export interface DiscoveryHintInput extends UnknownRecord {
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

export type LocalClientServiceError = Error & {
  code: string;
  statusCode: number;
  category: string;
  details?: UnknownRecord;
};

export interface LocalClientErrorOptions {
  statusCode?: number;
  category?: string;
  details?: UnknownRecord;
}

export interface RankedLocalClient extends StoredLocalClient {
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

export interface NormalizedRouteRequest {
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
