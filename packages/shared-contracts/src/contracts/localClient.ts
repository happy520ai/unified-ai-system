import {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
  LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
} from "../runtime.js";

/** Public wire versions for managed local-client receipt reconciliation. */
export {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
  LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
} from "../runtime.js";

export interface LocalClientDispatchIntent {
  readonly protocolVersion: typeof LOCAL_CLIENT_DISPATCH_INTENT_VERSION;
  readonly intentId: string;
  readonly executionId: string;
  readonly executionBindingHmac: string;
  readonly tenantBindingHmac: string;
  readonly subjectBindingHmac: string;
  readonly clientBindingHmac: string;
  readonly routeBindingHmac: string;
  readonly identityBindingHmac: string;
  readonly planFingerprint: string;
  readonly inputSha256: string;
  readonly dispatchFencingToken: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly signature: string;
}

export interface LocalClientDurableExecutionReceipt {
  readonly protocolVersion: typeof LOCAL_CLIENT_DURABLE_RECEIPT_VERSION;
  readonly receiptId: string;
  readonly intentId: string;
  readonly executionId: string;
  readonly executionBindingHmac: string;
  readonly tenantBindingHmac: string;
  readonly subjectBindingHmac: string;
  readonly clientBindingHmac: string;
  readonly routeBindingHmac: string;
  readonly identityBindingHmac: string;
  readonly planFingerprint: string;
  readonly inputSha256: string;
  readonly dispatchFencingToken: string;
  readonly completedAtMs: number;
  readonly executionMode: "governed";
  readonly externalEffectPerformed: true;
  readonly status: "completed";
  readonly signature: string;
}

export interface LocalClientReceiptReconciliationQuery {
  readonly protocolVersion: typeof LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION;
  readonly queryId: string;
  readonly intentId: string;
  readonly executionId: string;
  readonly executionBindingHmac: string;
  readonly tenantBindingHmac: string;
  readonly subjectBindingHmac: string;
  readonly clientBindingHmac: string;
  readonly routeBindingHmac: string;
  readonly identityBindingHmac: string;
  readonly planFingerprint: string;
  readonly inputSha256: string;
  readonly dispatchFencingToken: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly purpose: "receipt-reconciliation-only";
  readonly authorizeExecution: false;
  readonly signature: string;
}

export type LocalClientReceiptReconciliationState =
  | "completed"
  | "failed-before-effect"
  | "pending"
  | "not-found";

export interface LocalClientReceiptReconciliationResponse {
  readonly protocolVersion: typeof LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION;
  readonly queryId: string;
  readonly intentId: string;
  readonly executionId: string;
  readonly dispatchFencingToken: string;
  readonly state: LocalClientReceiptReconciliationState;
  readonly receipt: LocalClientDurableExecutionReceipt | null;
  readonly observedAtMs: number;
  readonly retryAllowed: false;
  readonly signature: string;
}

export type LocalClientState =
  | "observed"
  | "declared"
  | "pending_approval"
  | "verified"
  | "disabled"
  | "revoked";

export type LocalClientHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface LocalClientHealthSummary {
  status: LocalClientHealthStatus;
  latencyMs?: number | null;
  lastSeenAt?: string | null;
  leaseExpiresAt?: string | null;
}

/**
 * Public client projection. Storage paths, process ids, commands, endpoints,
 * credentials, raw metadata, and tenant identifiers must never be added here.
 */
export interface ManagedLocalClientSummary {
  clientId: string;
  displayName: string;
  state: LocalClientState;
  enabled: boolean;
  routable: boolean;
  adapterId?: string | null;
  adapterType?: string | null;
  adapterVersion?: string | null;
  manifestSha256?: string | null;
  protocolVersion?: string | null;
  capabilityIds: string[];
  health: LocalClientHealthSummary;
  trustDecision: "unverified" | "declared" | "verified" | "rejected";
  revision?: number;
}

export interface LocalClientRegistryResult {
  phase: string;
  total: number;
  clients: ManagedLocalClientSummary[];
  pagination: {
    offset: number;
    limit: number;
    returned: number;
    includeDisabled: boolean;
  };
}

export interface LocalClientExecutionReceiptJournalStatus {
  enabled: boolean;
  available: boolean;
  durable: boolean;
  distributed: boolean;
  singleHost: boolean;
  bindingCount: number;
  recoveryContextEncrypted: boolean;
  snapshotRollbackProtected: boolean;
  clientAtomicEffectReceiptVerified: boolean;
  tenantClientExactBinding?: true;
  requestBodySelectsJournal?: false;
  rawBindingStatusExposed?: false;
  ownsJournalLifecycle?: true;
  closed?: boolean;
  availableJournalCount?: number;
  recoveryBatchFairness?: "rotating-round-robin";
  fullClosureRequiresClientAtomicEffectReceipt?: true;
}

export interface LocalClientExecutionReceiptRecoveryStatus {
  enabled: boolean;
  available: boolean;
  lifecycle: "disabled" | "idle" | "started" | "closed";
  executionRedispatchAllowed: false;
  reconciliationQueryAuthorizesExecution?: false;
  absenceProvesNotExecuted?: false;
  pendingProvesNotExecuted?: false;
  completedReceiptCanRecoverFeedback?: true;
  lifecycleFinalizationIdempotentRequired?: true;
  automaticApply?: "reconciliation-only";
  distributed?: false;
  intervalMs?: number;
  batchSize?: number;
  recoveryGraceMs?: number;
  runInFlight: boolean;
  runCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  failureCount: number;
  consecutiveFailureCount: number;
  lastErrorCode: string | null;
  lastRunSucceeded: boolean | null;
  lastSuccessAt: string | null;
  lastRunAt: string | null;
}

export interface LocalClientPopSnapshotRollbackProtectionStatus {
  protocolCoreAvailable: boolean;
  configured: boolean;
  ready: boolean;
  snapshotRollbackProtected: boolean;
  nativeDeploymentVerified: boolean;
  blockers: string[];
  boundaries: {
    mutatesOperatingSystem: false;
    provisionsNativeAuthority: false;
    nativeWindowsAdapterImplemented: false;
    sqliteCheckpointCoordinatorImplemented: false;
    statusBooleanAloneIsEvidence: false;
    challengeBoundProtectedEvidenceRequired: true;
    checkpointReadBeforeAndAfterAttestation: true;
    everyReplayMutationMustAdvanceAnchor: true;
    crashRecoveryMustFailClosed: true;
    externalToReplaySnapshotRequired: true;
  };
}

/**
 * Public managed-protocol dispatch readiness. `/health/check` exposes this as
 * `managedLocalClientProtocol`; `/local-clients/status` retains the historical
 * `managedProtocolDispatch` key. The value contract is intentionally shared.
 */
export interface LocalClientManagedProtocolDispatchStatus {
  enabled: boolean;
  ready: boolean;
  fakeProviderOnly: boolean;
  realProviderConfigured: boolean;
  multiInstance: boolean;
  replayProtection: string;
  durableReplayProtection: boolean;
  authenticatedReplaySet: boolean;
  snapshotRollbackProtected: boolean;
  defensiveEnabled: boolean;
  capacityIsolatedByScope: boolean;
  principalBindingCount: number;
  blockers: string[];
}

export interface LocalClientStatusResult {
  phase: string;
  status: "preview-ready" | "ready" | "degraded" | "unavailable";
  executionEnabled: boolean;
  registrySummary: Record<string, number>;
  health: {
    status: LocalClientHealthStatus;
    staleClients: number;
  };
  feedbackDeduplication: {
    enabled: boolean;
    mode: "disabled" | "sqlite-feedback-dedup";
    durable: boolean;
    distributed: boolean;
    exactlyOnceAdmission: boolean;
    deliveryMode: "disabled" | "exclusive-leased-acknowledged";
  };
  executionFeedback?: {
    outbox: {
      available: boolean;
      durable: boolean;
      distributed: boolean;
      singleHost: boolean;
      rollbackResistant?: boolean;
      pendingTtlApplied?: boolean;
      deliverySemantics?: string;
    };
    dispatcher: {
      enabled: boolean;
      available: boolean;
      lifecycle: "disabled" | "idle" | "started" | "closed";
      deliveryInFlight?: boolean;
      unsettledDeliveryCount?: number;
      stageFailureCount?: number;
      releaseFailureCount?: number;
      lastErrorCode?: string | null;
    };
    receiptJournal: LocalClientExecutionReceiptJournalStatus;
    receiptRecovery: LocalClientExecutionReceiptRecoveryStatus;
  };
  clientProofAuthority?: {
    enabled: boolean;
    available: boolean;
    bindingCount: number;
    replayMode: string;
    durableReplayProtection: boolean;
    distributedReplayProtection: boolean;
    authenticatedReplaySet?: boolean;
    snapshotRollbackProtected?: boolean;
    defensiveEnabled?: boolean;
    capacityIsolatedByScope?: boolean;
    maxEntriesPerScope?: number | null;
  };
  managedProtocolDispatch?: LocalClientManagedProtocolDispatchStatus;
  popSnapshotRollbackProtection?: LocalClientPopSnapshotRollbackProtectionStatus;
  onboarding?: {
    enabled: boolean;
    initializationState: "disabled" | "not-started" | "initializing" | "ready" | "recovery-required" | "closed" | "failed";
    configurationVersion: 1;
    configuredProfileCount: 0 | 3;
    clients: ["claude-compatible", "cursor", "vscode"];
    format: "json-only";
    certificationStatus: "fixture-tested-not-real-client-certified";
    requiresExplicitApproval: true;
    requiresDurableIdempotency: true;
    requiresDurableExternalEffectFence: true;
    requiresDurableReceiptAuthority: true;
    automaticDiscoveryOrMutation: false;
    sensitiveConfigurationRedacted: true;
    tenantOwned: true;
    backupProtection: "aes-256-gcm";
  };
  boundaries: {
    previewOnly: boolean;
    tenantScoped: boolean;
    observedApplicationsRoutable: false;
    executionAdapterConfigured: boolean;
    fakeAdapterConfigured?: boolean;
    executionRequested?: boolean;
    executionReady?: boolean;
    executionMode?: "preview-only" | "ready" | "blocked";
    executionBlockers?: string[];
    gatewayAuthoritySecretRequired: true;
    gatewayClientSecretReuseForbidden: true;
  };
}

export interface RegisterLocalClientRequest {
  clientId: string;
  displayName?: string;
  description?: string;
  capabilityIds: string[];
  adapterId?: string;
  adapterType?: string;
  adapterVersion?: string;
  manifestSha256?: string;
  protocolVersion?: string;
}

export interface RegisterLocalClientResult {
  phase: string;
  action: "created" | "updated";
  client: ManagedLocalClientSummary;
}

export interface RevokeLocalClientRequest {
  clientId: string;
  expectedRevision: number;
  reason?: "manual_revoke" | "credential_compromise" | "identity_mismatch" | "security_incident";
  dryRun?: boolean;
}

export interface RevokeLocalClientResult {
  phase: string;
  mode: "preview" | "applied";
  action: "revoke-preview" | "revoked" | "already-revoked";
  expectedRevision?: number;
  writesPerformed?: false;
  client: ManagedLocalClientSummary;
}

export interface RouteLocalClientRequest {
  taskText?: string;
  requiredCapabilities?: string[];
  preferredClientId?: string;
  maxCandidates?: number;
}

export interface LocalClientRouteCandidate {
  clientId: string;
  displayName: string;
  score: number;
  matchedCapabilities: string[];
  missingCapabilities: string[];
  reasons: string[];
}

export interface RouteLocalClientResult {
  phase: string;
  status: "route-ready" | "partial-route" | "no-client";
  selected: LocalClientRouteCandidate | null;
  alternatives: LocalClientRouteCandidate[];
  request: {
    requiredCapabilities: string[];
    capabilitySource: "explicit" | "inferred" | "none";
    maxCandidates: number;
  };
}

export interface RouteLocalClientProviderRequest {
  clientId: string;
  expectedClientRevision?: number;
  requiredCapabilities?: string[];
  requestedFanout?: number;
  fusionRequested?: boolean;
}

export interface LocalClientProviderRouteCandidate {
  provider: string;
  model: string;
  region: string | null;
  capabilities: string[];
  health: number;
  reliability: number;
  latencyMs: number | null;
  costUsd: number | null;
  quotaRemaining: number | null;
  free: boolean;
  available: boolean;
}

export interface LocalClientProviderRouteReason {
  code: string;
  message: string;
  field?: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean | null;
}

export interface LocalClientProviderRouteEvaluation {
  candidate: LocalClientProviderRouteCandidate;
  candidateKey: string;
  disposition: "selected" | "eligible_not_selected" | "rejected";
  policyEligible: boolean;
  selected: boolean;
  rejectionReasons: LocalClientProviderRouteReason[];
  notSelectedReasons: LocalClientProviderRouteReason[];
  score: number | null;
  scoreBreakdown: null | {
    exactCapabilityMatch: boolean;
    capability: number;
    health: number;
    reliability: number;
    latency: number;
    cost: number;
    quota: number;
    freePreference: number;
    total: number;
  };
}

export interface RouteLocalClientProviderResult {
  runtimeRouterVersion: "local-client-provider-runtime-router-v1";
  clientRevision: number;
  policyRevision: string;
  dispatchPerformed: false;
  inventory: {
    providerCount: number;
    modelCount: number;
    observedModelCount: number;
    unknownRegionCount: number;
    unknownCostCount: number;
    unknownQuotaCount: number;
  };
  decision: {
    policyVersion: "local-client-provider-policy-v1";
    dataClass: "public" | "internal" | "confidential" | "restricted";
    requestedFanout: number;
    policyMaxFanout: number;
    effectiveFanout: number;
    fanoutCapped: boolean;
    fusionRequested: boolean;
    fusionAllowed: boolean;
    fusionEnabled: boolean;
    sensitiveDefaultsApplied: boolean;
    selected: LocalClientProviderRouteCandidate[];
    evaluations: LocalClientProviderRouteEvaluation[];
    decisionReasons: LocalClientProviderRouteReason[];
  };
  boundaries: {
    verifiedClientRequired: true;
    candidatesFromTrustedRegistry: true;
    policyFromTrustedResolver: true;
    requestSuppliedFactsDenied: true;
    clientRevisionBound: true;
    dispatchPerformed: false;
  };
}

export interface VerifyLocalClientRequest {
  clientId: string;
  expectedRevision: number;
  expectedAdapter: {
    id: string;
    type: string;
    version: string;
  };
  expectedManifestSha256: string;
}

export interface VerifyLocalClientResult {
  promotionVersion: "local-client-verification-promotion-v1";
  descriptorVersion: "verified-local-client-adapter-target-v1";
  clientId: string;
  revision: number;
  state: "verified";
  trustDecision: "verified";
  adapter: { id: string; type: string; version: string };
  manifestSha256: string;
  capabilityIds: string[];
  verification: {
    evidenceVersion: "local-client-verification-evidence-v1";
    fingerprint: string;
    verifiedAtMs: number;
    expiresAtMs: number;
  };
}

export interface PreviewGovernedLocalClientExecutionRequest {
  clientId: string;
  capabilityId: string;
  actionId: string;
  input: Record<string, string | number | boolean>;
}

export interface PreviewGovernedLocalClientExecutionResult {
  apiVersion: "local-client-governed-execution-api-v2";
  operation: "preview";
  status: "approval-required";
  executionPerformed: false;
  plan: {
    planVersion: string;
    planId: string;
    clientId: string;
    clientRevision: number;
    clientState: "verified";
    clientTrustDecision: "verified";
    adapter: { id: string; type: string; version: string };
    capabilityId: string;
    actionId: string;
    inputSha256: string;
    policyVersion: string;
    createdAt: string;
    expiresAt: string;
  };
  approval: { required: true; planDigest: string; scopes: string[] };
  boundaries: Record<string, boolean>;
}

export interface ApproveGovernedLocalClientExecutionRequest {
  planId: string;
  note?: string;
}

export interface ApproveGovernedLocalClientExecutionResult {
  apiVersion: "local-client-governed-execution-api-v2";
  operation: "approve";
  status: "approved";
  executionPerformed: false;
  approval: {
    approvalId: string;
    planId: string;
    planDigest: string;
    scopes: string[];
    approvedAt: string;
    expiresAt: string;
  };
  boundaries: Record<string, boolean>;
}

export interface ExecuteGovernedLocalClientExecutionRequest {
  planId: string;
  input: Record<string, string | number | boolean>;
}

export interface ExecuteGovernedLocalClientExecutionResult {
  accepted: true;
  status: "completed" | "replayed";
  statusCode: 200;
  idempotencyStatus: "created" | "replayed";
  replayed: boolean;
  replayable: true;
  operationInvoked: boolean;
  retryAllowed: false;
  result: {
    status: "completed";
    executionId: string;
    planId: string;
    planFingerprint: string;
    reservationFingerprint: string;
    externalEffectCommitted: true;
    retryAllowed: false;
    receipt: Record<string, unknown>;
    feedback: {
      source: "verified-governed-receipt";
      eventId: string;
      attempted: boolean;
      persisted: boolean;
      exactlyOnce: boolean;
      replayed: boolean;
      deliveryStatus: "persisted" | "queued" | "not-configured" | "failed";
      errorCode:
        | "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIGURED"
        | "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED"
        | null;
    };
  };
}

export interface GovernedLocalClientExecutionStatusResult {
  apiVersion: "local-client-governed-execution-api-v2";
  operation: "status";
  executionId: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled" | "force_stopped";
  cancelRequested: boolean;
  pauseRequested: boolean;
  completedAgents: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CancelGovernedLocalClientExecutionRequest {
  reason?: string;
}

export interface CancelGovernedLocalClientExecutionResult {
  apiVersion: "local-client-governed-execution-api-v2";
  operation: "cancel";
  executionId: string;
  status: "cancel-requested" | "cancelled";
  lifecycleStatus: "pending" | "running" | "paused" | "cancelled";
  cancelRequested: boolean;
  reasonReturned: false;
}

export type LocalClientOnboardingProfileId =
  | "claude-compatible-mcp-json"
  | "cursor-mcp-json"
  | "vscode-mcp-json";

export type GovernedLocalClientOnboardingAction =
  | "enable"
  | "disable"
  | "rollback"
  | "recover";

export interface LocalClientOnboardingProfileSummary {
  profileId: LocalClientOnboardingProfileId;
  client: "claude-compatible" | "cursor" | "vscode";
  format: "json-only";
  containerKey: "mcpServers" | "servers";
  serverName: "unified-ai-system";
  transport: "stdio";
  backupProtection: "aes-256-gcm" | "0600-plaintext";
  supportedActions: ["enable", "disable"];
  certificationStatus: "fixture-tested-not-real-client-certified";
  redacted: true;
}

export interface LocalClientOnboardingVerificationResult {
  profileId: LocalClientOnboardingProfileId;
  installed: boolean;
  state: "exact" | "absent" | "different";
  format: "json-only";
  certificationStatus: "fixture-tested-not-real-client-certified";
  redacted: true;
}

export interface LocalClientOnboardingInspectionResult {
  profile: LocalClientOnboardingProfileSummary;
  installation: LocalClientOnboardingVerificationResult;
  recoveryRequired: boolean;
  journalCorrupt: boolean;
  pendingTransactionCount: number;
  storedPlanCount: number;
  available: true;
}

export interface LocalClientOnboardingConfigApplyReceipt {
  receiptVersion: "local-client-config-receipt-v1";
  transactionId: string;
  planId: string;
  targetFingerprint: string;
  beforeSha256: string;
  afterSha256: string;
  backupSha256: string;
  afterIdentityFingerprint: string;
  committedAtMs: number;
  receiptDigest: string;
}

export interface LocalClientOnboardingConfigRollbackReceipt {
  rollbackReceiptVersion: "local-client-config-rollback-receipt-v1";
  transactionId: string;
  planId: string;
  restoredSha256: string;
  replacedSha256: string;
  backupSha256: string;
  rolledBackAtMs: number;
  receiptDigest: string;
}

/**
 * Public receipts contain hashes and opaque transaction identifiers only.
 * Target paths, commands, args, cwd, env, and configuration bodies are never
 * part of this contract.
 */
export interface LocalClientOnboardingApplyReceipt {
  receiptVersion: "local-client-onboarding-receipt-v1";
  profileId: LocalClientOnboardingProfileId;
  action: "enable" | "disable";
  planId: string;
  transaction: LocalClientOnboardingConfigApplyReceipt;
  receiptDigest: string;
  format: "json-only";
  certificationStatus: "fixture-tested-not-real-client-certified";
  redacted: true;
}

export interface LocalClientOnboardingRollbackReceipt {
  rollbackVersion: "local-client-onboarding-rollback-v1";
  profileId: LocalClientOnboardingProfileId;
  action: "enable" | "disable";
  planId: string;
  transaction: LocalClientOnboardingConfigRollbackReceipt;
  format: "json-only";
  certificationStatus: "fixture-tested-not-real-client-certified";
  redacted: true;
}

export interface LocalClientOnboardingConfigRecoveryReceipt {
  recoveryReceiptVersion: "local-client-config-recovery-receipt-v1";
  transactionId: string;
  resolution: "apply-aborted" | "apply-committed" | "rollback-aborted" | "rollback-completed";
  currentSha256: string;
  recoveredAtMs: number;
  applyReceipt: LocalClientOnboardingConfigApplyReceipt | null;
  rollbackReceipt: LocalClientOnboardingConfigRollbackReceipt | null;
}

export interface LocalClientOnboardingRecoveryReceipt {
  recoveryVersion: "local-client-onboarding-recovery-v1";
  profileId: LocalClientOnboardingProfileId;
  transaction: LocalClientOnboardingConfigRecoveryReceipt;
  format: "json-only";
  certificationStatus: "fixture-tested-not-real-client-certified";
  redacted: true;
}

export type PlanGovernedLocalClientOnboardingRequest =
  | {
    profileId: LocalClientOnboardingProfileId;
    action: "enable" | "disable" | "recover";
    receipt?: never;
  }
  | {
    profileId: LocalClientOnboardingProfileId;
    action: "rollback";
    receipt: LocalClientOnboardingApplyReceipt;
  };

export interface PlanGovernedLocalClientOnboardingResult {
  apiVersion: "local-client-governed-onboarding-api-v1";
  planVersion: "local-client-governed-onboarding-plan-v1";
  planId: string;
  planDigest: string;
  profileId: LocalClientOnboardingProfileId;
  action: GovernedLocalClientOnboardingAction;
  scopes: string[];
  createdAtMs: number;
  expiresAtMs: number;
  writesPerformed: false;
  redacted: true;
}

export interface ApproveGovernedLocalClientOnboardingRequest {
  planId: string;
  note?: string;
}

export interface ApproveGovernedLocalClientOnboardingResult {
  apiVersion: "local-client-governed-onboarding-api-v1";
  operation: "approve";
  status: "approved";
  approvalId: string;
  planId: string;
  planDigest: string;
  scopes: string[];
  approvedAt: string;
  expiresAt: string;
  writesPerformed: false;
  redacted: true;
}

export interface MutateGovernedLocalClientOnboardingRequest {
  planId: string;
}

interface GovernedLocalClientOnboardingMutationResultBase {
  apiVersion: "local-client-governed-onboarding-api-v1";
  profileId: LocalClientOnboardingProfileId;
  planId: string;
  status: "completed";
  redacted: true;
}

export type GovernedLocalClientOnboardingMutationResult =
  | GovernedLocalClientOnboardingMutationResultBase & {
    operation: "apply";
    action: "enable" | "disable";
    receipt: LocalClientOnboardingApplyReceipt;
  }
  | GovernedLocalClientOnboardingMutationResultBase & {
    operation: "rollback";
    action: "rollback";
    receipt: LocalClientOnboardingRollbackReceipt;
  }
  | GovernedLocalClientOnboardingMutationResultBase & {
    operation: "recover";
    action: "recover";
    receipt: LocalClientOnboardingRecoveryReceipt;
  };

export type GovernedLocalClientOnboardingMutationOutcome =
  | {
    accepted: true;
    status: "completed" | "replayed";
    statusCode: 200;
    idempotencyStatus: "created" | "replayed";
    replayed: boolean;
    replayable: true;
    operationInvoked: boolean;
    retryAllowed: false;
    result: GovernedLocalClientOnboardingMutationResult;
  }
  | {
    accepted: false;
    status: "rejected";
    statusCode: number;
    code: string;
    message: string;
    replayed: false;
    replayable: false;
    operationInvoked: boolean;
    retryAllowed: boolean;
    retryAfterSeconds?: number;
    result: null;
  }
  | {
    accepted: false;
    status: "unknown-reconcile-required";
    statusCode: 409 | 503;
    code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN";
    message: string;
    replayed: boolean;
    replayable: false;
    operationInvoked: boolean;
    retryAllowed: false;
    result: null;
  };

export interface GovernedLocalClientOnboardingMutationOptions {
  idempotencyKey: string;
}

export interface PreviewLocalClientExecutionRequest extends RouteLocalClientRequest {
  clientId?: string;
  action: string;
  dryRun?: true;
  arguments?: Record<string, unknown>;
}

export interface PreviewLocalClientExecutionResult {
  phase: string;
  executionEnabled: false;
  dryRun: true;
  status: "preview-only";
  selectedClientId: string;
  selectedClientName: string;
  route: RouteLocalClientResult;
  note: string;
}
